import { secretEquals } from "../src/crypto/secret";
import { readBodyUpTo } from "../src/http/body";
import {
	type GatewayFigure,
	isCount,
	isFigureOf,
	isRoutingDay,
	ROUTE_HEADER,
	routingDay,
	TEAM_FIGURES,
} from "../src/routing/figures";
import { idJson, isStravaId, parseStravaJson } from "../src/strava/id";
import { copyStub, type Lookup, type OwnCount, type RoutingCopy } from "./copy";
import { chooseTeams, routingMode } from "./routing";
import {
	type GatewayTeam,
	parseTeams,
	serviceBindingName,
	webhookTokenName,
} from "./teams";

export { RoutingCopy } from "./copy";

// The Strava gateway (feature 026 release 3, contracts/gateway.md). Strava's
// one webhook subscription and one OAuth callback domain serve every team:
// events are acked at once and forwarded to each team through a queue, with
// retries per team; a rider coming back from Strava is sent on to their own
// team. Answers are for Strava, not riders: plain English, no catalogue.
//
// Gateway routing (feature 046, contracts/gateway.md): with `ROUTING` at
// `trial` or `on`, a copy of which teams hold which athletes chooses the teams
// an event goes to; anything unknown or unreadable goes to every team. The
// copy is its only rider data (FR-010). It logs only `forward team=<id>
// status=<code> attempt=<n>` and statuses of its routes and the copy, never a
// body, athlete ID or code (FR-008, FR-010, feature 046 FR-013).

export interface GatewayEnv {
	TEAMS: string;
	/** Feature 046: `off`, `trial` or `on` (research R2). */
	ROUTING?: string;
	ROUTING_COPY: DurableObjectNamespace<RoutingCopy>;
	/** "local-only" in tests and `pnpm dev`: no jurisdiction (gateway/copy.ts). */
	ROUTING_COPY_LOCAL?: string;
	STRAVA_WEBHOOK_VERIFY_TOKEN: string;
	FORWARD_QUEUE: Queue<ForwardMessage>;
	/** TEAM_WEBHOOK_TOKEN_<ID> per team. */
	[secret: `TEAM_WEBHOOK_TOKEN_${string}`]: string | undefined;
	/**
	 * TEAM_SERVICE_<ID>: the team's Worker, for a team on the gateway's own
	 * Cloudflare account. The forward then goes to the Worker directly,
	 * without leaving Cloudflare. Without one, the gateway fetches the team's
	 * origin.
	 */
	[service: `TEAM_SERVICE_${string}`]: Fetcher | undefined;
}

/** One Strava event for one team, as Strava sent it. */
export interface ForwardMessage {
	team: string;
	body: string;
	/** In the trial only: whether routing would have sent it (FR-020). */
	chosen?: boolean;
}

type WaitUntil = Pick<ExecutionContext, "waitUntil">;

/** Same limit as the teams' own webhook (src/http/webhook.ts). */
const MAX_BODY_BYTES = 4096;
const FORWARD_TIMEOUT_MS = 10_000;
const MAX_DELAY_SECONDS = 12 * 60 * 60;
/** OAuth answer fields copied to the team; nothing else goes along (FR-007). */
const RETURN_PARAMS = ["code", "state", "scope", "error"] as const;
/** A full list: 999 IDs of up to 19 digits, with room (feature 046). */
const MAX_LIST_BYTES = 64 * 1024;
const MAX_LIST_IDS = 999;
/** A team's own counts: four figures for 30 days, with room. */
const MAX_COUNTS_BYTES = 16 * 1024;
const MAX_OWN_COUNTS = 200;
/** How long choosing may take before the event goes to everyone (FR-002). */
export const LOOKUP_BUDGET_MS = 1_000;

