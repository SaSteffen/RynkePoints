# Contract: Ride evaluation (internal module)

The interface `src/rynke/` offers to the rest of the app. Story 4 (storage and
queue wiring), the rider-view feature (translating reasons) and a later
description-writing feature rely on it. Field details:
[data-model.md](../data-model.md).

## Functions

| Function | Pure | Does |
|---|---|---|
| `evaluateRides(rides, rules, window)` | yes | Returns `{ results, totals }`: one ride result per input ride, in ascending `activityId` order, and the riding totals. No I/O, no clock, no randomness. |
| `evaluateRider(db, athleteId, seasonStart, rules = DEFAULT_RIDE_RULES)` | no (reads D1) | Loads the rider's activities with `listRiderActivities` and calls `evaluateRides`. Writes nothing; makes no Strava request. A rider without activities gets empty results and zero totals. |
| `listRiderActivities(db, athleteId)` | no (reads D1) | All of the rider's stored activities as `Ride` inputs, `NULL` figures as `null`. |

Guarantees (FR-002):

- Same inputs, same output, whatever the order of `rides`.
- The output depends only on the arguments.
- Calling it never changes stored data.

## Reason codes

Language-independent values (FR-016). Rider-facing wording is the rider-view
feature's job. A ride result lists every code that applies, in this order:

| Code | Rule | Applies when |
|---|---|---|
| `outside_window` | FR-011 | The date of `startLocal` is before the season start or after the deadline. |
| `excluded_sport_type` | FR-005e | `sportType` is in `excludedSportTypes`. |
| `manual` | FR-005b | `manual` is `true`. |
| `figures_unknown` | research R6 | A figure the evaluation needs is `null`. |
| `pause` | FR-005a | `(elapsedS − movingS) × den > movingS × num`. Not checked when `elapsedS` is unknown. |
| `too_slow` | FR-005c, R7 | Average speed below the minimum, or `movingS = 0`. |
| `too_fast` | FR-005c | Average speed above the maximum (`movingS > 0`). |
| `climbing_rate` | FR-005c | Climbing rate above the maximum (`movingS > 0`). |
| `overlap` | FR-005d | Passes every other rule but overlaps a larger counting ride; never combined with another code. |

All rules are checked independently, so a ride can carry several codes (e.g. a
manual 15 km entry over 2 h: `manual`, `too_slow`). Boundaries count: a ride
exactly at a limit or paused exactly the allowed share has no code for it.

Adding a code is a contract change: the rider-view feature must translate it in
every catalog.
