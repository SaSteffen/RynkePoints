# Data Model: Organiser Progress Graphs

## Table: `rider_summaries` (migration 0025 adds columns)

| New column | Type | Content |
| --- | --- | --- |
| `virtual_days` | TEXT NOT NULL DEFAULT `'[]'` | `[date, virtualM]`, by date, only days with a counting virtual ride |
| `own_days` | TEXT NOT NULL DEFAULT `'[]'` | `[date, longestM, outdoor]`, by date, one per counting day; `outdoor` is 1 when any counting ride that day isn't virtual |

`RIDER_SUMMARY_VERSION` becomes 2. No ride name, ID, time or speed is kept. The empty row and a rider with no
counting rides hold `[]`. Sorted as the other columns, so an unchanged evaluation writes nothing.

**Written** by `riderWrites`, which also compares the new columns. **Filled** by the daily job, since a row below the
current version needs evaluation.

## Which read accepts which version (research R14)

| Read | Lowest version | Without such a row |
| --- | --- | --- |
| Team page, app start, organiser's table, team badges | 1 | Added up, as today |
| Graphs | 2 | Added up for those riders, consent filter inside SQL |
| The rider's own Badges figures | 2 | Today's two statements |

## Read: figures for the page

One statement, in the batch with the open requests, from `riders r`: listed, agreed since version 3, `LEFT JOIN`
on a row at version 2 or higher. Selects `athlete_id`, `days`, `virtual_days`. Everyone else in `readTeam` is "not
agreed yet" and contributes a first name and group only, which earlier consent covers.

## View: `organiserGraphsView()`

A pure function of the rows read, the riders with their groups, the window and today.

```text
OrganiserGraphs
  firstDay: "YYYY-MM-DD"        season start
  lastDay:  "YYYY-MM-DD"        min(today, deadline), at least firstDay
  presets:  { season, 3m, 4w }  from/to, clamped to firstDay
  agreedCount: number
  group: Group | null
  riders: [{ id, name, status, requests: boolean,
             days: [[dayIndex, outdoorM, virtualM, elevationDm], ...] }]
  teamTotal: { outdoorM: number[], virtualM: number[], elevationDm: number[] }  dense, one per day
  notAgreed: [{ name, status, requests: boolean }]
```

Rules:

- A rider who agreed is in `riders` even with no rows.
- `teamTotal` sums all of `riders`, whichever are selected (FR-011). The average is `teamTotal / agreedCount`
  in the client, and isn't drawn when `agreedCount` is 0.
- A day before the season or after the deadline is left out (FR-005). A day after today, possible when a rider's
  time zone is ahead of Berlin, is clamped to `lastDay`, so sums stay complete (SC-005).
- Outdoor is the day's distance minus its virtual distance, rounded to whole metres, as virtual is.
- Absent days are 0 (Per day) or level (Running total).

## Client state

Held in `public/app.js`, never saved.

| Field | Default | Survives a tile click |
| --- | --- | --- |
| `from`, `to` | Season | yes |
| `mode` | Running total | yes |
| `average`, `total` | on, off | yes |
| `metric` (narrow) | Outdoor | yes |
| `view` (narrow) | Graphs, or Riders with `view=riders` | yes |
| `selected` | agreed riders of the group | no, comes from the new group |
| `highlight`, `query`, panel open | none | no |

## Registry entries

- `CONSENT_VERSIONS`: version 3 (research R6).
- `RiderData`: `dailyFigures`, organisers only, since version 3 (research R7).
- `Settings`: `ORGANISER_PROGRESS_GRAPH`, "on" or "off" (research R8).
- `SampleRider`: optional `consentVersion` (research R11).
