import { env } from "cloudflare:test";
import { upsertActivities } from "../../src/db/activities";
import { NOTICE_IDS } from "../../src/http/notice";
import { handleFetch } from "../../src/index";
import { toActivityRecord } from "../../src/strava/activity";
import { request, seedRider, sessionCookie, type TestCtx } from "./ctx";
import {
	ATHLETE_A,
	ATHLETE_B,
	ATHLETE_C,
	makeStravaActivity,
	NOW,
} from "./fixtures";
import { seedBalance, seedRide } from "./rider-view";

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

/**
 * A connected rider A with a balance and rides in every state, a rider B who
 * must reconnect, and a rider C whose Rynke aren't worked out yet.
 */
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
	await seedBalance(ATHLETE_A, {
		distanceRynke: 12,
		elevationDm: 12400,
		elevationRynke: 5,
		elevationToNextStepDm: 7600,
		trainingRynke: 17,
		trainingMissing: 233,
		trainingWithoutVirtual: 13,
		virtualShareMissing: 154,
	});
	await seedRide(ATHLETE_A, {
		id: 8_900_001,
		start_date: "2026-09-20T08:00:00Z",
		distance_m: 79000,
		elevation_gain_m: 1240,
		result: { counts: true, distanceRynke: 7, elevationDm: 12400 },
	});
	await seedRide(ATHLETE_A, {
		id: 8_900_002,
		start_date: "2026-09-19T08:00:00Z",
		result: { counts: false, reasons: ["too_slow"] },
	});
	await seedRide(ATHLETE_A, {
		id: 8_900_003,
		start_date: "2026-09-18T08:00:00Z",
	});
	await seedRide(ATHLETE_A, {
		id: 8_900_004,
		sport_type: "VirtualRide",
		start_date: "2026-09-17T08:00:00Z",
		result: { counts: true, distanceRynke: 4, isVirtual: true },
	});
	await seedRider(ctx, { athleteId: ATHLETE_C });
	await seedRide(ATHLETE_C, { id: 8_900_101 });
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
		name: "/me not worked out",
		next: "/me",
		status: 200,
		fetch: get("/me", ATHLETE_C),
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
