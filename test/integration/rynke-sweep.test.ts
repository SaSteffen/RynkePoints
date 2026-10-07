import { createScheduledController, env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { upsertActivity } from "../../src/db/activities";
import { listRidersNeedingEvaluation } from "../../src/db/rynke";
import { handleScheduled } from "../../src/index";
import { applyAndEvaluate } from "../../src/rynke/apply";
import {
	CURRENT_RULES,
	countingWindow,
	type RynkeRules,
} from "../../src/rynke/rules";
import { fanOutEvaluations } from "../../src/work/scheduled";
import { makeCtx, resetDb, seedRider, type TestCtx } from "../support/ctx";
import { NOW } from "../support/fixtures";
import { activityRecord } from "../support/rynke";

// The daily catch-up sweep (research R14, contracts/queue-messages.md
// "Scheduled: evaluation sweep").

const db = env.DB;
let ctx: TestCtx;

beforeEach(async () => {
	await resetDb();
	ctx = makeCtx();
});

afterEach(() => vi.restoreAllMocks());

function evaluate(athleteId: number, rules: RynkeRules = CURRENT_RULES) {
	return applyAndEvaluate(
		db,
		athleteId,
		{ kind: "none" },
		rules,
		countingWindow(env, rules),
		NOW,
	);
}

/** A connected rider with one evaluated ride. */
async function evaluatedRider(athleteId: number, activityId: number) {
	await seedRider(ctx, { athleteId });
	await upsertActivity(
		db,
		activityRecord(activityId, { athlete_id: athleteId }),
	);
	await evaluate(athleteId);
}

function evaluations() {
	return ctx.queue.sent
		.map((m) => m.body)
		.filter((b) => b.kind === "evaluate-rider");
}

describe("listRidersNeedingEvaluation", () => {
	it("finds exactly the riders whose stored Rynke are missing or stale", async () => {
		// Up to date: nothing to do.
		await evaluatedRider(900001, 1);
		// No balance yet, with and without activities.
		await seedRider(ctx, { athleteId: 900002 });
		await upsertActivity(db, activityRecord(2, { athlete_id: 900002 }));
		await seedRider(ctx, { athleteId: 900003 });
		// Balance and results from another rules version.
		await seedRider(ctx, { athleteId: 900004 });
		await upsertActivity(db, activityRecord(4, { athlete_id: 900004 }));
		await evaluate(900004, { ...CURRENT_RULES, version: 2 });
		// One result from another rules version.
		await evaluatedRider(900005, 5);
		await db
			.prepare("UPDATE ride_results SET rules_version = 2 WHERE athlete_id = ?")
			.bind(900005)
			.run();
		// An activity without a result.
		await evaluatedRider(900006, 6);
		await upsertActivity(
			db,
			activityRecord(66, {
				athlete_id: 900006,
				start_date: "2026-05-03T08:00:00Z",
			}),
		);
		// An activity refreshed after its result.
		await evaluatedRider(900007, 7);
		await upsertActivity(
			db,
			activityRecord(7, { athlete_id: 900007, refreshed_at: NOW + 1 }),
		);
		// needs_reconnect riders are left alone, even without a balance.
		await seedRider(ctx, {
			athleteId: 900008,
			status: "needs_reconnect",
		});
		// No activities but a current balance.
		await seedRider(ctx, { athleteId: 900009 });
		await evaluate(900009);

		expect(await listRidersNeedingEvaluation(db, 1)).toEqual([
			900002, 900003, 900004, 900005, 900006, 900007,
		]);
	});

	it("finds every rider after a rules-version bump", async () => {
		await evaluatedRider(900001, 1);
		await evaluatedRider(900002, 2);
		expect(await listRidersNeedingEvaluation(db, 1)).toEqual([]);
		expect(await listRidersNeedingEvaluation(db, 2)).toEqual([900001, 900002]);
	});
});

describe("fanOutEvaluations", () => {
	it("sends one evaluate-rider per rider in chunks of 100", async () => {
		await db.batch(
			Array.from({ length: 150 }, (_, i) =>
				db
					.prepare(
						`INSERT INTO riders (athlete_id, first_name, status, scope_read_all,
							scopes, connected_at, scopes_updated_at, membership_checked_at,
							import_status, reconnect_requested_at)
						VALUES (?, 'Testrider', 'connected', 1, 'read', 0, 0, 0, 'done', NULL)`,
					)
					.bind(910_001 + i),
			),
		);
		const sendBatch = vi.spyOn(ctx.queue, "sendBatch");

		await fanOutEvaluations(ctx);

		expect(
			sendBatch.mock.calls.map(([messages]) => [...messages].length),
		).toEqual([100, 50]);
		expect(evaluations()).toHaveLength(150);
		expect(evaluations()[0]).toEqual({
			kind: "evaluate-rider",
			athleteId: 910_001,
		});
	});

	it("sends nothing when every rider is up to date", async () => {
		await evaluatedRider(900001, 1);
		await fanOutEvaluations(ctx);
		expect(ctx.queue.sent).toEqual([]);
	});

	it("runs as the last step of the daily cron", async () => {
		await seedRider(ctx, { athleteId: 900001 });
		await handleScheduled(
			createScheduledController({
				scheduledTime: new Date(NOW * 1000),
				cron: "17 3 * * *",
			}),
			ctx,
		);
		expect(ctx.queue.sent.map((m) => m.body.kind)).toEqual([
			"check-membership",
			"evaluate-rider",
		]);
	});
});
