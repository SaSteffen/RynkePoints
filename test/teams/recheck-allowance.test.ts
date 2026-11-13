import { describe, expect, it } from "vitest";
import {
	RECHECK_READS as SCRIPT_RECHECK_READS,
	teamProblems,
} from "../../scripts/team-check.mjs";
import { TEAMS } from "../../src/teams";
import {
	RECHECK_READS,
	RECHECK_SHARE,
	STRAVA_READ_DAILY_LIMIT,
} from "../../src/usage/allowances";

// Each team's ride re-checks a day are team data, and all teams' together stay
// within 10% of the app's daily Strava reads (feature 036 FR-008, research R10).

describe("recheckAllowance", () => {
	it("is a positive whole number for every team", () => {
		for (const team of TEAMS) {
			expect(Number.isInteger(team.recheckAllowance), team.id).toBe(true);
			expect(team.recheckAllowance, team.id).toBeGreaterThan(0);
		}
	});

	it("adds up to at most 10% of the daily reads", () => {
		expect(RECHECK_READS).toBe(
			Math.floor(STRAVA_READ_DAILY_LIMIT * RECHECK_SHARE),
		);
		expect(RECHECK_READS).toBe(300);
		const sum = TEAMS.reduce((s, team) => s + team.recheckAllowance, 0);
		expect(sum).toBeLessThanOrEqual(RECHECK_READS);
	});

	it("is checked by team-check against the same limit", () => {
		expect(SCRIPT_RECHECK_READS).toBe(RECHECK_READS);
		const withAllowances = (...allowances: number[]) =>
			allowances.map((recheckAllowance, i) => ({
				id: `team${"abc"[i]}`,
				recheckAllowance,
			}));
		const sumProblems = (teams: unknown[]) =>
			teamProblems(
				teams,
				{ env: {} },
				{ locales: [], publicFile: () => true },
			).filter((p) => p.includes("recheckAllowance"));
		expect(sumProblems(withAllowances(150, 150))).toEqual([]);
		expect(sumProblems(withAllowances(150, 151))).toEqual([
			"teams teama, teamb: recheckAllowance: 301 together, more than 300",
		]);
		expect(sumProblems(withAllowances(0, 10))).toEqual([
			"team teama: recheckAllowance: not a positive whole number",
		]);
	});
});
