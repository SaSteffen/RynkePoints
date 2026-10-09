# Data Model: Team Leaderboard and Organiser Overview

No migration. Everything is read from tables features 001, 003, 004 and 014 already
have; nothing is written.

## Read per request

One `db.batch` of `SELECT`s per page view (research R11). The riders' IDs aren't
known before the batch runs, so every read after the first is limited by the same
subquery, `LISTED_RIDER_IDS` from `src/db/organiser.ts` (014's listed riders:
connected and sharing, filtered in SQL). The statements live in `src/db/team.ts`:

| Read | Statement | Rows |
|---|---|---|
| Listed riders | `listListedRidersStatement` (014) | athlete ID, first name |
| Balances | `listTeamBalancesStatement` | one `rynke_balances` row per rider with a balance |
| Weekly ride sums | `listWeeklyRideSumsStatement` (research R2) | athlete ID, `week_end`, distance Rynke, elevation dm |
| Attendance | `listTeamAttendanceStatement` | athlete ID, event ID, event kind, event date |
| Corrections | `listTeamCorrectionsStatement` | athlete ID, Training, Team, `correction_date` |

The leaderboard needs the first names only to know who is listed; it never renders
them (FR-010). A rider with no balance row counts with every figure 0.

## Derived values (pure, `src/rynke/`)

### `WeekPoint` (`weeks.ts`)

| Field | Meaning |
|---|---|
| `weekEnd` | `YYYY-MM-DD`, the Sunday ending the week, or the last day for the current week |
| `training` | Training Rynke accumulated at the end of the week |
| `team` | Team Rynke accumulated at the end of the week |

`riderWeeks(inputs, seasonStart, weekEnds, balance)` gives one `WeekPoint` per week end.
Earlier points are rebuilt with `tally`; the last point is the stored balance
(research R1). Values never fall below 0 (003 floor).

### `LeaderboardRow` (`leaderboard.ts`)

| Field | Meaning |
|---|---|
| `you` | the viewer's own row |
| `place` | competition rank in the picked kind (research R6) |
| `joint` | another row shares `place` |
| `total` | picked kind's total (stored balance) |
| `other` | the other kind's total |
| `weeks` | the picked kind per `WeekPoint` (sparkline) |

`leaderboardRows(riders, viewerId, kind)` returns the rows and a `Viewer`, or no
`Viewer` when the viewer isn't listed:

| `Viewer` field | Meaning |
|---|---|
| `place`, `joint` | the viewer's row's |
| `count` | the number of rows |
| `toNext` | the Rynke to pass the next place, or none in 1st place (`lead`) |

No athlete ID or name leaves `leaderboard.ts`: rows are built from the riders and
then carry only these fields (FR-010, SC-002).

### `Neighbourhood`

| Field | Meaning |
|---|---|
| `rows` | the rows shown |
| `hiddenAhead` | rows above the first shown |
| `hiddenBehind` | rows below the last shown |
| `toggle` | whether the "Around you / Everyone" toggle is shown (more than 7 rows) |

### `TeamTotals`

| Field | Meaning |
|---|---|
| `total` | sum of the picked kind over listed riders |
| `thisWeek` | `total` minus the previous week's team total |
| `weeks` | team total per week end |
| `bestWeek` | the week end with the largest weekly gain, earliest on ties; none before the second week |

### Breakaway fence (`breakaway.ts`)

`breakawayFence(totals)` takes the picked kind's totals of all listed riders and
returns a number or `null` (research R13):

| Result | When |
|---|---|
| `null` | fewer than five totals, or no total above the fence |
| Q3 + 1.5 × (Q3 − Q1) | otherwise; quartiles interpolated linearly between the closest ranks |

A rider rides in the breakaway when their total is strictly above the fence. The
bunch is everyone else, drawn to scale against its own highest total, which may
be 0. The function sees only totals, no rider.

### `RiderStatus` (`pace.ts`)

`"push" | "on_track" | "in"` (research R4).

| Status | When |
|---|---|
| `in` | the stored balance qualifies (003 FR-013) |
| `push` | not `in`, and either the deadline has passed, or any of Training, Team, outdoor Training below its even pace |
| `on_track` | otherwise |

The deadline is the team setting `QUALIFICATION_DEADLINE` (spec FR-005), always
set. Once it has passed, the overview labels `push` as "Training goal not reached yet" and shows no
"On track" tile (spec edge cases).

### `OverviewRider` (organiser only)

| Field | Source |
|---|---|
| `firstName`, `profileLink` | `withProfileLinks` (014) |
| `status` | `riderStatus` |
| `training`, `team`, `outdoorTraining` | stored balance (`trainingRynke`, `teamRynke`, `trainingWithoutVirtual`) |
| `pace` | even pace per amount today, or none |
| `missing` | `trainingMissing`, `teamMissing`, `virtualShareMissing`, each flagged when behind its pace |
| `breakdown` | `distanceRynke`, `elevationRynke`, `teamEvents` (per kind: attended, Training, Team), corrections summed from the read, virtual share (003 FR-014a) |

## Visibility (004)

| Data | Shown to | 004 `RiderData` |
|---|---|---|
| Totals and weekly totals without identity | every signed-in rider | `accumulatedRynke` (TEAM) |
| First name, profile link | organisers | `firstName`, `profileLink` |
| Thresholds, missing, status, qualification | organisers; the viewer's own status only drives their quote | `progress` |
| Breakdown, attendance, corrections | organisers | `breakdown`, `attendance`, `corrections` |
