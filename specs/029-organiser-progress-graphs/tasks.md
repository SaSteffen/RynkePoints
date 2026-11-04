---
description: "Tasks for the organiser progress graphs"
---

# Tasks: Organiser Progress Graphs

**Input**: `specs/029-organiser-progress-graphs/` (plan, spec, research, data-model, contracts, quickstart)

**Tests**: Required (constitution Principle V). Each test task comes first and must fail before its code.

**Manual checks** in `quickstart.md` happen on the live site after release, so they have no tasks here. Read the
[design draft](https://claude.ai/artifact/CS7cXRCBrwevDxRBJudfH2) before any styling task. Fixtures stay synthetic.

**Format**: `[P]` can run alongside others (different files). `[USn]` is the spec's user story.

## Phase 1: Setup

- [X] T001 Add `migrations/0025_summary_graph_columns.sql`: `ALTER TABLE rider_summaries ADD COLUMN virtual_days TEXT NOT NULL DEFAULT '[]'` and the same for `own_days`, with comments as in `0024`
- [X] T002 [P] Add `ORGANISER_PROGRESS_GRAPH: "on"` to `wrangler.jsonc` and `vitest.config.ts`, then run `pnpm types` for `worker-configuration.d.ts`

## Phase 2: Foundational (stored rows and cheap release)

**Blocks every story.** Team reads must keep working on version 1 rows before anything else raises the version.

- [X] T003 [P] Write failing unit tests in `test/unit/rider-summary.test.ts`: `summaryOf` gives `virtualDays` as `[date, virtualM]` only for days with a counting virtual ride, `ownDays` as `[date, longestM, outdoor]` per counting day, and the same text whatever the input order
- [X] T004 Write failing tests in `test/integration/rider-summaries.test.ts`: with all rows at version 1, team reads use the rows without adding up; a row below the floor counts as missing; an evaluation raises a version 1 row to 2 with no balance write, rise or notification; the daily job finds version 1 rows; a second unchanged evaluation writes nothing. Change the existing "another version counts as missing" test to match
- [X] T005 Add to `test/integration/d1-rows.test.ts`: all rows at version 1 keep the app start, Team page and organiser's table within 10% of version 2 (SC-010)
- [X] T006 In `src/rynke/summary.ts`: `RIDER_SUMMARY_VERSION = 2`, `TEAM_SUMMARY_SINCE = 1`, `OWN_SUMMARY_SINCE = 2`, new columns on `RiderSummary` and `summaryOf`, parsers `parseVirtualDays` and `parseOwnDays`. `SummaryFigures.rides` takes `virtual`
- [X] T007 In `src/db/rider-summaries.ts`: `CURRENT_SUMMARY_JOIN` becomes `s.version >= TEAM_SUMMARY_SINCE` (rename `TEAM_SUMMARY_JOIN`, update `src/db/team.ts`), new columns in `RiderSummaryRow`, `readSummariesOfRidersStatement` and `upsertSummaryStatement`
- [X] T008 In `src/rynke/apply.ts` `riderWrites`: compare `virtual_days` and `own_days` too. Confirm `listRidersNeedingEvaluation` in `src/db/rynke.ts` still asks for exactly the current version
- [X] T009 Add the new columns to `test/integration/schema-minimisation.test.ts`, then get `rider-summaries`, `rider-summaries-parity`, `d1-rows` and `d1-round-trips` passing

**Checkpoint**: pages look and cost as before, and the daily job raises rows to version 2.

## Phase 3: Badges page off the rider's rides (FR-034)

- [X] T010 Write failing tests in `test/integration/rider-summaries-parity.test.ts`: on decimal distances, figures from a row equal those from the two statements (exact for elevation, winter days; within 0.000001 m for distances), including rides after the deadline, which stay out
- [X] T011 Add to `test/integration/d1-rows.test.ts`: Badges page at most 500 rows, and twice the rides add at most the extra badges' rows (SC-009); tighten the 5-rows-per-ride bound for this page. Add to `test/integration/d1-round-trips.test.ts`: round trips unchanged with a row
- [X] T012 In `src/rynke/summary.ts`: pure `ownFiguresOf(days, virtualDays, ownDays, deadline)` giving distance, elevation, longest ride, virtual distance and outdoor days per month
- [X] T013 In `src/db/badges.ts` and `src/http/sections/badges.ts` `readBadgesPage`: the batch reads the rider's row by primary key at `OWN_SUMMARY_SINCE` in place of the two ride statements; without a row they run in a second round trip. Runs and swims stay in the batch

**Checkpoint**: the Badges page shows the same and reads about 400 rows.

## Phase 4: User Story 2 - Riders agree first (P1)

Before the graphs, because no daily value may be read without it.

- [X] T014 [P] [US2] Write failing tests: `test/unit/consent-versions.test.ts` for version 3 with `changes: ["consent.dailyFigures"]` and the same scopes; `test/unit/visibility.test.ts` for `dailyFigures` organisers only, since 3, with `rides` still nobody; a test that versions don't depend on either setting (FR-028)
- [X] T015 [US2] Add version 3 to `CONSENT_VERSIONS` in `src/consent.ts` and `dailyFigures` to `src/visibility.ts` (`DAILY_FIGURES_SINCE_VERSION = 3`)
- [X] T016 [P] [US2] Add `consent.dailyFigures` and change `privacy.visibility.organisers` in `src/i18n/messages/en.ts` and `de.ts`, per `contracts/messages.md`; update `test/unit/catalogs.test.ts` where it lists keys
- [X] T017 [US2] Render the new line after `consent.organisers` in `src/http/consent-form.ts`; extend `test/integration/consent-gate.test.ts` for a version 2 rider being asked and told what changed, and a new rider accepting 3 directly
- [X] T018 [US2] Update tests pinning the current consent version, as the failures show

## Phase 5: User Story 7 - Turn it on or off (P2, needed by the section)

- [X] T019 [P] [US7] Write failing tests in `test/unit/config.test.ts`: `organiserProgressGraph` is true for "on", false for "off", and throws otherwise
- [X] T020 [US7] Add `organiserProgressGraph(env)` to `src/config.ts` in the style of `trainingLeaderboard`

## Phase 6: User Story 1 - See how riders progress (P1, MVP)

- [ ] T021 [P] [US1] Write failing unit tests in `test/unit/organiser-graphs.test.ts` for the pure `organiserGraphsView()`: two rides on one day make one point; outdoor and virtual split; elevation from both; team totals over all agreed riders whichever are selected; zero agreed riders; agreed rider with no rows; days outside the season left out and a day past today clamped; season sums equal the counting rides
- [ ] T022 [US1] Write failing tests in `test/integration/organiser-overview.test.ts`: version 2 rider in the table, absent from the data and team totals (SC-004); agreeing adds them, leaving removes them; setting off or percent mode gives no section, no data and no read of the columns (SC-007); example team none; non-organiser 403; no ride name, ID or start time in the response; a rider who agrees with a version 1 row gets correct lines
- [ ] T023 [US1] Add to `test/integration/d1-round-trips.test.ts` and `d1-rows.test.ts`: round trips unchanged, under 1,000 more rows (SC-008)
- [ ] T024 [US1] Add `src/db/organiser-graphs.ts`: the read of `research.md` R2 as a batch statement, and added-up days with the virtual split for riders without a version 2 row, listed and consent filters inside SQL (`src/db/rider-summaries.ts` for shared helpers)
- [ ] T025 [US1] Add `src/http/organiser/progress-graphs.ts`: `organiserGraphsView()` per `data-model.md`, and the section's markup per `contracts/pages.md`, with inline JSON escaped as in `progress-section.ts`
- [ ] T026 [US1] In `src/http/organiser/overview.ts`: add the statement to the requests batch and the section after the table, only per the table in `contracts/pages.md`; load the chart scripts only then
- [ ] T027 [P] [US1] Add the `organiser.graphs.*` texts to `src/i18n/messages/en.ts` and `de.ts`, per `contracts/messages.md`, with German gender wording
- [ ] T028 [US1] In `public/app.js`: `organiserGraphs(signal)`, run from `enhance`: three Chart.js charts, Running total and Per day, legends with range sum and day value, per `contracts/client.md`; `animation: false`, `parsing: false`, `normalized: true`, no points
- [ ] T029 [US1] Add screen-reader text: canvas `aria-label`, `aria-live` readout, arrow keys for the day (`research.md` R12)
- [ ] T030 [P] [US1] Style the section and line colours in `src/http/style.ts` per the draft, checked per theme; update `test/unit/style.test.ts`

## Phase 7: User Story 3 - Choose the time range (P1)

- [ ] T031 [US3] Write failing `e2e/organiser-graphs.e2e.ts`: presets, date boxes, mouse drag and touch gestures keep boxes, presets and all graphs in sync; From past To moves To
- [ ] T032 [US3] Move `progressCharts()`'s pointer handling in `public/app.js` into a shared helper used by both; `e2e/progress.e2e.ts` must stay green unchanged
- [ ] T033 [US3] Range in `organiserGraphs()`: presets, date boxes, gestures, running totals and y axis recalculated per range, marked stretch while dragging
- [ ] T034 [US3] Keep range, mode, team lines, tab and view across `swapPage` in a module-level object, and reset on full reload (`research.md` R5); cover it in the e2e test

## Phase 8: User Story 4 - Choose the lines with 30+ riders (P2)

- [ ] T035 [US4] Extend `e2e/organiser-graphs.e2e.ts`: tile preselects and leaves team lines; search and tick; "Done", outside click and Escape close; "Clear all"; over 8 riders grey with a ranked legend; highlight; not-agreed names without a checkbox
- [ ] T036 [US4] Add the "Shown in the graphs" dropdown to `src/http/organiser/progress-graphs.ts`, with templates and the server-rendered not-agreed names
- [ ] T037 [US4] In `public/app.js`: selection from the group, panel behaviour, summary label, over-8 styling, ranked legend, highlight, note, "still being asked" state, per `contracts/client.md`

## Phase 9: User Story 6 - Desktop page in order (P2)

- [ ] T038 [US6] Write failing tests in `test/integration/organiser-overview.test.ts`, with or without graphs (FR-021): order per `contracts/pages.md`; no reports box or search from 1100 px through CSS (`test/unit/style.test.ts`)
- [ ] T039 [US6] Table in a scrolling box with a sticky header in `src/http/organiser/overview.ts` and `src/http/style.ts`

## Phase 10: User Story 5 - Phone (P2)

- [ ] T040 [US5] Write failing tests: `organiser-overview.test.ts` for rows with `data-name`, outside-group rows `hidden`, reports box capped at 3 with "Show all N", `view=riders`; update the tests pinning cards. Extend `e2e/organiser-graphs.e2e.ts` for switch, tabs, "Custom", search across groups, tile clearing the search, rows expanded at 5 or fewer
- [ ] T041 [US5] In `src/http/organiser/overview.ts`: one-line `<details>` rows replacing the cards with today's content, search, reports box via `riderRequestLines`, Graphs / Riders switch, `view=riders`, order per `contracts/pages.md`
- [ ] T042 [US5] In `public/app.js`: switch, rider search, expand rule, one chart at a time with tabs, "Custom" pill, default group from `matchMedia`
- [ ] T043 [US5] Styles below 1100 px in `src/http/style.ts`, removing the card rules that go with the cards

## Phase 11: User Story 8 - Realistic fake team (P3)

- [ ] T044 [US8] Write failing test in `test/integration/dev-fake-strava.test.ts`: about 40 riders, edge-case riders kept, some on consent version 2 and listed as not agreed
- [ ] T045 [US8] In `dev/fake-strava/samples.ts` and `seed.ts`: generator for about 25 riders in unused IDs 990001–990099, about 30 rides each, varied, with optional `consentVersion: 2` applied after `connectThroughApp` (`research.md` R11)

## Phase 12: Polish

- [ ] T046 Record the measured rows in `research.md`, and correct the stored rider summaries' figures only if they moved
- [ ] T047 Run `pnpm test`, `pnpm lint`, `pnpm typecheck` and `pnpm exec playwright test e2e/organiser-graphs.e2e.ts` on an alternate port if another worktree holds 8797; check 40 lines × 300 points on a throttled phone profile (`research.md` R4)

## Dependencies

- Phase 2 before everything. Phase 3 needs only Phase 2, and can ship on its own.
- Phases 4 and 5 before Phase 6. Phase 7 and 8 need Phase 6.
- Phases 9 and 10 change the layout whether or not graphs are on (FR-021), and need Phase 8 only for the switch.
- Phase 11 needs Phase 4, and is useful earlier for judging crowded graphs: consider it right after Phase 6.

## Suggested order

Phases 1 to 3 first, as one safe step that also lowers the Badges page's cost. Then 4 to 7 give usable graphs,
and 8 to 11 make them fit a team of 40.

**Tasks**: 47 in total. Foundational 7, Badges 4, US2 5, US7 2, US1 10, US3 4, US4 3, US6 2, US5 4, US8 2.
