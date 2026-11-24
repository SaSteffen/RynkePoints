# Data Model: CPU Median Over the Season

## CPU day (`usage_cpu_daily`, exists since feature 025)

One row per UTC day and owner (a team ID, or `shared` for the gateway). Every
team's database holds every owner's rows, as today.

| Column | Type | Change |
|---|---|---|
| `day` | TEXT `YYYY-MM-DD` | — |
| `owner` | TEXT | — |
| `runs` | INTEGER | — |
| `cut_off` | INTEGER | — |
| `cpu_p99_us` | INTEGER | — |
| `cpu_p50_us` | INTEGER NULL | **new**: the highest median CPU time of the owner's Workers that day, µs, rounded. NULL: none recorded |
| `recorded_at` | INTEGER | — |

Migration `migrations/0042_usage_cpu_median.sql`:

```sql
ALTER TABLE usage_cpu_daily ADD COLUMN cpu_p50_us INTEGER;
```

Rules:

- Written by the hourly recording for yesterday and today with the other
  figures (upsert replaces it, FR-001).
- Rows from before the release stay NULL until the fill task finds a value
  (FR-002, FR-015). The fill task only turns NULL into a value, never the other
  way, and never inserts rows.
- Deleted with the row by `pruneUsageHistory` (13 months, FR-004).
- Counts only, no rider identifier: the schema-minimisation test lists the new
  column with the table's others.

In code, `CpuDay` gains `p50Us: number | null`.

## Week slot (derived, not stored)

Built from the season's CPU days for one page view.

| Field | Meaning |
|---|---|
| `from`, `to` | the slot's first and last day: Monday–Sunday, cut at 1 Sep / 31 Aug |
| `own` | highest non-null median of this team's days in the slot, µs, or null |
| `others` | highest non-null median of all other teams' days in the slot, or null |
| `shared` | highest non-null median of the gateway's days in the slot, or null |
| `toCome` | the slot starts after today: no value, no tip |

Season: from 1 September of the day's year (or the year before, for a day
before September) to the next 31 August, by UTC day.

## Graph scale (derived)

`top` = the smallest of 0.5, 1, 2, 5, 10, 20, 50 … ms at or above the highest
slot value. The 10 ms limit is drawn when `top ≥ 10`. No slot value in the
season → the graph is replaced by the one-line empty state (FR-012).
