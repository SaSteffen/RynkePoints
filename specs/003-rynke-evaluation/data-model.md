# Data Model: Rynke Evaluation — Stories 1, 2, 3 and 4

Story 2 works in memory; Story 4 stores its output in two new tables
(migration `0005_rynke_results.sql`; feature 001's `activities.is_flagged`
came in its `0003_activity_flagged.sql`, research R15). Story 3 adds team events
and attendance as inputs and a breakdown column on the balance (migration
`0006_team_events.sql`, research R17, R20). Corrections (Story 6) and stored
rules (Story 5) come later, each in its own additive migration. Function
signatures and codes:
[contracts/ride-evaluation.md](contracts/ride-evaluation.md).

## Input: Ride (from `activities`, feature 001)

All of the rider's stored activities, not only the season's, so that rides
outside the window get a result too.

| Field | Column | Notes |
|---|---|---|
| `activityId` | `strava_activity_id` | Unique; last tie-breaker for overlaps (research R5). |
| `sportType` | `sport_type` | One of feature 001's six cycling types. |
| `startUtc` | `start_date` | ISO UTC; start of the overlap interval. |
| `startLocal` | `start_date_local` | Local wall-clock time; its date places the ride in the window (R4). |
| `distanceM` | `distance_m` | ≥ 0. |
| `movingS` | `moving_time_s` | ≥ 0. |
| `elapsedS` | `elapsed_time_s` | `null` = unknown (FR-005f). |
| `elevationM` | `elevation_gain_m` | ≥ 0. |
| `manual` | `is_manual` | `null` = unknown. |
| `trainer` | `is_trainer` | `null` = unknown. |
| `flagged` | `is_flagged` | Whether Strava has flagged it; `null` = unknown. |
| `refreshedAt` | `refreshed_at` | Copied into the ride result to detect stale results (R14). |

## Column: `activities.is_flagged` (feature 001 FR-013, its migration `0003`)

| Column | Type | Rule |
|---|---|---|
| `is_flagged` | INTEGER NULL, `CHECK (is_flagged IN (0, 1))` | Strava's `flagged`; `NULL` until read (research R15). |

Filled by every activity write and by the one-time re-read that
`ACTIVITY_FIGURES_VERSION = 2` triggers (feature 001 research R20).

## Input: Rynke Rules (`CURRENT_RULES`, code constant until Story 5)

| Field | Value | Rule |
|---|---|---|
| `version` | 3 (pause rule of 2026-10-09; 2 from Story 3; 1 before) | FR-023; raised with every change of values or logic (R8, R18). |
| `effectiveDate` | the date the version ships | FR-023 |
| `distanceStepKm`, `distanceStepRynke` | 10, 1 | FR-004 |
| `elevationStepM`, `elevationStepRynke` | 1000, 5 | FR-004a |
| `maxPausedShare` | `{ num: 1, den: 1 }` (`{ num: 1, den: 2 }` up to version 2) | FR-005a |
| `minSpeedKmh`, `maxSpeedKmh` | 10, 45 | FR-005c |
| `maxClimbMPerH` | 1500 | FR-005c |
| `excludedSportTypes` | `EBikeRide`, `EMountainBikeRide` | FR-005e |
| `qualificationDeadline` | `null` | FR-011 |
| `trainingThreshold`, `teamThreshold` | 250, 25 | FR-013 |
| `maxVirtualShare` | `{ num: 1, den: 3 }` (so 2/3 must be non-virtual) | FR-013a |
| `teamEvents` | `team_training` `{ team: 1, training: 5 }`, `training_weekend_day` `{ team: 5, training: 10 }`, `technique_training` `{ team: 5, training: 5 }` | FR-007 (R18) |

FR-005g (flagged rides never count) is not a rule value and has no field here.
Version 1 stays in `RULES_HISTORY` with the same values, `teamEvents` included
(R18).

