// The badges page's hints (feature 034 contracts/hint-candidates.md): which
// next steps and surprise badges are still in reach for the rider today,
// from the figures the page already reads. Pure: no I/O, no clock, no
// randomness; the browser picks one of the first three (research R1, R4).

import type {
	LineId,
	NextLineId,
	SurpriseLineId,
} from "../content/hints/types";
import { HINT_MONKEYS, QUOTE_MONKEYS } from "../http/quote-monkeys";
import type {
	ActiveEntry,
	DayEntry,
	OwnDayEntry,
	RunDayEntry,
	VirtualDayEntry,
} from "../rynke/summary";
import { type BadgeCategoryId, categoryById, ONE_DECIMAL } from "./catalog";
import { easterSunday } from "./easter";
import type { CategoryProgress } from "./evaluate";
import { shownMissing } from "./view";

/** The rider's stored day lists (`rider_summaries`), as the page reads them. */
export interface DailyFigures {
	days: readonly DayEntry[];
	runDays: readonly RunDayEntry[];
	virtualDays: readonly VirtualDayEntry[];
	ownDays: readonly OwnDayEntry[];
	active: readonly ActiveEntry[];
}

export interface HintInput {
	/** Berlin date, `YYYY-MM-DD`. */
	today: string;
	seasonStart: string;
	/** The season's last counting day, before `badgeWindow` clamps it. */
	seasonEnd: string;
	/** The rider's earned badge ids. */
	earned: ReadonlySet<string>;
	progress: readonly CategoryProgress[];
	/** Null without a current summary row: no hints (research R2). */
	daily: DailyFigures | null;
	longestSwimM: number;
	/** A run or a swim in the season (FR-007). */
	ran: boolean;
	swam: boolean;
}

/** The surprise rules with a hint (spec "Hint windows"). */
export type SurpriseRule =
	| "new-year"
	| "christmas-eve"
	| "christmas"
	| "festive-500"
	| "night-owl"
	| "early-bird"
	| "rest-day"
	| "stage-rider"
	| "triathlon"
	| "pi-day"
	| "solstice"
	| "easter"
	| "everesting"
	| "winter-sleep";

export interface HintValues {
	n?: number;
	best?: number;
	next?: number;
	left?: number;
	/** Calendar month, 1 to 12. */
	month?: number;
}

export interface HintCandidate {
	/** `next:<category>` or `surprise:<rule>`; stable, for the no-repeat rule. */
	key: string;
	kind: "next" | "surprise";
	/** The card it links to; `surprise` for surprise hints. */
	category: BadgeCategoryId;
	rule?: SurpriseRule;
	line: LineId;
	/** Numbers for the placeholders, unformatted. */
	values: HintValues;
	/** The window's last day, `YYYY-MM-DD` (FR-011). */
	windowEnd: string;
	/** Missing ÷ next step, 0..1; 1 for surprises. */
	closeness: number;
	/** The hint monkey's id (FR-016). */
	monkey: string;
}

/** Amount categories: their line and the best day's figure, in their unit. */
const AMOUNTS: Partial<
	Record<BadgeCategoryId, { line: NextLineId; best: (i: HintInput) => number }>
> = {
	distance: { line: "distance", best: (i) => maxOf(days(i), 1) / 1000 },
	elevation: { line: "elevation", best: (i) => maxOf(days(i), 3) / 10 },
	training_rynke: { line: "trainingRynke", best: (i) => maxOf(days(i), 2) },
	running: { line: "running", best: (i) => maxOf(runDays(i), 1) / 1000 },
	swimming: { line: "swimming", best: (i) => i.longestSwimM / 1000 },
	virtual_rides: {
		line: "virtualRides",
		best: (i) => maxOf(seasonOf(i, i.daily?.virtualDays ?? []), 1) / 1000,
	},
};

const LENGTHS: Partial<Record<BadgeCategoryId, NextLineId>> = {
	ride_length: "rideLength",
	run_length: "runLength",
	swim_length: "swimLength",
};

