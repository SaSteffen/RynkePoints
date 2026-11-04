# Data Model: Stored Rider Summaries

## `rider_summaries` (new, migration `0024_rider_summaries.sql`)

One row per rider. `WITHOUT ROWID`. Removed by `ON DELETE CASCADE` with the rider.

| Column | Type | Content |
|---|---|---|
| `athlete_id` | INTEGER PRIMARY KEY, references `riders` | The rider |
| `version` | INTEGER NOT NULL | `RIDER_SUMMARY_VERSION` it was worked out with |
| `days` | TEXT NOT NULL DEFAULT `'[]'` | Counting rides per local date: `[date, distanceM, distanceRynke, elevationDm]`, by date |
| `weeks` | TEXT NOT NULL DEFAULT `'[]'` | Counting rides per week: `[weekEnd, distanceRynke, elevationDm]`, by week. `weekEnd` is that week's Sunday |
| `run_days` | TEXT NOT NULL DEFAULT `'[]'` | Outdoor runs per local date: `[date, distanceM]`, by date |
| `active` | TEXT NOT NULL DEFAULT `'[]'` | Distinct starts of counting rides, runs and swims: `[date, hour, ride]`, with `ride` 1 or 0, sorted |
| `attended` | TEXT NOT NULL DEFAULT `'[]'` | Attended event IDs, ascending |

No ride name, activity ID, route or duration. No timestamp, so an unchanged evaluation produces an identical row.

## Rules

- **Worked out from**: the same evaluation as the balance: `figuresOf` (counting rides, runs, swims) and the rider's attendance. Pure function `summaryOf` in `src/rynke/summary.ts`.
- **Equal to adding up**: same rows as `ride_results` `counts = 1` joined with `activities`, plus `runs`, `swims`, `attendances`. Distances differ at most in floating-point noise (research R10).
- **Current**: a row counts only when `version = RIDER_SUMMARY_VERSION`. A missing or other-version row means the rider is added up.
- **Empty**: a rider with nothing stored has a row of empty lists and counts as summarised.
- **Not listed**: the row stays, but no team read returns it.

## States

```text
no row ──(insertRider, or first evaluation)──► current
current ──(evaluation with a difference)─────► current, rewritten
current ──(RIDER_SUMMARY_VERSION raised)─────► outdated, added up on read
outdated or none ──(daily job evaluates)─────► current
any ──(rider deleted)────────────────────────► gone
```

## Other changes

- `listRidersNeedingEvaluation`: also returns a connected rider with no current row, or whose `attended` differs from `attendances`, in either direction.
- `test/integration/schema-minimisation.test.ts` lists the new columns. `test/integration/db.test.ts` gets the table in its delete checks. `resetDb` clears it.
