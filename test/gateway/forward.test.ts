import { createMessageBatch } from "cloudflare:test";
import { describe, expect, it, vi } from "vitest";
import {
	type ForwardMessage,
	gatewayQueue,
	retryDelay,
} from "../../gateway/index";
import {
	EUROPE,
	EUROPE_TOKEN,
	gatewayEnv,
	HAMBURG,
	HAMBURG_TOKEN,
	stravaEvent,
} from "./support";

// contracts/gateway.md › Queue consumer: each message goes to its team's own
// webhook; failures retry per message with a growing delay.

const QUEUE = "rynke-points-gateway-forward";
const BODY = stravaEvent();

function batch(teams: string[], attempts = 1) {
	return createMessageBatch<ForwardMessage>(
		QUEUE,
		teams.map((team, i) => ({
			id: `m${i}`,
			timestamp: new Date(1_790_000_000_000),
			attempts,
			body: { team, body: BODY },
		})),
	);
}

/** Runs the consumer and records what it did with each message. */
async function run(b: MessageBatch<ForwardMessage>) {
	const explicitAcks: string[] = [];
	const retryMessages: { msgId: string; delaySeconds?: number }[] = [];
	for (const m of b.messages) {
		vi.spyOn(m, "ack").mockImplementation(() => {
			explicitAcks.push(m.id);
		});
		vi.spyOn(m, "retry").mockImplementation((options) => {
			retryMessages.push({ msgId: m.id, delaySeconds: options?.delaySeconds });
		});
	}
	await gatewayQueue(b, gatewayEnv);
	return { explicitAcks, retryMessages };
}

/** Answers the team webhooks with the given status per origin. */
function teams(answers: Record<string, number | "down">) {
	const calls: { url: string; body: string; method: string }[] = [];
	vi.mocked(globalThis.fetch).mockImplementation(async (input, init) => {
		const req = new Request(input, init);
		calls.push({ url: req.url, body: await req.text(), method: req.method });
		const answer = answers[new URL(req.url).origin];
		if (answer === undefined || answer === "down") {
			throw new TypeError("connection refused");
		}
		return new Response("ok", { status: answer });
	});
	return calls;
}

describe("forwarding", () => {
	it("POSTs each message to its team's webhook and acks a 2xx", async () => {
		const calls = teams({ [HAMBURG]: 200, [EUROPE]: 200 });
		const result = await run(batch(["hamburg", "europe"]));
		expect(calls).toEqual([
			{
				url: `${HAMBURG}/strava/webhook/${HAMBURG_TOKEN}`,
				body: BODY,
				method: "POST",
			},
			{
				url: `${EUROPE}/strava/webhook/${EUROPE_TOKEN}`,
				body: BODY,
				method: "POST",
			},
		]);
		expect(result.explicitAcks.sort()).toEqual(["m0", "m1"]);
		expect(result.retryMessages).toEqual([]);
	});

	it("retries a 5xx or a network error with a growing delay", async () => {
		teams({ [HAMBURG]: 503, [EUROPE]: "down" });
		const result = await run(batch(["hamburg", "europe"], 3));
		expect(result.explicitAcks).toEqual([]);
		expect(result.retryMessages).toEqual([
			{ msgId: "m0", delaySeconds: retryDelay(3) },
			{ msgId: "m1", delaySeconds: retryDelay(3) },
		]);
	});

	it("grows the delay up to 12 hours", () => {
		expect(retryDelay(1)).toBe(30);
		expect(retryDelay(2)).toBe(60);
		expect(retryDelay(3)).toBe(120);
		expect(retryDelay(40)).toBe(12 * 60 * 60);
	});

	it("doesn't let one team failing hold another's message", async () => {
		teams({ [HAMBURG]: 200, [EUROPE]: "down" });
		const result = await run(batch(["europe", "hamburg"]));
		expect(result.explicitAcks).toEqual(["m1"]);
		expect(result.retryMessages.map((m) => m.msgId)).toEqual(["m0"]);
	});

	it("acks a message for a team that left TEAMS, without a request", async () => {
		const calls = teams({});
		const result = await run(batch(["paris"]));
		expect(calls).toEqual([]);
		expect(result.explicitAcks).toEqual(["m0"]);
	});

	it("logs only the team, status and attempt", async () => {
		teams({ [HAMBURG]: 200, [EUROPE]: 500 });
		const log = vi.spyOn(console, "log");
		await run(batch(["hamburg", "europe"], 2));
		expect(log.mock.calls.map((c) => c.join(" ")).sort()).toEqual([
			"forward team=europe status=500 attempt=2",
			"forward team=hamburg status=200 attempt=2",
		]);
	});
});
