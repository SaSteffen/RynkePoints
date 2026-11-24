# Contract: Usage alerts with Hinweis

Extends feature 025 contracts/alerts.md. Everything not named here is unchanged
(insert first, one notification per subject with a newly reached level,
recipients = administrators with the switch on, no rider data, push never holds
up recording).

## Levels per allowance

`alertLevels(allowance)` = `[earlyThreshold(allowance)` if below 80`, 80, 95]`,
lowest first. Only recorded allowances fire (`RECORDED_ALLOWANCES`); the
15-minute figures never do. CPU alerts (`cpu_cut_off`) keep 80/95 only.

## Check

For each freshly recorded value: every level in `alertLevels` it reaches is
inserted into `usage_alerts (allowance, period, level, fired_at)` with
`INSERT OR IGNORE`; `period` is the UTC day, or `open` for connected riders and
storage. For `open` allowances, every level in `alertLevels` not reached is
deleted, so a later rise notifies again.

## Device text (`GET` notification text, `src/http/pwa.ts`)

| Stored level | Key | German |
|---|---|---|
| < 80 | `notification.usage.early` | "Hinweis: {allowance} bei {percent} %" |
| 80 … 94 | `notification.usage.warning` | unchanged |
| ≥ 95 | `notification.usage.critical` | unchanged |

`{percent}` is today's value where recorded, else the stored level (as today).
The newest, highest row wins, so a run that crosses 25 and 80 words 80.

## Switch text

`admin.alerts.title` "Benachrichtigung bei Hinweis, Warnung und kritisch";
the explanation "Einmal je Wert und Stufe: ab der Hinweisgrenze, bei 80 % und
bei 95 %." All ten catalogs.

## Migration `0041_usage_alerts_early.sql`

```sql
CREATE TABLE usage_alerts_new (
	allowance TEXT NOT NULL,
	period TEXT NOT NULL,
	level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 100),
	fired_at INTEGER NOT NULL,
	PRIMARY KEY (allowance, period, level)
) WITHOUT ROWID;
INSERT INTO usage_alerts_new SELECT allowance, period, level, fired_at FROM usage_alerts;
DROP TABLE usage_alerts;
ALTER TABLE usage_alerts_new RENAME TO usage_alerts;
```

Same name and columns afterwards, so the release before keeps working
(research R2).
