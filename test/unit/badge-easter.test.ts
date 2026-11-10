import { describe, expect, it } from "vitest";
import { easterSunday, firstAdventSunday } from "../../src/badges/easter";

// Easter Sunday for the Osterhase surprise badge (feature 013 part F, FR-017,
// research R44).

describe("easterSunday", () => {
	it.each([
		[2026, "2026-04-05"],
		[2027, "2027-03-28"],
		[2028, "2028-04-16"],
		[2030, "2030-04-21"],
		[2038, "2038-04-25"],
	])("gives Easter Sunday %i as %s", (year, date) => {
		expect(easterSunday(year)).toBe(date);
	});
});

// The first Advent Sunday, for the Advent quote monkey (feature 035 FR-005):
// the fourth Sunday before Christmas Day.
describe("firstAdventSunday", () => {
	it.each([
		[2026, "2026-11-29"],
		[2027, "2027-11-28"],
		[2028, "2028-12-03"],
		[2033, "2033-11-27"],
	])("gives the first Advent Sunday %i as %s", (year, date) => {
		expect(firstAdventSunday(year)).toBe(date);
	});

	it("is a Sunday from 27 Nov to 3 Dec, four weeks before Christmas, 2026–2035", () => {
		for (let year = 2026; year <= 2035; year++) {
			const day = new Date(`${firstAdventSunday(year)}T00:00:00Z`);
			expect(day.getUTCDay()).toBe(0);
			const christmas = Date.UTC(year, 11, 25);
			const days = (christmas - day.getTime()) / 86_400_000;
			expect(days).toBeGreaterThanOrEqual(22);
			expect(days).toBeLessThanOrEqual(28);
		}
	});
});
