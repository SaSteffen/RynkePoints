-- Feature 030: what team reads add up, stored once per rider, so a page reads
-- one row per listed rider instead of every ride of the team. Derived data: it
-- holds no ride name, ID, route or duration, and can be worked out again at any
-- time (`summaryOf` in src/rynke/summary.ts). A row counts only under the
-- current `version`; without one the rider is added up from their rides, so the
-- table may start empty. The daily job fills it. Deleted with the rider.
CREATE TABLE rider_summaries (
	athlete_id INTEGER PRIMARY KEY REFERENCES riders (athlete_id) ON DELETE CASCADE,
	version INTEGER NOT NULL,
	-- [date, distanceM, distanceRynke, elevationDm] per day of counting rides.
	days TEXT NOT NULL DEFAULT '[]',
	-- [weekEnd, distanceRynke, elevationDm] per Monday-to-Sunday week.
	weeks TEXT NOT NULL DEFAULT '[]',
	-- [date, distanceM] per day of outdoor runs.
	run_days TEXT NOT NULL DEFAULT '[]',
	-- [date, hour, ride] distinct starts of counting rides, runs and swims.
	active TEXT NOT NULL DEFAULT '[]',
	-- Attended event IDs; an event's date and kind are read live.
	attended TEXT NOT NULL DEFAULT '[]'
) WITHOUT ROWID;
