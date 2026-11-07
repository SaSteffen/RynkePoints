import { env } from "cloudflare:test";
import { vi } from "vitest";
import type { ForwardMessage, GatewayEnv } from "../../gateway/index";

// Synthetic settings, from vitest.config.ts's gateway project.
export const VERIFY_TOKEN = "test-gateway-verify-token";
export const HAMBURG_TOKEN = "test-hamburg-webhook-token";
export const EUROPE_TOKEN = "test-europe-webhook-token";
export const HAMBURG = "https://hamburg.example.test";
export const EUROPE = "https://europe.example.test";

export const gatewayEnv = env as unknown as GatewayEnv;

const SENT = { metadata: { metrics: { backlogCount: 0, backlogBytes: 0 } } };

/** Records every message sent to the forward queue, without delivering it. */
export function captureForwards(): ForwardMessage[] {
	const sent: ForwardMessage[] = [];
	vi.spyOn(gatewayEnv.FORWARD_QUEUE, "sendBatch").mockImplementation(
		async (messages) => {
			for (const m of messages) sent.push(m.body);
			return SENT;
		},
	);
	vi.spyOn(gatewayEnv.FORWARD_QUEUE, "send").mockImplementation(async (m) => {
		sent.push(m);
		return SENT;
	});
	return sent;
}

/** A synthetic Strava event body. */
export function stravaEvent(overrides: Record<string, unknown> = {}): string {
	return JSON.stringify({
		object_type: "activity",
		object_id: 900001,
		aspect_type: "create",
		owner_id: 990001,
		subscription_id: 777,
		event_time: 1_790_000_000,
		updates: {},
		...overrides,
	});
}
