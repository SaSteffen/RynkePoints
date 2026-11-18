# Contract: Season, window and pre-window rides

Amends feature 003 (ride evaluation), feature 026 (team data) and feature 039 (badge list).

## Team data

- Every team block names `SEASON_START_DATE` (a 1 September), `QUALIFICATION_START_DATE` and
  `QUALIFICATION_DEADLINE`, with season start ≤ window start ≤ deadline ≤ season end.
  `team-check` fails otherwise.

## Evaluation

- `before_window`: ride date ≥ season start and < window start. Exactly one of `before_window` /
  `outside_window` can apply to a date.
- A result with reasons exactly `["before_window"]` is a pre-window ride: no Rynke, real
  `elevation_dm`, takes part in overlap resolution.
- Hamburg (window start = season start) never produces `before_window`.

## Who reads what

- `counts = 1` only: balances, Rynke, gauges, rankings, pace, plan, progress and organiser graphs,
  ride figures, team totals.
- `counts = 1` **or** pre-window (`BADGE_RIDE`): personal and team badges about rides, up to the
  deadline. Training Rynke badges read balances.
- Fetch epoch, season end, rollover, album, tour days, badge list: season start.

## Pages

| Where | Pre-window ride |
|---|---|
| Rides page, You page recent rides, organiser rider rides | orange chip "zählt noch nicht", "–" Rynke and elevation, open "Warum?" with `rynke.reason.before_window` |
| Status box before window start | `rynke.deadline.notStarted` with the window start, no countdown or plan |
| Every graph, total, ranking | absent |

## Messages (all ten catalogs, German first)

| Key | de |
|---|---|
| `rynke.ride.notYet` (new) | zählt noch nicht |
| `rynke.reason.before_window` (new) | Die Qualifikation beginnt am {date}. Ab dann zählen Fahrten wie diese. |
| `rynke.deadline.notStarted` (changed) | Die Qualifikation beginnt am {date}. Bis dahin zählen deine Fahrten noch nicht für die Qualifikation, Badges sammelst du aber schon jetzt. 🏅 |
