import { describe, expect, it } from "vitest";
import type { CategoryProgress, EarnedBadge } from "../../src/badges/evaluate";
import { buildBadgeSection, shownMissing } from "../../src/badges/view";

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
			section?.personal.cards.map((c) => [c.badge.badgeId, c.progress?.next]),
		).toEqual([
			["elevation-1000", 5000],
			["distance-500", 1000],
			// Complete: no progress (FR-004).
			["technique-2", undefined],
		]);
		expect(section?.personal.cards[1]?.progress).toEqual({
			unit: "km",
			next: 1000,
			missing: 388,
			percent: 61,
		});
		expect(section?.personal.count).toBe(5);
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
			section?.personal.gallery.map((g) => [
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
		expect(section?.personal.gallery.map((g) => g.unearned)).toEqual([
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
		expect(section?.personal.cards).toEqual([]);
		expect(section?.personal.count).toBe(0);
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
});
