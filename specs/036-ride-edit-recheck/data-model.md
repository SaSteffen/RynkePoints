# Data Model: Ride Edit Re-check

One migration, `0028_ride_recheck.sql`. It only adds, so the deployed version keeps working.

## `riders.rechecked_at` (new column)

| Column | Type | Meaning |
|---|---|---|
| `rechecked_at` | `INTEGER`, nullable | Epoch seconds of the run that last chose the rider for a check that then happened. `NULL`: never checked, which counts as longest ago. |

- Set by the run for every rider it sends a check for (research R5).
- Put back to the value before by a check that is skipped or fails, only while it still holds the
  value that run set.
- No index: a run reads all eligible riders anyway (at most 999 rows).
- Deleted with the rider. Not shown to anyone (FR-021).

## `recheck_daily` (new table)

One row per UTC day, `WITHOUT ROWID`. No rider identifiers, no relation to `riders`.

| Column | Type | Meaning |
|---|---|---|
| `day` | `TEXT` primary key, `YYYY-MM-DD` | UTC day of the run |
| `sent` | `INTEGER NOT NULL DEFAULT 0` | Checks the day's runs sent |
| `skipped` | `INTEGER NOT NULL DEFAULT 0` | Checks that stood back (budget, waiting work) |
| `failed` | `INTEGER NOT NULL DEFAULT 0` | Checks Strava refused or that hit an error |
| `unordered` | `INTEGER NOT NULL DEFAULT 0` | Checks whose list was not newest first (also counted in `failed`) |
| `over_24h` | `INTEGER NOT NULL DEFAULT 0` | Largest number of eligible riders, active for more than 24 hours, a run that day found last checked more than 24 hours ago |
| `runs_held` | `INTEGER NOT NULL DEFAULT 0` | Runs that sent nothing because more than half of the day's reads were used |

- Checks made = `sent − skipped − failed`.
- Written by the run (one upsert that adds) and by a check only when skipped or failed.
- "Active for more than 24 hours": one of the rider's activities started between 24 hours and 30
  days ago (research R13), so a rider back from a pause doesn't count as having waited.
- A rider never checked counts towards `over_24h` once they have been connected for more than 24
  hours. On the day the feature goes live that is everyone, which is true, and it is gone once
  each rider has had a first check (within a day).
- Pruned by the daily cron with `usage_daily` (13 months).

## Team data

| Field | Type | Meaning |
|---|---|---|
| `TeamData.recheckAllowance` | positive integer | The team's checks per day in normal operation (FR-008). Hamburg 150, Europe 150. |

Rule: the sum over all teams is at most `floor(3000 × 0.10) = 300` (team-data test and
`scripts/team-check.mjs`).

## Queue message

See [contracts/queue-message.md](contracts/queue-message.md).

## Derived, not stored

- **Eligible rider**: `status = 'connected'`, `import_status = 'done'` and active: a stored ride,
  run or swim that started within the last 30 days (FR-027, research R13). Riders being deleted are
  gone or handled by their own message; the check's handler finds no rider and stops.
- **Fast lane**: research R6, read at each run.
- **Run size**: research R4.

## States of one check

```text
chosen by the run ──stamp──▶ sent ──▶ made      (list read; differences stored, if any)
                              ├────▶ skipped   (budget or waiting work; stamp put back)
                              ├────▶ failed    (Strava error or wrong order; stamp put back)
                              └────▶ reconnect (token refused; rider marked, as everywhere)
```
