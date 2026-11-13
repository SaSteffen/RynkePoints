// The pace of the ride edit re-check (feature 036 contracts/hourly-run.md,
// research R2, R4, R5): how many riders an hourly run checks, which, and when
// within the hour. Pure: no I/O, no clock. Times are epoch seconds.

const HOUR = 3600;

/** A run's checks are spread over this much of the hour (research R2). */
export const SPREAD_SECONDS = 3300;
/** The most a run checks, so its checks stay at least a minute apart. */
export const MAX_RUN = 55;
/** Riders not checked for this long go first (FR-010). */
export const DUE_AFTER = 20 * HOUR;
/**
 * Riders not checked for this long are taken beyond the allowance: the next run
 * may come too late for 24 hours (FR-011, research R4).
 */
export const OVERDUE_AFTER = 23 * HOUR;
/** A stamp this recent means a run already chose riders this hour. */
export const REPEAT_GUARD = 30 * 60;

/** A rider the run may check: active, connected, import done. */
export interface Candidate {
	athleteId: number;
	/** `riders.rechecked_at`; null: never checked, which is longest ago. */
	recheckedAt: number | null;
	/** Has a recent ride a crop could rescue (FR-012). */
	fastLane: boolean;
}

/** The hour's share of the day's allowance; the 24 hours add up to it. */
export function baseChecks(hour: number, allowance: number): number {
	return (
		Math.floor(((hour + 1) * allowance) / 24) -
		Math.floor((hour * allowance) / 24)
	);
}

/**
 * A run's number of checks: the hour's share, or more for riders who would pass
 * 24 hours, but never more than a once-a-day pace with a little room
 * (`riders / 20`), so a run after skipped runs is no larger (FR-013).
 */
export function runSize(
	hour: number,
	allowance: number,
	riders: number,
	overdue: number,
): number {
	if (riders === 0) return 0;
	return Math.min(
		riders,
		MAX_RUN,
		Math.max(
			baseChecks(hour, allowance),
			Math.min(overdue, Math.ceil(riders / 20)),
		),
	);
}

/** Whether the rider was last checked `seconds` or longer ago, or never. */
export function checkedBefore(
	candidate: Pick<Candidate, "recheckedAt">,
	now: number,
	seconds: number,
): boolean {
	return (
		candidate.recheckedAt === null || now - candidate.recheckedAt >= seconds
	);
}

/**
 * The riders a run checks, in order (FR-010): first those not checked for 20
 * hours or more, then the fast lane up to half of the run, then everyone else;
 * in each group the one checked longest ago first. Nobody when a run already
 * chose riders within the last 30 minutes: a run triggered twice finds nobody.
 */
export function chooseRiders(
	candidates: readonly Candidate[],
	size: number,
	now: number,
): Candidate[] {
	if (candidates.some((c) => !checkedBefore(c, now, REPEAT_GUARD))) return [];
	const ordered = [...candidates].sort(
		(a, b) =>
			(a.recheckedAt ?? -Infinity) - (b.recheckedAt ?? -Infinity) ||
			a.athleteId - b.athleteId,
	);
	const due = ordered.filter((c) => checkedBefore(c, now, DUE_AFTER));
	const fast = ordered.filter(
		(c) => c.fastLane && !checkedBefore(c, now, DUE_AFTER),
	);
	const rest = ordered.filter(
		(c) => !c.fastLane && !checkedBefore(c, now, DUE_AFTER),
	);
	const chosen = due.slice(0, size);
	chosen.push(
		...fast.slice(0, Math.min(Math.ceil(size / 2), size - chosen.length)),
	);
	chosen.push(...rest.slice(0, size - chosen.length));
	return chosen;
}

/** The delay of the `i`-th of a run's `n` checks, spread over the hour. */
export function spreadDelay(i: number, n: number): number {
	return Math.floor((i * SPREAD_SECONDS) / n);
}
