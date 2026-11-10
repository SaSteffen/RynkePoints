import { describe, expect, it } from "vitest";
import { BADGES, surpriseName } from "../../src/badges/catalog";
import { BADGE_NAMES } from "../../src/content/badge-names/hamburg.de";
import { hintLinesFor } from "../../src/content/hints";
import { HINTS_DE } from "../../src/content/hints/de";
import { HINTS_EN } from "../../src/content/hints/en";
import type {
	FormattedValues,
	HintLines,
	LineId,
	SurpriseLineId,
} from "../../src/content/hints/types";
import { CATALOGS } from "../../src/i18n/catalogs";
import { europe } from "../../src/teams/europe";
import { hamburg } from "../../src/teams/hamburg";

// Feature 034 contracts/hint-lines.md: German and English, picked by the
// team, veiled surprise lines (SC-005).

const SETS: HintLines[] = [HINTS_DE, HINTS_EN];

const SURPRISE: SurpriseLineId[] = [
	"newYear",
	"christmasEve",
	"christmas",
	"festive500",
	"nightOwl",
	"earlyBird",
	"restDay",
	"stageRider",
	"triathlon",
	"piDay",
	"solsticeDecember",
	"solsticeJune",
	"easter",
	"everesting",
	"winterSleep",
];

const VALUES: FormattedValues = {
	n: "38",
	best: "55",
	next: "100",
	left: "11",
	month: "November",
};

const all = (set: HintLines, ids = Object.keys(set.lines) as LineId[]) =>
	ids.flatMap((id) => set.lines[id].map((say) => say(VALUES)));

describe("hint lines", () => {
	it("the team picks the language, never the rider (FR-014)", () => {
		expect(hintLinesFor(hamburg)).toBe(HINTS_DE);
		expect(hintLinesFor(europe)).toBe(HINTS_EN);
	});

	it("both languages have the label, the link and the month names", () => {
		expect(HINTS_DE).toMatchObject({ label: "Tipp", more: "Zur Karte" });
		expect(HINTS_EN).toMatchObject({ label: "Tip", more: "To the card" });
		expect(HINTS_DE.monthName(11)).toBe("November");
		expect(HINTS_DE.monthName(3)).toBe("März");
		expect(HINTS_EN.monthName(2)).toBe("February");
	});

	it("both languages have the same lines and variant counts", () => {
		for (const id of Object.keys(HINTS_DE.lines) as LineId[]) {
			expect(HINTS_EN.lines[id].length, id).toBe(HINTS_DE.lines[id].length);
		}
	});

	it("fills every placeholder", () => {
		for (const set of SETS) {
			for (const line of all(set)) {
				expect(line).not.toMatch(/undefined|\{|\}/);
			}
		}
		expect(HINTS_DE.lines.winterSeveral[0](VALUES)).toBe(
			"Noch 38 Tage draußen auf dem Rad bis zum nächsten November-Abzeichen. Der November hat noch 11 Tage.",
		);
		expect(HINTS_EN.lines.distance[0]({ n: "1,234" })).toBe(
			"1,234 km to your next distance badge.",
		);
	});

	it("never speaks as the monkey (FR-014)", () => {
		for (const set of SETS) {
			for (const line of all(set)) {
				expect(line).not.toMatch(/^(Ich|I) |\bich\b|\bI'm\b|\bI\b/);
			}
		}
	});

	it("every surprise rule has at least two nudges per language (FR-010)", () => {
		for (const set of SETS) {
			for (const id of SURPRISE) {
				expect(set.lines[id].length, id).toBeGreaterThanOrEqual(2);
			}
		}
	});

	it("no surprise line names its badge or gives its rule away (SC-005)", () => {
		const catalogName = (locale: "de" | "en", id: string) => {
			const name: unknown =
				CATALOGS[locale][`badge.name.${id}` as keyof (typeof CATALOGS)["de"]];
			return typeof name === "string" ? name : "";
		};
		const names = BADGES.filter((b) => surpriseName(b) !== null).flatMap(
			(b) => [
				BADGE_NAMES[b.id] ?? "",
				catalogName("de", b.id),
				catalogName("en", b.id),
			],
		);
		const figures = [
			"21:30",
			"6:00",
			"06:00",
			"500",
			"100 km",
			"70",
			"31,4",
			"31.4",
			"8848",
			"8.848",
			"8,848",
			"7 Tage",
			"7 days",
		];
		for (const set of SETS) {
			for (const line of all(set, SURPRISE)) {
				for (const name of names.filter(Boolean)) {
					expect(line, name).not.toContain(name);
				}
				for (const figure of figures) {
					expect(line, figure).not.toContain(figure);
				}
			}
		}
	});
});
