import { describe, expect, it } from "vitest";
import { CATALOGS } from "../../src/i18n/catalogs";
import { createI18n } from "../../src/i18n/i18n";
import { formatPlace } from "../../src/i18n/ordinal";

// The `{place}` of the team.place messages (016 contracts/messages.md
// "Ordinals").

describe("formatPlace", () => {
	it("gives English ordinals, 11th to 13th included", () => {
		const en = createI18n("en", CATALOGS);
		expect(
			[1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map((n) =>
				formatPlace(en, n),
			),
		).toEqual([
			"1st",
			"2nd",
			"3rd",
			"4th",
			"11th",
			"12th",
			"13th",
			"21st",
			"22nd",
			"23rd",
			"101st",
			"111th",
		]);
	});

	it("gives German places with a full stop", () => {
		const de = createI18n("de", CATALOGS);
		expect([1, 6, 14].map((n) => formatPlace(de, n))).toEqual([
			"1.",
			"6.",
			"14.",
		]);
	});
});
