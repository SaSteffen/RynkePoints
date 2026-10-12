// The team's badges and the progress per team category, from sums over the
// listed riders (feature 013 FR-011, FR-032, research R15). Pure like
// `evaluate.ts`; worked out on every request and never stored, so they follow
// consents, departures and corrections and can be taken back. Only sums come
// in: nothing here can tell who contributed.

import {
	type CountingWindow,
	inCountingWindow,
	type RynkeRules,
} from "../rynke/rules";
import { type DailyInputs, type DailyRideSum, riderDays } from "../rynke/weeks";
import { BADGES, type BadgeCategoryId, surpriseName } from "./catalog";
import {
	type CategoryProgress,
	cumulative,
	type DatedRun,
	type EarnedBadge,
	fromSeries,
	progressOf,
} from "./evaluate";

/** One listed rider's counting rides per day and Training Rynke inputs. */
export interface TeamRiderDays extends DailyInputs {
	rides: readonly (DailyRideSum & { distanceM: number })[];
}

/** A team event with the number of listed riders who attended it. */
export interface TeamEventSum {
	eventId: number;
	/** `YYYY-MM-DD` */
	date: string;
	attendees: number;
}

/**
 * A listed rider's counting ride, outdoor run or swim, reduced to when it
 * started
 * (part E, research R39). The id only tells riders apart inside this pure
 * function; nothing of it reaches the page (FR-016a).
 */
export interface TeamActivity {
	athleteId: number;
	/** Local start date, `YYYY-MM-DD`. */
	date: string;
	/** Local start hour, 0 to 23. */
	hour: number;
}

export interface TeamBadgeSums {
	riders: readonly TeamRiderDays[];
	/** The listed riders' outdoor runs, summed per day. */
	runs: readonly DatedRun[];
	events: readonly TeamEventSum[];
	/** For the team surprises; absent: none (part E). */
	active?: readonly TeamActivity[];
	/** Each listed rider's connection date, `YYYY-MM-DD`, by rider id. */
	connectedOn?: ReadonlyMap<number, string>;
}

type Series = { date: string; value: number }[];

export function evaluateTeamBadges(
	sums: TeamBadgeSums,
	rules: RynkeRules,
	window: CountingWindow,
): { earned: EarnedBadge[]; progress: CategoryProgress[] } {
	const rides = sums.riders.flatMap((r) => r.rides);
	const events = sums.events
		.filter((e) => inCountingWindow(e.date, window))
		.sort((a, b) => a.date.localeCompare(b.date));
	const series: Partial<Record<BadgeCategoryId, Series>> = {
		team_training_rynke: together(
			sums.riders.map((rider) =>
				riderDays(rider, window, rules).map((day) => ({
					date: day.date,
					value: day.training,
				})),
			),
		),
		team_distance: cumulative(
			rides.map((r) => ({ date: r.date, amount: r.distanceM / 1000 })),
		),
		team_elevation: cumulative(
			rides.map((r) => ({ date: r.date, amount: r.elevationDm / 10 })),
		),
		team_running: cumulative(
			sums.runs
				.filter((r) => inCountingWindow(r.date, window))
				.map((r) => ({ date: r.date, amount: r.distanceM / 1000 })),
		),
		big_training: largest(events),
		attendances: cumulative(
			events.map((e) => ({ date: e.date, amount: e.attendees })),
		),
	};
	const { earned, progress } = fromSeries(series, "team");
	const surprises = teamSurprises(sums, window);
	return {
		// Team surprises are the last team category, so catalog order holds.
		earned: [...earned, ...surprises],
		progress: progress.map((p) =>
			p.category === "team_surprise"
				? progressOf(p.category, surprises.length)
				: p,
		),
	};
}

/** At least this many riders out on New Year's Eve and on a Sunday. */
const NEW_YEARS_EVE_RIDERS = 5;
const SUNDAY_OUTING_RIDERS = 10;
const RELAY_DAYS = 30;

/**
 * The team surprise badges and the first date each rule was met (FR-016,
 * research R40), from the listed riders' activities in the counting window.
 */
function teamSurprises(
	sums: TeamBadgeSums,
	window: CountingWindow,
): EarnedBadge[] {
	const riders = new Map<string, Set<number>>();
	const hours = new Map<string, Set<number>>();
	for (const a of sums.active ?? []) {
		if (!inCountingWindow(a.date, window)) continue;
		if (!riders.has(a.date)) riders.set(a.date, new Set());
		riders.get(a.date)?.add(a.athleteId);
		if (!hours.has(a.date)) hours.set(a.date, new Set());
		hours.get(a.date)?.add(a.hour);
	}
	const dates = [...riders.keys()].sort();
	const eventDays = new Set(sums.events.map((e) => e.date));
	const count = (date: string) => riders.get(date)?.size ?? 0;
	const connected = [...(sums.connectedOn ?? new Map()).entries()];
	const found: Record<string, string | undefined> = {
		"day-off": dayOff(dates),
		"all-out": dates.find((date) => {
			const due = connected.filter(([, on]) => on <= date).map(([id]) => id);
			const out = riders.get(date) ?? new Set();
			return due.length >= 2 && due.every((id) => out.has(id));
		}),
		"round-the-clock": dates.find((date) => (hours.get(date)?.size ?? 0) >= 24),
		relay: relay(dates),
		"new-years-eve": dates.find(
			(date) =>
				date.slice(5) === "12-31" && count(date) >= NEW_YEARS_EVE_RIDERS,
		),
		"sunday-outing": dates.find(
			(date) =>
				new Date(`${date}T12:00:00Z`).getUTCDay() === 0 &&
				!eventDays.has(date) &&
				count(date) >= SUNDAY_OUTING_RIDERS,
		),
	};
	return BADGES.flatMap((badge) => {
		if (badge.category !== "team_surprise") return [];
		const name = surpriseName(badge);
		const earnedOn = name === null ? undefined : found[name];
		return earnedOn ? [{ badgeId: badge.id, earnedOn }] : [];
	});
}

/** `YYYY-MM-DD` shifted by `days`. */
function shift(date: string, days: number): string {
	return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000)
		.toISOString()
		.slice(0, 10);
}

/** The first date without anyone active between two active dates. */
function dayOff(dates: readonly string[]): string | undefined {
	for (let i = 1; i < dates.length; i++) {
		const next = shift(dates[i - 1] as string, 1);
		if (next !== dates[i]) return next;
	}
	return undefined;
}

/** The last date of the first run of `RELAY_DAYS` active dates in a row. */
function relay(dates: readonly string[]): string | undefined {
	let run = 0;
	let previous: string | undefined;
	for (const date of dates) {
		run = previous !== undefined && shift(previous, 1) === date ? run + 1 : 1;
		if (run >= RELAY_DAYS) return date;
		previous = date;
	}
	return undefined;
}

/** The sum of every rider's value after each day any of them changed. */
function together(riders: readonly Series[]): Series {
	const dates = [
		...new Set(riders.flatMap((s) => s.map((p) => p.date))),
	].sort();
	return dates.map((date) => ({
		date,
		value: riders.reduce(
			(sum, points) =>
				sum + (points.findLast((p) => p.date <= date)?.value ?? 0),
			0,
		),
	}));
}

/** The most attendees at one event so far, after each event that raised it. */
function largest(events: readonly TeamEventSum[]): Series {
	const series: Series = [];
	for (const event of events) {
		const last = series.at(-1);
		if (event.attendees <= (last?.value ?? 0)) continue;
		if (last?.date === event.date) series.pop();
		series.push({ date: event.date, value: event.attendees });
	}
	return series;
}
