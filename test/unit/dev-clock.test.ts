import { describe, expect, it } from "vitest";
import { fixedDay, isDay, shiftedNow } from "../../dev/clock";
import { berlinDate } from "../../src/config";

// Fake mode's pretended day (feature 021, dev/clock.ts).
describe("the dev clock", () => {
	const at = (iso: string) => Date.parse(iso) / 1000;

	it.each([
		// Winter to summer time and back, and a minute before midnight.
		["2026-10-20T08:30:00Z", "2027-07-06"],
		["2027-07-06T08:30:00Z", "2026-12-24"],
		["2026-10-20T22:59:00Z", "2027-07-06"],
		["2027-07-06T21:59:00Z", "2026-12-24"],
		["2026-10-20T00:00:00Z", "2026-10-20"],
	])("moves %s to %s in Berlin", (real, day) => {
		expect(berlinDate(shiftedNow(day, at(real)))).toBe(day);
	});

	it("keeps the time of day within a season", () => {
		const real = at("2026-10-20T08:30:00Z");
		expect(shiftedNow("2026-10-23", real) - real).toBe(3 * 86_400);
	});

	it.each([
		["2027-07-06", true],
		["2027-7-6", false],
		["July", false],
		["", false],
	])("takes %j as a day: %s", (day, ok) => {
		expect(isDay(day)).toBe(ok);
	});

	it("fixes the browser tests' day after the season start (issue #301)", () => {
		const start = { SEASON_START_DATE: "2026-09-01" };
		expect(fixedDay({ ...start, RYNKE_FAKE_SEASON_DAY: "70" })).toBe(
			"2026-11-10",
		);
		expect(fixedDay({ ...start, RYNKE_FAKE_SEASON_DAY: "0" })).toBe(
			"2026-09-01",
		);
		expect(fixedDay(start)).toBeNull();
		expect(fixedDay({ ...start, RYNKE_FAKE_SEASON_DAY: "" })).toBeNull();
		expect(() => fixedDay({ ...start, RYNKE_FAKE_SEASON_DAY: "-3" })).toThrow();
	});
});
