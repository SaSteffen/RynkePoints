import { describe, expect, it } from "vitest";
import { RIBBON } from "../../scripts/badge-frame.mjs";
import { BADGES } from "../../src/badges/catalog";
import {
	BADGE_RIBBON,
	RIBBON_TEXT,
	ribbonTextSize,
} from "../../src/badges/ribbon";
import { milestone } from "../../src/http/sections/badges";
import { CATALOGS } from "../../src/i18n/catalogs";
import { createI18n } from "../../src/i18n/i18n";

// The page writes the milestone into the ribbon the badge file draws (feature
// 013 FR-040b, research R19), so both must agree on where it is.

describe("badge ribbon", () => {
	it("has the frame's box and text colours", () => {
		expect(BADGE_RIBBON.box).toEqual(RIBBON.box);
		expect(BADGE_RIBBON.text).toEqual(RIBBON.text);
	});

	it("gives the box in percent of the badge", () => {
		expect(BADGE_RIBBON.percent).toEqual({
			left: 13,
			top: 70,
			width: 74,
			height: 14,
		});
	});

	it("sizes a short milestone fully and a long one down", () => {
		expect(ribbonTextSize("500\u00a0km")).toBe(RIBBON_TEXT.size);
		expect(ribbonTextSize("Senųjų metų palydos")).toBeLessThan(
			RIBBON_TEXT.size,
		);
	});

	// Every milestone in every language has room on the ribbon at no less
	// than the smallest size; one that has none needs a shorter word.
	it.each(Object.keys(CATALOGS))("fits every milestone in %s", (locale) => {
		const i18n = createI18n(locale, CATALOGS);
		const { room, letter } = RIBBON_TEXT;
		const tooLong = BADGES.map((b) => milestone(i18n, b)).filter(
			(text) => text.length * letter * ribbonTextSize(text) > room,
		);
		expect(tooLong).toEqual([]);
	});
});
