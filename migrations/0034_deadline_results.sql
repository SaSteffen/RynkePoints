-- Each listed rider's result when the qualification deadline had passed (review
-- L-12): whether they qualified, and both totals, so a later change shows as a
-- difference to the organisers and not as a silent flip. One row per rider,
-- taken once by the daily run after the deadline, gone with the rider and
-- replaced once the next deadline has passed. Add only.
CREATE TABLE deadline_results (
	athlete_id INTEGER PRIMARY KEY REFERENCES riders (athlete_id) ON DELETE CASCADE,
	deadline TEXT NOT NULL
		CHECK (deadline GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	qualified INTEGER NOT NULL CHECK (qualified IN (0, 1)),
	training_rynke INTEGER NOT NULL CHECK (training_rynke >= 0),
	team_rynke INTEGER NOT NULL CHECK (team_rynke >= 0)
);
