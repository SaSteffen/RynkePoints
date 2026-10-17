# Tasks: Lazy-Loading Rides List

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/)

**Tests**: test-first (constitution Principle V): each test task comes before
the code that makes it pass and fails until then.

Format: `[ID] [P?] [Story] Description` — `[P]` can run in parallel (different
files, no open dependency).

## Phase 1: Foundation (blocks every story)

- [ ] T001 [P] Add the six keys of contracts/catalog.md to
  `src/i18n/messages/de.ts` and `src/i18n/messages/en.ts`; the catalog test
  (`test/unit/catalogs.test.ts`) keeps both in step.
- [ ] T002 [P] Unit tests for the ride key in `test/unit/rider-view.test.ts`:
  `formatRideKey`/`parseRideKey` round trip, rejects of a missing `~`, a bad
  date, a zero or non-numeric id, extra characters (data-model.md "Ride key").
- [ ] T003 Add `RideKey`, `formatRideKey`, `parseRideKey` and
  `parseBatchLimit` to `src/http/rider-view.ts` (T002 green).
- [ ] T004 Read `a.start_date` into `RideRow.startDate` in
  `src/db/rider-view.ts` (`RIDE_PAGE_SQL`, `toRideRow`); update the `ride()`
  fixture of `test/unit/rider-view.test.ts`.

## Phase 2: User Story 1 — Scroll through all rides (P1)

- [ ] T005 [P] [US1] Unit tests in `test/unit/rider-view.test.ts`: `RideTable.more`
  is the last row's key when older rides follow (pages 1 and 2 of 45), `null` on
  the last page and with 20 rides or fewer.
- [ ] T006 [P] [US1] Unit tests in `test/unit/rider-sections.test.ts`: with a
  pager, `section#rides[data-lazy]`, hidden `p.rides-total`, the list's
  `data-more` URL, hidden `div.rides-more` with the status texts and retry
  button; `p.rides-newest` only on page 2+; nothing of it without a pager;
  `renderRideBatch` renders the same `li.ride-card` as the page, with and
  without `data-more`, and an empty list (contracts/pages.md, http-routes.md).
- [ ] T007 [P] [US1] Integration tests in `test/integration/rides-more.test.ts`
  for `GET /me/rides/more` (contracts/http-routes.md): 45 rides read through in
  batches 21–40 and 41–45, `data-more` chain ends; a ride added and a ride
  removed between two batches neither repeats nor skips (SC-003); ties on
  `start_date` ordered by id; `limit` 25; `400` for bad `after`/`limit`; `401`
  without a session; `403` before agreeing; `409` without a balance; another
  rider's key never yields their rides; headers; no outbound `fetch`; the read
  uses `activities_by_rider` (EXPLAIN QUERY PLAN).
- [ ] T008 [US1] `readRideBatch(db, athleteId, key, limit)` in
  `src/db/rider-view.ts` (keyset, limit + 1, same joins as `RIDE_PAGE_SQL`).
- [ ] T009 [US1] `RideTable.more` and an exported `rideLines` in
  `src/http/rider-view.ts`; `readRiderView` passes the last row's key when the
  page isn't the last (T005 green).
- [ ] T010 [US1] Lazy markup in `renderRides` and new `renderRideBatch` in
  `src/http/rider-sections.ts` (T006 green).
- [ ] T011 [US1] `handleMoreRides` in `src/http/sections/rides.ts` and the
  `/me/rides/more` route in `src/http/router.ts` (T007 green).
- [ ] T012 [US1] Styles for `.rides-more` (spinner while loading, visually
  hidden "added" text) and `.rides-newest` in `src/http/style.ts`.
- [ ] T013 [US1] e2e in `e2e/smoke.e2e.ts`: Paula Paging on a phone sees no
  pager, the total line, and all 45 cards after scrolling, without a page load.
- [ ] T014 [US1] `lazyRides()` in `public/app.js`: start, observer, one load at
  a time, append, status and retry (contracts/client.md) (T013 green).

## Phase 3: User Story 2 — Keep my place (P2)

- [ ] T015 [US2] e2e in `e2e/smoke.e2e.ts`: scroll until ride 41 is at the top,
  follow its Strava link, go back: ride 41 at the same place; the same after a
  reload; Rides from the navigation bar starts at the top.
- [ ] T016 [US2] `rp-rides-place` keep and restore in `lazyRides()` (T015
  green).

## Phase 4: User Story 3 — Without the page script (P3)

- [ ] T017 [P] [US3] Integration test in `test/integration/me-rynke.test.ts`:
  the paging tests keep passing unchanged (position line and pager links), and
  `/me/rides?page=2` carries `p.rides-newest` and `data-more`.
- [ ] T018 [US3] e2e in `e2e/smoke.e2e.ts`: with JavaScript off the pager and
  the position line show; `/me/rides?page=2` with the script shows the newest
  link and loads 41–45.

## Phase 5: Polish

- [ ] T019 Update feature 011's Rides line in
  `specs/011-mobile-app-shell/contracts/pages.md` with a pointer to this
  feature.
- [ ] T020 `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`; walk
  through quickstart.md.

## Dependencies

- T001–T004 before everything else. T005–T007 before T008–T011. T013 before
  T014, T015 before T016. US2 needs US1's script; US3 needs US1's markup.
