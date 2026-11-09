import { describe, expect, it } from "vitest";
import { COMMON_EN } from "../../src/content/phrases/common.en";
import { HAMBURG_PHRASES } from "../../src/content/phrases/hamburg.de";
import type { PhraseSet, Season } from "../../src/content/types";
import { TEAMS } from "../../src/teams";

// The common English phrases (feature 026 contracts/phrases.md › Checks): the
// stand-in for every team without phrases of its own, so they name no team or
// place.

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

const LONGEST_HAMBURG = Math.max(
	...everyPhrase(HAMBURG_PHRASES).map((phrase) => phrase.length),
);
const DENIED = ["Hamburg", "Rynkeby", "Paris", ...TEAMS.map((t) => t.name)];

it("has at least one push and one on-track phrase per season", () => {
	for (const season of SEASONS) {
		expect(COMMON_EN.seasonPush[season].length).toBeGreaterThan(0);
		expect(COMMON_EN.seasonOnTrack[season].length).toBeGreaterThan(0);
	}
});

describe("the common phrases", () => {
	const set = COMMON_EN;
	const all = everyPhrase(set);

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
