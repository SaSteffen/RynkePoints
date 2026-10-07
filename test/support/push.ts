import { env } from "cloudflare:test";
import { vi } from "vitest";
import { isPushEndpoint } from "../../src/db/push-subscriptions";
import { NOW } from "./fixtures";

// Synthetic push endpoints and a mocked push service (feature 010 research
// R15). No test reaches a real push service: requests to an allowed push host
// are answered here, everything else still goes to the fetch mock installed
// before (the deny-all spy of test/setup.ts, or the fake Strava).

export function pushEndpoint(n: number, host = "fcm.googleapis.com"): string {
	return `https://${host}/fcm/send/synthetic-${n}`;
}

/** Inserts a registration straight into D1; returns its `subscription_id`. */
export async function seedSubscription(
	athleteId: number,
	endpoint: string,
	createdAt = NOW,
): Promise<number> {
	const id = await env.DB.prepare(
		`INSERT INTO push_subscriptions (endpoint, athlete_id, created_at)
		VALUES (?, ?, ?) RETURNING subscription_id`,
	)
		.bind(endpoint, athleteId, createdAt)
		.first<number>("subscription_id");
	if (id === null) throw new Error("push subscription not inserted");
	return id;
}

export interface PushRequest {
	url: string;
	method: string;
	headers: Headers;
	bodyLength: number;
}

/**
 * Answers requests to allowed push hosts with `statusFor(url)` and records
 * them. Call it after `installFakeStrava()` when a test needs both.
 */
export function installPushService(
	statusFor: (url: string) => number | "throw" = () => 201,
): PushRequest[] {
	if (!vi.isMockFunction(globalThis.fetch)) {
		throw new Error("installPushService needs the fetch spy of test/setup.ts");
	}
	const spy = vi.mocked(globalThis.fetch);
	const previous = spy.getMockImplementation();
	const requests: PushRequest[] = [];
	spy.mockImplementation(async (input, init) => {
		const request = new Request(input, init);
		if (!isPushEndpoint(request.url)) {
			if (!previous) throw new Error(`Unexpected fetch to ${request.url}`);
			return previous(input, init);
		}
		const body = await request.arrayBuffer();
		requests.push({
			url: request.url,
			method: request.method,
			headers: request.headers,
			bodyLength: body.byteLength,
		});
		const status = statusFor(request.url);
		if (status === "throw") throw new TypeError("Network connection lost");
		return new Response(null, { status });
	});
	return requests;
}
