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
import { rideCards, seedBalance } from "../support/rider-view";

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
		request("/me/rides", {
			cookies: await sessionCookie(ctx, ATHLETE_A),
			acceptLanguage,
		}),
		ctx,
	);
	return res.text();
}

/** Each card's date, distance, status, Training Rynke and elevation. */
function rows(page: string): string[][] {
	return rideCards(page).map((card) => card.cells);
}

/** Each card's meta line: sport type, gain and "virtual". */
function details(page: string): string[] {
	return rideCards(page).map((card) => card.meta);
}

// The ride list shows once the rider has a balance; before that, Rides shows
// the waiting state (015 US1).
async function seedReadyRider(athleteId = ATHLETE_A) {
	await seedRider(ctx, { athleteId });
	await seedBalance(athleteId);
}

beforeEach(resetDb);

describe("GET /me/rides recent rides", () => {
	it("lists only the rider's 20 newest activities, newest first", async () => {
		await seedReadyRider();
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
		await seedReadyRider();
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
		expect(page).toContain("<h2>Deine Fahrten</h2>");
		expect(rideCards(page)[0]?.labels).toEqual([
			"Distanz",
			"Trainingsrynke",
			"Gezählte Höhenmeter",
		]);
		expect(rows(page)).toEqual([
			["06.10.2026", "42,2 km", "🦧 wird ausgewertet", "–", "–"],
			["01.10.2026", "42,2 km", "🦧 wird ausgewertet", "–", "–"],
		]);
		expect(details(page)).toEqual([
			"Gravel-Fahrt · 312 m",
			"Radfahrt · 1.234 m",
		]);
		expect(page).not.toContain("GravelRide");
		expect(page).not.toContain("Noch keine Fahrten in dieser Saison.");
	});

	it("formats the rows in English", async () => {
		await seedReadyRider();
		await upsertActivities(env.DB, [
			record(ATHLETE_A, {
				sport_type: "GravelRide",
				start_date: "2026-10-05T22:30:00Z",
				start_date_local: "2026-10-06T00:30:00Z",
				total_elevation_gain: 1234,
			}),
		]);

		const page = await getMe("en");
		expect(page).toContain("<h2>Your rides</h2>");
		expect(rideCards(page)[0]?.labels).toEqual([
			"Distance",
			"Training Rynke",
			"Elevation counted",
		]);
		expect(rows(page)).toEqual([
			["06/10/2026", "42.2 km", "🦧 being evaluated", "–", "–"],
		]);
		expect(details(page)).toEqual(["Gravel ride · 1,234 m"]);
	});

	it("shows the empty state for a rider with a balance but no rides (015 R3)", async () => {
		await seedReadyRider();
		await seedRider(ctx, { athleteId: ATHLETE_B });
		await upsertActivities(env.DB, rides(ATHLETE_B, 3, 7_200_001));

		const page = await getMe();
		expect(page).toContain("<h2>Deine Fahrten</h2>");
		expect(page).toContain("<p>Noch keine Fahrten in dieser Saison.</p>");
		expect(page).not.toContain('<ol class="ride-list">');
		expect(page).not.toContain('class="waiting"');
	});

	it("shows only the waiting state before the first balance (015 US1)", async () => {
		await seedRider(ctx);
		await upsertActivities(env.DB, rides(ATHLETE_A, 3, 7_100_001));

		const page = await getMe();
		expect(page).toContain(
			'<section class="waiting" role="status" data-waiting data-poll-seconds="10">',
		);
		expect(page).not.toContain('<section id="rides">');
		expect(page).not.toContain('class="notice"');
	});
});
