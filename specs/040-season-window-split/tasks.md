# Tasks: Season and Qualification Window

**Input**: Design documents from `/specs/040-season-window-split/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/window.md, quickstart.md

**Tests**: Included. The constitution requires test-first (Principle V); each test is written and
seen failing before its implementation task.

**Organization**: by user story; US1 (Hamburg unchanged) is a guard that runs through every phase.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1–US5 from spec.md

---

## Phase 1: Setup

- [X] T001 Drop the draft working-tree changes (`git restore .` on the files listed in `git status`, after checking each holds only draft edits) and rebase `040-season-window-split` onto `origin/develop`, which holds the deadline countdown (#359)
- [X] T002 Run `pnpm vitest run test/teams/pages-snapshot.test.ts` and the season snapshot test on the rebased branch and confirm both pass untouched; these are US1's guard for every later task (`test/teams/__snapshots__/pages-snapshot.test.ts.snap`, `test/teams/__snapshots__/season-snapshot.txt` must not change)

---

## Phase 2: Foundational (blocks every story)

**Purpose**: the window start as its own setting and its own field.

- [X] T003 Add `QUALIFICATION_START_DATE` to all four team blocks in `wrangler.jsonc`: `hamburg` and `sandbox-hamburg` `"2026-09-01"`, `europe` and `sandbox-europe` `"2027-01-01"`; change `SEASON_START_DATE` in `europe` and `sandbox-europe` from `"2027-01-01"` to `"2026-09-01"`; run `pnpm types` to regenerate `worker-configuration.d.ts`
- [X] T004 Add `"QUALIFICATION_START_DATE"` to the `Settings` keys in `src/config.ts` and to the album's env pick in `album/routes.ts`; pass it through in `scripts/season-album.mjs` (read with `setting("QUALIFICATION_START_DATE")`, add `QUALIFICATION_START_DATE:<value>` beside `SEASON_START_DATE`)
- [X] T005 [P] Write failing tests in `test/unit/team-check-dates.test.ts` for `scripts/team-check.mjs`: refuse a block whose `SEASON_START_DATE` isn't a 1 September, whose `QUALIFICATION_START_DATE` is before the season start or after `QUALIFICATION_DEADLINE`, or whose deadline is after the season end (day before the next 1 September); accept the four real blocks
- [X] T006 Implement the date rules in `scripts/team-check.mjs` (FR-001, FR-003) until T005 passes and `node scripts/team-check.mjs` passes
- [X] T007 Write failing tests in `test/unit/rules-window.test.ts`: `countingWindow(env)` returns `{ seasonStart, windowStart, deadline }` from `SEASON_START_DATE`, `QUALIFICATION_START_DATE`, `QUALIFICATION_DEADLINE` and throws on a non-date window start; `inCountingWindow` uses `windowStart` (window start day counts, day before doesn't); `seasonEnd` reads `seasonStart` (2026-09-01 → 2027-08-31); `eventInWindow` uses `windowStart` for non-tour kinds and `seasonStart` for `tour_de_paris`
- [X] T008 In `src/rynke/rules.ts`, add `windowStart` to `CountingWindow` with doc "first day a ride can count (Rynke, pace, graphs)", keep `seasonStart` as "the season's first day (fetch, season end, badges, tour days)", read both in `countingWindow`, and switch `inCountingWindow` and `eventInWindow`'s non-tour branch to `windowStart` until T007 passes
- [X] T009 Temporarily rename `CountingWindow.seasonStart` to `seasonStartX` and run `pnpm typecheck` to list every reader (research R2); for each, choose per the R2 table and rename back, writing season readers as `seasonStart` and window readers as `windowStart`:
  - season: `src/db/participation.ts`, `src/db/team-events.ts`, `src/badges/catalog.ts`, `src/badges/evaluate.ts`, `src/badges/hints.ts`, `src/badges/view.ts`, `src/db/badges.ts`, `src/http/sections/badges.ts`, `album/load.ts`, `src/http/tour-example.ts` tour days
  - window: `src/rynke/pace.ts`, `src/rynke/weeks.ts`, `src/rynke/ride-figures.ts`, `src/rynke/apply.ts`, `src/db/rynke.ts`, `src/http/progress-view.ts`, `src/http/progress-section.ts`, `src/http/organiser/progress-graphs.ts`, `src/http/organiser/overview.ts`, `src/http/sections/team.ts`, `src/http/rider-view.ts`, `src/http/rider-sections.ts`
  - `dev/fake-strava/samples.ts`: decide per use; sample dates stay relative to `SEASON_START_DATE`
- [X] T010 [US1] Re-run T002's snapshots and `pnpm vitest run test/unit/rides.test.ts test/unit/badges-for.test.ts`; Hamburg output must be unchanged (both dates equal)

**Checkpoint**: Europe's season and window are separate in data and type; Hamburg unchanged.

---

## Phase 3: User Story 1 – Hamburg stays exactly as it is (P1)

**Goal**: no Hamburg page, result or stored row changes (FR-019, SC-001).

**Independent test**: Hamburg's pages snapshot, season snapshot and every existing Hamburg test pass without edits.

- [X] T011 [P] [US1] Add a case to `test/teams/rules.test.ts` (or the nearest team rules test): for Hamburg's `countingWindow`, `seasonStart === windowStart`, and `evaluateRides` over Hamburg's sample rides never yields `before_window`
- [X] T012 [US1] After every later phase, re-run the Hamburg snapshot tests; any diff in a `.snap` file is a bug, never an update (do not run with `-u`)

---

## Phase 4: User Story 2 – Europe's season starts on 1 September (P1)

**Goal**: Europe fetches from 1 September and ends its season on 31 August 2027.

**Independent test**: a Europe rider connecting on 18 November 2026 has every ride from 1 September listed; season end shown is 31.08.2027.

- [X] T013 [P] [US2] Write a failing test in `test/integration/dev-fake-strava.test.ts` (Europe project): a sample rider seeded on a fake day in November 2026 gets activities fetched from `2026-09-01`, none before (fetch epoch `config.seasonStart`, used in `src/work/activity-page.ts`, `src/http/catch-up.ts`, `src/http/auth.ts`, `src/work/scheduled.ts`)
- [X] T014 [P] [US2] Write a failing test that Europe's season end in `album/load.ts` and `src/db/participation.ts` is `2027-08-31`, and that the "before the season" waiting state in `src/http/sections/overview.ts` follows `SEASON_START_DATE` (FR-006, FR-007)
- [X] T015 [US2] Fix whatever T013/T014 show still reads the window start for season things (should be nothing after T009 beyond `src/http/sections/overview.ts`'s `renderWaiting` and `src/http/sections/rides.ts` line using `SEASON_START_DATE`)
- [X] T016 [US2] Re-pick Europe's e2e day in `package.json` `test:e2e:server:europe`: `RYNKE_FAKE_SEASON_DAY:70` → `192` (70 + 122 days from 1 September to 1 January: the same calendar day as today; confirm with `dev/clock.ts`); also update any Europe day in `dev/fake.env` or the `pnpm dev:europe` script the same way

**Checkpoint**: Europe's season is 1 September – 31 August.

---

## Phase 5: User Story 3 – Pre-window rides listed, marked, not counted (P1)

**Goal**: orange "zählt noch nicht" rides with "–" and the open reason, in no graph or total.

**Independent test**: before 1 January in Europe fake mode, a ride meeting every rule shows the orange chip, "–", the reason, 0 Rynke, and no graph shows it.

### Tests first

- [X] T017 [P] [US3] Write failing tests in `test/unit/rides-window.test.ts` for `evaluateRides` with season start 2026-09-01, window start 2027-01-01, deadline 2027-06-30:
  - a 2026-11-15 ride meeting every rule → `counts: false`, `reasons: ["before_window"]`, `distanceRynke: 0`, `elevationDm` = its real elevation
  - a 2026-11-15 ride under `minRideKm` → reasons contain `before_window` and `too_short`, `elevationDm: 0` (FR-013)
  - a 2027-01-01 ride → counts; a 2026-12-31 ride → `before_window`
  - a ride before 2026-09-01 or after the deadline → `outside_window`, never `before_window`
  - two overlapping pre-window rides → the larger keeps `["before_window"]`, the other `["overlap"]`
  - a pre-window ride overlapping a counting ride cannot happen across days; skip
  - `riding` sums ignore pre-window rides
- [X] T018 [P] [US3] Write failing tests in `test/unit/rider-sections.test.ts`: a ride view with status `not-yet` renders class `ride-not-yet`, text `rynke.ride.notYet`, "–" for Training Rynke and counted elevation, and an open "Warum?" box with `rynke.reason.before_window` and the window start date `01.01.2027`; a ride with `before_window` plus another reason renders red `ride-not-counting` with both reasons
- [X] T019 [P] [US3] Write a failing integration test in `test/integration/me-rynke.test.ts` (Europe): a rider with only pre-window rides has the same Rynke, gauges, ranking, pace, progress chart and ride figures as a rider with no rides (FR-009, FR-010), and the organiser's rider rides view shows the same orange mark (done in `test/teams/pre-window.test.ts`, which runs with Europe's real dates; organisers see no ride cards, so that part has nothing to check)

### Implementation

- [X] T020 [US3] Add `"before_window"` to `REASON_CODES` in `src/rynke/rides.ts`; in `reasonsFor` push `before_window` for `seasonStart <= date < windowStart`, `outside_window` for `date < seasonStart` or `date > deadline`
- [X] T021 [US3] In `evaluateRides` (`src/rynke/rides.ts`): overlap candidates are rides with no reason or exactly `["before_window"]`; the overlap loop keeps them together; a result whose reasons are exactly `["before_window"]` stores its real `elevationDm`; `distanceRynke` stays 0 and `counts` false; `sums` still reads counting results only. Export `isPreWindow(reasons)` for reuse
- [X] T022 [US3] Mark `before_window` as not fixable in the fixable-reasons list (wherever `too_short` sits; see `test/unit/fixable-reasons.test.ts`)
- [X] T023 [US3] In `src/http/rider-view.ts`: add ride status `"not-yet"` for `isPreWindow(reasons)`; add reason line `{ code: "before_window"; date: windowStart }` (from `context.windowStart`, added next to `seasonStart` at line ~71); keep `before_season`/`after_deadline` mapping for `outside_window`
- [X] T024 [US3] In `src/http/rider-sections.ts` `rideCard`: `STATUS["not-yet"] = { cls: "ride-not-yet", text: "rynke.ride.notYet" }`; `pending` true for `being-evaluated` and `not-yet` (shows "–"); `explanation()` open for `does-not-count` and `not-yet`; reason text `case "before_window": i18n.t("rynke.reason.before_window", { date: day(i18n, reason.date) })`
- [X] T025 [P] [US3] In `src/http/style.ts` add `.ride-not-yet .chip{background:var(--rp-push-container);color:var(--rp-on-push-container)}` next to `.ride-not-counting` (the drafted `--rp-bar-warning` on a 26 % mix gives only about 3.4:1 contrast in the light theme)
- [X] T026 [P] [US3] Add to all ten catalogs in `src/i18n/messages/` (de first, en, then da, fi, fr, is, lt, nb, nl, sv): `"rynke.ride.notYet"` (de "zählt noch nicht", en "doesn't count yet") and `"rynke.reason.before_window"` (de "Die Qualifikation beginnt am {date}. Ab dann zählen Fahrten wie diese.", en "Qualifying starts on {date}. Rides like this one count from then on."); `test/unit/catalogs.test.ts` must pass
- [X] T027 [US3] Check every `counts = 1` reader stays as is (`src/db/rider-view.ts`, `src/db/organiser-graphs.ts`, `src/db/rider-summaries.ts`) so no graph or total sees pre-window rides; make T017–T019 pass

**Checkpoint**: pre-window rides show orange and add nothing.

---

## Phase 6: User Story 4 – Badges count from the season start (P2)

**Goal**: ride badges count pre-window rides; Europe lists every badge but the event-only ones.

**Independent test**: before 1 January, a Europe rider with November rides and a 24 December ride has the winter and Christmas Eve badges; Training Rynke badge unmoved.

- [X] T028 [P] [US4] Write failing tests in `test/unit/badges-for.test.ts`: Europe's `badgesFor` (season start 2026-09-01 to deadline) equals Hamburg's minus event-only categories, including the November/December winter badges, Christmas Eve, Christmas, Festive 500, Sonnenwende, Winterschlaf beendet, New Year's Eve sparkler, Festive gang (FR-016)
- [X] T029 [P] [US4] Write failing tests in `test/integration/badges-section.test.ts` (Europe): pre-window rides that meet every rule count for distance, elevation, longest ride, virtual, winter-month days, surprise days and team totals; a pre-window ride that also fails another rule counts for none; the Training Rynke and team Training Rynke badges don't move; badge news fires as for any badge (FR-014, FR-015)
- [X] T030 [US4] In `src/db/badges.ts` add `export const BADGE_RIDE = "(r.counts = 1 OR r.reasons = '[\"before_window\"]')"` with a comment pointing to research R4, and replace `r.counts = 1` with it in the badge queries only (`ownFiguresFromRides` and the team badge totals); add a test that the stored JSON of a pre-window result is exactly `["before_window"]`
- [X] T031 [US4] Make `badgesFor`, `src/badges/evaluate.ts` and `src/work/team-badge-news.ts` use the season start to the deadline (already chosen in T009); make T028–T029 pass
- [X] T032 [US4] Invert feature 039's "no rides in November or December" check for Europe samples in `test/integration/dev-fake-strava.test.ts` / `test/unit/badge-*.test.ts` (FR-020). There was no negative check to invert; a new test asserts November, December and 24 December rides

**Checkpoint**: Europe earns ride badges before the window.

---

## Phase 7: User Story 5 – Riders are told before the window opens (P2)

**Goal**: the status box says when qualifying starts and that badges can already be earned.

**Independent test**: Europe You page before and on 1 January 2027.

- [X] T033 [P] [US5] Write failing tests in `test/unit/rider-sections.test.ts`: before `windowStart`, `renderSummary` shows `rynke.deadline.notStarted` with the window start date and no countdown or plan sentence; on `windowStart` the countdown and plan show; with `seasonStart === windowStart` (Hamburg) the pre-window text never shows on a season day
- [X] T034 [US5] Make the status box's "before" state in `src/http/rider-sections.ts` / `src/http/sections/overview.ts` compare today with `windowStart` and pass its date
- [X] T035 [P] [US5] Change `"rynke.deadline.notStarted"` in all ten catalogs: de "Die Qualifikation beginnt am {date}. Bis dahin zählen deine Fahrten noch nicht für die Qualifikation, Badges sammelst du aber schon jetzt. 🏅", en "Qualifying starts on {date}. Until then your rides don't count towards qualifying, but you can already earn badges. 🏅", the other eight translated from these

**Checkpoint**: all stories done.

---

## Phase 8: Fake mode, e2e, polish

- [X] T036 Add September–December 2026 rides to Europe's sample riders in `dev/fake-strava/samples.europe.ts` (dated relative to `SEASON_START_DATE`): November rides for the winter badge, one on 24 December, one short pre-window ride (red with both reasons), so a rider seeded before 1 January has rides, badges and 0 Rynke (FR-020)
- [X] T037 Add a pre-window check to `e2e/europe-smoke.e2e.ts` on a second Europe server day before 1 January (e.g. `RYNKE_FAKE_SEASON_DAY:78`, 18 November 2026; a second webServer or project in `playwright.config.ts` on its own port): orange chip, open reason, status box text, Christmas Eve badge listed (FR-021). Done in its own file `e2e/europe-pre-window.e2e.ts` (project `europe-pre-window`, port 8799); a badge still to earn shows only as an outline on `/me/badges`, so Christmas Eve is checked on `/_dev/badges`, which lists the same badges
- [X] T038 [P] Update Europe's rules handout `docs/teams/europe/rynke-points.md` if it names the season dates; rebuild `public/teams/europe/rynke-points.pdf` only if it changed
- [X] T039 Run the targeted tests touched above plus the Hamburg snapshots once more (T012); leave the full lint/typecheck/test/e2e run to CI
- [X] T040 Commit per phase with Conventional Commits; open the pull request into `develop` only when the user asks; after the release the user runs **Sandbox reseed** for Europe

---

## Dependencies

- Phase 1 → Phase 2 → every story.
- US1 is a guard, checked after each phase.
- US2 (Phase 4) before US3: pre-window rides only exist once Europe fetches from 1 September.
- US3's `before_window` (T020–T021) before US4 (badges read it).
- US5 depends only on Phase 2.
- Phase 8's samples (T036) help the integration tests of US3/US4 but can follow them.

## Parallel examples

- Phase 2: T005 with T007.
- US3: T017, T018, T019 together; then T025 and T026 beside T020–T024.
- US4: T028 with T029.
- US5: T033 with T035; US5 can run beside US3.

## Implementation strategy

MVP: Phases 1–5 (Hamburg guarded, Europe's season fixed, pre-window rides marked). Then badges
(US4) and the status box (US5), then samples and e2e. One pull request for the whole feature.
