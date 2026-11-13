import { describe, expect, it } from "vitest";
import {
	FIXABLE_REASONS,
	REASON_CODES,
	type ReasonCode,
} from "../../src/rynke/rides";

// Every reason a ride doesn't count is sorted: a crop on Strava can remove it
// (the re-check's fast lane, feature 036 FR-012), or it can't. A new reason
// code fails here until it is sorted.

const NOT_FIXABLE: readonly ReasonCode[] = [
	"outside_window",
	"excluded_sport_type",
	"flagged",
	"manual",
];

describe("FIXABLE_REASONS", () => {
	it("are exactly pause, too slow, too fast, climbing rate and overlap", () => {
		expect([...FIXABLE_REASONS].sort()).toEqual(
			["climbing_rate", "overlap", "pause", "too_fast", "too_slow"].sort(),
		);
	});

	it("together with the not fixable ones are every reason code, once", () => {
		expect([...FIXABLE_REASONS, ...NOT_FIXABLE].sort()).toEqual(
			[...REASON_CODES].sort(),
		);
	});
});