function text(body: string, status: number): Response {
	return new Response(body, {
		status,
		headers: { "Content-Type": "text/plain; charset=utf-8" },
	});
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

export async function gatewayFetch(
	request: Request,
	env: GatewayEnv,
	ctx?: WaitUntil,
): Promise<Response> {
	const url = new URL(request.url);
	try {
		if (url.pathname === "/health" && request.method === "GET") {
			return text("ok", 200);
		}
		const webhook = /^\/strava\/webhook\/([^/]+)$/.exec(url.pathname);
		if (webhook?.[1]) {
			return await handleWebhook(request, url, webhook[1], env, ctx);
		}
		const held = /^\/teams\/([^/]+)\/held$/.exec(url.pathname);
		if (held?.[1] && request.method === "POST") {
			return await askTeams(request, held[1], env);
		}
		const letGo = /^\/teams\/([^/]+)\/let-go$/.exec(url.pathname);
		if (letGo?.[1] && request.method === "POST") {
			return await letGoTeams(request, letGo[1], env);
		}
		const route = /^\/teams\/([^/]+)\/(report|list|counts)$/.exec(url.pathname);
		if (route?.[1] && route[2] && request.method === "POST") {
			const handle = { report: takeReport, list: takeList, counts: exchange }[
				route[2] as "report" | "list" | "counts"
			];
			return await handle(request, route[1], env);
		}
		const back = /^\/auth\/return\/([^/]+)$/.exec(url.pathname);
		if (back?.[1] && request.method === "GET") {
			return returnToTeam(url, back[1], env);
		}
		return text("Not Found", 404);
	} catch (err) {
		// The URL may carry the token or an OAuth code: name the error type only.
		const name = err instanceof Error ? err.name : "unknown error";
		console.error(`gateway request failed: ${name}`);
		return text("Service Unavailable", 503);
	}
}

async function handleWebhook(
	request: Request,
	url: URL,
	token: string,
	env: GatewayEnv,
	ctx: WaitUntil | undefined,
): Promise<Response> {
	if (!(await secretEquals(token, env.STRAVA_WEBHOOK_VERIFY_TOKEN))) {
		return text("Forbidden", 403);
	}
	if (request.method === "GET") return validateSubscription(url, env);
	if (request.method === "POST") return receiveEvent(request, env, ctx);
	return new Response("Method Not Allowed", {
		status: 405,
		headers: { Allow: "GET, POST" },
	});
}

async function validateSubscription(
	url: URL,
	env: GatewayEnv,
): Promise<Response> {
	const challenge = url.searchParams.get("hub.challenge");
	if (
		url.searchParams.get("hub.mode") !== "subscribe" ||
		challenge === null ||
		!(await secretEquals(
			url.searchParams.get("hub.verify_token") ?? "",
			env.STRAVA_WEBHOOK_VERIFY_TOKEN,
		))
	) {
		return text("Forbidden", 403);
	}
	return Response.json({ "hub.challenge": challenge });
}

/**
 * Queues the event for the teams it goes to (feature 046 FR-001): every team
 * while routing is off; the chosen ones while it is on; every team, marked
 * chosen or not, in the trial (FR-020).
 */
async function receiveEvent(
	request: Request,
	env: GatewayEnv,
	ctx: WaitUntil | undefined,
): Promise<Response> {
	const body = await readBodyUpTo(request, MAX_BODY_BYTES);
	const ownerId = body === null ? null : eventOwner(body);
	if (body === null || ownerId === null) return text("Bad Request", 400);
	const teams = parseTeams(env.TEAMS).map((team) => team.id);
	const mode = routingMode(env.ROUTING);
	let messages: ForwardMessage[] = teams.map((team) => ({ team, body }));
	if (mode !== "off" && teams.length > 0) {
		const now = nowSeconds();
		const found = await lookup(env, ownerId, now);
		const choice = chooseTeams(
			teams,
			found?.listed ?? null,
			found?.routing ?? null,
		);
		messages =
			mode === "on"
				? choice.teams.map((team) => ({ team, body }))
				: teams.map((team) => ({
						team,
						body,
						chosen: choice.teams.includes(team),
					}));
		// After the choice, never on the acknowledgement's path (research R3).
		const figures: Partial<Record<GatewayFigure, number>> = { [choice.by]: 1 };
		if (choice.allRouting) {
			figures.allRouting = 1;
			if (choice.by === "everyone") figures.allRoutingEveryone = 1;
		}
		const counting = countEvent(env, routingDay(now), figures);
		if (ctx) ctx.waitUntil(counting);
		else await counting;
	}
	if (messages.length > 0) {
		await env.FORWARD_QUEUE.sendBatch(messages.map((m) => ({ body: m })));
	}
	return text("ok", 200);
}

/**
 * The athlete's teams and the routing teams, or null when the copy can't be
 * read within the budget (FR-001, FR-002).
 */
async function lookup(
	env: GatewayEnv,
	athleteId: string,
	now: number,
): Promise<Lookup | null> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			copyStub(env).lookup(athleteId, now) as Promise<Lookup>,
			new Promise<null>((resolve) => {
				timer = setTimeout(() => {
					console.error("lookup status=timeout");
					resolve(null);
				}, LOOKUP_BUDGET_MS);
			}),
		]);
	} catch (err) {
		console.error(`lookup status=${err instanceof Error ? err.name : "error"}`);
		return null;
	} finally {
		clearTimeout(timer);
	}
}

