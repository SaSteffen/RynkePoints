import { secretEquals } from "../src/crypto/secret";
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
	 * Cloudflare zone. A Worker's fetch() to a hostname on its own zone skips
	 * the Workers there and answers 404, so such a team is called through a
	 * service binding. Without one, the gateway fetches the team's origin.
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
	const body = await readBody(request);
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
		json = JSON.parse(body);
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
		Number.isSafeInteger(e.object_id) &&
		Number.isSafeInteger(e.owner_id) &&
		Number.isSafeInteger(e.subscription_id) &&
		typeof e.event_time === "number"
	);
}

/** The body as text, or null if it is over the limit. Stops reading there. */
async function readBody(request: Request): Promise<string | null> {
	const length = request.headers.get("Content-Length");
	if (length !== null && Number(length) > MAX_BODY_BYTES) return null;
	if (!request.body) return "";
	const reader = request.body.getReader();
	const decoder = new TextDecoder();
	let size = 0;
	let body = "";
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		size += value.byteLength;
		if (size > MAX_BODY_BYTES) {
			await reader.cancel();
			return null;
		}
		body += decoder.decode(value, { stream: true });
	}
	return body + decoder.decode();
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
		const res = await (service ? service.fetch.bind(service) : fetch)(
			new URL(`/strava/webhook/${encodeURIComponent(token)}`, team.origin),
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
