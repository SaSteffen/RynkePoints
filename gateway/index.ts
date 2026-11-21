import { secretEquals } from "../src/crypto/secret";
import { readBodyUpTo } from "../src/http/body";
import { idJson, isStravaId, parseStravaJson } from "../src/strava/id";
import {
	type GatewayTeam,
	parseTeams,
	serviceBindingName,
	webhookTokenName,
} from "./teams";

// The Strava gateway (feature 026 release 3, contracts/gateway.md). Strava's
// one webhook subscription and one OAuth callback domain serve every team:
// events are acked at once and forwarded to each team through a queue, with
// retries per team; a rider coming back from Strava is sent on to their own
// team. Answers are for Strava, not riders: plain English, no catalogue.
//
// It holds no rider data and logs only `forward team=<id> status=<code>
// attempt=<n>`, never a body, ID or code (FR-008, FR-010).

export interface GatewayEnv {
	TEAMS: string;
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
}

/** Same limit as the teams' own webhook (src/http/webhook.ts). */
const MAX_BODY_BYTES = 4096;
const FORWARD_TIMEOUT_MS = 10_000;
const MAX_DELAY_SECONDS = 12 * 60 * 60;
/** OAuth answer fields copied to the team; nothing else goes along (FR-007). */
const RETURN_PARAMS = ["code", "state", "scope", "error"] as const;

function text(body: string, status: number): Response {
	return new Response(body, {
		status,
		headers: { "Content-Type": "text/plain; charset=utf-8" },
	});
}

export async function gatewayFetch(
	request: Request,
	env: GatewayEnv,
): Promise<Response> {
	const url = new URL(request.url);
	try {
		if (url.pathname === "/health" && request.method === "GET") {
			return text("ok", 200);
		}
		const webhook = /^\/strava\/webhook\/([^/]+)$/.exec(url.pathname);
		if (webhook?.[1]) {
			return await handleWebhook(request, url, webhook[1], env);
		}
		const held = /^\/teams\/([^/]+)\/held$/.exec(url.pathname);
		if (held?.[1] && request.method === "POST") {
			return await askTeams(request, held[1], env);
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
): Promise<Response> {
	if (!(await secretEquals(token, env.STRAVA_WEBHOOK_VERIFY_TOKEN))) {
		return text("Forbidden", 403);
	}
	if (request.method === "GET") return validateSubscription(url, env);
	if (request.method === "POST") return receiveEvent(request, env);
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

async function receiveEvent(
	request: Request,
	env: GatewayEnv,
): Promise<Response> {
	const body = await readBodyUpTo(request, MAX_BODY_BYTES);
	if (body === null || !isStravaEvent(body)) return text("Bad Request", 400);
	const teams = parseTeams(env.TEAMS);
	if (teams.length > 0) {
		await env.FORWARD_QUEUE.sendBatch(
			teams.map((team) => ({ body: { team: team.id, body } })),
		);
	}
	return text("ok", 200);
}

/**
 * The fields every Strava event carries. The teams check the rest
 * (src/http/webhook.ts), including the subscription ID.
 */
function isStravaEvent(body: string): boolean {
	let json: unknown;
	try {
		// The IDs' exact digits: events have no `*_str` (feature 042).
		json = parseStravaJson(body, ["object_id", "owner_id"]);
	} catch {
		return false;
	}
	if (typeof json !== "object" || json === null || Array.isArray(json)) {
		return false;
	}
	const e = json as Record<string, unknown>;
	return (
		typeof e.object_type === "string" &&
		typeof e.aspect_type === "string" &&
		isStravaId(e.object_id) &&
		isStravaId(e.owner_id) &&
		Number.isSafeInteger(e.subscription_id) &&
		typeof e.event_time === "number"
	);
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

/**
 * `POST /teams/<teamId>/held`: a team about to withdraw a person's grant asks
 * whether any other team holds them (feature 041 research R14,
 * contracts/withdrawal.md). The answer is the strongest of the other teams'
 * (`connected` over `reconnect` over `none`); it never says which team. No
 * answer from any of them is a 503: the asking team keeps the token and asks
 * again. Logs a status per asked team, never the athlete.
 */
async function askTeams(
	request: Request,
	teamId: string,
	env: GatewayEnv,
): Promise<Response> {
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
	const answers = await Promise.all(
		teams.filter((t) => t.id !== teamId).map((t) => askTeam(t, athleteId, env)),
	);
	if (answers.includes(null)) return text("Service Unavailable", 503);
	const held = answers.reduce<Hold>(
		(strongest, answer) =>
			HOLDS.indexOf(answer as Hold) > HOLDS.indexOf(strongest)
				? (answer as Hold)
				: strongest,
		"none",
	);
	return Response.json({ held });
}

/** One team's answer, `null` if it gave none. */
async function askTeam(
	team: GatewayTeam,
	athleteId: string,
	env: GatewayEnv,
): Promise<Hold | null> {
	const token =
		env[webhookTokenName(team.id) as `TEAM_WEBHOOK_TOKEN_${string}`];
	const service = env[serviceBindingName(team.id) as `TEAM_SERVICE_${string}`];
	let status: string;
	try {
		if (!token) throw new Error("no webhook token");
		// The token goes into the path unencoded, as for the forward.
		const res = await (service ? service.fetch.bind(service) : fetch)(
			new URL(`/strava/held/${token}`, team.origin),
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
			const answer = ((await res.json()) as { held?: unknown }).held;
			console.log(`held team=${team.id} status=${status}`);
			return HOLDS.includes(answer as Hold) ? (answer as Hold) : null;
		}
		await res.body?.cancel();
	} catch (err) {
		status = err instanceof Error ? err.name : "error";
	}
	console.log(`held team=${team.id} status=${status}`);
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
	const { team: teamId, body } = message.body;
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
				headers: { "Content-Type": "application/json" },
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
	fetch: (request, env) => gatewayFetch(request, env),
	queue: (batch, env) => gatewayQueue(batch, env),
} satisfies ExportedHandler<GatewayEnv, ForwardMessage>;
