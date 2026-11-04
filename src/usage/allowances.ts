// The allowances the admin view watches (feature 025 spec Assumptions,
// data-model.md). Cloudflare's free limits are settings: a changed limit or plan
// changes them here, and old days keep the limit they were recorded with.

/** Strava's capacity for connected athletes (FR-005). */
export const ATHLETE_CAPACITY = 999;

export const WARNING_LEVEL = 80;
export const CRITICAL_LEVEL = 95;

/** Lowest first. */
export const ALERT_LEVELS = [WARNING_LEVEL, CRITICAL_LEVEL] as const;
export type AlertLevel = (typeof ALERT_LEVELS)[number];

export const STRAVA_RECORDED = [
	"strava_read_daily",
	"strava_all_daily",
	"riders_connected",
] as const;

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
