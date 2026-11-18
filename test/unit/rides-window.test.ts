import { describe, expect, it } from "vitest";
import {
	evaluateRides,
	isPreWindow,
	type Ride,
	type RideResult,
} from "../../src/rynke/rides";
import type { CountingWindow } from "../../src/rynke/rules";
import { makeRide } from "../support/rides";
import { CURRENT_RULES } from "../support/team-rules";

// Pre-window rides (feature 040 US3, research R3): dated in the season but
// before the qualification window opens, they count for no Rynke, keep their
// real elevation for the badges and take part in overlap resolution.

const EUROPE: CountingWindow = {
	seasonStart: "2026-09-01",
	windowStart: "2027-01-01",
	deadline: "2027-06-30",
};

/** Europe's minimum ride length, so a short ride fails a second rule. */
const RULES = { ...CURRENT_RULES, minRideKm: 25 };

const at = (date: string, time = "08:00:00") => `${date}T${time}Z`;

function evaluate(rides: Ride[]) {
	return evaluateRides(rides, RULES, EUROPE);
}

function resultFor(results: RideResult[], id: number): RideResult {
	const result = results.find((r) => r.activityId === id);
	if (!result) throw new Error(`no result for ${id}`);
	return result;
}

describe("evaluateRides before the window opens (040 US3)", () => {
	it("marks a ride meeting every rule as pre-window, with its real elevation", () => {
		const { results } = evaluate([
			makeRide({
				id: 1,
				km: 60,
				movingH: 2.5,
				elevationM: 400,
				start: at("2026-11-15"),
			}),
		]);
		expect(resultFor(results, 1)).toMatchObject({
			counts: false,
			reasons: ["before_window"],
			distanceRynke: 0,
			elevationDm: 4000,
		});
		expect(isPreWindow(resultFor(results, 1).reasons)).toBe(true);
	});

	it("lists every other reason too, and then keeps no elevation (FR-013)", () => {
		const { results } = evaluate([
			makeRide({
				id: 1,
				km: 5,
				movingH: 0.25,
				elevationM: 30,
				start: at("2026-11-15"),
			}),
		]);
		const result = resultFor(results, 1);
		expect(result.reasons).toEqual(["before_window", "too_short"]);
		expect(result.elevationDm).toBe(0);
		expect(isPreWindow(result.reasons)).toBe(false);
	});

	it("counts from the window's first day", () => {
		const { results } = evaluate([
			makeRide({ id: 1, km: 50, movingH: 2, start: at("2026-12-31") }),
			makeRide({ id: 2, km: 50, movingH: 2, start: at("2027-01-01") }),
		]);
		expect(resultFor(results, 1).reasons).toEqual(["before_window"]);
		expect(resultFor(results, 2)).toMatchObject({
			counts: true,
			reasons: [],
			distanceRynke: 5,
		});
	});

	it("keeps outside_window for before the season and after the deadline", () => {
		const { results } = evaluate([
			makeRide({ id: 1, km: 50, movingH: 2, start: at("2026-08-31") }),
			makeRide({ id: 2, km: 50, movingH: 2, start: at("2027-07-01") }),
		]);
		expect(resultFor(results, 1).reasons).toEqual(["outside_window"]);
		expect(resultFor(results, 2).reasons).toEqual(["outside_window"]);
	});

	it("keeps the larger of two overlapping pre-window rides", () => {
		const { results } = evaluate([
			makeRide({ id: 1, km: 40, movingH: 2, start: at("2026-11-15") }),
			makeRide({
				id: 2,
				km: 42,
				movingH: 2,
				elevationM: 100,
				start: at("2026-11-15", "08:10:00"),
			}),
		]);
		expect(resultFor(results, 2)).toMatchObject({
			reasons: ["before_window"],
			elevationDm: 1000,
		});
		expect(resultFor(results, 1)).toMatchObject({
			reasons: ["overlap"],
			overlapsActivityId: 2,
			elevationDm: 0,
		});
	});

	it("adds nothing to the riding sums", () => {
		const { riding } = evaluate([
			makeRide({
				id: 1,
				km: 100,
				movingH: 4,
				elevationM: 900,
				start: at("2026-11-15"),
			}),
			makeRide({ id: 2, km: 30, movingH: 1.5, start: at("2027-02-01") }),
		]);
		expect(riding).toEqual({
			distanceRynke: 3,
			elevationDm: 0,
			elevationRynke: 0,
			withoutVirtual: { distanceRynke: 3, elevationDm: 0, elevationRynke: 0 },
		});
	});

	it("never happens when the window opens on the season start (Hamburg)", () => {
		const { results } = evaluateRides(
			[
				makeRide({ id: 1, km: 50, movingH: 2, start: at("2026-08-31") }),
				makeRide({ id: 2, km: 50, movingH: 2, start: at("2026-09-01") }),
			],
			RULES,
			{ ...EUROPE, windowStart: EUROPE.seasonStart },
		);
		expect(resultFor(results, 1).reasons).toEqual(["outside_window"]);
		expect(resultFor(results, 2).counts).toBe(true);
	});
});
