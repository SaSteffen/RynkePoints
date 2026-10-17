import { describe, expect, it } from "vitest";
import { BADGES } from "../../src/badges/catalog";
import { tiltOf } from "../../src/http/sections/badges";

// Each badge sits a little crooked, like a sticker stuck on by hand: its own
// angle, the same on every visit (feature 013 Part G).

describe("badge tilt", () => {
	it("is 2 to 6 degrees either way, in tenths, for every badge", () => {
		for (const badge of BADGES) {
			const tilt = Math.abs(tiltOf(badge.id));
			expect(tilt).toBeGreaterThanOrEqual(2);
			expect(tilt).toBeLessThanOrEqual(6);
			expect(Math.round(tilt * 10)).toBeCloseTo(tilt * 10);
		}
	});

	it("is the same for a badge every time, and varies between badges", () => {
		expect(tiltOf("distance-1000")).toBe(tiltOf("distance-1000"));
		const angles = new Set(BADGES.map((b) => tiltOf(b.id)));
		expect(angles.size).toBeGreaterThan(BADGES.length / 3);
		expect(BADGES.some((b) => tiltOf(b.id) < 0)).toBe(true);
		expect(BADGES.some((b) => tiltOf(b.id) > 0)).toBe(true);
	});
});
