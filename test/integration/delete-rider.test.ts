import {
	createExecutionContext,
	createMessageBatch,
	env,
	getQueueResult,
} from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { upsertActivity } from "../../src/db/activities";
import { upsertFailedWork } from "../../src/db/failed-work";
import { getRider } from "../../src/db/riders";
import { handleFetch, handleQueue } from "../../src/index";
import { toActivityRecord } from "../../src/strava/activity";
import { backoffSeconds } from "../../src/strava/rate-limit";
import { MAX_ATTEMPTS } from "../../src/work/consumer";
import type { DeleteRiderMessage, WorkMessage } from "../../src/work/messages";
import { approve } from "../support/callback";
import {
	makeCtx,
	ORIGIN,
	resetDb,
	seedRider,
	type TestCtx,
	tableCounts,
} from "../support/ctx";
import { type FakeStrava, installFakeStrava } from "../support/fake-strava";
import {
	ATHLETE_A,
	ATHLETE_B,
	makeStravaActivity,
	NOW,
} from "../support/fixtures";
import { pushEndpoint, seedSubscription } from "../support/push";

const DEAUTHORIZED: DeleteRiderMessage = {
	kind: "delete-rider",
	athleteId: ATHLETE_A,
	reason: "deauthorized",
	revoke: false,
};
const LEFT_CLUB: DeleteRiderMessage = {
	...DEAUTHORIZED,
	reason: "left-club",
	revoke: true,
};

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

/**
 * Rider A with credentials, consent, one activity, one failed_work row and two
 * devices with notifications on.
 */
async function seedEverything(options: Parameters<typeof seedRider>[1] = {}) {
	fake.addAthlete({ id: ATHLETE_A });
	const rider = await seedRider(ctx, { consentVersion: 1, ...options });
	const activity = makeStravaActivity();
	fake.addActivity(ATHLETE_A, activity);
	const record = toActivityRecord(activity, ATHLETE_A, NOW);
	if (!record) throw new Error("fixture is not a cycling activity");
	await upsertActivity(env.DB, record);
	await upsertFailedWork(env.DB, {
		athleteId: ATHLETE_A,
		message: JSON.stringify({ kind: "check-membership", athleteId: ATHLETE_A }),
		lastError: "synthetic",
		now: NOW,
	});
	await seedSubscription(ATHLETE_A, pushEndpoint(1));
	await seedSubscription(ATHLETE_A, pushEndpoint(2));
	expect(await tableCounts()).toMatchObject({
		riders: 1,
		strava_credentials: 1,
		activities: 1,
		consent_records: 1,
		failed_work: 1,
		push_subscriptions: 2,
	});
	expect(await namedActivities()).toBe(1);
	return { rider, activity };
}

/** Stored rides with a name (008 FR-003). */
async function namedActivities() {
	return env.DB.prepare(
		"SELECT count(*) AS n FROM activities WHERE name IS NOT NULL",
	).first("n");
}

async function expectNoRiderRows() {
	expect(await tableCounts()).toMatchObject({
		riders: 0,
		strava_credentials: 0,
		activities: 0,
		consent_records: 0,
		failed_work: 0,
		push_subscriptions: 0,
	});
}

describe("deauthorization webhook", () => {
	it("queues a delete-rider without revoke", async () => {
		const res = await handleFetch(
			new Request(`${ORIGIN}/strava/webhook/test-verify-token`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					object_type: "athlete",
					object_id: ATHLETE_A,
					aspect_type: "update",
					updates: { authorized: "false" },
					owner_id: ATHLETE_A,
					subscription_id: 777,
					event_time: NOW,
				}),
			}),
			ctx,
		);
		expect(res.status).toBe(200);
		expect(ctx.queue.sent.map((m) => m.body)).toEqual([DEAUTHORIZED]);
		expect(fake.calls).toEqual([]);
	});
});

