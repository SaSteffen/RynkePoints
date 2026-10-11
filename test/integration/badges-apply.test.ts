import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { BADGE_CATALOG_VERSION } from "../../src/badges/catalog";
import { upsertActivity } from "../../src/db/activities";
import {
	type ActivityChange,
	applyAndEvaluate,
	applyCorrectionChange,
	applyTeamEventChange,
} from "../../src/rynke/apply";
import { CURRENT_RULES, countingWindow } from "../../src/rynke/rules";
import type { ActivityRecord } from "../../src/strava/activity";
import { makeCtx, resetDb, seedRider } from "../support/ctx";
import { ATHLETE_A, ATHLETE_B, NOW } from "../support/fixtures";
import { seedBalance } from "../support/rider-view";
import { activityRecord, insertEvent } from "../support/rynke";

// Personal badges stored in the evaluation batch (feature 013 research R13,
// FR-030, SC-002). Synthetic rides only.

const db = env.DB;

function apply(change: ActivityChange, now = NOW) {
	return applyAndEvaluate(
		db,
		ATHLETE_A,
		change,
		CURRENT_RULES,
		countingWindow(env),
		now,
	);
}

async function badges(athleteId = ATHLETE_A) {
	const { results } = await db
		.prepare(
			"SELECT badge_id, earned_on FROM rider_badges WHERE athlete_id = ? ORDER BY badge_id",
		)
		.bind(athleteId)
		.all<{ badge_id: string; earned_on: string }>();
	return results.map((r) => [r.badge_id, r.earned_on]);
}

async function badgesVersion(athleteId = ATHLETE_A) {
	return db
		.prepare("SELECT badges_version FROM riders WHERE athlete_id = ?")
		.bind(athleteId)
		.first<number>("badges_version");
}

/** Three counting 40 km rides, on 1, 2 and 3 May. */
async function seedRides() {
	for (const day of [1, 2, 3]) {
		await upsertActivity(
			db,
			activityRecord(day, {
				start_date: `2026-05-0${day}T08:00:00Z`,
				elevation_gain_m: 0,
			}),
		);
	}
}

beforeEach(async () => {
	await resetDb();
	const ctx = makeCtx();
	await seedRider(ctx, { athleteId: ATHLETE_A });
	await seedRider(ctx, { athleteId: ATHLETE_B });
});

describe("badges in applyAndEvaluate", () => {
	it("stores the rider's personal badges with the Rynke", async () => {
		await seedRides();
		await apply({ kind: "none" });

		expect(await badges()).toContainEqual(["distance-100", "2026-05-03"]);
		expect(await badgesVersion()).toBe(BADGE_CATALOG_VERSION);
		expect(await badges(ATHLETE_B)).toEqual([]);
	});

	it("writes nothing when evaluated again (SC-002)", async () => {
		await seedRides();
		await apply({ kind: "none" });
		const batches: number[] = [];
		const spy = new Proxy(db, {
			get(target, key) {
				if (key === "batch") {
					return (statements: D1PreparedStatement[]) => {
						batches.push(statements.length);
						return target.batch(statements);
					};
				}
				const value = Reflect.get(target, key);
				return typeof value === "function" ? value.bind(target) : value;
			},
		});

		await applyAndEvaluate(
			spy,
			ATHLETE_A,
			{ kind: "none" },
			CURRENT_RULES,
			countingWindow(env),
			NOW + 3600,
		);

		// The read batch only; no write batch follows.
		expect(batches).toHaveLength(1);
	});

	it("takes a badge back when its ride is deleted", async () => {
		await seedRides();
		await apply({ kind: "none" });

		await apply({ kind: "delete", activityIds: [3] });

		expect(await badges()).not.toContainEqual(["distance-100", "2026-05-03"]);
		expect((await badges()).map(([id]) => id)).not.toContain("distance-100");
	});

	it("re-dates a badge when an earlier ride reaches it", async () => {
		await seedRides();
		await apply({ kind: "none" });

		await apply({
			kind: "upsert",
			records: [
				activityRecord(4, {
					start_date: "2026-04-20T08:00:00Z",
					elevation_gain_m: 0,
				}),
			],
		});

		expect(await badges()).toContainEqual(["distance-100", "2026-05-02"]);
	});

	it("tells whether the figures the team badges add up changed", async () => {
		await seedRides();
		await apply({ kind: "none" });
		const ride = (overrides: Partial<ActivityRecord>) =>
			apply({
				kind: "upsert",
				records: [
					activityRecord(3, {
						start_date: "2026-05-03T08:00:00Z",
						elevation_gain_m: 0,
						...overrides,
					}),
				],
			});

		expect((await ride({ name: "Renamed" })).figuresChanged).toBe(false);
		expect((await ride({ distance_m: 50000 })).figuresChanged).toBe(true);
		expect((await apply({ kind: "none" })).figuresChanged).toBe(false);
	});
});

