import {
	createExecutionContext,
	waitOnExecutionContext,
} from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { copyStub } from "../../gateway/copy";
import type { ForwardMessage } from "../../gateway/index";
import { type GatewayEnv, gatewayFetch } from "../../gateway/index";
import {
	captureForwards,
	gatewayEnv,
	resetCopy,
	stravaEvent,
	VERIFY_TOKEN,
} from "./support";

// Feature 046 contracts/gateway.md › Events: which teams an event goes to, the
// trial's marks, the fallbacks (US1, US2, US5) and the gateway's day counts.

const TEAMS = ["hamburg", "europe"];
const RIDER = "990001";
const GUEST = "990002";
const UNKNOWN = "990003";

function withMode(mode: string, env: GatewayEnv = gatewayEnv): GatewayEnv {
	return { ...env, ROUTING: mode };
}

async function send(
	env: GatewayEnv,
	ownerId = RIDER,
	overrides: Record<string, unknown> = {},
) {
	const from = forwards.length;
	const ctx = createExecutionContext();
	const body = stravaEvent(overrides).replace(
		'"owner_id":990001',
		`"owner_id":${ownerId}`,
	);
	const res = await gatewayFetch(
		new Request(`https://gateway.example.test/strava/webhook/${VERIFY_TOKEN}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body,
		}),
		env,
		ctx,
	);
	await waitOnExecutionContext(ctx);
	expect(res.status).toBe(200);
	return forwards.slice(from).map((m) => ({ team: m.team, chosen: m.chosen }));
}

/** Gateway-wide counts of today, by figure. */
async function counts(): Promise<Record<string, number>> {
	const all = await copyStub(gatewayEnv).exchange(
		"hamburg",
		[],
		new Date().toISOString().slice(0, 10),
		TEAMS,
	);
	return Object.fromEntries(
		all.filter((c) => c.team === "").map((c) => [c.figure, c.count]),
	);
}

const now = () => Math.floor(Date.now() / 1000);
let forwards: ForwardMessage[] = [];

beforeEach(async () => {
	forwards = captureForwards();
	await resetCopy();
	const copy = copyStub(gatewayEnv);
	// Hamburg holds the rider, both hold the guest; both teams route.
	await copy.replaceList("hamburg", [RIDER, GUEST], now(), TEAMS);
	await copy.replaceList("europe", [GUEST], now(), TEAMS);
	await resetCounts();
});

async function resetCounts() {
	const { runInDurableObject } = await import("cloudflare:test");
	await runInDurableObject(copyStub(gatewayEnv), (_i, state) => {
		state.storage.sql.exec("DELETE FROM counts");
	});
}

describe("off", () => {
	it("sends to every team, unmarked, and counts nothing", async () => {
		expect(await send(withMode("off"))).toEqual([
			{ team: "hamburg", chosen: undefined },
			{ team: "europe", chosen: undefined },
		]);
		expect(await send(gatewayEnv)).toHaveLength(2);
		expect(await counts()).toEqual({});
	});
});

describe("on (US1)", () => {
	it("sends a rider's event to their team only", async () => {
		expect(await send(withMode("on"))).toEqual([
			{ team: "hamburg", chosen: undefined },
		]);
		expect(await counts()).toEqual({ copy: 1, allRouting: 1 });
	});

	it("sends a guest's event to both teams that hold them", async () => {
		expect((await send(withMode("on"), GUEST)).map((m) => m.team)).toEqual(
			TEAMS,
		);
	});

	it("sends a deauthorization to the teams that hold the person", async () => {
		const sent = await send(withMode("on"), RIDER, {
			object_type: "athlete",
			object_id: Number(RIDER),
			aspect_type: "update",
			updates: { authorized: "false" },
		});
		expect(sent.map((m) => m.team)).toEqual(["hamburg"]);
	});
});

describe("fallbacks (US2)", () => {
	it("sends an athlete the copy doesn't list to every team", async () => {
		expect((await send(withMode("on"), UNKNOWN)).map((m) => m.team)).toEqual(
			TEAMS,
		);
		expect(await counts()).toEqual({
			everyone: 1,
			allRouting: 1,
			allRoutingEveryone: 1,
		});
	});

	it("adds a team that never sent a full list", async () => {
		await resetCopy();
		await copyStub(gatewayEnv).replaceList("hamburg", [RIDER], now(), TEAMS);
		expect((await send(withMode("on"))).map((m) => m.team)).toEqual(TEAMS);
		expect(await counts()).toEqual({ copy: 1 });
	});

	it("adds a team whose last list is older than 48 hours", async () => {
		await copyStub(gatewayEnv).replaceList(
			"europe",
			[GUEST],
			now() - 48 * 3600 - 60,
			TEAMS,
		);
		expect((await send(withMode("on"))).map((m) => m.team)).toEqual(TEAMS);
	});

	it("sends to every team when the copy can't be read", async () => {
		const broken = {
			...gatewayEnv,
			ROUTING: "on",
			ROUTING_COPY: {
				idFromName: () => ({}),
				get: () => ({
					lookup: () => Promise.reject(new Error("storage down")),
					count: () => Promise.reject(new Error("storage down")),
				}),
			},
		} as unknown as GatewayEnv;
		expect((await send(broken)).map((m) => m.team)).toEqual(TEAMS);
	});

	it("sends to every team when the copy is too slow", async () => {
		const slow = {
			...gatewayEnv,
			ROUTING: "on",
			ROUTING_COPY: {
				idFromName: () => ({}),
				get: () => ({
					lookup: () => new Promise(() => {}),
					count: async () => {},
				}),
			},
		} as unknown as GatewayEnv;
		const started = Date.now();
		expect((await send(slow)).map((m) => m.team)).toEqual(TEAMS);
		expect(Date.now() - started).toBeLessThan(2_000);
	});
});

describe("trial (US5)", () => {
	it("sends to every team, marked chosen or not", async () => {
		expect(await send(withMode("trial"))).toEqual([
			{ team: "hamburg", chosen: true },
			{ team: "europe", chosen: false },
		]);
		expect(await counts()).toEqual({ copy: 1, allRouting: 1 });
	});

	it("marks every team chosen for an athlete the copy doesn't list", async () => {
		expect(await send(withMode("trial"), UNKNOWN)).toEqual([
			{ team: "hamburg", chosen: true },
			{ team: "europe", chosen: true },
		]);
	});
});

it("logs no athlete", async () => {
	const log = vi.spyOn(console, "log");
	const error = vi.spyOn(console, "error");
	const seen: unknown[] = [];
	log.mockImplementation((...args) => seen.push(...args));
	error.mockImplementation((...args) => seen.push(...args));
	await gatewayFetch(
		new Request(`https://gateway.example.test/strava/webhook/${VERIFY_TOKEN}`, {
			method: "POST",
			body: stravaEvent(),
		}),
		withMode("on"),
		createExecutionContext(),
	);
	expect(JSON.stringify(seen)).not.toContain(RIDER);
});
