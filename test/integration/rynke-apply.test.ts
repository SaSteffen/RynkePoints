import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { upsertActivity } from "../../src/db/activities";
import { readRynke } from "../../src/db/rynke";
import { type ActivityChange, applyAndEvaluate } from "../../src/rynke/apply";
import {
	CURRENT_RULES,
	countingWindow,
	type RynkeRules,
} from "../../src/rynke/rules";
import { makeCtx, resetDb, seedRider, tableCounts } from "../support/ctx";
import { ATHLETE_A, ATHLETE_B, NOW } from "../support/fixtures";
import {
	activityRecord,
	attendRaw,
	balanceRow,
	expectConsistent,
	expectedRynke,
	insertEvent,
	resultRows,
	snapshot,
} from "../support/rynke";

// applyAndEvaluate and readRynke against local D1 (research R11, R13,
// contracts/ride-evaluation.md).

const db = env.DB;

function apply(
	change: ActivityChange,
	now = NOW,
	rules: RynkeRules = CURRENT_RULES,
	athleteId = ATHLETE_A,
) {
	return applyAndEvaluate(
		db,
		athleteId,
		change,
		rules,
		countingWindow(env),
		now,
	);
}

/** Three rides of 2026-05: one counting, one paused too long, one overlapping. */
async function seedThree() {
	await upsertActivity(db, activityRecord(1, { distance_m: 79000 }));
	await upsertActivity(
		db,
		activityRecord(2, {
			start_date: "2026-05-02T08:00:00Z",
			moving_time_s: 4 * 3600,
			elapsed_time_s: 11 * 3600,
			distance_m: 100000,
		}),
	);
	await upsertActivity(db, activityRecord(3, { distance_m: 78000 }));
}

beforeEach(async () => {
	await resetDb();
	const ctx = makeCtx();
	await seedRider(ctx, { athleteId: ATHLETE_A });
	await seedRider(ctx, { athleteId: ATHLETE_B });
});

