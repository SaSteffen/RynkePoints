-- Admin view with usage statistics (feature 025-admin-usage-view). See
-- specs/025-admin-usage-view/data-model.md and research R1, R4–R7.
--
-- Only adds, so the previously deployed version keeps working until the new code
-- is published. Nothing here but `blocked_athletes` holds a rider's identity
-- after they are gone, and that holds the Strava athlete ID alone (FR-024,
-- constitution Principle I's exception).

-- Set by hand, like `organiser`; the rider's own switch for Cloudflare's alerts.
ALTER TABLE riders ADD COLUMN administrator INTEGER NOT NULL DEFAULT 0
	CHECK (administrator IN (0, 1));
ALTER TABLE riders ADD COLUMN cloudflare_alerts INTEGER NOT NULL DEFAULT 1
	CHECK (cloudflare_alerts IN (0, 1));

-- This team's own counts in the window and day of `observed_at`, and the day's
-- highest observed 15-minute usage. Written in the one UPDATE each Strava
-- response already causes (R1).
ALTER TABLE strava_rate_limit ADD COLUMN own_read_15m INTEGER NOT NULL DEFAULT 0;
ALTER TABLE strava_rate_limit ADD COLUMN own_all_15m INTEGER NOT NULL DEFAULT 0;
ALTER TABLE strava_rate_limit ADD COLUMN own_read_daily INTEGER NOT NULL DEFAULT 0;
ALTER TABLE strava_rate_limit ADD COLUMN own_all_daily INTEGER NOT NULL DEFAULT 0;
ALTER TABLE strava_rate_limit ADD COLUMN peak_read_15m INTEGER NOT NULL DEFAULT 0;
ALTER TABLE strava_rate_limit ADD COLUMN peak_all_15m INTEGER NOT NULL DEFAULT 0;

-- One value per allowance and UTC day. WITHOUT ROWID, because D1 also counts
-- writes to a separate key index (R4). No relation to `riders` (FR-017).
CREATE TABLE usage_daily (
	day TEXT NOT NULL CHECK (day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	allowance TEXT NOT NULL,
	team TEXT NOT NULL,
	used INTEGER NOT NULL,
	limit_value INTEGER NOT NULL,
	team_used INTEGER,
	peak_15m INTEGER,
	recorded_at INTEGER NOT NULL,
	PRIMARY KEY (day, allowance)
) WITHOUT ROWID;

-- When a source last answered or failed, for the view's "unavailable" state.
CREATE TABLE usage_source_state (
	source TEXT PRIMARY KEY,
	last_success_at INTEGER,
	last_failure_at INTEGER
) WITHOUT ROWID;

-- The levels already notified. `period` is the UTC day, or `open` for storage and
-- connected riders, whose rows go when the value falls below the level (R5).
CREATE TABLE usage_alerts (
	allowance TEXT NOT NULL,
	period TEXT NOT NULL,
	level INTEGER NOT NULL CHECK (level IN (80, 95)),
	fired_at INTEGER NOT NULL,
	PRIMARY KEY (allowance, period, level)
) WITHOUT ROWID;

-- Only the ID: no name, time, reason or administrator, and no foreign key, since
-- the rider is gone. WITHOUT ROWID stores by ID, so no insertion order can link an
-- entry to `removal_log` (FR-023, FR-024, R7).
CREATE TABLE blocked_athletes (
	athlete_id INTEGER PRIMARY KEY
) WITHOUT ROWID;

-- When a removal happened and who did it, never whom (FR-023). The record stops
-- naming an administrator who leaves.
CREATE TABLE removal_log (
	id INTEGER PRIMARY KEY,
	removed_at INTEGER NOT NULL,
	administrator_id INTEGER REFERENCES riders (athlete_id) ON DELETE SET NULL
);
