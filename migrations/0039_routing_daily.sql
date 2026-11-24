-- Feature 046: gateway routing's counts per UTC day (data-model.md). Additions
-- only, so the deployed version keeps working. Counts only: no rider
-- identifiers and no relation to `riders`. `team` is a team ID, or '' for the
-- gateway's own figures. This team's own figures are counted here; the rest
-- come from the gateway's exchange. Pruned to 30 days by the daily run.
CREATE TABLE routing_daily (
	day TEXT NOT NULL CHECK (day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	team TEXT NOT NULL,
	figure TEXT NOT NULL,
	count INTEGER NOT NULL CHECK (count >= 0),
	PRIMARY KEY (day, team, figure)
) WITHOUT ROWID;
