import { describe, expect, it } from "vitest";
import { BADGE_RIBBON_MASK } from "../../src/badges/outline";
import { STYLE } from "../../src/http/style";
import { THEMES } from "../../src/http/themes";
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
		"summary",
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
		// The page-switch show's pieces sit in a fixed overlay that clips them.
		const inShow = (rule: (typeof RULES)[number]) =>
			rule.selectors.every((s) => s.startsWith(".show-"));
		const wide = RULES.filter(
			(rule) => rule.media !== WIDE && !inShow(rule),
		).flatMap((rule) =>
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

	it("puts the gold-rimmed hero cards on the hero's soft black (016, the draft)", () => {
		for (const card of [
			".team-total",
			".hero",
			".overview-deadline",
			".qualified",
		]) {
			expect(declsOf(card)).toMatchObject({
				background: "var(--rp-hero)",
				border: "2px solid var(--rp-coin-rim)",
			});
		}
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

	it("draws the quote as a white comic bubble without a heading", () => {
		expect(declsOf(".quote")).toMatchObject({
			"--rp-quote-edge": "var(--rp-coin-ink)",
			"--rp-quote-fill": "var(--rp-bubble)",
			border: "2px solid var(--rp-quote-edge)",
			background: "var(--rp-quote-fill)",
			color: "var(--rp-coin-ink)",
		});
		expect(declsOf(".quote-heading")).toEqual({});
	});

	it("draws the quote as Rynke's speech bubble on the team total (the Quote Monkey draft, option B)", () => {
		// The bubble's tail curves towards the monkey on its left, in its
		// colours: the outline under the fill, cut out by the same shape.
		expect(declsOf(".quote::before").background).toBe("var(--rp-quote-edge)");
		expect(declsOf(".quote::after").background).toBe("var(--rp-quote-fill)");
		expect(declsOf(".quote::before").mask).toContain("var(--rp-quote-tail)");
		// The monkey stands on the team total's edge, drawn over it, its
		// traced edges softened by a slight outline blur and a shadow.
		expect(declsOf(".quote-monkey").margin).toBe("0 0 -22px");
		expect(declsOf(".quote-monkey-art")).toMatchObject({
			position: "relative",
			"z-index": "1",
			width: "120px",
			filter: "var(--rp-quote-art-shadow)",
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
		expect(STYLE).toContain("@keyframes badge-slap");
		expect(declsOf(".badges-reveal-pictures img").animation).toContain(
			"badge-slap",
		);
		expect(
			declsOf(".badges-reveal-pictures img", "(prefers-reduced-motion:reduce)")
				.animation,
		).toBe("none");
	});

	it("turns the waiting coin over, and keeps it still for reduced motion (015 FR-007)", () => {
		expect(STYLE).toContain("@keyframes coin-flip");
		expect(declsOf(".coin-flip-turn").animation).toContain("coin-flip");
		expect(
			declsOf(".coin-flip-turn", "(prefers-reduced-motion:reduce)").animation,
		).toBe("none");
	});

	it("shows each face of the turning coin only from its own side", () => {
		// Spinning one face showed it mirrored, text and all, half the time.
		expect(declsOf(".coin-flip-turn")["transform-style"]).toBe("preserve-3d");
		expect(declsOf(".coin-flip .coin-art")["backface-visibility"]).toBe(
			"hidden",
		);
		expect(declsOf(".coin-flip .coin-flip-back").transform).toBe(
			"rotateY(180deg)",
		);
		// Larger than the other large coins: it is the waiting page's picture.
		expect(declsOf(".waiting .coin-flip").width).toBe("192px");
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

	it("keeps the top bar's colour while the page scrolls", () => {
		const lift = STYLE.match(/@keyframes top-bar-lift\{(.*?\})\}/)?.[1];
		expect(lift).toBeDefined();
		expect(lift).not.toContain("background");
	});

	it("keeps the navigation in the top bar while the page scrolls from 600 px (#62)", () => {
		expect(declsOf("nav.app-nav", WIDE).position).toBe("fixed");
		expect(Number(declsOf("nav.app-nav")["z-index"])).toBeGreaterThan(
			Number(declsOf("header.top-bar")["z-index"]),
		);
	});

	it("keeps the badges switch under the top bar and filters with it (013 Part I)", () => {
		expect(declsOf(".badges-switch")).toMatchObject({
			position: "sticky",
			top: "calc(var(--rp-topbar-height) + env(safe-area-inset-top))",
		});
		const all = ".badges:has(.badges-filter [value=all]:checked)";
		const newest = ".badges:not(:has(.badges-filter [value=all]:checked))";
		for (const selector of [
			`${all} .badge-cards`,
			`${all} .badges-title-newest`,
			`${newest} .badge-gallery`,
			`${newest} .badges-title-all`,
		]) {
			expect(declsOf(selector).display, selector).toBe("none");
		}
	});

	it("fills the page's width with badge cards, at least two per row (013 FR-002a)", () => {
		expect(declsOf("main:has(>.badges)")["max-width"]).toBe("none");
		expect(declsOf(".badge-cards")["grid-template-columns"]).toBe(
			"repeat(auto-fill,minmax(min(176px,calc(50% - var(--rp-space-3) / 2)),1fr))",
		);
		expect(
			RULES.filter(
				(rule) =>
					rule.media !== null && rule.selectors.includes(".badge-cards"),
			),
		).toEqual([]);
		// Name, badge or outline, and bar line up across a row.
		expect(declsOf(".badge-card")["grid-template-rows"]).toBe("subgrid");
		expect(declsOf(".badge-card")["grid-row"]).toBe("span 3");
		expect(declsOf(".badge-card>.badge")["grid-row"]).toBe("2");
		expect(declsOf(".badge-card>.badge-slot")["grid-row"]).toBe("2");
		expect(declsOf(".badge-card>.badge-progress")["grid-row"]).toBe("3");
		// As wide as the card allows, up to 200 px.
		expect(declsOf(".badge-card .badge")).toMatchObject({
			width: "100%",
			"max-width": "200px",
		});
		// A category without a badge: a dashed outline in the badge's place.
		expect(declsOf(".badge-card .badge-slot")).toMatchObject({
			width: "100%",
			"max-width": "200px",
		});
		expect(declsOf(".badge-gallery .badge").width).toBe("96px");
		expect(declsOf(".badge-gallery")["grid-template-columns"]).toBe(
			"repeat(auto-fill,minmax(min(360px,100%),1fr))",
		);
		// Stickers: a cut-out edge with a shadow in both schemes, a small tilt
		// that straightens on hover and focus, a lift while pressed.
		// The edge goes round the picture and the ribbon drawn over it as one.
		expect(declsOf(".badge-art").filter).toBe("var(--rp-badge-edge)");
		expect(declsOf(".badge img").filter).toBeUndefined();
		expect(declsOf(":root")["--rp-badge-edge"]).toContain("drop-shadow");
		expect(declsOf("button.badge").transform).toBe("rotate(var(--tilt,0deg))");
		expect(declsOf("button.badge:hover").transform).toBe("none");
		expect(declsOf("button.badge:active .badge-art").filter).toBe(
			"var(--rp-badge-lift)",
		);
		expect(
			declsOf("button.badge", "(prefers-reduced-motion:reduce)").transition,
		).toBe("none");
		expect(declsOf(".badge-large .badge")).toMatchObject({
			width: "280px",
			"max-width": "100%",
		});
		// Hover holds the large view open beside the mouse, letting the
		// pointer through; leaving closes it, so no close button.
		expect(declsOf(".badge-large-hover")).toMatchObject({
			inset: "auto",
			"pointer-events": "none",
		});
		expect(declsOf(".badge-large-hover .badge-large-close").display).toBe(
			"none",
		); // Opening the large view shines its badge once; the shine is the
		// cards' own band, masked to the picture.
		expect(
			declsOf(
				".badge-large:popover-open .badge::after",
				"(prefers-reduced-motion:no-preference)",
			).animation,
		).toContain("badge-shine-new");
		// The mask only while the shine runs, so the pictures load lazily
		// (issue #181); with the ribbon drawn over the picture where it has one.
		const masked = (selector: string) =>
			RULES.find((rule) => rule.selectors.includes(selector) && rule.decls.mask)
				?.decls.mask;
		expect(masked(".badge-large .badge::after")).toBeUndefined();
		expect(masked("button.badge::after")).toBeUndefined();
		for (const selector of [
			"button.badge:hover::after",
			"button.badge:focus-visible::after",
			".badge-fresh::after",
		])
			expect(masked(selector)).toBe(
				"var(--badge-src) center/contain no-repeat",
			);
		for (const selector of [
			"button.badge:hover:has(.badge-ribbon)::after",
			"button.badge:focus-visible:has(.badge-ribbon)::after",
			".badge-fresh:has(.badge-ribbon)::after",
			".badge-large:popover-open .badge::after",
		])
			expect(masked(selector)).toBe(
				`var(--badge-src) center/contain no-repeat,${BADGE_RIBBON_MASK} center/contain no-repeat`,
			);
		expect(STYLE.match(/[{;]mask:var\(--badge-src\)/g)).toHaveLength(2);
	});

	it("puts the milestone on the ribbon's box, yellow on personal and ink on team (013 FR-040b)", () => {
		expect(declsOf(".badge-ribbon-text")).toMatchObject({
			left: "13%",
			top: "70%",
			width: "74%",
			height: "14%",
			// A softer yellow than the ribbon's own, lighter and spaced, with a
			// faint glow: easier on the eyes on the black band (Part G).
			color: "var(--rp-ribbon-text)",
			"letter-spacing": ".04em",
		});
		expect(declsOf(":root")["--rp-ribbon-text"]).toBe("#f7e27c");
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
			).toBe(selector === ".button" ? ".18" : ".08");
		});

		it("shows a stronger layer when pressed and no ripple runs", () => {
			expect(
				Number(
					declsOf(`:root:not(.ripples) ${selector}:active::before`).opacity,
				),
			).toBeGreaterThan(0.08);
		});
	});

	it("makes the filled button's hover show on black and on yellow", () => {
		expect(
			declsOf(".button:hover", "(hover:hover)")["box-shadow"],
		).toBeDefined();
		expect(
			Number(declsOf(":root:not(.ripples) .button:active::before").opacity),
		).toBeGreaterThan(0.18);
	});

	it("draws an icon button as the bare icon, without the browser's button", () => {
		expect(declsOf(".icon-button")).toMatchObject({
			padding: "0",
			border: "0",
			background: "none",
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

	describe("the one set of controls (022 contracts/controls.md)", () => {
		const CONTROL = "var(--rp-type-control)";
		const OUTLINE = "var(--rp-outline-width)";

		it.each([
			".button",
			".button-outlined",
			".button-text",
			".danger",
			".segmented",
			".segmented-group label",
			".chip[aria-pressed]",
			".segmented-group.badges-filter label",
			".list-scope .segmented",
			"summary",
			".more>summary",
			".ride-why>summary",
			".event-button",
		])("gives %s the control type and the 44 px height", (selector) => {
			expect(declsOf(selector).font).toBe(CONTROL);
			expect(declsOf(selector)["min-height"]).toBe("var(--rp-tap)");
		});

		it("gives icon buttons 44 × 44 px and the open state primary-container", () => {
			expect(declsOf(".icon-button")).toMatchObject({
				"min-width": "var(--rp-tap)",
				"min-height": "var(--rp-tap)",
				"border-radius": "var(--md-shape-full)",
			});
			expect(declsOf(".icon-button[aria-expanded=true]")).toMatchObject({
				background: "var(--md-sys-color-primary-container)",
				color: "var(--md-sys-color-on-primary-container)",
			});
		});

		it("draws filled, outlined, text and danger buttons as the canvas does", () => {
			const base = declsOf(".button");
			expect(base).toMatchObject({
				padding: "0 20px",
				"border-radius": "var(--md-shape-full)",
				border: "0",
				background: "var(--md-sys-color-primary)",
				color: "var(--md-sys-color-on-primary)",
			});
			expect(declsOf(".button-outlined")).toMatchObject({
				border: `${OUTLINE} solid transparent`,
				"border-color": "var(--md-sys-color-outline)",
				color: "var(--rp-primary-text)",
			});
			expect(declsOf(".button-text")).toMatchObject({
				padding: "0 var(--rp-space-3)",
				border: "0",
				color: "var(--rp-primary-text)",
			});
			expect(declsOf(".danger")).toMatchObject({
				"border-color": "var(--md-sys-color-error)",
				color: "var(--md-sys-color-error)",
			});
		});

		it("joins segments into a pill with the outline width", () => {
			expect(declsOf(".segmented").border).toBe(
				`${OUTLINE} solid var(--md-sys-color-outline)`,
			);
			expect(declsOf(".segmented+.segmented")["margin-left"]).toBe(
				`calc(-1 * ${OUTLINE})`,
			);
			expect(declsOf("nav.kind-switch")).toEqual({
				display: "flex",
				margin: "0 0 var(--rp-space-3)",
			});
		});

		it("draws filter chips 36 px high inside a 44 px tap area with 8 px corners", () => {
			const chip = declsOf(".chip[aria-pressed]");
			expect(chip).toMatchObject({
				"border-width": "4px 0",
				"border-radius": "var(--md-shape-sm)/12px",
				"box-shadow": `inset 0 0 0 ${OUTLINE} var(--md-sys-color-outline)`,
				color: "var(--md-sys-color-on-surface)",
			});
			expect(declsOf(".segmented-group.badges-filter label")).toEqual(chip);
			expect(declsOf(".list-scope .segmented")).toEqual(chip);
		});

		it.each([
			".segmented[aria-current]",
			".segmented[aria-pressed=true]",
			".segmented-group label:has(:checked)",
			".chip[aria-pressed=true]",
			".segmented-group.badges-filter label:has(:checked)",
			".list-scope .segmented[aria-current]",
		])("marks %s as selected in primary-container", (selector) => {
			const decls = declsOf(selector);
			expect(decls.background).toMatch(
				/^var\(--md-sys-color-primary-container\)( padding-box)?$/,
			);
			expect(decls.color).toBe("var(--md-sys-color-on-primary-container)");
		});

		it("draws status chips 28 px high with 8 px corners and the status type", () => {
			expect(declsOf(".chip")).toMatchObject({
				"min-height": "28px",
				padding: "0 10px",
				"border-radius": "var(--md-shape-sm)",
				font: "var(--rp-type-status)",
			});
			expect(declsOf(".status-chip")).toMatchObject({
				"min-height": "28px",
				"border-radius": "var(--md-shape-sm)",
				font: "var(--rp-type-status)",
			});
			for (const selector of [
				".chip-alert",
				".chip-team",
				".event-amounts .chip",
			]) {
				expect(declsOf(selector)["min-height"]).toBeUndefined();
				expect(declsOf(selector)["font-weight"]).toBeUndefined();
			}
		});

		it("opens every disclosure the same way, chevron after the text", () => {
			expect(declsOf("summary")).toMatchObject({
				color: "var(--rp-primary-text)",
				"list-style": "none",
			});
			expect(declsOf("summary::after")).toMatchObject({
				width: "14px",
				height: "14px",
				background: "currentColor",
			});
			expect(declsOf("details[open]>summary::after").transform).toBe(
				"rotate(180deg)",
			);
			for (const selector of [
				".progress-table summary",
				".rider-breakdown summary",
			]) {
				expect(declsOf(selector)).toEqual({});
			}
		});

		it("leaves no control with its own type, outline or 40 px height", () => {
			const control =
				/(^|[\s>+~,])(\.button|\.button-outlined|\.button-text|\.danger|\.segmented|\.icon-button|\.chip|\.status-chip|summary|\.event-button)\b/;
			const offending = RULES.filter((rule) =>
				rule.selectors.some(
					(sel) => control.test(sel) && !/svg|::(before|after)/.test(sel),
				),
			).flatMap((rule) =>
				Object.entries(rule.decls)
					.filter(
						([prop, value]) =>
							(prop === "font" &&
								!/^var\(--rp-type-(control|status)\)$/.test(value)) ||
							prop === "font-weight" ||
							(/^border(-width)?$/.test(prop) && /\b[12]px\b/.test(value)) ||
							(prop === "min-height" && value === "40px"),
					)
					.map(
						([prop, value]) => `${rule.selectors.join(",")} ${prop}:${value}`,
					),
			);
			expect(offending).toEqual([]);
		});
	});

	describe("the themes (022 contracts/themes.md, theme-menu.md)", () => {
		it.each(
			THEMES.filter((t) => Object.keys(t.tokens).length > 0).map((t) => t.id),
		)("overrides the base scheme for %s after the base rules", (id) => {
			const theme = THEMES.find((t) => t.id === id);
			expect(declsOf(`:root[data-theme=${id}]`)).toEqual(theme?.tokens);
			expect(STYLE.indexOf(`:root[data-theme=${id}]{`)).toBeGreaterThan(
				STYLE.indexOf(":root[data-scheme=light]{"),
			);
		});

		it("has no rule for Rynke Tag and Nacht, the base schemes", () => {
			expect(STYLE).not.toContain(":root[data-theme=rynke-day]{");
			expect(STYLE).not.toContain(":root[data-theme=rynke-night]{");
		});

		it.each(THEMES.map((t) => t.id))(
			"gives the %s tile its own colours",
			(id) => {
				const { bg, hero, pc, primary, card, text } =
					THEMES.find((t) => t.id === id)?.preview ?? {};
				expect(declsOf(`[data-theme-preview=${id}]`)).toEqual({
					"--preview-bg": bg,
					"--preview-hero": hero,
					"--preview-pc": pc,
					"--preview-primary": primary,
					"--preview-card": card,
					"--preview-text": text,
				});
			},
		);

		it("colours hero cards with the hero tokens", () => {
			for (const card of [
				".team-total",
				".hero",
				".overview-deadline",
				".qualified",
			]) {
				expect(declsOf(card).color).toBe("var(--rp-on-hero)");
			}
			for (const accent of [
				".team-total-value",
				".hero-total",
				".overview-deadline .overview-deadline-count",
				".qualified h2",
			]) {
				expect(declsOf(accent).color).toBe("var(--rp-hero-accent)");
			}
		});

		it("colours links, outlined and text buttons and summaries with the primary text", () => {
			for (const selector of [
				"a",
				".button-outlined",
				".button-text",
				"summary",
			]) {
				expect(declsOf(selector).color).toBe("var(--rp-primary-text)");
			}
		});

		it("underlines text buttons and edges status chips in the contrast themes", () => {
			for (const id of ["contrast-light", "contrast-dark"]) {
				expect(
					declsOf(`:root[data-theme=${id}] .button-text`)["text-decoration"],
				).toBe("underline");
				expect(declsOf(`:root[data-theme=${id}] .chip`).border).toBe(
					"var(--rp-outline-width) solid currentColor",
				);
			}
		});

		it("draws the palette button open in primary-container", () => {
			expect(declsOf(".icon-button[aria-expanded=true]").background).toBe(
				"var(--md-sys-color-primary-container)",
			);
		});

		it("lays the menu out as the canvas does", () => {
			expect(declsOf(".theme-menu")).toMatchObject({
				position: "fixed",
				right: "8px",
				width: "330px",
				"max-width": "calc(100vw - 16px)",
				"overflow-y": "auto",
				padding: "16px",
				"border-radius": "16px",
				background: "var(--md-sys-color-surface-container-high)",
				color: "var(--md-sys-color-on-surface)",
			});
			expect(declsOf(".theme-grid")).toMatchObject({
				display: "grid",
				"grid-template-columns": "repeat(2,minmax(0,1fr))",
				gap: "8px",
			});
			expect(declsOf(".theme-tile:has(:checked)")["box-shadow"]).toBe(
				"0 0 0 3px var(--rp-primary-text)",
			);
		});

		it("truncates the section title rather than the header's buttons", () => {
			expect(declsOf("h1.section-title")).toMatchObject({
				overflow: "hidden",
				"white-space": "nowrap",
				"text-overflow": "ellipsis",
			});
		});
	});

	it("fills the page's width with ride cards, as many per row as fit", () => {
		expect(declsOf("main:has(>#rides>.ride-list)")["max-width"]).toBe("none");
		expect(declsOf("ol.ride-list")["grid-template-columns"]).toBe(
			"repeat(auto-fill,minmax(min(280px,100%),1fr))",
		);
		expect(
			RULES.filter(
				(rule) =>
					rule.media !== null && rule.selectors.includes("ol.ride-list"),
			),
		).toEqual([]);
	});

	it("widens Team, Settings and both event lists to the content width from 840 px", () => {
		const MEDIUM = "(min-width:840px)";
		for (const page of [
			"main:has(>.team-grid)",
			"main:has(>.settings-grid)",
			"main:has(>.events)",
			"main:has(>section.organiser>ul.organiser-events)",
		]) {
			expect(declsOf(page)["max-width"]).toBeUndefined();
			expect(declsOf(page, MEDIUM)["max-width"]).toBe("var(--rp-content-max)");
		}
		// The leaderboard gets a column of its own beside the other team cards.
		expect(declsOf(".team-grid>.leaderboard", MEDIUM)).toMatchObject({
			"grid-column": "2",
			"grid-row": "1/-1",
		});
		expect(declsOf(".settings-grid", MEDIUM).columns).toBe("2");
		expect(declsOf(".settings-group")["break-inside"]).toBe("avoid");
		// Both labels of an event button share one cell, so hovering never
		// widens it and wraps it away from the pointer in a narrower card.
		expect(declsOf(".event-button>.event-next")["grid-area"]).toBe("1/1");
		expect(declsOf(".event-button .event-next").visibility).toBe("hidden");
		// The new-event form keeps its width.
		expect(declsOf(".organiser>.organiser-form", MEDIUM)["max-width"]).toBe(
			"40rem",
		);
	});

	it("spins while older rides load, only without reduced motion (018 R6)", () => {
		const spinner = ".rides-more[data-state=loading] .rides-status::before";
		expect(declsOf(spinner).animation).toContain("busy-spin");
		const reduced = declsOf(spinner, "(prefers-reduced-motion:reduce)");
		expect(reduced.animation).toBe("none");
	});

	it("keeps the 'more rides loaded' note for screen readers only (018 R6)", () => {
		const added = declsOf(".rides-more[data-state=added] .rides-status");
		expect(added.position).toBe("absolute");
		expect(added.width).toBe("1px");
		expect(added.overflow).toBe("hidden");
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

	// Feature 022 US3, contracts/fun-decorations.md (FR-030–FR-033).
	describe("the fun themes' decorations", () => {
		const FUN = [":root[data-theme=confetti]", ":root[data-theme=disco]"];
		const BANDS = [
			"#ff4566",
			"#ff7a2e",
			"#ffb31a",
			"#ffe61a",
			"#a6f21f",
			"#2bea7c",
			"#14e6cf",
			"#1fd0ff",
			"#3fa9ff",
			"#8a7dff",
			"#c45cff",
			"#ff4fb4",
		];
		const REDUCED = "(prefers-reduced-motion:reduce)";
		const ANIMATIONS =
			/(?<![\w-])(shimmer|twinkle|fall|glow|discobadge)(?![\w-])/;
		const decorates = (rule: (typeof RULES)[number]) =>
			rule.selectors.some((s) => /\.fun-|\.theme-badge/.test(s)) ||
			Object.values(rule.decls).some(
				(v) => /var\(--rp-rainbow/.test(v) || ANIMATIONS.test(v),
			);

		it("holds the twelve bands in the rainbow, and twice round in the loop", () => {
			const root = declsOf(":root");
			expect(root["--rp-rainbow"]).toBe(
				`linear-gradient(90deg,${BANDS.join(",")})`,
			);
			expect(root["--rp-rainbow-loop"]).toBe(
				`linear-gradient(90deg,${[...BANDS, ...BANDS, BANDS[0]].join(",")})`,
			);
		});

		it("scopes every decoration to Konfetti or Disco", () => {
			const loose = RULES.filter(decorates)
				.filter((rule) => !rule.selectors.includes(".theme-sparkle"))
				.filter(
					(rule) =>
						!(
							rule.decls.display === "none" &&
							Object.keys(rule.decls).length === 1
						),
				)
				.flatMap((rule) => rule.selectors)
				.filter((s) => !FUN.some((root) => s.startsWith(`${root} `)));
			expect(loose).toEqual([]);
		});

		it("hides the decorations' elements outside the fun themes", () => {
			for (const piece of [".fun-sparkles", ".fun-bursts", ".theme-badge"]) {
				expect(declsOf(piece).display).toBe("none");
			}
		});

		it.each(FUN)("never lets a decoration catch a tap in %s", (root) => {
			for (const piece of [
				"body::before",
				"header.top-bar::after",
				".hero::before",
				".team-total::before",
				".overview-deadline::before",
				".qualified::before",
				".fun-sparkles",
				".fun-bursts",
				".theme-badge",
			]) {
				expect(declsOf(`${root} ${piece}`)["pointer-events"]).toBe("none");
			}
		});

		it.each(FUN)(
			"stops every decoration under reduced motion in %s",
			(root) => {
				const moving = RULES.filter(
					(rule) =>
						rule.media === null &&
						ANIMATIONS.test(rule.decls.animation ?? "") &&
						rule.selectors.some((s) => s.startsWith(`${root} `)),
				).flatMap((rule) =>
					rule.selectors.filter((s) => s.startsWith(`${root} `)),
				);
				expect(moving.length).toBeGreaterThan(5);
				for (const selector of moving) {
					expect(declsOf(selector, REDUCED).animation, selector).toBe("none");
				}
				expect(declsOf(`${root} .fun-bursts`, REDUCED).display).toBe("none");
			},
		);

		it.each(FUN)(
			"gives only the single fill the rainbow in %s (FR-020)",
			(root) => {
				expect(declsOf(`${root} .gauge-fill`).background).toContain(
					"var(--rp-rainbow-loop)",
				);
				const parts = RULES.filter((rule) =>
					rule.selectors.some((s) => s.includes("gauge-part")),
				).filter((rule) =>
					Object.values(rule.decls).some((v) => v.includes("--rp-rainbow")),
				);
				expect(parts).toEqual([]);
			},
		);

		it.each(FUN)("writes on the rainbow in the coin's ink in %s", (root) => {
			for (const piece of [
				"nav.app-nav a[aria-current=page] .nav-icon",
				".badges-reveal",
			]) {
				const decls = declsOf(`${root} ${piece}`);
				expect(decls.background).toContain("var(--rp-rainbow");
				expect(decls.color).toBe("var(--rp-coin-ink)");
			}
		});
	});

	// Feature 022 US4, contracts/page-switch-show.md (FR-040–FR-047).
	describe("the page-switch shows", () => {
		it("lays the show over everything, header, nav and menu included", () => {
			const show = declsOf(".show");
			expect(show).toMatchObject({ position: "fixed", inset: "0" });
			const above = Number(show["z-index"]);
			for (const piece of [
				"header.top-bar",
				"nav.app-nav",
				".page-loading",
				".theme-menu",
			]) {
				expect(above).toBeGreaterThan(Number(declsOf(piece)["z-index"]));
			}
		});

		it("grows the rainbow past any viewport's corners", () => {
			const rainbow = declsOf(".show-rainbow");
			expect(rainbow.width).toBe("max(2000px,220vmax)");
			expect(rainbow.height).toBe("max(2000px,220vmax)");
			expect(rainbow.animation).toMatch(/^show-rainbow 3\.2s /);
		});

		it("fades the surface for reduced motion", () => {
			expect(declsOf(".show-fade")).toMatchObject({
				background: "var(--md-sys-color-surface)",
				animation: "show-fade .25s ease-in forwards",
			});
		});
	});
});
