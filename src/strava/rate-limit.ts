// Pure rate-limit budget maths (research R6). All times are epoch seconds.

/** The Queues maximum for `delaySeconds`. */
export const MAX_DELAY_SECONDS = 43200;
const WINDOW_SECONDS = 15 * 60;
const DAY_SECONDS = 24 * 3600;
const SHORT_MARGIN = 10;
const DAILY_MARGIN = 50;

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
): BudgetDecision {
	const u = effectiveUsage(state, now);
	if (
		u.readDaily >= u.limitReadDaily - DAILY_MARGIN ||
		u.allDaily >= u.limitAllDaily - DAILY_MARGIN
	) {
		return {
			ok: false,
			delaySeconds: capDelay(dayStart(now) + DAY_SECONDS - now),
		};
	}
	if (
		u.read15m >= u.limitRead15m - SHORT_MARGIN ||
		u.all15m >= u.limitAll15m - SHORT_MARGIN
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
