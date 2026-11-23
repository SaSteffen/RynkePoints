-- The daily pre-season purge looks for rides, runs and swims whose local date
-- is before the season start. Without an index on the local start it read
-- every stored row each day, more as the season goes on; with one it reads
-- only the rows it finds, on almost every day none.
--
-- Add only: the previously deployed code runs as before.

CREATE INDEX activities_by_local_start ON activities (start_date_local);
CREATE INDEX runs_by_local_start ON runs (start_date_local);
CREATE INDEX swims_by_local_start ON swims (start_date_local);
