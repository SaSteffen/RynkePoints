# Implementation Plan: Strava Connection and Webhook Activity Intake

**Branch**: `001-strava-connect-webhook` | **Date**: 2026-10-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-strava-connect-webhook/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Members of the Strava club "TRHH Rynke Coins" connect through Strava sign-in. They
choose whether private activities are included, and membership is checked at
connect time and daily afterwards. From then on their cycling activities flow in
through Strava's webhook. A single Worker handles four things:

- **Rider pages and OAuth callback**: on connect it stores encrypted tokens and a
  minimal rider row in D1.
- **Webhook**: answers within milliseconds by putting identifier-only messages on a
  Cloudflare Queue.
- **Queue consumer** (serial): fetches the current activity state from Strava
  within an app-wide rate budget, and upserts an allow-listed set of fields.
  The past-season import, daily membership checks and deletions run through the
  same consumer.
- **Rider deletion**: deauthorization, leaving the club or pressing "disconnect"
  hard-deletes the rider, and that cascades to everything they own.

## Technical Context

**Language/Version**: TypeScript 7 (`tsc --noEmit`), ES2024 target, Cloudflare
Workers runtime (`compatibility_date` 2026-08-22, `nodejs_compat`)

**Primary Dependencies**: None at runtime. Web platform APIs only: `fetch`, Web
Crypto (AES-GCM, HMAC), `URL`. Dev: wrangler, vitest +
`@cloudflare/vitest-pool-workers`, Biome (all already installed).

**Storage**: Cloudflare D1, EU jurisdiction (research R11). Tables: `riders`,
`strava_credentials`, `activities`, `failed_work`, `strava_rate_limit`
([data-model.md](data-model.md)). Migrations live in `migrations/`.

**Testing**: Vitest in workerd via `@cloudflare/vitest-pool-workers`, against local
D1 and Queue bindings. Strava is faked by spying on global `fetch`, and any
unexpected host fails the test (R12).

**Target Platform**: Cloudflare Workers (fetch, queue and scheduled handlers),
Workers Free plan, plus Workers static assets for Strava brand images.

**Project Type**: Web service (server-rendered rider pages, webhook receiver, queue
consumer, cron)

**Performance Goals**:

- Webhook acknowledged in < 2 s, target < 100 ms (SC-003).
- A new activity is stored < 5 min after upload (SC-002).
- 500 past activities imported < 24 h (SC-008); in practice 3 requests.

**Constraints**:

- Strava budget: 100 reads per 15 min and 1,000 per day, app-wide. The usage
  headers are honoured with a safety margin (R6).
- Queues free tier: 10,000 operations/day, 24 h retention. Expected use is under
  500 operations/day; R7 covers retention.
- No inline Strava calls in the webhook path.
- No GPS or coordinates are stored.

**Scale/Scope**: ≤ 10 riders (Strava capacity), a few activities per rider per day,
five routes plus the webhook, one queue, one cron.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status |
|---|---|---|
| I. Privacy & consent | Opt-in scopes; private activities only if granted (R1). No `activity:write`. Nothing team-visible (FR-026). | ✅ |
| I. Minimisation | Allow-listed fields only; no GPS, polylines, coordinates or titles (data-model `activities`). | ✅ |
| I. Deletion | Hard delete with cascade on deauth, disconnect or leaving the club. Pending work can't recreate rows (FK + rider check). | ✅ |
| I. Secrets | Tokens AES-GCM encrypted (R10). Secrets only via `wrangler secret` / `.dev.vars`. Tests use synthetic bindings. | ✅ |
| I. EU storage | D1 `--jurisdiction=eu` (R11). Queue messages hold IDs only. | ✅ |
| I. Purpose & brand | Data used only for this app. Official Connect button and "Powered by Strava" (R13). | ✅ |
| II. Webhook ack + queue | The handler validates and enqueues only (contracts/http-routes.md). | ✅ |
| II. Idempotency | Upserts converge to Strava's current state; duplicates and reordering are safe (R5). | ✅ |
| II. Rate limits | Header-driven budget, 429 deferral, serial consumer; the import is paged at 200 per request (R6, R8). | ✅ |
| II. Capacity | Designed for ≤ 10 riders. "Team full" handled (R14). | ✅ |
| II. No polling | Activities are never polled. The daily club-membership check is a scheduled Strava lookup (≤ 20 requests/day); see Complexity Tracking. | ✅ justified |
| III. Rider content | No description edits in this feature. | ✅ n/a |
| IV. Serverless, minimal deps | Workers + D1 + Queues + cron; no new runtime dependency. | ✅ |
| IV. Free tier | Queues, cron and D1 are all within free limits (see Constraints). | ✅ |
| IV. Recomputable points | No points yet. Stored activity data is the input future rules will recompute from. | ✅ n/a |
| V. Test-first, Strava mocked | Red-green per task; fake Strava, local bindings only (R12). | ✅ |