describe("delete-rider", () => {
	it("deletes every row of the rider without calling Strava", async () => {
		await seedEverything();
		const { result } = await deliver(DEAUTHORIZED);
		expect(result.explicitAcks).toEqual(["m1"]);
		await expectNoRiderRows();
		// 008 SC-006: no ride name is left.
		expect(await namedActivities()).toBe(0);
		expect(fake.calls).toEqual([]);
	});

	it("leaves another rider's devices (010 FR-013, SC-005)", async () => {
		await seedEverything();
		await seedRider(ctx, { athleteId: ATHLETE_B });
		await seedSubscription(ATHLETE_B, pushEndpoint(3));
		await deliver(DEAUTHORIZED);
		const { results } = await env.DB.prepare(
			"SELECT athlete_id, endpoint FROM push_subscriptions",
		).all();
		expect(results).toEqual([
			{ athlete_id: ATHLETE_B, endpoint: pushEndpoint(3) },
		]);
	});

	it("revokes the stored refresh token before deleting", async () => {
		const { rider } = await seedEverything();
		const { result } = await deliver(LEFT_CLUB);
		expect(result.explicitAcks).toEqual(["m1"]);
		const [call] = fake.callsTo("revoke");
		expect(call?.headers.get("Authorization")).toBe(
			`Basic ${btoa("10001:test-client-secret")}`,
		);
		expect(call?.form.get("token")).toBe(rider.refreshToken);
		expect(fake.revocations).toEqual([
			{ token: rider.refreshToken, kind: "refresh" },
		]);
		await expectNoRiderRows();
	});

	it("never refreshes first, even with an expired access token", async () => {
		await seedEverything({ expiresAt: NOW - 3600 });
		// The fake would refuse this refresh token.
		const athlete = fake.athletes.get(ATHLETE_A);
		if (athlete) athlete.refreshToken = "refresh-rotated-elsewhere";
		const { result } = await deliver(LEFT_CLUB);
		expect(result.explicitAcks).toEqual(["m1"]);
		expect(fake.callsTo("token")).toEqual([]);
		expect(fake.callsTo("revoke")).toHaveLength(1);
		await expectNoRiderRows();
	});

	it("processes a needs_reconnect rider", async () => {
		await seedEverything({ status: "needs_reconnect" });
		const { result } = await deliver({
			...LEFT_CLUB,
			reason: "reconnect-expired",
		});
		expect(result.explicitAcks).toEqual(["m1"]);
		expect(fake.callsTo("revoke")).toHaveLength(1);
		await expectNoRiderRows();
	});

	it.each([400, 401])("deletes when the revoke answers %i", async (status) => {
		await seedEverything();
		fake.failNext("revoke", { status });
		const { result } = await deliver(LEFT_CLUB);
		expect(result.explicitAcks).toEqual(["m1"]);
		await expectNoRiderRows();
	});

	it("retries a revoke that answers 503 and keeps the rider", async () => {
		await seedEverything();
		fake.failNext("revoke", { status: 503 });
		const { result, retry } = await deliver(LEFT_CLUB, 2);
		expect(result.retryMessages).toEqual([{ msgId: "m1" }]);
		expect(retry).toHaveBeenCalledWith({ delaySeconds: backoffSeconds(2) });
		expect(await getRider(env.DB, ATHLETE_A)).not.toBeNull();
	});

	it("deletes anyway when the revoke still fails on the last attempt", async () => {
		await seedEverything();
		fake.failNext("revoke", { status: 503 });
		vi.spyOn(console, "error").mockImplementation(() => {});
		const { result } = await deliver(LEFT_CLUB, MAX_ATTEMPTS);
		expect(result.explicitAcks).toEqual(["m1"]);
		// The seeded failed_work row goes with the rider; no new one is written.
		await expectNoRiderRows();
	});

	it("lets no later activity event bring the rider back", async () => {
		const { activity } = await seedEverything();
		await deliver(DEAUTHORIZED);
		fake.calls.length = 0;
		const { result } = await deliver({
			kind: "activity-event",
			athleteId: ATHLETE_A,
			activityId: activity.id,
			aspect: "create",
			changed: [],
		});
		expect(result.explicitAcks).toEqual(["m1"]);
		expect(fake.calls).toEqual([]);
		expect(await tableCounts()).toMatchObject({ riders: 0, activities: 0 });
	});

	it("lets a deleted rider reconnect fresh", async () => {
		await seedEverything({ importStatus: "done" });
		await deliver(DEAUTHORIZED);
		const res = await approve(ctx, fake, ATHLETE_A);
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toBe("/me");
		expect(await getRider(env.DB, ATHLETE_A)).toMatchObject({
			status: "connected",
			importStatus: "pending",
		});
		expect(await tableCounts()).toMatchObject({
			riders: 1,
			strava_credentials: 1,
			activities: 0,
			failed_work: 0,
		});
	});
});
