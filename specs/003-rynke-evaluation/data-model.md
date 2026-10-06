# Data Model: Rynke Evaluation — Stories 1 and 2

Stories 1 and 2 add **no table, column or migration**. The evaluation reads
feature 001's `activities` table and returns values in memory; Story 4 stores them
(Ride Result, Rynke Balance) and Story 3 adds Team Event and Attendance. The
in-memory shapes below are what Story 4 will persist, so their fields follow
FR-014 and FR-014a.

Function signatures and reason codes: [contracts/ride-evaluation.md](contracts/ride-evaluation.md).

## Input: Ride (from `activities`, feature 001)

One row per stored cycling activity of the rider. Read by
`listRiderActivities(db, athleteId)`; all activities of the rider, not only the
season's, so that rides outside the window get a result too.

| Field | Column | Notes |
|---|---|---|
| `activityId` | `strava_activity_id` | Unique; last tie-breaker for overlaps (R5). |
| `sportType` | `sport_type` | One of feature 001's six cycling types. |
| `startUtc` | `start_date` | ISO UTC; start of the overlap interval (R5). |
| `startLocal` | `start_date_local` | Local wall-clock time; its date places the ride in the window (R4). |
| `distanceM` | `distance_m` | ≥ 0. |
| `movingS` | `moving_time_s` | ≥ 0. |
| `elapsedS` | `elapsed_time_s` | `null` = unknown (R6). |
| `elevationM` | `elevation_gain_m` | ≥ 0. |
| `manual` | `is_manual` | `null` = unknown (R6). |
| `trainer` | `is_trainer` | `null` = unknown (R6). |

Not read: `athlete_id` (the loader filters by it), `timezone`, `is_private`,
`refreshed_at`.

## Input: Ride Rules (`RideRules`, code constant for now)

The riding part of FR-012's rule values (R8). Defaults in `DEFAULT_RIDE_RULES`.

| Field | Default | Rule |
|---|---|---|
| `distanceStepKm`, `distanceStepRynke` | 10, 1 | FR-004 |
| `elevationStepM`, `elevationStepRynke` | 1000, 5 | FR-004a |
| `maxPausedShare` | `{ num: 1, den: 2 }` | FR-005a |
| `minSpeedKmh`, `maxSpeedKmh` | 10, 45 | FR-005c |
| `maxClimbMPerH` | 1500 | FR-005c |
| `excludedSportTypes` | `EBikeRide`, `EMountainBikeRide` | FR-005e |
| `qualificationDeadline` | `null` (no upper bound) | FR-011 |

Validation: steps and limits are positive integers, `minSpeedKmh <
maxSpeedKmh`, shares have `0 ≤ num ≤ den`, `den > 0`, and the deadline (if set)
is a `YYYY-MM-DD` date on or after the season start. Invalid rules are a
programming error and throw.

## Input: Counting Window

`{ seasonStart: "YYYY-MM-DD", deadline: "YYYY-MM-DD" | null }`, inclusive on
both ends, compared with the date part of `startLocal` (R4). `seasonStart` comes
from `SEASON_START_DATE` (feature 001 Team Settings); `deadline` from the rules.

## Output: Ride Result (one per input ride)

| Field | Type | Notes |
|---|---|---|
| `activityId` | integer | |
| `counts` | boolean | `true` exactly when `reasons` is empty. |
| `reasons` | reason codes | Every reason that applies, in the contract's fixed order; `overlap` only for rides that pass every other rule (FR-014). |
| `overlapsActivityId` | integer or `null` | Set exactly when `reasons` is `["overlap"]`: the counting ride it overlaps (first in counting order, R5). |
| `distanceRynke` | integer ≥ 0 | FR-004; 0 when the ride doesn't count. |
| `elevationDm` | integer ≥ 0 | Metres added to the elevation total, in decimetres (R3); 0 when the ride doesn't count. |
| `virtual` | boolean or `null` | `VirtualRide` or trainer flag set (FR-013a); `null` only when the trainer flag is unknown for a non-`VirtualRide`. |

No elevation Rynke per ride (FR-014). The rules version is added by Story 4/5.

## Output: Riding Totals

The riding part of the season tally (FR-014a), computed from the counting ride
results.

| Field | Rule |
|---|---|
| `distanceRynke` | Sum of counting rides' `distanceRynke`. |
| `elevationDm` | Sum of counting rides' `elevationDm`. |
| `elevationRynke` | `floor(elevationDm / (elevationStepM × 10)) × elevationStepRynke`, once on the total. |
| `elevationToNextStepDm` | Decimetres still missing for the next step; between 1 and one full step. |
| `trainingRynke` | `distanceRynke + elevationRynke`. |
| `withoutVirtual` | The same five fields over counting rides whose `virtual` is `false` (FR-013a: overlaps decided with all rides, then virtual rides left out, then the elevation total floored again). |

Invariants (checked by tests): totals equal the sums over the ride results; every
ride result has `counts = (reasons is empty)`; non-counting rides have
`distanceRynke = elevationDm = 0`; no two counting rides overlap; the output is
identical for any order of the input rides.
