import { describe, expect, it } from "vitest";
import { BADGES } from "../../src/badges/catalog";
import { badgeWindow } from "../../src/badges/evaluate";
import {
	evaluateTeamBadges,
	type TeamBadgeSums,
	type TourDay,
} from "../../src/badges/team";
import { CURRENT_RULES } from "../../src/rynke/rules";

// The Tour de Paris team badges (feature 021 US2, FR-010–FR-013, research
// R11, data-model.md "Tour badge inputs"): badge n once one listed rider has
// n tour days, dated with the earliest tour day some rider reached n on.
// Synthetic riders and dates only.

const SEASON = { seasonStart: "2026-09-01", deadline: "2027-06-30" };
const ANNA = 990101;
const BEN = 990102;

const tour = (athleteId: number, date: string): TourDay => ({
	athleteId,
	date,
});

function evaluate(tourDays: TourDay[], today = "2027-08-15") {
	const sums: TeamBadgeSums = { riders: [], runs: [], events: [], tourDays };
	return evaluateTeamBadges(sums, CURRENT_RULES, badgeWindow(SEASON, today));
}

const tourBadges = (result: ReturnType<typeof evaluate>) =>
	result.earned.filter((b) => b.badgeId.startsWith("tour-de-paris-"));

const progress = (result: ReturnType<typeof evaluate>) =>
	result.progress.find((p) => p.category === "tour_de_paris");

describe("Tour de Paris badges", () => {
	it("gives one rider's first and second tour day a badge each, dated by the day", () => {
		const result = evaluate([
			tour(ANNA, "2027-06-20"),
			tour(ANNA, "2027-06-21"),
		]);
		expect(tourBadges(result)).toEqual([
			{ badgeId: "tour-de-paris-1", earnedOn: "2027-06-20" },
			{ badgeId: "tour-de-paris-2", earnedOn: "2027-06-21" },
		]);
	});

	it("counts per rider: two riders on one day each earn only the first", () => {
		const result = evaluate([
			tour(ANNA, "2027-06-21"),
			tour(BEN, "2027-06-20"),
		]);
		expect(tourBadges(result)).toEqual([
			{ badgeId: "tour-de-paris-1", earnedOn: "2027-06-20" },
		]);
	});

	it("counts tour days after the qualification deadline", () => {
		const result = evaluate([
			tour(ANNA, "2027-07-04"),
			tour(ANNA, "2027-07-05"),
		]);
		expect(tourBadges(result).map((b) => b.badgeId)).toEqual([
			"tour-de-paris-1",
			"tour-de-paris-2",
		]);
	});

	it("stops at the eighth day", () => {
		const days = Array.from({ length: 10 }, (_, i) =>
			tour(ANNA, `2027-07-${String(i + 1).padStart(2, "0")}`),
		);
		const result = evaluate(days);
		expect(tourBadges(result)).toEqual(
			Array.from({ length: 8 }, (_, i) => ({
				badgeId: `tour-de-paris-${i + 1}`,
				earnedOn: `2027-07-0${i + 1}`,
			})),
		);
		expect(progress(result)).toMatchObject({
			value: 8,
			next: null,
			missing: null,
		});
	});

	it("takes a badge back when an attendance goes", () => {
		const both = evaluate([tour(ANNA, "2027-07-04"), tour(ANNA, "2027-07-05")]);
		expect(tourBadges(both)).toHaveLength(2);
		const one = evaluate([tour(ANNA, "2027-07-04")]);
		expect(tourBadges(one).map((b) => b.badgeId)).toEqual(["tour-de-paris-1"]);
	});

	it("counts nothing for a tour day dated after today", () => {
		const result = evaluate(
			[tour(ANNA, "2027-07-04"), tour(ANNA, "2027-07-05")],
			"2027-07-04",
		);
		expect(tourBadges(result).map((b) => b.badgeId)).toEqual([
			"tour-de-paris-1",
		]);
		expect(progress(result)).toMatchObject({ value: 1, next: 2, missing: 1 });
	});

	it("counts nothing outside the season", () => {
		const result = evaluate(
			[tour(ANNA, "2026-08-31"), tour(ANNA, "2027-09-01")],
			"2027-09-15",
		);
		expect(tourBadges(result)).toEqual([]);
	});

	it("shows the days still to go from the rider with the most tour days", () => {
		const result = evaluate([
			tour(ANNA, "2027-07-04"),
			tour(ANNA, "2027-07-05"),
			tour(ANNA, "2027-07-06"),
			tour(BEN, "2027-07-04"),
		]);
		expect(progress(result)).toMatchObject({ value: 3, next: 4, missing: 1 });
		expect(progress(evaluate([]))).toMatchObject({
			value: 0,
			next: 1,
			missing: 1,
		});
	});

	it("never names a rider", () => {
		const result = evaluate([
			tour(ANNA, "2027-07-04"),
			tour(BEN, "2027-07-05"),
		]);
		const text = JSON.stringify(result);
		expect(text).not.toContain(String(ANNA));
		expect(text).not.toContain(String(BEN));
		expect(text).not.toContain("athleteId");
	});

	it("keeps catalog order with the tour badges among the team badges", () => {
		const result = evaluate([tour(ANNA, "2027-07-04")]);
		const order = result.earned.map((b) =>
			BADGES.findIndex((c) => c.id === b.badgeId),
		);
		expect(order).toEqual([...order].sort((a, b) => a - b));
	});
});
