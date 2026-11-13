# Implementation Plan: Ride Edit Re-check

**Branch**: `036-ride-edit-recheck` | **Date**: 2026-11-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/036-ride-edit-recheck/spec.md`

## Summary

Strava reports no event for a crop, so a fixed ride stays "zählt nicht". The hourly cron, which
today only records usage, also chooses a few riders and sends one `recheck-rider` queue message
each, spread over the hour. The consumer reads the rider's newest 200 activities in one request,
compares them with the stored ones and passes only the differences to the existing
evaluate-and-notify path. How many riders a run takes follows from the team's allowance (150 a day
each for Hamburg and Europe) and the number of active riders, those with an activity in the past
30 days; nobody else is checked. Riders with a recent ride that a crop could rescue go first. The check stands back when half of the day's Strava reads are used, when the
15-minute budget is short, or when imports or events are waiting, and is never retried. The ride
card stops asking for a new title; the administrators' usage view shows the checks per day.

## Technical Context

**Language/Version**: TypeScript (Cloudflare Workers)

**Primary Dependencies**: none new

**Storage**: D1: one new column (`riders.rechecked_at`), one new table (`recheck_daily`),
migration `0028_ride_recheck.sql`, additions only

**Testing**: Vitest in the Workers runtime (`pnpm test`), fake Strava for the by-hand check

**Target Platform**: Cloudflare Workers free plan, Hamburg's and Europe's deployments; the existing
hourly cron and work queue

**Project Type**: server-rendered web app with queue consumer

**Performance Goals**: an edit arrives within 24 hours for every active rider, within about 2 hours for the
fast lane at today's team sizes

**Constraints**: 50 subrequests per invocation (one check per invocation, research R1); 300 Strava
reads a day for all teams' checks in normal operation; 10,000 queue operations a day for the
account (3 per check); D1 rows written: one per check plus one per run when nothing changed

**Scale/Scope**: about 100 riders across two teams today, fewer of them active; correct up to 999

## Constitution Check

| Principle | Check | Result |
|---|---|---|
| I. Privacy and consent | Reads the same activity list as the import, under the same scope rule; stores no new figure; `recheck_daily` holds counts only; nothing new shown to riders (FR-025) | Pass |
| II. Strava API | Polling is the named exception since 2.7.0: one list request per check, no further pages or single fetches, 10% of daily reads for all teams, once a day per rider beyond that, spread over the hour, stands back on a short budget. Handler is idempotent; webhooks unchanged | Pass |
| III. Rider-authored content | Nothing written to Strava | Pass |
| IV. Serverless, minimal deps | Existing cron, queue and D1; no dependency, no new resource, no new cron | Pass |
| V. Test-first | Pure functions (run size, order, delay, difference) and the handler's contract tests are written red first (tasks) | Pass |
| Language | One new rider-facing line in all ten catalogs, German first; usage view labels as that view does; code and docs English | Pass |
| Team data (feature 026) | The allowance is team data, checked to sum to at most 300; no branch on a team in code; each team checks only its own riders | Pass |
| Free plan | One check per invocation; rows written and queue operations bounded and shown in the usage view (research R1, R9) | Pass |

Re-checked after Phase 1 design: still passes; no complexity to justify.

Two corrections to the spec came out of the design and are made with this plan:

- FR-019 and SC-005: one row per check **plus one per run** (the run's own count, research R9).
- SC-004 and the assumption on the split: a team stays inside its allowance up to about **140**
  riders, not 150, because a rider is taken one run early to keep the 24 hours (research R4).

## Project Structure

### Documentation (this feature)

```text
specs/036-ride-edit-recheck/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── hourly-run.md
│   ├── queue-message.md
│   ├── usage-view.md
│   └── ride-card.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
migrations/
└── 0028_ride_recheck.sql        # riders.rechecked_at, recheck_daily

src/
├── recheck/
│   ├── pace.ts                  # new, pure: baseChecks, runSize, chooseRiders, spreadDelay
│   └── diff.ts                  # new, pure: which listed records are new or differ; keeps stored figures the list lacks
├── work/
│   ├── recheck-run.ts           # new: the hourly run (hold, read, size, order, stamp, send)
│   ├── recheck-rider.ts         # new: the handler (gates, one request, order, compare, evaluate)
│   ├── activity-page.ts         # extract the list-to-records conversion and scope rule for both users
│   ├── messages.ts              # + RecheckRiderMessage, parse, serialize
│   └── scheduled.ts             # hourly cron: recordUsage, then the run; daily cron: prune recheck_daily
├── strava/
│   ├── client.ts                # + listNewestActivities (no `after`)
│   └── rate-limit.ts            # + halfDayUsed(state, now)
├── db/
│   ├── recheck.ts               # new: candidates query (active riders, fast-lane flag), stamp, put back, daily counts
│   └── riders.ts                # Rider gains recheckedAt
├── rynke/rides.ts               # + FIXABLE_REASONS beside the reason codes
├── teams/types.ts, hamburg.ts, europe.ts   # recheckAllowance: 150
├── usage/allowances.ts          # + RECHECK_SHARE (10%)
├── http/admin/usage.ts          # + the "Ride re-check" section
├── http/…ride card              # wait step replaces the rename step
└── i18n/messages/*.ts           # + rynke.ride.fix.wait_recheck, − rynke.ride.fix.rename (ten catalogs)

dev/
├── fake-strava/api.ts           # list without `after`: newest first
├── fake-strava/store.ts         # change a sample ride without an event
└── worker.ts                    # POST /_dev/recheck, "change without event" on a rider's page

scripts/team-check.mjs           # allowances sum to at most 300

test/
├── unit/recheck-pace.test.ts    # sizes over a day, order, half for the fast lane, repeated run, delays
├── unit/recheck-diff.test.ts    # changed, new, moved kind, missing figure, missing activity
├── unit/fixable-reasons.test.ts # every reason code is sorted
├── integration/recheck-rider.test.ts   # contracts/queue-message.md "Guarantees to test"
├── integration/recheck-run.test.ts     # contracts/hourly-run.md, with D1 and the queue; paused riders left out
├── integration/admin-usage-recheck.test.ts
├── integration/d1-rows.test.ts  # + an unchanged check writes no row; a run writes one per check plus one
├── teams/recheck-allowance.test.ts
└── integration/all-locales.test.ts, ride card tests   # no title in any language
```

**Structure Decision**: The pure rules get their own folder, `src/recheck/`, so the pace can be
tested over whole simulated days without D1. The run and the handler sit in `src/work/` beside the
other scheduled work and handlers. Test file locations follow the neighbouring tests' folders.

## Delivery

1. The maintainer makes the one real request of the quickstart. Nothing is built before it
   confirms the list order.
2. One pull request into `develop`: migration, check, pace, usage section, ride card text. The
   text and the check ship together (US2: the promise needs the mechanism).
3. After the release: the live checks of the quickstart.
