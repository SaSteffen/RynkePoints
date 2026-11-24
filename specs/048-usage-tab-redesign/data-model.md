# Data Model: Usage Tab Redesign

No new data is read from Strava or kept about riders. One table changes its
check; the rest is derived on each page view.

## Early threshold (code, `src/usage/allowances.ts`)

| Group | Allowances | Threshold |
|---|---|---|
| Strava per day | `strava_read_daily`, `strava_all_daily` | 25 |
| Strava per 15 minutes | `strava_read_15m`, `strava_all_15m` | 25 |
| Connected riders | `riders_connected` | 25 |
| Cloudflare per day | `cf_worker_requests`, `cf_queue_operations`, `cf_d1_rows_read`, `cf_d1_rows_written` | 25 |
| Database storage | `cf_d1_storage_bytes` | 25 |

- Each allowance belongs to exactly one group (a test checks every
  `AllowanceId` has a threshold).
- A threshold is a whole percentage, 1–100. At 80 or more the group has no early
  level.
- `WARNING_LEVEL` (80) and `CRITICAL_LEVEL` (95) are unchanged and shared.

## Level (derived)

`"ok" | "early" | "warning" | "critical"`, per figure, from `used` and `limit`
exactly (`used × 100 ≥ limit × level`), highest reached wins. CPU values and
marked days keep `"ok" | "warning" | "critical"` from their own rules (feature
025 FR-043; features 036, 046, 047).

## `usage_alerts` (D1, changed by migration 0041)

| Column | Type | Rule |
|---|---|---|
| `allowance` | TEXT | an allowance id or `cpu_cut_off` |
| `period` | TEXT | UTC day, or `open` for `riders_connected` and `cf_d1_storage_bytes` |
| `level` | INTEGER | **was** `IN (80, 95)`, **now** `BETWEEN 1 AND 100`; a Hinweis stores its threshold |
| `fired_at` | INTEGER | epoch seconds |

Primary key `(allowance, period, level)`, `WITHOUT ROWID`, as before. Rows are
copied by the migration. Pruning and the clearing of `open` rows are unchanged;
clearing now walks `alertLevels(allowance)`, which includes the early threshold.

## Attention item (derived, `src/usage/attention.ts`)

| Field | Meaning |
|---|---|
| `kind` | `figure`, `cpu`, `recheck`, `routing`, `calls`, `team`, `device` |
| `level` | `critical`, `warning`, `early`, or `hint` (team, device) |
| `target` | the page anchor the row links to (`#<allowance>`, `#cpu`, `#recheck`, `#routing`, `#strava-calls`, `#strava`) or `/me/settings` for the device hint |
| `subject` | what the row names: the allowance, the CPU owner (this team, other teams, gateway), the day, the other team's number |
| `percent`, `used`, `limit` | for figures only |

- Order: `critical`, `warning`, `early`, `hint`; within a level, the page's
  order (Strava figures, Cloudflare figures, then Betrieb rows in their order,
  newer day first).
- Day items come from today and yesterday (UTC) only; one item per marked day.
- CPU items: one per owner with a mark today.
- Team hint: one per other team whose exchange never succeeded or last failed
  (today's `teamNotices` rule).
- Device hint: when the viewer has no push subscription.

## Mark count (derived)

`{ critical, warning, early }` = items per level, hints excluded. The total is the
Admin tab's and the "Nutzung" segment's number; 0 shows nothing.