async function countEvent(
	env: GatewayEnv,
	day: string,
	figures: Partial<Record<GatewayFigure, number>>,
): Promise<void> {
	try {
		await copyStub(env).count(day, figures);
	} catch (err) {
		console.error(`count status=${err instanceof Error ? err.name : "error"}`);
	}
}

/**
 * The event's athlete when the body has the fields every Strava event
 * carries, else null. The teams check the rest (src/http/webhook.ts),
 * including the subscription ID.
 */
function eventOwner(body: string): string | null {
	let json: unknown;
	try {
		// The IDs' exact digits: events have no `*_str` (feature 042).
		json = parseStravaJson(body, ["object_id", "owner_id"]);
	} catch {
		return null;
	}
	if (typeof json !== "object" || json === null || Array.isArray(json)) {
		return null;
	}
	const e = json as Record<string, unknown>;
	return typeof e.object_type === "string" &&
		typeof e.aspect_type === "string" &&
		isStravaId(e.object_id) &&
		isStravaId(e.owner_id) &&
		Number.isSafeInteger(e.subscription_id) &&
		typeof e.event_time === "number"
		? e.owner_id
		: null;
}

/**
 * `/auth/return/<teamId>`: Strava's OAuth answer goes on to the team's own
 * callback. The target comes from `TEAMS` only, never from the request; the
 * team's callback checks its state cookie as always (US1 scenario 4).
 */
function returnToTeam(url: URL, teamId: string, env: GatewayEnv): Response {
	const team = parseTeams(env.TEAMS).find((t) => t.id === teamId);
	if (!team) return text("Not Found", 404);
	const target = new URL("/auth/callback", team.origin);
	for (const name of RETURN_PARAMS) {
		const value = url.searchParams.get(name);
		if (value !== null) target.searchParams.set(name, value);
	}
	return new Response(null, {
		status: 302,
		headers: { Location: target.href, "Cache-Control": "no-store" },
	});
}

const HOLDS = ["none", "reconnect", "connected"] as const;
type Hold = (typeof HOLDS)[number];

/** One team's answer to the team question (feature 044 R2). */
interface HeldAnswer {
	held: Hold;
	/** Held as a rider, not a guest; an answer without it counts as false. */
	rider: boolean;
}

/**
 * Every team, once the request's bearer token is the one the gateway holds for
 * `teamId`; otherwise the refusal to answer with. A team only ever speaks for
 * itself (feature 046 FR-008).
 */
