import { describe, expect, it } from "vitest";
import {
	figuresOf,
	periodOf,
	type RideRider,
	rideRows,
	teamRideTotals,
	teamWeeksKm,
	typicalRide,
} from "../../src/rynke/ride-figures";
import type { RideEntry } from "../../src/rynke/summary";

// Feature 032: the ride figures against hand counts (SC-001). Synthetic riders.

const window = { seasonStart: "2026-01-01", deadline: "2027-06-30" };
const season = { from: "2026-01-01", to: "2027-06-30" };

const rider = (athleteId: number, rides: RideEntry[]): RideRider => ({
	athleteId,
	rides,
});

describe("periodOf", () => {
	it("is the counting window for the season", () => {
		expect(periodOf("season", "2026-05-13", window)).toEqual(season);
	});

	it("is the calendar month", () => {
		expect(periodOf("month", "2026-02-13", window)).toEqual({
			from: "2026-02-01",
			to: "2026-02-28",
		});
		expect(
			periodOf("month", "2028-02-29", { ...window, deadline: "2028-12-31" }),
		).toEqual({
			from: "2028-02-01",
			to: "2028-02-29",
		});
	});

	it("is Monday to Sunday, across a month and a year end", () => {
		expect(periodOf("week", "2026-05-13", window)).toEqual({
			from: "2026-05-11",
			to: "2026-05-17",
		});
		expect(periodOf("week", "2026-12-31", window)).toEqual({
			from: "2026-12-28",
			to: "2027-01-03",
		});
		expect(periodOf("week", "2026-06-01", window)).toEqual({
			from: "2026-06-01",
			to: "2026-06-07",
		});
	});

	it("is cut to the season start and the deadline", () => {
		expect(periodOf("week", "2026-01-02", window)).toEqual({
			from: "2026-01-01",
			to: "2026-01-04",
		});
		expect(periodOf("month", "2027-06-20", window)).toEqual({
			from: "2027-06-01",
			to: "2027-06-30",
		});
		expect(periodOf("week", "2027-06-29", window)).toEqual({
			from: "2027-06-28",
			to: "2027-06-30",
		});
	});
});

describe("figuresOf", () => {
	it("sums the rides in the range (US1 scenario 2)", () => {
		const rides: RideEntry[] = [
			["2026-05-12", 42700, 3800],
			["2026-05-13", 6100, 400],
			["2026-05-18", 30000, 100],
		];
		expect(figuresOf(rides, { from: "2026-05-11", to: "2026-05-17" })).toEqual({
			sessions: 2,
			distanceM: 48800,
			elevationDm: 4200,
			typicalM: 24400,
		});
	});

	it("is zeros and no typical ride without a ride", () => {
		expect(figuresOf([], season)).toEqual({
			sessions: 0,
			distanceM: 0,
			elevationDm: 0,
			typicalM: null,
		});
	});
});

describe("typicalRide", () => {
	it("is the middle length for an odd count", () => {
		expect(typicalRide([60000, 5000, 38000])).toBe(38000);
	});

	it("is the mean of the two middle lengths for an even count", () => {
		expect(typicalRide([5000, 80000, 30000, 40000])).toBe(35000);
	});

	it("is the one length for one ride, and null for none", () => {
		expect(typicalRide([12345])).toBe(12345);
		expect(typicalRide([])).toBeNull();
	});
});

