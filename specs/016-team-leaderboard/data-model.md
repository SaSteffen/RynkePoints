# Data Model: Team Leaderboard and Organiser Overview

Everything is read from tables features 001, 003, 004 and 014 already have. The
one write is the shown quote, marked as seen for the viewer (issue #96, see
"Seen quotes" below).

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

### Breakaway (`breakaway.ts`)

`breakaway(totals)` takes the picked kind's totals of all listed riders and
returns a `Breakaway` or `null` (research R13):

| Field | Meaning |
|---|---|
| `fence` | the bunch's highest total |
| `groups` | the breakaway's groups from the back, each its distinct totals ascending |

`null` below five totals, or when no gap lies ahead of the median rider. A rider
rides in the breakaway when their total is strictly above `fence`. The bunch is
everyone else, drawn to scale from its last rider to its front rider, which may
both be 0. The function sees only totals, no rider.

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

## Deadline results (review L-12, migration 0034)

One row per listed rider, kept for the organisers (FR-036).

| Column | Type | Notes |
|---|---|---|
| `athlete_id` | INTEGER PRIMARY KEY | `REFERENCES riders ON DELETE CASCADE`: gone with the rider |
| `deadline` | TEXT NOT NULL | `YYYY-MM-DD`, the qualification deadline the row was kept for |
| `qualified` | INTEGER NOT NULL | 0 or 1, the stored balance's `qualified` (0 without a balance) |
| `training_rynke` | INTEGER NOT NULL | the balance's Training Rynke (0 without one) |
| `team_rynke` | INTEGER NOT NULL | the balance's Team Rynke (0 without one) |

The daily run's step `recordDeadlineResults` first deletes rows of any other deadline, then,
once Berlin's day is after the deadline and no row has this deadline yet, inserts one row for
each listed rider (`listedRiderFilter`, guests left out), a rider who must reconnect that day
included. While a rider still needs evaluation (`listRidersNeedingEvaluation`), it waits for
the next day, at most until a week after the deadline. `readTeam` reads a rider's row with
the balance; the overview uses it only where `deadline` is the window's. No consent version
changes: the organisers already see these figures, and the privacy notice names that they are
kept. `RiderData` `deadlineResult`: organisers only (004).

## Seen quotes (issue #96, migration 0016)

### `quote_seen`

| Column | Type | Rules |
|--------|------|-------|
| `athlete_id` | INTEGER NOT NULL | → `riders`, ON DELETE CASCADE |
| `quote_id` | TEXT NOT NULL | `quoteId(text)`: the 32-bit FNV-1a hash of the quote's UTF-8 text, 8 hex digits |

PK `(athlete_id, quote_id)`. The quotes of the current round the rider has seen on
the Team page. `pickQuote` picks among the quotes of the list (with today's season
quotes) that have no row; the pick of the last unseen one deletes the rows of the
whole list and keeps only that quote, so a new round starts without repeating it
right away. Rows of the other list and of other seasons stay. Only a GET writes,
as with `rynke_seen`; a quote whose text changes counts as unseen.

## Visibility (004)

| Data | Shown to | 004 `RiderData` |
|---|---|---|
| Totals and weekly totals without identity | every signed-in rider | `accumulatedRynke` (TEAM) |
| First name, profile link | organisers | `firstName`, `profileLink` |
| Thresholds, missing, status, qualification | organisers; the viewer's own status only drives their quote | `progress` |
| Breakdown, attendance, corrections | organisers | `breakdown`, `attendance`, `corrections` |
