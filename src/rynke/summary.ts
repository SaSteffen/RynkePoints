// A rider's stored summary (feature 030): what team reads add up, worked out
// from the same evaluation as the balance and held as JSON text per column of
// `rider_summaries`. Pure like `tally.ts`; the SQL is in `db/rider-summaries.ts`.

import type { Attendance } from "./team-events";
import { weekEndOf } from "./weeks";

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
