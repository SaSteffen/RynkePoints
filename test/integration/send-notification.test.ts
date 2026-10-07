import {
	createExecutionContext,
	createMessageBatch,
	env,
	getQueueResult,
} from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleQueue } from "../../src/index";
import { MAX_ATTEMPTS } from "../../src/work/consumer";
import {
	makeCtx,
	resetDb,
	seedRider,
	type TestCtx,
	tableCounts,
} from "../support/ctx";
import { ATHLETE_A, ATHLETE_B, NOW } from "../support/fixtures";
import {
	installPushService,
	pushEndpoint,
	seedSubscription,
} from "../support/push";

// The send-notification handler (feature 010 contracts/push-delivery.md
// "Handler sendNotification", FR-018, FR-020, FR-021).

let ctx: TestCtx;

beforeEach(async () => {
	await resetDb();
	ctx = makeCtx();
	await seedRider(ctx, { athleteId: ATHLETE_A });
	await seedRider(ctx, { athleteId: ATHLETE_B });
	vi.spyOn(console, "warn").mockImplementation(() => {});
	vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
});

async function deliver(subscriptionId: number, attempts = 1, c = ctx) {
	const batch = createMessageBatch("rynke-points-work", [
		{
			id: "m1",
			timestamp: new Date(NOW * 1000),
			attempts,
			body: { kind: "send-notification", athleteId: ATHLETE_A, subscriptionId },
		},
	]);
	const [message] = batch.messages;
	const retry = message ? vi.spyOn(message, "retry") : vi.fn();
	await handleQueue(batch, c);
	return {
		result: await getQueueResult(batch, createExecutionContext()),
		retry,
	};
}

async function endpoints() {
	const { results } = await env.DB.prepare(
		"SELECT endpoint FROM push_subscriptions ORDER BY subscription_id",
	).all<{ endpoint: string }>();
	return results.map((r) => r.endpoint);
}

describe("send-notification", () => {
	it("pushes once to the rider's device", async () => {
		const pushes = installPushService(() => 201);
		const id = await seedSubscription(ATHLETE_A, pushEndpoint(1));
		const { result } = await deliver(id);
		expect(result.explicitAcks).toEqual(["m1"]);
		expect(pushes.map((p) => p.url)).toEqual([pushEndpoint(1)]);
	});

	it("pushes nothing when the row is gone or belongs to another rider", async () => {
		const pushes = installPushService();
		const other = await seedSubscription(ATHLETE_B, pushEndpoint(1));
		expect((await deliver(other)).result.explicitAcks).toEqual(["m1"]);
		expect((await deliver(other + 1)).result.explicitAcks).toEqual(["m1"]);
		expect(pushes).toEqual([]);
	});

	it.each([410, 404])("deletes the row on %i", async (status) => {
		installPushService(() => status);
		const id = await seedSubscription(ATHLETE_A, pushEndpoint(1));
		await seedSubscription(ATHLETE_A, pushEndpoint(2));
		expect((await deliver(id)).result.explicitAcks).toEqual(["m1"]);
		expect(await endpoints()).toEqual([pushEndpoint(2)]);
	});

	it("deletes a stored endpoint whose host isn't allowed, without a push", async () => {
		const id = await seedSubscription(ATHLETE_A, "https://example.com/push/1");
		expect((await deliver(id)).result.explicitAcks).toEqual(["m1"]);
		expect(await endpoints()).toEqual([]);
	});

	it("retries 503 three times, then gives up and keeps the row", async () => {
		installPushService(() => 503);
		const id = await seedSubscription(ATHLETE_A, pushEndpoint(1));
		for (const [attempts, delaySeconds] of [
			[1, 60],
			[2, 120],
			[3, 240],
		] as const) {
			const { result, retry } = await deliver(id, attempts);
			expect(result.explicitAcks).toEqual([]);
			expect(retry).toHaveBeenCalledWith({ delaySeconds });
		}
		const { result } = await deliver(id, 4);
		expect(result.explicitAcks).toEqual(["m1"]);
		expect(await endpoints()).toEqual([pushEndpoint(1)]);
		expect((await tableCounts()).failed_work).toBe(0);
	});

	it("acks a 403 and keeps the row", async () => {
		installPushService(() => 403);
		const id = await seedSubscription(ATHLETE_A, pushEndpoint(1));
		expect((await deliver(id)).result.explicitAcks).toEqual(["m1"]);
		expect(await endpoints()).toEqual([pushEndpoint(1)]);
		expect((await tableCounts()).failed_work).toBe(0);
	});

	it("never writes failed_work, even when the handler throws on the last attempt", async () => {
		installPushService();
		const id = await seedSubscription(ATHLETE_A, pushEndpoint(1));
		const broken = {
			...ctx,
			env: { ...ctx.env, PUSH_VAPID_KEY: "not a key" },
		};
		const { result } = await deliver(id, MAX_ATTEMPTS, broken);
		expect(result.explicitAcks).toEqual(["m1"]);
		expect((await tableCounts()).failed_work).toBe(0);
	});
});
