import type { I18n } from "./i18n";

// A place as the `{place}` of the `team.place` messages (feature 016
// contracts/messages.md "Ordinals"): `1st`, `2nd`, `3rd`, `4th`, `11th` in
// English, `1.` in German and any other language.

const ENGLISH_SUFFIXES: Record<string, string> = {
	one: "st",
	two: "nd",
	few: "rd",
	other: "th",
};

const englishOrdinals = new Intl.PluralRules("en", { type: "ordinal" });

export function formatPlace(i18n: I18n, place: number): string {
	const n = i18n.formatNumber(place, { fractionDigits: 0 });
	if (i18n.locale !== "en") return `${n}.`;
	return `${n}${ENGLISH_SUFFIXES[englishOrdinals.select(place)] ?? "th"}`;
}