/** Categories that need a run or a swim on record (FR-007). */
const NEEDS_RUN = new Set<BadgeCategoryId>(["running", "run_length"]);
const NEEDS_SWIM = new Set<BadgeCategoryId>(["swimming", "swim_length"]);

/** Hint monkeys by kind of hint (FR-016, data-model.md). */
const MONKEY_OF: Record<string, string> = {
	distance: "hint-down",
	elevation: "hint-down",
	training_rynke: "hint-down",
	running: "hint-down",
	swimming: "hint-down",
	virtual_rides: "hint-down",
	winter: "hint-calendar",
	ride_length: "hint-tape",
	run_length: "hint-tape",
	swim_length: "hint-tape",
	"christmas-eve": "hint-psst",
	christmas: "hint-psst",
	"new-year": "hint-psst",
	easter: "hint-psst",
	"pi-day": "hint-psst",
	"night-owl": "hint-binoculars",
	"early-bird": "hint-binoculars",
	solstice: "hint-binoculars",
	"winter-sleep": "hint-binoculars",
	"stage-rider": "hint-magnifier",
	triathlon: "hint-magnifier",
	"rest-day": "hint-magnifier",
	everesting: "hint-magnifier",
	"festive-500": "hint-magnifier",
};

/** Festive 500's goal, in km. */
const FESTIVE_KM = 500;
/** Everesting's goal, in decimetres. */
const EVEREST_DM = 88_480;
/** Etappenfahrer: a day of at least this many metres hints at it. */
const STAGE_HINT_M = 70_000;
/** Kreiszahl: a counting ride of at least this many metres in the season. */
const PI_HINT_M = 25_000;
/** Rest day: at least this many active days in a row. */
const STREAK_DAYS = 5;

/**
 * Every hint in reach for the rider on `input.today`, ordered by window end,
 * then closeness, then key (research R4). Empty without a summary row.
 */
export function hintCandidates(input: HintInput): HintCandidate[] {
	const { today, seasonStart, seasonEnd } = input;
	if (!input.daily || today < seasonStart || today > seasonEnd) return [];
	const found = [
		...input.progress.flatMap((p) => nextStep(input, p)),
		...surprises(input),
	].filter((c) => c.windowEnd <= seasonEnd);
	return found.sort(
		(a, b) =>
			a.windowEnd.localeCompare(b.windowEnd) ||
			a.closeness - b.closeness ||
			a.key.localeCompare(b.key),
	);
}

function nextStep(
	input: HintInput,
	progress: CategoryProgress,
): HintCandidate[] {
	const { category, value, next } = progress;
	if (next === null || categoryById(category).group !== "personal") return [];
	if (NEEDS_RUN.has(category) && !input.ran) return [];
	if (NEEDS_SWIM.has(category) && !input.swam) return [];
	const base = {
		key: `next:${category}`,
		kind: "next" as const,
		category,
		monkey: MONKEY_OF[categoryById(category).month ? "winter" : category] ?? "",
	};
	const amount = AMOUNTS[category];
	if (amount) {
		const missing = shownMissing(category, value, next);
		const best = amount.best(input);
		const left = daysFrom(input.today, input.seasonEnd);
		if (best <= 0 || missing > left * best) return [];
		return [
			{
				...base,
				line: amount.line,
				values: { n: missing },
				windowEnd: input.seasonEnd,
				closeness: missing / next,
			},
		];
	}
	const length = LENGTHS[category];
	if (length) {
		if (value <= 0 || value < next / 2) return [];
		const digits = ONE_DECIMAL.has(category) ? 10 : 1;
		return [
			{
				...base,
				line: length,
				values: { best: Math.floor(value * digits) / digits, next },
				windowEnd: input.seasonEnd,
				closeness: (next - value) / next,
			},
		];
	}
	const month = categoryById(category).month;
	if (month === undefined) return [];
	const window = monthOfSeason(month, input.seasonStart);
	if (input.today < window.first || input.today > window.last) return [];
	const missing = next - value;
	const countedToday = (input.daily?.ownDays ?? []).some(
		([date, , outdoor]) => date === input.today && outdoor === 1,
	);
	const left = daysFrom(input.today, window.last) - (countedToday ? 1 : 0);
	if (missing <= 0 || missing > left) return [];
	const line: NextLineId =
		missing === 1
			? "winterOne"
			: missing === left
				? "winterNoSpare"
				: "winterSeveral";
	return [
		{
			...base,
			line,
			values: { n: missing, left, month },
			windowEnd: window.last,
			closeness: missing / next,
		},
	];
}

