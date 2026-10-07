-- The ride's name on Strava (feature 008-strava-ride-names FR-001), shown only
-- to the rider on their own ride table. See
-- specs/008-strava-ride-names/data-model.md and research R1.
--
-- Nullable without a default: NULL means unknown, never a guessed name. Rows
-- stored before this migration start as NULL. No riders change:
-- ACTIVITY_FIGURES_VERSION going to 3 marks every rider for the one-time
-- re-read by the daily cron, which fills the names in.

ALTER TABLE activities ADD COLUMN name TEXT;
