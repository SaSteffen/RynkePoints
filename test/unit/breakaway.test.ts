import { describe, expect, it } from "vitest";
import { breakaway } from "../../src/rynke/breakaway";

// The peloton's breakaway (016 FR-018, research R13): everyone ahead of the
// bunch's first gap, a gap being more than 0.4 × the median total (at least
// 1) between two neighbours. Synthetic totals only.

/** Spec US2 #4: 52, 80, 105, …, 355 in steps of 25, 384, 760 and 912. */
const US2_4 = [
	52,
	80,
	...Array.from({ length: 11 }, (_, i) => 105 + 25 * i),
	384,
	760,
	912,
];

describe("breakaway", () => {
	it("puts 760 and 912 of spec US2 #4 in the breakaway, as two groups", () => {
		// Median 217.5: a gap is more than 87.
		expect(US2_4).toHaveLength(16);
		expect(breakaway(US2_4)).toEqual({ fence: 384, groups: [[760], [912]] });
	});

	it("takes a chase group along with a rider far ahead", () => {
		// Median 80: a gap is more than 32.
		const totals = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120];
		expect(breakaway([...totals, 200, 210, 500])).toEqual({
			fence: 120,
			groups: [[200, 210], [500]],
		});
	});

	it("has no breakaway in a tight pack", () => {
		expect(breakaway([100, 105, 110, 115, 120, 125])).toBeNull();
	});

	it("ignores gaps behind the median rider", () => {
		expect(breakaway([0, 100, 101, 102, 103])).toBeNull();
	});

	it("has no breakaway below five totals", () => {
		expect(breakaway([1, 2, 3, 1000])).toBeNull();
		expect(breakaway([])).toBeNull();
	});

	it("has no breakaway when every total is equal", () => {
		expect(breakaway([40, 40, 40, 40, 40, 40])).toBeNull();
		expect(breakaway([0, 0, 0, 0, 0])).toBeNull();
	});

	it("keeps the breakaway below half of the riders", () => {
		// The upper of the two middle riders, 4, rides in the bunch.
		expect(breakaway([1, 2, 3, 4, 100, 200])).toEqual({
			fence: 4,
			groups: [[100], [200]],
		});
	});

	it("finds a breakaway over a bunch of riders without Rynke", () => {
		// Median 0: a gap is more than 1.
		expect(breakaway([0, 0, 0, 0, 0, 0, 50, 80])).toEqual({
			fence: 0,
			groups: [[50], [80]],
		});
	});

	it("keeps equal totals together", () => {
		expect(breakaway([1, 2, 3, 4, 5, 6, 400, 400, 900])).toEqual({
			fence: 6,
			groups: [[400], [900]],
		});
	});

	it("ignores the input order and leaves the array alone", () => {
		const totals = [100, 3, 1, 4, 2];
		expect(breakaway(totals)).toEqual({ fence: 4, groups: [[100]] });
		expect(totals).toEqual([100, 3, 1, 4, 2]);
	});
});
