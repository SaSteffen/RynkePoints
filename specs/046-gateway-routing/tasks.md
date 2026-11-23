---

description: "Task list for Gateway Routing"
---

# Tasks: Gateway Routing

**Input**: Design documents from `/specs/046-gateway-routing/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Required (constitution Principle V): each test task is written red before its
implementation.

**Organization**: by user story; the shared object, figures and migration come first.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T001 Add the `ROUTING` var (`off`), the `ROUTING_COPY` Durable Object binding and its `new_sqlite_classes` migration to gateway/wrangler.jsonc, and update its header comment (no D1, rider data per FR-010)
- [X] T002 [P] Add migration migrations/0038_routing_daily.sql (`routing_daily`, additions only)
- [X] T003 [P] Add the shared figure names and the 30-day window in src/routing/figures.ts

## Phase 2: Foundational

- [X] T004 [P] Write red unit tests for the mode, choosing and figure checks in test/unit/routing-choose.test.ts
- [X] T005 Implement gateway/routing.ts (routingMode, chooseTeams, routingTeams, figure and day checks) until T004 passes
- [X] T006 Write red gateway tests for the object (reports, full list diff and possible misses, list dates, off-mode forget, counts, pruning of old days and departed teams) in test/gateway/copy.test.ts
- [X] T007 Implement the RoutingCopy Durable Object in gateway/copy.ts and export it from gateway/index.ts until T006 passes
- [X] T008 [P] Implement routing_daily access (add, read since, upsert, own counts, prune) in src/db/routing.ts

**Checkpoint**: the copy and the figures exist; nothing uses them yet.

## Phase 3: User Story 1 - A rider's events reach only their team (P1)

**Goal**: with `ROUTING=on`, an event goes to the teams the copy lists plus teams not routing.

**Independent Test**: test/gateway/routing.test.ts sends events for listed athletes and counts the queued messages per team.

- [X] T009 [US1] Write red gateway tests: one team for a rider, both for a guest, deauthorization to the holders, `off` broadcasts without a lookup, in test/gateway/routing.test.ts
- [X] T010 [US1] Look up and choose teams in the webhook of gateway/index.ts (1 s budget, counts via waitUntil), pass the execution context from the default export
- [X] T011 [US1] Keep the team question and let-go off the copy: assert in test/gateway/held.test.ts that neither touches the object

## Phase 4: User Story 2 - A gap in the copy never loses an event (P1)

**Goal**: unknown athletes, teams not routing and an unreadable copy all fall back to more teams.

**Independent Test**: test/gateway/routing.test.ts with an empty copy, a stale list and a failing object.

- [X] T012 [US2] Write red gateway tests for an unknown athlete, a team without or with an old list (48 h), an object that throws or times out, in test/gateway/routing.test.ts
- [X] T013 [US2] Make the fallbacks in gateway/index.ts pass T012

## Phase 5: User Story 3 - The copy follows the teams (P2)

**Goal**: reports after every stored or deleted person, a full list every day.

**Independent Test**: test/integration/routing-reports.test.ts drives sign-in, leaving, removal, let-go and deletion and checks the fake gateway's reports; test/gateway/team-routes.test.ts checks the routes.

- [X] T014 [P] [US3] Write red gateway tests for `/teams/<id>/report`, `/list`, `/counts`: auth as the team question, own part only, 400s, 404 while off, off-mode list empties the copy, in test/gateway/team-routes.test.ts
- [X] T015 [US3] Implement the three team routes in gateway/index.ts until T014 passes
- [X] T016 [US3] Teach the fake gateway in test/support/fake-strava.ts to record reports, lists and exchanges and to answer with a chosen status
- [X] T017 [US3] Write red integration tests: a report is queued after a new rider, a new guest, leaving, a refused sign-in, deletion, removal and let-go; none without a gateway; the report sends the current hold; 404 settles it; failures retry; the last attempt drops; the daily run sends the full list, in test/integration/routing-reports.test.ts
- [X] T018 [US3] Add `report-hold` to src/work/messages.ts and handle it before the rider check in src/work/consumer.ts
- [X] T019 [US3] Implement queueing, sending a report and the full list in src/routing/report.ts
- [X] T020 [US3] Queue reports in src/http/auth.ts, src/http/me.ts, src/http/held.ts, src/http/admin/remove.ts, src/work/delete-rider.ts and the consumer's last-attempt deletion
- [X] T021 [US3] Add the full list and the routing_daily prune to the daily run in src/work/scheduled.ts
- [X] T022 [US3] Update tests that list exact queue messages behind a gateway (test/integration/one-team.test.ts)

## Phase 6: User Story 5 - The maintainers see whether routing misses events (P1)

**Goal**: trial marks, team and gateway counts, the exchange and the admin day table.

**Independent Test**: test/integration/routing-counts.test.ts and test/integration/admin-usage-routing.test.ts.

- [X] T023 [US5] Write red gateway tests: trial sends to every team with `chosen`, the forward sets `X-Rynke-Route`, counts copy/everyone/allRouting, in test/gateway/routing.test.ts and test/gateway/forward.test.ts
- [X] T024 [US5] Implement trial marks in gateway/index.ts (queue message `chosen`, forward header)
- [X] T025 [US5] Write red integration tests: the webhook carries `route`; the consumer counts dropped, wasted and missed on the first delivery only and processes as before; the re-check counts found; the exchange posts own counts and stores the answer, in test/integration/routing-counts.test.ts
- [X] T026 [US5] Read `X-Rynke-Route` in src/http/webhook.ts, parse `route` in src/work/messages.ts, count at the rider check in src/work/consumer.ts
- [X] T027 [US5] Count re-check finds in src/work/recheck-rider.ts
- [X] T028 [US5] Implement the hourly exchange in src/routing/report.ts and run it after recordUsage in src/work/scheduled.ts and on Update now in src/http/admin/usage.ts
- [X] T029 [P] [US5] Write red unit tests for a day's warning mark in test/unit/routing-warning.test.ts and implement src/routing/warning.ts
- [X] T030 [US5] Write red integration tests for the "Gateway routing" section and the summary line in test/integration/admin-usage-routing.test.ts
- [X] T031 [US5] Render the section and the summary line in src/http/admin/usage.ts (or src/http/admin/routing.ts) with catalog keys in all ten src/i18n/messages/*.ts

## Phase 7: User Story 4 - Riders are told what the gateway keeps (P2)

**Goal**: one privacy paragraph, no consent ask.

**Independent Test**: the privacy page in every language contains the paragraph (test/integration/privacy.test.ts or the existing privacy test).

- [X] T032 [US4] Write a red test that the privacy notice describes the gateway's copy, in the existing privacy page test
- [X] T033 [US4] Add `privacy.technical.gateway` to all ten catalogs and to src/http/privacy.ts, move PRIVACY_UPDATED

## Phase 8: Polish

- [X] T034 [P] Run the local gateway with `ROUTING=on` in scripts/dev.mjs and adjust its unit test
- [X] T035 [P] Document routing (fallbacks, which teams route, emptying the copy, going live) in docs/gateway-switch.md
- [X] T036 [P] Deploy the gateway when src/routing/figures.ts changes, in .github/workflows/ci.yml
- [X] T037 Run the targeted tests, `pnpm typecheck` and `pnpm lint`

## Dependencies

- Phase 1 → Phase 2 → US1 → US2 (same webhook code) → US3 → US5 → US4 → Polish.
- US4 only needs the catalogs; it could go any time.
- Inside a phase, a test task comes before the code it covers.

## Parallel Opportunities

- T002, T003 beside T001; T004 and T008 beside each other.
- T014 beside T012/T013 (different files); T029 beside T025–T028.
- T034, T035, T036 at the end.

## Implementation Strategy

MVP: Phases 1–4 give routing with every fallback, switched off by default. US3 makes it useful,
US5 makes it safe to switch on, US4 must ship before any team routes.
