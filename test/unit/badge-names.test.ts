import { describe, expect, it } from "vitest";
import { BADGES } from "../../src/badges/catalog";
import { BADGE_NAMES } from "../../src/i18n/messages/badges.de";
import { de } from "../../src/i18n/messages/de";
import { en } from "../../src/i18n/messages/en";

// German-only badge names (feature 013 FR-041, research R20,
// contracts/badge-messages.md): one per badge of the catalog.

describe("badge names", () => {
	it("names exactly the catalog's badges", () => {
		expect(Object.keys(BADGE_NAMES).sort()).toEqual(
			BADGES.map((b) => b.id).sort(),
		);
	});

	it("names the tour days with stand-ins until Phase 2 (021 FR-010)", () => {
		for (let day = 1; day <= 8; day++) {
			expect(BADGE_NAMES[`tour-de-paris-${day}`]).toBe(`Tour-Tag ${day}`);
		}
	});

	it("has the Tour de Paris category texts in every language (021)", () => {
		for (const catalog of [de, en]) {
			expect(catalog["badges.category.tour_de_paris"]).toBe("Tour de Paris");
			expect(catalog["badges.about.tour_de_paris"]).not.toBe("");
			expect(catalog["badges.tourDay.for"]).toContain("{day}");
		}
		expect(de["badges.about.tour_de_paris"]).toBe(
			"Für jeden Tag, den jemand aus dem Team auf der Tour de Paris fährt.",
		);
		expect(de["badges.tourDay.for"]).toBe(
			"Tag {day} der Tour de Paris – der Ort folgt.",
		);
		expect(en["badges.tourDay.for"]).toBe(
			"Day {day} of the Tour de Paris – the place follows.",
		);
	});

	it("has no empty name and no name twice", () => {
		const names = Object.values(BADGE_NAMES).map((n) => n.trim());
		expect(names.filter((n) => n === "")).toEqual([]);
		expect(new Set(names).size).toBe(names.length);
	});
});
