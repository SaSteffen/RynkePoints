// Pure rate-limit budget maths (research R6). All times are epoch seconds.

/** The Queues maximum for `delaySeconds`. */
export const MAX_DELAY_SECONDS = 43200;
const WINDOW_SECONDS = 15 * 60;
const DAY_SECONDS = 24 * 3600;
const SHORT_MARGIN = 10;
const DAILY_MARGIN = 50;
/**
 * Kept for what a person waits for on a page: sign-in, reconnect, revocation
 * (feature 024 research R5). Background work stops this much earlier.
 */
export const SHORT_RESERVE = 10;
export const DAILY_RESERVE = 50;

/** Who waits for a call: a person on a page, or the queue (feature 024 R5). */
export type Priority = "interactive" | "background";

export interface RateLimitState {
	observedAt: number;
	read15m: number;
	readDaily: number;
	all15m: number;
	allDaily: number;
	limitRead15m: number;
	limitReadDaily: number;
	limitAll15m: number;
	limitAllDaily: number;
}

export type BudgetDecision = { ok: true } | { ok: false; delaySeconds: number };

/** Parses `"<15min>,<daily>"` from the `X-*RateLimit-*` headers. */
export function parseUsageHeader(
	value: string | null,
): { short: number; daily: number } | null {
	const match = value?.match(/^\s*(\d+)\s*,\s*(\d+)\s*$/);
	if (!match) return null;
	return { short: Number(match[1]), daily: Number(match[2]) };
}

export function windowStart(t: number): number {
	return t - (t % WINDOW_SECONDS);
}

export function dayStart(t: number): number {
	return t - (t % DAY_SECONDS);
}

/** Usage counts only apply within the window or day they were observed in. */
export function effectiveUsage(
	state: RateLimitState,
	now: number,
): RateLimitState {
	const sameWindow = state.observedAt >= windowStart(now);
	const sameDay = state.observedAt >= dayStart(now);
	return {
		...state,
		read15m: sameWindow ? state.read15m : 0,
		all15m: sameWindow ? state.all15m : 0,
		readDaily: sameDay ? state.readDaily : 0,
		allDaily: sameDay ? state.allDaily : 0,
	};
}

export function budgetDecision(
	state: RateLimitState,
	now: number,
	priority: Priority = "interactive",
): BudgetDecision {
	const u = effectiveUsage(state, now);
	const background = priority === "background";
	const daily = DAILY_MARGIN + (background ? DAILY_RESERVE : 0);
	const short = SHORT_MARGIN + (background ? SHORT_RESERVE : 0);
	if (
		u.readDaily >= u.limitReadDaily - daily ||
		u.allDaily >= u.limitAllDaily - daily
	) {
		return {
			ok: false,
			delaySeconds: capDelay(dayStart(now) + DAY_SECONDS - now),
		};
	}
	if (
		u.read15m >= u.limitRead15m - short ||
		u.all15m >= u.limitAll15m - short
	) {
		return { ok: false, delaySeconds: deferUntilNextWindow(now) };
	}
	return { ok: true };
}

/** Delay until the next 15-minute window, used for a `429`. */
export function deferUntilNextWindow(now: number): number {
	return capDelay(windowStart(now) + WINDOW_SECONDS - now);
}

export function backoffSeconds(attempts: number): number {
	return Math.min(30 * 2 ** attempts, 3600);
}

function capDelay(seconds: number): number {
	return Math.min(Math.max(seconds, 1), MAX_DELAY_SECONDS);
}
