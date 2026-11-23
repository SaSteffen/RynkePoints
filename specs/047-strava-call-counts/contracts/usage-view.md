# Contract: Usage View — Strava Calls

FR-008 to FR-015. A new section on Admin › Nutzung, after the ride re-check's,
`<section class="card usage-source" id="strava-calls">`. Same access as the view.

## Day table

One row per UTC day, newest first, at most 30 (today included). Columns:

| Column | Value |
|---|---|
| Day | date, linked to `?calls=<day>#strava-calls`; the mark after it |
| This team | calls |
| Another team | peers' calls together; "fehlt" (missing) when a peer's day is missing; empty without peers or before a peer's first day |
| All teams | sum, empty when something is missing |
| Strava | Strava's count (highest any team saw); empty when unknown |
| Held back | this team's held-back calls |

Without any counted day: a short line saying nothing was counted yet, as the
re-check section does.

## Mark

`<span class="usage-mark usage-mark-warning">Warnung</span>` after the date, on a
finished day by [data-model.md](../data-model.md) › Derived. Today is never marked.
The summary at the top counts marked days next to the figures that aren't ok.

## Breakdown

Below the day table, for the day picked by `?calls=` (today when absent or not one
of the shown days): a table with one row per action that has a count, columns per
endpoint that has a count, then held back and the row's total. Action and endpoint
names come from the catalogs. Other teams' breakdown is never shown.

## Text

New keys under `admin.calls.*` in all ten catalogs, German as the key source:
heading, intro line, column heads, "missing", "none yet", the breakdown's heading,
and one name per action and endpoint. No other team's name (feature 026 FR-023).
