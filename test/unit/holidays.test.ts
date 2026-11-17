import { describe, expect, it } from "vitest";
import { type Holiday, holidaysOn } from "../../src/http/holidays";

// The day's holiday for the seasonal quote monkeys (feature 035 research R2,
// R3): fixed days, days counted from the first Advent Sunday or Easter,
// windows over the year end, and the shortest window winning, every one of the
// fewest days on a tie (feature 038 research R2).

const ADVENT: Holiday = {
	id: "advent",
	monkeys: ["advent"],
	from: { anchor: "first-advent", offset: 0 },
	to: "12-23",
	kind: "long",
};
const NIKOLAUS: Holiday = {
	id: "nikolaus",
	monkeys: ["nikolaus"],
	from: "12-06",
	to: "12-06",
	kind: "short",
};
const CHRISTMAS: Holiday = {
	id: "christmas",
	monkeys: ["christmas"],
	from: "12-24",
	to: "12-26",
	kind: "short",
};
const NEW_YEAR: Holiday = {
	id: "new-year",
	monkeys: ["new-year"],
	from: "12-31",
	to: "01-01",
	kind: "short",
};
const DECEMBER = [ADVENT, NIKOLAUS, CHRISTMAS, NEW_YEAR];

const on = (day: string, holidays = DECEMBER) => {
	const ids = holidaysOn(day, holidays).map((h) => h.id);
	return ids.length > 0 ? ids.join(" / ") : null;
};

describe("holidaysOn", () => {
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
			monkeys: ["karneval"],
			from: { anchor: "easter", offset: -48 },
			to: { anchor: "easter", offset: -48 },
			kind: "short",
		};
		expect(on("2026-02-16", [rosenmontag])).toBe("rosenmontag");
		expect(on("2026-02-15", [rosenmontag])).toBeNull();
	});

	it("lets the shortest window win, every one on a tie", () => {
		expect(holidaysOn("2026-12-05", DECEMBER).map((h) => h.id)).toEqual([
			"advent",
		]);
		expect(holidaysOn("2026-12-06", DECEMBER).map((h) => h.id)).toEqual([
			"nikolaus",
		]);
		expect(holidaysOn("2026-12-07", DECEMBER).map((h) => h.id)).toEqual([
			"advent",
		]);
		const other = { ...NIKOLAUS, id: "other" };
		expect(
			holidaysOn("2026-12-06", [other, NIKOLAUS]).map((h) => h.id),
		).toEqual(["other", "nikolaus"]);
		// A one-day window inside a two-day one still wins alone.
		const twoDays = { ...NIKOLAUS, id: "two-days", to: "12-07" as const };
		expect(
			holidaysOn("2026-12-06", [twoDays, NIKOLAUS]).map((h) => h.id),
		).toEqual(["nikolaus"]);
	});

	it("ends Advent on 23 December when the 4th Advent is the 24th", () => {
		expect(on("2028-12-23")).toBe("advent");
		expect(on("2028-12-24")).toBe("christmas");
	});

	it("gives no holiday without any", () => {
		expect(holidaysOn("2026-12-24", [])).toEqual([]);
	});
});
