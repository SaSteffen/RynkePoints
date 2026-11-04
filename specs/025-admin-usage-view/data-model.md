# Data Model: Admin View with Usage Statistics

Migration `0021_admin_usage.sql`. It only adds, so the previous version keeps working.

## `riders` (changed)

| Column | Type | Notes |
|---|---|---|
| `administrator` | INTEGER, 0 or 1, default 0 | Set by hand; read on every request. Goes with the rider. |

## `strava_rate_limit` (changed, still one row)

| Column | Type | Notes |
|---|---|---|
| `own_read_15m`, `own_all_15m` | INTEGER, default 0 | This team's count in the window of `observed_at` |
| `own_read_daily`, `own_all_daily` | INTEGER, default 0 | This team's count on the day of `observed_at` |
| `peak_read_15m`, `peak_all_15m` | INTEGER, default 0 | The day's highest observed 15-minute usage |

A new window or day restarts its counts, following `effectiveUsage`.

## `usage_daily`

| Column | Type | Notes |
|---|---|---|
| `day` | TEXT `YYYY-MM-DD`, UTC | Part of the key |
| `allowance` | TEXT | Part of the key; see below |
| `team` | TEXT | From `TEAM_ID` |
| `used` | INTEGER | App-wide or account-wide value |
| `limit_value` | INTEGER | Limit in effect that day |
| `team_used` | INTEGER, nullable | Strava and connected riders only |
| `peak_15m` | INTEGER, nullable | Strava only |
| `recorded_at` | INTEGER | Last time written, epoch seconds |

Allowances: `strava_read_daily`, `strava_all_daily`, `riders_connected`,
`cf_worker_requests`, `cf_queue_operations`, `cf_d1_rows_read`, `cf_d1_rows_written`,
`cf_d1_storage_bytes`.

Holds no rider data, and has no relation to `riders` (FR-017). Rows older than 13 months are
removed by the daily cron. A missing day is a gap.

## `usage_source_state`

| Column | Type | Notes |
|---|---|---|
| `source` | TEXT, key | `cloudflare` |
| `last_success_at`, `last_failure_at` | INTEGER, nullable | For the view's "unavailable" state |

## `usage_alerts`

| Column | Type | Notes |
|---|---|---|
| `allowance`, `period`, `level` | TEXT, TEXT, INTEGER | Key. `period` is the UTC day, or `open` for storage and connected riders. `level` is 80 or 95. |
| `fired_at` | INTEGER | Also tells `/me/notification-text` an alert is current |

Daily rows older than 2 days are removed by the daily cron. `open` rows are removed when the
value falls below the level.

## `blocked_athletes`

| Column | Type | Notes |
|---|---|---|
| `athlete_id` | INTEGER, key | `WITHOUT ROWID`, no foreign key, nothing else (FR-024) |

Kept while the team runs the app. Lifted only by the maintainer, by hand.

## `removal_log`

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER, key | |
| `removed_at` | INTEGER | |
| `administrator_id` | INTEGER, nullable | `REFERENCES riders ON DELETE SET NULL`, so the record stops naming an administrator who leaves |

Holds nothing about the rider removed (FR-023), and the view shows no list of these.

## `consent_records` (unchanged)

Version 2 records are added as riders agree, and the overview filters on them (R8).
