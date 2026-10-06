import { parseUsageHeader, type RateLimitState } from "../strava/rate-limit";

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
 * Stores the usage and limits from a Strava response. Headers that are absent
 * or malformed leave their columns unchanged; without any usage header the row
 * isn't touched.
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
	await db
		.prepare(
			`UPDATE strava_rate_limit SET observed_at = ?1,
				read_15m = COALESCE(?2, read_15m), read_daily = COALESCE(?3, read_daily),
				all_15m = COALESCE(?4, all_15m), all_daily = COALESCE(?5, all_daily),
				limit_read_15m = COALESCE(?6, limit_read_15m),
				limit_read_daily = COALESCE(?7, limit_read_daily),
				limit_all_15m = COALESCE(?8, limit_all_15m),
				limit_all_daily = COALESCE(?9, limit_all_daily)
			WHERE id = 1`,
		)
		.bind(
			now,
			readUsage?.short ?? null,
			readUsage?.daily ?? null,
			allUsage?.short ?? null,
			allUsage?.daily ?? null,
			readLimit?.short ?? null,
			readLimit?.daily ?? null,
			allLimit?.short ?? null,
			allLimit?.daily ?? null,
		)
		.run();
}
