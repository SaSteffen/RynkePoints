import { describe, expect, it } from "vitest";
import type { CategoryProgress, EarnedBadge } from "../../src/badges/evaluate";
import {
	buildBadgeSection,
	shownMissing,
	winterMonthOver,
} from "../../src/badges/view";

// The Abzeichen section's view model (feature 013 data-model.md "View model",
// contracts/abzeichen-section.md). Synthetic badges only.

const progress = (
	category: CategoryProgress["category"],
	value: number,
	next: number | null,
): CategoryProgress => ({
	category,
	value,
	next,
	missing: next === null ? null : next - value,
});

const PERSONAL_NONE: CategoryProgress[] = [
	progress("distance", 0, 100),
	progress("elevation", 0, 1000),
	progress("team_events", 0, 1),
	progress("technique", 0, 1),
	progress("training_rynke", 0, 1),
	progress("run_length", 0, 5),
	progress("running", 0, 10),
];

function personal(
	earned: EarnedBadge[],
	overrides: CategoryProgress[] = [],
): { earned: EarnedBadge[]; progress: CategoryProgress[] } {
	return {
		earned,
		progress: PERSONAL_NONE.map(
			(p) => overrides.find((o) => o.category === p.category) ?? p,
		),
	};
}

describe("buildBadgeSection reveal (research R16, US4 scenario 5)", () => {
	const team = (earned: EarnedBadge[]) => ({
		earned,
		progress: [progress("big_training", 5, 10)],
	});

	it("reveals badges without a reveal or with an earlier date, in catalog order", () => {
		const section = buildBadgeSection({
			waiting: false,
			personal: personal([
				{ badgeId: "elevation-1000", earnedOn: "2026-05-01" },
				{ badgeId: "distance-100", earnedOn: "2026-05-20" },
				{ badgeId: "technique-1", earnedOn: "2026-04-01" },
			]),
			revealed: new Map([
				["distance-100", "2026-05-03"],
				["technique-1", "2026-04-01"],
			]),
		});
		expect(section?.reveal.map((b) => b.badgeId)).toEqual([
			"distance-100",
			"elevation-1000",
		]);
	});

	it("leaves out team badges earned before the rider connected", () => {
		const section = buildBadgeSection({
			waiting: false,
			personal: personal([]),
			team: team([
				{ badgeId: "big-training-5", earnedOn: "2026-04-11" },
				{ badgeId: "attendances-25", earnedOn: "2026-06-01" },
			]),
			revealed: new Map(),
			connectedOn: "2026-05-01",
		});
		expect(section?.reveal.map((b) => b.badgeId)).toEqual(["attendances-25"]);
	});

	it("reveals nothing without the rider's reveals", () => {
		const section = buildBadgeSection({
			waiting: false,
			personal: personal([{ badgeId: "distance-100", earnedOn: "2026-05-20" }]),
		});
		expect(section?.reveal).toEqual([]);
	});
});

describe("buildBadgeSection", () => {
	it("shows nothing while the waiting state shows (FR-005)", () => {
		expect(buildBadgeSection({ waiting: true, personal: personal([]) })).toBe(
			null,
		);
	});

	it("gives one card per category with its highest badge, newest first (US1 scenario 8)", () => {
		const section = buildBadgeSection({
			waiting: false,
			personal: personal(
				[
					{ badgeId: "distance-100", earnedOn: "2026-03-01" },
					{ badgeId: "distance-500", earnedOn: "2026-05-01" },
					{ badgeId: "elevation-1000", earnedOn: "2026-06-01" },
					{ badgeId: "technique-1", earnedOn: "2026-04-01" },
					{ badgeId: "technique-2", earnedOn: "2026-04-20" },
				],
				[
					progress("distance", 612, 1000),
					progress("elevation", 1300, 5000),
					progress("technique", 2, null),
				],
			),
		});
		expect(
			section?.personal?.cards.map((c) => [c.badge.badgeId, c.progress?.next]),
		).toEqual([
			["elevation-1000", 5000],
			["distance-500", 1000],
			// Complete: no progress (FR-004).
			["technique-2", undefined],
		]);
		expect(section?.personal?.cards[1]?.progress).toEqual({
			unit: "km",
			next: 1000,
			missing: 388,
			percent: 61,
		});
		expect(section?.personal?.count).toBe(5);
	});

	it("groups the gallery in catalog order, newest first inside (US1 scenario 6)", () => {
		const section = buildBadgeSection({
			waiting: false,
			personal: personal([
				{ badgeId: "technique-1", earnedOn: "2026-04-01" },
				{ badgeId: "distance-100", earnedOn: "2026-03-01" },
				{ badgeId: "distance-500", earnedOn: "2026-05-01" },
			]),
		});
		expect(
			section?.personal?.gallery.map((g) => [
				g.category,
				g.badges.map((b) => b.badgeId),
			]),
		).toEqual([
			["distance", ["distance-500", "distance-100"]],
			["elevation", []],
			["team_events", []],
			["technique", ["technique-1"]],
			["training_rynke", []],
			["run_length", []],
			["running", []],
		]);
		// The badges still to earn, as empty outlines (issue #109).
		expect(section?.personal?.gallery.map((g) => g.unearned)).toEqual([
			3, 4, 4, 1, 10, 4, 6,
		]);
	});

	it("lists categories without a badge under not yet, with their progress", () => {
		const section = buildBadgeSection({
			waiting: false,
			personal: personal(
				[{ badgeId: "distance-100", earnedOn: "2026-03-01" }],
				[progress("distance", 150, 500), progress("elevation", 620, 1000)],
			),
		});
		expect(section?.notYet.map((r) => r.category)).toEqual([
			"elevation",
			"team_events",
			"technique",
			"training_rynke",
			"run_length",
			"running",
		]);
		expect(section?.notYet[0]).toEqual({
			category: "elevation",
			group: "personal",
			progress: { unit: "m", next: 1000, missing: 380, percent: 62 },
		});
	});

	it("is empty but present for a rider without badges (US1 scenario 4)", () => {
		const section = buildBadgeSection({
			waiting: false,
			personal: personal([]),
		});
		expect(section?.personal?.cards).toEqual([]);
		expect(section?.personal?.count).toBe(0);
		expect(section?.notYet).toHaveLength(7);
	});
});

