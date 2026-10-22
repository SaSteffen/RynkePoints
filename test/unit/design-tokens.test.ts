import { describe, expect, it } from "vitest";
import { THEMES } from "../../src/http/themes";
import { declsOf, RULES } from "../support/css";

// The colour tokens of both schemes (feature 011 contracts/design-tokens.md;
// FR-031–FR-033, FR-035, SC-006): the same names in light and dark, readable
// contrast for the pairs the pages use, and colours only through tokens.

type Tokens = Record<string, string>;

const HEX = /^#[0-9a-f]{6}$/;

/** The custom properties in `decls` whose value is a colour. */
function colours(decls: Record<string, string>): Tokens {
	return Object.fromEntries(
		Object.entries(decls).filter(
			([name, value]) => name.startsWith("--") && HEX.test(value),
		),
	);
}

const LIGHT = colours(declsOf(":root"));
const DARK_SYSTEM = colours(
	declsOf(":root:not([data-scheme=light])", "(prefers-color-scheme:dark)"),
);
const DARK_FIXED = colours(declsOf(":root[data-scheme=dark]"));

const SCHEMES: [string, Tokens][] = [
	["light", LIGHT],
	["dark", DARK_FIXED],
];

/** WCAG relative luminance of a `#rrggbb` colour. */
function luminance(hex: string): number {
	const [r, g, b] = [1, 3, 5].map((at) => {
		const c = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
		return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	}) as [number, number, number];
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
		number,
		number,
	];
	return (hi + 0.05) / (lo + 0.05);
}

const md = (role: string) => `--md-sys-color-${role}`;

/** contracts/design-tokens.md "Contrast pairs checked by the test". */
const TEXT_PAIRS: [string, string][] = [
	[md("on-surface"), md("surface")],
	[md("on-surface-variant"), md("surface")],
	[md("on-surface-variant"), md("surface-container")],
	[md("primary"), md("surface")],
	[md("primary"), md("surface-container")],
	[md("on-primary-container"), md("primary-container")],
	[md("on-secondary-container"), md("secondary-container")],
	[md("on-error-container"), md("error-container")],
	[md("error"), md("surface")],
	[md("on-primary"), md("primary")],
	["--rp-on-ok-container", "--rp-ok-container"],
	["--rp-on-push-container", "--rp-push-container"],
	["--rp-on-neutral-container", "--rp-neutral-container"],
];

const GAUGE = [1, 2, 3, 4, 5, 6].map((n) => `--rp-part-${n}`);

