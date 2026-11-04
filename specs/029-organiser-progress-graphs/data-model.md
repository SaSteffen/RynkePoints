# Data Model: Organiser Progress Graphs

No migration, table or column. Everything below is derived per request.

## Read: daily rider figures

From `ride_results` joined to `activities`, one row per rider and local start date:

| Field | Source | Notes |
| --- | --- | --- |
| `athlete_id` | `ride_results` | listed and on version 3 or higher, inside SQL |
| `day` | `substr(start_date_local, 1, 10)` | the rider's local date (FR-004) |
| `outdoor_m` | `SUM(distance_m)` where `is_virtual = 0` | whole metres |
| `virtual_m` | `SUM(distance_m)` where `is_virtual = 1` | whole metres |
| `elevation_dm` | `SUM(elevation_dm)` | from both kinds (FR-006) |

Filter: `counts = 1`. Single rides, names, times and speeds are never selected.

## Read: agreed riders

The IDs in `LISTED_RIDER_IDS` that are also in `sharedRiderIdsSince(3)`. Everyone else in `readTeam` is
"not agreed yet" and contributes a first name and group only, which earlier consent covers.

## View: `organiserGraphsView()`

A pure function of the rows, the riders with their groups, the window and today.

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
- `SampleRider`: optional `consentVersion` (research R11).