describe("applyAndEvaluate", () => {
	it("stores a full evaluation of the rider's activities", async () => {
		await seedThree();
		await apply({ kind: "none" });

		const expected = await expectedRynke(CURRENT_RULES);
		const stored = await readRynke(db, ATHLETE_A);
		expect(stored.results).toEqual(
			expected.results.map((r) => ({
				...r,
				rulesVersion: CURRENT_RULES.version,
			})),
		);
		expect(stored.balance).toEqual({ ...expected.balance, computedAt: NOW });
		expect(stored.balance).toMatchObject({
			distanceRynke: 7,
			rulesVersion: CURRENT_RULES.version,
			rulesEffectiveDate: CURRENT_RULES.effectiveDate,
		});
		expect(stored.results.map((r) => r.reasons)).toEqual([
			[],
			["pause"],
			["overlap"],
		]);
		expect(stored.results[2]?.overlapsActivityId).toBe(1);
	});

	it("SC-002: a second full evaluation writes nothing", async () => {
		await seedThree();
		await apply({ kind: "none" });
		const before = await snapshot();

		await apply({ kind: "none" }, NOW + 3600);

		expect(await snapshot()).toEqual(before);
	});

	it("writes only the rows a new ride changes", async () => {
		await seedThree();
		await apply({ kind: "none" });
		const before = await resultRows();

		await apply(
			{
				kind: "upsert",
				records: [
					activityRecord(4, {
						start_date: "2026-05-03T08:00:00Z",
						distance_m: 20000,
						elevation_gain_m: 0,
						refreshed_at: NOW + 60,
					}),
				],
			},
			NOW + 60,
		);

		const after = await resultRows();
		expect(after.slice(0, 3)).toEqual(before);
		expect(after[3]).toMatchObject({
			strava_activity_id: 4,
			counts: 1,
			distance_rynke: 2,
			activity_refreshed_at: NOW + 60,
		});
		expect(await balanceRow()).toMatchObject({
			distance_rynke: 9,
			computed_at: NOW + 60,
		});
	});

	it("keeps computed_at when the balance doesn't change", async () => {
		await seedThree();
		await apply({ kind: "none" });

		// Another paused ride: a new result, the same balance.
		await apply(
			{
				kind: "upsert",
				records: [
					activityRecord(5, {
						start_date: "2026-05-04T08:00:00Z",
						elapsed_time_s: 24 * 3600,
					}),
				],
			},
			NOW + 60,
		);

		expect(await resultRows()).toHaveLength(4);
		expect(await balanceRow()).toMatchObject({ computed_at: NOW });
	});

	it("never takes over another rider's activity", async () => {
		await upsertActivity(db, activityRecord(1, { athlete_id: ATHLETE_B }));
		await apply({ kind: "none" }, NOW, CURRENT_RULES, ATHLETE_B);
		const before = {
			a: await snapshot(ATHLETE_A),
			b: await snapshot(ATHLETE_B),
		};

		await apply({
			kind: "upsert",
			records: [activityRecord(1, { distance_m: 200000 })],
		});

		expect(await snapshot(ATHLETE_B)).toEqual(before.b);
		expect((await snapshot(ATHLETE_A)).results).toEqual([]);
		const owner = await db
			.prepare(
				"SELECT athlete_id, distance_m FROM activities WHERE strava_activity_id = 1",
			)
			.first();
		expect(owner).toEqual({ athlete_id: ATHLETE_B, distance_m: 40000 });
	});

	it("deletes an activity and its result in one batch", async () => {
		await seedThree();
		await apply({ kind: "none" });

		await apply({ kind: "delete", activityIds: [1] }, NOW + 60);

		const stored = await readRynke(db, ATHLETE_A);
		expect(stored.results.map((r) => r.activityId)).toEqual([2, 3]);
		// The phone recording no longer overlaps anything and counts now.
		expect(stored.results[1]).toMatchObject({ counts: true, reasons: [] });
		expect(stored.balance).toMatchObject({ distanceRynke: 7 });
		expect((await tableCounts()).activities).toBe(2);
		await expectConsistent();
	});

	it("deleting an unknown activity writes nothing", async () => {
		await seedThree();
		await apply({ kind: "none" });
		const before = await snapshot();

		await apply({ kind: "delete", activityIds: [999] }, NOW + 60);

		expect(await snapshot()).toEqual(before);
		expect((await tableCounts()).activities).toBe(3);
	});

	it("deleting another rider's activity changes nothing", async () => {
		await upsertActivity(db, activityRecord(1, { athlete_id: ATHLETE_B }));
		await apply({ kind: "none" }, NOW, CURRENT_RULES, ATHLETE_B);
		const before = await snapshot(ATHLETE_B);

		await apply({ kind: "delete", activityIds: [1] });

		expect(await snapshot(ATHLETE_B)).toEqual(before);
		expect((await tableCounts()).activities).toBe(1);
	});

	it("creates a zero balance for a rider without activities", async () => {
		await apply({ kind: "upsert", records: [] });
		expect(await readRynke(db, ATHLETE_A)).toEqual({
			balance: expect.objectContaining({
				distanceRynke: 0,
				elevationToNextStepDm: 10000,
				trainingRynke: 0,
				trainingMissing: 250,
				qualified: false,
			}),
			results: [],
		});
	});

	it("removes private activities and their results", async () => {
		await upsertActivity(
			db,
			activityRecord(1, {
				distance_m: 100000,
				moving_time_s: 4 * 3600,
				elapsed_time_s: 4 * 3600,
			}),
		);
		await upsertActivity(
			db,
			activityRecord(2, {
				start_date: "2026-05-02T08:00:00Z",
				distance_m: 50000,
				is_private: 1,
			}),
		);
		await apply({ kind: "none" });
		expect((await readRynke(db, ATHLETE_A)).balance).toMatchObject({
			distanceRynke: 15,
		});

		await apply({ kind: "delete-private" }, NOW + 60);

		const stored = await readRynke(db, ATHLETE_A);
		expect(stored.results.map((r) => r.activityId)).toEqual([1]);
		expect(stored.balance).toMatchObject({ distanceRynke: 10 });
		expect((await tableCounts()).activities).toBe(1);
	});

	it("evaluates a season of 300 rides", async () => {
		const records = Array.from({ length: 300 }, (_, i) =>
			activityRecord(10_000 + i, {
				start_date: new Date(
					Date.UTC(2026, 0, 2) + i * 12 * 3600 * 1000,
				).toISOString(),
				distance_m: 20000 + i * 100,
			}),
		);
		await apply({ kind: "upsert", records });

		const stored = await readRynke(db, ATHLETE_A);
		expect(stored.results).toHaveLength(300);
		expect(stored.balance).toEqual({
			...(await expectedRynke(CURRENT_RULES)).balance,
			computedAt: NOW,
		});
		await expectConsistent();
	});

	it("rewrites every row when the rules version changes", async () => {
		await seedThree();
		await apply({ kind: "none" });
		const version = CURRENT_RULES.version;
		expect((await resultRows()).map((r) => r.rules_version)).toEqual([
			version,
			version,
			version,
		]);

		const next: RynkeRules = {
			...CURRENT_RULES,
			version: version + 1,
			effectiveDate: "2027-01-01",
		};
		await apply({ kind: "none" }, NOW + 60, next);

		expect((await resultRows()).map((r) => r.rules_version)).toEqual([
			next.version,
			next.version,
			next.version,
		]);
		expect(await balanceRow()).toMatchObject({
			rules_version: next.version,
			rules_effective_date: "2027-01-01",
			computed_at: NOW + 60,
		});
		await expectConsistent(ATHLETE_A, next);
	});
});

