-- Riders report team-event participation (feature 019, data-model.md). A row
-- says the rider tapped "Bin dabei" before the event or "Ich war dabei" from
-- its date on; which of the two follows from the event's date, so nothing has
-- to change it when the day comes (research R1). Confirming records the
-- attendance and deletes the row, denying deletes it, so no decision is kept.
-- Deleting an event or a rider removes their rows. Only adds a table, so the
-- previously deployed version keeps working.

CREATE TABLE participation_reports (
	event_id INTEGER NOT NULL REFERENCES team_events (event_id) ON DELETE CASCADE,
	athlete_id INTEGER NOT NULL REFERENCES riders (athlete_id) ON DELETE CASCADE,
	-- Unix seconds, like every other timestamp; kept by an undo (research R4).
	reported_at INTEGER NOT NULL,
	PRIMARY KEY (event_id, athlete_id)
);

CREATE INDEX participation_reports_by_rider ON participation_reports (athlete_id);
