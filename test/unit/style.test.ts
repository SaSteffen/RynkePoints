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

	it("breaks a word in main only when it can't fit a line of its own (#115)", () => {
		const main = declsOf("main");
		// `anywhere` split words letter by letter on small phones, and
		// hyphenation would split the Rynke words too.
		expect(main["overflow-wrap"]).toBe("break-word");
		expect(main.hyphens).toBeUndefined();
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

	it("draws the switches' links as buttons, not underlined links (#113)", () => {
		expect(declsOf(".segmented")["text-decoration"]).toBe("none");
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

	it("shows the overview as cards below 1100 px and as a table from 1100 px (016 FR-035, research R9)", () => {
		const PHONE = "(max-width:1099.98px)";
		const DESKTOP = "(min-width:1100px)";
		const MEDIUM = "(min-width:840px)";
		// From 840 px the cards sit in two columns and the page spans the window.
		expect(declsOf("ul.rider-cards", MEDIUM)["grid-template-columns"]).toBe(
			"repeat(2,minmax(0,1fr))",
		);
		expect(declsOf("main:has(>.team-overview)", MEDIUM)["max-width"]).toBe(
			"none",
		);
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

	it("pops the revealed badges in, and keeps them still for reduced motion (013 FR-031)", () => {
		expect(STYLE).toContain("@keyframes badge-pop");
		expect(declsOf(".badges-reveal-pictures img").animation).toContain(
			"badge-pop",
		);
		expect(
			declsOf(".badges-reveal-pictures img", "(prefers-reduced-motion:reduce)")
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
		// Without scroll timelines (Firefox) the animation would run at once
		// and leave the bar lifted for good.
		expect(declsOf("header.top-bar").animation).toBeUndefined();
		const bar = declsOf(
			"header.top-bar",
			"@supports (animation-timeline:scroll())",
		);
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

	it("lays the badge cards out two per row at every width (013 FR-002a)", () => {
		expect(declsOf(".badge-cards")["grid-template-columns"]).toBe(
			"repeat(2,minmax(0,1fr))",
		);
		expect(
			RULES.filter(
				(rule) =>
					rule.media !== null && rule.selectors.includes(".badge-cards"),
			),
		).toEqual([]);
		// Name, sentence, badge and bar line up across a row.
		expect(declsOf(".badge-card")["grid-template-rows"]).toBe("subgrid");
		expect(
			declsOf(
				".badge-card:not(.badge-card-empty) .badge-about",
				"(max-width:599.98px)",
			).display,
		).toBe("none");
		// As wide as the card allows, up to 200 px.
		expect(declsOf(".badge-card .badge")).toMatchObject({
			width: "100%",
			"max-width": "200px",
		});
		// A category without a badge: a dotted outline in the badge's place.
		expect(declsOf(".badge-card .badge-slot")).toMatchObject({
			width: "100%",
			"max-width": "200px",
		});
		expect(declsOf(".badge-gallery .badge").width).toBe("96px");
		expect(declsOf(".badge-large .badge")).toMatchObject({
			width: "280px",
			"max-width": "100%",
		});
	});

	it("puts the milestone on the ribbon's box, yellow on personal and ink on team (013 FR-040b)", () => {
		expect(declsOf(".badge-ribbon-text")).toMatchObject({
			left: "13%",
			top: "70%",
			width: "74%",
			height: "14%",
			color: "var(--rp-coin-yellow)",
		});
		expect(declsOf(".badge-group-team .badge-ribbon-text").color).toBe(
			"var(--rp-coin-ink)",
		);
	});

	it("fills personal bars yellow and team bars team blue (013 FR-002c)", () => {
		expect(declsOf(".badges .bar>span").background).toBe(
			"var(--rp-coin-yellow)",
		);
		expect(declsOf(".badge-group-team .bar>span").background).toBe(
			"var(--rp-coin-team)",
		);
	});

	it("lines figures up with tabular numbers (FR-036)", () => {
		expect(declsOf("body")["font-variant-numeric"]).toBe("tabular-nums");
	});

	it("pins the page progress bar to the top, below the status bar (issue #108)", () => {
		expect(declsOf(".page-loading")).toMatchObject({
			position: "fixed",
			top: "env(safe-area-inset-top)",
			"pointer-events": "none",
		});
		expect(Number(declsOf(".page-loading")["z-index"])).toBeGreaterThan(
			Number(declsOf("nav.app-nav")["z-index"]),
		);
		expect(declsOf(".page-loading::before").animation).toContain(
			"page-loading",
		);
		expect(
			declsOf(".page-loading::before", "(prefers-reduced-motion:reduce)"),
		).toMatchObject({ width: "100%", animation: "none" });
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

	// Chrome-only so far: outside `@supports` they would leave Firefox (and
	// older Safari) with a half-applied rule, as the top bar's lift did.
	const NOT_EVERYWHERE = [
		/^animation-timeline$/,
		/^animation-range/,
		/^(scroll|view)-timeline/,
		/^anchor-name$/,
		/^position-anchor$/,
		/^position-try/,
		/^position-area$/,
		/^field-sizing$/,
		/^interpolate-size$/,
		/^text-box/,
		/^corner-shape$/,
		/^reading-flow$/,
		/\banchor\(|\bcalc-size\(|\bsibling-(index|count)\(|\bif\(|base-select/,
	];

	it("keeps features some browsers lack inside @supports", () => {
		const unguarded = RULES.filter(
			(rule) => !rule.media?.startsWith("@supports"),
		).flatMap((rule) =>
			Object.entries(rule.decls).flatMap(([prop, value]) =>
				NOT_EVERYWHERE.some((p) => p.test(prop) || p.test(value))
					? [`${rule.selectors.join(",")} ${prop}:${value}`]
					: [],
			),
		);
		expect(unguarded).toEqual([]);
	});

	describe.each([
		".button",
		".button-outlined",
		".danger",
		".segmented",
		".segmented-group label",
		".icon-button",
	])("press feedback on %s (issue #107)", (selector) => {
		it("lays a state layer in the button's own colour over it", () => {
			expect(declsOf(`${selector}::before`)).toMatchObject({
				position: "absolute",
				background: "currentColor",
				opacity: "0",
			});
			expect(declsOf(selector).overflow).toBe("hidden");
		});

		it("shows the layer on hover only where the pointer can hover", () => {
			expect(declsOf(`${selector}:hover::before`)).toEqual({});
			expect(
				declsOf(`${selector}:hover::before`, "(hover:hover)").opacity,
			).toBe(".08");
		});

		it("shows a stronger layer when pressed and no ripple runs", () => {
			expect(
				Number(
					declsOf(`:root:not(.ripples) ${selector}:active::before`).opacity,
				),
			).toBeGreaterThan(0.08);
		});
	});

	it("shrinks a pressed button a little, except with reduced motion", () => {
		for (const selector of [".button", ".button-outlined", ".danger"]) {
			expect(declsOf(`${selector}:active`).transform).toBeUndefined();
			expect(
				declsOf(`${selector}:active`, "(prefers-reduced-motion:no-preference)")
					.transform,
			).toBe("scale(.96)");
		}
	});

	it("keeps joined segments in place when pressed", () => {
		expect(declsOf(".segmented:active").transform).toBeUndefined();
	});

	it("blocks a busy button and spins only without reduced motion", () => {
		expect(declsOf(".button[aria-busy=true]")["pointer-events"]).toBe("none");
		expect(declsOf(".button[aria-busy=true]::after").animation).toContain(
			"busy-spin",
		);
		expect(
			declsOf(
				".button[aria-busy=true]::after",
				"(prefers-reduced-motion:reduce)",
			).animation,
		).toBe("none");
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
