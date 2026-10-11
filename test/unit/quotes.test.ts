import { afterEach, describe, expect, it, vi } from "vitest";
import { pickQuote, seasonOf } from "../../src/http/sections/team";
import {
	QUOTES_ON_TRACK,
	QUOTES_PUSH,
	SEASON_QUOTES_ON_TRACK,
	SEASON_QUOTES_PUSH,
	type Season,
} from "../../src/i18n/messages/quotes.de";

// The Team page's two German quote lists and their season lists (016
// FR-020–FR-025, research R10): pins the committed lists and the season rule.

const SEASONS: Season[] = ["spring", "summer", "autumn", "winter"];

/** A list's quotes for any time of year plus all its season quotes. */
function everyQuote(
	quotes: readonly string[],
	seasons: Record<Season, readonly string[]>,
): string[] {
	return [...quotes, ...SEASONS.flatMap((season) => seasons[season])];
}

describe.each([
	["QUOTES_PUSH", QUOTES_PUSH, SEASON_QUOTES_PUSH],
	["QUOTES_ON_TRACK", QUOTES_ON_TRACK, SEASON_QUOTES_ON_TRACK],
])("%s", (_name, quotes, seasons) => {
	const all = everyQuote(quotes, seasons);

	it("has at least 200 quotes for any time of year", () => {
		expect(quotes.length).toBeGreaterThanOrEqual(200);
	});

	it("has no duplicates, its season quotes included", () => {
		expect(new Set(all).size).toBe(all.length);
	});

	it("has no empty or whitespace-only quote", () => {
		expect(all.filter((quote) => quote.trim() === "")).toEqual([]);
	});

	it("uses no * or / as a gender mark", () => {
		expect(all.filter((quote) => /[*/]in(nen)?\b/.test(quote))).toEqual([]);
	});
});

it("shares no quote between the two lists", () => {
	const push = new Set(everyQuote(QUOTES_PUSH, SEASON_QUOTES_PUSH));
	expect(
		everyQuote(QUOTES_ON_TRACK, SEASON_QUOTES_ON_TRACK).filter((quote) =>
			push.has(quote),
		),
	).toEqual([]);
});

describe("seasonOf", () => {
	it.each([
		["2026-02-28", "winter"],
		["2026-03-01", "spring"],
		["2026-05-31", "spring"],
		["2026-06-01", "summer"],
		["2026-08-31", "summer"],
		["2026-09-01", "autumn"],
		["2026-11-30", "autumn"],
		["2026-12-01", "winter"],
		["2027-01-15", "winter"],
	])("puts %s in %s", (date, season) => {
		expect(seasonOf(date)).toBe(season);
	});
});

describe("pickQuote", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	/** The quotes pickQuote gives for `status` on `date` with random 0 to `tries` − 1. */
	function everyPick(
		status: "push" | "on_track",
		date: string,
		tries: number,
	): string[] {
		const random = vi.spyOn(crypto, "getRandomValues");
		const picks = new Set<string>();
		for (let value = 0; value < tries; value++) {
			random.mockImplementationOnce((array) => {
				if (array instanceof Uint32Array) array[0] = value;
				return array;
			});
			picks.add(pickQuote(status, date).text);
		}
		return [...picks];
	}

	it.each([
		["push", "2026-07-15", "summer", QUOTES_PUSH, SEASON_QUOTES_PUSH],
		["push", "2027-01-15", "winter", QUOTES_PUSH, SEASON_QUOTES_PUSH],
		[
			"on_track",
			"2026-04-15",
			"spring",
			QUOTES_ON_TRACK,
			SEASON_QUOTES_ON_TRACK,
		],
		[
			"on_track",
			"2026-10-15",
			"autumn",
			QUOTES_ON_TRACK,
			SEASON_QUOTES_ON_TRACK,
		],
	] as const)(
		"gives a %s rider on %s the list and its %s quotes, no other season's (FR-025)",
		(status, date, season, quotes, seasons) => {
			const expected = [...quotes, ...seasons[season]];
			// Twice the expected size, so a larger pool would show its extra quotes.
			expect(everyPick(status, date, 2 * expected.length).sort()).toEqual(
				expected.sort(),
			);
		},
	);
});
