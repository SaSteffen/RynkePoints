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

	it("gives Hamburg its holidays", () => {
		expect(hamburg.holidays).toEqual([
			{
				id: "karneval",
				monkey: "karneval",
				from: { anchor: "easter", offset: -52 },
				to: { anchor: "easter", offset: -46 },
				kind: "short",
			},
			{
				id: "valentine",
				monkey: "valentine",
				from: "02-14",
				to: "02-14",
				kind: "short",
			},
			{
				id: "easter",
				monkey: "easter",
				from: { anchor: "easter", offset: -2 },
				to: { anchor: "easter", offset: 1 },
				kind: "short",
			},
			{
				id: "midsummer",
				monkey: "midsummer",
				from: "06-20",
				to: "06-24",
				kind: "short",
			},
			{
				id: "halloween",
				monkey: "halloween",
				from: "10-29",
				to: "10-31",
				kind: "short",
			},
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
				id: "carnival",
				monkey: "karneval",
				from: { anchor: "easter", offset: -52 },
				to: { anchor: "easter", offset: -46 },
				kind: "short",
			},
			{
				id: "valentine",
				monkey: "valentine",
				from: "02-14",
				to: "02-14",
				kind: "short",
			},
			{
				id: "easter",
				monkey: "easter",
				from: { anchor: "easter", offset: -2 },
				to: { anchor: "easter", offset: 1 },
				kind: "short",
			},
			{
				id: "europe-day",
				monkey: "europe-day",
				from: "05-09",
				to: "05-09",
				kind: "short",
			},
			{
				id: "midsummer",
				monkey: "midsummer",
				from: "06-20",
				to: "06-24",
				kind: "short",
			},
			{
				id: "halloween",
				monkey: "halloween",
				from: "10-29",
				to: "10-31",
				kind: "short",
			},
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
	it.each([
		["hamburg", hamburg, "karneval"],
		["europe", europe, "carnival"],
	] as const)("finds %s's spring holidays", (_, team, karneval) => {
		for (const day of ["2027-02-03", "2027-02-11", "2027-03-25", "2027-03-30"])
			expect(on(day, team), day).toBeNull();
		for (const day of [
			"2027-02-04",
			"2027-02-10",
			"2028-02-24",
			"2028-02-29",
			"2028-03-01",
		])
			expect(on(day, team), day).toBe(karneval);
		for (const day of ["2027-03-26", "2027-03-29", "2028-04-14", "2028-04-17"])
			expect(on(day, team), day).toBe("easter");
	});

	it.each([
		["hamburg", hamburg],
		["europe", europe],
	] as const)("finds %s's summer and autumn holidays", (_, team) => {
		for (const day of ["2027-06-19", "2027-06-25", "2027-10-28", "2027-11-01"])
			expect(on(day, team), day).toBeNull();
		for (const day of ["2027-06-20", "2027-06-24"])
			expect(on(day, team), day).toBe("midsummer");
		for (const day of ["2027-10-29", "2027-10-31"])
			expect(on(day, team), day).toBe("halloween");
	});

	it.each([
		["hamburg", hamburg, "karneval"],
		["europe", europe, "carnival"],
	] as const)("finds %s's Valentine's Day", (_, team, karneval) => {
		expect(on("2027-02-13", team)).toBeNull();
		expect(on("2027-02-14", team)).toBe("valentine");
		expect(on("2027-02-15", team)).toBeNull();
		// Inside Karneval (8–14 Feb 2029) the one day wins.
		expect(on("2029-02-13", team)).toBe(karneval);
		expect(on("2029-02-14", team)).toBe("valentine");
	});

	it("gives only Team Europe Europe Day", () => {
		expect(on("2027-05-09", europe)).toBe("europe-day");
		expect(on("2027-05-09")).toBeNull();
		expect(on("2027-05-08", europe)).toBeNull();
		expect(on("2027-05-10", europe)).toBeNull();
	});

	// SC-005: each day in at most one window, but Nikolaus inside Advent and
	// Valentine's Day inside Karneval.
	it.each(TEAMS.map((team) => [team.id, team] as const))(
		"%s: has no overlapping windows, 2026–2075",
		(_, team) => {
			const end = Date.parse("2075-12-31T00:00:00Z");
			for (
				let t = Date.parse("2026-01-01T00:00:00Z");
				t <= end;
				t += 86_400_000
			) {
				const day = new Date(t).toISOString().slice(0, 10);
				const holding = team.holidays.filter((h) => holidayOn(day, [h]));
				// Valentine's Day can fall in Karneval; the one day wins.
				const allowed =
					day.endsWith("-02-14") ||
					(team.id === "hamburg" && day.endsWith("-12-06"))
						? 2
						: 1;
				expect(holding.length, day).toBeLessThanOrEqual(allowed);
			}
		},
	);
});
