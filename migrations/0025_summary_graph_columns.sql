-- Feature 029: what the organiser's graphs and the rider's own Badges figures
-- need of a rider's summary. Derived data like the rest of the row, deleted with
-- the rider. The existing columns keep their meaning, so team reads go on using
-- rows of version 1; the daily job raises every row to version 2.
-- [date, virtualM] per day with a counting virtual ride.
ALTER TABLE rider_summaries ADD COLUMN virtual_days TEXT NOT NULL DEFAULT '[]';
-- [date, longestM, outdoor] per day of counting rides; `outdoor` is 1 when any of
-- them wasn't virtual.
ALTER TABLE rider_summaries ADD COLUMN own_days TEXT NOT NULL DEFAULT '[]';
