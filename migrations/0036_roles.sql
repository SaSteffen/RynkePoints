-- Roles in the app (feature 043): administrators give and take the Orga and
-- Admin roles in Admin › Rollen, so the app now writes `organiser` and
-- `administrator` too, as a pair (data-model.md). `role_since` dates the
-- current role for Rollen; NULL for roles set by hand before.
--
-- The role card: `role_seen` is the role the rider had before the first change
-- they haven't seen (0 none, 1 Orga, 2 Admin), NULL when there is nothing to
-- tell; `role_changed_by` the first name of the administrator who made the
-- latest change, `role_changed_at` when. They go with the rider's row.
--
-- Add only: the previously deployed code never names the new columns.

ALTER TABLE riders ADD COLUMN role_since INTEGER;
ALTER TABLE riders ADD COLUMN role_seen INTEGER;
ALTER TABLE riders ADD COLUMN role_changed_by TEXT;
ALTER TABLE riders ADD COLUMN role_changed_at INTEGER;
