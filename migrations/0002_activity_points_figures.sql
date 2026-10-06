-- Activity figures feature 003-rynke-evaluation needs to compute points
-- (FR-013): elapsed time and Strava's manual and trainer flags. See
-- specs/001-strava-connect-webhook/data-model.md and research R20.
--
-- The activity columns are nullable without a default: NULL means unknown,
-- never a guessed 0. Rows stored before this migration start as NULL.
-- figures_version defaults to 0, which marks every existing rider for the
-- one-time re-read by the daily cron; new riders get the current version.

ALTER TABLE activities ADD COLUMN elapsed_time_s INTEGER CHECK (elapsed_time_s >= 0);
ALTER TABLE activities ADD COLUMN is_manual INTEGER CHECK (is_manual IN (0, 1));
ALTER TABLE activities ADD COLUMN is_trainer INTEGER CHECK (is_trainer IN (0, 1));

ALTER TABLE riders ADD COLUMN figures_version INTEGER NOT NULL DEFAULT 0
	CHECK (figures_version >= 0);
