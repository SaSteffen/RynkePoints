// The allowances the admin view watches (feature 025 spec Assumptions,
// data-model.md). Cloudflare's free limits are settings: a changed limit or plan
// changes them here, and old days keep the limit they were recorded with.

/** Strava's capacity for connected athletes (FR-005). */
export const ATHLETE_CAPACITY = 999;

/** Strava's daily read limit for the app, shared by every team. */
export const STRAVA_READ_DAILY_LIMIT = 3000;

/**
 * The share of the daily reads all teams' ride re-checks may use together
 * (feature 036 FR-008); the teams' `recheckAllowance` add up to at most
 * `RECHECK_READS`.
 */
export const RECHECK_SHARE = 0.1;
export const RECHECK_READS = Math.floor(
	STRAVA_READ_DAILY_LIMIT * RECHECK_SHARE,
);

export const WARNING_LEVEL = 80;
export const CRITICAL_LEVEL = 95;

/** The CPU alerts' levels, lowest first; allowances add their early one. */
export const ALERT_LEVELS = [WARNING_LEVEL, CRITICAL_LEVEL] as const;

export const STRAVA_RECORDED = [
	"strava_read_daily",
	"strava_all_daily",
	"riders_connected",
] as const;

/**
 * A team's Strava calls, held-back calls and Strava's count per day, in the
 * usage exchange (feature 047 contracts/usage-exchange.md); kept 30 days.
 */
export const CALL_ALLOWANCES = [
	"strava_calls",
	"strava_held_back",
	"strava_seen",
] as const;
export type CallAllowance = (typeof CALL_ALLOWANCES)[number];

export const CLOUDFLARE_ALLOWANCES = [
	"cf_worker_requests",
	"cf_queue_operations",
	"cf_d1_rows_read",
	"cf_d1_rows_written",
	"cf_d1_storage_bytes",
] as const;

export type CloudflareAllowance = (typeof CLOUDFLARE_ALLOWANCES)[number];

/** One value per day of each, in `usage_daily`; the order of the history's list. */
export const RECORDED_ALLOWANCES = [
	...STRAVA_RECORDED,
	...CLOUDFLARE_ALLOWANCES,
] as const;

export type RecordedAllowance = (typeof RECORDED_ALLOWANCES)[number];

/** Shown live on the view, never recorded and never alerting (US5 scenario 4). */
export type WindowAllowance = "strava_read_15m" | "strava_all_15m";

export type AllowanceId = RecordedAllowance | WindowAllowance;

export const CLOUDFLARE_LIMITS: Record<CloudflareAllowance, number> = {
	cf_worker_requests: 100_000,
	cf_queue_operations: 10_000,
	cf_d1_rows_read: 5_000_000,
	cf_d1_rows_written: 100_000,
	cf_d1_storage_bytes: 5_000_000_000,
};

/**
 * Where the early level, Hinweis, starts: per group of figures that behave
 * alike, a whole percentage (feature 048 FR-010, data-model.md). At 80 or more
 * a group has no early level. Changed by pull request, like a limit.
 */
const EARLY_STRAVA_DAILY = 25;
const EARLY_STRAVA_15M = 25;
const EARLY_CONNECTED = 25;
const EARLY_CLOUDFLARE_DAILY = 25;
const EARLY_STORAGE = 25;

const EARLY_THRESHOLDS: Record<AllowanceId, number> = {
	strava_read_daily: EARLY_STRAVA_DAILY,
	strava_all_daily: EARLY_STRAVA_DAILY,
	strava_read_15m: EARLY_STRAVA_15M,
	strava_all_15m: EARLY_STRAVA_15M,
	riders_connected: EARLY_CONNECTED,
	cf_worker_requests: EARLY_CLOUDFLARE_DAILY,
	cf_queue_operations: EARLY_CLOUDFLARE_DAILY,
	cf_d1_rows_read: EARLY_CLOUDFLARE_DAILY,
	cf_d1_rows_written: EARLY_CLOUDFLARE_DAILY,
	cf_d1_storage_bytes: EARLY_STORAGE,
};

/** The allowance's early threshold, or null where its group has none. */
export function earlyThreshold(id: AllowanceId): number | null {
	const level = EARLY_THRESHOLDS[id];
	return level < WARNING_LEVEL ? level : null;
}

/** The levels an allowance alerts at, lowest first (feature 048 contracts/alerts.md). */
export function alertLevels(id: AllowanceId): number[] {
	const early = earlyThreshold(id);
	return early === null ? [...ALERT_LEVELS] : [early, ...ALERT_LEVELS];
}

export function isRecordedAllowance(id: string): id is RecordedAllowance {
	return (RECORDED_ALLOWANCES as readonly string[]).includes(id);
}

/** Storage and connected riders don't reset, so they have no daily period. */
export function isOpenEnded(id: RecordedAllowance): boolean {
	return id === "riders_connected" || id === "cf_d1_storage_bytes";
}

/** The UTC day of `epochSeconds`, `YYYY-MM-DD`; both sources reset at 00:00 UTC. */
export function utcDay(epochSeconds: number): string {
	return new Date(epochSeconds * 1000).toISOString().slice(0, 10);
}

/** The UTC day `days` days before `day`. */
export function daysBefore(day: string, days: number): string {
	const date = new Date(`${day}T00:00:00Z`);
	date.setUTCDate(date.getUTCDate() - days);
	return date.toISOString().slice(0, 10);
}

/** The history keeps 13 months (FR-015): the first day still kept. */
export function historyStart(today: string): string {
	const date = new Date(`${today}T00:00:00Z`);
	const day = date.getUTCDate();
	date.setUTCDate(1);
	date.setUTCMonth(date.getUTCMonth() - 13);
	const lastOfMonth = new Date(
		Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
	).getUTCDate();
	date.setUTCDate(Math.min(day, lastOfMonth));
	return date.toISOString().slice(0, 10);
}
