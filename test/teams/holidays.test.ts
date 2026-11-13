import { describe, expect, it } from "vitest";
import data from "../../art/quotes/monkeys.json";
import { holidayOn } from "../../src/http/holidays";
import { TEAMS } from "../../src/teams";
import { europe } from "../../src/teams/europe";
import { hamburg } from "../../src/teams/hamburg";

// Each team's holidays with a seasonal quote monkey (feature 035
// contracts/team-holidays.md): team data, never a branch in code.

const SEASONAL = new Set(
	(data.monkeys as { id: string; seasonal?: boolean }[])
		.filter((m) => m.seasonal === true)
		.map((m) => m.id),
);
const on = (day: string, team = hamburg) =>
	holidayOn(day, team.holidays)?.id ?? null;

describe("team holidays", () => {
	it.each(TEAMS.map((team) => [team.id, team] as const))(
		"%s: names seasonal monkeys, unique ids, real days",
		(_, team) => {
			const ids = team.holidays.map((h) => h.id);
			expect(new Set(ids).size).toBe(ids.length);
			for (const holiday of team.holidays) {
				expect(SEASONAL.has(holiday.monkey), holiday.monkey).toBe(true);
				for (const ref of [holiday.from, holiday.to]) {
					if (typeof ref !== "string") continue;
					expect(ref).toMatch(/^\d\d-\d\d$/);
					expect(ref).not.toBe("02-29");
					const day = new Date(`2026-${ref}T00:00:00Z`);
					expect(day.toISOString().slice(5, 10)).toBe(ref);
				}
			}
		},
	);

	it("gives Hamburg the four December holidays", () => {
		expect(hamburg.holidays).toEqual([
			{
				id: "advent",
				monkey: "advent",
				from: { anchor: "first-advent", offset: 0 },
				to: "12-23",
				kind: "long",
			},
			{
				id: "nikolaus",
				monkey: "nikolaus",
				from: "12-06",
				to: "12-06",
				kind: "short",
			},
			{
				id: "christmas",
				monkey: "christmas",
				from: "12-24",
				to: "12-26",
				kind: "short",
			},
			{
				id: "new-year",
				monkey: "new-year",
				from: "12-31",
				to: "01-01",
				kind: "short",
			},
		]);
	});

	it("finds Hamburg's holiday of the day", () => {
		expect(on("2026-11-28")).toBeNull();
		expect(on("2026-11-29")).toBe("advent");
		expect(on("2026-12-06")).toBe("nikolaus");
		expect(on("2026-12-24")).toBe("christmas");
		expect(on("2026-12-27")).toBeNull();
		expect(on("2027-01-01")).toBe("new-year");
		expect(on("2027-01-02")).toBeNull();
	});

	it("gives Team Europe its holidays", () => {
		expect(europe.holidays).toEqual([
			{
				id: "advent",
				monkey: "advent",
				from: { anchor: "first-advent", offset: 0 },
				to: "12-23",
				kind: "long",
			},
			{
				id: "christmas",
				monkey: "christmas",
				from: "12-24",
				to: "12-26",
				kind: "short",
			},
			{
				id: "new-year",
				monkey: "new-year",
				from: "12-31",
				to: "01-01",
				kind: "short",
			},
		]);
		expect(europe.holidays.map((h) => h.id)).not.toContain("nikolaus");
		expect(europe.placeholders).not.toContain("holidays");
	});

	it("finds Team Europe's holiday of the day", () => {
		expect(on("2026-11-28", europe)).toBeNull();
		expect(on("2026-11-29", europe)).toBe("advent");
		expect(on("2026-12-06", europe)).toBe("advent");
		expect(on("2026-12-24", europe)).toBe("christmas");
		expect(on("2026-12-26", europe)).toBe("christmas");
		expect(on("2026-12-31", europe)).toBe("new-year");
		expect(on("2027-01-01", europe)).toBe("new-year");
		expect(on("2027-01-02", europe)).toBeNull();
	});
});
