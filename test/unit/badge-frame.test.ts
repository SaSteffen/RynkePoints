import { describe, expect, it } from "vitest";
import {
	frameSvg,
	PICTURE_TRANSFORM,
	placeholderSvg,
	RIBBON,
	RYNKE,
	ribbonSvg,
	WINDOW,
} from "../../scripts/badge-frame.mjs";
import { COIN_SPRITE } from "../../src/http/coin";

// The badge frame (feature 013 art pipeline, contracts/badge-assets.md): drawn
// in code after the sunflower design in art/badges/reference/, with the
// generated picture in its round window.

/** Applies "translate(a b) scale(s) translate(c d)" to a point. */
function apply(transform: string, [x, y]: [number, number]): [number, number] {
	const ops = [...transform.matchAll(/(translate|scale)\(([^)]*)\)/g)].map(
		([, op, args]) => [op, (args ?? "").split(/[\s,]+/).map(Number)] as const,
	);
	let p: [number, number] = [x, y];
	for (const [op, a] of ops.reverse()) {
		const [u = 0, v = u] = a;
		p = op === "scale" ? [p[0] * u, p[1] * v] : [p[0] + u, p[1] + (a[1] ?? 0)];
	}
	return p;
}

const count = (svg: string, re: RegExp) => svg.match(re)?.length ?? 0;

describe("the window", () => {
	it("is centred, with the radius measured from the reference", () => {
		expect(WINDOW.cx).toBe(50);
		expect(WINDOW.cy).toBe(50);
		expect(WINDOW.r).toBeGreaterThan(27);
		expect(WINDOW.r).toBeLessThan(31);
	});

	it("takes the generated circle (r 43.95 at 50, 50) onto the window", () => {
		const r = (1800 / 2048) * 50;
		const [cx, cy] = apply(PICTURE_TRANSFORM, [50, 50]);
		expect(cx).toBeCloseTo(50, 5);
		expect(cy).toBeCloseTo(50, 5);
		const [ex] = apply(PICTURE_TRANSFORM, [50 + r, 50]);
		expect(ex - 50).toBeCloseTo(WINDOW.r, 2);
	});
});

describe("RYNKE", () => {
	it("is the coin's Rynke, unchanged", () => {
		expect(RYNKE.length).toBeGreaterThan(200);
		expect(COIN_SPRITE).toContain(RYNKE);
	});
});

