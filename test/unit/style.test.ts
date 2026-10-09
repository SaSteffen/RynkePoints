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
		".organiser-form input",
		".organiser-form select",
		".organiser-event>a",
		".organiser-confirm>summary",
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

	it("lays the kind switch out as full-width segments and the list toggle as chips (016)", () => {
		expect(declsOf("nav.kind-switch").display).toBe("flex");
		expect(declsOf(".kind-switch .segmented").flex).toBe("1");
		expect(declsOf("nav.list-scope").display).toBe("flex");
		expect(declsOf(".list-scope .segmented").flex).toBeUndefined();
	});

	it("marks the viewer's own row in Rynkeby yellow (016, the draft)", () => {
		expect(declsOf("li.row.you").background).toBe(
			"var(--md-sys-color-secondary-container)",
		);
	});

	it("keeps the sparkline small beside the row's figures (016, the draft)", () => {
		expect(declsOf(".sparkline")).toMatchObject({
			width: "96px",
			height: "22px",
		});
	});

	it("puts the team total on the coin's ink with its gold rim (016, the draft)", () => {
		expect(declsOf(".team-total")).toMatchObject({
			background: "var(--rp-coin-ink)",
			border: "2px solid var(--rp-coin-rim)",
		});
	});

	it("fits the peloton and the team chart to the page's width (016 FR-040)", () => {
		expect(declsOf(".peloton-road")).toMatchObject({
			width: "100%",
			height: "auto",
		});
		expect(declsOf(".week-bars").width).toBe("100%");
	});

	it("highlights the current week's bar in the team chart (016 contracts/pages.md)", () => {
		expect(declsOf(".week-bars rect.current").fill).toBe(
			"var(--rp-coin-yellow)",
		);
		expect(declsOf(".week-bars rect").fill).not.toBe(
			declsOf(".week-bars rect.current").fill,
		);
	});

	it("colours the push quote orange and the on-track quote green (016, the draft)", () => {
		expect(declsOf(".quote")).toMatchObject({
			"border-left": "6px solid var(--rp-push-accent)",
			background: "var(--rp-push-container)",
		});
		expect(declsOf(".quote-on-track")).toMatchObject({
			"border-left-color": "var(--rp-ok-accent)",
			background: "var(--rp-ok-container)",
		});
	});

	it("shows the overview as cards below 840 px and as a table from 840 px (016 FR-035, research R9)", () => {
		const PHONE = "(max-width:839.98px)";
		const DESKTOP = "(min-width:840px)";
		expect(declsOf(".table-scroll", PHONE).display).toBe("none");
		expect(
			declsOf(".rider-cards.default .rider-card:not(.status-push)", PHONE)
				.display,
		).toBe("none");
		expect(declsOf("ul.rider-cards", DESKTOP).display).toBe("none");
		expect(declsOf(".table-scroll")["overflow-x"]).toBe("auto");
		// The tile shown by default looks like a picked one.
		expect(declsOf(".group-tiles.default .tile-push", PHONE)).toEqual(
			declsOf(".group-tile[aria-current]"),
		);
		expect(declsOf(".group-tiles.default .tile-all", DESKTOP)).toEqual(
			declsOf(".group-tile[aria-current]"),
		);
		expect(declsOf(".showing-wide", PHONE).display).toBe("none");
		expect(declsOf(".showing-phone", DESKTOP).display).toBe("none");
	});

	it("drops the celebration coins in, and keeps them still for reduced motion (012 FR-002)", () => {
		expect(declsOf(".celebrate-coins .coin-mini").animation).toContain(
			"coin-drop",
		);
		expect(
			declsOf(".celebrate-coins .coin-mini", "(prefers-reduced-motion:reduce)")
				.animation,
		).toBe("none");
	});

	it("spins the waiting coin, and keeps it still for reduced motion (015 FR-007)", () => {
		expect(STYLE).toContain("@keyframes coin-spin");
		expect(declsOf(".waiting .coin").animation).toContain("coin-spin");
		expect(
			declsOf(".waiting .coin", "(prefers-reduced-motion:reduce)").animation,
		).toBe("none");
	});

	it("floats the app prompt above the bottom bar and the home indicator (015 FR-012)", () => {
		const prompt = declsOf(".app-prompt");
		expect(prompt.position).toBe("fixed");
		expect(prompt.bottom).toContain("var(--rp-nav-height)");
		expect(prompt.bottom).toContain("env(safe-area-inset-bottom)");
		// Its buttons are `.tap` and `.icon-button`, 44 px above.
	});

	it("pins the top bar below the status bar, above the content (#62)", () => {
		const bar = declsOf("header.top-bar");
		expect(bar).toMatchObject({ position: "sticky", top: "0" });
		expect(bar.padding).toContain("env(safe-area-inset-top)");
		expect(Number(bar["z-index"])).toBeGreaterThan(0);
		// Scrolled to, a target stops below the bar instead of under it.
		expect(declsOf("html")["scroll-padding-top"]).toContain(
			"var(--rp-topbar-height) + env(safe-area-inset-top)",
		);
	});

	it("lifts the top bar once content scrolls under it (#62)", () => {
		const bar = declsOf("header.top-bar");
		expect(bar.animation).toContain("top-bar-lift");
		expect(bar["animation-timeline"]).toBe("scroll()");
		expect(STYLE).toContain("@keyframes top-bar-lift");
	});

	it("keeps the navigation in the top bar while the page scrolls from 600 px (#62)", () => {
		expect(declsOf("nav.app-nav", WIDE).position).toBe("fixed");
		expect(Number(declsOf("nav.app-nav")["z-index"])).toBeGreaterThan(
			Number(declsOf("header.top-bar")["z-index"]),
		);
	});

	it("lines figures up with tabular numbers (FR-036)", () => {
		expect(declsOf("body")["font-variant-numeric"]).toBe("tabular-nums");
	});

	it("turns the transitions and animations off for reduced motion (FR-038)", () => {
		const reduced = RULES.filter(
			(rule) => rule.media === "(prefers-reduced-motion:reduce)",
		);
		expect(reduced.length).toBeGreaterThan(0);
		for (const rule of reduced) {
			expect(rule.decls.transition ?? rule.decls.animation).toMatch(
				/^none(!important)?$/,
			);
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
