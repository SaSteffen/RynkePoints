import { readRateLimitState } from "../db/rate-limit";
import type { StravaActivity } from "./activity";
import { budgetDecision, deferUntilNextWindow } from "./rate-limit";
import {
	STRAVA_ORIGIN,
	type StravaCtx,
	type StravaResult,
	stravaFetch,
	transient,
} from "./result";
import { getAccessToken } from "./tokens";

// The Strava API endpoints this feature calls, and nothing else
// (contracts/strava-api-usage.md). OAuth endpoints live in tokens.ts.

export type { StravaResult } from "./result";

/** A stored rider (refreshed as needed) or a just-issued access token. */
export type StravaAuth = { athleteId: number } | { accessToken: string };

const PER_PAGE = 200;
const MAX_CLUB_PAGES = 20;

async function apiGet<T>(
	ctx: StravaCtx,
	auth: StravaAuth,
	endpoint: string,
	path: string,
): Promise<StravaResult<T>> {
	const budget = budgetDecision(
		await readRateLimitState(ctx.env.DB),
		ctx.now(),
	);
	if (!budget.ok) return { kind: "budget", delaySeconds: budget.delaySeconds };

	const call = (token: string) =>
		stravaFetch(ctx, endpoint, `${STRAVA_ORIGIN}${path}`, {
			headers: { Authorization: `Bearer ${token}` },
		});

	let res: Response | Exclude<StravaResult<T>, { kind: "ok" }>;
	if ("accessToken" in auth) {
		res = await call(auth.accessToken);
	} else {
		const token = await getAccessToken(ctx, auth.athleteId);
		if (token.kind !== "ok") return token;
		res = await call(token.value);
		if (res instanceof Response && res.status === 401) {
			// One refresh and retry; a second 401 is final.
			const fresh = await getAccessToken(ctx, auth.athleteId, { force: true });
			if (fresh.kind !== "ok") return fresh;
			res = await call(fresh.value);
		}
	}
	if (!(res instanceof Response)) return res;

	if (res.ok) return { kind: "ok", value: (await res.json()) as T };
	switch (res.status) {
		case 401:
			return { kind: "unauthorized" };
		case 403:
			return { kind: "forbidden" };
		case 404:
			return { kind: "not-found" };
		case 429:
			return { kind: "budget", delaySeconds: deferUntilNextWindow(ctx.now()) };
		default:
			return transient(endpoint, `HTTP ${res.status}`);
	}
}

export function getAthleteClubs(
	ctx: StravaCtx,
	auth: StravaAuth,
	page: number,
): Promise<StravaResult<{ id: number }[]>> {
	return apiGet(
		ctx,
		auth,
		"GET /athlete/clubs",
		`/api/v3/athlete/clubs?page=${page}&per_page=${PER_PAGE}`,
	);
}

/**
 * Pages through the athlete's clubs until `clubId` is found or a page comes
 * back short (research R4). Any failure is passed through as inconclusive.
 */
export async function isClubMember(
	ctx: StravaCtx,
	auth: StravaAuth,
	clubId: number,
): Promise<StravaResult<boolean>> {
	for (let page = 1; page <= MAX_CLUB_PAGES; page++) {
		const result = await getAthleteClubs(ctx, auth, page);
		if (result.kind !== "ok") return result;
		if (result.value.some((club) => club.id === clubId)) {
			return { kind: "ok", value: true };
		}
		if (result.value.length < PER_PAGE) return { kind: "ok", value: false };
	}
	return transient("GET /athlete/clubs", "too many pages");
}

export function getActivity(
	ctx: StravaCtx,
	auth: StravaAuth,
	activityId: number,
): Promise<StravaResult<StravaActivity>> {
	return apiGet(
		ctx,
		auth,
		"GET /activities/{id}",
		`/api/v3/activities/${activityId}`,
	);
}

export function listAthleteActivities(
	ctx: StravaCtx,
	auth: StravaAuth,
	{ after, page }: { after: number; page: number },
): Promise<StravaResult<StravaActivity[]>> {
	return apiGet(
		ctx,
		auth,
		"GET /athlete/activities",
		`/api/v3/athlete/activities?after=${after}&page=${page}&per_page=${PER_PAGE}`,
	);
}
