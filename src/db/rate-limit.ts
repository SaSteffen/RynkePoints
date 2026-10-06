import {
	effectiveUsage,
	parseUsageHeader,
	type RateLimitState,
} from "../strava/rate-limit";

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
}

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

/**
 * Stores the usage and limits from a Strava response. A header pair that is
 * absent or malformed keeps its stored value, but only while that value is
 * still current: re-stamping `observed_at` must not revive counts from an
 * earlier window or day. Without any usage header the row isn't touched.
 */
export async function recordRateLimitHeaders(
	db: D1Database,
	headers: Headers,
	now: number,
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
				limit_read_daily = ?7, limit_all_15m = ?8, limit_all_daily = ?9
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
		)
		.run();
}
