import {
	createExecutionContext,
	createMessageBatch,
	createScheduledController,
	env,
	getQueueResult,
} from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { upsertActivity } from "../../src/db/activities";
import { getRider } from "../../src/db/riders";
import { handleQueue, handleScheduled } from "../../src/index";
import { toActivityRecord } from "../../src/strava/activity";
import { backoffSeconds } from "../../src/strava/rate-limit";
import type { WorkMessage } from "../../src/work/messages";
import {
	makeCtx,
	resetDb,
	seedRider,
	type TestCtx,
	tableCounts,
} from "../support/ctx";
import { type FakeStrava, installFakeStrava } from "../support/fake-strava";
import {
	ATHLETE_A,
	ATHLETE_B,
	ATHLETE_C,
	makeStravaActivity,
	NOW,
	OTHER_CLUB,
} from "../support/fixtures";

const DAY = 86400;
const CHECK: WorkMessage = { kind: "check-membership", athleteId: ATHLETE_A };

let fake: FakeStrava;
let ctx: TestCtx;

beforeEach(async () => {
	await resetDb();
	fake = installFakeStrava();
	ctx = makeCtx();
});

afterEach(() => {
	vi.restoreAllMocks();
	fake.restore();
});

/** Delivers one message through the Worker's queue handler. */
async function deliver(body: WorkMessage, attempts = 1) {
	const batch = createMessageBatch("rynke-points-work", [
		{ id: "m1", timestamp: new Date(NOW * 1000), attempts, body },
	]);
	// The pool's getQueueResult drops retry options, so spy for delaySeconds.
	const [message] = batch.messages;
	const retry = message ? vi.spyOn(message, "retry") : vi.fn();
	await handleQueue(batch, ctx);
	return {
		result: await getQueueResult(batch, createExecutionContext()),
		retry,
	};
}

function runScheduled() {
	return handleScheduled(
		createScheduledController({
			scheduledTime: new Date(NOW * 1000),
			cron: "17 3 * * *",
		}),
		ctx,
	);
}

async function seedWithActivity(options: Parameters<typeof seedRider>[1] = {}) {
	await seedRider(ctx, options);
	const record = toActivityRecord(
		makeStravaActivity(),
		options.athleteId ?? ATHLETE_A,
		NOW,
	);
	if (!record) throw new Error("fixture is not a cycling activity");
	await upsertActivity(env.DB, record);
}

describe("scheduled: membership fan-out", () => {
	it("queues one check per connected rider", async () => {
		await seedRider(ctx, { athleteId: ATHLETE_A });
		await seedRider(ctx, { athleteId: ATHLETE_B });
		await seedRider(ctx, { athleteId: ATHLETE_C, status: "needs_reconnect" });
		await runScheduled();
		expect(
			ctx.queue.sent
				.map((m) => m.body)
				.filter((b) => b.kind === "check-membership"),
		).toEqual([
			{ kind: "check-membership", athleteId: ATHLETE_A },
			{ kind: "check-membership", athleteId: ATHLETE_B },
		]);
		expect(fake.calls).toEqual([]);
	});
});

describe("check-membership", () => {
	it("records the check for a member", async () => {
		fake.addAthlete({ id: ATHLETE_A });
		await seedRider(ctx);
		ctx = makeCtx({ now: NOW + DAY });
		const { result } = await deliver(CHECK);
		expect(result.explicitAcks).toEqual(["m1"]);
		expect((await getRider(env.DB, ATHLETE_A))?.membershipCheckedAt).toBe(
			NOW + DAY,
		);
		expect(ctx.queue.sent).toEqual([]);
	});

	it("deletes a rider who left the club", async () => {
		fake.addAthlete({ id: ATHLETE_A, clubs: [OTHER_CLUB.id] });
		await seedWithActivity();
		const { result } = await deliver(CHECK);
		expect(result.explicitAcks).toEqual(["m1"]);
		expect(ctx.queue.sent.map((m) => m.body)).toEqual([
			{
				kind: "delete-rider",
				athleteId: ATHLETE_A,
				reason: "left-club",
				revoke: true,
			},
		]);

		const [deletion] = ctx.queue.sent;
		if (!deletion) throw new Error("nothing queued");
		await deliver(deletion.body);
		expect(fake.callsTo("revoke")).toHaveLength(1);
		expect(await tableCounts()).toMatchObject({
			riders: 0,
			strava_credentials: 0,
			activities: 0,
			failed_work: 0,
		});
	});

	it("keeps the rider when the check is inconclusive (503)", async () => {
		fake.addAthlete({ id: ATHLETE_A, clubs: [OTHER_CLUB.id] });
		await seedWithActivity();
		fake.failNext("clubs", { status: 503 });
		const { result, retry } = await deliver(CHECK, 2);
		expect(result.retryMessages).toEqual([{ msgId: "m1" }]);
		expect(retry).toHaveBeenCalledWith({ delaySeconds: backoffSeconds(2) });
		expect(ctx.queue.sent).toEqual([]);
		expect(await tableCounts()).toMatchObject({ riders: 1, activities: 1 });
	});

	it("defers without calling Strava when the budget is exhausted", async () => {
		fake.addAthlete({ id: ATHLETE_A, clubs: [OTHER_CLUB.id] });
		await seedWithActivity();
		await env.DB.prepare(
			"UPDATE strava_rate_limit SET observed_at = ?, read_15m = 100 WHERE id = 1",
		)
			.bind(NOW)
			.run();
		const { result } = await deliver(CHECK);
		expect(result.explicitAcks).toEqual(["m1"]);
		expect(ctx.queue.sent).toEqual([{ body: CHECK, delaySeconds: 900 }]);
		expect(fake.calls).toEqual([]);
		expect(await tableCounts()).toMatchObject({ riders: 1, activities: 1 });
	});
});

describe("scheduled: reconnect expiry (FR-020)", () => {
	it("deletes riders who still need to reconnect after 7 days", async () => {
		fake.addAthlete({ id: ATHLETE_A });
		fake.addAthlete({ id: ATHLETE_B });
		await seedWithActivity({
			athleteId: ATHLETE_A,
			status: "needs_reconnect",
			reconnectRequestedAt: NOW - 8 * DAY,
		});
		await seedWithActivity({
			athleteId: ATHLETE_B,
			status: "needs_reconnect",
			reconnectRequestedAt: NOW - 6 * DAY,
		});
		await runScheduled();
		const deletes = ctx.queue.sent
			.map((m) => m.body)
			.filter((b) => b.kind === "delete-rider");
		expect(deletes).toEqual([
			{
				kind: "delete-rider",
				athleteId: ATHLETE_A,
				reason: "reconnect-expired",
				revoke: true,
			},
		]);

		const [expired] = deletes;
		if (!expired) throw new Error("nothing queued");
		await deliver(expired);
		expect(fake.callsTo("revoke")).toHaveLength(1);
		expect(fake.callsTo("token")).toEqual([]);
		expect(await getRider(env.DB, ATHLETE_A)).toBeNull();
		expect(await getRider(env.DB, ATHLETE_B)).not.toBeNull();
		const { results } = await env.DB.prepare(
			"SELECT DISTINCT athlete_id FROM activities",
		).all();
		expect(results).toEqual([{ athlete_id: ATHLETE_B }]);
	});
});
