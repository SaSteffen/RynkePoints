import { describe, expect, it } from "vitest";
import {
	EXAMPLE_REJECTED_RIDE_ID,
	EXAMPLE_SHORT_RIDE_ID,
	exampleRiderView,
	exampleTeam,
} from "../../src/http/tour-example";
import { riderStatus } from "../../src/rynke/pace";
import { CURRENT_RULES } from "../../src/rynke/rules";

// The tour's examples (feature 020 FR-006, FR-013): worked out by the rules
// functions, so what the hints say holds on any day of the season.

const WINDOW = { seasonStart: "2026-09-01", deadline: "2027-06-30" };

const statuses = (today: string) =>
	exampleTeam(WINDOW, today).riders.map((r) =>
		riderStatus(r.balance, CURRENT_RULES, WINDOW, today),
	);

describe("the example rider", () => {
	const rides = exampleRiderView(WINDOW, "2026-11-15").rides;
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
		const { riders } = exampleTeam(WINDOW, "2027-06-29");
		expect(riders.filter((r) => r.balance?.qualified)).toHaveLength(1);
	});

	it("has open requests only from its own riders at its past events", () => {
		const team = exampleTeam(WINDOW, "2027-01-15");
		const ids = new Set(team.listed.map((r) => r.athlete_id));
		for (const request of team.requests) {
			expect(ids.has(request.athlete_id)).toBe(true);
			expect(request.event_date < "2027-01-15").toBe(true);
		}
		expect(team.requests.length).toBeGreaterThan(0);
	});
});
