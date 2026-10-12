-- Swims for feature 013-badges-achievements part C: only what the swim badges
-- need, the same shape as runs. See specs/013-badges-achievements/data-model.md
-- "Part C" and research R26.
--
-- Only adds a table, so the previously deployed version keeps working. It
-- cascades from riders, so a rider who leaves takes their swims along
-- (Principle I).

CREATE TABLE swims (
	strava_activity_id INTEGER PRIMARY KEY,
	athlete_id INTEGER NOT NULL REFERENCES riders (athlete_id) ON DELETE CASCADE,
	start_date TEXT NOT NULL,
	start_date_local TEXT NOT NULL,
	distance_m REAL NOT NULL CHECK (distance_m >= 0),
	is_private INTEGER NOT NULL CHECK (is_private IN (0, 1)),
	refreshed_at INTEGER NOT NULL
);

CREATE INDEX swims_by_rider ON swims (athlete_id, start_date_local);
