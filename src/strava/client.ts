import { readRateLimitState } from "../db/rate-limit";
import type { StravaActivity } from "./activity";
import type { StravaEndpoint } from "./calls";
import { isStravaId, parseStravaJson } from "./id";
import {
	budgetDecision,
	deferUntilNextWindow,
	type Priority,
} from "./rate-limit";
import {
	countRefused,
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
export type StravaAuth = { athleteId: string } | { accessToken: string };

/** Entries per list request; a shorter answer is the list's last page. */
export const PER_PAGE = 200;
const MAX_CLUB_PAGES = 20;

/**
 * Calls are `background` (the queue's work) unless a person waits for them on
 * a page; background work leaves a reserve for those (feature 024 R5). A call
 * the budget refuses counts as held back (feature 047 FR-005).
 */
async function apiGet<T>(
	ctx: StravaCtx,
	auth: StravaAuth,
	endpoint: StravaEndpoint,
	path: string,
	priority: Priority = "background",
	read: (res: Response) => Promise<T | null> = (res) =>
		res.json() as Promise<T>,
): Promise<StravaResult<T>> {
	const budget = budgetDecision(
		await readRateLimitState(ctx.env.DB),
		ctx.now(),
		priority,
	);
	if (!budget.ok) {
		await countRefused(ctx, endpoint);
		return { kind: "budget", delaySeconds: budget.delaySeconds };
	}

	const call = (token: string) =>
		stravaFetch(ctx, endpoint, `${STRAVA_ORIGIN}${path}`, {
			headers: { Authorization: `Bearer ${token}` },
		});

	let res: Response | Exclude<StravaResult<T>, { kind: "ok" }>;
	if ("accessToken" in auth) {
		res = await call(auth.accessToken);
	} else {
		const token = await getAccessToken(ctx, auth.athleteId, { priority });
		if (token.kind !== "ok") return token;
		res = await call(token.value);
		if (res instanceof Response && res.status === 401) {
			// One refresh and retry; a second 401 is final.
			const fresh = await getAccessToken(ctx, auth.athleteId, {
				force: true,
				priority,
			});
			if (fresh.kind !== "ok") return fresh;
			res = await call(fresh.value);
		}
	}
	if (!(res instanceof Response)) return res;

	if (res.ok) {
		const value = await read(res);
		return value === null
			? transient(endpoint, "malformed response")
			: { kind: "ok", value };
	}
	switch (res.status) {
		case 401:
			// Still refused after a fresh token: the rider must reconnect.
			return "athleteId" in auth
				? { kind: "refresh-refused" }
				: { kind: "unauthorized" };
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
	priority: Priority = "background",
): Promise<StravaResult<{ id: number }[]>> {
	return apiGet(
		ctx,
		auth,
		"GET /athlete/clubs",
		`/api/v3/athlete/clubs?page=${page}&per_page=${PER_PAGE}`,
		priority,
	);
}

/**
 * Pages through the athlete's clubs until one of `clubIds` is found or a page
 * comes back short (research R4). Any failure is passed through as
 * inconclusive.
 */
export async function isClubMember(
	ctx: StravaCtx,
	auth: StravaAuth,
	clubIds: readonly number[],
	priority: Priority = "background",
): Promise<StravaResult<boolean>> {
	for (let page = 1; page <= MAX_CLUB_PAGES; page++) {
		const result = await getAthleteClubs(ctx, auth, page, priority);
		if (result.kind !== "ok") return result;
		if (result.value.some((club) => clubIds.includes(club.id))) {
			return { kind: "ok", value: true };
		}
		if (result.value.length < PER_PAGE) return { kind: "ok", value: false };
	}
	return transient("GET /athlete/clubs", "too many pages");
}

/**
 * An activity answer with its IDs exact (feature 042 research R1, R2), or
 * null if an activity's ID isn't one.
 */
async function readActivities(res: Response): Promise<StravaActivity[] | null> {
	const list = parseStravaJson(await res.text());
	return Array.isArray(list) &&
		list.every((a: StravaActivity | null) => isStravaId(a?.id))
		? (list as StravaActivity[])
		: null;
}

async function readActivity(res: Response): Promise<StravaActivity | null> {
	const activity = parseStravaJson(await res.text()) as StravaActivity | null;
	return isStravaId(activity?.id) ? activity : null;
}

export function getActivity(
	ctx: StravaCtx,
	auth: StravaAuth,
	activityId: string,
): Promise<StravaResult<StravaActivity>> {
	return apiGet(
		ctx,
		auth,
		"GET /activities/{id}",
		`/api/v3/activities/${activityId}`,
		"background",
		readActivity,
	);
}

/**
 * How many of the rider's newest activities the ride edit re-check reads
 * (feature 036 FR-001). Reading a list costs CPU by its length: 200 took most
 * of a run's 10 ms.
 */
export const NEWEST_COUNT = 50;

/**
 * The rider's newest `NEWEST_COUNT` activities, newest first: without `after`
 * Strava lists newest first (feature 036 research R3, verified 2026-11-13).
 * The ride edit re-check's one request.
 */
export function listNewestActivities(
	ctx: StravaCtx,
	auth: StravaAuth,
): Promise<StravaResult<StravaActivity[]>> {
	return apiGet(
		ctx,
		auth,
		"GET /athlete/activities",
		`/api/v3/athlete/activities?page=1&per_page=${NEWEST_COUNT}`,
		"background",
		readActivities,
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
		"background",
		readActivities,
	);
}
