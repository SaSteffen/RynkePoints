-- Team badge notifications (issue #125). Team badges are still worked out on
-- every read (feature 013 research R15); this only remembers, per season, which
-- of them were already announced, so each one notifies once even when it is
-- taken back and earned again. The row holds badge ids only, nothing about
-- riders (FR-032).
--
-- A season without a row has never been checked: the first check stores what
-- the team already has without notifying, so deploying this doesn't announce
-- every badge earned so far. Only adds a table, so the previously deployed
-- version keeps working.

CREATE TABLE team_badge_notices (
	season_start TEXT PRIMARY KEY
		CHECK (season_start GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	badge_ids TEXT NOT NULL CHECK (json_valid(badge_ids)),
	checked_at INTEGER NOT NULL
);
