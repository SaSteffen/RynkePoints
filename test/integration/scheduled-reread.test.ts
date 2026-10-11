import {
	createExecutionContext,
	createMessageBatch,
	createScheduledController,
	env,
	getQueueResult,
} from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seasonStart } from "../../src/config";
import { getRider } from "../../src/db/riders";
import { handleQueue, handleScheduled } from "../../src/index";
import { ACTIVITY_FIGURES_VERSION } from "../../src/strava/activity";
import { makeCtx, resetDb, seedRider, type TestCtx } from "../support/ctx";
import { installFakeStrava } from "../support/fake-strava";
import {
	ATHLETE_A,
	ATHLETE_B,
	makeStravaActivity,
	NOW,
} from "../support/fixtures";
import { pushEndpoint, seedSubscription } from "../support/push";

// Cron step 4: the one-time re-read of riders whose activities were stored
// before an FR-013 figure was added (research R20).

let ctx: TestCtx;

beforeEach(async () => {
	await resetDb();
	ctx = makeCtx();
});

afterEach(() => vi.restoreAllMocks());

function runCron() {
	return handleScheduled(
		createScheduledController({
			scheduledTime: new Date(NOW * 1000),
			cron: "17 3 * * *",
		}),
		ctx,
	);
}

/** Only the re-reads: the membership fan-out queues other kinds. */
function rereads() {
	return ctx.queue.sent
		.map((m) => m.body)
		.filter((b) => b.kind === "reread-page");
}

async function figuresVersion(athleteId = ATHLETE_A) {
	return (await getRider(env.DB, athleteId))?.figuresVersion;
}

describe("scheduled: figures re-read", () => {
	it("re-reads a rider stored before the figures were added, once", async () => {
		await seedRider(ctx, { figuresVersion: 0 });

		await runCron();
		expect(rereads()).toEqual([
			{
				kind: "reread-page",
				athleteId: ATHLETE_A,
				page: 1,
				after: seasonStart(env),
			},
		]);
		expect(await figuresVersion()).toBe(ACTIVITY_FIGURES_VERSION);

		ctx.queue.sent.length = 0;
		await runCron();
		expect(rereads()).toEqual([]);
	});

	it("re-reads a rider at version 1 for Strava's flag", async () => {
		await seedRider(ctx, { figuresVersion: 1 });
		await runCron();
		expect(rereads()).toEqual([
			{
				kind: "reread-page",
				athleteId: ATHLETE_A,
				page: 1,
				after: seasonStart(env),
			},
		]);
		expect(await figuresVersion()).toBe(ACTIVITY_FIGURES_VERSION);
	});

	it("re-reads a rider at version 2 for ride names, once (008 FR-006)", async () => {
		await seedRider(ctx, { figuresVersion: 2 });
		await runCron();
		expect(rereads()).toEqual([
			{
				kind: "reread-page",
				athleteId: ATHLETE_A,
				page: 1,
				after: seasonStart(env),
			},
		]);
		expect(await figuresVersion()).toBe(ACTIVITY_FIGURES_VERSION);

		ctx.queue.sent.length = 0;
		await runCron();
		expect(rereads()).toEqual([]);
	});

	it("skips a needs_reconnect rider at version 1", async () => {
		await seedRider(ctx, {
			athleteId: ATHLETE_B,
			status: "needs_reconnect",
			figuresVersion: 1,
		});
		await runCron();
		expect(rereads()).toEqual([]);
		expect(await figuresVersion(ATHLETE_B)).toBe(1);
	});

	it("skips a rider already at the current version", async () => {
		await seedRider(ctx);
		await runCron();
		expect(rereads()).toEqual([]);
	});

	it("skips a needs_reconnect rider until they reconnect", async () => {
		await seedRider(ctx, {
			athleteId: ATHLETE_B,
			status: "needs_reconnect",
			figuresVersion: 0,
		});
		await runCron();
		expect(rereads()).toEqual([]);
		expect(await figuresVersion(ATHLETE_B)).toBe(0);
	});

	it("keeps the version when the send fails, so the next run sends again", async () => {
		await seedRider(ctx, { figuresVersion: 0 });
		vi.spyOn(ctx.queue, "send").mockRejectedValueOnce(new Error("queue down"));

		await expect(runCron()).rejects.toThrow("queue down");
		expect(await figuresVersion()).toBe(0);

		await runCron();
		expect(rereads()).toHaveLength(1);
		expect(await figuresVersion()).toBe(ACTIVITY_FIGURES_VERSION);
	});

	it("re-reads a rider at version 3 for their runs, without a notification (013 FR-022)", async () => {
		const fake = installFakeStrava();
		try {
			fake.addAthlete({ id: ATHLETE_A });
			await seedRider(ctx, { figuresVersion: 3 });
			await seedSubscription(ATHLETE_A, pushEndpoint(1));
			fake.addActivity(
				ATHLETE_A,
				makeStravaActivity({
					id: 7_400_001,
					sport_type: "Run",
					type: "Run",
					distance: 10400,
					start_date: "2026-05-02T06:00:00Z",
					start_date_local: "2026-05-02T08:00:00Z",
				}),
			);

			await runCron();
			const [reread] = rereads();
			ctx.queue.sent.length = 0;
			const batch = createMessageBatch("rynke-points-work", [
				{
					id: "m1",
					timestamp: new Date(NOW * 1000),
					attempts: 1,
					body: reread,
				},
			]);
			await handleQueue(batch, ctx);
			expect(
				(await getQueueResult(batch, createExecutionContext())).explicitAcks,
			).toEqual(["m1"]);

			const { results } = await env.DB.prepare(
				"SELECT badge_id FROM rider_badges ORDER BY badge_id",
			).all<{ badge_id: string }>();
			expect(results.map((r) => r.badge_id)).toEqual([
				"run-length-10",
				"run-length-5",
				"running-10",
			]);
			expect(
				ctx.queue.sent.filter((m) => m.body.kind === "send-notification"),
			).toEqual([]);
		} finally {
			fake.restore();
		}
	});
});
