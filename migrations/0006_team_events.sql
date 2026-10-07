-- Team events and attendance for feature 003-rynke-evaluation, Story 3
-- (FR-006, FR-007). See specs/003-rynke-evaluation/data-model.md and research
-- R17 and R20.
--
-- Only adds tables and one balance column with a default, so the previously
-- deployed version keeps working until the new code is published. Kinds are a
-- table rather than a CHECK, so a misspelt kind is refused and a new kind is one
-- INSERT. Deleting an event or a rider removes their attendances (FR-006a,
-- FR-015); events belong to the team and stay when a rider goes.

CREATE TABLE team_event_kinds (
	kind TEXT PRIMARY KEY
);

INSERT INTO team_event_kinds (kind)
VALUES ('team_training'), ('training_weekend_day'), ('technique_training');

CREATE TABLE team_events (
	event_id INTEGER PRIMARY KEY,
	kind TEXT NOT NULL REFERENCES team_event_kinds (kind),
	event_date TEXT NOT NULL
		CHECK (event_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	name TEXT CHECK (name IS NULL OR length(name) BETWEEN 1 AND 100)
);

CREATE TABLE attendances (
	event_id INTEGER NOT NULL REFERENCES team_events (event_id) ON DELETE CASCADE,
	athlete_id INTEGER NOT NULL REFERENCES riders (athlete_id) ON DELETE CASCADE,
	PRIMARY KEY (event_id, athlete_id)
);

CREATE INDEX attendances_by_rider ON attendances (athlete_id);

ALTER TABLE rynke_balances ADD COLUMN team_event_breakdown TEXT NOT NULL
	DEFAULT '[]' CHECK (json_valid(team_event_breakdown));
