// The badge catalog (feature 013, data-model.md "Catalog", research R18): the
// spec's ladders per category, and the badge ids derived from them. The same
// ids, groups and thresholds as art/badges/badges.json, kept equal by
// test/unit/badge-catalog.test.ts; the app never reads that file.

import type { CountingWindow } from "../rynke/rules";
import { addDays } from "../rynke/weeks";
import { hasEvents } from "../teams";
import type { TeamData } from "../teams/types";
import { easterSunday } from "./easter";

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
	| "tour_de_paris"
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
	/**
	 * Single badges one per day, a collection rather than a ladder: no bar,
	 * the newest on the card (feature 021 FR-013). The ladder numbers them.
	 */
	days?: true;
	/**
	 * Earned by one activity or one event alone, a record rather than a sum
	 * (run, ride and swim length, the biggest training): no bar, since the
	 * next badge needs one at its threshold, not what is "missing" to it.
	 */
	single?: true;
	/**
	 * Earned only through recorded events: a team without events doesn't list
	 * the category (feature 039 research R9).
	 */
	events?: true;
}

export interface Badge {
	id: BadgeId;
	group: BadgeGroup;
	category: BadgeCategoryId;
	threshold: number;
}

/**
 * Raised with any ladder change; riders on an older one are re-evaluated
 * (FR-012). 6: tour days count for the personal Team events (feature 021
 * FR-005). 7: the tour badges are personal (feature 021 FR-010).
 * 8: the Winterschlaf beendet surprise badge (feature 013 FR-018).
 * 9: run length's 15 km and Pi-Run (31.4 km) steps.
 */
export const BADGE_CATALOG_VERSION = 9;

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
		events: true,
	},
	{
		id: "technique",
		group: "personal",
		unit: "trainings",
		ladder: [1, 2],
		events: true,
	},
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
		ladder: [5, 10, 15, 21.0975, 31.4, 42.195],
		single: true,
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
		single: true,
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
		single: true,
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
	// Feature 021 (research R11): one badge per day of the tour, which always
	// has eight, earned by the riders at that day. Stand-in names and the
	// personal placeholder until Phase 2.
	{
		id: "tour_de_paris",
		group: "personal",
		unit: "days",
		ladder: [1, 2, 3, 4, 5, 6, 7, 8],
		days: true,
		events: true,
	},
	// Part D (2026-10-12, research R32): no unit is ever shown. Part F
	// (2026-10-14, research R42) adds seven badges from cycling traditions,
	// part J (2026-10-20, research R49) the end of hibernation.
	{
		id: "surprise",
		group: "personal",
		unit: "days",
		ladder: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
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
		single: true,
		events: true,
	},
	{
		id: "attendances",
		group: "team",
		unit: "attendances",
		ladder: [25, 50, 100, 200, 400],
		events: true,
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
 * Run length's half marathon, Pi-Run (31.4 km, π × 10, research R50) and
 * marathon steps are named, not numbered; swim length's ids are in metres,
 * since ids have no dot (research R28).
 */
const NAMED_THRESHOLDS: Partial<
	Record<BadgeCategoryId, Record<number, string>>
> = {
	run_length: { 21.0975: "half", 31.4: "pi-run", 42.195: "marathon" },
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
		14: "winter-sleep",
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

/** All 132 badges in catalog order: by category, then by threshold. */
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

/** Every date from `from` to `to`, `YYYY-MM-DD`, both included. */
function datesFrom(from: string, to: string): string[] {
	const dates: string[] = [];
	for (let date = from; date <= to; date = addDays(date, 1)) dates.push(date);
	return dates;
}

/** Christmas Eve to New Year's Eve, Festive 500's and Festive Team's days. */
const FESTIVE = [
	"12-24",
	"12-25",
	"12-26",
	"12-27",
	"12-28",
	"12-29",
	"12-30",
	"12-31",
];

/** The calendar days (`MM-DD`) a dated surprise rule can be met on, any one. */
const SURPRISE_DAYS: Readonly<Record<string, readonly string[]>> = {
	"new-year": ["01-01"],
	"christmas-eve": ["12-24"],
	christmas: ["12-25", "12-26"],
	"festive-500": FESTIVE,
	"pi-day": ["03-14"],
	"new-years-eve": ["12-31"],
	"festive-team": FESTIVE,
};

/**
 * Whether a season `window` holds the days `badge` can be earned on (feature
 * 039): a winter category's month, a dated surprise's day, both solstices,
 * Easter Sunday or Monday, and a new year after the season start for
 * Winterschlaf beendet. Every other badge can be earned on any day.
 */
function inSeason(badge: Badge, dates: readonly string[]): boolean {
	const category = categoryById(badge.category);
	const has = (monthDay: string) => dates.some((d) => d.slice(5) === monthDay);
	if (category.month !== undefined) {
		const month = String(category.month).padStart(2, "0");
		return dates.some((d) => d.slice(5, 7) === month);
	}
	const name = surpriseName(badge);
	if (name === null) return true;
	if (name === "solstice") return has("12-21") && has("06-21");
	if (name === "easter") {
		const days = new Set(dates);
		const years = new Set(dates.map((d) => Number(d.slice(0, 4))));
		return [...years].some((year) => {
			const sunday = easterSunday(year);
			return days.has(sunday) || days.has(addDays(sunday, 1));
		});
	}
	if (name === "winter-sleep") {
		return dates.includes(`${Number(dates[0]?.slice(0, 4)) + 1}-01-01`);
	}
	return SURPRISE_DAYS[name]?.some(has) ?? true;
}

/** `badgesFor`'s lists by team kind and season, worked out once each. */
const LISTED = new Map<string, readonly Badge[]>();

/**
 * The badges a team lists, in catalog order: none that only recorded events
 * earn on a team without events (feature 039 research R9), and none the
 * season `window` holds no day for, such as Christmas Eve in a season from
 * January to June (feature 039). With events and every day, the very same
 * `BADGES`. Evaluation doesn't change: an unlisted badge is never earned.
 */
export function badgesFor(
	team: Pick<TeamData, "eventKinds">,
	window: CountingWindow,
): readonly Badge[] {
	const events = hasEvents(team);
	const key = `${events}:${window.seasonStart}:${window.deadline}`;
	let listed = LISTED.get(key);
	if (!listed) {
		const dates = datesFrom(window.seasonStart, window.deadline);
		const kept = BADGES.filter(
			(b) => (events || !categoryById(b.category).events) && inSeason(b, dates),
		);
		listed = kept.length === BADGES.length ? BADGES : kept;
		LISTED.set(key, listed);
	}
	return listed;
}

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
