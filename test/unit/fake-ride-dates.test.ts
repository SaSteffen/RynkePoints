import { describe, expect, it } from "vitest";
import { recipeToActivity, ride } from "../../dev/fake-strava/samples";

// Where the fake mode puts a sample ride from before the season start: on the
// season start once the season has begun, so its rides count; seeded before
// it, on its own day, so a rider connecting then has rides but no Rynke
// (Europe's season starts on 1 January, feature 039).

const START = "2027-01-01";
const dayOf = (seedDay: string, daysAgo: number) =>
	recipeToActivity(
		ride(daysAgo, "10:00", 40, 200, 24),
		seedDay,
		START,
		0,
	).start_date_local.slice(0, 10);

describe("a sample ride from before the season start", () => {
	it("is moved to the season start once the season has begun", () => {
		expect(dayOf("2027-01-05", 10)).toBe(START);
	});

	it("keeps its own day when seeded before the season", () => {
		expect(dayOf("2026-11-17", 3)).toBe("2026-11-14");
	});

	it("keeps its own day inside the season", () => {
		expect(dayOf("2027-03-12", 3)).toBe("2027-03-09");
	});
});
