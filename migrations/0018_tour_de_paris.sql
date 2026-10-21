-- The Tour de Paris as a fourth team-event kind (feature 021 FR-001, research
-- R9). A tour day is a team event of this kind; it earns no Rynke, which the
-- code decides, not the table.
--
-- Only adds a row, so the previously deployed version keeps working: it never
-- sees a tour day, since only the new code can create one.

INSERT INTO team_event_kinds (kind) VALUES ('tour_de_paris');