Validation: steps, limits and thresholds are positive integers; `minSpeedKmh <
maxSpeedKmh`; shares have `den > 0` and `0 ≤ num ≤ den`; dates are `YYYY-MM-DD`;
`teamEvents` has an entry for exactly the kinds in `TEAM_EVENT_KINDS`, each with
whole numbers ≥ 0. Invalid rules throw (a programming error).

## Code: `TEAM_EVENT_KINDS`

`team_training`, `training_weekend_day`, `technique_training`, in this order
(FR-006). Language-independent codes (FR-016); the order is the order of the
balance's breakdown. Equal to the rows of `team_event_kinds` (tested).

## Input: Counting Window

`{ seasonStart, deadline }`, both `YYYY-MM-DD`, inclusive; `seasonStart` from
`SEASON_START_DATE`, `deadline` from the rules (`null` = open).

## Input: Attendance (from `attendances` joined with `team_events`, Story 3)

All of the rider's attendances, not only the season's; `evaluateAttendance`
decides which count (R19).

| Field | Column | Notes |
|---|---|---|
| `eventId` | `attendances.event_id` | Unique per rider (primary key). |
| `kind` | `team_events.kind` | One of `TEAM_EVENT_KINDS`. |
| `date` | `team_events.event_date` | `YYYY-MM-DD`; inside the counting window or not counting. |

The event's name isn't an input: it changes no Rynke.

## Input: Extras

Training and Team Rynke from team events (Story 3) and corrections (Story 6)
that `tally()` adds to the riding totals, plus the per-kind breakdown
(`TeamEventSum[]`, one per kind) it copies into the balance. Story 3 fills them
from `evaluateAttendance`; corrections stay zero until Story 6.

## Table: `team_event_kinds` (Story 3, migration `0006`)

| Column | Type | Rule |
|---|---|---|
| `kind` | TEXT PK | Seeded with `TEAM_EVENT_KINDS`; a new kind is an `INSERT` in a later migration (R17). |

## Table: `team_events` (Team Event, FR-006)

| Column | Type | Rule |
|---|---|---|
| `event_id` | INTEGER PK | Assigned by SQLite. |
| `kind` | TEXT NOT NULL, FK `team_event_kinds` | Unknown kinds refused by the schema. |
| `event_date` | TEXT NOT NULL, `YYYY-MM-DD` (`GLOB` check) | One row per day of a training weekend. The `GLOB` admits impossible days (`2026-02-30`); the write functions refuse them (`invalid_date`), so only manual SQL can store one, and it compares as text like any other date. |
| `name` | TEXT NULL, 1–100 characters when set | Optional; no Rynke depend on it. |

Belongs to the team, not to a rider; not deleted with a rider.

## Table: `attendances` (Attendance, FR-007)

| Column | Type | Rule |
|---|---|---|
| `event_id` | INTEGER NOT NULL, FK `team_events` ON DELETE CASCADE | Deleting an event deletes its attendances (FR-006a). |
| `athlete_id` | INTEGER NOT NULL, FK `riders` ON DELETE CASCADE | Indexed (`attendances_by_rider`); deleted with the rider. |

Primary key `(event_id, athlete_id)`: at most one attendance per rider and event
(FR-007, Story 3 scenario 4). Added only for connected riders by the write
functions (FR-006a); kept when a rider later needs to reconnect.

## Table: `ride_results` (Ride Result, FR-014)