function surprises(input: HintInput): HintCandidate[] {
	const { today, seasonStart, seasonEnd } = input;
	const daily = input.daily as DailyFigures;
	const year = Number(today.slice(0, 4));
	const md = today.slice(5);
	const rideDays = days(input);
	const out: HintCandidate[] = [];
	const add = (
		rule: SurpriseRule,
		windowEnd: string,
		line: SurpriseLineId,
		values: HintValues = {},
	) => {
		if (input.earned.has(`surprise-${rule}`)) return;
		out.push({
			key: `surprise:${rule}`,
			kind: "surprise",
			category: "surprise",
			rule,
			line,
			values,
			windowEnd,
			closeness: 1,
			monkey: MONKEY_OF[rule] ?? "",
		});
	};

	if (md >= "12-27") add("new-year", `${year + 1}-01-01`, "newYear");
	if (md === "01-01") add("new-year", today, "newYear");
	if (md >= "12-17" && md <= "12-24") {
		add("christmas-eve", `${year}-12-24`, "christmasEve");
	}
	if (md >= "12-17" && md <= "12-26") {
		add("christmas", `${year}-12-26`, "christmas");
	}
	if (md >= "12-17" && md <= "12-31" && festiveInReach(input, year)) {
		add("festive-500", `${year}-12-31`, "festive500");
	}
	if (rideDays.length > 0) {
		add("night-owl", seasonEnd, "nightOwl");
		add("early-bird", seasonEnd, "earlyBird");
	}
	const streak = activeStreak(daily.active, today);
	if (streak >= STREAK_DAYS) {
		add("rest-day", seasonEnd, "restDay", { n: streak });
	}
	if (rideDays.some((d) => d[1] >= STAGE_HINT_M)) {
		add("stage-rider", seasonEnd, "stageRider");
	}
	if (input.ran && input.swam) add("triathlon", seasonEnd, "triathlon");
	if (
		md >= "03-07" &&
		md <= "03-14" &&
		seasonOf(input, daily.ownDays).some((d) => d[1] >= PI_HINT_M)
	) {
		add("pi-day", `${year}-03-14`, "piDay");
	}
	if (md >= "12-14" && md <= "12-21") {
		add("solstice", `${year}-12-21`, "solsticeDecember");
	}
	if (md >= "06-14" && md <= "06-21") {
		const december = `${year - 1}-12-21`;
		const rode = daily.ownDays.some(
			([date, , outdoor]) => date === december && outdoor === 1,
		);
		if (rode && december >= seasonStart) {
			add("solstice", `${year}-06-21`, "solsticeJune");
		}
	}
	const easterMonday = shift(easterSunday(year), 1);
	if (today >= shift(easterMonday, -7) && today <= easterMonday) {
		add("easter", easterMonday, "easter");
	}
	const monthEnd = lastOfMonth(today);
	const climbed = rideDays
		.filter(([date]) => date.slice(0, 7) === today.slice(0, 7))
		.reduce((sum, d) => sum + d[3], 0);
	const bestClimb = maxOf(rideDays, 3);
	if (
		bestClimb > 0 &&
		EVEREST_DM - climbed <= daysFrom(today, monthEnd) * bestClimb
	) {
		add("everesting", monthEnd, "everesting");
	}
	const newYear = `${Number(seasonStart.slice(0, 4)) + 1}-01-01`;
	if (
		seasonStart.slice(5) !== "01-01" &&
		today >= newYear &&
		!daily.ownDays.some(([date, , outdoor]) => date >= newYear && outdoor === 1)
	) {
		add("winter-sleep", seasonEnd, "winterSleep");
	}
	return out;
}

