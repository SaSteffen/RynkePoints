// A rider's stored summary (feature 030): what team reads add up, worked out
// from the same evaluation as the balance and held as JSON text per column of
// `rider_summaries`. Pure like `tally.ts`; the SQL is in `db/rider-summaries.ts`.

import type { TeamActivity, TeamBadgeSums } from "../badges/team";
import type { Attendance, EventKind } from "./team-events";
import { type DatedCorrection, weekEndOf } from "./weeks";

/**
 * Raising it makes every stored row count as missing, so readers add those
 * riders up and the daily job works them out again (research R6).
 */
export const RIDER_SUMMARY_VERSION = 1;

/** `[date, distanceM, distanceRynke, elevationDm]`, one per day of rides. */
export type DayEntry = [string, number, number, number];
/** `[weekEnd, distanceRynke, elevationDm]`, one per week of rides. */
export type WeekEntry = [string, number, number];
/** `[date, distanceM]`, one per day of outdoor runs. */
export type RunDayEntry = [string, number];
/** `[date, hour, ride]`, a distinct start; `ride` is 1 for a counting ride. */
export type ActiveEntry = [string, number, 0 | 1];

/** The columns of a rider's stored row, as JSON text. */
export interface RiderSummary {
	days: string;
	weeks: string;
	runDays: string;
	active: string;
	attended: string;
}

interface StartedFigure {
	/** `YYYY-MM-DD` */
	date: string;
	distanceM: number;
	/** `HH:MM`, local. */
	startTime: string;
}

/** A rider's counting rides, outdoor runs and swims, from their evaluation. */
export interface SummaryFigures {
	rides: readonly (StartedFigure & {
		distanceRynke: number;
		elevationDm: number;
	})[];
	runs: readonly StartedFigure[];
	swims: readonly StartedFigure[];
}

const byDateThenValue = (
	a: { date: string; distanceM: number },
	b: { date: string; distanceM: number },
) => compareText(a.date, b.date) || a.distanceM - b.distanceM;

