import { afterEach, describe, expect, it, vi } from "vitest";
import { type GatewayEnv, gatewayFetch } from "../../gateway/index";
import {
	EUROPE,
	EUROPE_TOKEN,
	gatewayEnv,
	HAMBURG,
	HAMBURG_TOKEN,
} from "./support";

// Feature 041 research R14, contracts/withdrawal.md: a team about to withdraw
// a grant asks the gateway whether any other team holds the person.

const NORDIC = "https://nordic.example.test";
const NORDIC_TOKEN = "test-nordic-webhook-token";

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

/**
 * Each team answers from `answers`, by origin; a missing one fails. A string
 * is `held` alone, an object the whole answer (feature 044 R2).
 */
function teamsAnswer(
	answers: Record<string, string | number | object>,
	athleteId = "990001",
) {
	const asked: string[] = [];
	vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
		const request = new Request(input, init);
		const url = new URL(request.url);
		expect(url.pathname).toBe(`/strava/held/${TOKENS[url.origin]}`);
		// A number with every digit, as before (feature 042 research R3).
		expect(await request.text()).toBe(`{"athleteId":${athleteId}}`);
		asked.push(url.origin);
		const answer = answers[url.origin];
		if (typeof answer === "number")
			return new Response("no", { status: answer });
		if (answer === undefined) throw new TypeError("unreachable");
		return Response.json(
			typeof answer === "object" ? answer : { held: answer },
		);
	});
	return asked;
}

function ask(
	team = "hamburg",
	token: string | null = HAMBURG_TOKEN,
	body: unknown = { athleteId: 990001 },
) {
	return gatewayFetch(
		new Request(`https://gateway.example.test/teams/${team}/held`, {
			method: "POST",
			headers: token ? { Authorization: `Bearer ${token}` } : {},
			body: typeof body === "string" ? body : JSON.stringify(body),
		}),
		env,
	);
}

afterEach(() => vi.restoreAllMocks());

describe("POST /teams/<id>/held", () => {
	it("asks every other team, never the asking one", async () => {
		const asked = teamsAnswer({ [EUROPE]: "none", [NORDIC]: "none" });
		const res = await ask();
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ held: "none", rider: false });
		expect(asked.sort()).toEqual([EUROPE, NORDIC]);
	});

	it.each([
		["reconnect", "none", "reconnect"],
		["connected", "reconnect", "connected"],
		["none", "connected", "connected"],
	])("answers the strongest of %s and %s: %s", async (a, b, held) => {
		teamsAnswer({ [EUROPE]: a, [NORDIC]: b });
		expect(await (await ask()).json()).toEqual({ held, rider: false });
	});

	// Feature 044 R2: whether another team holds them as a rider, not a guest.
	it("answers rider when any other team holds them as a rider", async () => {
		teamsAnswer({
			[EUROPE]: { held: "connected", rider: false },
			[NORDIC]: { held: "reconnect", rider: true },
		});
		expect(await (await ask()).json()).toEqual({
			held: "connected",
			rider: true,
		});
	});

	it.each([
		["without rider", { held: "connected" }],
		["with a rider that isn't a boolean", { held: "connected", rider: "yes" }],
	])("counts an answer %s as no rider", async (_, answer) => {
		teamsAnswer({ [EUROPE]: answer, [NORDIC]: "none" });
		expect(await (await ask()).json()).toEqual({
			held: "connected",
			rider: false,
		});
	});

	it.each([
		["a team that fails", 500],
		["a team that can't be reached", undefined],
		["a team with a nonsense answer", "maybe"],
	])("answers 503 for %s", async (_, answer) => {
		teamsAnswer({
			[EUROPE]: "none",
			...(answer === undefined ? {} : { [NORDIC]: answer }),
		});
		expect((await ask()).status).toBe(503);
	});

	it.each([
		["another team's token", "europe", HAMBURG_TOKEN],
		["no token", "hamburg", null],
		["an unknown team", "atlantis", HAMBURG_TOKEN],
	])("refuses %s", async (_, team, token) => {
		const asked = teamsAnswer({});
		expect((await ask(team, token)).status).toBe(403);
		expect(asked).toEqual([]);
	});

	it("asks about an athlete ID past 2^53 exactly (feature 042)", async () => {
		const large = "9223372036854775807";
		const asked = teamsAnswer(
			{ [EUROPE]: "none", [NORDIC]: "connected" },
			large,
		);
		const res = await ask("hamburg", HAMBURG_TOKEN, `{"athleteId":${large}}`);
		expect(await res.json()).toEqual({ held: "connected" });
		expect(asked.sort()).toEqual([EUROPE, NORDIC]);
	});

	it("refuses an athlete ID sent as text", async () => {
		const asked = teamsAnswer({});
		expect(
			(await ask("hamburg", HAMBURG_TOKEN, { athleteId: "990001" })).status,
		).toBe(400);
		expect(asked).toEqual([]);
	});

	it("refuses a body without an athlete", async () => {
		const asked = teamsAnswer({});
		expect(
			(await ask("hamburg", HAMBURG_TOKEN, { athleteId: -1 })).status,
		).toBe(400);
		expect(asked).toEqual([]);
	});

	it("answers none when no other team exists", async () => {
		const asked = teamsAnswer({});
		const res = await gatewayFetch(
			new Request("https://gateway.example.test/teams/hamburg/held", {
				method: "POST",
				headers: { Authorization: `Bearer ${HAMBURG_TOKEN}` },
				body: JSON.stringify({ athleteId: 990001 }),
			}),
			{ ...env, TEAMS: JSON.stringify([{ id: "hamburg", origin: HAMBURG }]) },
		);
		expect(await res.json()).toEqual({ held: "none", rider: false });
		expect(asked).toEqual([]);
	});
});
