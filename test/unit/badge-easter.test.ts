import { describe, expect, it } from "vitest";
import { easterSunday } from "../../src/badges/easter";

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
