// A rider's personal badges and the progress per category, from what they have
// stored (feature 013 FR-001 to FR-004, FR-010, FR-013, data-model.md
// "Evaluation"). Pure like `rynke/tally.ts`: no bindings, no clock. The same
// inputs always give the same badges (FR-030).

import {
	type CountingWindow,
	inCountingWindow,
	type RynkeRules,
} from "../rynke/rules";
import type { Attendance } from "../rynke/team-events";
import { type DatedCorrection, riderDays } from "../rynke/weeks";
import {
	BADGE_CATEGORIES,
	BADGES,
	type BadgeCategoryId,
	type BadgeId,
	categoryById,
} from "./catalog";

/** A counting ride (its result counts), by the ride's local start date. */
export interface CountingRide {
	/** `YYYY-MM-DD` */
	date: string;
	distanceM: number;
	distanceRynke: number;
	elevationDm: number;
}

/** An outdoor run, by its local start date. */
export interface DatedRun {
	/** `YYYY-MM-DD` */
	date: string;
	distanceM: number;
}

export interface PersonalInputs {
	rides: readonly CountingRide[];
	runs: readonly DatedRun[];
	attendance: readonly Attendance[];
	corrections: readonly DatedCorrection[];
}

export interface EarnedBadge {
	badgeId: BadgeId;
	/** `YYYY-MM-DD`: the day the category's value reached the threshold. */
	earnedOn: string;
}

export interface CategoryProgress {
	category: BadgeCategoryId;
	/** In the category's unit; km and m unrounded. */
	value: number;
	/** The next threshold, or null once the category is complete. */
	next: number | null;
	missing: number | null;
}

/** A category's value after each day that changed it, in date order. */
type Series = { date: string; value: number }[];

export function evaluateBadges(
	inputs: PersonalInputs,
	rules: RynkeRules,
	window: CountingWindow,
): { earned: EarnedBadge[]; progress: CategoryProgress[] } {
	const series = personalSeries(inputs, rules, window);
	return fromSeries(series, "personal");
}

/**
 * Earned badges and progress for one group's categories from their series.
 * Shared with the team badges (`team.ts`).
 */
export function fromSeries(
	series: Partial<Record<BadgeCategoryId, Series>>,
	group: "personal" | "team",
): { earned: EarnedBadge[]; progress: CategoryProgress[] } {
	const earned: EarnedBadge[] = [];
	const progress: CategoryProgress[] = [];
	for (const category of BADGE_CATEGORIES) {
		if (category.group !== group) continue;
		const points = series[category.id] ?? [];
		const value = points.at(-1)?.value ?? 0;
		for (const badge of BADGES) {
			if (badge.category !== category.id || value < badge.threshold) continue;
			earned.push({
				badgeId: badge.id,
				earnedOn: reachedOn(points, badge.threshold),
			});
		}
		progress.push(progressOf(category.id, value));
	}
	return { earned, progress };
}

/** How far a category's value is from its next threshold. */
export function progressOf(
	category: BadgeCategoryId,
	value: number,
): CategoryProgress {
	const next = categoryById(category).ladder.find((t) => t > value) ?? null;
	return {
		category,
		value,
		next,
		missing: next === null ? null : next - value,
	};
}

/**
 * The first date from which the value stayed at or above `threshold`: the
 * date it was reached, or reached again after a correction took it below.
 */
function reachedOn(points: Series, threshold: number): string {
	let date = "";
	for (const point of points) {
		if (point.value < threshold) date = "";
		else if (date === "") date = point.date;
	}
	return date;
}

/** Adds up dated amounts per day into a running total. */
export function cumulative(
	amounts: readonly { date: string; amount: number }[],
): Series {
	const byDate = new Map<string, number>();
	for (const { date, amount } of amounts) {
		byDate.set(date, (byDate.get(date) ?? 0) + amount);
	}
	let total = 0;
	return [...byDate.keys()].sort().map((date) => {
		total += byDate.get(date) ?? 0;
		return { date, value: total };
	});
}

function personalSeries(
	inputs: PersonalInputs,
	rules: RynkeRules,
	window: CountingWindow,
): Partial<Record<BadgeCategoryId, Series>> {
	const attended = inputs.attendance.filter((a) =>
		inCountingWindow(a.date, window),
	);
	const events = (kind?: Attendance["kind"]) =>
		cumulative(
			[
				...new Map(
					attended
						.filter((a) => kind === undefined || a.kind === kind)
						.map((a) => [a.eventId, a.date]),
				),
			].map(([, date]) => ({ date, amount: 1 })),
		);
	const runs = inputs.runs.filter((r) => inCountingWindow(r.date, window));
	let longest = 0;
	const runLength: Series = [];
	for (const run of [...runs].sort((a, b) => a.date.localeCompare(b.date))) {
		if (run.distanceM / 1000 <= longest) continue;
		longest = run.distanceM / 1000;
		if (runLength.at(-1)?.date === run.date) runLength.pop();
		runLength.push({ date: run.date, value: longest });
	}
	return {
		distance: cumulative(
			inputs.rides.map((r) => ({ date: r.date, amount: r.distanceM / 1000 })),
		),
		elevation: cumulative(
			inputs.rides.map((r) => ({ date: r.date, amount: r.elevationDm / 10 })),
		),
		team_events: events(),
		technique: events("technique_training"),
		training_rynke: riderDays(
			{
				rides: inputs.rides,
				attendance: inputs.attendance,
				corrections: inputs.corrections,
			},
			window,
			rules,
		).map((day) => ({ date: day.date, value: day.training })),
		run_length: runLength,
		running: cumulative(
			runs.map((r) => ({ date: r.date, amount: r.distanceM / 1000 })),
		),
	};
}
