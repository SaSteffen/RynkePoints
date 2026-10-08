-- How much a rider's Training and Team Rynke last rose (issue #45), so a
-- notification can say how many Rynke are new. The push itself stays empty;
-- the device reads this through /me/notification-text. One row per rider,
-- overwritten by every rise. Deleting a rider removes it. Only adds a table, so
-- the previously deployed version keeps working.

CREATE TABLE rynke_rises (
	athlete_id INTEGER PRIMARY KEY REFERENCES riders (athlete_id) ON DELETE CASCADE,
	training_rynke INTEGER NOT NULL,
	team_rynke INTEGER NOT NULL,
	risen_at INTEGER NOT NULL
);
