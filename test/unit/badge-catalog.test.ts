import { describe, expect, it } from "vitest";
import art from "../../art/badges/badges.json";
import {
	BADGE_CATALOG_VERSION,
	BADGE_CATEGORIES,
	BADGES,
	badgeById,
} from "../../src/badges/catalog";

// The badge catalog (feature 013, data-model.md "Catalog"): the spec's ladders
// (Assumptions table) and the badge ids derived from them, which must match
// the art pipeline's list (research R9, R18; part A's T019).

describe("badge catalog", () => {
	it("has the spec's 22 categories with their groups, units and ladders", () => {
		expect(
			BADGE_CATEGORIES.map((c) => [c.id, c.group, c.unit, c.ladder]),
		).toEqual([
			["distance", "personal", "km", [100, 500, 1000, 2500, 5000]],
			["elevation", "personal", "m", [1000, 5000, 10000, 25000]],
			["team_events", "personal", "events", [1, 5, 10, 20]],
			["technique", "personal", "trainings", [1, 2]],
			[
				"training_rynke",
				"personal",
				"rynke",
				[1, 25, 50, 100, 150, 200, 250, 300, 400, 500],
			],
			["run_length", "personal", "km", [5, 10, 21.0975, 42.195]],
			["running", "personal", "km", [10, 25, 50, 100, 250, 500]],
			["ride_length", "personal", "km", [50, 100, 150, 200, 250, 300]],
			["virtual_rides", "personal", "km", [50, 100, 250, 500, 1000]],
			["swim_length", "personal", "km", [0.5, 1, 1.9, 3.8]],
			["swimming", "personal", "km", [5, 10, 25, 50, 100]],
			["winter_november", "personal", "days", [1, 5, 10]],
			["winter_december", "personal", "days", [1, 5, 10]],
			["winter_january", "personal", "days", [1, 5, 10]],
			["winter_february", "personal", "days", [1, 5, 10]],
			["surprise", "personal", "days", [1, 2, 3, 4, 5, 6]],
			[
				"team_training_rynke",
				"team",
				"rynke",
				[500, 1000, 2500, 5000, 7500, 10000, 15000, 20000],
			],
			[
				"team_distance",
				"team",
				"km",
				[1000, 5000, 10000, 25000, 50000, 100000],
			],
			["team_elevation", "team", "m", [10000, 50000, 100000, 250000, 500000]],
			["team_running", "team", "km", [100, 500, 1000, 2500, 5000]],
			["big_training", "team", "riders", [5, 10, 15, 20, 30]],
			["attendances", "team", "attendances", [25, 50, 100, 200, 400]],
		]);
		expect(BADGE_CATEGORIES.filter((c) => c.group === "personal")).toHaveLength(
			16,
		);
	});

	it("gives each winter category its month and no other category one", () => {
		expect(
			BADGE_CATEGORIES.filter((c) => c.month !== undefined).map((c) => [
				c.id,
				c.month,
			]),
		).toEqual([
			["winter_november", 11],
			["winter_december", 12],
			["winter_january", 1],
			["winter_february", 2],
		]);
	});

	it("keeps every ladder strictly increasing", () => {
		for (const { ladder } of BADGE_CATEGORIES)
			for (let i = 1; i < ladder.length; i++)
				expect(ladder[i]).toBeGreaterThan(ladder[i - 1] as number);
	});

	it("derives 107 badges in catalog order with ids from category and threshold", () => {
		expect(BADGES).toHaveLength(107);
		expect(BADGES.slice(0, 2)).toEqual([
			{
				id: "distance-100",
				group: "personal",
				category: "distance",
				threshold: 100,
			},
			{
				id: "distance-500",
				group: "personal",
				category: "distance",
				threshold: 500,
			},
		]);
		expect(
			BADGES.filter((b) => b.category === "run_length").map((b) => b.id),
		).toEqual([
			"run-length-5",
			"run-length-10",
			"run-length-half",
			"run-length-marathon",
		]);
		expect(
			BADGES.filter((b) => b.category === "swim_length").map((b) => b.id),
		).toEqual([
			"swim-length-500",
			"swim-length-1000",
			"swim-length-1900",
			"swim-length-3800",
		]);
		expect(badgeById("swim-length-1900")?.threshold).toBe(1.9);
		expect(badgeById("winter-february-10")?.category).toBe("winter_february");
		expect(badgeById("team-training-rynke-500")?.threshold).toBe(500);
		expect(badgeById("nope")).toBeUndefined();
		expect(
			BADGES.filter((b) => b.category === "surprise").map((b) => b.id),
		).toEqual([
			"surprise-new-year",
			"surprise-christmas-eve",
			"surprise-christmas",
			"surprise-night-owl",
			"surprise-early-bird",
			"surprise-rest-day",
		]);
		expect(BADGE_CATEGORIES.filter((c) => c.surprise).map((c) => c.id)).toEqual(
			["surprise"],
		);
		expect(new Set(BADGES.map((b) => b.id)).size).toBe(107);
	});

	it("is at version 3 since part D's surprise badges", () => {
		expect(BADGE_CATALOG_VERSION).toBe(3);
	});

	it("lists the same badges as art/badges/badges.json", () => {
		const shape = (b: {
			id: string;
			group: string;
			category: string;
			threshold: number;
		}) => [b.id, b.group, b.category, b.threshold];
		const byId = (a: unknown[], b: unknown[]) =>
			String(a[0]).localeCompare(String(b[0]));
		expect(BADGES.map(shape).sort(byId)).toEqual(
			art.badges.map(shape).sort(byId),
		);
	});
});
