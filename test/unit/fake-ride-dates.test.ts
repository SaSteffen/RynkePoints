import { describe, expect, it } from "vitest";
import {
	type RideRecipe,
	recipeDay,
	recipeToActivity,
	ride,
} from "../../dev/fake-strava/samples";

// Where the fake mode puts a sample ride from before the season start: on the
// season start once the season has begun, so its rides count; seeded before
// it, on its own day, so a rider connecting then has rides but no Rynke
// (Europe's season starts on 1 January, feature 039).

const START = "2027-01-01";
const dateOf = (recipe: RideRecipe, seedDay: string) =>
	recipeToActivity(recipe, seedDay, START, "0").start_date_local.slice(0, 10);
const dayOf = (seedDay: string, daysAgo: number) =>
	dateOf(ride(daysAgo, "10:00", 40, 200, 24), seedDay);
const onDate = (monthDay: string): RideRecipe => ({
	...ride(0, "10:00", 40, 200, 24),
	onDate: monthDay,
});
const onEaster = (offset: number): RideRecipe => ({
	...ride(0, "10:00", 40, 200, 24),
	onEaster: offset,
});

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

// A ride on a set day of the season (a holiday, a winter month, Easter) is on
// that day of this season once it has begun, the "Pretend a day" showcase;
// seeded before it, on that day of the season before, so nothing is dated
// after today and a rider connecting before 1 January has 0 Rynke.
describe("a sample ride on a set day of the season", () => {
	it("is in this season once it has begun", () => {
		expect(dateOf(onDate("03-14"), "2027-01-05")).toBe("2027-03-14");
		expect(dateOf(onEaster(1), "2027-01-05")).toBe("2027-03-29");
	});

	it("is on the season's solstice, which moves with the year", () => {
		const onSolstice = (month: 6 | 12): RideRecipe => ({
			...ride(0, "10:00", 40, 200, 24),
			onSolstice: month,
		});
		expect(dateOf(onSolstice(6), "2027-01-05")).toBe("2027-06-21");
		expect(dateOf(onSolstice(12), "2027-01-05")).toBe("2027-12-22");
		expect(
			recipeToActivity(
				onSolstice(6),
				"2028-03-01",
				"2027-09-01",
				"0",
			).start_date_local.slice(0, 10),
		).toBe("2028-06-20");
	});

	it("is in the season before when seeded before the season", () => {
		expect(dateOf(onDate("03-14"), "2026-11-18")).toBe("2026-03-14");
		expect(dateOf(onDate("01-01"), "2026-11-18")).toBe("2026-01-01");
		expect(dateOf(onEaster(1), "2026-11-18")).toBe("2026-04-06");
	});
});

// The day the seeding counts the rides back from (feature 040): seeded in the
// season before the qualification window opens, the window's last day, so
// Europe's sample rides lie mostly in the window.
describe("the day the sample rides count back from", () => {
	const window = {
		seasonStart: "2026-09-01",
		windowStart: "2027-01-01",
		deadline: "2027-06-30",
	};

	it("is the window's last day when seeded before the window opens", () => {
		expect(recipeDay("2026-11-19", window)).toBe("2027-06-30");
	});

	it("is the seeding day inside the window and before the season", () => {
		expect(recipeDay("2027-03-12", window)).toBe("2027-03-12");
		expect(recipeDay("2026-08-20", window)).toBe("2026-08-20");
	});

	it("is the seeding day when the window opens with the season", () => {
		expect(
			recipeDay("2026-11-19", { ...window, windowStart: "2026-09-01" }),
		).toBe("2026-11-19");
	});
});
