---
description: "Tasks for stored rider summaries"
---

# Tasks: Stored Rider Summaries

**Input**: Design documents from `specs/030-rider-summaries/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/summary-reads.md, quickstart.md

**Tests**: required (FR-017, constitution Principle V). Write each test first and see it fail.

**Order**: the stories build on each other technically, so they aren't in priority order: rows must be written (US3) before reads can use them (US2), and the row limits (US1) can only pass once the reads have moved. US4 and US5 then prove the edges. Nothing visible changes at any step, because a rider without a row is added up.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: the user story in spec.md

## Phase 1: Setup

**Purpose**: the table and the test tools.

- [X] T001 Add `rider_summaries` to the `COLUMNS` list in `test/integration/schema-minimisation.test.ts` with `athlete_id`, `version`, `days`, `weeks`, `run_days`, `active`, `attended` (red)
- [X] T002 Create `migrations/0024_rider_summaries.sql` per `data-model.md`: `athlete_id INTEGER PRIMARY KEY REFERENCES riders (athlete_id) ON DELETE CASCADE`, `version INTEGER NOT NULL`, and `days`, `weeks`, `run_days`, `active`, `attended` each `TEXT NOT NULL DEFAULT '[]'`, `WITHOUT ROWID`; comment why it exists and that it's derived data
- [X] T003 Add `DELETE FROM rider_summaries` to `resetDb` in `test/support/ctx.ts`
- [X] T004 [P] Create `test/support/d1-rows.ts`: wraps a `TestCtx`'s `DB`, adds up `meta.rows_read` and `meta.rows_written` per use, for `first`, `all`, `run`, `raw` and `batch` (research R12). It keeps each batch's statements usable by unwrapping them before calling the real `batch`, as `test/support/d1-trips.ts` does
- [X] T005 [P] Add to `test/support/rider-view.ts` a `seedEmptySummary(athleteId)` helper that writes a current empty row

**Checkpoint**: `pnpm test` passes, with the new table empty and unused.

---

## Phase 2: Foundational

**Purpose**: the pure summary logic and the shared SQL pieces.

- [X] T006 [P] Write failing tests in `test/unit/rider-summary.test.ts` for `summaryOf`: rides on one date are summed; weeks end on the Sunday (Monday-to-Sunday, including a Sunday and a Monday, a year change and a leap day); runs sum per date; `active` is distinct by date, hour and ride, with a ride and a run in one hour kept as two; swims appear only in `active`; attendance gives sorted IDs; the same figures in any order give identical text (R3); a 365-day season stays under 100 KB per column
- [X] T007 Export the Sunday calculation from `src/rynke/weeks.ts` as `weekEndOf(date): string`, keeping `sundayOf` behaviour for `weekEnds`
- [X] T008 Create `src/rynke/summary.ts`: `RIDER_SUMMARY_VERSION = 1`, the `RiderSummary` type, the pure `summaryOf(figures, attendance)` returning JSON text per column, sorted by value before adding up (R3), plus parsers for each column (T006 green)
- [X] T009 [P] Write failing test in `test/integration/shared-riders.test.ts`: `listedRiderFilter` picks exactly the riders of `LISTED_RIDER_IDS` for connected, needs-reconnect, no-consent and older-consent riders
- [X] T010 Add `sharedRiderExists(alias, version)` to `src/db/consents.ts` next to `sharedRiderIdsSince`, and `listedRiderFilter(alias)` to `src/db/organiser.ts`, built as in research R5; both versions are numbers from code, never request input (T009 green)
- [X] T011 Create `src/db/rider-summaries.ts`: `readSummariesOfRidersStatement(db, athleteIds)` with `json_each`, `upsertSummaryStatement(db, athleteId, summary)`, `insertEmptySummaryStatement(db, athleteId)`, and `CURRENT_SUMMARY_JOIN` for `LEFT JOIN rider_summaries s ON s.athlete_id = r.athlete_id AND s.version = RIDER_SUMMARY_VERSION`

**Checkpoint**: unit tests pass; no page or evaluation has changed.

---

## Phase 3: User Story 3 - Summaries follow every change (P1)

**Goal**: every change leaves a rider's row matching their stored data, in the same batch.

**Independent Test**: apply each kind of change to a seeded rider, then compare the row with one worked out from scratch.

- [X] T012 [US3] Write failing tests in `test/integration/rider-summaries.test.ts`: after an evaluation the row matches `summaryOf`; ride, run and swim added, edited, deleted; an activity moved between ride, run and swim; private rides withdrawn; attendance added and removed; event deleted; event moved (row unchanged, read stays right later); a correction (row unchanged); a change of rules through `applyAndEvaluate` with other rules; older rides purged by `purgePreSeasonActivities`
- [X] T013 [US3] In the same file, failing tests: a second evaluation writes no row at all, measured with `test/support/d1-rows.ts`, including after an activity change made in a different order (FR-004)
- [X] T014 [US3] In `src/rynke/apply.ts`, add `summary` to `RiderState`, read it in `readRiders` via `readSummariesOfRidersStatement`, and keep the order of existing results (`extra` stays last)
- [X] T015 [US3] In `riderWrites` in `src/rynke/apply.ts`, work out `summaryOf(figures, state.attendance)` from the evaluation's `figures` (pass them in, the call sites at `applyAndEvaluate`, `reevaluate` and `applyCorrectionChange` already have them in `after`) and push `upsertSummaryStatement` only when no row, another version or a differing column (T012, T013 green)
- [X] T016 [US3] Fix any existing test in `test/integration/` that counts statements or rows written by an evaluation only where the new row is the cause, without changing what a page shows

**Checkpoint**: rows stay right through every change. Reads still add up the rides.

---

## Phase 4: User Story 2 - Everyone sees exactly the same numbers (P1)

**Goal**: the reads move to summaries with identical results, and riders without a row are added up.

**Independent Test**: for the same riders, compare figures from summaries with figures from adding up.

- [ ] T017 [US2] Write failing tests in `test/integration/rider-summaries-parity.test.ts`, with synthetic riders having decimal distances, several activities per day, runs, swims, attendance, corrections and non-counting rides: `readTeam` with all rows equals `readTeam` with the rows deleted; `readTeamBadgeSums` likewise; `evaluateTeamBadges` from both gives exactly equal earned badges and dates, and progress within 0.000001 (research R10); same with no, some and all riders having a row, each counted once
- [ ] T018 [US2] In the same file, failing tests: a deleted event named in `attended` counts for nothing; a moved event uses its current date and kind; no-consent and needs-reconnect riders with rows are in no result; riders with nothing stored are left out of `riders` but stay in `connectedOn` (R9); `readTeam` never selects `days`, `run_days` or `active` (FR-008, check on the SQL text through a statement spy)
- [ ] T019 [US2] Add to `src/db/rider-summaries.ts` the add-up reads for riders without a row, today's SQL from `src/db/team.ts` plus `athlete_id IN (SELECT value FROM json_each(?))` and `IN (${LISTED_RIDER_IDS})`: `readWeeksAddedUp(db, ids)` (weekly sums, attendance IDs) and `readDaysAddedUp(db, ids)` (rides per day, runs per day, activity times, attendance IDs), each returning the parsed summary shape (R4)
- [ ] T020 [US2] Add the pure merge to `src/rynke/summary.ts`: from rider rows, added-up riders and events to `TeamBadgeSums`, in the shape and order in research R9 (runs summed per day across riders, `active` sorted by date, rider, hour, ride, events sorted by date then ID with only listed attendees)
- [ ] T021 [US2] Rewrite `readTeam` in `src/db/team.ts` per `contracts/summary-reads.md`: one batch of the wide statement plus events, corrections through an ordered inner select, second round trip only with missing riders; keep the `TeamRider` result and first-name order
- [ ] T022 [US2] Rewrite `teamBadgeSumsStatements`, `toTeamBadgeSums` (now `async`, takes `db`) and `readTeamBadgeSums` in `src/db/team.ts` per the contract (T017, T018 green)
- [ ] T023 [US2] Make `hasNewBadges` async in `src/http/sections/badges.ts`, keeping its early answer for a new personal badge; await in `readBadgesPage` and in `homeOf` in `src/http/redirect.ts`
- [ ] T024 [P] [US2] Await the sums in `album/load.ts`
- [ ] T025 [US2] Remove `listWeeklyRideSumsStatement`, `listTeamBalancesStatement`, `listTeamCorrectionsStatement` from `src/db/team.ts` if no other caller remains (`album/load.ts` uses `listTeamBalancesStatement`: keep that one)
- [ ] T026 [US2] Run `pnpm test`: page, badge and notification tests must pass with their expectations unchanged (SC-006). Add `seedEmptySummary` to the setup in `test/integration/d1-round-trips.test.ts` so it describes normal use, with its expected trip counts unchanged (FR-010). Check `test/integration/viewer.test.ts` and `test/integration/usage-counting.test.ts`, which also count trips, and do the same if they read team data

**Checkpoint**: same numbers from summaries, and from adding up where no row exists.

---

## Phase 5: User Story 1 - The app keeps working all season (P1)

**Goal**: the limits are met and guarded.

**Independent Test**: load the synthetic team and measure rows per use.

- [ ] T027 [US1] Write `test/integration/d1-rows.test.ts` using `test/support/d1-rows.ts`, seeding 40 riders with 150 rides, 20 runs and 10 swims each and 20 events: at most 400 rows for `/`, 500 for `/team`, 1,500 for `/me/badges`, 1,000 for `/organiser/riders`, and 1,500 for a new ride with its team badge check (SC-001)
- [ ] T028 [US1] Add to the same file the doubling check: 300 rides per rider raise `/`, `/team` and `/organiser/riders` by under 10%, and `/me/badges` and a new ride by at most 5 rows per extra ride of that rider (SC-003)
- [ ] T029 [US1] Run the test and add the measured rows of each use to `specs/030-rider-summaries/research.md` R12, with the whole-app daily estimate from the spec's usage estimate; it must stay under 5% (SC-002). If a limit is missed, find the statement with the most rows and fix that before touching the limit

**Checkpoint**: the row limits hold in an automated test.

---

## Phase 6: User Story 4 - Leaving and withdrawing take effect at once (P1)

**Goal**: privacy doesn't depend on a stored copy.

**Independent Test**: remove a rider, and check their row is gone and team figures changed on the next load.

- [ ] T030 [P] [US4] Add `rider_summaries` to the delete checks in `test/integration/db.test.ts` (the zero-count map and the table list keeping the other rider's rows) and confirm `test/integration/delete-rider.test.ts` covers the row
- [ ] T031 [US4] In `test/integration/rider-summaries.test.ts`, tests with a rider who has a row: after deletion, status `needs_reconnect` or no consent, the next `/team`, `/organiser/riders` and `readTeamBadgeSums` no longer include them and team sums fall accordingly; the row stays for a rider who is only unlisted and is back in the figures when listed again; a page shows no figure of another rider it didn't show before, comparing the rendered `/team` and `/me/badges` with rows and without
- [ ] T032 [US4] Fix anything these tests find in `src/db/team.ts` or `src/db/rider-summaries.ts`

**Checkpoint**: a removed rider is out of every team figure on the next load (SC-005).

---

## Phase 7: User Story 5 - The release is invisible (P2)

**Goal**: rows fill without anyone noticing, and new riders never wait.

**Independent Test**: load pages with no, some and all riders summarised.

- [ ] T033 [US5] Add failing tests to `test/integration/rynke-sweep.test.ts`: a connected rider with no row, with another version and with an `attended` differing from `attendances` in either direction is listed; an evaluated rider is not; a rider who isn't connected is not
- [ ] T034 [US5] Extend `listRidersNeedingEvaluation` in `src/db/rynke.ts` with `NOT EXISTS` on the current version and the `EXCEPT` both ways on IDs with `json_each(s.attended)` (research R7), bind the version as `?5` (T033 green). Give existing tests that expect nobody to be listed a real evaluation in their setup, where they seeded a balance by hand
- [ ] T035 [US5] Failing test, then add `insertEmptySummaryStatement` to `insertRider`'s batch in `src/db/riders.ts`: a rider new through `/auth` has a current empty row before their first ride, and the first page load makes no second round trip
- [ ] T036 [US5] Tests in `test/integration/rider-summaries.test.ts` for the first fill: `handleScheduled` sends `evaluate-rider` for riders without a row; running it writes only the summary row, with no balance write, no rise, no badge reveal and no notification; afterwards a second sweep lists nobody
- [ ] T037 [US5] Add to `test/integration/d1-rows.test.ts`: with all riders without a row, each use in SC-001 reads no more than the figure in the spec's "Today" column (research R11)

**Checkpoint**: release with an empty table is safe.

---

## Phase 8: Polish

- [ ] T038 [P] Update the top comments in `src/db/team.ts`, `src/rynke/apply.ts` and `src/badges/team.ts` that describe adding up rides and "five SELECTs", and comment the wide statements where the SQL is harder to follow
- [ ] T039 Run `pnpm lint`, `pnpm typecheck` and `pnpm test`, then the checks in `specs/030-rider-summaries/quickstart.md`
- [ ] T040 Check that `src/` imports nothing from `dev/` or `album/` and that no rider-facing text changed in `src/i18n/messages/`

---

## Dependencies

- **Setup → Foundational → US3 → US2 → US1**, in that order.
- **US4 and US5** need US2, and can run side by side after it. T037 also needs T027's seed.
- **Polish** comes last.

Within a phase, tests come first. T014 before T015, T019 and T020 before T021 and T022, T022 before T023 and T024.

## Parallel

- Setup: T004, T005.
- Foundational: T006 and T009 (tests).
- After US2: US4 (T030 to T032) next to US5 (T033 to T037).

## Implementation Strategy

Commit after each phase. Every checkpoint leaves the app correct, so the work can stop at any of them.

**The value arrives with US1**: Phases 1 to 5 bring the cost down and guard it. US4 and US5 must still be done before release, since they prove the privacy promise and create the rows for existing riders. Without T034, no existing rider would ever get a row unless they rode, and the saving wouldn't arrive.
