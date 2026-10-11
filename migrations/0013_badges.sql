-- Badges for feature 013-badges-achievements: outdoor runs, each rider's
-- personal badges, the badges already revealed to them, and the last badge rise
-- for the notification text. See specs/013-badges-achievements/data-model.md
-- and research R10 to R18.
--
-- Only adds tables and one rider column with a default, so the previously
-- deployed version keeps working. Everything cascades from riders, so a rider
-- who leaves takes their runs and badges along (Principle I). badges_version 0
-- marks every existing rider for one silent evaluation by the daily cron (R18).

CREATE TABLE runs (
	strava_activity_id INTEGER PRIMARY KEY,
	athlete_id INTEGER NOT NULL REFERENCES riders (athlete_id) ON DELETE CASCADE,
	start_date TEXT NOT NULL,
	start_date_local TEXT NOT NULL,
	distance_m REAL NOT NULL CHECK (distance_m >= 0),
	is_private INTEGER NOT NULL CHECK (is_private IN (0, 1)),
	refreshed_at INTEGER NOT NULL
);

CREATE INDEX runs_by_rider ON runs (athlete_id, start_date_local);

CREATE TABLE rider_badges (
	athlete_id INTEGER NOT NULL REFERENCES riders (athlete_id) ON DELETE CASCADE,
	badge_id TEXT NOT NULL,
	earned_on TEXT NOT NULL
		CHECK (earned_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	PRIMARY KEY (athlete_id, badge_id)
);

CREATE TABLE badge_reveals (
	athlete_id INTEGER NOT NULL REFERENCES riders (athlete_id) ON DELETE CASCADE,
	badge_id TEXT NOT NULL,
	earned_on TEXT NOT NULL
		CHECK (earned_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	PRIMARY KEY (athlete_id, badge_id)
);

CREATE TABLE badge_rises (
	athlete_id INTEGER PRIMARY KEY REFERENCES riders (athlete_id) ON DELETE CASCADE,
	badge_ids TEXT NOT NULL CHECK (json_valid(badge_ids)),
	risen_at INTEGER NOT NULL
);

ALTER TABLE riders ADD COLUMN badges_version INTEGER NOT NULL DEFAULT 0;
