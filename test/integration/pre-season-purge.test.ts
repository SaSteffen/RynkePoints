import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { startsInSeason } from "../../src/strava/activity";
import { purgePreSeasonActivities } from "../../src/work/scheduled";
import { makeCtx, resetDb, seedRider, type TestCtx } from "../support/ctx";
import { ATHLETE_A, ATHLETE_B, NOW } from "../support/fixtures";
import { seedRide } from "../support/rider-view";

// Nothing from before the season start is stored. The daily cron removes
// what was stored before that rule, or under an earlier season start. The
// test season starts 2026-01-01, 00:00 Europe/Berlin (2025-12-31T23:00:00Z).

const BEFORE = "2025-12-31T22:59:59Z";
const AT_START = "2025-12-31T23:00:00Z";

let ctx: TestCtx;

beforeEach(async () => {
	await resetDb();
	ctx = makeCtx();
});

async function seedRunOrSwim(
	table: "runs" | "swims",
	id: number,
	athleteId: number,
	start: string,
) {
	await env.DB.prepare(
		`INSERT INTO ${table} (strava_activity_id, athlete_id, start_date,
			start_date_local, distance_m, is_private, refreshed_at)
		VALUES (?1, ?2, ?3, ?3, 5000, 0, ?4)`,
	)
		.bind(id, athleteId, start, NOW)
		.run();
}

async function ids(table: "activities" | "runs" | "swims") {
	const { results } = await env.DB.prepare(
		`SELECT strava_activity_id AS id FROM ${table} ORDER BY id`,
	).all<{ id: number }>();
	return results.map((r) => r.id);
}

describe("startsInSeason", () => {
	const start = Date.parse(AT_START) / 1000;

	it("is true from the season start on", () => {
		expect(startsInSeason(AT_START, start)).toBe(true);
		expect(startsInSeason("2026-10-05T07:30:00Z", start)).toBe(true);
	});

	it("is false before it, and for a date it can't read", () => {
		expect(startsInSeason(BEFORE, start)).toBe(false);
		expect(startsInSeason("not a date", start)).toBe(false);
	});
});

describe("purgePreSeasonActivities", () => {
	it("deletes rides, runs and swims from before the season start only", async () => {
		await seedRider(ctx);
		await seedRider(ctx, { athleteId: ATHLETE_B });
		await seedRide(ATHLETE_A, { id: 1, start_date: BEFORE });
		await seedRide(ATHLETE_A, { id: 2, start_date: AT_START });
		await seedRide(ATHLETE_B, { id: 3, start_date: "2025-06-01T08:00:00Z" });
		await seedRunOrSwim("runs", 4, ATHLETE_A, BEFORE);
		await seedRunOrSwim("runs", 5, ATHLETE_A, AT_START);
		await seedRunOrSwim("swims", 6, ATHLETE_B, BEFORE);
		await seedRunOrSwim("swims", 7, ATHLETE_B, AT_START);

		await purgePreSeasonActivities(ctx);

		expect(await ids("activities")).toEqual([2]);
		expect(await ids("runs")).toEqual([5]);
		expect(await ids("swims")).toEqual([7]);
	});

	it("does nothing when everything is in the season", async () => {
		await seedRider(ctx);
		await seedRide(ATHLETE_A, { id: 2, start_date: AT_START });
		await purgePreSeasonActivities(ctx);
		expect(await ids("activities")).toEqual([2]);
	});
});
