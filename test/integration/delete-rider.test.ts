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
import { getAccessToken } from "../../src/strava/tokens";
import { MAX_ATTEMPTS } from "../../src/work/handler";
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
import { stravaJson } from "../support/strava-json";

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

/** Rider A revokes access on Strava, which then sends the event. */
function deauthorized() {
	fake.deauthorize(ATHLETE_A);
	return deliver(DEAUTHORIZED);
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
				body: stravaJson({
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
	it("deletes every row of the rider once Strava refuses the grant", async () => {
		await seedEverything();
		const { result } = await deauthorized();
		expect(result.explicitAcks).toEqual(["m1"]);
		await expectNoRiderRows();
		// 008 SC-006: no ride name is left.
		expect(await namedActivities()).toBe(0);
		expect(fake.callsTo("token")).toHaveLength(1);
		expect(fake.callsTo("revoke")).toEqual([]);
	});

	it("keeps a rider whose grant Strava still renews (review L-05)", async () => {
		await seedEverything();
		const { result } = await deliver(DEAUTHORIZED);
		expect(result.explicitAcks).toEqual(["m1"]);
		expect(await getRider(env.DB, ATHLETE_A)).not.toBeNull();
		expect(await tableCounts()).toMatchObject({
			riders: 1,
			strava_credentials: 1,
			activities: 1,
			push_subscriptions: 2,
		});
	});

	it("keeps a rider whose token another refresh renewed first", async () => {
		await seedEverything();
		// A drain item's refresh wins the race: Strava then refuses the check's
		// refresh with the token it has just replaced.
		const spy = vi.mocked(globalThis.fetch);
		const strava = spy.getMockImplementation();
		if (!strava) throw new Error("no fake Strava");
		let raced = false;
		spy.mockImplementation(async (input, init) => {
			const request = new Request(input, init);
			if (!raced && new URL(request.url).pathname === "/oauth/token") {
				raced = true;
				const ok = await getAccessToken(ctx, ATHLETE_A, { force: true });
				expect(ok.kind).toBe("ok");
			}
			return strava(request);
		});
		const { result } = await deliver(DEAUTHORIZED);
		expect(result.explicitAcks).toEqual(["m1"]);
		expect(fake.callsTo("token")).toHaveLength(2);
		expect(await getRider(env.DB, ATHLETE_A)).not.toBeNull();
	});

	it("retries while Strava can't answer, and deletes on the last attempt", async () => {
		await seedEverything();
		fake.failNext("token", { status: 503 });
		const { result, retry } = await deliver(DEAUTHORIZED);
		expect(result.explicitAcks).toEqual([]);
		expect(retry).toHaveBeenCalled();
		expect(await getRider(env.DB, ATHLETE_A)).not.toBeNull();

		fake.failNext("token", { status: 503 });
		const last = await deliver(DEAUTHORIZED, MAX_ATTEMPTS);
		expect(last.result.explicitAcks).toEqual(["m1"]);
		await expectNoRiderRows();
	});

	it("leaves another rider's devices (010 FR-013, SC-005)", async () => {
		await seedEverything();
		await seedRider(ctx, { athleteId: ATHLETE_B });
		await seedSubscription(ATHLETE_B, pushEndpoint(3));
		await deauthorized();
		const { results } = await env.DB.prepare(
			"SELECT CAST(athlete_id AS TEXT) AS athlete_id, endpoint FROM push_subscriptions",
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

	it("deletes at once when the revoke fails, keeping the token to withdraw later", async () => {
		await seedEverything();
		fake.failNext("revoke", { status: 503 });
		const { result } = await deliver(LEFT_CLUB, 1);
		expect(result.explicitAcks).toEqual(["m1"]);
		await expectNoRiderRows();
		expect(
			await env.DB.prepare(
				"SELECT COUNT(*) AS n FROM pending_revocations",
			).first("n"),
		).toBe(1);
	});

	it("lets no later activity event bring the rider back", async () => {
		const { activity } = await seedEverything();
		await deauthorized();
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
		await deauthorized();
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
