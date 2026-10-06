import {
	createExecutionContext,
	createMessageBatch,
	env,
	getQueueResult,
} from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleQueue } from "../../src/index";
import { backoffSeconds } from "../../src/strava/rate-limit";
import { MAX_ATTEMPTS } from "../../src/work/consumer";
import {
	type ActivityEventMessage,
	serializeWorkMessage,
} from "../../src/work/messages";
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
	makeStravaActivity,
	NOW,
} from "../support/fixtures";

const A = 7_200_001;
const B = 7_200_002;
const C = 7_200_003;

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

function msg(
	activityId: number,
	aspect: ActivityEventMessage["aspect"],
	changed: string[] = [],
	athleteId = ATHLETE_A,
): ActivityEventMessage {
	return { kind: "activity-event", athleteId, activityId, aspect, changed };
}

/** Delivers one message through the Worker's queue handler. */
async function deliver(body: ActivityEventMessage, attempts = 1) {
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

async function rows() {
	const { results } = await env.DB.prepare(
		"SELECT * FROM activities ORDER BY strava_activity_id",
	).all();
	return results;
}

async function storedIds() {
	return (await rows()).map((r) => r.strava_activity_id);
}

/** A connected rider A, known to the fake, with full scopes. */
async function connectedRider(scopeReadAll = true) {
	fake.addAthlete({
		id: ATHLETE_A,
		scopes: scopeReadAll
			? ["read", "activity:read", "activity:read_all"]
			: ["read", "activity:read"],
	});
	await seedRider(ctx, { scopeReadAll });
}

function addRide(id: number, overrides: Record<string, unknown> = {}) {
	fake.addActivity(ATHLETE_A, makeStravaActivity({ id, ...overrides }));
}

function fakeActivity(id: number) {
	const activity = fake.activities.get(id);
	if (!activity) throw new Error(`fake has no activity ${id}`);
	return activity;
}

describe("activity-event: create", () => {
	it("stores the allow-listed fields and nothing else", async () => {
		await connectedRider();
		addRide(A);
		const { result } = await deliver(msg(A, "create"));
		expect(result.explicitAcks).toEqual(["m1"]);
		expect(fake.callsTo("activity")).toHaveLength(1);
		// SELECT * proves the table has no other columns (FR-014).
		expect(await rows()).toEqual([
			{
				strava_activity_id: A,
				athlete_id: ATHLETE_A,
				sport_type: "Ride",
				start_date: "2026-10-05T07:30:00Z",
				start_date_local: "2026-10-05T09:30:00Z",
				timezone: "(GMT+01:00) Europe/Berlin",
				distance_m: 42195,
				moving_time_s: 5400,
				elevation_gain_m: 312,
				is_private: 0,
				refreshed_at: NOW,
			},
		]);
	});

	it("stores nothing for an activity Strava no longer has", async () => {
		await connectedRider();
		const { result } = await deliver(msg(A, "create"));
		expect(result.explicitAcks).toEqual(["m1"]);
		expect(await rows()).toEqual([]);
	});

	it("stores nothing for a non-cycling activity", async () => {
		await connectedRider();
		addRide(A, { sport_type: "Run", type: "Run" });
		await deliver(msg(A, "create"));
		expect(await rows()).toEqual([]);
	});

	it("stores no private activity without read_all, even if Strava returns it", async () => {
		// The stored grant decides (FR-007).
		fake.addAthlete({ id: ATHLETE_A });
		await seedRider(ctx, { scopeReadAll: false });
		addRide(A, { private: true });
		await deliver(msg(A, "create"));
		expect(await rows()).toEqual([]);
	});

	it("stores a private activity with read_all", async () => {
		await connectedRider();
		addRide(A, { private: true });
		await deliver(msg(A, "create"));
		expect(await rows()).toMatchObject([{ is_private: 1 }]);
	});
});

describe("activity-event: update", () => {
	it("deletes the row when the type changed to a non-cycling sport", async () => {
		await connectedRider();
		addRide(A);
		await deliver(msg(A, "create"));
		Object.assign(fakeActivity(A), { sport_type: "Run", type: "Run" });
		await deliver(msg(A, "update", ["type"]));
		expect(await rows()).toEqual([]);
	});

	it("ignores a title-only update without calling Strava", async () => {
		await connectedRider();
		addRide(A);
		await deliver(msg(A, "create"));
		const before = await rows();
		fakeActivity(A).distance = 99_999;
		fake.calls.length = 0;
		const { result } = await deliver(msg(A, "update", ["title"]));
		expect(result.explicitAcks).toEqual(["m1"]);
		expect(fake.calls).toEqual([]);
		expect(await rows()).toEqual(before);
	});

	it.each([
		["no changed keys", []],
		["an unknown key", ["unknown_key"]],
		["title and type", ["title", "type"]],
	])("refreshes the row for %s", async (_name, changed) => {
		await connectedRider();
		addRide(A);
		await deliver(msg(A, "create"));
		fakeActivity(A).distance = 50_000;
		fake.calls.length = 0;
		await deliver(msg(A, "update", changed));
		expect(fake.callsTo("activity")).toHaveLength(1);
		expect(await rows()).toMatchObject([{ distance_m: 50_000 }]);
	});

	it("deletes the row when an activity went private without read_all", async () => {
		await connectedRider(false);
		addRide(A);
		await deliver(msg(A, "create"));
		expect(await storedIds()).toEqual([A]);
		fakeActivity(A).private = true;
		await deliver(msg(A, "update", ["private"]));
		expect(fake.callsTo("activity")).toHaveLength(2);
		expect(await rows()).toEqual([]);
	});

	it("deletes the row when Strava answers 403", async () => {
		await connectedRider();
		addRide(A);
		await deliver(msg(A, "create"));
		fake.failNext("activity", { status: 403 });
		const { result } = await deliver(msg(A, "update", ["type"]));
		expect(result.explicitAcks).toEqual(["m1"]);
		expect(await rows()).toEqual([]);
	});
});

describe("activity-event: delete", () => {
	it("removes the row without calling Strava", async () => {
		await connectedRider();
		addRide(A);
		await deliver(msg(A, "create"));
		fake.calls.length = 0;
		const { result } = await deliver(msg(A, "delete"));
		expect(result.explicitAcks).toEqual(["m1"]);
		expect(fake.calls).toEqual([]);
		expect(await rows()).toEqual([]);
	});

	it("never deletes another rider's activity", async () => {
		await connectedRider();
		fake.addAthlete({ id: ATHLETE_B });
		await seedRider(ctx, { athleteId: ATHLETE_B });
		addRide(A);
		await deliver(msg(A, "create"));
		await deliver(msg(A, "delete", [], ATHLETE_B));
		expect(await storedIds()).toEqual([A]);
	});
});

describe("activity-event: replay (SC-004)", () => {
	it("converges to Strava's current state for duplicated, reordered events", async () => {
		await connectedRider();
		// Final state: A is a ride, B was deleted, C is a ride.
		addRide(A);
		addRide(C);
		for (const m of [
			msg(A, "create"),
			msg(A, "create"),
			msg(A, "update", ["type"]),
			msg(B, "delete"),
			msg(B, "create"),
			msg(C, "create"),
			msg(C, "delete"),
			msg(C, "create"),
		]) {
			const { result } = await deliver(m);
			expect(result.explicitAcks).toEqual(["m1"]);
		}
		expect(await storedIds()).toEqual([A, C]);
	});
});

describe("activity-event: dropped messages", () => {
	it("acks an event for an unknown athlete without calling Strava", async () => {
		addRide(A);
		const { result } = await deliver(msg(A, "create"));
		expect(result.explicitAcks).toEqual(["m1"]);
		expect(fake.calls).toEqual([]);
		expect(await rows()).toEqual([]);
	});

	it("acks an event for a needs_reconnect rider without calling Strava", async () => {
		fake.addAthlete({ id: ATHLETE_A });
		await seedRider(ctx, { status: "needs_reconnect" });
		addRide(A);
		const { result } = await deliver(msg(A, "create"));
		expect(result.explicitAcks).toEqual(["m1"]);
		expect(fake.calls).toEqual([]);
		expect(await rows()).toEqual([]);
	});
});

describe("activity-event: retries", () => {
	it("retries a Strava 503 with backoff", async () => {
		await connectedRider();
		addRide(A);
		fake.failNext("activity", { status: 503 });
		const { result, retry } = await deliver(msg(A, "create"), 3);
		expect(result.retryMessages).toEqual([{ msgId: "m1" }]);
		expect(retry).toHaveBeenCalledWith({ delaySeconds: backoffSeconds(3) });
		expect(await rows()).toEqual([]);
	});

	it("defers a Strava 429 to the next 15-minute window", async () => {
		await connectedRider();
		addRide(A);
		fake.failNext("activity", { status: 429 });
		const body = msg(A, "create");
		const { result } = await deliver(body);
		// NOW is 10:00:00Z, so the next window starts in 900 s.
		expect(ctx.queue.sent).toEqual([{ body, delaySeconds: 900 }]);
		expect(result.explicitAcks).toEqual(["m1"]);
		expect(result.retryMessages).toEqual([]);
		expect(fake.callsTo("activity")).toHaveLength(1);
		expect(await rows()).toEqual([]);
	});

	it("records a 503 on the last attempt in failed_work", async () => {
		await connectedRider();
		addRide(A);
		fake.failNext("activity", { status: 503 });
		const body = msg(A, "create");
		vi.spyOn(console, "error").mockImplementation(() => {});
		const { result } = await deliver(body, MAX_ATTEMPTS);
		expect(result.explicitAcks).toEqual(["m1"]);
		const failed = await env.DB.prepare(
			"SELECT athlete_id, message, first_failed_at FROM failed_work",
		).all();
		expect(failed.results).toEqual([
			{
				athlete_id: ATHLETE_A,
				message: serializeWorkMessage(body),
				first_failed_at: NOW,
			},
		]);
		expect((await tableCounts()).activities).toBe(0);
	});
});
