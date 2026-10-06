-- Initial schema for Strava connection and webhook activity intake.
-- See specs/001-strava-connect-webhook/data-model.md. Timestamps are Unix epoch
-- seconds. Every rider-owned row cascades from riders, so deleting a rider is a
-- complete deletion (FR-022). The rider's language is deliberately not stored:
-- it lives only in the rp_lang cookie (FR-029a).

CREATE TABLE riders (
	athlete_id INTEGER PRIMARY KEY,
	first_name TEXT NOT NULL,
	status TEXT NOT NULL CHECK (status IN ('connected', 'needs_reconnect')),
	scope_read_all INTEGER NOT NULL CHECK (scope_read_all IN (0, 1)),
	scopes TEXT NOT NULL,
	connected_at INTEGER NOT NULL,
	scopes_updated_at INTEGER NOT NULL,
	membership_checked_at INTEGER NOT NULL,
	import_status TEXT NOT NULL CHECK (import_status IN ('pending', 'running', 'done')),
	reconnect_requested_at INTEGER,
	CHECK ((status = 'connected') = (reconnect_requested_at IS NULL))
);

CREATE TABLE strava_credentials (
	athlete_id INTEGER PRIMARY KEY REFERENCES riders (athlete_id) ON DELETE CASCADE,
	access_token_enc TEXT NOT NULL,
	refresh_token_enc TEXT NOT NULL,
	expires_at INTEGER NOT NULL
);

CREATE TABLE activities (
	strava_activity_id INTEGER PRIMARY KEY,
	athlete_id INTEGER NOT NULL REFERENCES riders (athlete_id) ON DELETE CASCADE,
	sport_type TEXT NOT NULL,
	start_date TEXT NOT NULL,
	start_date_local TEXT NOT NULL,
	timezone TEXT NOT NULL,
	distance_m REAL NOT NULL CHECK (distance_m >= 0),
	moving_time_s INTEGER NOT NULL CHECK (moving_time_s >= 0),
	elevation_gain_m REAL NOT NULL CHECK (elevation_gain_m >= 0),
	is_private INTEGER NOT NULL CHECK (is_private IN (0, 1)),
	refreshed_at INTEGER NOT NULL
);

CREATE INDEX activities_by_rider ON activities (athlete_id, start_date DESC);

CREATE TABLE failed_work (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	athlete_id INTEGER NOT NULL REFERENCES riders (athlete_id) ON DELETE CASCADE,
	message TEXT NOT NULL UNIQUE,
	last_error TEXT NOT NULL,
	first_failed_at INTEGER NOT NULL,
	failed_at INTEGER NOT NULL,
	failures INTEGER NOT NULL CHECK (failures >= 1)
);

-- Single row holding the app-wide Strava budget (research R6). Usage counts only
-- apply while observed_at is in the current 15-minute window or UTC day.
CREATE TABLE strava_rate_limit (
	id INTEGER PRIMARY KEY CHECK (id = 1),
	observed_at INTEGER NOT NULL,
	read_15m INTEGER NOT NULL,
	read_daily INTEGER NOT NULL,
	all_15m INTEGER NOT NULL,
	all_daily INTEGER NOT NULL,
	limit_read_15m INTEGER NOT NULL,
	limit_read_daily INTEGER NOT NULL,
	limit_all_15m INTEGER NOT NULL,
	limit_all_daily INTEGER NOT NULL
);

INSERT INTO strava_rate_limit (
	id, observed_at,
	read_15m, read_daily, all_15m, all_daily,
	limit_read_15m, limit_read_daily, limit_all_15m, limit_all_daily
) VALUES (1, 0, 0, 0, 0, 0, 100, 1000, 200, 2000);