describe("shownMissing", () => {
	it("rounds the value down in whole units, so it never shows 0", () => {
		expect(shownMissing("distance", 99.6, 100)).toBe(1);
		expect(shownMissing("distance", 412.9, 500)).toBe(88);
		expect(shownMissing("training_rynke", 4210, 5000)).toBe(790);
	});

	it("gives run length one decimal", () => {
		expect(shownMissing("run_length", 21.3, 42.195)).toBe(20.9);
		expect(shownMissing("run_length", 21.095, 21.0975)).toBe(0.1);
		expect(shownMissing("run_length", 4.2, 5)).toBe(0.8);
	});

	it("gives swim length and swimming one decimal too (part C)", () => {
		expect(shownMissing("swim_length", 0.5, 1)).toBe(0.5);
		expect(shownMissing("swimming", 4.31, 5)).toBe(0.7);
	});

	it("keeps whole units for ride length, virtual rides and winter days", () => {
		expect(shownMissing("ride_length", 104.7, 150)).toBe(46);
		expect(shownMissing("virtual_rides", 49.9, 50)).toBe(1);
		expect(shownMissing("winter_january", 2, 5)).toBe(3);
	});
});

// Part C: a winter month that is over shows no bar (FR-004a, research R25).
describe("winterMonthOver", () => {
	const START = "2026-09-01";

	it.each([
		["winter_november", "2026-11-30", false],
		["winter_november", "2026-12-01", true],
		["winter_december", "2026-12-31", false],
		["winter_december", "2027-01-01", true],
		["winter_january", "2026-10-12", false],
		["winter_january", "2027-02-01", true],
		["winter_february", "2027-02-28", false],
		["winter_february", "2027-03-01", true],
	] as const)("%s on %s: %s", (category, today, over) => {
		expect(winterMonthOver(category, today, START)).toBe(over);
	});

	it("is never over for a category without a month", () => {
		expect(winterMonthOver("distance", "2030-01-01", START)).toBe(false);
	});
});

describe("buildBadgeSection with today (FR-004a, US5 scenario 9)", () => {
	const WINTER: CategoryProgress[] = [
		progress("distance", 300, 500),
		progress("winter_january", 0, 1),
		progress("winter_february", 3, 5),
	];
	const build = (today: string) =>
		buildBadgeSection({
			waiting: false,
			personal: {
				earned: [
					{ badgeId: "distance-100", earnedOn: "2027-01-20" },
					{ badgeId: "winter-february-1", earnedOn: "2027-02-03" },
				],
				progress: WINTER,
			},
			today,
			seasonStart: "2026-09-01",
		});

	it("shows every bar before and during the winter months", () => {
		const section = build("2026-10-12");
		const february = section?.personal?.cards.find(
			(c) => c.category === "winter_february",
		);
		expect(february?.progress).toMatchObject({ next: 5, missing: 2 });
		expect(section?.notYet).toEqual([
			expect.objectContaining({
				category: "winter_january",
				progress: expect.objectContaining({ next: 1 }),
			}),
		]);
	});

	it("drops the bars of months that are over, keeping cards and outlines", () => {
		const section = build("2027-03-01");
		const cards = section?.personal?.cards ?? [];
		expect(cards.find((c) => c.category === "winter_february")).toMatchObject({
			badge: { badgeId: "winter-february-1" },
			progress: null,
		});
		expect(
			cards.find((c) => c.category === "distance")?.progress,
		).toMatchObject({ next: 500 });
		expect(section?.notYet).toEqual([
			{ category: "winter_january", group: "personal", progress: null },
		]);
	});
});

// Part D: the surprise card shows the newest, never a bar (research R35).
describe("buildBadgeSection for surprise badges", () => {
	const SURPRISE = [{ ...progress("surprise", 0, null) }];

	it("shows the newest earned surprise badge without progress", () => {
		const section = buildBadgeSection({
			waiting: false,
			personal: {
				earned: [
					{ badgeId: "surprise-night-owl", earnedOn: "2026-10-04" },
					{ badgeId: "surprise-new-year", earnedOn: "2027-01-01" },
					{ badgeId: "surprise-early-bird", earnedOn: "2026-11-02" },
				],
				progress: SURPRISE,
			},
		});
		expect(section?.personal?.cards).toEqual([
			{
				category: "surprise",
				badge: { badgeId: "surprise-new-year", earnedOn: "2027-01-01" },
				progress: null,
			},
		]);
		expect(section?.personal?.gallery).toEqual([
			{
				category: "surprise",
				badges: [
					{ badgeId: "surprise-new-year", earnedOn: "2027-01-01" },
					{ badgeId: "surprise-early-bird", earnedOn: "2026-11-02" },
					{ badgeId: "surprise-night-owl", earnedOn: "2026-10-04" },
				],
				unearned: 11,
			},
		]);
	});

	it("is an outline card without progress before the first one", () => {
		const section = buildBadgeSection({
			waiting: false,
			personal: { earned: [], progress: SURPRISE },
		});
		expect(section?.notYet).toEqual([
			{ category: "surprise", group: "personal", progress: null },
		]);
	});
});
