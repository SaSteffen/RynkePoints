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
import { makeCtx, resetDb, seedRider } from "../support/ctx";
import { ATHLETE_A, ATHLETE_B, NOW } from "../support/fixtures";
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
