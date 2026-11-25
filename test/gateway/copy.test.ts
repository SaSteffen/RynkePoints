import { beforeEach, describe, expect, it } from "vitest";
import { copyStub } from "../../gateway/copy";
import { gatewayEnv, resetCopy } from "./support";

// Feature 046 data-model.md: the gateway's copy, list dates and day counts in
// the RoutingCopy object.

const NOW = Date.UTC(2026, 10, 23, 12) / 1000;
const TODAY = "2026-11-23";
const TEAMS = ["hamburg", "europe"];
const A = "990001";
const B = "990002";
const C = "9223372036854775807";

const copy = () => copyStub(gatewayEnv);

beforeEach(resetCopy);

describe("reports", () => {
	it("adds and removes one team's entry", async () => {
		await copy().report("hamburg", A, true);
		await copy().report("hamburg", A, true);
		await copy().report("europe", A, true);
		expect((await copy().lookup(A, NOW)).listed.sort()).toEqual([
			"europe",
			"hamburg",
		]);
		await copy().report("hamburg", A, false);
		expect((await copy().lookup(A, NOW)).listed).toEqual(["europe"]);
		await copy().report("europe", A, false);
		expect((await copy().lookup(A, NOW)).listed).toEqual([]);
	});

	it("keeps IDs past 2^53 exact", async () => {
		await copy().report("europe", C, true);
		expect((await copy().lookup(C, NOW)).listed).toEqual(["europe"]);
		expect((await copy().lookup("9223372036854775806", NOW)).listed).toEqual(
			[],
		);
	});
});

describe("full lists", () => {
	it("replace only the sending team's part and set its list date", async () => {
		await copy().report("hamburg", A, true);
		await copy().report("europe", B, true);
		await copy().replaceList("hamburg", [B, C], NOW, TEAMS);
		expect((await copy().lookup(A, NOW)).listed).toEqual([]);
		expect((await copy().lookup(B, NOW)).listed.sort()).toEqual([
			"europe",
			"hamburg",
		]);
		expect((await copy().lookup(C, NOW)).listed).toEqual(["hamburg"]);
		expect((await copy().lookup(A, NOW)).routing).toEqual(["hamburg"]);
	});

	it("counts additions, removals and possible misses", async () => {
		await copy().replaceList("hamburg", [A], NOW, TEAMS);
		// B is listed under europe only: hamburg's list adding them is a
		// possible miss. C is unknown: it went to every team.
		await copy().replaceList("europe", [B], NOW, TEAMS);
		const result = await copy().replaceList("hamburg", [B, C], NOW, TEAMS);
		expect(result).toEqual({ added: 2, removed: 1, possible: 1 });
		const counts = await copy().exchange("hamburg", [], TODAY, TEAMS);
		expect(counts).toEqual(
			expect.arrayContaining([
				{ day: TODAY, team: "hamburg", figure: "added", count: 2 },
				{ day: TODAY, team: "hamburg", figure: "removed", count: 1 },
				{ day: TODAY, team: "hamburg", figure: "possible", count: 1 },
			]),
		);
	});

	it("counts nothing for a team's first list, nor after forget", async () => {
		await copy().report("hamburg", A, true);
		await copy().replaceList("europe", [A, B], NOW, TEAMS);
		const first = await copy().replaceList("hamburg", [A, B, C], NOW, TEAMS);
		expect(first).toEqual({ added: 0, removed: 0, possible: 0 });
		await copy().forget();
		await copy().replaceList("europe", [A], NOW, TEAMS);
		const again = await copy().replaceList("hamburg", [A], NOW, TEAMS);
		expect(again).toEqual({ added: 0, removed: 0, possible: 0 });
		expect(await copy().exchange("hamburg", [], TODAY, TEAMS)).toEqual([]);
	});

	it("routes a team for 48 hours after its list", async () => {
		await copy().replaceList("europe", [], NOW, TEAMS);
		expect((await copy().lookup(A, NOW + 48 * 3600)).routing).toEqual([
			"europe",
		]);
		expect((await copy().lookup(A, NOW + 48 * 3600 + 1)).routing).toEqual([]);
	});

	it("deletes the part of a team that left TEAMS", async () => {
		await copy().report("north", A, true);
		await copy().replaceList("north", [A], NOW, ["north", ...TEAMS]);
		await copy().replaceList("hamburg", [], NOW, TEAMS);
		const found = await copy().lookup(A, NOW);
		expect(found).toEqual({ listed: [], routing: ["hamburg"] });
	});

	it("forget empties the copy and every list date", async () => {
		await copy().replaceList("hamburg", [A], NOW, TEAMS);
		await copy().forget();
		expect(await copy().lookup(A, NOW)).toEqual({ listed: [], routing: [] });
	});
});

describe("counts", () => {
	it("adds up the gateway's figures per day", async () => {
		await copy().count(TODAY, { copy: 1, allRouting: 1 });
		await copy().count(TODAY, { everyone: 1, allRouting: 1 });
		const counts = await copy().exchange("hamburg", [], TODAY, TEAMS);
		expect(counts).toEqual([
			{ day: TODAY, team: "", figure: "allRouting", count: 2 },
			{ day: TODAY, team: "", figure: "copy", count: 1 },
			{ day: TODAY, team: "", figure: "everyone", count: 1 },
		]);
	});

	it("replaces a team's own figures with each exchange and returns every team's", async () => {
		await copy().exchange(
			"europe",
			[{ day: TODAY, figure: "missed", count: 1 }],
			TODAY,
			TEAMS,
		);
		await copy().exchange(
			"europe",
			[{ day: TODAY, figure: "missed", count: 3 }],
			TODAY,
			TEAMS,
		);
		const counts = await copy().exchange(
			"hamburg",
			[{ day: TODAY, figure: "found", count: 2 }],
			TODAY,
			TEAMS,
		);
		expect(counts).toEqual([
			{ day: TODAY, team: "europe", figure: "missed", count: 3 },
			{ day: TODAY, team: "hamburg", figure: "found", count: 2 },
		]);
	});

	it("deletes counts older than 30 days and those of departed teams", async () => {
		await copy().count("2026-10-24", { copy: 5 });
		await copy().count("2026-10-25", { copy: 6 });
		await copy().exchange(
			"north",
			[{ day: TODAY, figure: "dropped", count: 1 }],
			TODAY,
			["north", ...TEAMS],
		);
		const counts = await copy().exchange("hamburg", [], TODAY, TEAMS);
		expect(counts).toEqual([
			{ day: "2026-10-25", team: "", figure: "copy", count: 6 },
		]);
	});
});
