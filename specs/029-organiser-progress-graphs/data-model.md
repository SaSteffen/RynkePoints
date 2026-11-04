# Data Model: Organiser Progress Graphs

## Table: `rider_ride_summaries` (migration 0024)

| Column | Type | Notes |
| --- | --- | --- |
| `athlete_id` | INTEGER, primary key | references `riders`, `ON DELETE CASCADE` (FR-026) |
| `days` | TEXT, `json_valid` | `[["YYYY-MM-DD", outdoorM, virtualM, elevationDm], ...]`, ascending |
| `weeks` | TEXT, `json_valid` | `[["YYYY-MM-DD", distanceRynke, elevationDm], ...]`, by the Sunday ending the week, ascending |

`WITHOUT ROWID`. Forward-only and additive; the previous version never reads it.

**Pure function** `dailyFigures(rides, results)`: counting rides only, grouped by the rider's local start date
(FR-004). Distances are whole metres. No ride name, ID, time or speed is kept. A rider with no counting rides
gets `[]`.

**Pure function** `weeklyRideSums(rides, results)`: the same counting rides, by Monday-to-Sunday week, equal to
what `listWeeklyRideSumsStatement` adds up today (FR-032, SC-009). A rider with no counting rides gets `[]`.

**Written** by `riderWrites`, in the batch of every evaluation. **Filled** for existing riders by the daily job,
which treats a missing row as needing evaluation (research R1).

## Read: figures for the page

One statement, in the batch with the open requests: `riders` left-joined to `rider_ride_summaries`, for IDs in
`LISTED_RIDER_IDS` and in `sharedRiderIdsSince(3)`. Everyone else in `readTeam` is "not agreed yet" and contributes
a first name and group only, which earlier consent covers.

## Read: weekly sums in `readTeam`

Two statements replace `listWeeklyRideSumsStatement` in its batch, so round trips stay the same:

- `weeks` from `rider_ride_summaries`, for IDs in `LISTED_RIDER_IDS`. Never `days`.
- The existing sum over `ride_results` and `activities`, only for
  `LISTED_RIDER_IDS EXCEPT SELECT athlete_id FROM rider_ride_summaries`.

`TeamRider.rides` keeps its shape, so nothing above `readTeam` changes.

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
- A day after `lastDay`, possible when a rider's time zone is ahead of Berlin, is clamped to `lastDay`, so
  sums stay complete (SC-005).
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
- `listRidersNeedingEvaluation`: also riders without a `rider_ride_summaries` row.
- `SampleRider`: optional `consentVersion` (research R11).
