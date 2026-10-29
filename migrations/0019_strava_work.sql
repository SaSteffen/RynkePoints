-- The fair share of the Strava budget (feature 024, data-model.md). Work that
-- needs Strava waits here, one first-in-first-out list per rider, and is done
-- round robin (research R1, R2). Identifiers and counts only; everything goes
-- with the rider.
--
-- Only adds tables and a defaulted column, so the previously deployed version
-- keeps working: it never reads them.

CREATE TABLE strava_work (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	athlete_id INTEGER NOT NULL REFERENCES riders (athlete_id) ON DELETE CASCADE,
	message TEXT NOT NULL,
	kind TEXT NOT NULL,
	attempts INTEGER NOT NULL CHECK (attempts >= 0),
	not_before INTEGER NOT NULL DEFAULT 0,
	stored_at INTEGER NOT NULL
);

CREATE INDEX strava_work_by_rider ON strava_work (athlete_id, id);

CREATE TABLE strava_queues (
	athlete_id INTEGER PRIMARY KEY REFERENCES riders (athlete_id) ON DELETE CASCADE,
	fresh INTEGER NOT NULL CHECK (fresh IN (0, 1)),
	turn INTEGER NOT NULL,
	events_total INTEGER NOT NULL DEFAULT 0 CHECK (events_total >= 0),
	events_done INTEGER NOT NULL DEFAULT 0 CHECK (events_done >= 0),
	show_progress INTEGER NOT NULL DEFAULT 0 CHECK (show_progress IN (0, 1)),
	start_training INTEGER,
	start_team INTEGER,
	held_badges TEXT NOT NULL DEFAULT '[]',
	created_at INTEGER NOT NULL
);

CREATE INDEX strava_queues_by_turn ON strava_queues (fresh DESC, turn);

-- Who is owed one notification once the owner's backlog is done (research R6).
CREATE TABLE strava_held (
	owner_id INTEGER NOT NULL REFERENCES riders (athlete_id) ON DELETE CASCADE,
	recipient_id INTEGER NOT NULL REFERENCES riders (athlete_id) ON DELETE CASCADE,
	PRIMARY KEY (owner_id, recipient_id)
);

-- When the drain last asked to be woken (research R4).
CREATE TABLE strava_turn (
	id INTEGER PRIMARY KEY CHECK (id = 1),
	wake_at INTEGER NOT NULL
);

INSERT INTO strava_turn (id, wake_at) VALUES (1, 0);

-- Activities listed by the rider's current import (research R7).
ALTER TABLE riders ADD COLUMN import_fetched INTEGER NOT NULL DEFAULT 0;
