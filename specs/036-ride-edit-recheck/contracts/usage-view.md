# Contract: the re-check in the usage view

Extends the administrators' usage view (feature 025). Same access, same page; a section below the
Strava figures. Texts follow the view's existing convention for its labels.

## Section "Ride re-check"

- One line: the team's allowance ("150 checks a day") and the riders it covers now.
- A table of the last 14 UTC days that have a row, newest first:

| Column | From `recheck_daily` |
|---|---|
| Day | `day` |
| Checks made | `sent − skipped − failed` |
| Stood back | `skipped`, plus "n runs held" when `runs_held > 0` |
| Failed | `failed`; "list order" named when `unordered > 0` |
| Waited over 24 h | `over_24h` |

- A day is marked like a warning figure when `over_24h > 0` or `unordered > 0`.
- No day yet: one line saying no check has run.
- No rider is named and no rider identifier is shown.

## Not part of it

- No alert or push (research R9).
- No exchange between teams: each team's view shows its own checks. The Strava reads the checks
  cost are already in the shared read figures.
