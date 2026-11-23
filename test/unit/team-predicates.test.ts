import { describe, expect, it } from "vitest";
import type { RynkeRules } from "../../src/rynke/rules";
import { hasEvents, hasTeamRynke } from "../../src/teams";
import type { TeamData } from "../../src/teams/types";
import { hamburg } from "../../teams/hamburg/team";

// Whether a team has Team Rynke and events (feature 039 contracts/team-data.md):
// code asks only these two, never the team's id. Synthetic teams are built
// from the founding team's data.

/** The founding team with `changes` to its rules in effect. */
function withCurrentRules(changes: Record<string, unknown>): TeamData {
	const latest = hamburg.rules.at(-1) as RynkeRules;
	const changed = { ...latest, ...changes } as unknown as RynkeRules;
	return { ...hamburg, rules: [...hamburg.rules.slice(0, -1), changed] };
}

describe("hasTeamRynke", () => {
	it("is true for the founding team", () => {
		expect(hasTeamRynke(hamburg)).toBe(true);
	});

	it("is true while the rules in effect have a Team threshold", () => {
		expect(hasTeamRynke(withCurrentRules({ teamThreshold: 10 }))).toBe(true);
	});

	it("is false when the rules in effect have none", () => {
		expect(hasTeamRynke(withCurrentRules({ teamThreshold: null }))).toBe(false);
	});

	it("follows only the rules in effect, not an earlier version", () => {
		const first = hamburg.rules[0] as RynkeRules;
		const team: TeamData = {
			...hamburg,
			rules: [
				{ ...first, teamThreshold: null } as unknown as RynkeRules,
				...hamburg.rules.slice(1),
			],
		};
		expect(hasTeamRynke(team)).toBe(true);
	});
});

describe("hasEvents", () => {
	it("is true for the founding team's event kinds", () => {
		expect(hasEvents(hamburg)).toBe(true);
	});

	it("is false without event kinds", () => {
		expect(hasEvents({ ...hamburg, eventKinds: [] })).toBe(false);
	});
});
