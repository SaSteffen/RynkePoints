# Implementation Plan: Admin View with Usage Statistics

**Branch**: `spec/admin-view-and-second-team` | **Date**: 2026-11-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/025-admin-usage-view/spec.md`

## Summary

An administrator flag on riders opens a new Admin tab with three pages: usage, history and
riders. It is built for one team. Per-team shares across teams are feature 026 (FR-039).

- **Strava usage**: extend the existing single `strava_rate_limit` row with this team's
  own counts and the day's peaks. They go in the `UPDATE` each response already causes,
  so counting adds no database writes (research R1).
- **Cloudflare usage**: a new hourly cron makes one analytics query and stores figures
  in `usage_daily`. The page only reads D1, never Strava or Cloudflare (R2, R3).
- **Alerts**: the same hourly run checks levels, and new rows in `usage_alerts` send the
  existing payload-free push to administrators. Each one can turn Cloudflare's alerts off
  for themselves (R5).
- **Removal**: revoke, then one atomic batch that adds the block entry and removal record
  and deletes the rider. The block is checked in the OAuth callback (R6, R7).
- **Consent**: version 2 covers the overview and the block list. Only riders who agreed
  to it get a row, using the existing `sharedRiderIdsSince` filter (R8).

## Technical Context

**Language/Version**: TypeScript on Cloudflare Workers

**Primary Dependencies**: None new (Principle IV)

**Storage**: D1, with forward-only migration `0021`

**Testing**: Vitest in the Workers runtime; Playwright smoke tests in fake mode

**Target Platform**: Cloudflare Workers, Free plan

**Project Type**: Server-rendered web app

**Performance Goals**: Recording and viewing use under 1 % of any daily allowance (SC-006).
Estimate at full use: 312 rows written and about 24,000 rows read a day (R4).

**Constraints**: Viewing makes no Strava request (FR-027). No rider identifiers in usage
data (FR-017). Cloudflare's token is read-only (FR-029). Tests call neither service.

**Scale/Scope**: One team now; capacity 999 riders; 8 recorded allowances; 13 months of days.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | How |
|---|---|---|
| I. Privacy and consent | **Needs amendment** | The block list keeps an athlete ID after deletion, which needs an explicit exception (see Complexity Tracking and R9). New consent version for what administrators see. Usage data holds no rider identifiers. |
| II. Strava citizenship | Pass | No polling: viewing and recording make no Strava calls. Removal and refusal only revoke. Recording and alerts are idempotent. |
| III. Rider content | Pass | Activity descriptions aren't touched. |
| IV. Serverless, minimal | Pass | No dependency. Within free limits. One more cron trigger. |
| V. Test-first | Pass | Pure logic and routes get failing tests first. Cloudflare and Strava are stubbed. |
| Language | Pass | All text in the catalogs, German and English. |
| Workflow | Pass | The token, the flag and the deployment of the secret are manual steps. |

**Re-check after design**: unchanged. The amendment is the first implementation task, so
the exception exists before any code keeps an ID.

## Project Structure

### Documentation (this feature)

```text
specs/025-admin-usage-view/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── http-routes.md
│   ├── cloudflare-analytics.md
│   └── alerts.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
migrations/0021_admin_usage.sql       # flag, counters, usage_daily, usage_alerts, block list, removal log
src/usage/allowances.ts               # new: the allowance list, Cloudflare limits, levels (pure)
src/usage/figures.ts                  # new: figures, percentages, not attributed, drain estimate (pure)
src/usage/cloudflare.ts               # new: analytics query and parsing
src/usage/record.ts                   # new: hourly recording
src/usage/alerts.ts                   # new: level check and sending
src/db/usage.ts                       # new
src/db/blocked.ts                     # new: block list and removal
src/db/rate-limit.ts                  # own counts and peaks
src/strava/result.ts                  # passes read or not to the recording
src/http/admin/                       # new: access, usage, history, riders, remove
src/http/auth.ts                      # block check in the callback
src/http/pwa.ts                       # alert text for the notification
src/http/router.ts, shell.ts          # routes, Admin tab
src/http/notice.ts                    # `blocked` notice
src/consent.ts                        # version 2
src/i18n/messages/{de,en}.ts          # text, including `landing.leave` and `consent.*`
src/work/scheduled.ts                 # dispatch by cron
wrangler.jsonc                        # hourly cron, TEAM_ID
scripts/, e2e/strava-review.review.ts # review screenshots of the new pages
test/                                 # unit and integration tests
```

**Structure Decision**: The existing single Worker. Usage logic gets its own folder because
it is pure and feature 026 builds on it; the pages follow `src/http/organiser/`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Principle I: an athlete ID stays after a removal | The maintainer decided removed riders stay blocked, and the ID is the only way to recognise them when they connect again | Removing them from the Strava club doesn't work where the club can't be changed, and a hashed ID would still be a stable identifier, with more code |
