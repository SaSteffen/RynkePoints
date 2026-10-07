import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import {
	deleteSubscription,
	deleteSubscriptionById,
	hasSubscription,
	isPushEndpoint,
	MAX_ENDPOINT_LENGTH,
	subscriptionEndpoint,
	subscriptionIdsOfRiders,
	trimSubscriptionsStatement,
	upsertSubscriptionStatement,
} from "../../src/db/push-subscriptions";
import { makeCtx, resetDb, seedRider } from "../support/ctx";
import { ATHLETE_A, ATHLETE_B, NOW } from "../support/fixtures";
import { pushEndpoint, seedSubscription } from "../support/push";

// The device registrations of feature 010 (data-model.md, research R7).

async function rows() {
	const { results } = await env.DB.prepare(
		`SELECT subscription_id, endpoint, athlete_id, created_at
		FROM push_subscriptions ORDER BY subscription_id`,
	).all<{
		subscription_id: number;
		endpoint: string;
		athlete_id: number;
		created_at: number;
	}>();
	return results;
}

beforeEach(async () => {
	await resetDb();
	const ctx = makeCtx();
	await seedRider(ctx, { athleteId: ATHLETE_A });
	await seedRider(ctx, { athleteId: ATHLETE_B });
});

describe("push_subscriptions statements", () => {
	it("inserts, and moves an endpoint to the rider who turns it on", async () => {
		await upsertSubscriptionStatement(
			env.DB,
			pushEndpoint(1),
			ATHLETE_A,
			NOW,
		).run();
		expect(await rows()).toMatchObject([
			{ endpoint: pushEndpoint(1), athlete_id: ATHLETE_A, created_at: NOW },
		]);

		await upsertSubscriptionStatement(
			env.DB,
			pushEndpoint(1),
			ATHLETE_B,
			NOW + 60,
		).run();
		expect(await rows()).toMatchObject([
			{
				endpoint: pushEndpoint(1),
				athlete_id: ATHLETE_B,
				created_at: NOW + 60,
			},
		]);
	});

	it("trims a rider to the newest 10 and leaves other riders alone", async () => {
		// Two rows share the oldest time; the lower ID is the older one.
		await seedSubscription(ATHLETE_A, pushEndpoint(0), NOW);
		for (let n = 1; n <= 10; n++) {
			await seedSubscription(
				ATHLETE_A,
				pushEndpoint(n),
				NOW + (n === 1 ? 0 : n),
			);
		}
		await seedSubscription(ATHLETE_B, pushEndpoint(100), NOW - 1000);

		await trimSubscriptionsStatement(env.DB, ATHLETE_A).run();

		const left = await rows();
		expect(left.filter((r) => r.athlete_id === ATHLETE_A)).toHaveLength(10);
		expect(left.map((r) => r.endpoint)).not.toContain(pushEndpoint(0));
		expect(left.map((r) => r.endpoint)).toContain(pushEndpoint(1));
		expect(left.map((r) => r.endpoint)).toContain(pushEndpoint(100));
	});

	it("deletes an endpoint only for its own rider", async () => {
		await seedSubscription(ATHLETE_A, pushEndpoint(1));
		await deleteSubscription(env.DB, pushEndpoint(1), ATHLETE_B);
		expect(await rows()).toHaveLength(1);
		await deleteSubscription(env.DB, pushEndpoint(1), ATHLETE_A);
		expect(await rows()).toEqual([]);
	});

	it("deletes by ID", async () => {
		const id = await seedSubscription(ATHLETE_A, pushEndpoint(1));
		await seedSubscription(ATHLETE_A, pushEndpoint(2));
		await deleteSubscriptionById(env.DB, id);
		expect((await rows()).map((r) => r.endpoint)).toEqual([pushEndpoint(2)]);
	});

	it("checks a registration of endpoint and rider", async () => {
		await seedSubscription(ATHLETE_A, pushEndpoint(1));
		expect(await hasSubscription(env.DB, pushEndpoint(1), ATHLETE_A)).toBe(
			true,
		);
		expect(await hasSubscription(env.DB, pushEndpoint(1), ATHLETE_B)).toBe(
			false,
		);
		expect(await hasSubscription(env.DB, pushEndpoint(2), ATHLETE_A)).toBe(
			false,
		);
	});

	it("lists the subscription IDs of several riders", async () => {
		const a1 = await seedSubscription(ATHLETE_A, pushEndpoint(1));
		const a2 = await seedSubscription(ATHLETE_A, pushEndpoint(2));
		const b1 = await seedSubscription(ATHLETE_B, pushEndpoint(3));
		expect(await subscriptionIdsOfRiders(env.DB, [ATHLETE_A])).toEqual([
			{ athleteId: ATHLETE_A, subscriptionId: a1 },
			{ athleteId: ATHLETE_A, subscriptionId: a2 },
		]);
		expect(
			await subscriptionIdsOfRiders(env.DB, [ATHLETE_B, ATHLETE_A]),
		).toEqual([
			{ athleteId: ATHLETE_A, subscriptionId: a1 },
			{ athleteId: ATHLETE_A, subscriptionId: a2 },
			{ athleteId: ATHLETE_B, subscriptionId: b1 },
		]);
		expect(await subscriptionIdsOfRiders(env.DB, [])).toEqual([]);
	});

	it("reads an endpoint only for its own rider", async () => {
		const id = await seedSubscription(ATHLETE_A, pushEndpoint(1));
		expect(await subscriptionEndpoint(env.DB, id, ATHLETE_A)).toBe(
			pushEndpoint(1),
		);
		expect(await subscriptionEndpoint(env.DB, id, ATHLETE_B)).toBeNull();
		expect(await subscriptionEndpoint(env.DB, id + 1, ATHLETE_A)).toBeNull();
	});

	it.each([
		["http:", "http://fcm.googleapis.com/fcm/send/x"],
		["1025 characters", `https://fcm.googleapis.com/${"x".repeat(998)}`],
	])("refuses an endpoint over %s", async (_, endpoint) => {
		await expect(seedSubscription(ATHLETE_A, endpoint)).rejects.toThrow(
			/CHECK/,
		);
	});
});

describe("isPushEndpoint", () => {
	it("allows 1024 characters and checks the length first", () => {
		expect(MAX_ENDPOINT_LENGTH).toBe(1024);
		const prefix = "https://fcm.googleapis.com/";
		expect(isPushEndpoint(prefix + "x".repeat(1024 - prefix.length))).toBe(
			true,
		);
		expect(isPushEndpoint(prefix + "x".repeat(1025 - prefix.length))).toBe(
			false,
		);
	});

	it.each([
		"https://fcm.googleapis.com/fcm/send/x",
		"https://updates.push.services.mozilla.com/wpush/v2/x",
		"https://web.push.apple.com/x",
		"https://wns2-db5p.notify.windows.com/w/?token=x",
	])("accepts %s", (endpoint) => {
		expect(isPushEndpoint(endpoint)).toBe(true);
	});

	it.each([
		"http://fcm.googleapis.com/fcm/send/x",
		"http://updates.push.services.mozilla.com/wpush/v2/x",
		"http://web.push.apple.com/x",
		"http://wns2-db5p.notify.windows.com/w/?token=x",
		"https://user:pw@fcm.googleapis.com/x",
		"https://fcm.googleapis.com:8443/x",
		"https://notify.windows.com.example/x",
		"https://notify.windows.com/x",
		"https://example.com/x",
		"not a url",
		"",
	])("rejects %s", (endpoint) => {
		expect(isPushEndpoint(endpoint)).toBe(false);
	});
});
