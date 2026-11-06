---
description: "Tasks for the ride stats leaderboard"
---

# Tasks: Ride Stats Leaderboard

**Input**: Design documents from `specs/032-ride-stats-leaderboard/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/pages.md, contracts/messages.md, quickstart.md

**Tests**: required (constitution Principle V, quickstart.md). Write each test first and see it fail.

**Design**: read the design draft "RynkePoints Ride Stats" (https://claude.ai/artifact/1FzcR5Qd9UfTdxmX9wCsXW) before any markup or style task (FR-023). Every word comes from the catalogs in every language (contracts/messages.md).

**Order**: the consent revision and the visibility rows come before any page shows a ride figure (Principle I). The four stories then build on one shared foundation. US4's "no Rynke views" page reuses the rows of US1 and the team figures of US3, so it comes last.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: the user story in spec.md

## Phase 1: Setup

**Purpose**: the schema and the two settings.

- [X] T001 Add `rides` to `rider_summaries` and `revision` to `consent_records` in the `COLUMNS` list of `test/integration/schema-minimisation.test.ts` (red)
- [X] T002 Create `migrations/0026_ride_figures.sql`: `ALTER TABLE rider_summaries ADD COLUMN rides TEXT NOT NULL DEFAULT '[]'` and `ALTER TABLE consent_records ADD COLUMN revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0)`; comment that `rides` is derived data and that the previously deployed code never names either column (T001 green)
- [X] T003 [P] Write failing tests in `test/unit/config.test.ts` for `rideFigures(env)` and `rynkeViews(env)`: `"on"` → true, `"off"` → false, anything else throws, as for `trainingLeaderboard`
- [X] T004 Add `RIDE_FIGURES` and `RYNKE_VIEWS` to `Settings` and the two readers to `src/config.ts`; add both as `"on"` to `vars` in `wrangler.jsonc` and to the bindings in `vitest.config.ts` (commented "Pinned; the off tests override it per request"); run `pnpm types` to update `worker-configuration.d.ts` (T003 green)

**Checkpoint**: `pnpm test` passes; nothing reads the new columns or settings yet.

---

## Phase 2: Foundational

**Purpose**: the stored rides, the pure figures, the consent revision and the visibility rows that every story needs.

### Stored rides (research R1)

- [ ] T005 [P] Extend `test/unit/rider-summary.test.ts` with failing tests: `rides` holds one `[date, distanceM, elevationDm]` per counting ride with the full `distance_m` and full `elevationDm` (a 79 km ride gives 79000, not 70000); non-counting rides are absent; unknown elevation gives 0; entries sorted by date, then distance, then elevation, so any input order gives identical text; no ride ID, name or time in the text; `RIDER_SUMMARY_VERSION` is 3
- [ ] T006 In `src/rynke/summary.ts` add `RideEntry = [date: string, distanceM: number, elevationDm: number]`, `rides` to `RiderSummary`, write it in `summaryOf` from the counting rides `figuresOf` passes in, add a `parseRides` parser, and set `RIDER_SUMMARY_VERSION = 3` and `RIDE_SUMMARY_SINCE = 3`, keeping `TEAM_SUMMARY_SINCE = 1` and `OWN_SUMMARY_SINCE = 2` (T005 green)
- [ ] T007 Extend `test/integration/rider-summaries.test.ts` with failing tests: after an evaluation `rides` matches `summaryOf`; a ride starting or stopping to count, edited or deleted rewrites it; a second unchanged evaluation writes no row (measured with `test/support/d1-rows.ts`)
- [ ] T008 Write `rides` in `upsertSummaryStatement` in `src/db/rider-summaries.ts`, and compare it in `riderWrites` in `src/rynke/apply.ts` like the other columns (T007 green)
- [ ] T009 In `src/db/rider-summaries.ts` add a reader for `rides` of rows with `version >= RIDE_SUMMARY_SINCE`, and `readRidesAddedUp(db, athleteIds, window)` for riders without such a row: counting `ride_results` joined with `activities`, giving the same entries `summaryOf` would; cover both in `test/integration/rider-summaries.test.ts` (a rider with a version 2 row gets correct figures, never a false zero)

### Pure ride figures (research R3)

- [ ] T010 [P] Write failing tests in `test/unit/ride-figures.test.ts`: `periodOf` for season, month and Monday-to-Sunday week (a week across a month and a year end, cut to season start and deadline); `figuresOf` sums 42.7 km/380 m and 6.1 km/40 m to 2 sessions, 48.8 km, 420 m (US1 scenario 2); `typicalRide` for odd, even (mean of the middle two), one and no rides (null); `rideRows` ranks on the shown value (`km = round(distanceM / 100) / 10`, `elevationM = round(elevationDm / 10)`), so 48.84 km and 48.76 km share a place; ties give 1, 2, 2, 4; order among equals is the picked figure, then sessions, km, elevation, then athlete ID; riders with zeros are ranked; no `RideRow` carries an athlete ID or name; `toNext` in shown units plus one unit; `teamRideTotals` sums every rider and takes the median over all their rides together; `teamWeeksKm` per week end
- [ ] T011 Create `src/rynke/ride-figures.ts` with the types of data-model.md (`RideFigure`, `RankBy`, `Period`, `DateRange`, `Figures`, `RideRider`, `RideRow`, `RideViewer`, `TeamRideTotals`) and the pure `periodOf`, `figuresOf`, `typicalRide`, `rideRows`, `teamRideTotals`, `teamWeeksKm`; reuse `neighbourhood` and `MEDALS` from `src/rynke/leaderboard.ts` and `weekEndOf` from `src/rynke/weeks.ts` (T010 green)

### Consent 3.1 (research R5)

- [ ] T012 [P] Extend `test/unit/consent-versions.test.ts` with failing tests: version 3 has `revisions: [{ revision: 1, published, changes: ["consent.rideFigures"] }]`; versions 1 and 2 have none; revisions are consecutive from 1; a revision adds no required scope (constitution 2.4.0: a new scope is a major change); `currentRevision` gives `{ version: 3, revision: 1 }`; `consentLabel` gives "3.1", and "3" for revision 0; a rider on 3 with revision 0 is `current`; a rider renewing from 2 gets `consent.rideFigures` among the changes
- [ ] T013 In `src/consent.ts` add `ConsentRevision` (`{ revision: number ≥ 1, consecutive; published: "YYYY-MM-DD"; changes: MessageId[] }`), `revisions` on every `ConsentVersion`, revision 1 of version 3 dated the release day, `currentRevision` and `consentLabel`; keep `consentState` comparing major versions only, and add every newer revision's changes to an older rider's changes (T012 green)
- [ ] T014 Add `consent.rideFigures` and the revised `consent.short.shown` in en and de per contracts/messages.md to `src/i18n/messages/en.ts` and `src/i18n/messages/de.ts`, and render the paragraph in the consent summary's details in `src/http/consent-form.ts`; extend the test that the summary names every `RiderData` shared with someone else
- [ ] T015 Extend `test/integration/consent-gate.test.ts`, `test/integration/connect.test.ts` and `test/integration/callback.test.ts` with failing tests: a new acceptance records `revision = 1`; the form still posts `consent=3`; a rider with a version 3 record of revision 0 passes the gate and is not asked again (US3 scenario 3, SC-004)
- [ ] T016 Add `revision` to `Consent` and to `recordConsent` in `src/db/consents.ts`, and pass `currentRevision(CONSENT_VERSIONS).revision` from `src/http/auth.ts` and `src/http/consent-gate.ts`; `INSERT OR IGNORE` and the primary key `(athlete_id, version)` stay (T015 green)
- [ ] T017 Extend `test/integration/settings.test.ts` (red), then show `consentLabel` of the record in "Agreed on {date} (version {version})" in `src/http/sections/settings.ts`: "3.1" for revision 1, "3" for revision 0

### Visibility (research R4)

- [ ] T018 [P] Extend `test/unit/visibility.test.ts` with failing tests for `rideFigures` (audience `TEAM`, since 3) and `rideFiguresByName` (audience `ORGANISER_ONLY`, since 3)
- [ ] T019 Add both items to `VISIBILITY` and `SINCE_VERSION` in `src/visibility.ts` (T018 green)

**Checkpoint**: unit and integration tests pass; consent 3.1 is recorded, nobody is asked again, and no page shows a ride figure yet.

---

## Phase 3: User Story 1 - Rider ranks by a ride figure (P1) 🎯 MVP

**Goal**: "Rank by" and the period on the Training view's ranking, with rows and the place card following the pick.

**Independent Test**: in fake mode, sign in as a sample rider, pick each figure and period, and compare places and figures with hand counts.

- [ ] T020 [US1] Write failing tests in a new `test/integration/team-ride-figures.test.ts`, beside `team-leaderboard.test.ts`: plain `/team` is today's page plus `nav.rank-by` with Rynke `aria-current` and no `nav.rank-period`; `by=km`, `by=sessions`, `by=elevation` each order rows and give places by that figure; `period=month` and `period=week` count only rides started in that period (US1 scenario 6); unknown `by` or `period` falls back to the default; links keep `kind` and `all` and leave out default values; the Team Rynke view (`kind=team`) ignores `by`; equal shown figures share a place (US1 scenario 7); no element carries another rider's name, athlete ID, profile link or picture, checked as a rider and as an organiser (FR-019, SC-005, US2 scenario 4); a non-counting ride is in no figure (US1 scenario 4)
- [ ] T021 [US1] In `src/db/team.ts` add the consent-filtered ride read for `/team`: `rides` of the team's listed riders filtered with `sharedRiderExists("r", SINCE_VERSION.rideFigures)` inside SQL, in the same batch as `readTeam`'s other statements, and the added-up fallback of T009 for riders without a version 3 row; read it only when a ride figure is picked
- [ ] T022 [US1] Parse `by` (`sessions`, `km`, `elevation`) and `period` (`month`, `week`, default `season`) in `src/http/sections/team.ts`, only on the Training view
- [ ] T023 [US1] Render in `src/http/sections/team.ts` per contracts/pages.md: `nav.rank-by` with four `a.segmented[data-swap]` links; `nav.rank-period` with Season, Month and Week only with a ride figure; `li.row` with medal or place, "You" on the own row, the picked figure with `.ride-bar` (width as a share of the leader's shown value, `team.ride.bar` as its text alternative) and the other two figures small; no sparkline and no typical ride in any row; the neighbourhood toggle and "riders ahead/behind" as today
- [ ] T024 [US1] Render the place card for a ride figure in `src/http/sections/team.ts`: place out of the ranked riders, the picked figure and period, `team.ride.place.next` or the lead line, and `team.ride.typical` with `team.ride.typical.hint` below; no typical ride with no ride in the period (US1 scenario 8, FR-010)
- [ ] T025 [US1] Show the viewer's own figures and typical ride without a place when the viewer isn't in the ranked riders (FR-020), and the "nobody has ridden yet" state with every rider on zero (edge case)
- [ ] T026 [P] [US1] Add `team.rankBy.*`, `team.period.*`, `team.ride.sessions`, `.km`, `.elevation`, `.typical`, `.typical.hint`, `.nobodyYet`, `.place.next` and `.bar` in en and de per contracts/messages.md to `src/i18n/messages/en.ts` and `src/i18n/messages/de.ts`
- [ ] T027 [P] [US1] Style `nav.rank-by`, `nav.rank-period`, `.ride-bar` and the typical ride line in `src/http/style.ts`, following the design draft at phone and wide widths and in every theme (T020 green)
- [ ] T028 [US1] Extend `test/integration/d1-round-trips.test.ts` and `test/integration/d1-rows.test.ts`: plain `/team` reads the same rows in the same round trips as before; a ride figure adds no round trip and at most one consent check per rider (SC-006)

**Checkpoint**: a rider can rank by any figure and period; plain `/team` is unchanged.

---

## Phase 4: User Story 2 - Organisers follow sessions by name (P1)

**Goal**: a Sessions column with the typical ride in the riders table and a fourth Progress graph.

**Independent Test**: as the sample organiser, check the column and graph against hand counts.

- [ ] T029 [US2] Extend `test/integration/organiser-overview.test.ts` with failing tests: with `ORGANISER_FIGURES` "full" a `th` Sessions before Distance; a rider with 12 counting rides shows `<span>12</span><small class="typical">typical … km</small>`; a rider with no ride shows 0 and no typical ride; a rider below version 3 shows "–"; the percent table has no column; the graph data's `GraphDay` has five values with sessions per day and `teamSum.sessions`; a rider below version 3 adds nothing to `teamSum.sessions`
- [ ] T030 [US2] In `src/db/organiser-graphs.ts` select `s.rides` from version 3 rows in `organiserGraphsStatement` (or add up for riders without one), filtered with `SINCE_VERSION.rideFiguresByName`, and add `rides: RideEntry[]` to `GraphRow` in `toGraphRows`
- [ ] T031 [US2] In `src/http/organiser/progress-graphs.ts` make `GraphDay` `[dayIndex, outdoorM, virtualM, elevationDm, sessions]` and add `sessions: number[]` to `teamSum`
- [ ] T032 [US2] Add the Sessions column to the full table in `src/http/organiser/overview.ts` (season count and season typical ride, "–" below version 3, the count after the distance in the phone's one-line rows), and the fourth tab and graph after Elevation
- [ ] T033 [P] [US2] Add `"sessions"` to `GRAPH_METRICS` in `public/app.js` with whole-number y ticks; range presets, Running total, Per day, rider picker, team lines, legend and screen-reader table come from the shared code
- [ ] T034 [P] [US2] Add `organiser.overview.column.sessions`, `organiser.overview.typical`, `organiser.graphs.title.sessions` and `organiser.graphs.tab.sessions` in en and de to `src/i18n/messages/en.ts` and `src/i18n/messages/de.ts`; style `small.typical` in `src/http/style.ts` (T029 green)
- [ ] T035 [US2] Fix existing tests that pin `GraphDay`'s length, `GRAPH_METRICS` or the organiser table's columns, only where the new value or column is the cause

**Checkpoint**: organisers see sessions by name in the organiser area only.

---

## Phase 5: User Story 3 - The team's figures (P2)

**Goal**: the team line above the rows; consent filtering over every team figure.

**Independent Test**: compare the team line with sums of the sample riders' counting rides, with a sample rider held back below version 3.

- [ ] T036 [US3] Extend `test/integration/team-ride-figures.test.ts` with failing tests: `p.ride-team-line` gives the sums of the rows and the median of all ranked riders' rides for the period; with no ride in the period it says nobody has ridden yet; a rider below version 3 is in no row, total, typical ride, bar or count (US3 scenario 2, SC-004); the ride count may differ from the Rynke count
- [ ] T037 [US3] Render `p.ride-team-line` from `teamRideTotals` in `src/http/sections/team.ts` with `team.ride.teamLine` and `team.ride.nobodyYet`; add both keys in en and de to `src/i18n/messages/en.ts` and `src/i18n/messages/de.ts` (T036 green)

**Checkpoint**: the team line follows the pick and counts only riders on version 3.

---

## Phase 6: User Story 4 - A team switches the feature on or off (P1)

**Goal**: `RIDE_FIGURES` off leaves no trace; `RYNKE_VIEWS` off gives the single view of FR-012.

**Independent Test**: override the two settings per request in tests, and locally in `wrangler.jsonc` in fake mode.

- [ ] T038 [US4] Extend `test/integration/team-ride-figures.test.ts`, `test/integration/organiser-overview.test.ts` and `test/integration/privacy.test.ts` with failing tests for `RIDE_FIGURES` "off": no `nav.rank-by`, any `by` and `period` ignored, `/team` markup as today; no Sessions column, no fourth tab, `rides` not selected (checked with `test/support/d1-rows.ts`); no `privacy.team.rideFigures` (US4 scenario 1, SC-003)
- [ ] T039 [US4] Read `rideFigures(env)` in `src/http/sections/team.ts`, `src/http/organiser/overview.ts`, `src/db/organiser-graphs.ts` and `src/http/privacy.ts` so nothing of the feature is read or rendered when off (T038 green)
- [ ] T040 [US4] Add `privacy.team.rideFigures` in en and de to `src/i18n/messages/en.ts` and `src/i18n/messages/de.ts`, shown in `src/http/privacy.ts` only while `RIDE_FIGURES` is on (FR-022); extend `test/integration/privacy.test.ts` for the on case
- [ ] T041 [US4] Extend `test/integration/team-ride-figures.test.ts` with failing tests for `RYNKE_VIEWS` "off": no kind switch, no Rynke cards, peloton, quote or coin; the team card with season km, sessions, elevation and `team.ride.total.thisWeek`; a chart of the team's km per week with the running total; the place card; "Rank by" with Sessions, km and Elevation only, km picked when `by` is absent; `kind=team` gives the same single view (US4 scenario 3, FR-012)
- [ ] T042 [US4] Build the single view in `src/http/sections/team.ts` from `teamRideTotals` and `teamWeeksKm`, reusing the existing `weekBars` chart markup; always read rides with `RYNKE_VIEWS` off; add `team.ride.total.heading`, `team.ride.total.thisWeek`, `team.ride.chart.heading` and `team.ride.chart.label` in en and de (T041 green)

**Checkpoint**: both switches behave as US4; no code branches on a team's name.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T043 [P] Give the synthetic samples in `dev/fake-strava/samples.ts` a few short trips of about 5 to 8 km and one rider with many of them, keeping the riders held back below version 3 (research R9); no real rider data
- [ ] T044 Write `e2e/ride-stats.e2e.ts`: on a phone and a wide screen, sign in as a sample rider, pick km, then Week, then Sessions, and check places and the place card follow in place without a reload; as the sample organiser, open Orga › Riders and check the Sessions tab draws; run it targeted with `pnpm exec playwright test e2e/ride-stats.e2e.ts`
- [ ] T045 Fix existing tests that pin `RIDER_SUMMARY_VERSION`, the `consent_records` columns or the `/team` markup, only where this feature is the cause (plan.md Risks)
- [ ] T046 Run `pnpm lint`, `pnpm typecheck` and `pnpm test`; leave the full `pnpm test:e2e` to CI

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none.
- **Foundational (Phase 2)**: needs Setup. Blocks every story, because no figure may be shown before consent 3.1 and the visibility rows exist (Principle I).
- **US1 (Phase 3)**: needs Foundational.
- **US2 (Phase 4)**: needs Foundational only; can run beside US1.
- **US3 (Phase 5)**: needs US1's ride read and rows.
- **US4 (Phase 6)**: the `RIDE_FIGURES` off part needs US1 and US2; the `RYNKE_VIEWS` off part needs US1 and US3.
- **Polish (Phase 7)**: needs the stories it tests.

### Within Each Story

- The failing test first, then the read, then the markup, then the texts and styles.
- Tasks on `src/http/sections/team.ts` (T022–T025, T037, T042) run one after another.
- Tasks on the message catalogs touch the same two files, so they don't run in parallel with each other.

### Parallel Opportunities

- T003 beside T001–T002.
- In Phase 2: T005, T010, T012 and T018 (tests in different files); T006, T011, T013 and T019 once their tests are written.
- US2 (T029–T035) beside US1 (T020–T028).
- T026 beside T027; T033 beside T034; T043 beside any story.

## Parallel Example: Phase 2

```text
Task: "Extend test/unit/rider-summary.test.ts for rides (T005)"
Task: "Write test/unit/ride-figures.test.ts (T010)"
Task: "Extend test/unit/consent-versions.test.ts for revisions (T012)"
Task: "Extend test/unit/visibility.test.ts for the two items (T018)"
```

## Implementation Strategy

### MVP First

1. Setup and Foundational: consent 3.1 recorded, nobody asked again.
2. US1: ranking by a ride figure on `/team`. Stop and check against hand counts in fake mode.

### Incremental Delivery

1. US1, then US2 (organisers), then US3 (team line), then US4 (switches and the single view).
2. Each step keeps plain `/team` unchanged (SC-003).

## Notes

- Checks on the live site happen after the release, not as tasks here.
- Commit after each task or logical group, Conventional Commits.
- Fixtures are synthetic only.
