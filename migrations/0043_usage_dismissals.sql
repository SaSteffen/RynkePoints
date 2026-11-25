-- Feature 050: day warnings an administrator marked as seen on Admin › Nutzung
-- (data-model.md). Adds a table only, so the release before keeps working. Keeps
-- which administrator dismissed which kind of day warning, which day and which
-- reasons; no counts, no other rider's data. The reason carries no CHECK: it is
-- checked in code, so a reason added later needs no migration. Pruned by the daily
-- run once its day has left the list; goes with the rider.
CREATE TABLE usage_dismissals (
	athlete_id INTEGER NOT NULL REFERENCES riders (athlete_id) ON DELETE CASCADE,
	kind TEXT NOT NULL CHECK (kind IN ('calls', 'recheck', 'routing')),
	day TEXT NOT NULL CHECK (day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	reason TEXT NOT NULL,
	PRIMARY KEY (athlete_id, kind, day, reason)
) WITHOUT ROWID;
