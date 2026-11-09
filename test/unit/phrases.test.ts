import { describe, expect, it } from "vitest";
import { COMMON_PHRASES } from "../../src/content/phrases/common";
import { COMMON_EN } from "../../src/content/phrases/common.en";
import { HAMBURG_PHRASES } from "../../src/content/phrases/hamburg.de";
import type { PhraseSet, Season } from "../../src/content/types";
import { TEAMS } from "../../src/teams";

// The common phrase sets (feature 026 contracts/phrases.md › Checks): every
// locale keeps the English original's list lengths, so index i adapts index i,
// and no set names a team or a place.

const SEASONS: Season[] = ["spring", "summer", "autumn", "winter"];

/** Every phrase of a set: both lists and their season lists. */
function everyPhrase(set: PhraseSet): string[] {
	return [
		...set.push,
		...set.onTrack,
		...SEASONS.flatMap((season) => [
			...set.seasonPush[season],
			...set.seasonOnTrack[season],
		]),
	];
}

/** The lengths that keep the languages in step. */
function shape(set: PhraseSet) {
	return {
		push: set.push.length,
		onTrack: set.onTrack.length,
		seasonPush: SEASONS.map((season) => set.seasonPush[season].length),
		seasonOnTrack: SEASONS.map((season) => set.seasonOnTrack[season].length),
	};
}

const LONGEST_HAMBURG = Math.max(
	...everyPhrase(HAMBURG_PHRASES).map((phrase) => phrase.length),
);
const DENIED = ["Hamburg", "Rynkeby", "Paris", ...TEAMS.map((t) => t.name)];

it("ships the English original", () => {
	expect(COMMON_PHRASES.en).toBe(COMMON_EN);
});

it("has at least one push and one on-track phrase per season", () => {
	for (const season of SEASONS) {
		expect(COMMON_EN.seasonPush[season].length).toBeGreaterThan(0);
		expect(COMMON_EN.seasonOnTrack[season].length).toBeGreaterThan(0);
	}
});

describe.each(Object.entries(COMMON_PHRASES))("common.%s", (_locale, set) => {
	const all = everyPhrase(set);

	it("has the English original's list lengths", () => {
		expect(shape(set)).toEqual(shape(COMMON_EN));
	});

	it("has no duplicates, its season phrases included", () => {
		expect(new Set(all).size).toBe(all.length);
	});

	it("has no empty or whitespace-only phrase", () => {
		expect(all.filter((phrase) => phrase.trim() === "")).toEqual([]);
	});

	it("has no phrase longer than Hamburg's longest", () => {
		expect(all.filter((phrase) => phrase.length > LONGEST_HAMBURG)).toEqual([]);
	});

	it("uses no * or / as a gender mark", () => {
		expect(all.filter((phrase) => /[*/]in(nen)?\b/.test(phrase))).toEqual([]);
	});

	it("names no team or place", () => {
		expect(
			all.filter((phrase) => DENIED.some((name) => phrase.includes(name))),
		).toEqual([]);
	});

	it("shares no phrase between the push and on-track lists", () => {
		const onTrack = new Set([
			...set.onTrack,
			...SEASONS.flatMap((season) => set.seasonOnTrack[season]),
		]);
		expect(
			[
				...set.push,
				...SEASONS.flatMap((season) => set.seasonPush[season]),
			].filter((phrase) => onTrack.has(phrase)),
		).toEqual([]);
	});
});
