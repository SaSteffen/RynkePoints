-- Feature 047: Strava call counts per UTC day (data-model.md). Additions only,
-- so the deployed version keeps working. Counts only: no rider or activity
-- identifiers and no relation to `riders`. Action and endpoint carry no CHECK,
-- so a value added later needs no migration. Pruned to 30 days by the daily run.

-- This team's calls and the calls the budget held back, per action and endpoint.
CREATE TABLE strava_calls_daily (
	day TEXT NOT NULL CHECK (day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	action TEXT NOT NULL,
	endpoint TEXT NOT NULL,
	calls INTEGER NOT NULL DEFAULT 0,
	held_back INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY (day, action, endpoint)
) WITHOUT ROWID;

-- The highest daily total Strava reported to this team's calls that day.
CREATE TABLE strava_seen_daily (
	day TEXT PRIMARY KEY CHECK (day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	seen INTEGER NOT NULL
) WITHOUT ROWID;
