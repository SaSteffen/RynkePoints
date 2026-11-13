import { describe, expect, it } from "vitest";
import {
	baseChecks,
	type Candidate,
	chooseRiders,
	OVERDUE_AFTER,
	runSize,
	spreadDelay,
} from "../../src/recheck/pace";

// The pace of the ride edit re-check (feature 036 contracts/hourly-run.md,
// research R2, R4; FR-009 to FR-013), over whole simulated days.

const HOUR = 3600;
const DAY = 24 * HOUR;
const ALLOWANCE = 150;

function riders(n: number, fastLane: (i: number) => boolean = () => false) {
	return Array.from(
		{ length: n },
		(_, i): Candidate => ({
			athleteId: i + 1,
			recheckedAt: null,
			fastLane: fastLane(i),
		}),
	);
}

/**
 * Hourly runs at :58 for `days` days, each stamping whom it chose. Returns the
 * checks per day and every rider's intervals after the first day.
 */
function simulate(team: Candidate[], days: number, allowance = ALLOWANCE) {
	const perDay: number[] = [];
	const intervals = new Map<number, number[]>();
	const perRider = new Map<number, number>();
	for (let d = 0; d < days; d++) {
		let total = 0;
		for (let h = 0; h < 24; h++) {
			const now = d * DAY + h * HOUR + 58 * 60;
			const overdue = team.filter(
				(c) => c.recheckedAt === null || now - c.recheckedAt >= OVERDUE_AFTER,
			).length;
			const size = runSize(h, allowance, team.length, overdue);
			const chosen = chooseRiders(team, size, now);
			expect(chosen.length).toBeLessThanOrEqual(size);
			expect(new Set(chosen.map((c) => c.athleteId)).size).toBe(chosen.length);
			for (const c of chosen) {
				if (d > 0 && c.recheckedAt !== null) {
					intervals.set(c.athleteId, [
						...(intervals.get(c.athleteId) ?? []),
						now - c.recheckedAt,
					]);
				}
				if (d === days - 1) {
					perRider.set(c.athleteId, (perRider.get(c.athleteId) ?? 0) + 1);
				}
				c.recheckedAt = now;
			}
			total += chosen.length;
		}
		perDay.push(total);
	}
	const all = [...intervals.values()].flat();
	return {
		perDay,
		perRider,
		shortest: Math.min(...all) / HOUR,
		longest: Math.max(...all) / HOUR,
	};
}

describe("baseChecks", () => {
	it("is 6 or 7 for 150 and adds up to the allowance over a day", () => {
		const hours = Array.from({ length: 24 }, (_, h) => baseChecks(h, 150));
		expect(new Set(hours)).toEqual(new Set([6, 7]));
		for (const allowance of [1, 23, 150, 151, 300]) {
			const sum = Array.from({ length: 24 }, (_, h) =>
				baseChecks(h, allowance),
			).reduce((a, b) => a + b, 0);
			expect(sum).toBe(allowance);
		}
	});
});

describe("runSize", () => {
	it("is min(n, 55, max(base, min(overdue, ceil(n / 20))))", () => {
		expect(runSize(0, 150, 0, 0)).toBe(0);
		expect(runSize(0, 150, 5, 5)).toBe(5);
		expect(runSize(0, 150, 100, 0)).toBe(6);
		expect(runSize(0, 150, 300, 40)).toBe(15);
		expect(runSize(0, 150, 300, 9)).toBe(9);
		expect(runSize(0, 150, 999, 999)).toBe(50);
		expect(runSize(0, 1000, 999, 0)).toBe(41);
		expect(runSize(0, 3000, 999, 0)).toBe(55);
	});

	it("after skipped runs is no larger than ceil(n / 20) beyond its base", () => {
		for (const n of [50, 140, 300, 999]) {
			for (let h = 0; h < 24; h++) {
				expect(runSize(h, 150, n, n)).toBeLessThanOrEqual(
					Math.max(baseChecks(h, 150), Math.ceil(n / 20)),
				);
			}
		}
	});
});