/** Before 24 December always; from then 500 km must still fit by the 31st. */
function festiveInReach(input: HintInput, year: number): boolean {
	if (input.today < `${year}-12-24`) return true;
	const rideDays = days(input);
	const ridden =
		rideDays
			.filter(([date]) => date >= `${year}-12-24` && date <= `${year}-12-31`)
			.reduce((sum, d) => sum + d[1], 0) / 1000;
	const best = maxOf(rideDays, 1) / 1000;
	return (
		best > 0 &&
		FESTIVE_KM - ridden <= daysFrom(input.today, `${year}-12-31`) * best
	);
}

/** Active days in a row ending today, or yesterday when today has none yet. */
function activeStreak(active: readonly ActiveEntry[], today: string): number {
	const dates = new Set(active.map(([date]) => date));
	let day = dates.has(today) ? today : shift(today, -1);
	let streak = 0;
	while (dates.has(day)) {
		streak++;
		day = shift(day, -1);
	}
	return streak;
}

/**
 * The picture's address: the kind's hint monkey, or the first quote monkey
 * while that one isn't built (research R9).
 */
export function hintMonkey(
	candidate: Pick<HintCandidate, "monkey">,
	built: readonly string[] = HINT_MONKEYS,
): string {
	const id = built.includes(candidate.monkey)
		? candidate.monkey
		: QUOTE_MONKEYS[0];
	return `/quotes/${id}.svg`;
}

/**
 * Which of a line's `count` variants: from a 32-bit FNV-1a hash of today and
 * the key, so a hint keeps its words all day (research R5).
 */
export function hintVariant(key: string, today: string, count: number): number {
	let hash = 0x811c9dc5;
	for (const char of `${today}|${key}`) {
		hash ^= char.charCodeAt(0);
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	return count > 0 ? hash % count : 0;
}

/** The ride days from the season start up to today. */
function days(input: HintInput): readonly DayEntry[] {
	return seasonOf(input, input.daily?.days ?? []);
}

function runDays(input: HintInput): readonly RunDayEntry[] {
	return seasonOf(input, input.daily?.runDays ?? []);
}

function seasonOf<T extends readonly [string, ...unknown[]]>(
	input: HintInput,
	entries: readonly T[],
): T[] {
	return entries.filter(
		([date]) => date >= input.seasonStart && date <= input.today,
	);
}

function maxOf(
	entries: readonly (readonly unknown[])[],
	index: number,
): number {
	let best = 0;
	for (const entry of entries) {
		const value = entry[index];
		if (typeof value === "number" && value > best) best = value;
	}
	return best;
}

/** A winter month's first and last day in the season (`winterMonthOver`). */
function monthOfSeason(
	month: number,
	seasonStart: string,
): { first: string; last: string } {
	const startYear = Number(seasonStart.slice(0, 4));
	const startMonth = Number(seasonStart.slice(5, 7));
	const year = month >= startMonth ? startYear : startYear + 1;
	const first = `${year}-${String(month).padStart(2, "0")}-01`;
	return { first, last: lastOfMonth(first) };
}

function lastOfMonth(date: string): string {
	const year = Number(date.slice(0, 4));
	const month = Number(date.slice(5, 7));
	return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

/** Days from `from` to `to`, both included; 0 when `to` is before `from`. */
export function daysFrom(from: string, to: string): number {
	const span =
		(Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
		86_400_000;
	return Math.max(0, Math.round(span) + 1);
}

function shift(date: string, days: number): string {
	return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000)
		.toISOString()
		.slice(0, 10);
}
