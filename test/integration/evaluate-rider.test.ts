import {
	createExecutionContext,
	createMessageBatch,
	env,
	getQueueResult,
} from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { upsertActivity } from "../../src/db/activities";
import { handleQueue } from "../../src/index";
import { CURRENT_RULES } from "../../src/rynke/rules";
import type { EvaluateRiderMessage } from "../../src/work/messages";
import {
	makeCtx,
	resetDb,
	seedRider,
	type TestCtx,
	tableCounts,
} from "../support/ctx";
import { type FakeStrava, installFakeStrava } from "../support/fake-strava";
import { ATHLETE_A, NOW } from "../support/fixtures";
import {
	activityRecord,
	balanceRow,
	expectConsistent,
	expectedRynke,
	resultRows,
	snapshot,
} from "../support/rynke";

// The evaluate-rider message (contracts/queue-messages.md): a full evaluation
// of the stored activities, without any Strava request.

const MESSAGE: EvaluateRiderMessage = {
	kind: "evaluate-rider",
	athleteId: ATHLETE_A,
};

let fake: FakeStrava;
let ctx: TestCtx;

beforeEach(async () => {
	await resetDb();
	fake = installFakeStrava();
	ctx = makeCtx();
});

afterEach(() => fake.restore());

async function deliver(body: unknown, testCtx: TestCtx = ctx) {
	const batch = createMessageBatch("rynke-points-work", [
		{ id: "m1", timestamp: new Date(NOW * 1000), attempts: 1, body },
	]);
	await handleQueue(batch, testCtx);
	return getQueueResult(batch, createExecutionContext());
}

async function seedRides() {
	await upsertActivity(env.DB, activityRecord(1, { distance_m: 79000 }));
	await upsertActivity(
		env.DB,
		activityRecord(2, {
			start_date: "2026-05-02T08:00:00Z",
			elevation_gain_m: 1240,
			moving_time_s: 3 * 3600,
			elapsed_time_s: 3 * 3600,
		}),
	);
}

describe("evaluate-rider", () => {
	it("stores the rider's results and balance without calling Strava", async () => {
		await seedRider(ctx);
		await seedRides();

		const result = await deliver(MESSAGE);

		expect(result.explicitAcks).toEqual(["m1"]);
		expect(await resultRows()).toHaveLength(2);
		const expected = await expectedRynke(CURRENT_RULES);
		expect(await balanceRow()).toMatchObject({
			distance_rynke: expected.balance.distanceRynke,
			elevation_dm: expected.balance.elevationDm,
			training_rynke: expected.balance.trainingRynke,
		});
		await expectConsistent();
		expect(fake.calls).toEqual([]);
		expect(ctx.queue.sent).toEqual([]);
	});

	it("writes nothing the second time", async () => {
		await seedRider(ctx);
		await seedRides();
		await deliver(MESSAGE);
		const before = await snapshot();

		await deliver(MESSAGE, makeCtx({ now: NOW + 3600 }));

		expect(await snapshot()).toEqual(before);
	});

	it("drops the message for an unknown rider", async () => {
		const result = await deliver(MESSAGE);
		expect(result.explicitAcks).toEqual(["m1"]);
		expect(await tableCounts()).toMatchObject({
			ride_results: 0,
			rynke_balances: 0,
		});
	});

	it("drops the message for a needs_reconnect rider", async () => {
		await seedRider(ctx, { status: "needs_reconnect" });
		await seedRides();
		const result = await deliver(MESSAGE);
		expect(result.explicitAcks).toEqual(["m1"]);
		expect(await tableCounts()).toMatchObject({
			ride_results: 0,
			rynke_balances: 0,
		});
	});

	it("retries when D1 fails", async () => {
		await seedRider(ctx);
		await seedRides();
		const failing = {
			prepare: (query: string) => env.DB.prepare(query),
			batch: () => Promise.reject(new Error("D1 unavailable")),
		} as unknown as D1Database;
		const failingCtx: TestCtx = { ...ctx, env: { ...env, DB: failing } };

		const result = await deliver(MESSAGE, failingCtx);

		expect(result.explicitAcks).toEqual([]);
		expect(result.retryMessages).toEqual([{ msgId: "m1" }]);
		expect(await balanceRow()).toBeNull();
	});
});
