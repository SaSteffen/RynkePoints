-- The organiser flag (feature 004-roles-and-consent, FR-001, FR-002). See
-- specs/004-roles-and-consent/data-model.md and research R2, R3.
--
-- Only the maintainer sets or clears it, in the database
-- (specs/004-roles-and-consent/contracts/organiser-flag.md); the app reads it
-- and never writes it (FR-004). Deleting the rider deletes it with the row.
--
-- Add only: the previously deployed code never names the new column, so it
-- keeps working until the new code is published. Every rider starts as no
-- organiser (FR-006).

ALTER TABLE riders ADD COLUMN organiser INTEGER NOT NULL DEFAULT 0 CHECK (organiser IN (0, 1));
