import { describe, expect, it } from "vitest";
import { CURRENT_RULES } from "../../src/rynke/rules";
import type { Balance } from "../../src/rynke/tally";
import { NO_EXTRAS } from "../../src/rynke/tally";
import {
	type DailyInputs,
	lastDay,
	type RiderInputs,
	riderDays,
	riderWeeks,
	weekEnds,
} from "../../src/rynke/weeks";

// Each rider's Rynke at the end of every week (016 research R1, R3). Synthetic
// figures only.

const SEASON_START = "2026-01-01"; // a Thursday
const WINDOW = { seasonStart: SEASON_START, deadline: "2027-06-30" };

const NO_INPUTS: RiderInputs = { rides: [], attendance: [], corrections: [] };

function balance(overrides: Partial<Balance> = {}): Balance {
	return {
		distanceRynke: 0,
		elevationDm: 0,
		elevationRynke: 0,
		elevationToNextStepDm: 10000,
		trainingRynke: 0,
		teamRynke: 0,
		trainingMissing: 250,
		teamMissing: 25,
		trainingWithoutVirtual: 0,
		virtualShareMissing: 167,
		qualified: false,
		rulesVersion: CURRENT_RULES.version,
		rulesEffectiveDate: CURRENT_RULES.effectiveDate,
		teamEvents: [...NO_EXTRAS.teamEvents],
		...overrides,
	};
}

describe("weekEnds", () => {
	it("gives the Sundays from the season start and ends on the last day", () => {
		expect(weekEnds(SEASON_START, "2026-01-21")).toEqual([
			"2026-01-04",
			"2026-01-11",
			"2026-01-18",
			"2026-01-21",
		]);
	});

	it("starts with a short week when the season starts mid-week", () => {
		expect(weekEnds("2026-01-07", "2026-01-12")).toEqual([
			"2026-01-11",
			"2026-01-12",
		]);
	});

	it("ends on the last day when it is a Sunday", () => {
		expect(weekEnds(SEASON_START, "2026-01-11")).toEqual([
			"2026-01-04",
			"2026-01-11",
		]);
	});

	it("gives a single week when the season starts on a Sunday", () => {
		expect(weekEnds("2026-01-04", "2026-01-04")).toEqual(["2026-01-04"]);
	});

	it("gives exactly one week end before the season starts", () => {
		expect(weekEnds(SEASON_START, "2025-12-20")).toEqual(["2025-12-20"]);
	});
});

describe("lastDay", () => {
	it("is today until the deadline has passed", () => {
		expect(lastDay("2026-03-25", "2026-05-31")).toBe("2026-03-25");
		expect(lastDay("2026-05-31", "2026-05-31")).toBe("2026-05-31");
	});

	it("is the deadline once it has passed", () => {
		expect(lastDay("2026-06-02", "2026-05-31")).toBe("2026-05-31");
	});
});

