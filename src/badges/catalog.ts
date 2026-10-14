// The badge catalog (feature 013, data-model.md "Catalog", research R18): the
// spec's ladders per category, and the badge ids derived from them. The same
// ids, groups and thresholds as art/badges/badges.json, kept equal by
// test/unit/badge-catalog.test.ts; the app never reads that file.

export type BadgeGroup = "personal" | "team";

export type BadgeUnit =
	| "km"
	| "m"
	| "rynke"
	| "events"
	| "trainings"
	| "riders"
	| "attendances"
	| "days";

export type BadgeCategoryId =
	| "distance"
	| "elevation"
	| "team_events"
	| "technique"
	| "training_rynke"
	| "run_length"
	| "running"
	| "ride_length"
	| "virtual_rides"
	| "swim_length"
	| "swimming"
	| "winter_november"
	| "winter_december"
	| "winter_january"
	| "winter_february"
	| "surprise"
	| "team_training_rynke"
	| "team_distance"
	| "team_elevation"
	| "team_running"
	| "big_training"
	| "attendances"
	| "team_surprise";

export interface BadgeCategory {
	id: BadgeCategoryId;
	group: BadgeGroup;
	unit: BadgeUnit;
	/** Thresholds in the category's unit, strictly increasing. */
	ladder: readonly number[];
	/** A winter category's calendar month, 1 to 12 (part C, research R25). */
	month?: number;
	/**
	 * Single badges with secret rules instead of a ladder; the ladder only
	 * orders them (part D, FR-015, research R32).
	 */
	surprise?: true;
}

export interface Badge {
	id: BadgeId;
	group: BadgeGroup;
	category: BadgeCategoryId;
	threshold: number;
}

/** Raised with any ladder change; riders on an older one are re-evaluated (FR-012). */
export const BADGE_CATALOG_VERSION = 5;

/** In the spec's order: personal first, then team. */
export const BADGE_CATEGORIES: readonly BadgeCategory[] = [
	{
		id: "distance",
		group: "personal",
		unit: "km",
		ladder: [100, 500, 1000, 2500, 5000],
	},
	{
		id: "elevation",
		group: "personal",
		unit: "m",
		ladder: [1000, 5000, 10000, 25000],
	},
	{
		id: "team_events",
		group: "personal",
		unit: "events",
		ladder: [1, 5, 10, 20],
	},
	{ id: "technique", group: "personal", unit: "trainings", ladder: [1, 2] },
	{
		id: "training_rynke",
		group: "personal",
		unit: "rynke",
		ladder: [1, 25, 50, 100, 150, 200, 250, 300, 400, 500],
	},
	{
		id: "run_length",
		group: "personal",
		unit: "km",
		ladder: [5, 10, 21.0975, 42.195],
	},
	{
		id: "running",
		group: "personal",
		unit: "km",
		ladder: [10, 25, 50, 100, 250, 500],
	},
	// Part C (2026-10-12, research R28).
	{
		id: "ride_length",
		group: "personal",
		unit: "km",
		ladder: [50, 100, 150, 200, 250, 300],
	},
	{
		id: "virtual_rides",
		group: "personal",
		unit: "km",
		ladder: [50, 100, 250, 500, 1000],
	},
	{
		id: "swim_length",
		group: "personal",
		unit: "km",
		ladder: [0.5, 1, 1.9, 3.8],
	},
	{
		id: "swimming",
		group: "personal",
		unit: "km",
		ladder: [5, 10, 25, 50, 100],
	},
	{
		id: "winter_november",
		group: "personal",
		unit: "days",
		ladder: [1, 5, 10],
		month: 11,
	},
	{
		id: "winter_december",
		group: "personal",
		unit: "days",
		ladder: [1, 5, 10],
		month: 12,
	},
	{
		id: "winter_january",
		group: "personal",
		unit: "days",
		ladder: [1, 5, 10],
		month: 1,
	},
	{
		id: "winter_february",
		group: "personal",
		unit: "days",
		ladder: [1, 5, 10],
		month: 2,
	},
	// Part D (2026-10-12, research R32): no unit is ever shown. Part F
	// (2026-10-14, research R42) adds seven badges from cycling traditions.
	{
		id: "surprise",
		group: "personal",
		unit: "days",
		ladder: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
		surprise: true,
	},
	{
		id: "team_training_rynke",
		group: "team",
		unit: "rynke",
		ladder: [500, 1000, 2500, 5000, 7500, 10000, 15000, 20000],
	},
	{
		id: "team_distance",
		group: "team",
		unit: "km",
		ladder: [1000, 5000, 10000, 25000, 50000, 100000],
	},
	{
		id: "team_elevation",
		group: "team",
		unit: "m",
		ladder: [10000, 50000, 100000, 250000, 500000],
	},
	{
		id: "team_running",
		group: "team",
		unit: "km",
		ladder: [100, 500, 1000, 2500, 5000],
	},
	{
		id: "big_training",
		group: "team",
		unit: "riders",
		ladder: [5, 10, 15, 20, 30],
	},
	{
		id: "attendances",
		group: "team",
		unit: "attendances",
		ladder: [25, 50, 100, 200, 400],
	},
	// Part E (2026-10-12, research R38); part F adds Festive Team (R42).
	{
		id: "team_surprise",
		group: "team",
		unit: "days",
		ladder: [1, 2, 3, 4, 5, 6, 7],
		surprise: true,
	},
];

