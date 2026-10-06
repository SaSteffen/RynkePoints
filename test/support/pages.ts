import { env } from "cloudflare:test";
import { upsertActivities } from "../../src/db/activities";
import { NOTICE_IDS } from "../../src/http/notice";
import { handleFetch } from "../../src/index";
import { toActivityRecord } from "../../src/strava/activity";
import { request, seedRider, sessionCookie, type TestCtx } from "./ctx";
import { ATHLETE_A, ATHLETE_B, makeStravaActivity, NOW } from "./fixtures";

// Every rider-facing page (SC-010, SC-011), for the language guards. `next` is
// the path the page's language switcher sends back to.

export interface RiderPage {
	name: string;
	next: string;
	status: number;
	fetch(
		ctx: TestCtx,
		headers: { acceptLanguage?: string; cookies?: Record<string, string> },
	): Promise<Response>;
}

/** A connected rider A with rides and a rider B who must reconnect. */
export async function seedPageRiders(ctx: TestCtx): Promise<void> {
	await seedRider(ctx, { athleteId: ATHLETE_A });
	await seedRider(ctx, {
		athleteId: ATHLETE_B,
		status: "needs_reconnect",
		scopeReadAll: false,
		importStatus: "running",
	});
	const records = [
		makeStravaActivity({ sport_type: "GravelRide" }),
		makeStravaActivity({
			start_date: "2026-10-01T07:00:00Z",
			start_date_local: "2026-10-01T09:00:00Z",
			total_elevation_gain: 1234,
		}),
	].map((a) => toActivityRecord(a, ATHLETE_A, NOW));
	await upsertActivities(
		env.DB,
		records.filter((r) => r !== null),
	);
}

function get(path: string, athleteId?: number): RiderPage["fetch"] {
	return async (ctx, { acceptLanguage, cookies }) => {
		const session = athleteId ? await sessionCookie(ctx, athleteId) : {};
		return handleFetch(
			request(path, {
				acceptLanguage,
				cookies: { ...session, ...cookies },
			}),
			ctx,
		);
	};
}

export const RIDER_PAGES: RiderPage[] = [
	{ name: "/ signed out", next: "/", status: 200, fetch: get("/") },
	{
		name: "/me connected",
		next: "/me",
		status: 200,
		fetch: get("/me", ATHLETE_A),
	},
	{
		name: "/me needs reconnect",
		next: "/me",
		status: 200,
		fetch: get("/me", ATHLETE_B),
	},
	{
		name: "/me/disconnect",
		next: "/me/disconnect",
		status: 200,
		fetch: get("/me/disconnect", ATHLETE_A),
	},
	...NOTICE_IDS.map((id) => ({
		name: `/notice/${id}`,
		next: `/notice/${id}`,
		status: 200,
		fetch: get(`/notice/${id}`),
	})),
	{ name: "404", next: "/nowhere", status: 404, fetch: get("/nowhere") },
	{
		name: "403",
		next: "/me/disconnect",
		status: 403,
		fetch: async (ctx, { acceptLanguage, cookies }) =>
			handleFetch(
				request("/me/disconnect", {
					method: "POST",
					origin: "https://evil.example",
					acceptLanguage,
					cookies: { ...(await sessionCookie(ctx, ATHLETE_A)), ...cookies },
				}),
				ctx,
			),
	},
];
