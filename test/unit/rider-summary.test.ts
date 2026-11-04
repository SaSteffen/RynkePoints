import { describe, expect, it } from "vitest";
import {
	parseActive,
	parseAttended,
	parseDays,
	parseOwnDays,
	parseRunDays,
	parseVirtualDays,
	parseWeeks,
	RIDER_SUMMARY_VERSION,
	type SummaryFigures,
	summaryOf,
} from "../../src/rynke/summary";
import { weekEndOf } from "../../src/rynke/weeks";

// Feature 030: the pure figures → stored row step. The stored text must not
// depend on the order the figures arrive in, or an unchanged evaluation would
// write (research R3).

const ride = (
	date: string,
	distanceM: number,
	distanceRynke: number,
	elevationDm: number,
	startTime = "09:00",
	virtual = false,
) => ({ date, distanceM, distanceRynke, elevationDm, startTime, virtual });

const none: SummaryFigures = { rides: [], runs: [], swims: [] };

describe("weekEndOf", () => {
	it.each([
		["2026-03-01", "2026-03-01"], // a Sunday is its own week's end
		["2026-03-02", "2026-03-08"], // a Monday starts the next week
		["2025-12-29", "2026-01-04"], // over a year change
		["2028-02-28", "2028-03-05"], // over a leap day
		["2028-02-29", "2028-03-05"],
	])("%s ends on %s", (date, end) => {
		expect(weekEndOf(date)).toBe(end);
	});
});

