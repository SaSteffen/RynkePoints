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
	| "attendances";

export type BadgeCategoryId =
	| "distance"
	| "elevation"
	| "team_events"
	| "technique"
	| "training_rynke"
	| "run_length"
	| "running"
	| "team_training_rynke"
	| "team_distance"
	| "team_elevation"
	| "team_running"
	| "big_training"
	| "attendances";

export interface BadgeCategory {
	id: BadgeCategoryId;
	group: BadgeGroup;
	unit: BadgeUnit;
	/** Thresholds in the category's unit, strictly increasing. */
	ladder: readonly number[];
}

export interface Badge {
	id: BadgeId;
	group: BadgeGroup;
	category: BadgeCategoryId;
	threshold: number;
}

/** Raised with any ladder change; riders on an older one are re-evaluated (FR-012). */
export const BADGE_CATALOG_VERSION = 1;

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
];

/** Run length's top two steps are named, not numbered. */
const NAMED_THRESHOLDS: Partial<
	Record<BadgeCategoryId, Record<number, string>>
> = { run_length: { 21.0975: "half", 42.195: "marathon" } };

const badgeIdOf = (category: BadgeCategoryId, threshold: number): string =>
	`${category.replaceAll("_", "-")}-${NAMED_THRESHOLDS[category]?.[threshold] ?? threshold}`;

/** Every badge's id; a string here, checked against the catalog at runtime. */
export type BadgeId = string;

/** All 69 badges in catalog order: by category, then by threshold. */
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
