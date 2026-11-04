import {
	dayStart,
	effectiveUsage,
	parseUsageHeader,
	type RateLimitState,
	windowStart,
} from "../strava/rate-limit";
import type { StravaUsage } from "../usage/figures";

// The app-wide Strava budget, a single row (research R6).

interface RateLimitRow {
	observed_at: number;
	read_15m: number;
	read_daily: number;
	all_15m: number;
	all_daily: number;
	limit_read_15m: number;
	limit_read_daily: number;
	limit_all_15m: number;
	limit_all_daily: number;
	own_read_15m: number;
	own_all_15m: number;
	own_read_daily: number;
	own_all_daily: number;
	peak_read_15m: number;
	peak_all_15m: number;
}

/** Whether a call counts as a read, which Strava limits separately (025 R1). */
export type RequestKind = "read" | "write";

export async function readRateLimitState(
	db: D1Database,
): Promise<RateLimitState> {
	const row = await db
		.prepare("SELECT * FROM strava_rate_limit WHERE id = 1")
		.first<RateLimitRow>();
	if (!row) throw new Error("strava_rate_limit row is missing");
	return {
		observedAt: row.observed_at,
		read15m: row.read_15m,
		readDaily: row.read_daily,
		all15m: row.all_15m,
		allDaily: row.all_daily,
		limitRead15m: row.limit_read_15m,
		limitReadDaily: row.limit_read_daily,
		limitAll15m: row.limit_all_15m,
		limitAllDaily: row.limit_all_daily,
	};
}

/** The row with this team's own counts and peaks, for the view (feature 025). */
export async function readStravaUsage(db: D1Database): Promise<StravaUsage> {
	const row = await db
		.prepare("SELECT * FROM strava_rate_limit WHERE id = 1")
		.first<RateLimitRow>();
	if (!row) throw new Error("strava_rate_limit row is missing");
	return {
		observedAt: row.observed_at,
		read15m: row.read_15m,
		readDaily: row.read_daily,
		all15m: row.all_15m,
		allDaily: row.all_daily,
		limitRead15m: row.limit_read_15m,
		limitReadDaily: row.limit_read_daily,
		limitAll15m: row.limit_all_15m,
		limitAllDaily: row.limit_all_daily,
		ownRead15m: row.own_read_15m,
		ownAll15m: row.own_all_15m,
		ownReadDaily: row.own_read_daily,
		ownAllDaily: row.own_all_daily,
		peakRead15m: row.peak_read_15m,
		peakAll15m: row.peak_all_15m,
	};
}

/**
 * Stores the usage and limits from a Strava response. A header pair that is
 * absent or malformed keeps its stored value, but only while that value is
 * still current: re-stamping `observed_at` must not revive counts from an
 * earlier window or day. Without any usage header the row isn't touched.
 *
 * The same UPDATE counts this team's request, since only a response with usage
 * headers is known to have counted at Strava, and keeps the day's peaks (feature
 * 025 R1). SET expressions see the row as it was, so `observed_at` in them is the
 * previous observation, which is what restarts a count in a new window or day.
 */
export async function recordRateLimitHeaders(
	db: D1Database,
	headers: Headers,
	now: number,
	kind: RequestKind = "read",
): Promise<void> {
	const readUsage = parseUsageHeader(headers.get("X-ReadRateLimit-Usage"));
	const allUsage = parseUsageHeader(headers.get("X-RateLimit-Usage"));
	if (!readUsage && !allUsage) return;
	const readLimit = parseUsageHeader(headers.get("X-ReadRateLimit-Limit"));
	const allLimit = parseUsageHeader(headers.get("X-RateLimit-Limit"));
	const current = effectiveUsage(await readRateLimitState(db), now);
	await db
		.prepare(
			`UPDATE strava_rate_limit SET observed_at = ?1, read_15m = ?2,
				read_daily = ?3, all_15m = ?4, all_daily = ?5, limit_read_15m = ?6,
				limit_read_daily = ?7, limit_all_15m = ?8, limit_all_daily = ?9,
				own_read_15m = CASE WHEN observed_at >= ?10 THEN own_read_15m ELSE 0 END + ?12,
				own_all_15m = CASE WHEN observed_at >= ?10 THEN own_all_15m ELSE 0 END + 1,
				own_read_daily = CASE WHEN observed_at >= ?11 THEN own_read_daily ELSE 0 END + ?12,
				own_all_daily = CASE WHEN observed_at >= ?11 THEN own_all_daily ELSE 0 END + 1,
				peak_read_15m = MAX(CASE WHEN observed_at >= ?11 THEN peak_read_15m ELSE 0 END, ?2),
				peak_all_15m = MAX(CASE WHEN observed_at >= ?11 THEN peak_all_15m ELSE 0 END, ?4)
			WHERE id = 1`,
		)
		.bind(
			now,
			readUsage?.short ?? current.read15m,
			readUsage?.daily ?? current.readDaily,
			allUsage?.short ?? current.all15m,
			allUsage?.daily ?? current.allDaily,
			readLimit?.short ?? current.limitRead15m,
			readLimit?.daily ?? current.limitReadDaily,
			allLimit?.short ?? current.limitAll15m,
			allLimit?.daily ?? current.limitAllDaily,
			windowStart(now),
			dayStart(now),
			kind === "read" ? 1 : 0,
		)
		.run();
}
