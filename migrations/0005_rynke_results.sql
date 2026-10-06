-- Stored Rynke for feature 003-rynke-evaluation: one result per activity and
-- one balance per rider (FR-014, FR-014a). See
-- specs/003-rynke-evaluation/data-model.md and research R10.
--
-- Only adds tables; the previously deployed version never reads them. Both
-- cascade from their owner, so deleting an activity or a rider removes its
-- Rynke rows too (FR-015). Elevation is in whole decimetres (research R3).
-- overlaps_activity_id has no foreign key: it is rewritten in the same batch
-- as the ride it names.

CREATE TABLE ride_results (
	strava_activity_id INTEGER PRIMARY KEY
		REFERENCES activities (strava_activity_id) ON DELETE CASCADE,
	athlete_id INTEGER NOT NULL REFERENCES riders (athlete_id) ON DELETE CASCADE,
	counts INTEGER NOT NULL CHECK (counts IN (0, 1)),
	reasons TEXT NOT NULL CHECK (json_valid(reasons)),
	overlaps_activity_id INTEGER,
	distance_rynke INTEGER NOT NULL CHECK (distance_rynke >= 0),
	elevation_dm INTEGER NOT NULL CHECK (elevation_dm >= 0),
	is_virtual INTEGER NOT NULL CHECK (is_virtual IN (0, 1)),
	unknown_figures TEXT NOT NULL CHECK (json_valid(unknown_figures)),
	rules_version INTEGER NOT NULL CHECK (rules_version >= 1),
	activity_refreshed_at INTEGER NOT NULL
);

CREATE INDEX ride_results_by_rider ON ride_results (athlete_id);

CREATE TABLE rynke_balances (
	athlete_id INTEGER PRIMARY KEY REFERENCES riders (athlete_id) ON DELETE CASCADE,
	distance_rynke INTEGER NOT NULL CHECK (distance_rynke >= 0),
	elevation_dm INTEGER NOT NULL CHECK (elevation_dm >= 0),
	elevation_rynke INTEGER NOT NULL CHECK (elevation_rynke >= 0),
	elevation_to_next_step_dm INTEGER NOT NULL CHECK (elevation_to_next_step_dm > 0),
	training_rynke INTEGER NOT NULL CHECK (training_rynke >= 0),
	team_rynke INTEGER NOT NULL CHECK (team_rynke >= 0),
	training_missing INTEGER NOT NULL CHECK (training_missing >= 0),
	team_missing INTEGER NOT NULL CHECK (team_missing >= 0),
	training_without_virtual INTEGER NOT NULL CHECK (training_without_virtual >= 0),
	virtual_share_missing INTEGER NOT NULL CHECK (virtual_share_missing >= 0),
	qualified INTEGER NOT NULL CHECK (qualified IN (0, 1)),
	rules_version INTEGER NOT NULL CHECK (rules_version >= 1),
	rules_effective_date TEXT NOT NULL
		CHECK (rules_effective_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	computed_at INTEGER NOT NULL
);
