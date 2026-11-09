import { createMessageBatch } from "cloudflare:test";
import { describe, expect, it, vi } from "vitest";
import {
	type ForwardMessage,
	type GatewayEnv,
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

/**
 * Runs the consumer and records what it did with each message. By default no
 * team has a service binding, so every team is fetched by its origin.
 */
async function run(
	b: MessageBatch<ForwardMessage>,
	env: GatewayEnv = { ...gatewayEnv, TEAM_SERVICE_HAMBURG: undefined },
) {
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
	await gatewayQueue(b, env);
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

	it("calls a team with a service binding through it, not by its origin", async () => {
		const calls = teams({ [EUROPE]: 200 });
		const viaService: { url: string; body: string; method: string }[] = [];
		const service = {
			fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
				const req = new Request(input, init);
				viaService.push({
					url: req.url,
					body: await req.text(),
					method: req.method,
				});
				return new Response("ok", { status: 200 });
			},
		} as unknown as Fetcher;
		const result = await run(batch(["hamburg", "europe"]), {
			...gatewayEnv,
			TEAM_SERVICE_HAMBURG: service,
		});
		expect(viaService).toEqual([
			{
				url: `${HAMBURG}/strava/webhook/${HAMBURG_TOKEN}`,
				body: BODY,
				method: "POST",
			},
		]);
		expect(calls.map((c) => c.url)).toEqual([
			`${EUROPE}/strava/webhook/${EUROPE_TOKEN}`,
		]);
		expect(result.explicitAcks.sort()).toEqual(["m0", "m1"]);
	});

	it("sends a base64 token unchanged, as the team compares it", async () => {
		// Hamburg's handler: the raw path after the prefix must equal its token.
		const token = "a+b/c9Zx0Q==";
		const calls = teams({ [HAMBURG]: 200 });
		await run(batch(["hamburg"]), {
			...gatewayEnv,
			TEAM_SERVICE_HAMBURG: undefined,
			TEAM_WEBHOOK_TOKEN_HAMBURG: token,
		});
		expect(
			calls.map((c) =>
				new URL(c.url).pathname.slice("/strava/webhook/".length),
			),
		).toEqual([token]);
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
