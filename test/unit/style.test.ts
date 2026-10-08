import { describe, expect, it } from "vitest";
import { STYLE } from "../../src/http/style";
import { declsOf, RULES } from "../support/css";

// The stylesheet's phone guarantees, read from its rules since workerd can't
// measure pixels (feature 011 FR-022, FR-023, research R15,
// contracts/pages.md "Control size").

const PHONE_PX = 360;
const WIDE = "(min-width:600px)";

/** A length in px, or null when it isn't a fixed `px`/`rem` length. */
function px(value: string): number | null {
	const m = value.match(/^(\d+(?:\.\d+)?)(px|rem)$/);
	if (!m) return null;
	return Number(m[1]) * (m[2] === "rem" ? 16 : 1);
}

describe("STYLE", () => {
	it("sets the tap size token to 44 px", () => {
		expect(declsOf(":root")["--rp-tap"]).toBe("44px");
	});

	it.each([
		"nav.app-nav a",
		".icon-button",
		".button",
		".button-outlined",
		".segmented",
		".tap",
		".ride-why>summary",
		"[role=switch]",
		".danger",
		".segmented-group label",
	])("gives %s the 44 px tap height", (selector) => {
		expect(declsOf(selector)["min-height"]).toBe("var(--rp-tap)");
	});

	it("breaks long words in main", () => {
		expect(declsOf("main")["overflow-wrap"]).toBe("anywhere");
	});

	it(`sets no width above ${PHONE_PX} px below 600 px`, () => {
		const wide = RULES.filter((rule) => rule.media !== WIDE).flatMap((rule) =>
			["width", "min-width"].flatMap((prop) => {
				const value = rule.decls[prop];
				const length = value === undefined ? null : px(value);
				return length !== null && length > PHONE_PX
					? [`${rule.selectors.join(",")} ${prop}:${value}`]
					: [];
			}),
		);
		expect(wide).toEqual([]);
	});

	it("keeps the last card and the footer above the bottom bar and the home indicator", () => {
		expect(declsOf("body.shell")["padding-bottom"]).toContain(
			"env(safe-area-inset-bottom)",
		);
	});

	it("shows keyboard focus on the label of a hidden scheme radio (FR-014)", () => {
		expect(declsOf(".segmented-group label:has(:focus-visible)").outline).toBe(
			declsOf(":focus-visible").outline,
		);
	});

	it("centres the Team placeholder under a large tinted icon (FR-013)", () => {
		expect(declsOf(".placeholder")).toMatchObject({
			display: "flex",
			"flex-direction": "column",
			"align-items": "center",
			"text-align": "center",
		});
		expect(declsOf(".placeholder svg")).toMatchObject({
			width: "96px",
			height: "96px",
			"border-radius": "var(--md-shape-full)",
			background: "var(--md-sys-color-primary-container)",
			color: "var(--md-sys-color-on-primary-container)",
		});
	});

	it("lines figures up with tabular numbers (FR-036)", () => {
		expect(declsOf("body")["font-variant-numeric"]).toBe("tabular-nums");
	});

	it("turns the transitions off for reduced motion (FR-038)", () => {
		const reduced = RULES.filter(
			(rule) => rule.media === "(prefers-reduced-motion:reduce)",
		);
		expect(reduced.length).toBeGreaterThan(0);
		for (const rule of reduced) {
			expect(rule.decls.transition).toMatch(/^none(!important)?$/);
		}
	});

	it("loads nothing from another origin (FR-037)", () => {
		expect(STYLE).not.toContain("@import");
		expect(STYLE).not.toMatch(/url\(\s*["']?(https?:)?\/\//);
	});

	describe.each(["pbs", "cws"])(
		"the two .%s images (FR-034, research R13)",
		(image) => {
			const DARK_SYSTEM = "(prefers-color-scheme:dark)";
			const SYSTEM = ":root:not([data-scheme=light])";
			const FIXED = ":root[data-scheme=dark]";

			it("shows only the light one by default", () => {
				expect(declsOf(`.${image}-dark`).display).toBe("none");
				expect(declsOf(`.${image}-light`).display).not.toBe("none");
			});

			it.each([
				["a dark system", DARK_SYSTEM, SYSTEM],
				["a fixed dark choice", null, FIXED],
			])("shows only the dark one for %s", (_name, media, root) => {
				expect(declsOf(`${root} .${image}-light`, media).display).toBe("none");
				const dark = declsOf(`${root} .${image}-dark`, media).display;
				expect(dark).toBeDefined();
				expect(dark).not.toBe("none");
			});
		},
	);
});
