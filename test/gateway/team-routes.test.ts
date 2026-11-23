import { beforeEach, describe, expect, it, vi } from "vitest";
import { copyStub } from "../../gateway/copy";
import { type GatewayEnv, gatewayFetch } from "../../gateway/index";
import { EUROPE_TOKEN, gatewayEnv, HAMBURG_TOKEN, resetCopy } from "./support";

// Feature 046 contracts/gateway.md › Team routes: reports, full lists and the
// counts exchange, authenticated like the team question (FR-008).

const A = "990001";
const B = "990002";
const ON = { ...gatewayEnv, ROUTING: "on" } as GatewayEnv;
const TRIAL = { ...gatewayEnv, ROUTING: "trial" } as GatewayEnv;
const OFF = { ...gatewayEnv, ROUTING: "off" } as GatewayEnv;

function post(
	path: string,
	body: unknown,
	env: GatewayEnv = ON,
	token: string | null = HAMBURG_TOKEN,
) {
	return gatewayFetch(
		new Request(`https://gateway.example.test${path}`, {
			method: "POST",
			headers: token ? { Authorization: `Bearer ${token}` } : {},
			body: typeof body === "string" ? body : JSON.stringify(body),
		}),
		env,
	);
}

const now = () => Math.floor(Date.now() / 1000);
const today = () => new Date().toISOString().slice(0, 10);
const listed = async (id: string) =>
	(await copyStub(gatewayEnv).lookup(id, now())).listed;

beforeEach(resetCopy);

describe("authentication", () => {
	it.each(["report", "list", "counts"])(
		"refuses /%s without the team's own token",
		async (route) => {
			const body = { athleteId: A, held: true, athleteIds: [], days: [] };
			expect(
				(await post(`/teams/hamburg/${route}`, body, ON, null)).status,
			).toBe(403);
			expect(
				(await post(`/teams/hamburg/${route}`, body, ON, EUROPE_TOKEN)).status,
			).toBe(403);
			expect(
				(await post(`/teams/nordic/${route}`, body, ON, HAMBURG_TOKEN)).status,
			).toBe(403);
		},
	);

	it("changes only the asking team's part", async () => {
		await copyStub(gatewayEnv).report("europe", A, true);
		await post("/teams/hamburg/report", { athleteId: A, held: false });
		await post("/teams/hamburg/list", { athleteIds: [] });
		expect(await listed(A)).toEqual(["europe"]);
	});
});

describe("POST /teams/<id>/report", () => {
	it("adds and removes the team's entry", async () => {
		const res = await post("/teams/hamburg/report", {
			athleteId: A,
			held: true,
		});
		expect(res.status).toBe(200);
		expect(await listed(A)).toEqual(["hamburg"]);
		await post("/teams/hamburg/report", { athleteId: A, held: false }, TRIAL);
		expect(await listed(A)).toEqual([]);
	});

	it.each([
		["a number", { athleteId: 990001, held: true }],
		["no held", { athleteId: A }],
		["a bad ID", { athleteId: "0123", held: true }],
		["junk", "not json"],
	])("gives 400 for %s", async (_name, body) => {
		expect((await post("/teams/hamburg/report", body)).status).toBe(400);
	});

	it("answers 404 while routing is off and keeps nothing", async () => {
		const res = await post(
			"/teams/hamburg/report",
			{ athleteId: A, held: true },
			OFF,
		);
		expect(res.status).toBe(404);
		expect(await listed(A)).toEqual([]);
	});
});

describe("POST /teams/<id>/list", () => {
	it("replaces the team's part and starts it routing", async () => {
		await post("/teams/hamburg/report", { athleteId: A, held: true });
		const res = await post("/teams/hamburg/list", { athleteIds: [B, B] });
		expect(res.status).toBe(200);
		expect(await listed(A)).toEqual([]);
		expect(await listed(B)).toEqual(["hamburg"]);
		expect((await copyStub(gatewayEnv).lookup(B, now())).routing).toEqual([
			"hamburg",
		]);
	});

	it.each([
		["no list", {}],
		["a number", { athleteIds: [990001] }],
		[
			"more than 999",
			{ athleteIds: Array.from({ length: 1000 }, (_, i) => String(i + 1)) },
		],
	])("gives 400 for %s", async (_name, body) => {
		expect((await post("/teams/hamburg/list", body)).status).toBe(400);
	});

	it("empties the whole copy while routing is off", async () => {
		await copyStub(gatewayEnv).replaceList("europe", [A], now(), [
			"hamburg",
			"europe",
		]);
		const res = await post("/teams/hamburg/list", { athleteIds: [B] }, OFF);
		expect(res.status).toBe(404);
		expect(await copyStub(gatewayEnv).lookup(A, now())).toEqual({
			listed: [],
			routing: [],
		});
		expect(await listed(B)).toEqual([]);
	});
});

describe("POST /teams/<id>/counts", () => {
	it("takes the team's own counts and answers every count, in every mode", async () => {
		await copyStub(gatewayEnv).count(today(), { copy: 2 });
		await post(
			"/teams/europe/counts",
			{ days: [{ day: today(), figure: "missed", count: 1 }] },
			OFF,
			EUROPE_TOKEN,
		);
		const res = await post(
			"/teams/hamburg/counts",
			{ days: [{ day: today(), figure: "found", count: 3 }] },
			OFF,
		);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			days: [
				{ day: today(), team: "", figure: "copy", count: 2 },
				{ day: today(), team: "europe", figure: "missed", count: 1 },
				{ day: today(), team: "hamburg", figure: "found", count: 3 },
			],
		});
	});

	it.each([
		["a gateway figure", { day: "TODAY", figure: "copy", count: 1 }],
		["a negative count", { day: "TODAY", figure: "found", count: -1 }],
		["a day too old", { day: "2020-01-01", figure: "found", count: 1 }],
	])("gives 400 for %s", async (_name, entry) => {
		const day = entry.day === "TODAY" ? today() : entry.day;
		const res = await post("/teams/hamburg/counts", {
			days: [{ ...entry, day }],
		});
		expect(res.status).toBe(400);
	});
});

it("logs no athlete", async () => {
	const seen: unknown[] = [];
	vi.spyOn(console, "log").mockImplementation((...a) => seen.push(...a));
	vi.spyOn(console, "error").mockImplementation((...a) => seen.push(...a));
	await post("/teams/hamburg/report", { athleteId: A, held: true });
	await post("/teams/hamburg/list", { athleteIds: [A] });
	expect(JSON.stringify(seen)).not.toContain(A);
});
