# Implementation Plan: Fair Share of the Strava Budget

**Branch**: `024-fair-strava-budget` | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/024-fair-strava-budget/spec.md`

## Summary

- **Fair order (US1)**: the consumer stores every message that needs Strava in
  a D1 table, one FIFO per rider, and drains it round robin: the rider whose
  queue was empty goes next, then the one served least recently (research R1,
  R2). Retries, backoff, budget deferral and `failed_work` move from the queue
  message to the table row with the same rules (R3). A `strava-turn` message
  wakes the drain when the budget recovers (R4).
- **Reserve (US2)**: background work stops 10 reads per window and 50 a day
  earlier than today; sign-in, reconnect and revocation may use the rest. Token
  exchange, refresh and revoke are budget-checked too (R5).
- **One notification (US3)**: while a rider has rows waiting, their
  notifications (and team badge pushes their work sets off) are held; when the
  queue is empty, the whole backlog's rise and badges are written once and each
  rider owed a push gets one. A lone event notifies as today (R6).
- **Progress line (US4)**: counts on the rider's queue row and on the rider's
  import; `GET /me/fetching` gives the text, the page script polls it (R7).

## Technical Context

**Language/Version**: TypeScript on Cloudflare Workers; plain JavaScript in
`public/app.js`.

**Primary Dependencies**: none new.

**Storage**: D1, migration `0019_strava_work.sql` (data-model.md), additive.

**Testing**: Vitest in workerd: unit tests for the budget priorities and the
fetching text; integration tests through `handleQueue`/`processBatch` and
`handleFetch` with the fake Strava for the drain order, reserve, held
notifications and the line. The page script's poll follows feature 015's
`waitForFirstData`; no Playwright test drives it, since the fake mode has no
backlog to show.

**Target Platform**: Cloudflare Workers.

**Constraints**: Strava's stopping points unchanged (FR-001); free tier
(Principle IV): the table costs a few D1 writes per item and saves the queue
re-sends of today's deferral.

## Constitution Check

| Principle | Check |
|---|---|
| I. Consent and privacy | No new personal data; new rows hold identifiers and counts and cascade with the rider. |
| II. Strava API | Limits honoured with the same margins overall; the webhook still only enqueues; backlogs stay throttled jobs. |
| III. Rider content | Untouched. |
| IV. Serverless, minimal | D1 and Queues only; no new dependency or paid primitive (R1 alternatives). |
| V. Test-first | Each task's test comes first (tasks.md). |

## Project Structure

### Documentation (this feature)

```text
specs/024-fair-strava-budget/
├── spec.md, plan.md, research.md, data-model.md, quickstart.md, tasks.md
├── checklists/requirements.md
└── contracts/queue-messages.md, http-routes.md, catalog.md
```

### Source Code (repository root)

```text
migrations/0019_strava_work.sql      # new tables, riders.import_fetched
src/db/strava-work.ts                # table access (store, pick, finish, counts)
src/work/drain.ts                    # the drain loop, holding and releasing
src/work/consumer.ts                 # routing; generic path unchanged
src/work/messages.ts                 # strava-turn, which kinds go to the table
src/work/import-page.ts              # import_fetched
src/work/handler.ts                  # handler types, shared with the drain
src/strava/rate-limit.ts             # priorities
src/strava/client.ts, tokens.ts     # priority, token budget
src/http/auth.ts, me.ts              # interactive priority; strava-busy on budget
src/http/fetching.ts                 # GET /me/fetching, the line's text
src/http/router.ts                   # route
src/http/rider-sections.ts           # renderFetching
src/http/sections/overview.ts, rides.ts
src/i18n/messages/de.ts, en.ts
public/app.js                        # followFetching
test/…                               # see tasks.md
```

## Complexity Tracking

| Addition | Why | Simpler alternative rejected because |
|---|---|---|
| A second work list in D1 next to the queue | Queues can't be reordered (R1) | Re-sending out-of-turn messages costs queue operations per window per message |
