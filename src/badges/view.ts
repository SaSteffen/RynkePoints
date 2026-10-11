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
	notYet: NotYetRow[];
}

export interface Evaluated {
	earned: readonly EarnedBadge[];
	progress: readonly CategoryProgress[];
}

/** Nothing while the waiting state shows (FR-005). */
export function buildBadgeSection(input: {
	waiting: boolean;
	personal: Evaluated;
}): BadgeSection | null {
	if (input.waiting) return null;
	const personal = groupView(input.personal);
	return {
		personal: personal.view,
		notYet: personal.notYet,
	};
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
		gallery.push({ category: category.id, badges });
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
		progressOf("run_length", 0),
		progressOf("running", 0),
	];
}
