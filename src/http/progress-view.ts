// The Overview's progress section as data (feature 009 data-model.md "View
// model"): the day axis, the period buttons, the curves with their scales and
// the weekly table, from what `readRiderView` read. Pure; `renderProgress`
// turns it into markup and `public/app.js` draws it.

import type { RiderViewRead } from "../db/rider-view";
import type { CountingWindow, RynkeRules } from "../rynke/rules";
import { virtualShareRequired } from "../rynke/tally";
import {
	type CurvePoint,
	dayNumber,
	lastDay,
	riderCurve,
	weekEnds,
} from "../rynke/weeks";

export type Preset = "season" | "3m" | "4w";

/** One line's values from the season start to the last day, and its scale. */
export interface ChartSeries {
	/** Index 0 … `lastIndex`. */
	values: number[];
	threshold: number;
	/** The y axis's top for the whole season (research R5). */
	yMax: number;
	/** Whether to draw the even pace towards `threshold` (US2, FR-038). */
	pace: boolean;
}

export interface Earned {
	earned: number;
	total: number;
}

export interface WeekRow {
	/** `YYYY-MM-DD`: the week's Monday, or the season start for the first. */
	firstDay: string;
	training: Earned;
	team: Earned;
	/** Training Rynke without virtual rides, only with virtual rides (US2). */
	outside: Earned | null;
}

export type ProgressView =
	| { state: "none" }
	| {
			state: "ready";
			rulesVersion: number;
			/** Both totals are 0 (FR-015). */
			nothingYet: boolean;
			seasonStart: string;
			deadline: string;
			lastDay: string;
			/** Day index of the deadline; the season start is 0. */
			axisDays: number;
			/** Day index of the last day. */
			lastIndex: number;
			/** The period buttons offered, in order (FR-020, research R8). */
			presets: { preset: Preset; from: number; to: number }[];
			training: ChartSeries;
			team: ChartSeries;
			/** Only for riders with virtual rides (FR-039). */
			outside: (ChartSeries & { needed: number }) | null;
			weeks: WeekRow[];
	  };

/**
 * The even pace on day `index`: ⌊threshold × index ÷ axisDays⌋ within
 * 0 … threshold, which is `evenPace` of `src/rynke/pace.ts` (016 FR-030) on
 * day indexes. `public/app.js` computes it the same way.
 */
export function paceAt(
	threshold: number,
	index: number,
	axisDays: number,
): number {
	if (axisDays <= 0) return threshold;
	return Math.min(
		threshold,
		Math.max(0, Math.floor((threshold * index) / axisDays)),
	);
}

/**
 * The progress section of `read`, under the rules of its balance's version:
 * nothing without a balance, without the curve's input or with an unknown
 * version (FR-016, FR-040).
 */
export function buildProgressView(
	read: Pick<RiderViewRead, "balance" | "virtualCount" | "progress">,
	rules: RynkeRules | null,
	window: CountingWindow,
	today: string,
): ProgressView {
	const { balance, progress } = read;
	if (!balance || !progress || !rules) return { state: "none" };
	const { seasonStart, deadline } = window;
	// Before the season starts, the axis still begins with its first day.
	const last = maxDate(lastDay(today, deadline), seasonStart);
	const points = riderCurve(progress, window, last, balance, rules);
	const axisDays = dayNumber(deadline) - dayNumber(seasonStart);
	const lastIndex = points.length - 1;
	const series = (
		pick: (p: CurvePoint) => number,
		threshold: number,
		step: number,
	): ChartSeries => {
		const values = points.map(pick);
		return {
			values,
			threshold,
			yMax: roundUp(Math.max(threshold, ...values), step),
			pace: true,
		};
	};
	const training = series((p) => p.training, rules.trainingThreshold, 50);
	const needed = virtualShareRequired(rules);
	return {
		state: "ready",
		rulesVersion: rules.version,
		nothingYet: balance.trainingRynke === 0 && balance.teamRynke === 0,
		seasonStart,
		deadline,
		lastDay: last,
		axisDays,
		lastIndex,
		presets: presets(seasonStart, last, axisDays, lastIndex),
		training,
		team: series((p) => p.team, rules.teamThreshold, 5),
		outside:
			read.virtualCount > 0
				? {
						values: points.map((p) => p.outside),
						threshold: needed,
						yMax: training.yMax,
						pace: true,
						needed,
					}
				: null,
		weeks: weekRows(points, seasonStart, last, read.virtualCount > 0),
	};
}

function maxDate(a: string, b: string): string {
	return a > b ? a : b;
}

function roundUp(value: number, step: number): number {
	return Math.ceil(value / step) * step;
}

/**
 * The whole season, then the last three months and the last four weeks up to
 * the last day, each only once it starts after the season start (FR-020,
 * research R8).
 */
function presets(
	seasonStart: string,
	last: string,
	axisDays: number,
	lastIndex: number,
): { preset: Preset; from: number; to: number }[] {
	const index = (date: string) => dayNumber(date) - dayNumber(seasonStart);
	const offered: { preset: Preset; from: number; to: number }[] = [
		{ preset: "season", from: 0, to: axisDays },
	];
	const threeMonths = index(monthsBefore(last, 3)) + 1;
	if (threeMonths > 0) {
		offered.push({ preset: "3m", from: threeMonths, to: lastIndex });
	}
	const fourWeeks = lastIndex - 27;
	if (fourWeeks > 0) {
		offered.push({ preset: "4w", from: fourWeeks, to: lastIndex });
	}
	return offered;
}

/** `date` the same day `months` calendar months back, or that month's last day. */
function monthsBefore(date: string, months: number): string {
	const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
	const first = new Date(Date.UTC(year, month - 1 - months, 1));
	const daysInMonth = new Date(
		Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
	).getUTCDate();
	first.setUTCDate(Math.min(day, daysInMonth));
	return first.toISOString().slice(0, 10);
}

/**
 * One row per week up to the last day, oldest first (research R11): the
 * totals at the week's end and what the week added to them.
 */
function weekRows(
	points: readonly CurvePoint[],
	seasonStart: string,
	last: string,
	withOutside: boolean,
): WeekRow[] {
	const at = (date: string) =>
		points[dayNumber(date) - dayNumber(seasonStart)] ?? points.at(-1);
	let previous: CurvePoint = { date: "", training: 0, team: 0, outside: 0 };
	let firstDay = seasonStart;
	return weekEnds(seasonStart, last).map((end) => {
		const point = at(end) ?? previous;
		const earned = (key: "training" | "team" | "outside"): Earned => ({
			earned: point[key] - previous[key],
			total: point[key],
		});
		const row: WeekRow = {
			firstDay,
			training: earned("training"),
			team: earned("team"),
			outside: withOutside ? earned("outside") : null,
		};
		previous = point;
		firstDay = new Date((dayNumber(end) + 1) * 86_400_000)
			.toISOString()
			.slice(0, 10);
		return row;
	});
}
