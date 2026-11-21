import { afterEach, describe, expect, it, vi } from "vitest";
import { type GatewayEnv, gatewayFetch } from "../../gateway/index";
import {
	EUROPE,
	EUROPE_TOKEN,
	gatewayEnv,
	HAMBURG,
	HAMBURG_TOKEN,
} from "./support";

// Feature 044 research R4, contracts/one-team.md: a person who rides for one
// team chose to switch to another, which asks the gateway to have every other
// team let them go.

const NORDIC = "https://nordic.example.test";
const NORDIC_TOKEN = "test-nordic-webhook-token";
const PERSON = "990001";

/** Three teams, each reached by its origin. */
const env: GatewayEnv = {
	...gatewayEnv,
	TEAMS: JSON.stringify([
		{ id: "hamburg", origin: HAMBURG },
		{ id: "europe", origin: EUROPE },
		{ id: "nordic", origin: NORDIC },
	]),
	TEAM_WEBHOOK_TOKEN_NORDIC: NORDIC_TOKEN,
	TEAM_SERVICE_HAMBURG: undefined,
	TEAM_SERVICE_EUROPE: undefined,
};

const TOKENS: Record<string, string> = {
	[HAMBURG]: HAMBURG_TOKEN,
	[EUROPE]: EUROPE_TOKEN,
	[NORDIC]: NORDIC_TOKEN,
};

/** Each team answers with `statuses`, by origin; a missing one is unreachable. */
function teamsAnswer(statuses: Record<string, number>, athleteId = PERSON) {
	const asked: string[] = [];
	vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
		const request = new Request(input, init);
		const url = new URL(request.url);
		expect(url.pathname).toBe(`/strava/let-go/${TOKENS[url.origin]}`);
		// Passed on with every digit (feature 042 R3).
		expect(await request.text()).toBe(`{"athleteId":${athleteId}}`);
		asked.push(url.origin);
		const status = statuses[url.origin];
		if (status === undefined) throw new TypeError("unreachable");
		return status === 200
			? Response.json({ letGo: true })
			: new Response("no", { status });
	});
	return asked;
}

function letGo(
	team = "hamburg",
	token: string | null = HAMBURG_TOKEN,
	body: unknown = `{"athleteId":${PERSON}}`,
	teamsEnv: GatewayEnv = env,
) {
	return gatewayFetch(
		new Request(`https://gateway.example.test/teams/${team}/let-go`, {
			method: "POST",
			headers: token ? { Authorization: `Bearer ${token}` } : {},
			body: typeof body === "string" ? body : JSON.stringify(body),
		}),
		teamsEnv,
	);
}

afterEach(() => vi.restoreAllMocks());

describe("POST /teams/<id>/let-go", () => {
	it("has every other team let them go, never the asking one", async () => {
		const asked = teamsAnswer({ [EUROPE]: 200, [NORDIC]: 200 });
		const res = await letGo();
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ letGo: true });
		expect(asked.sort()).toEqual([EUROPE, NORDIC]);
	});

	it("passes an athlete ID past 2^53 on exactly (feature 042)", async () => {
		const large = "9223372036854775807";
		teamsAnswer({ [EUROPE]: 200, [NORDIC]: 200 }, large);
		const res = await letGo("hamburg", HAMBURG_TOKEN, `{"athleteId":${large}}`);
		expect(res.status).toBe(200);
	});

	it("refuses an athlete ID sent as text", async () => {
		const asked = teamsAnswer({});
		const res = await letGo("hamburg", HAMBURG_TOKEN, { athleteId: PERSON });
		expect(res.status).toBe(400);
		expect(asked).toEqual([]);
	});

	it.each([
		["a team that fails", 500],
		["a team that can't be reached", undefined],
	])("answers 503 for %s", async (_, status) => {
		teamsAnswer({
			[EUROPE]: 200,
			...(status === undefined ? {} : { [NORDIC]: status }),
		});
		expect((await letGo()).status).toBe(503);
	});

	it.each([
		["another team's token", "europe", HAMBURG_TOKEN],
		["no token", "hamburg", null],
		["an unknown team", "atlantis", HAMBURG_TOKEN],
	])("refuses %s", async (_, team, token) => {
		const asked = teamsAnswer({});
		expect((await letGo(team, token)).status).toBe(403);
		expect(asked).toEqual([]);
	});

	it("refuses a body without an athlete", async () => {
		const asked = teamsAnswer({});
		expect(
			(await letGo("hamburg", HAMBURG_TOKEN, { athleteId: 0 })).status,
		).toBe(400);
		expect(asked).toEqual([]);
	});

	it("confirms at once when no other team exists", async () => {
		const asked = teamsAnswer({});
		const res = await letGo(
			"hamburg",
			HAMBURG_TOKEN,
			`{"athleteId":${PERSON}}`,
			{
				...env,
				TEAMS: JSON.stringify([{ id: "hamburg", origin: HAMBURG }]),
			},
		);
		expect(await res.json()).toEqual({ letGo: true });
		expect(asked).toEqual([]);
	});

	it("logs a status per team, never the athlete", async () => {
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		teamsAnswer({ [EUROPE]: 200, [NORDIC]: 200 });
		await letGo();
		const lines = log.mock.calls.map((call) => call.join(" "));
		expect(lines.sort()).toEqual([
			"let-go team=europe status=200",
			"let-go team=nordic status=200",
		]);
		expect(lines.join("\n")).not.toContain(String(PERSON));
	});
});