describe("riderWeeks", () => {
	const ENDS = ["2026-01-04", "2026-01-11", "2026-01-18", "2026-01-21"];

	it("accumulates rides per week and floors elevation on the running total", () => {
		const inputs: RiderInputs = {
			...NO_INPUTS,
			rides: [
				{ weekEnd: "2026-01-04", distanceRynke: 3, elevationDm: 6000 },
				{ weekEnd: "2026-01-11", distanceRynke: 4, elevationDm: 6000 },
				{ weekEnd: "2026-01-18", distanceRynke: 2, elevationDm: 0 },
			],
		};
		const weeks = riderWeeks(
			inputs,
			WINDOW,
			ENDS,
			balance({ trainingRynke: 14 }),
		);
		expect(weeks).toEqual([
			{ weekEnd: "2026-01-04", training: 3, team: 0 },
			// 12 000 dm together: one full step of 5 Rynke; per week it would be 0.
			{ weekEnd: "2026-01-11", training: 12, team: 0 },
			{ weekEnd: "2026-01-18", training: 14, team: 0 },
			{ weekEnd: "2026-01-21", training: 14, team: 0 },
		]);
	});

	it("counts attendance from its event date and corrections from their date", () => {
		const inputs: RiderInputs = {
			rides: [{ weekEnd: "2026-01-04", distanceRynke: 10, elevationDm: 0 }],
			attendance: [{ eventId: 1, kind: "team_training", date: "2026-01-08" }],
			corrections: [{ date: "2026-01-15", training: 2, team: 3 }],
		};
		const weeks = riderWeeks(
			inputs,
			WINDOW,
			ENDS,
			balance({ trainingRynke: 17, teamRynke: 4 }),
		);
		expect(weeks.map(({ training, team }) => [training, team])).toEqual([
			[10, 0],
			[15, 1],
			[17, 4],
			[17, 4],
		]);
	});

	it("floors a total pushed below 0 by a correction at 0", () => {
		const inputs: RiderInputs = {
			...NO_INPUTS,
			rides: [{ weekEnd: "2026-01-04", distanceRynke: 5, elevationDm: 0 }],
			corrections: [{ date: "2026-01-06", training: -20, team: -1 }],
		};
		const weeks = riderWeeks(inputs, WINDOW, ENDS, balance());
		expect(weeks[1]).toEqual({ weekEnd: "2026-01-11", training: 0, team: 0 });
	});

	it("ends on the stored balance even when the rebuilt figure differs", () => {
		// An event dated after today counts in the stored balance (003 FR-002).
		const inputs: RiderInputs = {
			...NO_INPUTS,
			rides: [{ weekEnd: "2026-01-18", distanceRynke: 6, elevationDm: 0 }],
			attendance: [{ eventId: 1, kind: "team_training", date: "2026-02-01" }],
		};
		const weeks = riderWeeks(
			inputs,
			WINDOW,
			ENDS,
			balance({ trainingRynke: 11, teamRynke: 1 }),
		);
		expect(weeks[2]).toEqual({ weekEnd: "2026-01-18", training: 6, team: 0 });
		expect(weeks[3]).toEqual({ weekEnd: "2026-01-21", training: 11, team: 1 });
	});

	it("leaves out attendance before the season start", () => {
		const inputs: RiderInputs = {
			...NO_INPUTS,
			attendance: [{ eventId: 1, kind: "team_training", date: "2025-12-20" }],
		};
		const weeks = riderWeeks(inputs, WINDOW, ENDS, balance());
		expect(weeks[0]).toEqual({ weekEnd: "2026-01-04", training: 0, team: 0 });
	});

	it("gives every point 0 to a rider without a balance or inputs", () => {
		expect(riderWeeks(NO_INPUTS, WINDOW, ENDS, null)).toEqual(
			ENDS.map((weekEnd) => ({ weekEnd, training: 0, team: 0 })),
		);
	});
});

describe("riderDays", () => {
	const NO_DAILY: DailyInputs = { rides: [], attendance: [], corrections: [] };

	it("gives the Training Rynke after each day with an input, elevation floored on the total", () => {
		const inputs: DailyInputs = {
			...NO_DAILY,
			rides: [
				{ date: "2026-01-05", distanceRynke: 3, elevationDm: 6000 },
				{ date: "2026-01-02", distanceRynke: 4, elevationDm: 6000 },
				{ date: "2026-01-05", distanceRynke: 1, elevationDm: 0 },
			],
		};
		expect(riderDays(inputs, WINDOW, CURRENT_RULES)).toEqual([
			{ date: "2026-01-02", training: 4, team: 0 },
			// 12 000 dm together: one full step of 5 Rynke; per day it would be 0.
			{ date: "2026-01-05", training: 13, team: 0 },
		]);
	});

	it("dates attendance by its event and corrections by their date", () => {
		const inputs: DailyInputs = {
			rides: [{ date: "2026-01-02", distanceRynke: 10, elevationDm: 0 }],
			attendance: [{ eventId: 1, kind: "team_training", date: "2026-01-08" }],
			corrections: [{ date: "2026-01-15", training: 2, team: 3 }],
		};
		expect(riderDays(inputs, WINDOW, CURRENT_RULES)).toEqual([
			{ date: "2026-01-02", training: 10, team: 0 },
			{ date: "2026-01-08", training: 15, team: 1 },
			{ date: "2026-01-15", training: 17, team: 4 },
		]);
	});

	it("gives nothing without inputs", () => {
		expect(riderDays(NO_DAILY, WINDOW, CURRENT_RULES)).toEqual([]);
	});
});