/**
 * Run length's top two steps are named, not numbered; swim length's ids are in
 * metres, since ids have no dot (research R28).
 */
const NAMED_THRESHOLDS: Partial<
	Record<BadgeCategoryId, Record<number, string>>
> = {
	run_length: { 21.0975: "half", 42.195: "marathon" },
	swim_length: { 0.5: "500", 1: "1000", 1.9: "1900", 3.8: "3800" },
	surprise: {
		1: "new-year",
		2: "christmas-eve",
		3: "christmas",
		4: "night-owl",
		5: "early-bird",
		6: "rest-day",
		7: "festive-500",
		8: "stage-rider",
		9: "triathlon",
		10: "pi-day",
		11: "solstice",
		12: "easter",
		13: "everesting",
	},
	team_surprise: {
		1: "day-off",
		2: "all-out",
		3: "round-the-clock",
		4: "relay",
		5: "new-years-eve",
		6: "sunday-outing",
		7: "festive-team",
	},
};

const badgeIdOf = (category: BadgeCategoryId, threshold: number): string =>
	`${category.replaceAll("_", "-")}-${NAMED_THRESHOLDS[category]?.[threshold] ?? threshold}`;

/** Every badge's id; a string here, checked against the catalog at runtime. */
export type BadgeId = string;

/** All 121 badges in catalog order: by category, then by threshold. */
export const BADGES: readonly Badge[] = BADGE_CATEGORIES.flatMap((c) =>
	c.ladder.map((threshold) => ({
		id: badgeIdOf(c.id, threshold),
		group: c.group,
		category: c.id,
		threshold,
	})),
);

const BY_ID = new Map(BADGES.map((b) => [b.id, b]));

export const badgeById = (id: string): Badge | undefined => BY_ID.get(id);

/** Position in catalog order, for sorting badge ids. */
export const badgeOrder = (id: string): number =>
	BADGES.findIndex((b) => b.id === id);

export const categoryById = (id: BadgeCategoryId): BadgeCategory =>
	BADGE_CATEGORIES.find((c) => c.id === id) as BadgeCategory;

/** The categories that show one decimal (spec Assumptions, research R28). */
export const ONE_DECIMAL: ReadonlySet<BadgeCategoryId> = new Set([
	"run_length",
	"swim_length",
	"swimming",
]);

/** A surprise badge's rule name, `new-year` …, or null for other badges. */
export const surpriseName = (badge: Badge): string | null =>
	categoryById(badge.category).surprise
		? (NAMED_THRESHOLDS[badge.category]?.[badge.threshold] ?? null)
		: null;
