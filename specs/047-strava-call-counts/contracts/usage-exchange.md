# Contract: Usage Exchange Additions

Extends feature 026 [usage-exchange.md](../../026-second-team/contracts/usage-exchange.md).
FR-007.

## Export (`GET /admin/usage/export?since=…`)

Unchanged except for three more allowances in `days`, per UTC day from the later of
`since` and the 30-day window's first day, and no earlier than this team's first
counted day:

| `allowance` | `count` |
|---|---|
| `strava_calls` | this team's answered calls that day (all actions) |
| `strava_held_back` | this team's held-back calls that day |
| `strava_seen` | the highest daily total Strava reported to this team that day; 0 when none |

Days in that range without calls carry 0. Today's values are live. Nothing by
action or endpoint is exported, and never a rider identifier.

## Parsing

- The three names are accepted like the existing ones.
- An entry with an allowance the parser doesn't know is **skipped**, not a reason
  to reject the export (it was rejected before). Malformed `day` or `count` still
  rejects the export.
- The 1,500-entry cap stays: 13 months × 3 existing + 30 days × 3 new fit.

## Pull and storage

As today: upserts into `usage_team_daily` per `(day, allowance, team)`, catch-up
from the newest stored day.

## Mixed releases

Every team deploys from the same `main` commit in one run, so releases differ only
for minutes. In that gap:

- a peer still on the previous release rejects this team's export (it doesn't know
  the new names), records the pull as failed and catches the days up at its next
  hourly pull after its own deploy;
- this team's pull of a peer on the previous release finds no new entries, so that
  peer's days show as missing until it is updated.

