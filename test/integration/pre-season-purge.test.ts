import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { startsInSeason } from "../../src/strava/activity";
import { purgePreSeasonActivities } from "../../src/work/scheduled";
import { makeCtx, resetDb, seedRider, type TestCtx } from "../support/ctx";
import { ATHLETE_A, ATHLETE_B, NOW } from "../support/fixtures";
import { seedRide } from "../support/rider-view";

// Nothing from before the season start is stored. The daily cron removes
// what was stored before that rule, or under an earlier season start. The
// test season starts 2026-01-01, and an activity belongs to the season by its
// local date, as a ride counts (review L-16).

/** An activity's `start_date` and `start_date_local`. */
type Start = { start_date: string; start_date_local: string };

// In Berlin, a second before and at the season start.
const BEFORE: Start = {
	start_date: "2025-12-31T22:59:59Z",
	start_date_local: "2025-12-31T23:59:59Z",
};
const AT_START: Start = {
	start_date: "2025-12-31T23:00:00Z",
	start_date_local: "2026-01-01T00:00:00Z",
};
// East of Berlin (UTC+3), just after local midnight: before Berlin's.
const EAST: Start = {
	start_date: "2025-12-31T21:30:00Z",
	start_date_local: "2026-01-01T00:30:00Z",
};
// West of Berlin (UTC-5), late on the evening before: after Berlin's midnight.
const WEST: Start = {
	start_date: "2026-01-01T04:00:00Z",
	start_date_local: "2025-12-31T23:00:00Z",
};

const SEASON = "2026-01-01";

let ctx: TestCtx;

beforeEach(async () => {
	await resetDb();
	ctx = makeCtx();
});

async function seedRunOrSwim(
	table: "runs" | "swims",
	id: string,
	athleteId: string,
	start: Start,
) {
	await env.DB.prepare(
		`INSERT INTO ${table} (strava_activity_id, athlete_id, start_date,
			start_date_local, distance_m, is_private, refreshed_at)
		VALUES (?1, ?2, ?3, ?4, 5000, 0, ?5)`,
	)
		.bind(id, athleteId, start.start_date, start.start_date_local, NOW)
		.run();
}

async function ids(table: "activities" | "runs" | "swims") {
	const { results } = await env.DB.prepare(
		`SELECT CAST(strava_activity_id AS TEXT) AS id FROM ${table} ORDER BY id`,
	).all<{ id: string }>();
	return results.map((r) => r.id);
}

describe("startsInSeason", () => {
	const local = (start: Start) =>
		startsInSeason(start.start_date_local, SEASON);

	it("is true from the season start's local date on", () => {
		expect(local(AT_START)).toBe(true);
		expect(local(EAST)).toBe(true);
		expect(startsInSeason("2026-10-05T07:30:00Z", SEASON)).toBe(true);
	});

	it("is false before it, and for a date it can't read", () => {
		expect(local(BEFORE)).toBe(false);
		expect(local(WEST)).toBe(false);
		expect(startsInSeason("not a date", SEASON)).toBe(false);
	});
});

describe("purgePreSeasonActivities", () => {
	it("deletes rides, runs and swims from before the season start only", async () => {
		await seedRider(ctx);
		await seedRider(ctx, { athleteId: ATHLETE_B });
		await seedRide(ATHLETE_A, { id: "1", ...BEFORE });
		await seedRide(ATHLETE_A, { id: "2", ...AT_START });
		await seedRide(ATHLETE_B, {
			id: "3",
			start_date: "2025-06-01T08:00:00Z",
			start_date_local: "2025-06-01T10:00:00Z",
		});
		await seedRunOrSwim("runs", "4", ATHLETE_A, BEFORE);
		await seedRunOrSwim("runs", "5", ATHLETE_A, AT_START);
		await seedRunOrSwim("swims", "6", ATHLETE_B, BEFORE);
		await seedRunOrSwim("swims", "7", ATHLETE_B, AT_START);

		await purgePreSeasonActivities(ctx);

		expect(await ids("activities")).toEqual(["2"]);
		expect(await ids("runs")).toEqual(["5"]);
		expect(await ids("swims")).toEqual(["7"]);
	});

	it("goes by the local date, not Berlin's midnight (review L-16)", async () => {
		await seedRider(ctx);
		await seedRide(ATHLETE_A, { id: "1", ...EAST });
		await seedRide(ATHLETE_A, { id: "2", ...WEST });
		await seedRunOrSwim("runs", "3", ATHLETE_A, EAST);
		await seedRunOrSwim("runs", "4", ATHLETE_A, WEST);

		await purgePreSeasonActivities(ctx);

		expect(await ids("activities")).toEqual(["1"]);
		expect(await ids("runs")).toEqual(["3"]);
	});

	it("does nothing when everything is in the season", async () => {
		await seedRider(ctx);
		await seedRide(ATHLETE_A, { id: "2", ...AT_START });
		await purgePreSeasonActivities(ctx);
		expect(await ids("activities")).toEqual(["2"]);
		expect(ctx.queue.sent).toEqual([]);
	});

	it("leaves each rider's evaluation to the queue, a minute late (review L-11)", async () => {
		await seedRider(ctx);
		await seedRider(ctx, { athleteId: ATHLETE_B });
		await seedRide(ATHLETE_A, { id: "1", ...BEFORE });
		await seedRunOrSwim("runs", "2", ATHLETE_A, BEFORE);
		await seedRunOrSwim("swims", "3", ATHLETE_B, BEFORE);

		await purgePreSeasonActivities(ctx);

		expect(ctx.queue.sent).toEqual(
			[ATHLETE_A, ATHLETE_B].map((athleteId) => ({
				body: { kind: "evaluate-rider", athleteId },
				delaySeconds: 60,
			})),
		);
	});

	it("deletes nothing when the evaluations can't be sent", async () => {
		await seedRider(ctx);
		await seedRide(ATHLETE_A, { id: "1", ...BEFORE });
		ctx.queue.sendBatch = async () => {
			throw new Error("queue down");
		};

		await expect(purgePreSeasonActivities(ctx)).rejects.toThrow("queue down");
		expect(await ids("activities")).toEqual(["1"]);
	});
});