| Column | Type | Rule |
|---|---|---|
| `strava_activity_id` | INTEGER PK, FK `activities` ON DELETE CASCADE | One result per activity. |
| `athlete_id` | INTEGER NOT NULL, FK `riders` ON DELETE CASCADE | Indexed (`ride_results_by_rider`). |
| `counts` | INTEGER 0/1 | 1 exactly when `reasons` is `[]`. |
| `reasons` | TEXT, `json_valid`, JSON array of reason codes | Contract order; `["overlap"]` alone or none of it. |
| `overlaps_activity_id` | INTEGER NULL | Set exactly when `reasons = ["overlap"]`. No FK: it is rewritten in the same batch as the ride it names. |
| `distance_rynke` | INTEGER ≥ 0 | 0 when not counting. |
| `elevation_dm` | INTEGER ≥ 0 | Decimetres added to the elevation total; 0 when not counting. |
| `is_virtual` | INTEGER 0/1 | FR-013a with FR-005f. |
| `unknown_figures` | TEXT, `json_valid`, JSON array of figure codes | `[]` normally. |
| `rules_version` | INTEGER ≥ 1 | FR-023 |
| `activity_refreshed_at` | INTEGER | The activity's `refreshed_at` the result was computed from. |

No elevation Rynke per ride (FR-014). No Strava field beyond feature 001's is
copied (FR-015).

## Table: `rynke_balances` (Rynke Balance, FR-014a)

| Column | Type | Rule |
|---|---|---|
| `athlete_id` | INTEGER PK, FK `riders` ON DELETE CASCADE | |
| `distance_rynke` | INTEGER ≥ 0 | Sum over counting rides. |
| `elevation_dm` | INTEGER ≥ 0 | Sum over counting rides. |
| `elevation_rynke` | INTEGER ≥ 0 | Floored once on the total (FR-004a). |
| `elevation_to_next_step_dm` | INTEGER > 0 | 1 … one full step (R12). |
| `training_rynke` | INTEGER ≥ 0 | Riding + extras, floored at 0. |
| `team_rynke` | INTEGER ≥ 0 | Extras only (FR-009): team events, later corrections. |
| `team_event_breakdown` | TEXT NOT NULL DEFAULT `'[]'`, `json_valid` (migration `0006`) | One `{ kind, attended, team, training }` per kind, `TEAM_EVENT_KINDS` order, also for 0 attended (R20). `'[]'` only on rows written before Story 3. |
| `training_missing`, `team_missing` | INTEGER ≥ 0 | To each threshold. |
| `training_without_virtual` | INTEGER ≥ 0 | FR-013a (R12). |
| `virtual_share_missing` | INTEGER ≥ 0 | To `ceil(threshold × (den − num) / den)` = 167 (research R3). |
| `qualified` | INTEGER 0/1 | 1 exactly when all three missing amounts are 0. |
| `rules_version` | INTEGER ≥ 1 | FR-023 |
| `rules_effective_date` | TEXT `YYYY-MM-DD` | Story 4 scenario 12. |
| `computed_at` | INTEGER | Epoch seconds of the last write that changed the row. |

Story 6 adds the correction sums, as additive columns.

## Invariants (tested)

- The balance's riding fields equal the sums over the rider's counting ride
  results; all of the rider's rows carry the same `rules_version` (FR-014b).
- The balance's `team_event_breakdown` entries equal the rider's attendances inside the
  counting window, counted per kind and multiplied by the amounts of its rules
  version; `team_rynke` equals their Team sum (until Story 6), and
  `training_rynke` the riding Training Rynke plus their Training sum.
- Attendance changes no ride result.
- Every activity of an evaluated rider has exactly one ride result; no result
  without its activity.
- No two counting rides of a rider overlap.
- A full evaluation of the stored state writes nothing (SC-002).
- The same activities in any order give the same rows (FR-002).

## State over time

A rider has no balance until their first evaluation (first activity write after
`0005`, or the first cron sweep). From then on every activity change rewrites the
affected rows in the same batch. Deleting the rider removes everything by
cascade, their attendances included.

A team event exists from its creation until an organiser deletes it. Adding or
removing an attendance, or changing an event's kind or date, rewrites the
affected riders' balances in the same batch (R21); entered by hand before the
organiser pages exist, it is picked up by the next sweep (R22). After `0006`,
rows keep version 1 and `team_event_breakdown = '[]'` until the version-2 sweep
re-evaluates every rider (R18).