describe("chooseRiders", () => {
	const NOW = 100 * DAY;
	const at = (athleteId: number, ago: number | null, fastLane = false) => ({
		athleteId,
		recheckedAt: ago === null ? null : NOW - ago,
		fastLane,
	});

	it("takes the longest ago first, never checked before everyone, nobody twice", () => {
		const chosen = chooseRiders(
			[at(1, 2 * HOUR), at(2, null), at(3, 5 * HOUR), at(4, 3 * HOUR)],
			3,
			NOW,
		);
		expect(chosen.map((c) => c.athleteId)).toEqual([2, 3, 4]);
	});

	it("takes nobody once a run chose riders in the last 30 minutes", () => {
		expect(chooseRiders([at(1, 29 * 60), at(2, 5 * HOUR)], 2, NOW)).toEqual([]);
		expect(chooseRiders([at(1, 30 * 60), at(2, 5 * HOUR)], 2, NOW).length).toBe(
			2,
		);
	});

	it("orders 20 hours or more, then the fast lane, then the rest (FR-010)", () => {
		const chosen = chooseRiders(
			[
				at(1, 10 * HOUR),
				at(2, 2 * HOUR, true),
				at(3, 21 * HOUR),
				at(4, 3 * HOUR, true),
				at(5, 12 * HOUR),
			],
			5,
			NOW,
		);
		expect(chosen.map((c) => c.athleteId)).toEqual([3, 4, 2, 5, 1]);
	});

	it("gives the fast lane at most half, and its unused places to the others (US3 scenario 4)", () => {
		const fast = [1, 2, 3, 4, 5].map((id) => at(id, HOUR, true));
		const others = [6, 7, 8, 9].map((id) => at(id, 10 * HOUR));
		expect(
			chooseRiders([...fast, ...others], 6, NOW).map((c) => c.athleteId),
		).toEqual([1, 2, 3, 6, 7, 8]);
		expect(
			chooseRiders([at(1, HOUR, true), ...others], 4, NOW).map(
				(c) => c.athleteId,
			),
		).toEqual([1, 6, 7, 8]);
	});
});

describe("spreadDelay", () => {
	it("spreads a run over 55 minutes, at least a minute apart", () => {
		expect(spreadDelay(0, 6)).toBe(0);
		expect(spreadDelay(5, 6)).toBe(2750);
		for (let n = 1; n <= 55; n++) {
			for (let i = 1; i < n; i++) {
				expect(
					spreadDelay(i, n) - spreadDelay(i - 1, n),
				).toBeGreaterThanOrEqual(60);
			}
			expect(spreadDelay(n - 1, n)).toBeLessThan(3300);
		}
	});
});

// The worked examples of contracts/hourly-run.md, after a first day in which
// every rider starts out never checked.
describe("a day of runs", () => {
	it.each([
		[5, 1, 1],
		[12, 1, 2],
		[50, 8, 8],
		[100, 16, 16],
		[140, 20, 23],
	])(
		"with %i active riders checks each every %i to %i hours, within the allowance",
		(n, shortest, longest) => {
			const day = simulate(riders(n), 4);
			expect(day.shortest).toBeGreaterThanOrEqual(shortest);
			expect(day.longest).toBeLessThanOrEqual(longest);
			for (const total of day.perDay.slice(1)) {
				expect(total).toBeLessThanOrEqual(ALLOWANCE);
			}
		},
	);

	it.each([
		[300, 300, 330],
		[999, 999, 1060],
	])(
		"with %i active riders still checks each within 24 hours",
		(n, least, most) => {
			const day = simulate(riders(n), 4);
			expect(day.longest).toBeLessThan(24);
			for (const total of day.perDay.slice(1)) {
				expect(total).toBeGreaterThanOrEqual(least);
				expect(total).toBeLessThanOrEqual(most);
			}
		},
	);

	// The contract's estimate was two runs out of three; the riders past 20 hours
	// go first and take more of each run than it assumed (about 4.9, not 4), so
	// the fast lane gets about 9 of a day's 24 runs here. Still six times the
	// regular pace, and nobody waits 24 hours.
	it("checks 3 fast-lane riders among 100 far more often than the rest", () => {
		const team = riders(100, (i) => i < 3);
		const day = simulate(team, 4);
		for (const id of [1, 2, 3]) {
			expect(day.perRider.get(id) ?? 0).toBeGreaterThanOrEqual(9);
		}
		expect(day.perRider.get(50) ?? 0).toBeLessThanOrEqual(2);
		expect(day.longest).toBeLessThan(24);
	});

	it("checks 3 fast-lane riders among 50 at every run", () => {
		const day = simulate(
			riders(50, (i) => i < 3),
			4,
		);
		for (const id of [1, 2, 3]) expect(day.perRider.get(id)).toBe(24);
	});
});
