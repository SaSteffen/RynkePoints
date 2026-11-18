-- Administrators of other teams as guests (feature 041). Add only, so the
-- release still running while CI deploys keeps working.
--
-- `guests` is the team's guest list: Strava athlete IDs of administrators of
-- other teams who may sign in here without being in the club. The maintainer
-- writes it by hand; the app only reads it. No foreign key: an ID is listed
-- before the person signs in, and stays when they disconnect.
CREATE TABLE guests (
	athlete_id INTEGER PRIMARY KEY
);

-- Set by the app at every sign-in from the list. It keeps the row out of every
-- team count until the row is gone, also after the ID left the list.
ALTER TABLE riders ADD COLUMN guest INTEGER NOT NULL DEFAULT 0 CHECK (guest IN (0, 1));
