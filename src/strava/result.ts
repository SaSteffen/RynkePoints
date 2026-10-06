import type { Ctx } from "../ctx";
import { recordRateLimitHeaders } from "../db/rate-limit";

// Shared plumbing for every Strava call: the result type, network-error
// handling and rate-header recording (contracts/strava-api-usage.md).

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

export type StravaCtx = Pick<Ctx, "env" | "now">;

export function transient(endpoint: string, detail: string): StravaFailure {
	return { kind: "transient", reason: `${endpoint}: ${detail}` };
}

/**
 * Calls Strava. Returns the response, or a transient failure on a network
 * error. Logs only the endpoint and status, never tokens or bodies.
 */
export async function stravaFetch(
	ctx: StravaCtx,
	endpoint: string,
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
	await recordRateLimitHeaders(ctx.env.DB, res.headers, ctx.now());
	if (!res.ok) console.warn(`Strava ${endpoint}: HTTP ${res.status}`);
	return res;
}
