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
import type { BadgeCategoryId } from "./catalog";
import {
	type CategoryProgress,
	cumulative,
	type DatedRun,
	type EarnedBadge,
	fromSeries,
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

export interface TeamBadgeSums {
	riders: readonly TeamRiderDays[];
	/** The listed riders' outdoor runs, summed per day. */
	runs: readonly DatedRun[];
	events: readonly TeamEventSum[];
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
	return fromSeries(series, "team");
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