describe("readRynke", () => {
	it("is empty before the first evaluation", async () => {
		await seedThree();
		expect(await readRynke(db, ATHLETE_A)).toEqual({
			balance: null,
			results: [],
		});
	});

	it("reads a consistent balance and results (FR-014b)", async () => {
		await seedThree();
		await apply({ kind: "none" });
		await expectConsistent();
	});
});

describe("applyAndEvaluate with attendance (Story 3)", () => {
	/** A attends two team trainings, entered by hand (research R22). */
	async function twoTrainings(athleteIds = [ATHLETE_A]) {
		for (const date of ["2026-05-02", "2026-05-09"]) {
			await attendRaw(await insertEvent("team_training", date), athleteIds);
		}
	}

	it("keeps the event Rynke when a new ride arrives", async () => {
		await twoTrainings();
		await apply({ kind: "upsert", records: [activityRecord(1)] });

		expect(await readRynke(db, ATHLETE_A)).toMatchObject({
			balance: { teamRynke: 2, trainingRynke: 4 + 10 },
		});
		await expectConsistent();
	});

	it("gives a rider with attendance but no activities a balance; a second run writes nothing", async () => {
		await twoTrainings();
		await apply({ kind: "none" });

		expect((await readRynke(db, ATHLETE_A)).balance).toMatchObject({
			teamRynke: 2,
			trainingRynke: 10,
			distanceRynke: 0,
		});
		await expectConsistent();
		const before = await snapshot();
		await apply({ kind: "none" }, NOW + 60);
		expect(await snapshot()).toEqual(before);
	});

	it("stores the breakdown as a JSON array in kind order", async () => {
		await twoTrainings();
		await attendRaw(await insertEvent("technique_training", "2026-05-03"), [
			ATHLETE_A,
		]);
		await apply({ kind: "none" });

		const breakdown = [
			{ kind: "team_training", attended: 2, team: 2, training: 10 },
			{ kind: "training_weekend_day", attended: 0, team: 0, training: 0 },
			{ kind: "technique_training", attended: 1, team: 5, training: 5 },
		];
		expect((await balanceRow())?.team_event_breakdown).toBe(
			JSON.stringify(breakdown),
		);
		expect((await readRynke(db, ATHLETE_A)).balance?.teamEvents).toEqual(
			breakdown,
		);
	});

	it("leaves another attendee of the same event alone", async () => {
		await upsertActivity(db, activityRecord(2, { athlete_id: ATHLETE_B }));
		await twoTrainings([ATHLETE_A, ATHLETE_B]);
		await apply({ kind: "none" }, NOW, CURRENT_RULES, ATHLETE_B);
		const other = await snapshot(ATHLETE_B);

		await apply({ kind: "upsert", records: [activityRecord(1)] });

		expect(await snapshot(ATHLETE_B)).toEqual(other);
		await expectConsistent(ATHLETE_B);
	});
});