describe("rideRows", () => {
	it("ranks by the picked figure, with ties 1, 2, 2, 4", () => {
		const riders = [
			rider(1, [["2026-05-01", 10000, 0]]),
			rider(2, [["2026-05-01", 30000, 0]]),
			rider(3, [["2026-05-01", 20000, 0]]),
			rider(4, [["2026-05-01", 20000, 0]]),
		];
		const { rows } = rideRows(riders, 1, "km", season);
		expect(rows.map((r) => [r.place, r.km, r.joint])).toEqual([
			[1, 30, false],
			[2, 20, true],
			[2, 20, true],
			[4, 10, false],
		]);
	});

	it("ranks on the shown value, so 48.84 km and 48.76 km share a place", () => {
		const riders = [
			rider(1, [["2026-05-01", 48840, 0]]),
			rider(2, [["2026-05-01", 48760, 0]]),
		];
		const { rows } = rideRows(riders, 1, "km", season);
		expect(rows.map((r) => [r.place, r.km])).toEqual([
			[1, 48.8],
			[1, 48.8],
		]);
	});

	it("rounds elevation to whole metres before ranking", () => {
		const riders = [
			rider(1, [["2026-05-01", 1000, 4204]]),
			rider(2, [["2026-05-01", 1000, 4196]]),
		];
		const { rows } = rideRows(riders, 1, "elevation", season);
		expect(rows.map((r) => [r.place, r.elevationM])).toEqual([
			[1, 420],
			[1, 420],
		]);
	});

	it("orders equals by sessions, km, elevation, then athlete ID", () => {
		const riders = [
			rider(5, [["2026-05-01", 20000, 100]]),
			rider(4, [
				["2026-05-01", 10000, 0],
				["2026-05-02", 10000, 0],
			]),
			rider(3, [["2026-05-01", 20000, 200]]),
			rider(2, [["2026-05-01", 20000, 100]]),
		];
		const { rows } = rideRows(riders, 5, "km", season);
		expect(rows.map((r) => [r.sessions, r.elevationM, r.you])).toEqual([
			[2, 0, false],
			[1, 20, false],
			[1, 10, false],
			[1, 10, true],
		]);
		expect(rows.every((r) => r.place === 1)).toBe(true);
	});

	it("ranks riders with no ride, on zero", () => {
		const { rows, viewer } = rideRows(
			[rider(1, []), rider(2, [["2026-05-01", 5000, 0]])],
			1,
			"sessions",
			season,
		);
		expect(rows.map((r) => [r.place, r.sessions, r.you])).toEqual([
			[1, 1, false],
			[2, 0, true],
		]);
		expect(viewer).toMatchObject({
			place: 2,
			count: 2,
			toNext: 2,
			lead: false,
		});
	});

	it("counts only rides in the range", () => {
		const { rows } = rideRows(
			[
				rider(1, [
					["2026-04-30", 5000, 0],
					["2026-05-11", 5000, 0],
				]),
			],
			1,
			"sessions",
			{ from: "2026-05-11", to: "2026-05-17" },
		);
		expect(rows[0]?.sessions).toBe(1);
	});

	it("gives the gap to the next place in shown units plus one unit", () => {
		const riders = [
			rider(1, [["2026-05-01", 48800, 4200]]),
			rider(2, [["2026-05-01", 50000, 4500]]),
		];
		expect(rideRows(riders, 1, "km", season).viewer?.toNext).toBe(1.3);
		expect(rideRows(riders, 1, "elevation", season).viewer?.toNext).toBe(31);
		expect(rideRows(riders, 2, "km", season).viewer).toMatchObject({
			toNext: null,
			lead: true,
			place: 1,
		});
	});

	it("gives the viewer's own figures with the typical ride", () => {
		const { viewer } = rideRows(
			[
				rider(1, [
					["2026-05-01", 42700, 3800],
					["2026-05-02", 6100, 400],
				]),
			],
			1,
			"km",
			season,
		);
		expect(viewer?.figures).toEqual({
			sessions: 2,
			distanceM: 48800,
			elevationDm: 4200,
			typicalM: 24400,
		});
	});

	it("has no viewer when the viewer isn't ranked", () => {
		expect(rideRows([rider(1, [])], 9, "km", season).viewer).toBeNull();
	});

	it("carries no athlete ID or name in a row", () => {
		const { rows } = rideRows(
			[rider(123456, [["2026-05-01", 5000, 0]])],
			1,
			"km",
			season,
		);
		expect(Object.keys(rows[0] ?? {}).sort()).toEqual(
			[
				"elevationM",
				"joint",
				"km",
				"place",
				"sessions",
				"typicalM",
				"you",
			].sort(),
		);
		expect(JSON.stringify(rows)).not.toContain("123456");
	});
});

describe("teamRideTotals", () => {
	it("sums every rider, with the median over all their rides together", () => {
		const totals = teamRideTotals(
			[
				rider(1, [
					["2026-05-01", 10000, 100],
					["2026-05-02", 50000, 200],
				]),
				rider(2, [["2026-05-01", 20000, 300]]),
				rider(3, []),
			],
			season,
		);
		expect(totals).toEqual({
			sessions: 3,
			distanceM: 80000,
			elevationDm: 600,
			typicalM: 20000,
		});
	});
});

describe("teamWeeksKm", () => {
	it("gives the team's running km at each week end, and the gains", () => {
		const weeks = teamWeeksKm(
			[
				rider(1, [
					["2026-05-04", 10000, 0],
					["2026-05-12", 20000, 0],
				]),
				rider(2, [["2026-05-10", 5000, 0]]),
			],
			["2026-05-10", "2026-05-17", "2026-05-24"],
		);
		expect(weeks).toEqual({
			total: 35,
			thisWeek: 0,
			weeks: [
				{ weekEnd: "2026-05-10", total: 15, gain: null },
				{ weekEnd: "2026-05-17", total: 35, gain: 20 },
				{ weekEnd: "2026-05-24", total: 35, gain: 0 },
			],
			bestWeek: { weekEnd: "2026-05-17", gain: 20 },
		});
	});
});
