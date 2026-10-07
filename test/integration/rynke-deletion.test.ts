import {
	createExecutionContext,
	createMessageBatch,
	env,
	getQueueResult,
} from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { upsertActivity } from "../../src/db/activities";
import { readRynke } from "../../src/db/rynke";
import { handleQueue } from "../../src/index";
import { applyAndEvaluate } from "../../src/rynke/apply";
import { CURRENT_RULES, countingWindow } from "../../src/rynke/rules";
import type { WorkMessage } from "../../src/work/messages";
import { approve, SCOPES_ALL, SCOPES_SHARED } from "../support/callback";
import { makeCtx, resetDb, seedRider, type TestCtx } from "../support/ctx";
import { type FakeStrava, installFakeStrava } from "../support/fake-strava";
import { ATHLETE_A, ATHLETE_B, NOW } from "../support/fixtures";
import {
	activityRecord,
	balanceRow,
	expectConsistent,
	resultRows,
	snapshot,
} from "../support/rynke";

// Deleting activities or riders takes their ride results with them, and the
// balance follows in the same batch (FR-015, research R11).

const SHARED = 7_600_001;
const PRIVATE = 7_600_002;

let fake: FakeStrava;
let ctx: TestCtx;

beforeEach(async () => {
	await resetDb();
	fake = installFakeStrava();
	ctx = makeCtx();
	fake.addAthlete({ id: ATHLETE_A });
});

afterEach(() => fake.restore());

/** A shared 100 km ride and a private 50 km ride, evaluated. */
async function seedEvaluated(athleteId = ATHLETE_A) {
	await upsertActivity(
		env.DB,
		activityRecord(athleteId === ATHLETE_A ? SHARED : SHARED + 10, {
			athlete_id: athleteId,
			distance_m: 100000,
			moving_time_s: 4 * 3600,
			elapsed_time_s: 4 * 3600,
		}),
	);
	await upsertActivity(
		env.DB,
		activityRecord(athleteId === ATHLETE_A ? PRIVATE : PRIVATE + 10, {
			athlete_id: athleteId,
			start_date: "2026-05-02T08:00:00Z",
			distance_m: 50000,
			is_private: 1,
		}),
	);
	await applyAndEvaluate(
		env.DB,
		athleteId,
		{ kind: "none" },
		CURRENT_RULES,
		countingWindow(env, CURRENT_RULES),
		NOW,
	);
	expect(await balanceRow(athleteId)).toMatchObject({ distance_rynke: 15 });
}

async function deliver(body: WorkMessage) {
	const batch = createMessageBatch("rynke-points-work", [
		{ id: "m1", timestamp: new Date(NOW * 1000), attempts: 1, body },
	]);
	await handleQueue(batch, ctx);
	const result = await getQueueResult(batch, createExecutionContext());
	expect(result.explicitAcks).toEqual(["m1"]);
}

describe("deleting Rynke rows", () => {
	it("an activity delete event removes its result and Rynke", async () => {
		await seedRider(ctx);
		await seedEvaluated();

		await deliver({
			kind: "activity-event",
			athleteId: ATHLETE_A,
			activityId: SHARED,
			aspect: "delete",
			changed: [],
		});

		expect((await resultRows()).map((r) => r.strava_activity_id)).toEqual([
			PRIVATE,
		]);
		expect(await balanceRow()).toMatchObject({ distance_rynke: 5 });
		await expectConsistent();
		expect(fake.calls).toEqual([]);
	});

	it("a narrowed scope removes private rides and re-evaluates", async () => {
		await seedRider(ctx, { scopeReadAll: true });
		await seedEvaluated();

		await approve(ctx, fake, ATHLETE_A, SCOPES_SHARED);

		expect((await resultRows()).map((r) => r.strava_activity_id)).toEqual([
			SHARED,
		]);
		expect(await balanceRow()).toMatchObject({ distance_rynke: 10 });
		await expectConsistent();
		expect(ctx.queue.sent.map((m) => m.body)).toEqual([
			{ kind: "evaluate-rider", athleteId: ATHLETE_A },
		]);
	});

	it("a reconnect with the same scope sends no evaluate-rider", async () => {
		await seedRider(ctx, { scopeReadAll: true });
		await seedEvaluated();
		const before = await snapshot();

		await approve(ctx, fake, ATHLETE_A, SCOPES_ALL);

		expect(await snapshot()).toEqual(before);
		expect(ctx.queue.sent).toEqual([]);
	});

	it("delete-rider removes every result and the balance", async () => {
		await seedRider(ctx, { athleteId: ATHLETE_A });
		await seedRider(ctx, { athleteId: ATHLETE_B });
		await seedEvaluated(ATHLETE_A);
		await seedEvaluated(ATHLETE_B);
		const other = await snapshot(ATHLETE_B);

		await deliver({
			kind: "delete-rider",
			athleteId: ATHLETE_A,
			reason: "deauthorized",
			revoke: false,
		});

		expect(await readRynke(env.DB, ATHLETE_A)).toEqual({
			balance: null,
			results: [],
		});
		expect(await snapshot(ATHLETE_B)).toEqual(other);
	});
});
