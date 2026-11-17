import { describe, expect, it } from "vitest";
import {
	BADGE_CATALOG_VERSION,
	BADGE_CATEGORIES,
	BADGES,
	type BadgeCategoryId,
	badgesFor,
} from "../../src/badges/catalog";
import { progressOf } from "../../src/badges/evaluate";
import { listedFor } from "../../src/badges/view";
import { europe } from "../../src/teams/europe";
import { hamburg } from "../../src/teams/hamburg";

// Feature 039 US5 (research R9): a team without events lists no badge that only
// recorded events earn; a team with events lists every badge, the same array
// as today. The catalog itself doesn't change.

const EVENT_ONLY: readonly BadgeCategoryId[] = [
	"team_events",
	"technique",
	"tour_de_paris",
	"big_training",
	"attendances",
];

describe("badgesFor", () => {
	it("is the catalog itself for a team with events", () => {
		expect(badgesFor(hamburg)).toBe(BADGES);
	});

	it("leaves out exactly the event-only categories without events", () => {
		const listed = badgesFor(europe);
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

	it("is the same array on every call", () => {
		expect(badgesFor(europe)).toBe(badgesFor(europe));
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
		expect(listedFor(hamburg, evaluated)).toBe(evaluated);
	});

	it("drops the event-only badges and their progress without events", () => {
		const listed = listedFor(europe, evaluated);
		const ids = new Set(badgesFor(europe).map((b) => b.id));
		expect(listed.earned.map((b) => b.badgeId)).toEqual([...ids]);
		expect(listed.progress.map((p) => p.category)).toEqual(
			BADGE_CATEGORIES.filter((c) => !EVENT_ONLY.includes(c.id)).map(
				(c) => c.id,
			),
		);
	});
});
