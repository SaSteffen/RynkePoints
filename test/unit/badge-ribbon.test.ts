import { describe, expect, it } from "vitest";
import { RIBBON } from "../../scripts/badge-frame.mjs";
import { BADGE_RIBBON } from "../../src/badges/ribbon";

// The page writes the milestone into the ribbon the badge file draws (feature
// 013 FR-040b, research R19), so both must agree on where it is.

describe("badge ribbon", () => {
	it("has the frame's box and text colours", () => {
		expect(BADGE_RIBBON.box).toEqual(RIBBON.box);
		expect(BADGE_RIBBON.text).toEqual(RIBBON.text);
	});

	it("gives the box in percent of the badge", () => {
		expect(BADGE_RIBBON.percent).toEqual({
			left: 13,
			top: 70,
			width: 74,
			height: 14,
		});
	});
});
