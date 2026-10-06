import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { handleFetch } from "../../src/index";
import { makeCtx, ORIGIN, type TestCtx } from "../support/ctx";
import { type FakeStrava, installFakeStrava } from "../support/fake-strava";
import { ATHLETE_A, NOW } from "../support/fixtures";

const PATH = "/strava/webhook/test-verify-token";
const SUBSCRIPTION_ID = 777;

let fake: FakeStrava;
let ctx: TestCtx;

beforeEach(() => {
	fake = installFakeStrava();
	ctx = makeCtx();
});

afterEach(() => {
	// No webhook request may reach Strava (FR-011).
	expect(fake.calls).toEqual([]);
	fake.restore();
});

function validate(params: Record<string, string>, path = PATH) {
	const query = new URLSearchParams(params).toString();
	return handleFetch(new Request(`${ORIGIN}${path}?${query}`), ctx);
}

function post(body: unknown, path = PATH) {
	return handleFetch(
		new Request(`${ORIGIN}${path}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: typeof body === "string" ? body : JSON.stringify(body),
		}),
		ctx,
	);
}

function event(overrides: Record<string, unknown> = {}) {
	return {
		object_type: "activity",
		object_id: 7_100_001,
		aspect_type: "create",
		updates: {},
		owner_id: ATHLETE_A,
		subscription_id: SUBSCRIPTION_ID,
		event_time: NOW,
		...overrides,
	};
}

/** Webhook answers are for Strava, not riders: no HTML, no language. */
function expectNotRiderFacing(res: Response) {
	expect(res.headers.get("Content-Type") ?? "").not.toContain("text/html");
	expect(res.headers.get("Content-Language")).toBeNull();
}

describe("GET /strava/webhook/:secret (subscription validation)", () => {
	it("echoes the challenge for the right verify token", async () => {
		const res = await validate({
			"hub.mode": "subscribe",
			"hub.verify_token": "test-verify-token",
			"hub.challenge": "abc",
		});
		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toContain("application/json");
		expect(await res.json()).toEqual({ "hub.challenge": "abc" });
		expectNotRiderFacing(res);
	});

	it("refuses a wrong verify token", async () => {
		const res = await validate({
			"hub.mode": "subscribe",
			"hub.verify_token": "wrong-token",
			"hub.challenge": "abc",
		});
		expect(res.status).toBe(403);
		expectNotRiderFacing(res);
	});

	it("refuses a mode other than subscribe", async () => {
		const res = await validate({
			"hub.mode": "unsubscribe",
			"hub.verify_token": "test-verify-token",
			"hub.challenge": "abc",
		});
		expect(res.status).toBe(403);
	});

	it("answers 404 for a wrong path secret", async () => {
		const res = await validate(
			{
				"hub.mode": "subscribe",
				"hub.verify_token": "test-verify-token",
				"hub.challenge": "abc",
			},
			"/strava/webhook/wrong-secret",
		);
		expect(res.status).toBe(404);
		expectNotRiderFacing(res);
	});
});

describe("POST /strava/webhook/:secret (events)", () => {
	it("answers 404 for a wrong path secret", async () => {
		const res = await post(event(), "/strava/webhook/wrong-secret");
		expect(res.status).toBe(404);
		expectNotRiderFacing(res);
		expect(ctx.queue.sent).toEqual([]);
	});

	it("rejects a body over 1,000 bytes", async () => {
		const res = await post(event({ padding: "x".repeat(1000) }));
		expect(res.status).toBe(400);
		expectNotRiderFacing(res);
		expect(ctx.queue.sent).toEqual([]);
	});

	it.each([
		["invalid JSON", "{not json"],
		["a non-object", "[1,2,3]"],
		["an unknown object_type", event({ object_type: "route" })],
		["an unknown aspect_type", event({ aspect_type: "merge" })],
		["a missing object_id", event({ object_id: undefined })],
		["a string owner_id", event({ owner_id: String(ATHLETE_A) })],
		["a missing subscription_id", event({ subscription_id: undefined })],
		["updates that aren't an object", event({ updates: ["title"] })],
	])("rejects %s", async (_name, body) => {
		const res = await post(body);
		expect(res.status).toBe(400);
		expect(ctx.queue.sent).toEqual([]);
	});

	it("drops an event for another subscription", async () => {
		const res = await post(event({ subscription_id: 1 }));
		expect(res.status).toBe(200);
		expectNotRiderFacing(res);
		expect(ctx.queue.sent).toEqual([]);
	});

	it("queues an activity create", async () => {
		const res = await post(event());
		expect(res.status).toBe(200);
		expectNotRiderFacing(res);
		expect(ctx.queue.sent.map((m) => m.body)).toEqual([
			{
				kind: "activity-event",
				athleteId: ATHLETE_A,
				activityId: 7_100_001,
				aspect: "create",
				changed: [],
			},
		]);
	});

	it("queues the changed keys of an activity update", async () => {
		const res = await post(
			event({
				aspect_type: "update",
				updates: { title: "Synthetic title", type: "Ride" },
			}),
		);
		expect(res.status).toBe(200);
		expect(ctx.queue.sent.map((m) => m.body)).toEqual([
			{
				kind: "activity-event",
				athleteId: ATHLETE_A,
				activityId: 7_100_001,
				aspect: "update",
				changed: ["title", "type"],
			},
		]);
	});

	it("queues an activity delete", async () => {
		const res = await post(event({ aspect_type: "delete" }));
		expect(res.status).toBe(200);
		expect(ctx.queue.sent.map((m) => m.body)).toEqual([
			{
				kind: "activity-event",
				athleteId: ATHLETE_A,
				activityId: 7_100_001,
				aspect: "delete",
				changed: [],
			},
		]);
	});

	it("drops an athlete update that isn't a deauthorization", async () => {
		const res = await post(
			event({
				object_type: "athlete",
				object_id: ATHLETE_A,
				aspect_type: "update",
				updates: { firstname: "Synthetic" },
			}),
		);
		expect(res.status).toBe(200);
		expectNotRiderFacing(res);
		expect(ctx.queue.sent).toEqual([]);
	});
});
