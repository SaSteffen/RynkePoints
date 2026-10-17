import { describe, expect, it } from "vitest";
import { RIBBON } from "../../scripts/badge-frame.mjs";
import {
	BADGE_OUTLINE,
	BADGE_OUTLINE_PLAIN,
	BADGE_RIBBON_TAIL,
	BADGE_SHAPE_DEFS,
} from "../../src/badges/outline";

// A badge still to earn is a round outline with the badge's ribbon across it
// (feature 013 Part G), so its ribbon must be the one the badges are drawn
// with.

describe("badge outline", () => {
	it("has the frame's ribbon tails", () => {
		expect(BADGE_RIBBON_TAIL).toEqual(RIBBON.tail);
	});

	it("is the circle with both tails and the band", () => {
		const shape = BADGE_SHAPE_DEFS.match(/<g id="badge-shape">(.*)<\/g>/)?.[1];
		expect(shape).toMatch(
			/^<circle cx="50" cy="50" r="42"\/><path [^>]*\/><path [^>]*\/><rect /,
		);
		expect(BADGE_SHAPE_DEFS).toContain(
			'<circle id="badge-circle" cx="50" cy="50" r="47"/>',
		);
		expect(shape).toContain(
			`<rect x="${RIBBON.box.x}" y="${RIBBON.box.y}" width="${RIBBON.box.width}" height="${RIBBON.box.height}"`,
		);
		expect(shape).toContain('d="M16,73 L3,73 L7,79.5 L3,86 L16,86 Z"');
	});

	it("draws only the outer edge: a stroke under a fill, hidden from screen readers", () => {
		expect(BADGE_OUTLINE).toContain('aria-hidden="true"');
		expect(BADGE_OUTLINE.indexOf("badge-outline-edge")).toBeLessThan(
			BADGE_OUTLINE.indexOf("badge-outline-fill"),
		);
	});

	it("has a plain circle for the gallery, whose badges have no ribbon", () => {
		expect(BADGE_OUTLINE_PLAIN).toContain('<use href="#badge-circle"');
		expect(BADGE_OUTLINE_PLAIN).not.toContain("#badge-shape");
	});
});
