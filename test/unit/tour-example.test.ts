import { describe, expect, it } from "vitest";
import {
	EXAMPLE_REJECTED_RIDE_ID,
	EXAMPLE_SHORT_RIDE_ID,
	exampleRiderView,
	exampleTeam,
} from "../../src/http/tour-example";
import { riderStatus } from "../../src/rynke/pace";
import { currentRules } from "../../src/rynke/rules";
import { europe } from "../../src/teams/europe";
import { hamburg } from "../../src/teams/hamburg";
import { CURRENT_RULES } from "../support/team-rules";

// The tour's examples (feature 020 FR-006, FR-013): worked out by the rules
// functions, so what the hints say holds on any day of the season.

const WINDOW = {
	seasonStart: "2026-09-01",
	windowStart: "2026-09-01",
	deadline: "2027-06-30",
};

const statuses = (today: string) =>
	exampleTeam(WINDOW, today, CURRENT_RULES).riders.map((r) =>
		riderStatus(r.balance, CURRENT_RULES, WINDOW, today),
	);

describe("the example rider", () => {
	const rides = exampleRiderView(WINDOW, "2026-11-15", CURRENT_RULES).rides;
	const result = (id: number) => rides.find((r) => r.activityId === id)?.result;

	it("has a short ride that counts with no distance Rynke", () => {
		expect(result(EXAMPLE_SHORT_RIDE_ID)).toMatchObject({
			counts: true,
			distanceRynke: 0,
		});
	});

	it("has a ride that doesn't count for its pause alone (FR-006)", () => {
		expect(result(EXAMPLE_REJECTED_RIDE_ID)).toMatchObject({
			counts: false,
			reasons: ["pause"],
		});
	});
});

describe("the example team", () => {
	it("has riders in every group mid-season", () => {
		expect(new Set(statuses("2027-01-15"))).toEqual(
			new Set(["push", "on_track", "in"]),
		);
	});

	it("has nobody behind on the first day, when the even pace is 0", () => {
		expect(statuses("2026-09-01")).not.toContain("push");
	});

	it("has exactly one qualified rider, even near the deadline", () => {
		const { riders } = exampleTeam(WINDOW, "2027-06-29", CURRENT_RULES);
		expect(riders.filter((r) => r.balance?.qualified)).toHaveLength(1);
	});

	it("has open requests only from its own riders at its past events", () => {
		const team = exampleTeam(WINDOW, "2027-01-15", CURRENT_RULES);
		const ids = new Set(team.listed.map((r) => r.athlete_id));
		for (const request of team.requests) {
			expect(ids.has(request.athlete_id)).toBe(true);
			expect(request.event_date < "2027-01-15").toBe(true);
		}
		expect(team.requests.length).toBeGreaterThan(0);
	});
});

describe("the example team's rides (FR-013)", () => {
	const TODAY = "2027-02-10";
	const team = exampleTeam(WINDOW, TODAY, CURRENT_RULES);
	const stepM = CURRENT_RULES.distanceStepKm * 1000;

	it("earn each rider's distance Rynke and climb its elevation", () => {
		for (const rider of team.riders) {
			const rides = team.rides.get(rider.athleteId) ?? [];
			const earned = rides.reduce(
				(sum, [, distanceM]) =>
					sum + Math.floor(distanceM / stepM) * CURRENT_RULES.distanceStepRynke,
				0,
			);
			expect(earned).toBe(rider.balance?.distanceRynke);
			if (rides.length > 0) {
				expect(rides.reduce((sum, [, , dm]) => sum + dm, 0)).toBe(
					rider.balance?.elevationDm,
				);
			}
		}
	});

	it("lie between the season start and today, oldest first", () => {
		for (const rides of team.rides.values()) {
			const dates = rides.map(([date]) => date);
			expect(dates).toEqual([...dates].sort());
			for (const date of dates) {
				expect(date >= WINDOW.seasonStart && date <= TODAY).toBe(true);
			}
		}
	});

	it("are the graphs' daily figures, with the virtual part apart", () => {
		for (const row of team.graphRows) {
			const rides = team.rides.get(row.athleteId) ?? [];
			const total = rides.reduce((sum, [, m]) => sum + m, 0);
			expect(row.days.reduce((sum, [, m]) => sum + m, 0)).toBe(total);
			const virtual = row.virtualDays.reduce((sum, [, m]) => sum + m, 0);
			if (total > 0) expect(virtual).toBeLessThan(total);
		}
		// Finn rides mostly indoors.
		const finn = team.graphRows.find((r) => r.athleteId === 6);
		expect(finn?.virtualDays.length).toBeGreaterThan(0);
	});
});

describe("the examples without Team Rynke and events (feature 039)", () => {
	const rules = currentRules(europe.rules);
	const TODAY = "2027-01-15";

	it("gives the example rider no Team Rynke and no events", () => {
		const read = exampleRiderView(WINDOW, TODAY, rules);
		expect(read.attendance).toEqual([]);
		expect(read.progress?.attendance).toEqual([]);
		expect(read.balance?.teamRynke).toBe(0);
		expect(read.balance?.teamEvents.every((k) => k.attended === 0)).toBe(true);
	});

	it("gives the example team no Team Rynke, events or requests", () => {
		const team = exampleTeam(WINDOW, TODAY, rules);
		expect(team.events).toEqual([]);
		expect(team.requests).toEqual([]);
		expect(team.intents.size).toBe(0);
		expect(team.attended.size).toBe(0);
		for (const rider of team.riders) {
			expect(rider.balance?.teamRynke).toBe(0);
			expect(Number.isFinite(rider.balance?.trainingRynke)).toBe(true);
		}
		// Still one qualified rider, on Training Rynke and the outdoor share.
		expect(team.riders.filter((r) => r.balance?.qualified)).toHaveLength(1);
	});

	it("keeps Hamburg's Team Rynke and events", () => {
		const hamburgRules = currentRules(hamburg.rules);
		expect(
			exampleRiderView(WINDOW, TODAY, hamburgRules).attendance,
		).not.toEqual([]);
		const team = exampleTeam(WINDOW, TODAY, hamburgRules);
		expect(team.events.length).toBeGreaterThan(0);
		expect(team.riders.some((r) => (r.balance?.teamRynke ?? 0) > 0)).toBe(true);
	});
});