async function authorizedTeams(
	request: Request,
	teamId: string,
	env: GatewayEnv,
): Promise<GatewayTeam[] | Response> {
	const teams = parseTeams(env.TEAMS);
	const token = env[webhookTokenName(teamId) as `TEAM_WEBHOOK_TOKEN_${string}`];
	const bearer = /^Bearer (.+)$/.exec(
		request.headers.get("Authorization") ?? "",
	);
	if (
		!teams.some((t) => t.id === teamId) ||
		!token ||
		!bearer?.[1] ||
		!(await secretEquals(bearer[1], token))
	) {
		return text("Forbidden", 403);
	}
	return teams;
}

/**
 * The athlete a team asks about, once its bearer token is the one the gateway
 * holds for it; otherwise the refusal to answer with.
 */
async function askingTeam(
	request: Request,
	teamId: string,
	env: GatewayEnv,
): Promise<{ teams: GatewayTeam[]; athleteId: string } | Response> {
	const teams = await authorizedTeams(request, teamId, env);
	if (teams instanceof Response) return teams;
	const body = await readBodyUpTo(request, MAX_BODY_BYTES);
	let athleteId: unknown;
	try {
		athleteId =
			body === null
				? undefined
				: (parseStravaJson(body, ["athleteId"]) as { athleteId?: unknown })
						?.athleteId;
	} catch {
		athleteId = undefined;
	}
	if (!isStravaId(athleteId)) return text("Bad Request", 400);
	return { teams: teams.filter((t) => t.id !== teamId), athleteId };
}

/**
 * `POST /teams/<teamId>/held`: a team asks whether any other team holds a
 * person (feature 041 research R14, contracts/withdrawal.md), and whether as a
 * rider (feature 044 R2, contracts/one-team.md). The answer is the strongest
 * of the other teams' (`connected` over `reconnect` over `none`), `rider` if
 * any said so; it never says which team. No answer from any of them is a 503:
 * the asking team keeps the token and asks again. Logs a status per asked
 * team, never the athlete. Always asks the teams, never the routing copy
 * (feature 046 FR-003).
 */
async function askTeams(
	request: Request,
	teamId: string,
	env: GatewayEnv,
): Promise<Response> {
	const asking = await askingTeam(request, teamId, env);
	if (asking instanceof Response) return asking;
	const answers = await Promise.all(
		asking.teams.map((t) =>
			askTeam(t, "held", asking.athleteId, env, readHeld),
		),
	);
	if (answers.includes(null)) return text("Service Unavailable", 503);
	const held = (answers as HeldAnswer[]).reduce<HeldAnswer>(
		(strongest, answer) => ({
			held:
				HOLDS.indexOf(answer.held) > HOLDS.indexOf(strongest.held)
					? answer.held
					: strongest.held,
			rider: strongest.rider || answer.rider,
		}),
		{ held: "none", rider: false },
	);
	return Response.json(held);
}

function readHeld(body: unknown): HeldAnswer | null {
	const { held, rider } = (body ?? {}) as { held?: unknown; rider?: unknown };
	if (!HOLDS.includes(held as Hold)) return null;
	return { held: held as Hold, rider: rider === true };
}

/**
 * `POST /teams/<teamId>/let-go`: a person who rides for another team chose to
 * switch to the asking one (feature 044 R4, contracts/one-team.md). Every
 * other team lets them go as a rider; 200 only once all of them confirmed.
 * Like the team question, never reads the routing copy.
 */
async function letGoTeams(
	request: Request,
	teamId: string,
	env: GatewayEnv,
): Promise<Response> {
	const asking = await askingTeam(request, teamId, env);
	if (asking instanceof Response) return asking;
	const answers = await Promise.all(
		asking.teams.map((t) =>
			askTeam(t, "let-go", asking.athleteId, env, (body) =>
				(body as { letGo?: unknown } | null)?.letGo === true ? true : null,
			),
		),
	);
	if (answers.includes(null)) return text("Service Unavailable", 503);
	return Response.json({ letGo: true });
}

