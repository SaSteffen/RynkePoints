-- The consent step and the optional write access (FR-001, FR-003, FR-025;
-- feature 004-roles-and-consent, FR-013). See
-- specs/001-strava-connect-webhook/data-model.md and research R21.
--
-- Add only: the previously deployed code never names the new column or table,
-- so it keeps working until the new code is published. Riders connected before
-- this migration were never asked for write access and keep scope_write = 0;
-- they have no consent record until they next connect through the landing page.

ALTER TABLE riders ADD COLUMN scope_write INTEGER NOT NULL DEFAULT 0 CHECK (scope_write IN (0, 1));

CREATE TABLE consent_records (
	athlete_id INTEGER NOT NULL REFERENCES riders (athlete_id) ON DELETE CASCADE,
	version INTEGER NOT NULL CHECK (version >= 1),
	accepted_at INTEGER NOT NULL,
	PRIMARY KEY (athlete_id, version)
);
