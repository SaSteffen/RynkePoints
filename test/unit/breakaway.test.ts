import { describe, expect, it } from "vitest";
import { breakawayFence } from "../../src/rynke/breakaway";

// The peloton's breakaway (016 FR-018, research R13): the upper outlier fence
// Q3 + 1.5 × (Q3 − Q1), quartiles interpolated between the closest ranks.
// Synthetic totals only.

/** Spec US2 #4: 52, 80, 105, …, 355 in steps of 25, 384, 760 and 912. */
const US2_4 = [
	52,
	80,
	...Array.from({ length: 11 }, (_, i) => 105 + 25 * i),
	384,
	760,
	912,
];

describe("breakawayFence", () => {
	it("interpolates the quartiles between the closest ranks", () => {
		// Q1 2, Q3 4: 4 + 1.5 × 2.
		expect(breakawayFence([1, 2, 3, 4, 100])).toBe(7);
	});

	it("puts only 760 and 912 of spec US2 #4 above the fence", () => {
		// Q1 148.75, Q3 336.25: 336.25 + 1.5 × 187.5.
		expect(US2_4).toHaveLength(16);
		const fence = breakawayFence(US2_4);
		expect(fence).toBe(617.5);
		expect(US2_4.filter((total) => total > (fence ?? 0))).toEqual([760, 912]);
	});

	it("has no breakaway below five totals", () => {
		expect(breakawayFence([1, 2, 3, 1000])).toBeNull();
		expect(breakawayFence([])).toBeNull();
	});

	it("has no breakaway when every total is equal", () => {
		expect(breakawayFence([40, 40, 40, 40, 40, 40])).toBeNull();
	});

	it("keeps a total equal to the fence in the bunch", () => {
		expect(breakawayFence([1, 2, 3, 4, 7])).toBeNull();
	});

	it("finds a breakaway over a bunch of riders without Rynke", () => {
		// Q1 0, Q3 12.5: 12.5 + 1.5 × 12.5.
		expect(breakawayFence([0, 0, 0, 0, 0, 0, 50, 80])).toBe(31.25);
	});

	it("ignores the input order and leaves the array alone", () => {
		const totals = [100, 3, 1, 4, 2];
		expect(breakawayFence(totals)).toBe(7);
		expect(totals).toEqual([100, 3, 1, 4, 2]);
	});
});