describe("badges in team-event and correction changes", () => {
	it("awards and takes back a team-event badge", async () => {
		const eventId = await insertEvent("technique_training", "2026-05-09");
		const change = (kind: "add-attendance" | "remove-attendance") =>
			applyTeamEventChange(
				db,
				{ kind, eventId, athleteIds: [ATHLETE_A] },
				CURRENT_RULES,
				countingWindow(env),
				NOW,
			);

		await change("add-attendance");
		expect(await badges()).toEqual([
			["team-events-1", "2026-05-09"],
			["technique-1", "2026-05-09"],
			["training-rynke-1", "2026-05-09"],
		]);

		await change("remove-attendance");
		expect(await badges()).toEqual([]);
	});

	it("awards and takes back a Training Rynke badge by correction", async () => {
		const { athleteId } = await applyCorrectionChange(
			db,
			{
				kind: "add-correction",
				athleteId: ATHLETE_A,
				correction: {
					training: 30,
					team: 0,
					reason: "Test",
					date: "2026-05-04",
				},
				by: ATHLETE_B,
			},
			CURRENT_RULES,
			countingWindow(env),
			NOW,
		);
		expect(athleteId).toBe(ATHLETE_A);
		expect(await badges()).toEqual([
			["training-rynke-1", "2026-05-04"],
			["training-rynke-25", "2026-05-04"],
		]);

		const correctionId = await db
			.prepare("SELECT correction_id FROM corrections")
			.first<number>("correction_id");
		await applyCorrectionChange(
			db,
			{ kind: "remove-correction", correctionId: correctionId as number },
			CURRENT_RULES,
			countingWindow(env),
			NOW,
		);
		expect(await badges()).toEqual([]);
	});
});

async function rise(athleteId = ATHLETE_A) {
	return db
		.prepare("SELECT badge_ids, risen_at FROM badge_rises WHERE athlete_id = ?")
		.bind(athleteId)
		.first<{ badge_ids: string; risen_at: number }>();
}

async function reveals(athleteId = ATHLETE_A) {
	const { results } = await db
		.prepare(
			"SELECT badge_id, earned_on FROM badge_reveals WHERE athlete_id = ? ORDER BY badge_id",
		)
		.bind(athleteId)
		.all<{ badge_id: string; earned_on: string }>();
	return results.map((r) => [r.badge_id, r.earned_on]);
}

