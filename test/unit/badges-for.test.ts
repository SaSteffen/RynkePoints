import { describe, expect, it } from "vitest";
import {
	BADGE_CATALOG_VERSION,
	BADGE_CATEGORIES,
	BADGES,
	type BadgeCategoryId,
	badgesFor,
} from "../../src/badges/catalog";
import { progressOf } from "../../src/badges/evaluate";
import { buildBadgeSection, listedFor } from "../../src/badges/view";
import { europe } from "../../src/teams/europe";
import { hamburg } from "../../src/teams/hamburg";

// Feature 039 US5 (research R9): a team without events lists no badge that only
// recorded events earn; a team with events lists every badge, the same array
// as today. And no team lists a badge its season holds no day for: Team
// Europe's season, 1 January to 30 June, has no November, December or
// Christmas (feature 039). The catalog itself doesn't change.

/** Hamburg's season, which holds every badge's days. */
const SEPTEMBER = { seasonStart: "2026-09-01", deadline: "2027-06-30" };
/** Team Europe's. */
const JANUARY = { seasonStart: "2027-01-01", deadline: "2027-06-30" };

/** The badges a season from January to June holds no day for. */
const OUT_OF_SEASON = [
	"winter-november-1",
	"winter-november-5",
	"winter-november-10",
	"winter-december-1",
	"winter-december-5",
	"winter-december-10",
	"surprise-christmas-eve",
	"surprise-christmas",
	"surprise-festive-500",
	"surprise-solstice",
	"surprise-winter-sleep",
	"team-surprise-new-years-eve",
	"team-surprise-festive-team",
];

const EVENT_ONLY: readonly BadgeCategoryId[] = [
	"team_events",
	"technique",
	"tour_de_paris",
	"big_training",
	"attendances",
];

describe("badgesFor", () => {
	it("is the catalog itself for a team with events", () => {
		expect(badgesFor(hamburg, SEPTEMBER)).toBe(BADGES);
	});

	it("leaves out exactly the event-only categories without events", () => {
		const listed = badgesFor(europe, SEPTEMBER);
		expect(listed).toEqual(
			BADGES.filter((b) => !EVENT_ONLY.includes(b.category)),
		);
		const categories = new Set(listed.map((b) => b.category));
		for (const kept of [
			"team_distance",
			"team_elevation",
			"team_running",
			"team_training_rynke",
			"team_surprise",
			"surprise",
			"training_rynke",
		] as const) {
			expect(categories, kept).toContain(kept);
		}
	});

	it("leaves out the badges a season from January to June has no day for", () => {
		expect(
			BADGES.filter((b) => !badgesFor(hamburg, JANUARY).includes(b)).map(
				(b) => b.id,
			),
		).toEqual(OUT_OF_SEASON);
	});

	it("leaves out both for Team Europe", () => {
		expect(badgesFor(europe, JANUARY)).toEqual(
			BADGES.filter(
				(b) =>
					!EVENT_ONLY.includes(b.category) && !OUT_OF_SEASON.includes(b.id),
			),
		);
		// New Year, Pi Day and Easter fall in it.
		const ids = badgesFor(europe, JANUARY).map((b) => b.id);
		for (const kept of [
			"surprise-new-year",
			"surprise-pi-day",
			"surprise-easter",
			"winter-january-1",
			"winter-february-1",
		]) {
			expect(ids).toContain(kept);
		}
	});

	it("is the same array on every call", () => {
		expect(badgesFor(europe, SEPTEMBER)).toBe(badgesFor(europe, SEPTEMBER));
	});

	it("flags exactly those five categories as earned only through events", () => {
		expect(BADGE_CATEGORIES.filter((c) => c.events).map((c) => c.id)).toEqual(
			EVENT_ONLY,
		);
	});

	it("keeps the catalog version", () => {
		expect(BADGE_CATALOG_VERSION).toBe(9);
	});
});

describe("listedFor", () => {
	const evaluated = {
		earned: BADGES.map((b) => ({ badgeId: b.id, earnedOn: "2026-10-01" })),
		progress: BADGE_CATEGORIES.map((c) => progressOf(c.id, 0)),
	};

	it("passes everything through for a team with events", () => {
		expect(listedFor(hamburg, SEPTEMBER, evaluated)).toBe(evaluated);
	});

	it("drops the event-only badges and their progress without events", () => {
		const listed = listedFor(europe, SEPTEMBER, evaluated);
		const ids = new Set(badgesFor(europe, SEPTEMBER).map((b) => b.id));
		expect(listed.earned.map((b) => b.badgeId)).toEqual([...ids]);
		expect(listed.progress.map((p) => p.category)).toEqual(
			BADGE_CATEGORIES.filter((c) => !EVENT_ONLY.includes(c.id)).map(
				(c) => c.id,
			),
		);
	});

	it("counts only the listed badges as outlines", () => {
		const section = buildBadgeSection({
			waiting: false,
			personal: listedFor(europe, JANUARY, {
				earned: [{ badgeId: "surprise-new-year", earnedOn: "2027-01-01" }],
				progress: [progressOf("surprise", 1)],
			}),
		});
		const surprise = section?.personal?.gallery.find(
			(g) => g.category === "surprise",
		);
		// 14 surprises, 5 out of season, 1 earned.
		expect(surprise?.unearned).toBe(8);
	});
});
