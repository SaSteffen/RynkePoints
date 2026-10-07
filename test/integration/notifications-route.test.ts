import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { handleFetch } from "../../src/index";
import { makeCtx, resetDb, seedRider, sessionCookie } from "../support/ctx";
import { ATHLETE_A, ATHLETE_B, firstNameFor, NOW } from "../support/fixtures";
import { pushEndpoint, seedSubscription } from "../support/push";

// POST /me/notifications (feature 010 contracts/http-routes.md, FR-010–FR-012,
// SC-005).

const ctx = makeCtx();

beforeEach(async () => {
	await resetDb();
	await seedRider(ctx, { athleteId: ATHLETE_A });
	await seedRider(ctx, { athleteId: ATHLETE_B });
});

async function post(
	form: Record<string, string>,
	options: { athleteId?: number | null; origin?: string | null } = {},
) {
	const athleteId =
		options.athleteId === undefined ? ATHLETE_A : options.athleteId;
	const res = await handleFetch(
		new Request("https://rynke.test/me/notifications", {
			method: "POST",
			headers: {
				...(options.origin === null
					? {}
					: { Origin: options.origin ?? "https://rynke.test" }),
				Cookie: athleteId
					? Object.entries(await sessionCookie(ctx, athleteId))
							.map(([k, v]) => `${k}=${v}`)
							.join("; ")
					: "",
			},
			body: new URLSearchParams(form),
		}),
		ctx,
	);
	const body = await res.text();
	expect(res.headers.get("Cache-Control")).toBe("no-store");
	expect(body).not.toContain(firstNameFor(ATHLETE_A));
	expect(body).not.toContain(firstNameFor(ATHLETE_B));
	return { status: res.status, body: body ? JSON.parse(body) : null };
}

async function rows() {
	const { results } = await env.DB.prepare(
		"SELECT endpoint, athlete_id FROM push_subscriptions ORDER BY subscription_id",
	).all<{ endpoint: string; athlete_id: number }>();
	return results;
}

describe("POST /me/notifications", () => {
	it("turns a device on, reports it and turns it off", async () => {
		await seedSubscription(ATHLETE_A, pushEndpoint(9));
		const endpoint = pushEndpoint(1);

		expect(await post({ action: "on", endpoint })).toEqual({
			status: 200,
			body: { on: true },
		});
		expect(await rows()).toContainEqual({ endpoint, athlete_id: ATHLETE_A });
		expect((await post({ action: "check", endpoint })).body).toEqual({
			on: true,
		});

		expect(await post({ action: "off", endpoint })).toEqual({
			status: 200,
			body: { on: false },
		});
		expect(await rows()).toEqual([
			{ endpoint: pushEndpoint(9), athlete_id: ATHLETE_A },
		]);
	});

	it("reports another rider's device as off, and moves it on `on`", async () => {
		const endpoint = pushEndpoint(1);
		await seedSubscription(ATHLETE_B, endpoint);
		expect((await post({ action: "check", endpoint })).body).toEqual({
			on: false,
		});
		await post({ action: "on", endpoint });
		expect(await rows()).toEqual([{ endpoint, athlete_id: ATHLETE_A }]);
	});

	it("keeps a rider's newest 10 devices", async () => {
		for (let n = 1; n <= 10; n++) {
			await seedSubscription(ATHLETE_A, pushEndpoint(n), NOW - 100 + n);
		}
		await post({ action: "on", endpoint: pushEndpoint(11) });
		const endpoints = (await rows()).map((r) => r.endpoint);
		expect(endpoints).toHaveLength(10);
		expect(endpoints).not.toContain(pushEndpoint(1));
		expect(endpoints).toContain(pushEndpoint(11));
	});

	it.each([
		["without Origin", null],
		["from a foreign Origin", "https://evil.example"],
	])("is refused %s", async (_, origin) => {
		expect(
			await post({ action: "on", endpoint: pushEndpoint(1) }, { origin }),
		).toEqual({ status: 403, body: null });
		expect(await rows()).toEqual([]);
	});

	it("needs a session", async () => {
		expect(
			await post(
				{ action: "on", endpoint: pushEndpoint(1) },
				{ athleteId: null },
			),
		).toEqual({ status: 401, body: null });
	});

	it.each<[string, Record<string, string>]>([
		["an unknown action", { action: "toggle", endpoint: pushEndpoint(1) }],
		["a missing endpoint", { action: "on" }],
		["http:", { action: "on", endpoint: "http://fcm.googleapis.com/x" }],
		["another host", { action: "on", endpoint: "https://example.com/x" }],
		[
			"1025 characters",
			{
				action: "on",
				endpoint: `https://fcm.googleapis.com/${"x".repeat(998)}`,
			},
		],
	])("answers 400 for %s and writes nothing", async (_, form) => {
		expect(await post(form)).toEqual({ status: 400, body: null });
		expect(await rows()).toEqual([]);
	});
});