/** A JSON object body of at most `max` bytes, or null. */
async function jsonBody(
	request: Request,
	max: number,
): Promise<Record<string, unknown> | null> {
	const body = await readBodyUpTo(request, max);
	if (body === null) return null;
	try {
		const json: unknown = JSON.parse(body);
		return typeof json === "object" && json !== null && !Array.isArray(json)
			? (json as Record<string, unknown>)
			: null;
	} catch {
		return null;
	}
}

/** A failed call to the copy: logged with the team and the error type only. */
function copyFailed(what: string, teamId: string, err: unknown): Response {
	const status = err instanceof Error ? err.name : "error";
	console.error(`${what} team=${teamId} status=${status}`);
	return text("Service Unavailable", 503);
}

/**
 * `POST /teams/<teamId>/report`: the team now holds the athlete, or no longer
 * does (feature 046 FR-004). Refused while routing is off, as by a gateway
 * without routing.
 */
async function takeReport(
	request: Request,
	teamId: string,
	env: GatewayEnv,
): Promise<Response> {
	const teams = await authorizedTeams(request, teamId, env);
	if (teams instanceof Response) return teams;
	if (routingMode(env.ROUTING) === "off") return text("Not Found", 404);
	const body = await jsonBody(request, MAX_BODY_BYTES);
	const athleteId = body?.athleteId;
	const held = body?.held;
	if (!isStravaId(athleteId) || typeof held !== "boolean") {
		return text("Bad Request", 400);
	}
	try {
		await copyStub(env).report(teamId, athleteId, held);
	} catch (err) {
		return copyFailed("report", teamId, err);
	}
	return Response.json({});
}

/**
 * `POST /teams/<teamId>/list`: every athlete the team holds, replacing its part
 * of the copy (FR-006). While routing is off, empties the whole copy instead
 * and answers as a gateway without routing (research R2).
 */
async function takeList(
	request: Request,
	teamId: string,
	env: GatewayEnv,
): Promise<Response> {
	const teams = await authorizedTeams(request, teamId, env);
	if (teams instanceof Response) return teams;
	const body = await jsonBody(request, MAX_LIST_BYTES);
	const ids = body?.athleteIds;
	if (
		!Array.isArray(ids) ||
		ids.length > MAX_LIST_IDS ||
		!ids.every((id) => isStravaId(id))
	) {
		return text("Bad Request", 400);
	}
	try {
		if (routingMode(env.ROUTING) === "off") {
			await copyStub(env).forget();
			return text("Not Found", 404);
		}
		await copyStub(env).replaceList(
			teamId,
			[...new Set(ids as string[])],
			nowSeconds(),
			teams.map((t) => t.id),
		);
	} catch (err) {
		return copyFailed("list", teamId, err);
	}
	return Response.json({});
}

/**
 * `POST /teams/<teamId>/counts`: takes the team's own counts and answers every
 * count of the last 30 days (feature 046 research R9), in every mode.
 */
async function exchange(
	request: Request,
	teamId: string,
	env: GatewayEnv,
): Promise<Response> {
	const teams = await authorizedTeams(request, teamId, env);
	if (teams instanceof Response) return teams;
	const today = routingDay(nowSeconds());
	const body = await jsonBody(request, MAX_COUNTS_BYTES);
	const days = body?.days;
	if (!Array.isArray(days) || days.length > MAX_OWN_COUNTS) {
		return text("Bad Request", 400);
	}
	const own: OwnCount[] = [];
	for (const entry of days) {
		const { day, figure, count } = (entry ?? {}) as Record<string, unknown>;
		if (
			!isRoutingDay(day, today) ||
			!isFigureOf(TEAM_FIGURES, figure) ||
			!isCount(count)
		) {
			return text("Bad Request", 400);
		}
		own.push({ day, figure, count });
	}
	try {
		const counts = await copyStub(env).exchange(
			teamId,
			own,
			today,
			teams.map((t) => t.id),
		);
		return Response.json({ days: counts });
	} catch (err) {
		return copyFailed("counts", teamId, err);
	}
}

