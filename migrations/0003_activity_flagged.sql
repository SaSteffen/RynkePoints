-- Strava's flag on activities (FR-013), which feature 003-rynke-evaluation
-- needs so it never counts a flagged ride. See
-- specs/001-strava-connect-webhook/data-model.md and research R20.
--
-- The column is nullable without a default: NULL means unknown, never a
-- guessed "not flagged". Rows stored before this migration start as NULL.
-- No riders change: ACTIVITY_FIGURES_VERSION going to 2 marks every rider at
-- version 1 for the one-time re-read by the daily cron.

ALTER TABLE activities ADD COLUMN is_flagged INTEGER CHECK (is_flagged IN (0, 1));
