-- Feature 036: the ride edit re-check (data-model.md). Additions only, so the
-- deployed version keeps working.

-- When the hourly run last chose the rider for a check; NULL: never, which
-- counts as longest ago. Put back by a check that is skipped or fails.
ALTER TABLE riders ADD COLUMN rechecked_at INTEGER;

-- The checks per UTC day, for the usage view. Counts only: no rider
-- identifiers and no relation to `riders`. Pruned with `usage_daily`.
CREATE TABLE recheck_daily (
	day TEXT PRIMARY KEY CHECK (day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	sent INTEGER NOT NULL DEFAULT 0,
	skipped INTEGER NOT NULL DEFAULT 0,
	failed INTEGER NOT NULL DEFAULT 0,
	unordered INTEGER NOT NULL DEFAULT 0,
	over_24h INTEGER NOT NULL DEFAULT 0,
	runs_held INTEGER NOT NULL DEFAULT 0
) WITHOUT ROWID;