describe("design tokens", () => {
	it("gives both schemes the contract's surface (Team Rynkeby colours)", () => {
		expect(LIGHT[md("surface")]).toBe("#fffdf5");
		expect(DARK_FIXED[md("surface")]).toBe("#12110c");
	});

	it("defines the same colour names in both schemes", () => {
		const names = Object.keys(LIGHT).sort();
		expect(names.length).toBeGreaterThan(20);
		expect(Object.keys(DARK_FIXED).sort()).toEqual(names);
		expect(Object.keys(DARK_SYSTEM).sort()).toEqual(names);
	});

	it("keeps the coin's colours in both schemes (012 FR-005)", () => {
		const coin = (tokens: Tokens) =>
			Object.entries(tokens).filter(([name]) => name.startsWith("--rp-coin-"));
		expect(coin(LIGHT).length).toBeGreaterThan(5);
		expect(coin(DARK_FIXED)).toEqual(coin(LIGHT));
	});

	it("gives controls one type, one status type and one outline width (022 contracts/controls.md)", () => {
		expect(declsOf(":root")).toMatchObject({
			"--rp-type-control": "600 14px/20px var(--md-ref-typeface)",
			"--rp-type-status": "600 12px/16px var(--md-ref-typeface)",
			"--rp-outline-width": "1px",
		});
	});

	it.each([
		["light", declsOf(":root")],
		[
			"system dark",
			declsOf(":root:not([data-scheme=light])", "(prefers-color-scheme:dark)"),
		],
		["fixed dark", declsOf(":root[data-scheme=dark]")],
	])(
		"names the hero text, hero accent and primary text in %s (022 contracts/themes.md)",
		(_scheme, decls) => {
			expect(decls).toMatchObject({
				"--rp-primary-text": "var(--md-sys-color-primary)",
				"--rp-on-hero": "var(--rp-coin-face)",
				"--rp-hero-accent": "var(--rp-coin-yellow)",
			});
		},
	);

	it("uses the same dark values for the system and a fixed choice", () => {
		expect(DARK_SYSTEM).toEqual(DARK_FIXED);
	});

	it("sets color-scheme the same way (research R6)", () => {
		expect(declsOf(":root")["color-scheme"]).toBe("light dark");
		expect(
			declsOf(":root:not([data-scheme=light])", "(prefers-color-scheme:dark)")[
				"color-scheme"
			],
		).toBe("dark");
		expect(declsOf(":root[data-scheme=dark]")["color-scheme"]).toBe("dark");
		expect(declsOf(":root[data-scheme=light]")["color-scheme"]).toBe("light");
	});

	describe.each(SCHEMES)("%s", (_scheme, tokens) => {
		it.each(TEXT_PAIRS)("%s on %s reaches 4.5 : 1", (fg, bg) => {
			expect(tokens[fg]).toMatch(HEX);
			expect(tokens[bg]).toMatch(HEX);
			expect(
				contrast(tokens[fg] as string, tokens[bg] as string),
			).toBeGreaterThanOrEqual(4.5);
		});

		it("outline on surface reaches 3 : 1", () => {
			expect(
				contrast(
					tokens[md("outline")] as string,
					tokens[md("surface")] as string,
				),
			).toBeGreaterThanOrEqual(3);
		});

		it("keeps the gauge parts and the track apart (FR-035)", () => {
			const values = [...GAUGE, "--rp-track"].map((name) => tokens[name]);
			for (const value of values) expect(value).toMatch(HEX);
			expect(new Set(values).size).toBe(values.length);
			expect(tokens["--rp-reached"]).not.toBe(tokens["--rp-track"]);
		});
	});

	it("gives the progress lines their validated colours (009 research R12)", () => {
		const lines = (tokens: Tokens) => ({
			training: tokens["--rp-line-training"],
			team: tokens["--rp-line-team"],
			outside: tokens["--rp-line-outside"],
			threshold: tokens["--rp-line-threshold"],
			pace: tokens["--rp-line-pace"],
		});
		expect(lines(LIGHT)).toEqual({
			training: "#8a6e00",
			team: "#1f6fb2",
			outside: "#7b4fa0",
			threshold: "#a6344f",
			pace: "#2b9667",
		});
		expect(lines(DARK_FIXED)).toEqual({
			training: "#a88e00",
			team: "#4a94d2",
			outside: "#a77fd0",
			threshold: "#d64651",
			pace: "#24a684",
		});
	});

	describe.each(SCHEMES)("progress lines, %s", (_scheme, tokens) => {
		it.each([
			"--rp-line-training",
			"--rp-line-team",
			"--rp-line-outside",
			"--rp-line-threshold",
			"--rp-line-pace",
		])("%s on the surface reaches 3 : 1 (FR-050)", (line) => {
			expect(
				contrast(tokens[line] as string, tokens[md("surface")] as string),
			).toBeGreaterThanOrEqual(3);
		});
	});

	it("takes the canvas's gauge track and fill in Rynke Tag and Nacht (022 FR-017)", () => {
		expect(LIGHT["--rp-track"]).toBe("#e3dcc0");
		expect(LIGHT["--rp-reached"]).toBe("#1c1b13");
		expect(DARK_FIXED["--rp-track"]).toBe("#3a382c");
		expect(DARK_FIXED["--rp-reached"]).toBe("#fbe122");
		expect(DARK_SYSTEM["--rp-reached"]).toBe("#fbe122");
	});

	it("previews Rynke Tag and Nacht in the base schemes' colours", () => {
		const day = THEMES.find((t) => t.id === "rynke-day")?.preview;
		const night = THEMES.find((t) => t.id === "rynke-night")?.preview;
		expect(day?.bg).toBe(LIGHT[md("surface")]);
		expect(day?.primary).toBe(LIGHT[md("primary")]);
		expect(day?.card).toBe(LIGHT[md("surface-container")]);
		expect(night?.bg).toBe(DARK_FIXED[md("surface")]);
		expect(night?.primary).toBe(DARK_FIXED[md("primary")]);
		expect(night?.card).toBe(DARK_FIXED[md("surface-container")]);
	});

	it("uses colours only through var(--…) outside the token blocks (FR-031)", () => {
		const literal = /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|\b(white|black)\b/i;
		const offending = RULES.filter(
			(rule) =>
				!rule.selectors.every((s) =>
					/^:root(\[data-scheme=\w+\]|:not\(\[data-scheme=light\]\)|\[data-theme=[\w-]+\])?$|^\[data-theme-preview=[\w-]+\]$/.test(
						s,
					),
				),
		).flatMap((rule) =>
			Object.entries(rule.decls)
				.filter(([, value]) => literal.test(value))
				.map(([prop, value]) => `${rule.selectors.join(",")} ${prop}:${value}`),
		);
		expect(offending).toEqual([]);
	});

	it("writes the coin's ink readably on every band of the rainbow (022 FR-031, R10)", () => {
		const bands = declsOf(":root")["--rp-rainbow"]?.match(/#[0-9a-f]{6}/g);
		expect(bands).toHaveLength(12);
		for (const band of bands ?? []) {
			expect(contrast("#1c1b13", band), band).toBeGreaterThanOrEqual(4.5);
		}
	});

	// Feature 022 research R10: every theme, its base scheme plus its own
	// rule, resolved through var(--…), checked pair by pair (FR-018, SC-003).
	describe.each(THEMES.map((t) => [t.id, t] as const))(
		"theme %s",
		(id, theme) => {
			const base = declsOf(
				theme.scheme === "light" ? ":root" : ":root[data-scheme=dark]",
			);
			const own = declsOf(`:root[data-theme=${id}]`);
			const decls: Record<string, string> = { ...base, ...own };
			const value = (name: string, depth = 0): string => {
				const v = decls[name] ?? "";
				const ref = v.match(/^var\((--[\w-]+)\)$/);
				return ref && depth < 5 ? value(ref[1] as string, depth + 1) : v;
			};
			const text = theme.group === "contrast" ? 7 : 4.5;

			it("has its own rule with exactly its tokens", () => {
				expect(own).toEqual(theme.tokens);
			});

			it.each([
				...TEXT_PAIRS,
				["--rp-primary-text", md("surface")],
				["--rp-primary-text", md("surface-container")],
				["--rp-primary-text", md("surface-container-high")],
				[md("on-surface"), md("surface-container")],
				[md("on-surface"), md("surface-container-high")],
				["--rp-on-hero", "--rp-hero"],
				["--rp-hero-label", "--rp-hero"],
				["--rp-hero-accent", "--rp-hero"],
			])(`%s on %s reaches ${text} : 1`, (fg, bg) => {
				expect(value(fg)).toMatch(HEX);
				expect(value(bg)).toMatch(HEX);
				expect(contrast(value(fg), value(bg))).toBeGreaterThanOrEqual(text);
			});

			it.each([
				[md("outline"), md("surface")],
				[md("outline"), md("surface-container")],
				["--rp-line-training", md("surface")],
				["--rp-line-team", md("surface")],
				["--rp-line-outside", md("surface")],
				["--rp-line-threshold", md("surface")],
				["--rp-line-pace", md("surface")],
			])("%s on %s reaches 3 : 1", (fg, bg) => {
				expect(contrast(value(fg), value(bg))).toBeGreaterThanOrEqual(3);
			});

			it("keeps the gauge's fill apart from its track", () => {
				expect(value("--rp-reached")).not.toBe(value("--rp-track"));
			});
		},
	);
});
