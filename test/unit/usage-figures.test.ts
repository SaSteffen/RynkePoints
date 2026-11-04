import { describe, expect, it } from "vitest";
import {
	connectedFigure,
	currentStrava,
	drainEstimateSeconds,
	levelOf,
	makeFigure,
	percentOf,
	type StravaUsage,
	stravaFigures,
} from "../../src/usage/figures";

// The admin view's figures as pure logic (feature 025 FR-007 to FR-009, FR-020,
// SC-002, research R1, R11). Synthetic numbers only.

const DAY = 86_400;
const NOW = 20_000 * DAY + 3_000; // 00:50 UTC, in the window from 00:45.

const usage = (over: Partial<StravaUsage> = {}): StravaUsage => ({
	observedAt: NOW - 60,
	read15m: 30,
	readDaily: 1200,
	all15m: 40,
	allDaily: 1500,
	limitRead15m: 300,
	limitReadDaily: 3000,
	limitAll15m: 600,
	limitAllDaily: 6000,
	ownRead15m: 20,
	ownAll15m: 25,
	ownReadDaily: 900,
	ownAllDaily: 1000,
	peakRead15m: 200,
	peakAll15m: 250,
	...over,
});

describe("makeFigure", () => {
	it("shows amount, limit and percentage, with the team and the rest (SC-002)", () => {
		const figure = makeFigure("strava_read_daily", 1200, 3000, 900, NOW);
		expect(figure).toMatchObject({
			used: 1200,
			limit: 3000,
			percent: 40,
			team: 900,
			notAttributed: 300,
			level: "ok",
			observedAt: NOW,
		});
		expect((figure.team ?? 0) + (figure.notAttributed ?? 0)).toBe(figure.used);
	});

	it("never shows a negative rest when the own count passes the total (R1)", () => {
		expect(
			makeFigure("strava_read_daily", 10, 100, 12, NOW).notAttributed,
		).toBe(0);
	});

	it("has no team or rest for an account-wide figure (FR-008)", () => {
		expect(makeFigure("cf_worker_requests", 10, 100, null, NOW)).toMatchObject({
			team: null,
			notAttributed: null,
		});
	});
});

describe("levels (FR-009)", () => {
	it.each([
		[7999, "ok"],
		[8000, "warning"],
		[9499, "warning"],
		[9500, "critical"],
		[12000, "critical"],
	] as const)("%i of 10,000 is %s", (used, level) => {
		expect(levelOf(used, 10_000)).toBe(level);
	});

	it("doesn't cap above 100 % (spec edge case)", () => {
		expect(percentOf(12_000, 10_000)).toBe(120);
	});

	it("rounds down, so a figure never reads as a level it hasn't reached", () => {
		expect(percentOf(7999, 10_000)).toBe(79);
	});

	it("treats a zero limit as nothing used", () => {
		expect(percentOf(5, 0)).toBe(0);
		expect(levelOf(5, 0)).toBe("ok");
	});
});

describe("stravaFigures", () => {
	it("gives the reads and all requests, per day and per 15 minutes (FR-005)", () => {
		expect(stravaFigures(usage(), NOW)).toEqual([
			makeFigure("strava_read_daily", 1200, 3000, 900, NOW - 60),
			makeFigure("strava_all_daily", 1500, 6000, 1000, NOW - 60),
			makeFigure("strava_read_15m", 30, 300, 20, NOW - 60),
			makeFigure("strava_all_15m", 40, 600, 25, NOW - 60),
		]);
	});

	it("counts an old window as zero and keeps its observation time", () => {
		const observedAt = NOW - 1000;
		const [readDaily, , read15m] = stravaFigures(usage({ observedAt }), NOW);
		expect(read15m).toMatchObject({ used: 0, team: 0, observedAt });
		expect(readDaily).toMatchObject({ used: 1200, team: 900, observedAt });
	});

	it("counts an old day as zero, peaks too, and keeps its observation time", () => {
		const observedAt = NOW - DAY;
		const [readDaily] = stravaFigures(usage({ observedAt }), NOW);
		expect(readDaily).toMatchObject({ used: 0, team: 0, observedAt });
		expect(currentStrava(usage({ observedAt }), NOW)).toMatchObject({
			peakRead15m: 0,
			peakAll15m: 0,
		});
	});

	it("says never when nothing was observed", () => {
		const [readDaily] = stravaFigures(usage({ observedAt: 0 }), NOW);
		expect(readDaily?.observedAt).toBeNull();
	});
});

describe("connectedFigure", () => {
	it("holds the team's riders against Strava's capacity", () => {
		expect(connectedFigure(50, NOW)).toMatchObject({
			used: 50,
			limit: 999,
			team: 50,
			notAttributed: 0,
			percent: 5,
		});
	});
});

describe("drainEstimateSeconds (R11)", () => {
	it("is null when nothing waits", () => {
		expect(drainEstimateSeconds(0, usage(), NOW)).toBeNull();
	});

	it("takes the rate left after the reserves: 280 reads a window here", () => {
		expect(drainEstimateSeconds(280, usage(), NOW)).toBe(900);
		expect(drainEstimateSeconds(281, usage(), NOW)).toBe(1800);
	});

	it("is limited by what's left today, then goes on tomorrow", () => {
		// 3000 - 2850 - 100 leaves 50 today, so 100 items need tomorrow's budget.
		const seconds = drainEstimateSeconds(100, usage({ readDaily: 2850 }), NOW);
		expect(seconds).toBe(DAY - (NOW % DAY) + 900);
	});
});
