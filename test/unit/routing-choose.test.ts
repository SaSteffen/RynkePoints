import { describe, expect, it } from "vitest";
import {
	chooseTeams,
	isRouting,
	LIST_MAX_AGE_SECONDS,
	routingMode,
} from "../../gateway/routing";
import { firstRoutingDay, isRoutingDay } from "../../src/routing/figures";

// Feature 046 research R2, R4: the gateway's mode and which teams an event goes to.

const ALL = ["hamburg", "europe", "north"];

describe("routingMode", () => {
	it("reads off, trial and on", () => {
		expect(routingMode("off")).toBe("off");
		expect(routingMode("trial")).toBe("trial");
		expect(routingMode("on")).toBe("on");
	});

	it("takes anything else for off", () => {
		for (const raw of [undefined, "", "ON", "yes", " on"]) {
			expect(routingMode(raw)).toBe("off");
		}
	});
});

describe("isRouting", () => {
	const NOW = 1_800_000_000;

	it("routes while the last full list is at most 48 hours old", () => {
		expect(isRouting(NOW, NOW)).toBe(true);
		expect(isRouting(NOW - LIST_MAX_AGE_SECONDS, NOW)).toBe(true);
		expect(isRouting(NOW - LIST_MAX_AGE_SECONDS - 1, NOW)).toBe(false);
	});

	it("doesn't route before a first list", () => {
		expect(isRouting(undefined, NOW)).toBe(false);
	});
});

describe("chooseTeams", () => {
	it("sends to the one team that holds the athlete when every team routes", () => {
		expect(chooseTeams(ALL, ["europe"], ALL)).toEqual({
			teams: ["europe"],
			by: "copy",
			allRouting: true,
		});
	});

	it("sends a guest's event to both teams that hold them", () => {
		expect(chooseTeams(ALL, ["hamburg", "europe"], ALL).teams).toEqual([
			"hamburg",
			"europe",
		]);
	});

	it("adds every team that isn't routing", () => {
		expect(chooseTeams(ALL, ["europe"], ["europe", "hamburg"])).toEqual({
			teams: ["europe", "north"],
			by: "copy",
			allRouting: false,
		});
	});

	it("sends to every team when the copy lists none of the teams", () => {
		expect(chooseTeams(ALL, [], ALL)).toEqual({
			teams: ALL,
			by: "everyone",
			allRouting: true,
		});
		// A team that left TEAMS doesn't count.
		expect(chooseTeams(ALL, ["gone"], ALL).by).toBe("everyone");
	});

	it("sends to every team when the copy couldn't be read", () => {
		expect(chooseTeams(ALL, null, null)).toEqual({
			teams: ALL,
			by: "everyone",
			allRouting: true,
		});
	});

	it("keeps the order of TEAMS", () => {
		expect(chooseTeams(ALL, ["north", "hamburg"], ALL).teams).toEqual([
			"hamburg",
			"north",
		]);
	});
});

describe("routing days", () => {
	it("keeps 30 days, today included", () => {
		expect(firstRoutingDay("2026-11-23")).toBe("2026-10-25");
		expect(isRoutingDay("2026-10-25", "2026-11-23")).toBe(true);
		expect(isRoutingDay("2026-10-24", "2026-11-23")).toBe(false);
		expect(isRoutingDay("2026-11-24", "2026-11-23")).toBe(false);
		expect(isRoutingDay("2026-13-01", "2026-11-23")).toBe(false);
		expect(isRoutingDay(20261101, "2026-11-23")).toBe(false);
	});
});
