import { describe, expect, it } from "vitest";
import { RIBBON, ribbonSvg } from "../../scripts/badge-frame.mjs";
import {
	BADGE_OUTLINE,
	BADGE_OUTLINE_PLAIN,
	BADGE_RIBBON_FILL,
	BADGE_RIBBON_MASK,
	BADGE_RIBBON_TAIL,
	BADGE_SHAPE_DEFS,
	badgeRibbon,
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

	// Each badge is one file; the page draws the ribbon over it (issue #180),
	// exactly as the frame drew it into the file before.
	for (const kind of ["personal", "team"] as const) {
		it(`draws the ${kind} ribbon the frame designed, shape for shape`, () => {
			const group = BADGE_SHAPE_DEFS.match(
				/<g id="badge-ribbon" stroke="(#\w+)">(.*?)<\/g>/,
			);
			const fill = badgeRibbon(kind).match(
				/<use href="#badge-ribbon" fill="(#\w+)"\/>/,
			)?.[1];
			expect(fill).toBe(BADGE_RIBBON_FILL[kind]);
			// The page's shapes with the colours they inherit, against the frame's.
			const drawn = (group?.[2] ?? "").replace(
				/<(path|rect) /g,
				`<$1 fill="${fill}" stroke="${group?.[1]}" `,
			);
			const frame = ribbonSvg(kind).replace(/ class="[^"]*"/g, "");
			const attributes = (svg: string) =>
				[...svg.matchAll(/<(\w+) ([^>]*)\/>/g)].map(([, tag, rest]) => [
					tag,
					[...(rest ?? "").matchAll(/([\w-]+)="([^"]*)"/g)]
						.map(([, k, v]) => `${k}=${v}`)
						.sort(),
				]);
			expect(attributes(drawn)).toEqual(attributes(frame));
		});
	}

	it("hides the ribbon from screen readers and masks the shine with it", () => {
		expect(badgeRibbon("personal")).toContain('aria-hidden="true"');
		const mask = decodeURIComponent(BADGE_RIBBON_MASK);
		expect(mask).toMatch(/^url\("data:image\/svg\+xml,<svg /);
		expect(mask).toContain('d="M16,73 L3,73 L7,79.5 L3,86 L16,86 Z"');
		expect(mask).toContain('<rect x="13" y="70" width="74" height="14"');
	});

	it("has a plain circle for the gallery, whose badges have no ribbon", () => {
		expect(BADGE_OUTLINE_PLAIN).toContain('<use href="#badge-circle"');
		expect(BADGE_OUTLINE_PLAIN).not.toContain("#badge-shape");
	});
});