describe("new badges (US2, research R16 to R18)", () => {
	it("writes and returns the new badges as a rise", async () => {
		// 80 km, then a 30 km ride crosses 100 km.
		for (const day of [1, 2]) {
			await upsertActivity(
				db,
				activityRecord(day, {
					start_date: `2026-05-0${day}T08:00:00Z`,
					elevation_gain_m: 0,
				}),
			);
		}
		await apply({ kind: "none" });

		const result = await apply(
			{
				kind: "upsert",
				records: [
					activityRecord(3, {
						start_date: "2026-05-03T08:00:00Z",
						distance_m: 30000,
						elevation_gain_m: 0,
					}),
				],
			},
			NOW + 60,
		);

		expect(result.badges).toEqual(["distance-100"]);
		expect(await rise()).toEqual({
			badge_ids: JSON.stringify(["distance-100"]),
			risen_at: NOW + 60,
		});
		expect(await reveals()).toEqual([]);
	});

	it("writes no rise for a badge taken back or evaluated again", async () => {
		await seedRides();
		await apply({ kind: "none" });
		await db.prepare("DELETE FROM badge_rises").run();

		expect((await apply({ kind: "none" }, NOW + 60)).badges).toEqual([]);
		expect((await apply({ kind: "delete", activityIds: [3] })).badges).toEqual(
			[],
		);
		expect(await rise()).toBeNull();
	});

	it("awards silently under new rules: revealed, no rise", async () => {
		await seedRides();
		await seedBalance(ATHLETE_A, { rulesVersion: CURRENT_RULES.version - 1 });

		expect((await apply({ kind: "none" })).badges).toEqual([]);
		expect(await rise()).toBeNull();
		expect(await reveals()).toContainEqual(["distance-100", "2026-05-03"]);
	});

	it("awards silently for a rider on an older badge catalog", async () => {
		await db.prepare("UPDATE riders SET badges_version = 0").run();
		await seedRides();
		await seedBalance(ATHLETE_A);

		expect((await apply({ kind: "none" })).badges).toEqual([]);
		expect(await rise()).toBeNull();
		expect(await reveals()).toContainEqual(["distance-100", "2026-05-03"]);
		expect(await badgesVersion()).toBe(BADGE_CATALOG_VERSION);
	});

	it("still names a badge the change itself brings under new rules", async () => {
		// 80 km under older rules, then a 30 km ride crosses 100 km.
		for (const day of [1, 2]) {
			await upsertActivity(
				db,
				activityRecord(day, {
					start_date: `2026-05-0${day}T08:00:00Z`,
					elevation_gain_m: 0,
				}),
			);
		}
		await seedBalance(ATHLETE_A, { rulesVersion: CURRENT_RULES.version - 1 });

		const result = await apply({
			kind: "upsert",
			records: [
				activityRecord(3, {
					start_date: "2026-05-03T08:00:00Z",
					distance_m: 30000,
					elevation_gain_m: 0,
				}),
			],
		});

		expect(result.badges).toEqual(["distance-100"]);
		expect(await rise()).toEqual({
			badge_ids: JSON.stringify(["distance-100"]),
			risen_at: NOW,
		});
		const revealed = (await reveals()).map(([id]) => id);
		expect(revealed).toContain("training-rynke-1");
		expect(revealed).not.toContain("distance-100");
	});

	it("isn't silent for a new rider's first import page (FR-031)", async () => {
		await db.prepare("UPDATE riders SET badges_version = 0").run();
		const records = [1, 2, 3].map((day) =>
			activityRecord(day, {
				start_date: `2026-05-0${day}T08:00:00Z`,
				elevation_gain_m: 0,
			}),
		);

		expect((await apply({ kind: "upsert", records })).badges).toContain(
			"distance-100",
		);
		expect(await reveals()).toEqual([]);
	});

	it("names the riders with a new badge after a team-event change", async () => {
		const eventId = await insertEvent("technique_training", "2026-05-09");
		const result = await applyTeamEventChange(
			db,
			{ kind: "add-attendance", eventId, athleteIds: [ATHLETE_A] },
			CURRENT_RULES,
			countingWindow(env),
			NOW,
		);
		expect(result.earned).toEqual([ATHLETE_A]);
		expect(JSON.parse((await rise())?.badge_ids ?? "[]")).toEqual([
			"team-events-1",
			"technique-1",
			"training-rynke-1",
		]);
	});

	it("never writes a rise for a team badge itself (FR-032; teamBadgeNews does, #125)", async () => {
		const team = [900011, 900012, 900013, 900014];
		for (const athleteId of team) await seedRider(makeCtx(), { athleteId });
		const eventId = await insertEvent("team_training", "2026-05-09");
		await applyTeamEventChange(
			db,
			{ kind: "add-attendance", eventId, athleteIds: [ATHLETE_A, ...team] },
			CURRENT_RULES,
			countingWindow(env),
			NOW,
		);
		const { results } = await db
			.prepare("SELECT badge_ids FROM badge_rises")
			.all<{ badge_ids: string }>();
		expect(results).toHaveLength(5);
		for (const { badge_ids } of results) {
			expect(badge_ids).not.toContain("big-training");
		}
	});
});
