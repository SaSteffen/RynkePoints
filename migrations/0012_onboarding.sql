-- Onboarding tours (issue #90): when a rider finished or skipped the rider
-- tour, and the organiser tour. NULL means the tour is still to show, so every
-- rider stored before this migration sees the rider tour once after the
-- release, like a new rider.
--
-- The maintainer sets and clears `organiser` in the database, never the app
-- (feature 004 contracts/organiser-flag.md), so clearing the flag also clears
-- `organiser_onboarded_at` here: a rider made organiser again sees the
-- organiser tour again.
--
-- Add only: the previously deployed code never names the new columns, and the
-- trigger only writes them.

ALTER TABLE riders ADD COLUMN onboarded_at INTEGER;
ALTER TABLE riders ADD COLUMN organiser_onboarded_at INTEGER;

CREATE TRIGGER riders_organiser_cleared
AFTER UPDATE OF organiser ON riders
WHEN NEW.organiser = 0 AND OLD.organiser = 1
BEGIN
	UPDATE riders SET organiser_onboarded_at = NULL
	WHERE athlete_id = NEW.athlete_id;
END;
