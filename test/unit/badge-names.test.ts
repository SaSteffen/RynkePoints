import { describe, expect, it } from "vitest";
import { BADGES } from "../../src/badges/catalog";
import { BADGE_NAMES } from "../../src/i18n/messages/badges.de";

// German-only badge names (feature 013 FR-041, research R20,
// contracts/badge-messages.md): one per badge of the catalog.

describe("badge names", () => {
	it("names exactly the catalog's badges", () => {
		expect(Object.keys(BADGE_NAMES).sort()).toEqual(
			BADGES.map((b) => b.id).sort(),
		);
	});

	it("has no empty name and no name twice", () => {
		const names = Object.values(BADGE_NAMES).map((n) => n.trim());
		expect(names.filter((n) => n === "")).toEqual([]);
		expect(new Set(names).size).toBe(names.length);
	});
});
