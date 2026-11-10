import { describe, expect, it } from "vitest";
import { type Holiday, holidayOn } from "../../src/http/holidays";

// The day's holiday for the seasonal quote monkeys (feature 035 research R2,
// R3): fixed days, days counted from the first Advent Sunday or Easter,
// windows over the year end, and the shortest window winning.

const ADVENT: Holiday = {
	id: "advent",
	monkey: "advent",
	from: { anchor: "first-advent", offset: 0 },
	to: "12-23",
	kind: "long",
};
const NIKOLAUS: Holiday = {
	id: "nikolaus",
	monkey: "nikolaus",
	from: "12-06",
	to: "12-06",
	kind: "short",
};
const CHRISTMAS: Holiday = {
	id: "christmas",
	monkey: "christmas",
	from: "12-24",
	to: "12-26",
	kind: "short",
};
const NEW_YEAR: Holiday = {
	id: "new-year",
	monkey: "new-year",
	from: "12-31",
	to: "01-01",
	kind: "short",
};
const DECEMBER = [ADVENT, NIKOLAUS, CHRISTMAS, NEW_YEAR];

const on = (day: string, holidays = DECEMBER) =>
	holidayOn(day, holidays)?.id ?? null;

describe("holidayOn", () => {
	it("holds a fixed window's days, inclusive", () => {
		expect(on("2026-12-23", [CHRISTMAS])).toBeNull();
		expect(on("2026-12-24")).toBe("christmas");
		expect(on("2026-12-25")).toBe("christmas");
		expect(on("2026-12-26")).toBe("christmas");
		expect(on("2026-12-27")).toBeNull();
	});

	it("runs a window over the year end", () => {
		expect(on("2026-12-30")).toBeNull();
		expect(on("2026-12-31")).toBe("new-year");
		expect(on("2027-01-01")).toBe("new-year");
		expect(on("2027-01-02")).toBeNull();
	});

	it.each([
		["2026-11-29", "2026-11-28"],
		["2027-11-28", "2027-11-27"],
		["2028-12-03", "2028-12-02"],
	])("starts Advent on %s, not the day before", (first, before) => {
		expect(on(first)).toBe("advent");
		expect(on(before)).toBeNull();
	});

	it("counts days from Easter", () => {
		const rosenmontag: Holiday = {
			id: "rosenmontag",
			monkey: "karneval",
			from: { anchor: "easter", offset: -48 },
			to: { anchor: "easter", offset: -48 },
			kind: "short",
		};
		expect(on("2026-02-16", [rosenmontag])).toBe("rosenmontag");
		expect(on("2026-02-15", [rosenmontag])).toBeNull();
	});

	it("lets the shortest window win, the first listed on a tie", () => {
		expect(on("2026-12-05")).toBe("advent");
		expect(on("2026-12-06")).toBe("nikolaus");
		expect(on("2026-12-07")).toBe("advent");
		const other = { ...NIKOLAUS, id: "other" };
		expect(on("2026-12-06", [other, NIKOLAUS])).toBe("other");
	});

	it("ends Advent on 23 December when the 4th Advent is the 24th", () => {
		expect(on("2028-12-23")).toBe("advent");
		expect(on("2028-12-24")).toBe("christmas");
	});

	it("gives no holiday without any", () => {
		expect(holidayOn("2026-12-24", [])).toBeNull();
	});
});