describe("summaryOf", () => {
	it("is empty lists for a rider with nothing stored", () => {
		expect(summaryOf(none, [])).toEqual({
			days: "[]",
			weeks: "[]",
			runDays: "[]",
			active: "[]",
			attended: "[]",
			virtualDays: "[]",
			ownDays: "[]",
		});
	});

	it("holds virtual distance only for days with a counting virtual ride", () => {
		const summary = summaryOf(
			{
				...none,
				rides: [
					ride("2026-03-02", 1000.5, 1, 10, "09:00", true),
					ride("2026-03-02", 2000, 2, 20),
					ride("2026-03-02", 500.25, 1, 10, "18:00", true),
					ride("2026-03-03", 700, 1, 10),
				],
			},
			[],
		);
		expect(parseVirtualDays(summary.virtualDays)).toEqual([
			["2026-03-02", 1500.75],
		]);
	});

	it("holds each counting day's longest ride, and whether any was outdoors", () => {
		const summary = summaryOf(
			{
				...none,
				rides: [
					ride("2026-03-02", 1000, 1, 10, "09:00", true),
					ride("2026-03-02", 3000, 2, 20, "12:00", true),
					ride("2026-03-03", 700, 1, 10, "09:00", true),
					ride("2026-03-03", 400, 1, 10),
					ride("2026-03-04", 900, 1, 10),
				],
			},
			[],
		);
		expect(parseOwnDays(summary.ownDays)).toEqual([
			["2026-03-02", 3000, 0],
			["2026-03-03", 700, 1],
			["2026-03-04", 900, 1],
		]);
	});

	it("sums rides per date", () => {
		const summary = summaryOf(
			{
				...none,
				rides: [
					ride("2026-03-02", 1000.5, 1, 10),
					ride("2026-03-02", 2000.25, 2, 20),
					ride("2026-03-03", 500, 3, 30),
				],
			},
			[],
		);
		expect(parseDays(summary.days)).toEqual([
			["2026-03-02", 3000.75, 3, 30],
			["2026-03-03", 500, 3, 30],
		]);
	});

	it("sums weeks Monday to Sunday, on the Sunday", () => {
		const summary = summaryOf(
			{
				...none,
				rides: [
					ride("2026-03-01", 1, 1, 10), // Sunday
					ride("2026-03-02", 1, 2, 20), // Monday
					ride("2026-03-08", 1, 4, 40), // Sunday
				],
			},
			[],
		);
		expect(parseWeeks(summary.weeks)).toEqual([
			["2026-03-01", 1, 10],
			["2026-03-08", 6, 60],
		]);
	});

	it("sums runs per date, and leaves swims out of every sum", () => {
		const summary = summaryOf(
			{
				rides: [],
				runs: [
					{ date: "2026-03-02", distanceM: 5000.5, startTime: "07:10" },
					{ date: "2026-03-02", distanceM: 1000, startTime: "18:00" },
				],
				swims: [{ date: "2026-03-05", distanceM: 900, startTime: "06:00" }],
			},
			[],
		);
		expect(parseRunDays(summary.runDays)).toEqual([["2026-03-02", 6000.5]]);
		expect(parseDays(summary.days)).toEqual([]);
		expect(parseWeeks(summary.weeks)).toEqual([]);
		expect(parseActive(summary.active)).toEqual([
			["2026-03-02", 7, 0],
			["2026-03-02", 18, 0],
			["2026-03-05", 6, 0],
		]);
	});

	it("keeps active starts distinct by date, hour and whether it was a ride", () => {
		const summary = summaryOf(
			{
				rides: [
					ride("2026-03-02", 1, 1, 1, "09:05"),
					ride("2026-03-02", 1, 1, 1, "09:50"),
				],
				runs: [{ date: "2026-03-02", distanceM: 1, startTime: "09:30" }],
				swims: [{ date: "2026-03-02", distanceM: 1, startTime: "09:40" }],
			},
			[],
		);
		expect(parseActive(summary.active)).toEqual([
			["2026-03-02", 9, 0],
			["2026-03-02", 9, 1],
		]);
	});

	it("holds attended events as sorted IDs", () => {
		const summary = summaryOf(none, [{ eventId: 9 }, { eventId: 2 }]);
		expect(parseAttended(summary.attended)).toEqual([2, 9]);
	});

	it("gives identical text for the same figures in any order", () => {
		const rides = [
			ride("2026-03-02", 0.1, 1, 10),
			ride("2026-03-02", 0.2, 2, 20),
			ride("2026-03-02", 0.3, 3, 30, "17:00"),
			ride("2026-03-09", 1234.56, 4, 40),
			ride("2026-03-09", 0.1, 1, 10, "07:00", true),
			ride("2026-03-09", 0.2, 1, 10, "08:00", true),
			ride("2026-03-09", 0.7, 1, 10, "09:00", true),
		];
		const runs = [
			{ date: "2026-03-02", distanceM: 0.1, startTime: "07:00" },
			{ date: "2026-03-02", distanceM: 0.7, startTime: "08:00" },
			{ date: "2026-03-02", distanceM: 0.2, startTime: "08:00" },
		];
		const swims = [{ date: "2026-03-03", distanceM: 5, startTime: "06:00" }];
		const attendance = [
			{ eventId: 3, kind: "team_training" as const, date: "2026-02-01" },
			{ eventId: 1, kind: "team_training" as const, date: "2026-02-02" },
		];
		const forward = summaryOf({ rides, runs, swims }, attendance);
		const backward = summaryOf(
			{
				rides: [...rides].reverse(),
				runs: [...runs].reverse(),
				swims,
			},
			[...attendance].reverse(),
		);
		expect(backward).toEqual(forward);
	});

	it("stays under 100 KB per column for a whole season of daily activity", () => {
		const rides = [];
		const runs = [];
		const swims = [];
		const attendance = [];
		for (let i = 0; i < 365; i++) {
			const date = new Date(Date.UTC(2026, 0, 1 + i))
				.toISOString()
				.slice(0, 10);
			rides.push(ride(date, 123456.789, 123, 12345, "09:00"));
			rides.push(ride(date, 123456.789, 123, 12345, "18:00"));
			runs.push({ date, distanceM: 12345.67, startTime: "07:00" });
			swims.push({ date, distanceM: 1234.5, startTime: "06:00" });
			attendance.push({
				eventId: i + 1,
				kind: "team_training" as const,
				date,
			});
		}
		const summary = summaryOf({ rides, runs, swims }, attendance);
		for (const text of Object.values(summary)) {
			expect(text.length).toBeLessThan(100_000);
		}
	});

	it("has a version", () => {
		expect(RIDER_SUMMARY_VERSION).toBeGreaterThan(0);
	});
});