function compareText(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * The stored row for these figures. All inputs are sorted by value before
 * adding up, since activities arrive in no fixed order: the same figures must
 * give the same text, or an unchanged evaluation would write (research R3).
 */
export function summaryOf(
	figures: SummaryFigures,
	attendance: readonly Pick<Attendance, "eventId">[],
): RiderSummary {
	const rides = [...figures.rides].sort(
		(a, b) =>
			byDateThenValue(a, b) ||
			a.distanceRynke - b.distanceRynke ||
			a.elevationDm - b.elevationDm,
	);
	const days: DayEntry[] = [];
	const weeks: WeekEntry[] = [];
	for (const ride of rides) {
		const day = days.at(-1);
		if (day?.[0] === ride.date) {
			day[1] += ride.distanceM;
			day[2] += ride.distanceRynke;
			day[3] += ride.elevationDm;
		} else {
			days.push([
				ride.date,
				ride.distanceM,
				ride.distanceRynke,
				ride.elevationDm,
			]);
		}
		const weekEnd = weekEndOf(ride.date);
		const week = weeks.at(-1);
		if (week?.[0] === weekEnd) {
			week[1] += ride.distanceRynke;
			week[2] += ride.elevationDm;
		} else {
			weeks.push([weekEnd, ride.distanceRynke, ride.elevationDm]);
		}
	}
	const runDays: RunDayEntry[] = [];
	for (const run of [...figures.runs].sort(byDateThenValue)) {
		const day = runDays.at(-1);
		if (day?.[0] === run.date) day[1] += run.distanceM;
		else runDays.push([run.date, run.distanceM]);
	}
	return {
		days: JSON.stringify(days),
		weeks: JSON.stringify(weeks),
		runDays: JSON.stringify(runDays),
		active: JSON.stringify(activeOf(figures)),
		attended: JSON.stringify(
			attendance.map((a) => a.eventId).sort((a, b) => a - b),
		),
	};
}

/** Distinct by date, hour and kind, sorted; nothing else of a swim (FR-025). */
function activeOf(figures: SummaryFigures): ActiveEntry[] {
	const starts = new Map<string, ActiveEntry>();
	const add = (activities: readonly StartedFigure[], ride: 0 | 1) => {
		for (const { date, startTime } of activities) {
			const hour = Number(startTime.slice(0, 2));
			starts.set(`${date}|${hour}|${ride}`, [date, hour, ride]);
		}
	};
	add(figures.rides, 1);
	add(figures.runs, 0);
	add(figures.swims, 0);
	return [...starts.values()].sort(
		(a, b) => compareText(a[0], b[0]) || a[1] - b[1] || a[2] - b[2],
	);
}

export function parseDays(text: string): DayEntry[] {
	return JSON.parse(text) as DayEntry[];
}

export function parseWeeks(text: string): WeekEntry[] {
	return JSON.parse(text) as WeekEntry[];
}

export function parseRunDays(text: string): RunDayEntry[] {
	return JSON.parse(text) as RunDayEntry[];
}

export function parseActive(text: string): ActiveEntry[] {
	return JSON.parse(text) as ActiveEntry[];
}

export function parseAttended(text: string): number[] {
	return JSON.parse(text) as number[];
}

/** A team event as read live: its kind and date never sit in a summary. */
export type StoredEvents = ReadonlyMap<
	number,
	{ kind: EventKind; date: string }
>;

/**
 * The rider's attendance from attended IDs and the events as they are now, by
 * date and then ID. An ID without an event counts for nothing: it was deleted
 * and the rider hasn't been evaluated since (research R7).
 */
export function attendedEvents(
	attended: readonly number[],
	events: StoredEvents,
): Attendance[] {
	const attendance: Attendance[] = [];
	for (const eventId of attended) {
		const event = events.get(eventId);
		if (event) attendance.push({ eventId, kind: event.kind, date: event.date });
	}
	return attendance.sort(byDateThenEvent);
}

function byDateThenEvent(
	a: { date: string; eventId: number },
	b: { date: string; eventId: number },
): number {
	return compareText(a.date, b.date) || a.eventId - b.eventId;
}

/** What the team badges read of one listed rider. */
export interface BadgeRider {
	athleteId: number;
	/** `YYYY-MM-DD` */
	connectedOn: string;
	days: readonly DayEntry[];
	runDays: readonly RunDayEntry[];
	active: readonly ActiveEntry[];
	attended: readonly number[];
	corrections: readonly DatedCorrection[];
}

/**
 * The team's sums from every listed rider, worked out on each read and never
 * stored (FR-009), in the shape `evaluateTeamBadges` takes (research R9): no ID
 * on riders, and riders with nothing to add left out, though they stay in
 * `connectedOn`.
 */
export function teamBadgeSumsOf(
	riders: readonly BadgeRider[],
	events: StoredEvents,
): TeamBadgeSums {
	const runs = new Map<string, number>();
	const attendees = new Map<number, number>();
	const active: TeamActivity[] = [];
	const connectedOn = new Map<number, string>();
	const days = [];
	for (const rider of riders) {
		connectedOn.set(rider.athleteId, rider.connectedOn);
		for (const [date, distanceM] of rider.runDays) {
			runs.set(date, (runs.get(date) ?? 0) + distanceM);
		}
		for (const [date, hour, ride] of rider.active) {
			active.push({
				athleteId: rider.athleteId,
				date,
				hour,
				ride: ride === 1,
			});
		}
		const attendance = attendedEvents(rider.attended, events);
		for (const { eventId } of attendance) {
			attendees.set(eventId, (attendees.get(eventId) ?? 0) + 1);
		}
		if (
			rider.days.length > 0 ||
			attendance.length > 0 ||
			rider.corrections.length > 0
		) {
			days.push({
				rides: rider.days.map(
					([date, distanceM, distanceRynke, elevationDm]) => ({
						date,
						distanceM,
						distanceRynke,
						elevationDm,
					}),
				),
				attendance,
				corrections: rider.corrections,
			});
		}
	}
	return {
		riders: days,
		runs: [...runs]
			.sort(([a], [b]) => compareText(a, b))
			.map(([date, distanceM]) => ({ date, distanceM })),
		events: [...attendees]
			.flatMap(([eventId, count]) => {
				const event = events.get(eventId);
				return event ? [{ eventId, ...event, attendees: count }] : [];
			})
			.sort(byDateThenEvent),
		active: active.sort(
			(a, b) =>
				compareText(a.date, b.date) ||
				a.athleteId - b.athleteId ||
				a.hour - b.hour ||
				Number(a.ride) - Number(b.ride),
		),
		connectedOn,
	};
}
