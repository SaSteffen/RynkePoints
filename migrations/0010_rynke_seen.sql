-- The Training and Team Rynke a rider last saw on the Overview (feature 012
-- US2), so new Rynke since then are celebrated once. One row per rider,
-- overwritten by every visit. Deleting a rider removes it. Only adds a table, so
-- the previously deployed version keeps working.

CREATE TABLE rynke_seen (
	athlete_id INTEGER PRIMARY KEY REFERENCES riders (athlete_id) ON DELETE CASCADE,
	training_rynke INTEGER NOT NULL,
	team_rynke INTEGER NOT NULL
);
