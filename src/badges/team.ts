// The team's badges and the progress per team category, from sums over the
// listed riders (feature 013 FR-011, FR-032, research R15). Pure like
// `evaluate.ts`; worked out on every request and never stored, so they follow
// consents, departures and corrections and can be taken back. Only sums come
// in: nothing here can tell who contributed.

import {
	type CountingWindow,
	eventInWindow,
	inCountingWindow,
	type RynkeRules,
} from "../rynke/rules";
import type { EventKind } from "../rynke/team-events";
import { type DailyInputs, type DailyRideSum, riderDays } from "../rynke/weeks";
import {
	BADGES,
	type BadgeCategoryId,
	categoryById,
	surpriseName,
} from "./catalog";
import {
	type CategoryProgress,
	cumulative,
	type DatedRun,
	type EarnedBadge,
	fromSeries,
	notAfter,
	progressOf,
} from "./evaluate";

/** One listed rider's counting rides per day and Training Rynke inputs. */
export interface TeamRiderDays extends DailyInputs {
	rides: readonly (DailyRideSum & { distanceM: number })[];
}

/** A team event with the number of listed riders who attended it. */
export interface TeamEventSum {
	eventId: number;
	/** A tour day counts after the deadline too (feature 021 FR-005). */
	kind: EventKind;
	/** `YYYY-MM-DD` */
	date: string;
	attendees: number;
}

/**
 * A listed rider's attendance at a Tour de Paris day (feature 021, research
 * R11). The id only tells riders apart inside this pure function (FR-012).
 */
export interface TourDay {
	athleteId: number;
	/** The tour day's date, `YYYY-MM-DD`. */
	date: string;
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
	/** A counting ride, not a run or a swim (part F, research R45). */
	ride: boolean;
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
	/** One per listed rider's tour day (feature 021); absent: none. */
	tourDays?: readonly TourDay[];
}

type Series = { date: string; value: number }[];

export function evaluateTeamBadges(
	all: TeamBadgeSums,
	rules: RynkeRules,
	window: CountingWindow,
): { earned: EarnedBadge[]; progress: CategoryProgress[] } {
	// Nothing after the window's last day, which callers end today at the
	// latest (`badgeWindow`).
	const sums: TeamBadgeSums = {
		...all,
		riders: all.riders.map((rider) => ({
			...rider,
			rides: notAfter(rider.rides, window),
			attendance: notAfter(rider.attendance, window),
			corrections: notAfter(rider.corrections, window),
		})),
		runs: notAfter(all.runs, window),
		// A tour day counts after the deadline, up to today (feature 021).
		events: all.events.filter((e) => eventInWindow(e.kind, e.date, window)),
		active: notAfter(all.active ?? [], window),
	};
	const rides = sums.riders.flatMap((r) => r.rides);
	const events = [...sums.events].sort((a, b) => a.date.localeCompare(b.date));
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
		tour_de_paris: tourSeries(all.tourDays ?? [], window),
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
/** Festive Team: from Christmas Eve to New Year's Eve (part F). */
const FESTIVE_FROM = "12-24";
const FESTIVE_TO = "12-31";

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
		"festive-team": festiveTeam(sums, window, connected),
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

/**
 * Festive Team (FR-017a, research R45): every listed rider connected by 24
 * December, at least two, with a counting ride dated 24 to 31 December; dated
 * the day the last of them first rides.
 */
function festiveTeam(
	sums: TeamBadgeSums,
	window: CountingWindow,
	connected: readonly (readonly [number, string])[],
): string | undefined {
	const festive = (date: string) =>
		date.slice(5) >= FESTIVE_FROM && date.slice(5) <= FESTIVE_TO;
	const firstRide = new Map<number, string>();
	for (const a of sums.active ?? []) {
		if (!a.ride || !festive(a.date) || !inCountingWindow(a.date, window)) {
			continue;
		}
		const known = firstRide.get(a.athleteId);
		if (known === undefined || a.date < known)
			firstRide.set(a.athleteId, a.date);
	}
	const years = new Set([...firstRide.values()].map((d) => d.slice(0, 4)));
	for (const year of [...years].sort()) {
		const due = connected
			.filter(([, on]) => on <= `${year}-${FESTIVE_FROM}`)
			.map(([id]) => id);
		if (due.length < 2) continue;
		const dates = due.map((id) => firstRide.get(id));
		if (dates.some((d) => d === undefined || !d.startsWith(year))) continue;
		return (dates as string[]).sort().at(-1);
	}
	return undefined;
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

/**
 * The most tour days any one listed rider has reached, after each tour day
 * that raised it (feature 021 FR-011, research R11), never above the
 * ladder's last day.
 */
function tourSeries(days: readonly TourDay[], window: CountingWindow): Series {
	const last = categoryById("tour_de_paris").ladder.at(-1) ?? 0;
	const counts = new Map<number, number>();
	const series: Series = [];
	let best = 0;
	const inWindow = days
		.filter((d) => eventInWindow("tour_de_paris", d.date, window))
		.sort((a, b) => a.date.localeCompare(b.date));
	for (const day of inWindow) {
		const count = (counts.get(day.athleteId) ?? 0) + 1;
		counts.set(day.athleteId, count);
		if (Math.min(count, last) <= best) continue;
		best = Math.min(count, last);
		if (series.at(-1)?.date === day.date) series.pop();
		series.push({ date: day.date, value: best });
	}
	return series;
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
