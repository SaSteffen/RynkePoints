# Contract: Rynke evaluation and stored results (internal)

What `src/rynke/` and `src/db/rynke.ts` offer to the rest of the app. Story 3,
Story 5, the rider-view feature (reads and translates codes) and a later
description-writing feature rely on it. Fields: [data-model.md](../data-model.md).

## Functions

| Function | Pure | Does |
|---|---|---|
| `evaluateRides(rides, rules, window)` | yes | `{ results, riding }`: one ride result per input ride, ascending `activityId`, and the riding totals (with and without virtual rides). No I/O, clock or randomness. |
| `tally(riding, extras, rules)` | yes | The balance fields of FR-014a (without `computed_at`). |
| `applyAndEvaluate(db, athleteId, change, rules, window, now)` | no | Reads the rider's activities, ride results and balance in one batch; applies `change` in memory; evaluates; writes the activity statements of `change`, the changed ride results and the balance (if changed) in one batch (research R11, R13). |
| `readRynke(db, athleteId)` | no (reads) | `{ balance, results }` from one batch, so both come from the same snapshot (FR-014b); `balance` is `null` before the first evaluation. Never evaluates. |
| `listRidersNeedingEvaluation(db, rulesVersion)` | no (reads) | Connected riders the cron sweep sends `evaluate-rider` for (research R14). |

`change` is one of:

- `{ kind: "none" }`
- `{ kind: "upsert", records: ActivityRecord[] }`
- `{ kind: "delete", activityIds: number[] }`
- `{ kind: "delete-private" }`

Guarantees:

- `evaluateRides` and `tally` give the same output for the same inputs, whatever
  the order of rides (FR-002).
- After `applyAndEvaluate`, the stored rows equal a full evaluation of the stored
  activities under `rules`; running it again with `none` writes nothing.
- No function here calls Strava.

## Reason codes

Language-independent (FR-016); wording belongs to the rider-view feature. A ride
result lists every code that applies, in this order:

| Code | Rule | Applies when |
|---|---|---|
| `outside_window` | FR-011 | The date of `startLocal` is before the season start or after the deadline. |
| `excluded_sport_type` | FR-005e | `sportType` is in `excludedSportTypes`. |
| `manual` | FR-005b | `manual` is `true` (not when unknown). |
| `pause` | FR-005a | `movingS = 0`, or `(elapsedS − movingS) × den > movingS × num`. Not checked when `elapsedS` is unknown and `movingS > 0`. |
| `too_slow` | FR-005c | `movingS > 0` and average speed below the minimum. |
| `too_fast` | FR-005c | `movingS > 0` and average speed above the maximum. |
| `climbing_rate` | FR-005c | `movingS > 0` and climbing rate above the maximum. |
| `overlap` | FR-005d | Passes every other rule but overlaps a larger counting ride; never combined with another code. |

Rules are checked independently, so a ride can carry several codes (a manual
15 km entry over 2 h: `manual`, `too_slow`). A ride exactly at a limit, or paused
exactly the allowed share, gets no code for it.

## Unknown-figure codes (FR-005f)

| Code | Figure | Effect |
|---|---|---|
| `elapsed_time` | `elapsed_time_s` | No pause check (unless `movingS = 0`); overlap interval uses the moving time. |
| `manual` | `is_manual` | No manual check. |
| `trainer` | `is_trainer` | Virtual only if `sportType` is `VirtualRide`; not listed for `VirtualRide`. |

Adding a code of either kind is a contract change: the rider-view feature must
translate it in every catalog.
