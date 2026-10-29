# Tasks: Fair Share of the Strava Budget

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/)

**Tests**: test-first (constitution Principle V): each test task comes before
the code that makes it pass and fails until then.

Format: `[ID] [P?] [Story] Description`.

## Phase 1: Foundation

- [ ] T001 Migration `migrations/0019_strava_work.sql` (data-model.md); clear the
  new tables and reset `strava_turn` in `resetDb` (`test/support/ctx.ts`).
- [ ] T002 [P] Unit tests in `test/unit/rate-limit.test.ts`: `background` stops
  at 80/15 min and 900/day of the default limits, `interactive` at today's 90
  and 950; the overall margins hold (R5).
- [ ] T003 Priorities in `src/strava/rate-limit.ts` (T002 green).

## Phase 2: User Story 1 — fair order (P1)

- [ ] T004 [US1] Integration tests in `test/integration/strava-work.test.ts`:
  storing and routing (contracts/queue-messages.md), turn order (fresh first in
  arrival order, then least recently served, FR-002–FR-002b), FIFO per rider,
  a lone rider uses the whole budget, budget stops the drain and sends one
  `strava-turn`, transient backoff and `failed_work` on the last attempt,
  `refresh-refused` drops the rider's rows, deleted riders' rows cascade,
  `DRAIN_LIMIT` wakes at once, a 300-event backlog with one other rider's ride
  (SC-001 order).
- [ ] T005 [US1] `src/db/strava-work.ts`, `src/work/drain.ts`, routing in
  `src/work/consumer.ts`, `strava-turn` in `src/work/messages.ts`; handler
  types move to `src/work/handler.ts` (T004 green).
- [ ] T006 [US1] Update queue-level tests of the moved kinds to the table's
  rules (R3 consequence): `consumer.test.ts`, `activity-event.test.ts`,
  `membership-check.test.ts`, `no-secret-logging.test.ts`.

## Phase 3: User Story 2 — sign-ins during a backlog (P1)

- [ ] T007 [US2] Tests in `test/integration/strava-client.test.ts` and
  `test/integration/callback.test.ts`: the sign-in's club check and token
  exchange go through at background-exhausted usage; at fully used budget
  the token exchange isn't sent and the callback shows `strava-busy`; a revoke
  refused for budget is `transient`.
- [ ] T008 [US2] Priority through `src/strava/client.ts` and
  `src/strava/tokens.ts`, `interactive` in
  `src/http/auth.ts` (T007 green).

## Phase 4: User Story 3 — one notification (P2)

- [ ] T009 [US3] Tests in `test/integration/held-notifications.test.ts`: no
  push while rows wait; one per device when the queue empties, with the whole
  backlog's rise and every badge stored; none when nothing rose; a lone event
  notifies as today; team badge pushes to others wait for the owner's queue;
  another rider without a backlog is notified at once.
- [ ] T010 [US3] Holding and releasing in `src/work/drain.ts` and
  `src/db/strava-work.ts` (T009 green).

## Phase 5: User Story 4 — progress line (P2)

- [ ] T011 [P] [US4] Catalog keys (contracts/catalog.md) in
  `src/i18n/messages/de.ts` and `en.ts`.
- [ ] T012 [US4] Tests in `test/integration/fetching.test.ts`: the counts and
  `show_progress` threshold, the import count and line, `GET /me/fetching`
  (401, text, null), the section on Overview and Rides, never on Team, no
  Strava request.
- [ ] T013 [US4] `import_fetched` in `src/work/import-page.ts` and
  `src/db/riders.ts`, `src/http/fetching.ts`, route, `renderFetching` on
  Overview and Rides (T012 green).
- [ ] T014 [US4] `followFetching` in `public/app.js` (contracts/http-routes.md).

## Phase 6: Polish

- [ ] T015 Update feature 001's `contracts/queue-messages.md` pointer and the
  `processBatch` comment; `pnpm lint`, `pnpm typecheck`, `pnpm test`,
  `pnpm test:e2e` green in CI.
