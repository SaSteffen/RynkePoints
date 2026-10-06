import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { upsertActivities } from "../../src/db/activities";
import { handleFetch } from "../../src/index";
import {
	type ActivityRecord,
	toActivityRecord,
} from "../../src/strava/activity";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
} from "../support/ctx";
import {
	ATHLETE_A,
	ATHLETE_B,
	makeStravaActivity,
	NOW,
	type StravaActivityFixture,
} from "../support/fixtures";

const ctx = makeCtx();

function record(
	athleteId: number,
	overrides: Partial<StravaActivityFixture> = {},
): ActivityRecord {
	const r = toActivityRecord(makeStravaActivity(overrides), athleteId, NOW);
	if (!r) throw new Error("fixture is not a cycling activity");
	return r;
}

/** `n` activities on consecutive days in September 2026, oldest first. */
function rides(
	athleteId: number,
	n: number,
	firstId: number,
	overrides: Partial<StravaActivityFixture> = {},
): ActivityRecord[] {
	return Array.from({ length: n }, (_, i) => {
		const day = String(i + 1).padStart(2, "0");
		return record(athleteId, {
			id: firstId + i,
			start_date: `2026-09-${day}T07:00:00Z`,
			start_date_local: `2026-09-${day}T09:00:00Z`,
			...overrides,
		});
	});
}

async function getMe(acceptLanguage?: string) {
	const res = await handleFetch(
		request("/me", {
			cookies: await sessionCookie(ctx, ATHLETE_A),
			acceptLanguage,
		}),
		ctx,
	);
	return res.text();
}

/** The rendered rows of the recent-rides table, as lists of cell texts. */
function rows(page: string): string[][] {
	const body = page.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? "";
	return [...body.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((row) =>
		[...(row[1] ?? "").matchAll(/<td>([\s\S]*?)<\/td>/g)].map(
			(c) => c[1] ?? "",
		),
	);
}

beforeEach(resetDb);

describe("GET /me recent rides", () => {
	it("lists only the rider's 20 newest activities, newest first", async () => {
		await seedRider(ctx, { athleteId: ATHLETE_A });
		await seedRider(ctx, { athleteId: ATHLETE_B });
		await upsertActivities(env.DB, rides(ATHLETE_A, 25, 7_100_001));
		await upsertActivities(
			env.DB,
			rides(ATHLETE_B, 3, 7_200_001, {
				start_date: "2026-09-30T07:00:00Z",
				start_date_local: "2026-09-30T09:00:00Z",
				distance: 99_999,
				total_elevation_gain: 4321,
			}),
		);

		const page = await getMe();
		const dates = rows(page).map((cells) => cells[0]);
		expect(dates).toEqual(
			Array.from(
				{ length: 20 },
				(_, i) => `${String(25 - i).padStart(2, "0")}.09.2026`,
			),
		);
		for (const id of [7_200_001, 7_200_002, 7_200_003]) {
			expect(page).not.toContain(String(id));
		}
		expect(page).not.toContain("100,0 km");
		expect(page).not.toContain("4.321 m");
		expect(page).not.toContain("30.09.2026");
	});

	it("formats the rows in German by default", async () => {
		await seedRider(ctx);
		await upsertActivities(env.DB, [
			record(ATHLETE_A, {
				sport_type: "GravelRide",
				start_date: "2026-10-05T22:30:00Z",
				start_date_local: "2026-10-06T00:30:00Z",
				distance: 42195,
				total_elevation_gain: 312,
			}),
			record(ATHLETE_A, {
				start_date: "2026-10-01T07:00:00Z",
				start_date_local: "2026-10-01T09:00:00Z",
				total_elevation_gain: 1234,
			}),
		]);

		const page = await getMe();
		expect(page).toContain("<h2>Zuletzt importierte Fahrten</h2>");
		for (const header of ["Datum", "Sportart", "Distanz", "Höhenmeter"]) {
			expect(page).toContain(`<th>${header}</th>`);
		}
		expect(rows(page)).toEqual([
			["06.10.2026", "Gravel-Fahrt", "42,2 km", "312 m"],
			["01.10.2026", "Radfahrt", "42,2 km", "1.234 m"],
		]);
		expect(page).not.toContain("GravelRide");
		expect(page).not.toContain("Noch keine Fahrten importiert");
	});

	it("formats the rows in English", async () => {
		await seedRider(ctx);
		await upsertActivities(env.DB, [
			record(ATHLETE_A, {
				sport_type: "GravelRide",
				start_date: "2026-10-05T22:30:00Z",
				start_date_local: "2026-10-06T00:30:00Z",
				total_elevation_gain: 1234,
			}),
		]);

		const page = await getMe("en");
		expect(page).toContain("<h2>Recently imported rides</h2>");
		for (const header of ["Date", "Sport", "Distance", "Elevation"]) {
			expect(page).toContain(`<th>${header}</th>`);
		}
		expect(rows(page)).toEqual([
			["06/10/2026", "Gravel ride", "42.2 km", "1,234 m"],
		]);
	});

	it("shows the empty state for a rider without activities", async () => {
		await seedRider(ctx, { athleteId: ATHLETE_A });
		await seedRider(ctx, { athleteId: ATHLETE_B });
		await upsertActivities(env.DB, rides(ATHLETE_B, 3, 7_200_001));

		const page = await getMe();
		expect(page).toContain("<h2>Zuletzt importierte Fahrten</h2>");
		expect(page).toContain("Noch keine Fahrten importiert");
		expect(page).not.toContain("<table>");
	});
});
