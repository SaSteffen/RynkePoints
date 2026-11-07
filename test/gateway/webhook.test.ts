import { describe, expect, it, vi } from "vitest";
import { gatewayFetch } from "../../gateway/index";
import { parseTeams } from "../../gateway/teams";
import {
	captureForwards,
	gatewayEnv,
	stravaEvent,
	VERIFY_TOKEN,
} from "./support";

// contracts/gateway.md › Routes: the subscription check and the event receiver.

const BASE = "https://gateway.example.test";

function get(path: string): Promise<Response> {
	return gatewayFetch(new Request(`${BASE}${path}`), gatewayEnv);
}

function post(path: string, body: string): Promise<Response> {
	return gatewayFetch(
		new Request(`${BASE}${path}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body,
		}),
		gatewayEnv,
	);
}

function challengePath(pathToken: string, queryToken: string): string {
	const query = new URLSearchParams({
		"hub.mode": "subscribe",
		"hub.challenge": "c-123",
		"hub.verify_token": queryToken,
	});
	return `/strava/webhook/${pathToken}?${query}`;
}

describe("subscription check", () => {
	it("answers the challenge for the right token", async () => {
		const res = await get(challengePath(VERIFY_TOKEN, VERIFY_TOKEN));
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ "hub.challenge": "c-123" });
	});

	it("refuses a wrong token in the path or the query", async () => {
		expect((await get(challengePath("wrong", VERIFY_TOKEN))).status).toBe(403);
		expect((await get(challengePath(VERIFY_TOKEN, "wrong"))).status).toBe(403);
	});

	it("refuses a request that isn't a subscription check", async () => {
		expect((await get(`/strava/webhook/${VERIFY_TOKEN}`)).status).toBe(403);
	});
});

describe("events", () => {
	it("answers 200 after one batch with one message per team", async () => {
		const sent = captureForwards();
		const body = stravaEvent();
		const res = await post(`/strava/webhook/${VERIFY_TOKEN}`, body);
		expect(res.status).toBe(200);
		expect(gatewayEnv.FORWARD_QUEUE.sendBatch).toHaveBeenCalledTimes(1);
		expect(sent).toEqual(
			parseTeams(gatewayEnv.TEAMS).map((team) => ({ team: team.id, body })),
		);
		expect(sent.map((m) => m.team)).toEqual(["hamburg", "europe"]);
	});

	it("gives 400 for a body that isn't a Strava event", async () => {
		const sent = captureForwards();
		for (const body of [
			"",
			"not json",
			"[]",
			JSON.stringify({ hello: "world" }),
			stravaEvent({ owner_id: "990001" }),
			stravaEvent({ padding: "x".repeat(5000) }),
		]) {
			expect((await post(`/strava/webhook/${VERIFY_TOKEN}`, body)).status).toBe(
				400,
			);
		}
		expect(sent).toEqual([]);
	});

	it("gives 403 for a wrong token and queues nothing", async () => {
		const sent = captureForwards();
		const res = await post("/strava/webhook/wrong", stravaEvent());
		expect(res.status).toBe(403);
		expect(sent).toEqual([]);
	});

	it("logs nothing about the event", async () => {
		captureForwards();
		const log = vi.spyOn(console, "log");
		const error = vi.spyOn(console, "error");
		await post(`/strava/webhook/${VERIFY_TOKEN}`, stravaEvent());
		await post("/strava/webhook/wrong", stravaEvent());
		await post(`/strava/webhook/${VERIFY_TOKEN}`, "junk");
		expect([...log.mock.calls, ...error.mock.calls]).toEqual([]);
	});
});

describe("other routes", () => {
	it("answers /health", async () => {
		const res = await get("/health");
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("ok");
	});

	it("answers 404 for anything else", async () => {
		for (const path of ["/", "/me", "/strava/webhook", "/auth/callback"]) {
			expect((await get(path)).status).toBe(404);
		}
	});
});

describe("TEAMS", () => {
	it("accepts https and local http origins", () => {
		expect(
			parseTeams(
				'[{"id":"hamburg","origin":"https://a.example"},{"id":"europe","origin":"http://europe.localhost:8790"}]',
			),
		).toHaveLength(2);
	});

	it.each([
		["not a list", '{"id":"x"}'],
		[
			"a repeated id",
			'[{"id":"a","origin":"https://a.example"},{"id":"a","origin":"https://b.example"}]',
		],
		["plain http", '[{"id":"a","origin":"http://a.example"}]'],
		["a path", '[{"id":"a","origin":"https://a.example/x"}]'],
		["a bad id", '[{"id":"A b","origin":"https://a.example"}]'],
	])("refuses %s", (_, raw) => {
		expect(() => parseTeams(raw)).toThrow();
	});
});