**Post-design re-check (after Phase 1)**: still passing. The data model adds one
field beyond the spec's FR-013 list: `activities.is_private`. It is needed to
honour FR-007 (removing private activities when consent narrows), so it supports
Principle I rather than conflicting with it.

## Project Structure

### Documentation (this feature)

```text
specs/001-strava-connect-webhook/
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── http-routes.md
│   ├── queue-messages.md
│   └── strava-api-usage.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
migrations/
└── 0001_init.sql            # riders, strava_credentials, activities, failed_work, strava_rate_limit

public/                      # Strava brand assets (static assets binding)

src/
├── index.ts                 # fetch / queue / scheduled entry points
├── config.ts                # typed env access, cycling sport types, season start
├── http/
│   ├── router.ts            # path → handler
│   ├── html.ts              # escaping html`` template + page layout
│   ├── session.ts           # signed session + OAuth state cookies
│   ├── auth.ts              # GET /connect, GET /auth/callback
│   ├── me.ts                # GET /me, disconnect, logout
│   └── webhook.ts           # GET/POST /strava/webhook/:secret
├── strava/
│   ├── client.ts            # the endpoints in contracts/strava-api-usage.md
│   ├── tokens.ts            # refresh-before-use, rotation, revoke
│   ├── rate-limit.ts        # budget from headers, next-window calculation
│   └── activity.ts          # Strava response → allow-listed activity record
├── work/
│   ├── messages.ts          # queue message types + validation
│   ├── consumer.ts          # common rules (rider check, budget, retries, failed_work)
│   ├── activity-event.ts
│   ├── import-page.ts
│   ├── check-membership.ts
│   ├── delete-rider.ts
│   └── scheduled.ts         # daily membership fan-out + failed_work re-enqueue
├── db/
│   ├── riders.ts
│   ├── activities.ts
│   ├── failed-work.ts
│   └── rate-limit.ts
└── crypto/
    ├── encrypt.ts           # AES-256-GCM token encryption
    └── sign.ts              # HMAC sign/verify

test/
├── setup.ts                 # apply D1 migrations
├── support/
│   ├── fake-strava.ts       # fetch spy routing to synthetic Strava responses
│   └── fixtures.ts          # synthetic athletes/activities/clubs
├── unit/                    # rate-limit, activity mapping, crypto, session, message validation
└── integration/             # routes, webhook → queue → D1, cron, deletion
```

**Structure Decision**: a single Worker project using the existing `src/` and `test/`
layout. It is split by role into HTTP, the Strava client, queue work, and DB
access, so that the pure parts (rate-limit maths, activity mapping, crypto) can be
unit-tested without bindings. `wrangler.jsonc` gains bindings for D1 (`DB`), the
queue producer and consumer (`WORK_QUEUE`), the cron trigger, static `assets`, and
`vars` (`STRAVA_CLUB_ID`, `SEASON_START_DATE`, `STRAVA_SUBSCRIPTION_ID`).
`.dev.vars.example` gains `TOKEN_ENCRYPTION_KEY` and `SESSION_SIGNING_KEY`.
Afterwards, regenerate `worker-configuration.d.ts` with `pnpm types`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Daily scheduled Strava lookup (club membership), next to Principle II's "reacts, does not poll" | The spec requires disconnecting riders who leave the club (FR-004a). Strava sends no club-membership events, so a periodic check is the only way. | Checking on each activity event costs more requests and misses inactive riders. Dropping the leave rule contradicts the clarified spec. Cost is ≤ 20 requests/day of a 1,000/day read budget, and activities are still never polled. |
| `failed_work` table re-enqueued by cron (beyond plain queue retries) | Queues on the free plan retain messages for only 24 h, while SC-005 requires no activity to be lost during longer Strava outages. | A dead-letter queue has the same 24 h retention. A paid plan contradicts Principle IV's free-tier default. |
