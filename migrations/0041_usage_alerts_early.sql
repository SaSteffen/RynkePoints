-- Feature 048 (research R2, contracts/alerts.md): a Hinweis is stored with its
-- early threshold as its level, so the level check widens from (80, 95) to
-- 1..100. SQLite can't change a check in place: the table is rebuilt with the
-- same name, columns and key, so the release before keeps reading and writing it.
CREATE TABLE usage_alerts_new (
	allowance TEXT NOT NULL,
	period TEXT NOT NULL,
	level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 100),
	fired_at INTEGER NOT NULL,
	PRIMARY KEY (allowance, period, level)
) WITHOUT ROWID;
INSERT INTO usage_alerts_new (allowance, period, level, fired_at)
	SELECT allowance, period, level, fired_at FROM usage_alerts;
DROP TABLE usage_alerts;
ALTER TABLE usage_alerts_new RENAME TO usage_alerts;
