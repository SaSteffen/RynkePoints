import { describe, expect, it } from "vitest";
import {
	countingWindow,
	eventInWindow,
	inCountingWindow,
	seasonEnd,
} from "../../src/rynke/rules";

// The season and the qualification window apart (feature 040 data-model.md):
// the season runs from SEASON_START_DATE, the window, where rides count, from
// QUALIFICATION_START_DATE; both close no later than the deadline and season end.

const europe = countingWindow({
	SEASON_START_DATE: "2026-09-01",
	QUALIFICATION_START_DATE: "2027-01-01",
	QUALIFICATION_DEADLINE: "2027-06-30",
});

describe("countingWindow", () => {
	it("reads the season start, the window start and the deadline", () => {
		expect(europe).toEqual({
			seasonStart: "2026-09-01",
			windowStart: "2027-01-01",
			deadline: "2027-06-30",
		});
	});

	it.each(["", "2027-1-01", "01.01.2027", "2027-02-30"])(
		"rejects the window start %j",
		(windowStart) => {
			expect(() =>
				countingWindow({
					SEASON_START_DATE: "2026-09-01",
					QUALIFICATION_START_DATE: windowStart,
					QUALIFICATION_DEADLINE: "2027-06-30",
				}),
			).toThrow("QUALIFICATION_START_DATE");
		},
	);

	it.each(["", "2026-9-01", "01.09.2026", "2026-02-30"])(
		"rejects the season start %j",
		(seasonStart) => {
			expect(() =>
				countingWindow({
					SEASON_START_DATE: seasonStart,
					QUALIFICATION_START_DATE: "2027-01-01",
					QUALIFICATION_DEADLINE: "2027-06-30",
				}),
			).toThrow("SEASON_START_DATE");
		},
	);
});

describe("inCountingWindow", () => {
	it("counts from the window start", () => {
		expect(inCountingWindow("2027-01-01", europe)).toBe(true);
		expect(inCountingWindow("2026-12-31", europe)).toBe(false);
		expect(inCountingWindow("2026-09-01", europe)).toBe(false);
	});

	it("counts to the deadline", () => {
		expect(inCountingWindow("2027-06-30", europe)).toBe(true);
		expect(inCountingWindow("2027-07-01", europe)).toBe(false);
	});
});

describe("seasonEnd", () => {
	it("is the day before the season start's anniversary", () => {
		expect(seasonEnd(europe)).toBe("2027-08-31");
	});
});

describe("eventInWindow", () => {
	it("counts a team event from the window start", () => {
		expect(eventInWindow("team_training", "2027-01-01", europe)).toBe(true);
		expect(eventInWindow("team_training", "2026-12-31", europe)).toBe(false);
	});

	it("counts a tour day from the season start", () => {
		expect(eventInWindow("tour_de_paris", "2026-09-01", europe)).toBe(true);
		expect(eventInWindow("tour_de_paris", "2026-08-31", europe)).toBe(false);
		expect(eventInWindow("tour_de_paris", "2027-08-31", europe)).toBe(true);
	});
});
