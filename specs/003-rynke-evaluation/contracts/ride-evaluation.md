# Contract: Rynke evaluation and stored results (internal)

What `src/rynke/`, `src/db/rynke.ts` and `src/db/team-events.ts` offer to the
rest of the app. Story 5, the organiser-admin feature (calls the team-event
changes), the rider-view feature (reads and translates codes) and a later
description-writing feature rely on it. Fields: [data-model.md](../data-model.md).

## Functions

| Function | Pure | Does |
|---|---|---|
| `evaluateRides(rides, rules, window)` | yes | `{ results, riding }`: one ride result per input ride, ascending `activityId`, and the riding totals (with and without virtual rides). No I/O, clock or randomness. |
| `evaluateAttendance(attendance, rules, window)` | yes | `{ byKind, team, training }`: one `TeamEventSum` `{ kind, attended, team, training }` per kind in `TEAM_EVENT_KINDS` order, counting each event inside the window once, and their sums (research R19). No I/O, clock or randomness. |
| `tally(riding, extras, rules)` | yes | The balance fields of FR-014a (without `computed_at`); `extras` carries the team-event sums and breakdown (and Story 6's corrections). |
| `applyAndEvaluate(db, athleteId, change, rules, window, now)` | no | Reads the rider's activities, attendances, ride results and balance in one batch; applies `change` in memory; evaluates; writes the activity statements of `change`, the changed ride results and the balance (if changed) in one batch (research R11, R13, R21). |
| `applyTeamEventChange(db, change, rules, window, now)` | no | Applies a team-event change and re-evaluates every affected rider; the change and all their changed rows go in one batch. Returns `{ eventId, affected }` (`eventId` only for `create-event`) (research R21). |
| `teamEventChange(ctx, change)` | no | For callers outside the queue consumer (organiser pages): `applyTeamEventChange` under `CURRENT_RULES`, then one `evaluate-rider` per affected rider (research R21). |
| `readRynke(db, athleteId)` | no (reads) | `{ balance, results }` from one batch, so both come from the same snapshot (FR-014b); `balance` is `null` before the first evaluation. Never evaluates. |
| `listRiderAttendanceStatement(db, athleteId)` | no (reads) | The rider's attendances with event ID, kind, date and name, newest first; the evaluation's input and, in its batch, the rider view's event list (feature 005 FR-033). |
| `listRidersNeedingEvaluation(db, rulesVersion, window)` | no (reads) | Connected riders the cron sweep sends `evaluate-rider` for (research R14, R22). |

`change` is one of:

- `{ kind: "none" }`
- `{ kind: "upsert", records: ActivityRecord[] }`
- `{ kind: "delete", activityIds: number[] }`
- `{ kind: "delete-private" }`

A team-event `change` is one of:

| Change | Affected riders | Refused when |
|---|---|---|
| `{ kind: "create-event", event: { kind, date, name } }` | none | kind unknown, date not a real `YYYY-MM-DD` day, name empty or over 100 characters |
| `{ kind: "update-event", eventId, event: { kind, date, name } }` | every attendee, unless only the name changed | event missing; as above |
| `{ kind: "delete-event", eventId }` | every attendee | event missing |
| `{ kind: "add-attendance", eventId, athleteIds }` | listed riders not yet attending | event missing; a listed rider isn't connected (nothing is written) |
| `{ kind: "remove-attendance", eventId, athleteIds }` | listed riders attending | event missing |

Refusals throw `TeamEventRefused` with one of these codes and write nothing;
the organiser pages translate the code into a message:

| Code | Refused when |
|---|---|
| `unknown_kind` | The kind is not in `TEAM_EVENT_KINDS`. |
| `invalid_date` | The date is not `YYYY-MM-DD` or not a real calendar day (`2026-02-30`). |
| `invalid_name` | The name is empty or over 100 characters. |
| `event_missing` | No event has `eventId`. |
| `rider_not_connected` | A listed rider is unknown or not connected. |

Adding a code is a contract change: the organiser-admin feature must translate
it. Adding a rider who already attends, or removing one who doesn't,
changes nothing (Story 3 scenario 4).

Guarantees:

- `evaluateRides`, `evaluateAttendance` and `tally` give the same output for the
  same inputs, whatever the order of rides or attendances (FR-002).
- After `applyAndEvaluate` or `applyTeamEventChange`, the stored rows of every
  affected rider equal a full evaluation of their stored activities and
  attendances under `rules`; running `applyAndEvaluate` again with `none` writes
  nothing.
- Attendance never changes a ride result; rides never change Team Rynke (FR-008,
  FR-009).
- No function here calls Strava.

## Team-event kind codes

Language-independent (FR-016); stored in `team_events.kind` and the balance's
`team_event_breakdown` breakdown, translated by the rider-view feature (its FR-062).

| Code | Spec name | Amounts (rules version 2) |
|---|---|---|
| `team_training` | team training | 1 Team, 5 Training |
| `training_weekend_day` | one day of a training weekend | 5 Team, 10 Training |
| `technique_training` | technique training | 5 Team, 5 Training |

Adding a kind is a contract change: a migration row in `team_event_kinds`, an
entry in `TEAM_EVENT_KINDS` and in the rules (a new rules version), and a text in
every catalog of the rider-view feature.

## Reason codes

Language-independent (FR-016); wording belongs to the rider-view feature. A ride
result lists every code that applies, in this order:

| Code | Rule | Applies when |
|---|---|---|
| `outside_window` | FR-011 | The date of `startLocal` is before the season start or after the deadline. |
| `excluded_sport_type` | FR-005e | `sportType` is in `excludedSportTypes`. |
| `flagged` | FR-005g | `flagged` is `true` (not when unknown). Under every rule version. |
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
| `flagged` | `is_flagged` | No flagged check. |

Adding a code of either kind is a contract change: the rider-view feature must
translate it in every catalog.
