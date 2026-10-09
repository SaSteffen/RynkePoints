# Quickstart: Team Leaderboard and Organiser Overview

## 1. Automated checks

`pnpm test`, `pnpm lint` and `pnpm typecheck` must pass. Tests use synthetic riders
only, and each one is written first and fails before the code exists.

| Area | Test | Covers |
|---|---|---|
| Weeks | `weeks` unit: week ends from season start to today, a short first week, Sunday rides, the deadline as last day; accumulation with elevation floored on the running total, events and corrections on their dates, the floor at 0, the last point equal to the stored balance, a future-dated event in the current week. | FR-015, FR-017, R1, R3 |
| Pace | `pace` unit: even pace at start, midway (rounded down) and deadline; status `in`, `push` for each of Training, Team and outdoor Training behind, `on_track`; a passed deadline gives `push` or `in` only. | FR-021, FR-030, R4 |
| Leaderboard | `leaderboard` unit: order by kind, then other kind, then athlete ID; ties share a place and the next place skips; Rynke to pass the next place; 1st place; neighbourhood in the middle, at the top, at the bottom, with 7 rows (no toggle) and 8 rows; medals by place; rows carry no athlete ID. | FR-012, FR-013, FR-016, R6 |
| Quotes | `quotes` unit: both lists have at least 180 entries, no duplicates, no empty strings. | FR-022, R10 |
| Team page | `team-leaderboard` integration: 14 synthetic riders, viewer 6th; "6th of 14", the gap, rows 3–9 with "You 🦧"; `?all=1` shows 14; `?kind=team` reorders; a rider without consent is in no figure; no other rider's first name, athlete ID or Strava link in the HTML; the quote comes from the matching list for a push rider and an on-track rider and sits in `lang="de"` also with `rp_lang=en`; the Orga tab only for organisers. | US1–US3, FR-001, FR-004, FR-010–FR-024, SC-001, SC-002 |
| Overview | `organiser-overview` integration: access (visitor 302, rider 403); groups and counts before the deadline; "Not yet in" once it has passed; `?group=` filters; two riders named Jonas get Strava links; breakdown figures equal the stored balance; the qualified list. | US4, FR-002, FR-030–FR-035 |
| Read only | Both pages with a `DB` wrapper that fails on any non-`SELECT` statement and a `fetch` spy: no write, no Strava request. | FR-003, SC-003 |
| Copy | `no-hardcoded-copy` covers `/team` and `/organiser/riders` (add the overview to `RIDER_PAGES` or its organiser counterpart). | FR-042 |

## 2. Local walk-through (`pnpm dev`)

1. Run `pnpm dev`, open `http://localhost:8789` and sign in as a sample rider in
   the middle of the sample team.
2. Open Team: check the place card, the quote, the peloton, the neighbourhood,
   "Everyone" and the Team Rynke switch. Reload: the quote changes now and then.
3. Sign in as sample organiser "Olga Organiser", open Team → Team overview. The
   deadline (`QUALIFICATION_DEADLINE`, 30 June 2027) is running, so the groups
   are "Need a push", "On track" and "In for Paris".
4. At 360 px width and in dark mode, check there is no horizontal scrolling on
   either page (FR-040).

## 3. After release

The maintainer checks both pages once on the live site. There are no tasks for
this.
