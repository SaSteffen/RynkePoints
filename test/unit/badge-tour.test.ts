import { describe, expect, it } from "vitest";
import { BADGES } from "../../src/badges/catalog";
import {
	badgeWindow,
	evaluateBadges,
	type TourEvent,
} from "../../src/badges/evaluate";
import { evaluateTeamBadges } from "../../src/badges/team";
import { CURRENT_RULES } from "../../src/rynke/rules";
import type { Attendance } from "../../src/rynke/team-events";

// The Tour de Paris personal badges (feature 021 US2, FR-010–FR-013, research
// R11): the season's tour days numbered in date order, and badge n for each
// rider recorded at the n-th, dated with that day. Synthetic dates only.

const SEASON = { seasonStart: "2026-09-01", deadline: "2027-06-30" };

/** Tour days with ids 1, 2, … in the order given. */
const days = (...dates: string[]): TourEvent[] =>
	dates.map((date, i) => ({ eventId: i + 1, date }));

const at = (tour: TourEvent[], ...ids: number[]): Attendance[] =>
	ids.map((id) => {
		const day = tour.find((e) => e.eventId === id);
		if (!day) throw new Error(`no tour day ${id}`);
		return { eventId: id, kind: "tour_de_paris", date: day.date };
	});

function evaluate(
	tourEvents: TourEvent[],
	attendance: Attendance[],
	today = "2027-08-15",
) {
	return evaluateBadges(
		{ rides: [], runs: [], attendance, corrections: [], tourEvents },
		CURRENT_RULES,
		badgeWindow(SEASON, today),
	);
}

const tourBadges = (result: ReturnType<typeof evaluate>) =>
	result.earned.filter((b) => b.badgeId.startsWith("tour-de-paris-"));

const progress = (result: ReturnType<typeof evaluate>) =>
	result.progress.find((p) => p.category === "tour_de_paris");

const TOUR = days(
	"2027-07-04",
	"2027-07-05",
	"2027-07-06",
	"2027-07-07",
	"2027-07-08",
	"2027-07-09",
	"2027-07-10",
	"2027-07-11",
);

describe("Tour de Paris badges", () => {
	it("gives a rider the badge of each day they were at, dated by the day", () => {
		expect(tourBadges(evaluate(TOUR, at(TOUR, 1, 2)))).toEqual([
			{ badgeId: "tour-de-paris-1", earnedOn: "2027-07-04" },
			{ badgeId: "tour-de-paris-2", earnedOn: "2027-07-05" },
		]);
	});

	it("numbers the days, not the rider's attendances", () => {
		expect(tourBadges(evaluate(TOUR, at(TOUR, 3)))).toEqual([
			{ badgeId: "tour-de-paris-3", earnedOn: "2027-07-06" },
		]);
		expect(
			tourBadges(evaluate(TOUR, at(TOUR, 1, 3))).map((b) => b.badgeId),
		).toEqual(["tour-de-paris-1", "tour-de-paris-3"]);
	});

	it("gives nothing to a rider at no tour day", () => {
		expect(tourBadges(evaluate(TOUR, []))).toEqual([]);
	});

	it("numbers by date, the first created first on one date", () => {
		const tour: TourEvent[] = [
			{ eventId: 7, date: "2027-07-05" },
			{ eventId: 5, date: "2027-07-04" },
			{ eventId: 6, date: "2027-07-04" },
		];
		expect(tourBadges(evaluate(tour, at(tour, 6, 7)))).toEqual([
			{ badgeId: "tour-de-paris-2", earnedOn: "2027-07-04" },
			{ badgeId: "tour-de-paris-3", earnedOn: "2027-07-05" },
		]);
	});

	it("moves a rider's badge when a day before theirs is added or deleted", () => {
		const tour = days("2027-07-05", "2027-07-06");
		expect(
			tourBadges(evaluate(tour, at(tour, 2))).map((b) => b.badgeId),
		).toEqual(["tour-de-paris-2"]);
		const added = [...tour, { eventId: 9, date: "2027-07-04" }];
		expect(
			tourBadges(evaluate(added, at(tour, 2))).map((b) => b.badgeId),
		).toEqual(["tour-de-paris-3"]);
		const deleted = tour.filter((e) => e.eventId !== 1);
		expect(
			tourBadges(evaluate(deleted, at(tour, 2))).map((b) => b.badgeId),
		).toEqual(["tour-de-paris-1"]);
	});

	it("gives a day after the eighth no badge", () => {
		const tour = days(
			...Array.from(
				{ length: 10 },
				(_, i) => `2027-07-${String(i + 1).padStart(2, "0")}`,
			),
		);
		const result = evaluate(tour, at(tour, 8, 9, 10));
		expect(tourBadges(result)).toEqual([
			{ badgeId: "tour-de-paris-8", earnedOn: "2027-07-08" },
		]);
	});

	it("counts tour days after the qualification deadline, up to today", () => {
		const result = evaluate(TOUR, at(TOUR, 1, 2), "2027-07-04");
		expect(tourBadges(result).map((b) => b.badgeId)).toEqual([
			"tour-de-paris-1",
		]);
	});

	it("counts nothing outside the season, nor numbers it", () => {
		const tour = days("2026-08-31", "2027-07-04", "2027-09-01");
		expect(tourBadges(evaluate(tour, at(tour, 1, 2, 3), "2027-09-15"))).toEqual(
			[{ badgeId: "tour-de-paris-1", earnedOn: "2027-07-04" }],
		);
	});

	it("shows no bar (FR-013)", () => {
		expect(progress(evaluate(TOUR, at(TOUR, 1, 2)))).toMatchObject({
			value: 2,
			next: null,
			missing: null,
		});
		expect(progress(evaluate(TOUR, []))).toMatchObject({
			next: null,
			missing: null,
		});
	});

	it("keeps catalog order, the tour before the surprises", () => {
		const result = evaluateBadges(
			{
				rides: [
					{
						date: "2027-01-01",
						distanceM: 30_000,
						distanceRynke: 30,
						elevationDm: 1000,
						startTime: "10:00",
					},
				],
				runs: [],
				attendance: at(TOUR, 1),
				corrections: [],
				tourEvents: TOUR,
			},
			CURRENT_RULES,
			badgeWindow(SEASON, "2027-08-15"),
		);
		const order = result.earned.map((b) =>
			BADGES.findIndex((c) => c.id === b.badgeId),
		);
		expect(result.earned.map((b) => b.badgeId)).toContain("tour-de-paris-1");
		expect(result.earned.map((b) => b.badgeId)).toContain("surprise-new-year");
		expect(order).toEqual([...order].sort((a, b) => a - b));
	});

	it("is no team badge any more", () => {
		const team = evaluateTeamBadges(
			{ riders: [], runs: [], events: [] },
			CURRENT_RULES,
			badgeWindow(SEASON, "2027-08-15"),
		);
		expect(team.progress.map((p) => p.category)).not.toContain("tour_de_paris");
	});
});
