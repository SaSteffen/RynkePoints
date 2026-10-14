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
	surpriseName,
} from "./catalog";
import { easterSunday } from "./easter";

/** A counting ride (its result counts), by the ride's local start date. */
export interface CountingRide {
	/** `YYYY-MM-DD` */
	date: string;
	distanceM: number;
	distanceRynke: number;
	elevationDm: number;
	/** A virtual or indoor-trainer ride (003 FR-013a); absent: outdoor. */
	virtual?: boolean;
	/** Local start time `HH:MM`, for night owl and early bird (part D). */
	startTime?: string;
}

/** An outdoor run, by its local start date. */
export interface DatedRun {
	/** `YYYY-MM-DD` */
	date: string;
	distanceM: number;
}

/** A recorded swim, pool or open water, by its local start date (part C). */
export type DatedSwim = DatedRun;

export interface PersonalInputs {
	rides: readonly CountingRide[];
	runs: readonly DatedRun[];
	/** Absent: no swims. */
	swims?: readonly DatedSwim[];
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

/**
 * The counting window for badges on `today` (`YYYY-MM-DD`, Berlin): it ends
 * today at the latest, so nothing dated in the future earns a badge, and a
 * day only counts as over (a rest day, a team day off) once a later activity
 * dated today or earlier shows it.
 */
export function badgeWindow(
	window: CountingWindow,
	today: string,
): CountingWindow {
	return today < window.deadline ? { ...window, deadline: today } : window;
}

/** Only what is dated on or before the window's last day. */
export function notAfter<T extends { date: string }>(
	items: readonly T[],
	window: CountingWindow,
): T[] {
	return items.filter((item) => item.date <= window.deadline);
}

export function evaluateBadges(
	all: PersonalInputs,
	rules: RynkeRules,
	window: CountingWindow,
): { earned: EarnedBadge[]; progress: CategoryProgress[] } {
	const inputs: PersonalInputs = {
		rides: notAfter(all.rides, window),
		runs: notAfter(all.runs, window),
		swims: notAfter(all.swims ?? [], window),
		attendance: notAfter(all.attendance, window),
		corrections: notAfter(all.corrections, window),
	};
	const series = personalSeries(inputs, rules, window);
	const { earned, progress } = fromSeries(series, "personal");
	const surprises = surpriseBadges(inputs, window);
	return {
		// Surprises are the last personal category, so catalog order holds.
		earned: [...earned, ...surprises],
		progress: progress.map((p) =>
			categoryById(p.category).surprise
				? progressOf(p.category, surprises.length)
				: p,
		),
	};
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
	const { ladder, surprise } = categoryById(category);
	// Surprise badges have no next step to show (FR-015).
	const next = surprise ? null : (ladder.find((t) => t > value) ?? null);
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
	const swims = (inputs.swims ?? []).filter((s) =>
		inCountingWindow(s.date, window),
	);
	const km = (items: readonly { date: string; distanceM: number }[]) =>
		items.map((i) => ({ date: i.date, amount: i.distanceM / 1000 }));
	const winter: Partial<Record<BadgeCategoryId, Series>> = {};
	for (const category of BADGE_CATEGORIES) {
		if (category.month === undefined) continue;
		const days = new Set(
			inputs.rides
				.filter(
					(r) => !r.virtual && Number(r.date.slice(5, 7)) === category.month,
				)
				.map((r) => r.date),
		);
		winter[category.id] = cumulative(
			[...days].map((date) => ({ date, amount: 1 })),
		);
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
		run_length: longestSoFar(runs),
		running: cumulative(km(runs)),
		ride_length: longestSoFar(inputs.rides),
		virtual_rides: cumulative(km(inputs.rides.filter((r) => r.virtual))),
		swim_length: longestSoFar(swims),
		swimming: cumulative(km(swims)),
		...winter,
	};
}

/** The longest single activity so far, in km, after each day that raised it. */
function longestSoFar(
	items: readonly { date: string; distanceM: number }[],
): Series {
	let longest = 0;
	const series: Series = [];
	for (const item of [...items].sort((a, b) => a.date.localeCompare(b.date))) {
		if (item.distanceM / 1000 <= longest) continue;
		longest = item.distanceM / 1000;
		if (series.at(-1)?.date === item.date) series.pop();
		series.push({ date: item.date, value: longest });
	}
	return series;
}

/**
 * The surprise badges and the first date each rule was met (FR-015a,
 * research R33): holidays by any activity's local date, night owl and early
 * bird by a counting ride's local start time, and the rest day once a later
 * activity shows the day off is over. Part F's traditions (FR-017, research
 * R43) look at counting rides' distances, elevation and virtual flag.
 */
function surpriseBadges(
	inputs: PersonalInputs,
	window: CountingWindow,
): EarnedBadge[] {
	const rides = inputs.rides.filter((r) => inCountingWindow(r.date, window));
	const days = new Set(
		[...rides, ...inputs.runs, ...(inputs.swims ?? [])]
			.map((a) => a.date)
			.filter((date) => inCountingWindow(date, window)),
	);
	const sorted = [...days].sort();
	const first = (dates: readonly string[]) => [...dates].sort()[0];
	const on = (...monthDays: string[]) =>
		first(sorted.filter((d) => monthDays.includes(d.slice(5))));
	const startingAt = (test: (time: string) => boolean) =>
		first(
			rides
				.filter((r) => r.startTime !== undefined && test(r.startTime))
				.map((r) => r.date),
		);
	const found: Record<string, string | undefined> = {
		"new-year": on("01-01"),
		"christmas-eve": on("12-24"),
		christmas: on("12-25", "12-26"),
		"night-owl": startingAt((time) => time >= "21:30"),
		"early-bird": startingAt((time) => time < "06:00"),
		"rest-day": restDay(sorted, days),
		...traditions(rides, inputs, window, days),
	};
	return BADGES.flatMap((badge) => {
		const name = surpriseName(badge);
		const earnedOn = name === null ? undefined : found[name];
		return earnedOn ? [{ badgeId: badge.id, earnedOn }] : [];
	});
}

/** Festive 500: 500 km of counting rides dated 24 to 31 December. */
const FESTIVE_M = 500_000;
/** Etappenfahrer: three dates in a row with 100 km each. */
const STAGE_M = 100_000;
const STAGE_DAYS = 3;
/** Kreiszahl: one ride of 31.4 km on 14 March. */
const PI_M = 31_400;
/** Everesting: 8,848 m of climbing in one calendar month. */
const EVEREST_DM = 88_480;

type DatedRide = Pick<
	CountingRide,
	"date" | "distanceM" | "elevationDm" | "virtual"
>;

/**
 * The first date a running sum of `amount` over `rides` in date order,
 * restarted for every new `group`, reaches `goal`; whole days at once.
 */
function firstReached(
	rides: readonly DatedRide[],
	amount: (ride: DatedRide) => number,
	goal: number,
	group: (date: string) => string = () => "",
): string | undefined {
	const perDay = new Map<string, number>();
	for (const ride of rides) {
		perDay.set(ride.date, (perDay.get(ride.date) ?? 0) + amount(ride));
	}
	const totals = new Map<string, number>();
	for (const date of [...perDay.keys()].sort()) {
		const key = group(date);
		const total = (totals.get(key) ?? 0) + (perDay.get(date) ?? 0);
		if (total >= goal) return date;
		totals.set(key, total);
	}
	return undefined;
}

/** Part F's seven surprise rules (FR-017, research R43). */
function traditions(
	rides: readonly DatedRide[],
	inputs: PersonalInputs,
	window: CountingWindow,
	days: ReadonlySet<string>,
): Record<string, string | undefined> {
	const inWindow = (date: string) => inCountingWindow(date, window);
	const monthDay = (date: string) => date.slice(5);
	const outdoor = rides.filter((r) => !r.virtual);
	// Per date, the counting rides' metres, for the stage days.
	const metres = new Map<string, number>();
	for (const ride of rides) {
		metres.set(ride.date, (metres.get(ride.date) ?? 0) + ride.distanceM);
	}
	const stageDays = [...metres.keys()]
		.filter((date) => (metres.get(date) ?? 0) >= STAGE_M)
		.sort();
	const stage = stageDays.find((date) => {
		for (let back = 1; back < STAGE_DAYS; back++) {
			if ((metres.get(shift(date, -back)) ?? 0) < STAGE_M) return false;
		}
		return true;
	});
	const runDays = new Set(
		inputs.runs.map((r) => r.date).filter((date) => inWindow(date)),
	);
	const swimDays = new Set(
		(inputs.swims ?? []).map((s) => s.date).filter((date) => inWindow(date)),
	);
	const triathlon = [...new Set(rides.map((r) => r.date))]
		.sort()
		.find((date) => runDays.has(date) && swimDays.has(date));
	const firstOutdoor = (day: string) =>
		outdoor
			.filter((r) => monthDay(r.date) === day)
			.map((r) => r.date)
			.sort()[0];
	const winterSolstice = firstOutdoor("12-21");
	const summerSolstice = firstOutdoor("06-21");
	const easter = [...days].sort().find((date) => {
		const sunday = easterSunday(Number(date.slice(0, 4)));
		return date === sunday || date === shift(sunday, 1);
	});
	return {
		"festive-500": firstReached(
			rides.filter((r) => monthDay(r.date) >= "12-24"),
			(r) => r.distanceM,
			FESTIVE_M,
		),
		"stage-rider": stage,
		triathlon,
		"pi-day": rides
			.filter((r) => monthDay(r.date) === "03-14" && r.distanceM >= PI_M)
			.map((r) => r.date)
			.sort()[0],
		// Both days, dated with the later one (21 June in a season from
		// September).
		solstice:
			winterSolstice && summerSolstice
				? [winterSolstice, summerSolstice].sort()[1]
				: undefined,
		easter,
		everesting: firstReached(
			rides,
			(r) => r.elevationDm,
			EVEREST_DM,
			(date) => date.slice(0, 7),
		),
	};
}

/** `YYYY-MM-DD` shifted by `days`. */
function shift(date: string, days: number): string {
	return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000)
		.toISOString()
		.slice(0, 10);
}

/**
 * The first day without an activity right after seven days in a row with
 * one, once an activity after it shows the day is over.
 */
function restDay(
	sorted: readonly string[],
	days: ReadonlySet<string>,
): string | undefined {
	const last = sorted.at(-1);
	for (const date of sorted) {
		const rest = shift(date, 1);
		if (days.has(rest) || last === undefined || last <= rest) continue;
		let week = true;
		for (let back = 1; back <= 7; back++) {
			if (!days.has(shift(rest, -back))) week = false;
		}
		if (week) return rest;
	}
	return undefined;
}
