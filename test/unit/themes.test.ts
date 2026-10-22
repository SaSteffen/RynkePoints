import { describe, expect, it } from "vitest";
import { THEMES } from "../../src/http/themes";

// The twelve themes of the header's menu (feature 022 data-model.md "Theme",
// contracts/themes.md).

const HEX = /^#[0-9a-f]{6}$/;

describe("THEMES", () => {
	it("lists the twelve themes in menu order, with group, scheme and fun", () => {
		expect(THEMES.map((t) => [t.id, t.group, t.scheme, t.fun])).toEqual([
			["rynke-day", "light", "light", null],
			["baltic", "light", "light", null],
			["paris", "light", "light", null],
			["lilac", "light", "light", null],
			["confetti", "light", "light", "confetti"],
			["rynke-night", "dark", "dark", null],
			["night-ride", "dark", "dark", null],
			["forest", "dark", "dark", null],
			["plum", "dark", "dark", null],
			["disco", "dark", "dark", "disco"],
			["contrast-light", "contrast", "light", null],
			["contrast-dark", "contrast", "dark", null],
		]);
	});

	it("keeps Rynke Tag and Rynke Nacht as the base schemes (FR-017)", () => {
		for (const id of ["rynke-day", "rynke-night"]) {
			expect(THEMES.find((t) => t.id === id)?.tokens).toEqual({});
		}
	});

	it("draws 2 px outlines in the contrast themes only", () => {
		for (const t of THEMES) {
			expect(t.tokens["--rp-outline-width"]).toBe(
				t.group === "contrast" ? "2px" : undefined,
			);
		}
	});

	it("gives every theme a tile preview in its own colours", () => {
		for (const t of THEMES) {
			const { bg, hero, pc, primary, card, text } = t.preview;
			for (const colour of [bg, hero, pc, primary, card, text]) {
				expect(colour).toMatch(HEX);
			}
			if (t.tokens["--md-sys-color-surface"]) {
				expect(bg).toBe(t.tokens["--md-sys-color-surface"]);
				expect(primary).toBe(t.tokens["--md-sys-color-primary"]);
			}
		}
	});

	it.each([
		["baltic", "#f5fafb", "#0b5874", "#ffd45c", "#0b3a4d", "#c3d5dc"],
		["paris", "#fff8f7", "#7a1d3b", "#ffd9df", "#3a1420", "#e0c4c7"],
		["lilac", "#fcf8ff", "#5e3a8c", "#e6d4ff", "#2c1a42", "#d8cbe6"],
		["confetti", "#fffcf7", "#5a22d6", "#ffe61a", "#2b1460", "#ece4fb"],
		["night-ride", "#0e131c", "#8cc4f0", "#8cc4f0", "#1b2a3e", "#2a3446"],
		["forest", "#0f1612", "#7fcb92", "#7fcb92", "#1d2c22", "#2c3a31"],
		["plum", "#140e19", "#d7a6ec", "#d7a6ec", "#2a1a36", "#33283d"],
		["disco", "#120a22", "#ff5cb8", "#ff5cb8", "#24124a", "#2f2150"],
		["contrast-light", "#ffffff", "#000000", "#ffe600", "#000000", "#ffffff"],
		["contrast-dark", "#000000", "#ffe600", "#ffe600", "#000000", "#000000"],
	])(
		"takes %s's colours from the canvas",
		(id, bg, primary, pc, hero, track) => {
			const t = THEMES.find((x) => x.id === id);
			expect(t?.tokens).toMatchObject({
				"--md-sys-color-surface": bg,
				"--md-sys-color-primary": primary,
				"--md-sys-color-primary-container": pc,
				"--md-sys-color-secondary-container": pc,
				"--rp-hero": hero,
				"--rp-track": track,
			});
		},
	);

	it("gives Disco a lighter pink for text than for filled buttons", () => {
		const disco = THEMES.find((t) => t.id === "disco")?.tokens ?? {};
		expect(disco["--md-sys-color-primary"]).toBe("#ff5cb8");
		expect(disco["--rp-primary-text"]).toBe("#ff8fd1");
	});
});
