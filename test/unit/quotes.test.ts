import { describe, expect, it } from "vitest";
import {
	QUOTES_ON_TRACK,
	QUOTES_PUSH,
} from "../../src/i18n/messages/quotes.de";

// The Team page's two German quote lists (016 FR-020–FR-024, research R10):
// pins the committed lists.

describe.each([
	["QUOTES_PUSH", QUOTES_PUSH],
	["QUOTES_ON_TRACK", QUOTES_ON_TRACK],
])("%s", (_name, quotes) => {
	it("has at least 180 quotes", () => {
		expect(quotes.length).toBeGreaterThanOrEqual(180);
	});

	it("has no duplicates", () => {
		expect(new Set(quotes).size).toBe(quotes.length);
	});

	it("has no empty or whitespace-only quote", () => {
		expect(quotes.filter((quote) => quote.trim() === "")).toEqual([]);
	});

	it("uses no * or / as a gender mark", () => {
		expect(quotes.filter((quote) => /[*/]in(nen)?\b/.test(quote))).toEqual([]);
	});
});

it("shares no quote between the two lists", () => {
	const push = new Set<string>(QUOTES_PUSH);
	expect(QUOTES_ON_TRACK.filter((quote) => push.has(quote))).toEqual([]);
});
