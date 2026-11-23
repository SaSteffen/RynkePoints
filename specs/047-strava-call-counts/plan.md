# Implementation Plan: Strava Call Counts

**Branch**: `047-strava-call-counts` | **Date**: 2026-11-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/047-strava-call-counts/spec.md`

## Summary

Count every Strava call each team's app makes, per UTC day, by action and
endpoint, plus the calls the budget held back, and show them in a new day table on
Admin › Nutzung next to the other teams' totals and Strava's own count. The action
travels on the context, set once where work starts (queue message, OAuth callback,
leaving, removing, the daily withdrawal retry); `stravaFetch` and the budget checks
count under it, and a call without one counts as unassigned. Two small tables hold
the counts for 30 days; the existing usage exchange carries only day totals to the
other teams. Details in [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript on Cloudflare Workers

**Primary Dependencies**: none new

**Storage**: D1, one migration adding `strava_calls_daily` and `strava_seen_daily`
([data-model.md](data-model.md)); `usage_team_daily` gains three allowance values
without a migration

**Testing**: Vitest in the Workers runtime (`@cloudflare/vitest-plugin`), Strava
mocked

**Target Platform**: every team's app Worker; the gateway is untouched

**Project Type**: web service (server-rendered admin page)

**Performance Goals**: counting adds one D1 batch per Strava call and never delays
its result

**Constraints**: no extra Strava calls (Principle II); counts only, no IDs
(Principle I); D1 writes stay in the free allowance (at most about 12,000 rows a
day at Strava's 6,000-call day limit); the export stays under its 1,500-entry cap

**Scale/Scope**: 9 actions × 5 endpoints × 30 days per team; 2–3 teams

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|---|---|---|
| I. Privacy and consent | Counts per day, action and endpoint only; no rider or activity ID stored, exported or logged; admin-only. No new Strava data or scope, nothing shown to other riders: no consent revision, privacy notice unchanged. | Pass |
| II. Strava API citizenship | No new Strava request; counting happens after or instead of a call and never changes when calls are made or held back. | Pass |
| III. Rider content wins | Nothing written to Strava or to a rider's data. | Pass |
| IV. Serverless, minimal deps | D1 tables and the existing exchange; no dependency; free tier kept (R10). | Pass |
| V. Test-first | Each story starts with failing tests ([quickstart.md](quickstart.md)). | Pass |
| Language | New admin text in all ten catalogs, German the key source; code and docs English. | Pass |
| Teams | No branch per team; no other team's name in the view (feature 026 FR-023); `src/` doesn't import `gateway/`. | Pass |

Re-check after Phase 1: unchanged, all pass. The migration only adds tables, so
the previous release keeps working.

## Project Structure

### Documentation (this feature)

```text
specs/047-strava-call-counts/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── counting.md
│   ├── usage-exchange.md
│   └── usage-view.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
migrations/
└── 00NN_strava_calls.sql       # next free number (data-model.md)

src/
├── ctx.ts                      # Ctx.stravaAction
├── strava/
│   ├── calls.ts                # StravaAction, StravaEndpoint, actionOf, countCall, countHeldBack
│   ├── result.ts               # stravaFetch counts; StravaCtx picks stravaAction
│   ├── client.ts               # apiGet counts held back
│   ├── tokens.ts               # postToken / revokeToken count held back
│   └── withdraw.ts             # WithdrawCtx picks stravaAction
├── db/
│   └── strava-calls.ts         # upserts, day reads, export reads, prune
├── work/
│   ├── consumer.ts             # sets the action per message
│   ├── drain.ts                # sets the action per item
│   ├── recheck-rider.ts        # stand-back counts held back
│   └── scheduled.ts            # settleWithdrawals as leave; pruneUsage prunes
├── http/
│   ├── auth.ts                 # connect
│   ├── me.ts                   # leave
│   └── admin/
│       ├── remove.ts           # leave
│       └── usage.ts            # the section, the breakdown, the summary count
├── usage/
│   └── peers.ts                # export and parse the three new allowances
└── i18n/messages/*.ts          # admin.calls.* in ten languages

test/
├── unit/strava-calls.test.ts
└── integration/
    ├── strava-calls-counting.test.ts
    ├── usage-exchange-calls.test.ts
    └── admin-usage-calls.test.ts
```

**Structure Decision**: the existing single-Worker layout. Counting lives in the
Strava layer that every call already passes through; storage in `src/db/`; the
view in the existing usage page.

## Complexity Tracking

No violations.
