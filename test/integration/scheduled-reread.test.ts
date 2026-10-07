import { createScheduledController, env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seasonStart } from "../../src/config";
import { getRider } from "../../src/db/riders";
import { handleScheduled } from "../../src/index";
import { ACTIVITY_FIGURES_VERSION } from "../../src/strava/activity";
import { makeCtx, resetDb, seedRider, type TestCtx } from "../support/ctx";
import { ATHLETE_A, ATHLETE_B, NOW } from "../support/fixtures";

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
});