describe("frameSvg", () => {
	const picture = '<path fill="#c8641e" d="M0 0H100V100H0Z"/>';

	for (const kind of ["personal", "team"] as const) {
		describe(kind, () => {
			const svg = frameSvg(kind, picture, "distance-100");

			it("is a square, self-sizing SVG with the title first", () => {
				expect(svg).toMatch(
					/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 100 100"><title>distance-100<\/title>/,
				);
				expect(svg).not.toMatch(/<svg[^>]* (width|height)=/);
			});

			it("clips the picture to the window and places it", () => {
				expect(svg).toContain(
					`<clipPath id="window-distance-100"><circle cx="50" cy="50" r="${WINDOW.r}"/></clipPath>`,
				);
				expect(svg).toContain(
					`<g clip-path="url(#window-distance-100)"><g transform="${PICTURE_TRANSFORM}">${picture}</g></g>`,
				);
			});

			it("draws the ring over the picture, in case the clip is ignored", () => {
				expect(svg.indexOf('class="ring"')).toBeGreaterThan(
					svg.indexOf(picture),
				);
				expect(svg).toMatch(/<path class="ring"[^>]* fill-rule="evenodd"/);
			});

			it("has two layers of petals, amber behind yellow, and three stars", () => {
				const amber = svg.indexOf('fill="#f0b400"');
				const yellow = svg.indexOf('fill="#fbe122"');
				expect(amber).toBeGreaterThan(-1);
				expect(yellow).toBeGreaterThan(amber);
				expect(count(svg, /<use class="petal-back"/g)).toBeGreaterThanOrEqual(
					20,
				);
				expect(count(svg, /<use class="petal-back"/g)).toBe(
					count(svg, /<use class="petal-front"/g),
				);
				expect(count(svg, /<path class="star"/g)).toBe(3);
			});

			it("keeps the frame small: each petal drawn once and reused", () => {
				expect(frameSvg(kind, "", "x").length).toBeLessThan(8000);
				expect(svg).not.toMatch(/href="(?!#)/);
			});

			it("is self-contained, with explicit colours", () => {
				expect(svg).not.toMatch(/var\(|<script|<image|href="http|<style/);
			});
		});
	}

	it("draws the ring black for personal and light blue for team", () => {
		expect(frameSvg("personal", "", "x")).toMatch(
			/<path class="ring"[^>]* fill="#1c1b13"/,
		);
		expect(frameSvg("team", "", "x")).toMatch(
			/<path class="ring"[^>]* fill="#8cc4f0"/,
		);
	});

	it("gives every badge its own clip id, safe in a page", () => {
		expect(frameSvg("team", "", "a<b c")).toContain(
			'<clipPath id="window-a_b_c">',
		);
	});

	it("escapes the title", () => {
		expect(frameSvg("team", "", "a<b&c")).toContain(
			"<title>a&lt;b&amp;c</title>",
		);
	});

	it("draws the stars above the picture", () => {
		const svg = frameSvg("personal", picture, "x");
		expect(svg.indexOf('class="star"')).toBeGreaterThan(svg.indexOf(picture));
	});
});

describe("the ribbon (FR-040b)", () => {
	const picture = '<path fill="#c8641e" d="M0 0H100V100H0Z"/>';
	const ribbonParts = (svg: string) =>
		svg.match(/<[a-z]+ class="ribbon[^"]*"[^>]*>/g) ?? [];

	it("is not in the badge files: the page draws it (issue #180)", () => {
		for (const kind of ["personal", "team"] as const) {
			expect(frameSvg(kind, picture, "x")).not.toContain('class="ribbon');
			expect(placeholderSvg(kind)).not.toContain('class="ribbon');
		}
	});

	for (const [kind, colour] of [
		["personal", "#1c1b13"],
		["team", "#8cc4f0"],
	] as const) {
		it(`is a band with two notched tails in the ${kind} ring colour`, () => {
			const svg = ribbonSvg(kind);
			const parts = ribbonParts(svg);
			expect(
				parts.filter((p) => p.includes('class="ribbon-tail"')),
			).toHaveLength(2);
			expect(parts.filter((p) => p.includes('class="ribbon"'))).toHaveLength(1);
			expect(parts.join("")).toBe(svg);
			for (const part of parts) {
				expect(part).toContain(`fill="${colour}"`);
				expect(part).toContain('stroke="#1c1b13"');
			}
			expect(svg).not.toContain("<text");
		});
	}

	it("stays clear of the stars, so it can lie over the finished badge", () => {
		// The stars sit in the ring's top half; the ribbon starts below the centre.
		expect(RIBBON.box.y).toBeGreaterThan(50);
		expect(RIBBON.box.y + RIBBON.tail.top).toBeGreaterThan(50);
	});

	it("tells the page where the milestone goes and in which colour", () => {
		expect(RIBBON.box.x).toBeGreaterThan(0);
		expect(RIBBON.box.x + RIBBON.box.width).toBeLessThan(100);
		// Covers the bottom of the window, where the prompt keeps 15 % free.
		const { r } = WINDOW;
		const windowBottom = 50 + r;
		const freeFrom = windowBottom - 0.15 * 2 * r;
		expect(RIBBON.box.y).toBeGreaterThanOrEqual(freeFrom - 0.5);
		expect(RIBBON.box.y).toBeLessThan(windowBottom);
		expect(RIBBON.text).toEqual({ personal: "#fbe122", team: "#1c1b13" });
	});
});

describe("placeholderSvg", () => {
	for (const kind of ["personal", "team"] as const) {
		it(`shows the coin's Rynke in the ${kind} frame, colours inlined`, () => {
			const svg = placeholderSvg(kind);
			expect(svg).toContain(`<title>placeholder-${kind}</title>`);
			expect(svg).toContain('fill="#c8641e"');
			expect(svg).toContain('fill="#f0a868"');
			expect(svg).not.toContain('class="c-');
			expect(svg).not.toMatch(/var\(|<style/);
		});
	}
});
