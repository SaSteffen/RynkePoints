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
	it("has the spec's 13 categories with their groups, units and ladders", () => {
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
			7,
		);
	});

	it("keeps every ladder strictly increasing", () => {
		for (const { ladder } of BADGE_CATEGORIES)
			for (let i = 1; i < ladder.length; i++)
				expect(ladder[i]).toBeGreaterThan(ladder[i - 1] as number);
	});

	it("derives 69 badges in catalog order with ids from category and threshold", () => {
		expect(BADGES).toHaveLength(69);
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
		expect(badgeById("team-training-rynke-500")?.threshold).toBe(500);
		expect(badgeById("nope")).toBeUndefined();
		expect(new Set(BADGES.map((b) => b.id)).size).toBe(69);
	});

	it("has an integer version of at least 1", () => {
		expect(Number.isInteger(BADGE_CATALOG_VERSION)).toBe(true);
		expect(BADGE_CATALOG_VERSION).toBeGreaterThanOrEqual(1);
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
