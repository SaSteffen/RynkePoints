import type { Ctx } from "../ctx";
import { recordRateLimitHeaders } from "../db/rate-limit";
import { countCall, countHeldBack } from "../db/strava-calls";
import { utcDay } from "../usage/allowances";
import type { StravaEndpoint } from "./calls";
import { parseUsageHeader } from "./rate-limit";

// Shared plumbing for every Strava call: the result type, network-error
// handling, rate-header recording (contracts/strava-api-usage.md) and the
// call counts (feature 047 contracts/counting.md).

export const STRAVA_ORIGIN = "https://www.strava.com";

export type StravaResult<T> =
	| { kind: "ok"; value: T }
	| { kind: "not-found" }
	| { kind: "forbidden" }
	| { kind: "unauthorized" }
	| { kind: "budget"; delaySeconds: number }
	| { kind: "transient"; reason: string }
	| { kind: "refresh-refused" };

export type StravaFailure = Exclude<StravaResult<never>, { kind: "ok" }>;

export type StravaCtx = Pick<Ctx, "env" | "now" | "stravaAction">;

export function transient(endpoint: string, detail: string): StravaFailure {
	return { kind: "transient", reason: `${endpoint}: ${detail}` };
}

/**
 * Calls Strava. Returns the response, or a transient failure on a network
 * error. Logs only the endpoint and status, never tokens or bodies. Every
 * answer, whatever its status, counts as a call under the context's action
 * (feature 047 FR-001 to FR-004).
 */
export async function stravaFetch(
	ctx: StravaCtx,
	endpoint: StravaEndpoint,
	url: string,
	init: RequestInit,
): Promise<Response | StravaFailure> {
	let res: Response;
	try {
		res = await fetch(url, init);
	} catch {
		console.warn(`Strava ${endpoint}: network error`);
		return transient(endpoint, "network error");
	}
	const now = ctx.now();
	// Best-effort, both: losing one usage sample or one count must not lose
	// the response, e.g. a rotated refresh token that still has to be saved.
	const [recorded, counted] = await Promise.allSettled([
		recordRateLimitHeaders(
			ctx.env.DB,
			res.headers,
			now,
			(init.method ?? "GET").toUpperCase() === "GET" ? "read" : "write",
		),
		countCall(
			ctx.env.DB,
			utcDay(now),
			ctx.stravaAction ?? "unassigned",
			endpoint,
			parseUsageHeader(res.headers.get("X-RateLimit-Usage"))?.daily ?? null,
		),
	]);
	if (recorded.status === "rejected") {
		console.warn(`Strava ${endpoint}: could not record rate-limit headers`);
	}
	if (counted.status === "rejected") {
		console.warn(`Strava ${endpoint}: could not count the call`);
	}
	if (!res.ok) console.warn(`Strava ${endpoint}: HTTP ${res.status}`);
	return res;
}

/**
 * Counts a call the budget refused before it was made, under the context's
 * action (feature 047 FR-005). Best-effort, like a call's count: it never
 * changes what the caller gets.
 */
export async function countRefused(
	ctx: StravaCtx,
	endpoint: StravaEndpoint,
): Promise<void> {
	try {
		await countHeldBack(
			ctx.env.DB,
			utcDay(ctx.now()),
			ctx.stravaAction ?? "unassigned",
			endpoint,
		);
	} catch {
		console.warn(`Strava ${endpoint}: could not count the call held back`);
	}
}
