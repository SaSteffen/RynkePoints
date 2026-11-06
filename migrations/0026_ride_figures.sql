-- Feature 032: ride figures for the ranking on /team and the organiser's
-- Sessions column.
-- [date, distanceM, elevationDm] per counting ride, sorted. Derived data like
-- the rest of the row: no ride ID, name, time or route, worked out again by
-- `summaryOf` at any time and deleted with the rider. Ride readers use rows of
-- version 3; the daily job raises every row to it.
ALTER TABLE rider_summaries ADD COLUMN rides TEXT NOT NULL DEFAULT '[]';
-- The minor revision of `version` the rider accepted (constitution 2.4.0): 1
-- for "3.1". Earlier records read as 0.
ALTER TABLE consent_records ADD COLUMN revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0);
-- The previously deployed code names neither column, so it keeps working.
