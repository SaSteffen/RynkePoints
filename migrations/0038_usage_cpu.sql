-- Workers' CPU time per UTC day (feature 025 User Story 6, FR-041): each Worker
-- owner's runs, the runs Cloudflare cut off for going over a limit, and the CPU
-- time the slowest 1 in 100 runs reached, in microseconds. `owner` is a team ID
-- or `shared` for the gateway. Counts only: no rider identifiers and no
-- relation to `riders`. Pruned with `usage_daily`. Only adds, so the previously
-- deployed version keeps working.
CREATE TABLE usage_cpu_daily (
	day TEXT NOT NULL CHECK (day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	owner TEXT NOT NULL,
	runs INTEGER NOT NULL,
	cut_off INTEGER NOT NULL,
	cpu_p99_us INTEGER NOT NULL,
	recorded_at INTEGER NOT NULL,
	PRIMARY KEY (day, owner)
) WITHOUT ROWID;
