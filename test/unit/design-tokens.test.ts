import { describe, expect, it } from "vitest";
import { SCHEME_SCRIPT } from "../../src/http/html";
import { declsOf, RULES } from "../support/css";

// The colour tokens of both schemes (feature 011 contracts/design-tokens.md;
// FR-031–FR-033, FR-035, SC-006): the same names in light and dark, readable
// contrast for the pairs the pages use, and colours only through tokens.

declare global {
	interface ImportMeta {
		glob(
			pattern: string,
			options: { query: "?raw"; import: "default"; eager: true },
		): Record<string, string>;
	}
}

const APP_JS =
	Object.values(
		import.meta.glob("../../public/app.js", {
			query: "?raw",
			import: "default",
			eager: true,
		}),
	)[0] ?? "";

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

	it("gives the head script the surface colours (research R6, R12)", () => {
		const [, dark, light] =
			SCHEME_SCRIPT.match(/"dark" \? "(#[0-9a-f]{6})" : "(#[0-9a-f]{6})"/) ??
			[];
		expect(light).toBe(LIGHT[md("surface")]);
		expect(dark).toBe(DARK_FIXED[md("surface")]);
	});

	it("gives the scheme picker in app.js the surface colours (FR-032a)", () => {
		const [, light, dark] =
			APP_JS.match(
				/THEME_COLOR = \{ light: "(#[0-9a-f]{6})", dark: "(#[0-9a-f]{6})" \}/,
			) ?? [];
		expect(light).toBe(LIGHT[md("surface")]);
		expect(dark).toBe(DARK_FIXED[md("surface")]);
	});

	it("uses colours only through var(--…) outside the token blocks (FR-031)", () => {
		const literal = /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|\b(white|black)\b/i;
		const offending = RULES.filter(
			(rule) =>
				!rule.selectors.every((s) =>
					/^:root(\[data-scheme=\w+\]|:not\(\[data-scheme=light\]\))?$/.test(s),
				),
		).flatMap((rule) =>
			Object.entries(rule.decls)
				.filter(([, value]) => literal.test(value))
				.map(([prop, value]) => `${rule.selectors.join(",")} ${prop}:${value}`),
		);
		expect(offending).toEqual([]);
	});
});
