import {
	DAILY_RESERVE,
	dayStart,
	effectiveUsage,
	type RateLimitState,
	SHORT_RESERVE,
	windowStart,
} from "../strava/rate-limit";
import {
	type AllowanceId,
	ATHLETE_CAPACITY,
	CRITICAL_LEVEL,
	WARNING_LEVEL,
} from "./allowances";

// What the admin view shows of an allowance, as pure logic (feature 025 FR-007
// to FR-009, FR-020, research R1, R11). All times are epoch seconds.

export type Level = "ok" | "warning" | "critical";

export interface Figure {
	id: AllowanceId;
	used: number;
	limit: number;
	/** Rounded down, so a figure never reads as a level it hasn't reached. */
	percent: number;
	level: Level;
	/** This team's count, for Strava and connected riders; else null. */
	team: number | null;
	/** `max(0, used - team)`; null with `team` (R1). */
	notAttributed: number | null;
	/** When the value was seen; null: never yet. */
	observedAt: number | null;
}

/** The own counts and peaks beside Strava's figures on the one row (R1). */
export interface StravaUsage extends RateLimitState {
	ownRead15m: number;
	ownAll15m: number;
	ownReadDaily: number;
	ownAllDaily: number;
	peakRead15m: number;
	peakAll15m: number;
}

/** Exact, not by the rounded percentage: 79.9 % is no warning (FR-009). */
export function reachesLevel(
	used: number,
	limit: number,
	level: number,
): boolean {
	return limit > 0 && used * 100 >= limit * level;
}

export function levelOf(used: number, limit: number): Level {
	if (reachesLevel(used, limit, CRITICAL_LEVEL)) return "critical";
	if (reachesLevel(used, limit, WARNING_LEVEL)) return "warning";
	return "ok";
}

/** Above 100 % isn't capped (spec edge case). */
export function percentOf(used: number, limit: number): number {
	return limit > 0 ? Math.floor((used * 100) / limit) : 0;
}

export function makeFigure(
	id: AllowanceId,
	used: number,
	limit: number,
	team: number | null,
	observedAt: number | null,
): Figure {
	return {
		id,
		used,
		limit,
		percent: percentOf(used, limit),
		level: levelOf(used, limit),
		team,
		notAttributed: team === null ? null : Math.max(0, used - team),
		observedAt,
	};
}

/**
 * Strava's figures as of `now`: a count from an earlier window or day counts as
 * zero, as the budget logic has it, and its observation time stays (spec edge
 * case). The own counts and peaks restart the same way.
 */
export function currentStrava(usage: StravaUsage, now: number): StravaUsage {
	const sameWindow = usage.observedAt >= windowStart(now);
	const sameDay = usage.observedAt >= dayStart(now);
	return {
		...usage,
		...effectiveUsage(usage, now),
		ownRead15m: sameWindow ? usage.ownRead15m : 0,
		ownAll15m: sameWindow ? usage.ownAll15m : 0,
		ownReadDaily: sameDay ? usage.ownReadDaily : 0,
		ownAllDaily: sameDay ? usage.ownAllDaily : 0,
		peakRead15m: sameDay ? usage.peakRead15m : 0,
		peakAll15m: sameDay ? usage.peakAll15m : 0,
	};
}

/** The reads and all requests per 15 minutes and per day (FR-005). */
export function stravaFigures(usage: StravaUsage, now: number): Figure[] {
	const u = currentStrava(usage, now);
	const at = usage.observedAt > 0 ? usage.observedAt : null;
	return [
		makeFigure(
			"strava_read_daily",
			u.readDaily,
			u.limitReadDaily,
			u.ownReadDaily,
			at,
		),
		makeFigure(
			"strava_all_daily",
			u.allDaily,
			u.limitAllDaily,
			u.ownAllDaily,
			at,
		),
		makeFigure("strava_read_15m", u.read15m, u.limitRead15m, u.ownRead15m, at),
		makeFigure("strava_all_15m", u.all15m, u.limitAll15m, u.ownAll15m, at),
	];
}

/**
 * Connected riders against Strava's capacity; live, so `now`. With other teams
 * (feature 026 FR-039) `connected` is all teams' and `own` this team's.
 */
export function connectedFigure(
	connected: number,
	now: number,
	own = connected,
): Figure {
	return makeFigure("riders_connected", connected, ATHLETE_CAPACITY, own, now);
}

const WINDOW_SECONDS = 15 * 60;
const DAY_SECONDS = 24 * 3600;
/** The budget's safety margins before the reserves (`budgetDecision`). */
const SHORT_MARGIN = 10;
const DAILY_MARGIN = 50;

/**
 * About how long `waiting` items take, one read each, at the rate left after the
 * reserves and limited by what's left today (R11). Null when none wait.
 */
export function drainEstimateSeconds(
	waiting: number,
	usage: StravaUsage,
	now: number,
): number | null {
	if (waiting <= 0) return null;
	const u = effectiveUsage(usage, now);
	const perWindow = Math.max(
		1,
		Math.min(u.limitRead15m, u.limitAll15m) - SHORT_MARGIN - SHORT_RESERVE,
	);
	const perDay = Math.max(
		1,
		Math.min(u.limitReadDaily, u.limitAllDaily) - DAILY_MARGIN - DAILY_RESERVE,
	);
	const leftToday = Math.max(
		0,
		Math.min(u.limitReadDaily - u.readDaily, u.limitAllDaily - u.allDaily) -
			DAILY_MARGIN -
			DAILY_RESERVE,
	);
	const windows = (items: number) =>
		Math.ceil(items / perWindow) * WINDOW_SECONDS;
	const today = dayStart(now) + DAY_SECONDS - now;
	if (waiting <= leftToday) return Math.min(windows(waiting), today);
	const later = waiting - leftToday;
	const fullDays = Math.ceil(later / perDay) - 1;
	return today + fullDays * DAY_SECONDS + windows(later - fullDays * perDay);
}
