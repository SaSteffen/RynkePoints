-- Organiser administration, Stories 1–3 (feature 014-organiser-admin). See
-- specs/014-organiser-admin/data-model.md and research R7–R9.
--
-- Only adds a table and nullable columns, so the previously deployed version
-- keeps working until the new code is published. Each organiser input carries
-- who stored it and when (FR-040); the organiser's ID goes to NULL when they
-- leave, which shows as "former organiser" (R9). A rider's corrections go with
-- the rider (feature 003 Key Entities).

ALTER TABLE team_events ADD COLUMN changed_by INTEGER
	REFERENCES riders (athlete_id) ON DELETE SET NULL;
ALTER TABLE team_events ADD COLUMN changed_at INTEGER;

ALTER TABLE attendances ADD COLUMN changed_by INTEGER
	REFERENCES riders (athlete_id) ON DELETE SET NULL;
ALTER TABLE attendances ADD COLUMN changed_at INTEGER;

CREATE TABLE corrections (
	correction_id INTEGER PRIMARY KEY,
	athlete_id INTEGER NOT NULL REFERENCES riders (athlete_id) ON DELETE CASCADE,
	training INTEGER NOT NULL CHECK (training BETWEEN -10000 AND 10000),
	team INTEGER NOT NULL CHECK (team BETWEEN -10000 AND 10000),
	reason TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 200),
	correction_date TEXT NOT NULL
		CHECK (correction_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	changed_by INTEGER REFERENCES riders (athlete_id) ON DELETE SET NULL,
	changed_at INTEGER NOT NULL,
	CHECK (training <> 0 OR team <> 0)
);

CREATE INDEX corrections_by_rider ON corrections (athlete_id);