/** One team's answer at `/strava/<what>/<token>`, `null` if it gave none. */
async function askTeam<T>(
	team: GatewayTeam,
	what: "held" | "let-go",
	athleteId: string,
	env: GatewayEnv,
	read: (body: unknown) => T | null,
): Promise<T | null> {
	const token =
		env[webhookTokenName(team.id) as `TEAM_WEBHOOK_TOKEN_${string}`];
	const service = env[serviceBindingName(team.id) as `TEAM_SERVICE_${string}`];
	let status: string;
	try {
		if (!token) throw new Error("no webhook token");
		// The token goes into the path unencoded, as for the forward.
		const res = await (service ? service.fetch.bind(service) : fetch)(
			new URL(`/strava/${what}/${token}`, team.origin),
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ athleteId: idJson(athleteId) }),
				signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
				redirect: "manual",
			},
		);
		status = String(res.status);
		if (res.ok) {
			const answer = read(await res.json());
			console.log(`${what} team=${team.id} status=${status}`);
			return answer;
		}
		await res.body?.cancel();
	} catch (err) {
		status = err instanceof Error ? err.name : "error";
	}
	console.log(`${what} team=${team.id} status=${status}`);
	return null;
}

/** Seconds before the next try: 30 s, 1 min, 2 min, … up to 12 h. */
export function retryDelay(attempts: number): number {
	return Math.min(30 * 2 ** Math.max(0, attempts - 1), MAX_DELAY_SECONDS);
}

async function forward(
	message: Message<ForwardMessage>,
	teams: GatewayTeam[],
	env: GatewayEnv,
): Promise<void> {
	const { team: teamId, body, chosen } = message.body;
	const team = teams.find((t) => t.id === teamId);
	const token = env[webhookTokenName(teamId) as `TEAM_WEBHOOK_TOKEN_${string}`];
	const service = env[serviceBindingName(teamId) as `TEAM_SERVICE_${string}`];
	if (!team) {
		// The team left TEAMS: nobody is left to deliver to.
		console.log(
			`forward team=${teamId} status=gone attempt=${message.attempts}`,
		);
		message.ack();
		return;
	}
	let status: string;
	try {
		if (!token) throw new Error("no webhook token");
		// The token goes into the path as it is, not percent-encoded: the team
		// compares the raw path with its token, so `abc=` sent as `abc%3D`
		// would be refused with a 404. Base64 tokens (`+`, `/`, `=`) are
		// valid in a path unchanged.
		const res = await (service ? service.fetch.bind(service) : fetch)(
			new URL(`/strava/webhook/${token}`, team.origin),
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					// The trial's mark (feature 046 research R5).
					...(chosen === undefined
						? {}
						: { [ROUTE_HEADER]: chosen ? "chosen" : "not-chosen" }),
				},
				body,
				signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
				redirect: "manual",
			},
		);
		await res.body?.cancel();
		status = String(res.status);
		if (res.ok) {
			console.log(
				`forward team=${teamId} status=${status} attempt=${message.attempts}`,
			);
			message.ack();
			return;
		}
	} catch (err) {
		status = err instanceof Error ? err.name : "error";
	}
	console.log(
		`forward team=${teamId} status=${status} attempt=${message.attempts}`,
	);
	message.retry({ delaySeconds: retryDelay(message.attempts) });
}

export async function gatewayQueue(
	batch: MessageBatch<ForwardMessage>,
	env: GatewayEnv,
): Promise<void> {
	const teams = parseTeams(env.TEAMS);
	// Each message on its own: one team failing never holds another's.
	await Promise.all(batch.messages.map((m) => forward(m, teams, env)));
}

export default {
	fetch: (request, env, ctx) => gatewayFetch(request, env, ctx),
	queue: (batch, env) => gatewayQueue(batch, env),
} satisfies ExportedHandler<GatewayEnv, ForwardMessage>;
