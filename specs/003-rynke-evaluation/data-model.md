# Data Model: Rynke Evaluation — Stories 1, 2 and 4

Story 2 works in memory; Story 4 stores its output in two new tables
(migration `0003_rynke_results.sql`). Team events, attendance and corrections
(Stories 3 and 6) and stored rules (Story 5) come later, each in its own additive
migration. Function signatures and codes:
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
| `refreshedAt` | `refreshed_at` | Copied into the ride result to detect stale results (R14). |

## Input: Rynke Rules (`CURRENT_RULES`, code constant until Story 5)

| Field | Value | Rule |
|---|---|---|
| `version` | 1 | FR-023; raised with every change of values or logic (R8). |
| `effectiveDate` | the date version 1 ships | FR-023 |
| `distanceStepKm`, `distanceStepRynke` | 10, 1 | FR-004 |
| `elevationStepM`, `elevationStepRynke` | 1000, 5 | FR-004a |
| `maxPausedShare` | `{ num: 1, den: 2 }` | FR-005a |
| `minSpeedKmh`, `maxSpeedKmh` | 10, 45 | FR-005c |
| `maxClimbMPerH` | 1500 | FR-005c |
| `excludedSportTypes` | `EBikeRide`, `EMountainBikeRide` | FR-005e |
| `qualificationDeadline` | `null` | FR-011 |
| `trainingThreshold`, `teamThreshold` | 250, 25 | FR-013 |
| `maxVirtualShare` | `{ num: 1, den: 3 }` (so 2/3 must be non-virtual) | FR-013a |

Validation: steps, limits and thresholds are positive integers; `minSpeedKmh <
maxSpeedKmh`; shares have `den > 0` and `0 ≤ num ≤ den`; dates are `YYYY-MM-DD`.
Invalid rules throw (a programming error).

## Input: Counting Window

`{ seasonStart, deadline }`, both `YYYY-MM-DD`, inclusive; `seasonStart` from
`SEASON_START_DATE`, `deadline` from the rules (`null` = open).

## Input: Extras (empty until Stories 3 and 6)

Training and Team Rynke from team events and corrections that `tally()` adds to
the riding totals. Stories 2 and 4 always pass zero.

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
| `team_rynke` | INTEGER ≥ 0 | Extras only (FR-009); 0 until Story 3. |
| `training_missing`, `team_missing` | INTEGER ≥ 0 | To each threshold. |
| `training_without_virtual` | INTEGER ≥ 0 | FR-013a (R12). |
| `virtual_share_missing` | INTEGER ≥ 0 | To `ceil(threshold × (den − num) / den)` = 167 (research R3). |
| `qualified` | INTEGER 0/1 | 1 exactly when all three missing amounts are 0. |
| `rules_version` | INTEGER ≥ 1 | FR-023 |
| `rules_effective_date` | TEXT `YYYY-MM-DD` | Story 4 scenario 12. |
| `computed_at` | INTEGER | Epoch seconds of the last write that changed the row. |

Story 3 adds the per-kind team-event breakdown and Story 6 the correction sums,
as additive columns or a child table.

## Invariants (tested)

- The balance's riding fields equal the sums over the rider's counting ride
  results; all of the rider's rows carry the same `rules_version` (FR-014b).
- Every activity of an evaluated rider has exactly one ride result; no result
  without its activity.
- No two counting rides of a rider overlap.
- A full evaluation of the stored state writes nothing (SC-002).
- The same activities in any order give the same rows (FR-002).

## State over time

A rider has no balance until their first evaluation (first activity write after
`0003`, or the first cron sweep). From then on every activity change rewrites the
affected rows in the same batch. Deleting the rider removes everything by
cascade.
