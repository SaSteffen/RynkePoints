// The Abzeichen section's view model (feature 013 data-model.md "View model",
// contracts/abzeichen-section.md): cards, gallery and the categories without a
// badge yet, from the earned badges and the progress per category. Pure; the
// section renders it (`http/sections/badges.ts`).

import { type CountingWindow, inCountingWindow } from "../rynke/rules";
import type { Attendance } from "../rynke/team-events";
import {
	BADGE_CATEGORIES,
	type BadgeCategoryId,
	type BadgeGroup,
	type BadgeUnit,
	badgeById,
	badgeOrder,
	categoryById,
} from "./catalog";
import {
	type CategoryProgress,
	type EarnedBadge,
	progressOf,
} from "./evaluate";

export interface ProgressView {
	unit: BadgeUnit;
	next: number;
	/** What is missing as shown: never 0 (spec Assumptions). */
	missing: number;
	/** The bar's fill, 0 to 100. */
	percent: number;
}

export interface Card {
	category: BadgeCategoryId;
	badge: EarnedBadge;
	/** Null once the category is complete (FR-004). */
	progress: ProgressView | null;
}

export interface GalleryGroup {
	category: BadgeCategoryId;
	/** Newest first. */
	badges: EarnedBadge[];
	/** How many of the category's badges are still to earn (issue #109). */
	unearned: number;
}

export interface NotYetRow {
	category: BadgeCategoryId;
	group: BadgeGroup;
	progress: ProgressView;
}

export interface GroupView {
	cards: Card[];
	gallery: GalleryGroup[];
	count: number;
}

export interface BadgeSection {
	personal: GroupView;
	/** Null until the team's badges are evaluated (US4). */
	team: GroupView | null;
	/** Personal categories first, then team ones. */
	notYet: NotYetRow[];
	/** Badges new for this rider (research R16), in catalog order. */
	reveal: EarnedBadge[];
}

export interface Evaluated {
	earned: readonly EarnedBadge[];
	progress: readonly CategoryProgress[];
}

/** Nothing while the waiting state shows (FR-005). */
export function buildBadgeSection(input: {
	waiting: boolean;
	personal: Evaluated;
	team?: Evaluated;
	/** Badge id → the date it had when revealed; absent: no reveal at all. */
	revealed?: ReadonlyMap<string, string>;
	/** `YYYY-MM-DD` the rider connected; older team badges aren't new. */
	connectedOn?: string;
}): BadgeSection | null {
	if (input.waiting) return null;
	const personal = groupView(input.personal);
	const team = input.team ? groupView(input.team) : null;
	const { revealed, connectedOn = "" } = input;
	return {
		personal: personal.view,
		team: team?.view ?? null,
		notYet: [...personal.notYet, ...(team?.notYet ?? [])],
		reveal: revealed
			? [
					...input.personal.earned,
					...(input.team?.earned ?? []).filter(
						(b) => b.earnedOn >= connectedOn,
					),
				]
					.filter((b) => isNew(b, revealed))
					.sort((a, b) => badgeOrder(a.badgeId) - badgeOrder(b.badgeId))
			: [],
	};
}

/**
 * Earned with no reveal yet, or revealed with an earlier date: taken back and
 * earned again later (research R16, spec edge case).
 */
function isNew(
	badge: EarnedBadge,
	revealed: ReadonlyMap<string, string>,
): boolean {
	const shown = revealed.get(badge.badgeId);
	return shown === undefined || shown < badge.earnedOn;
}

/** Newest first; on the same day the higher badge first. */
const newestFirst = (a: EarnedBadge, b: EarnedBadge) =>
	b.earnedOn.localeCompare(a.earnedOn) ||
	badgeOrder(b.badgeId) - badgeOrder(a.badgeId);

function groupView({ earned, progress }: Evaluated): {
	view: GroupView;
	notYet: NotYetRow[];
} {
	const cards: Card[] = [];
	const gallery: GalleryGroup[] = [];
	const notYet: NotYetRow[] = [];
	for (const category of BADGE_CATEGORIES) {
		const own = progress.find((p) => p.category === category.id);
		if (!own) continue;
		const badges = earned
			.filter((b) => badgeById(b.badgeId)?.category === category.id)
			.sort(newestFirst);
		const shown = progressView(own);
		const highest = [...badges].sort(
			(a, b) => badgeOrder(b.badgeId) - badgeOrder(a.badgeId),
		)[0];
		// Every category, the ones without a badge as outlines only (issue #109).
		gallery.push({
			category: category.id,
			badges,
			unearned: category.ladder.length - badges.length,
		});
		if (!highest) {
			if (shown) {
				notYet.push({
					category: category.id,
					group: category.group,
					progress: shown,
				});
			}
			continue;
		}
		cards.push({ category: category.id, badge: highest, progress: shown });
	}
	cards.sort((a, b) => newestFirst(a.badge, b.badge));
	return {
		view: { cards, gallery, count: earned.length },
		notYet,
	};
}

function progressView(progress: CategoryProgress): ProgressView | null {
	const { category, value, next } = progress;
	if (next === null) return null;
	return {
		unit: categoryById(category).unit,
		next,
		missing: shownMissing(category, value, next),
		percent: Math.min(100, Math.max(0, Math.floor((value / next) * 100))),
	};
}

/**
 * What is missing to `next`, from the value rounded down: whole units, run
 * length to one decimal, so it is never shown as 0 (spec Assumptions).
 */
export function shownMissing(
	category: BadgeCategoryId,
	value: number,
	next: number,
): number {
	if (category === "run_length") {
		return (Math.round(next * 10) - Math.floor(value * 10)) / 10;
	}
	return next - Math.floor(value);
}

/** The personal categories' current values, as the Overview reads them. */
export interface PersonalFigures {
	/** Over the rider's counting rides. */
	distanceM: number;
	elevationDm: number;
	attendance: readonly Pick<Attendance, "eventId" | "kind" | "date">[];
	trainingRynke: number;
	/** Over the rider's outdoor runs inside the counting window. */
	longestRunM: number;
	runDistanceM: number;
}

/**
 * The progress per personal category from the stored figures: the same
 * values `evaluateBadges` ends on, without re-reading every ride.
 */
export function personalProgress(
	figures: PersonalFigures,
	window: CountingWindow,
): CategoryProgress[] {
	const attended = figures.attendance.filter((a) =>
		inCountingWindow(a.date, window),
	);
	const events = (kind?: Attendance["kind"]) =>
		new Set(
			attended
				.filter((a) => kind === undefined || a.kind === kind)
				.map((a) => a.eventId),
		).size;
	return [
		progressOf("distance", figures.distanceM / 1000),
		progressOf("elevation", figures.elevationDm / 10),
		progressOf("team_events", events()),
		progressOf("technique", events("technique_training")),
		progressOf("training_rynke", figures.trainingRynke),
		progressOf("run_length", figures.longestRunM / 1000),
		progressOf("running", figures.runDistanceM / 1000),
	];
}
