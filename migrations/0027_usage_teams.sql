-- Feature 026 FR-039: the other teams' own counts, one per allowance, UTC day and
-- team, as each team's usage export gave them (contracts/usage-exchange.md).
-- Counts only: no rider identifiers and no relation to `riders`. This team's own
-- count stays in `usage_daily.team_used`. Whether a team answered is in
-- `usage_source_state` as source `team:<id>`.
CREATE TABLE usage_team_daily (
	day TEXT NOT NULL CHECK (day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	allowance TEXT NOT NULL,
	team TEXT NOT NULL,
	used INTEGER NOT NULL,
	recorded_at INTEGER NOT NULL,
	PRIMARY KEY (day, allowance, team)
) WITHOUT ROWID;
