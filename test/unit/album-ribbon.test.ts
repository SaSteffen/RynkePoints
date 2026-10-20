import { describe, expect, it } from "vitest";
import { glitter, RIBBON_DEFS, ribbon, textSize } from "../../album/ribbon";

// The sticker's milestone ribbon with its gloss and glitter (feature 021,
// contracts/album-layout.md): vector shapes only, on the ribbon alone.

describe("the ribbon", () => {
	it("carries the milestone in the group's colours", () => {
		const personal = ribbon("distance-1000", "personal", "1.000 km");
		expect(personal.toString()).toMatch(
			/<text [^>]*fill="#fbe122"[^>]*>1.000 km</,
		);
		const team = ribbon("team-distance-1000", "team", "1.000 km");
		expect(team.toString()).toContain('fill="#1c1b13" stroke="#8cc4f0"');
	});

	it("keeps the glitter and gloss inside its outline", () => {
		const svg = ribbon("distance-1000", "personal", "1.000\u00a0km").toString();
		const clips =
			/<g clip-path="url\(#ribbon-clip-(tails|band)\)">[\s\S]*?<\/g>/g;
		const clipped = [...svg.matchAll(clips)];
		expect(clipped.map((m) => m[1])).toEqual(["tails", "band"]);
		for (const [part] of clipped) {
			expect(part).toContain("<circle");
			expect(part).toContain('fill="url(#ribbon-gloss)"');
		}
		expect(svg.replace(clips, "")).not.toContain("<circle");
		const defs = RIBBON_DEFS.toString();
		expect(defs).toContain('<clipPath id="ribbon-clip-tails"');
		expect(defs).toContain('<clipPath id="ribbon-clip-band"');
	});

	it("lays the band over the tails' inner ends, outline and all", () => {
		const svg = ribbon("distance-1000", "personal", "1.000\u00a0km").toString();
		const bandFill = svg.indexOf('<g stroke="#1c1b13" fill="#1c1b13"><rect');
		const tailEdges = svg.lastIndexOf('<g stroke="#1c1b13" fill="none"><path');
		expect(tailEdges).toBeGreaterThan(-1);
		expect(bandFill).toBeGreaterThan(tailEdges);
	});

	it("draws no filter and no image, which Chromium would print as one", () => {
		const svg = ribbon("distance-1000", "personal", "1.000 km").toString();
		expect(svg).not.toMatch(/filter|<image|blur/);
		expect(RIBBON_DEFS.toString()).not.toMatch(/filter|<image|blur/);
	});

	it("has the same glitter on every copy of a badge, other on the next", () => {
		expect(glitter("distance-100", "personal")).toBe(
			glitter("distance-100", "personal"),
		);
		expect(glitter("distance-100", "personal")).not.toBe(
			glitter("distance-500", "personal"),
		);
	});

	it("sets a long milestone smaller, never under 7 pt", () => {
		expect(textSize("100 km")).toBe(7.6);
		expect(textSize("Rund um die Uhr")).toBeLessThan(7.6);
		// 6.2 units of a 40 mm picture: 2.48 mm, 7 pt.
		expect(textSize("A very long surprise word indeed")).toBe(6.2);
		expect(
			ribbon("x", "personal", "A very long surprise word indeed").toString(),
		).toContain('lengthAdjust="spacingAndGlyphs"');
	});
});
