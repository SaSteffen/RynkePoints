-- Strava's Developer Program review (2026-11-04) raised the app's limits to
-- 300 reads / 15 min and 3,000 a day, 600 / 6,000 overall. The row is
-- overwritten by every response's headers anyway; this only stops the budget
-- from working against the old limits until the next Strava response. A limit
-- already higher than these (Strava raised it again) is left alone.
UPDATE strava_rate_limit SET
	limit_read_15m = MAX(limit_read_15m, 300),
	limit_read_daily = MAX(limit_read_daily, 3000),
	limit_all_15m = MAX(limit_all_15m, 600),
	limit_all_daily = MAX(limit_all_daily, 6000)
WHERE id = 1;
