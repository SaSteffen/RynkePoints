---
description: "Task list for the Rider View of Own Rynke — all user stories"
---

# Tasks: Rider View of Own Rynke

**Input**: Design documents from `/specs/005-rider-view/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Scope**: every user story, delivered as plan.md's
[delivery phases](plan.md#delivery-phases):
- **US1** (Phase 3) is the first delivery. It is simple on purpose: the tally as
  plain numbers and the 20 newest rides with their points. It is releasable on
  its own.
- **US2, US3a, US4, US5 and US6** (Phases 4–8) follow in any order. Each one is
  its own pull request, and none removes anything an earlier delivery shows
  (FR-006).
- **US3b** is built as its inputs arrive (research R5): its team events
  (Phase 9) now that feature 003 Story 3 is merged, its corrections (Phase 9b)
  once feature 003 Story 6 is merged.
- **US7**: the diagrams came with the spec and the plan. Phase 11, the last
  phase, checks the build against them (FR-092).

**Tests**: REQUIRED. Constitution Principle V (Test-First, NON-NEGOTIABLE):
- Every test task comes before the implementation it covers. Run it, confirm it
  fails (red), then implement (green).
- Strava is never contacted: integration tests use `test/support/fake-strava.ts`,
  which fails on any unexpected request.
- Fixtures are synthetic (Principle I).
- Integration tests assert the German text of
  [contracts/messages.md](contracts/messages.md), and a few also check the
  English.

**Organization**:
- Phase 2 holds what every story needs: the rules history, the exported virtual
  share and a seed helper.
- Each story phase then adds its catalog keys, view-model fields, render
  function, CSS and tests.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: the user story the task belongs to (US1, US2, US3a, US3b, US4, US5, US6, US7)

## Conventions used by every task

**Code**
- Paths are relative to the repo root; source in `src/`, tests in `test/`.
- TypeScript strict, tabs, Biome-formatted. **No new dependency and no
  migration** (research R17).
- `src/http/rider-view.ts` is pure: no D1, no `I18n`, no clock, no Strava, no
  imports from `src/db/` except types and the `RIDES_PER_PAGE` constant
  (research R6).
- **The page only reads** (FR-003). `src/db/rider-view.ts` sends only `SELECT`
  statements, all in one `db.batch` (research R2). Nothing on `/me` enqueues,
  writes or calls Strava.
- **Every rule value comes from the rules of the stored version**:
  `rulesForVersion(balance.rulesVersion)` for targets and steps, and
  `rulesForVersion(result.rulesVersion)` for a reason's limit. When the version
  is unknown (`null`), the value is left out, never replaced by `CURRENT_RULES`
  (FR-013). No rule value appears in a catalog text.

**Text and markup**
- **Text**: every rider-facing string is a catalog key in **both**
  `src/i18n/messages/de.ts` and `en.ts`, with the wording of
  [contracts/messages.md](contracts/messages.md) (FR-060). A key is added only
  with its story.
- `test/unit/catalogs.test.ts`'s `CONTRACT_IDS` is the exact inventory, so every
  story adds its keys there too. Wording may be polished, with messages.md and
  the tests that quote it updated in the same change.
- **Formatting**: numbers with `i18n.formatNumber`, dates with `formatDate`,
  times with `formatTime` (US4), and units through the `units.*` messages
  (research R13).
- **Rounding**:
  - Gauge percentages are rounded down and capped at 100 (research R7).
  - Totals in metres are rounded down; missing metres are rounded up.
  - A reason's figure is rounded towards the limit it broke (research R12).
- **Markup and classes** follow [contracts/rider-page.md](contracts/rider-page.md)
  exactly: section order, class names, `aria-hidden` bars, `tap` links. CSS
  goes into `STYLE` in `src/http/html.ts`, scoped to those classes (research
  R9, R10).

**Tests and commits**
- **Integration tests**:
  - Build a `TestCtx` with `makeCtx()` and seed with `seedRider()`
    (`test/support/ctx.ts`) and the helpers of `test/support/rider-view.ts`
    (T006).
  - Sign in with `sessionCookie()` and call `handleFetch` with `request()`.
  - `SEASON_START_DATE` is `2026-01-01` in `vitest.config.ts`.
  - Test names carry the scenario number (`S1-6: …`, `S4-2: …`), as in feature
    003.
- **Commits**: commit after each task or logical group, with a Conventional
  Commits message (`test: …`, `feat: …`, `docs: …`).
- **Pull requests**: each delivery is its own PR into `develop`. Pushing and
  opening a PR happen only when the user asks.

---

## Phase 1: Setup

**Purpose**: confirm a green baseline in the worktree.

- [X] T001 Run `pnpm install`, `pnpm lint`, `pnpm typecheck` and `pnpm test` in the worktree root and confirm all green before any change. Note any failure that was already there in the task's commit message rather than fixing it here.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: rule values per version (research R3), the required amount without virtual rides as one definition, and synthetic seeding for the page.

**⚠️ CRITICAL**: every story phase depends on this phase.

### Tests for the foundation (write first, confirm red) ⚠️

- [X] T002 [P] Extend `test/unit/rules.test.ts` (research R3, quickstart "Rules history"):
  - `RULES_HISTORY` is non-empty, has unique `version`s, and contains `CURRENT_RULES` (the same object).
  - No entry has a higher version than `CURRENT_RULES.version`.
  - `rulesForVersion(v)` returns the entry for every `v` in the history, and `null` for `0`, `-1` and `CURRENT_RULES.version + 1`.
  - Every entry passes `assertValidRules`.
- [X] T003 [P] Extend `test/unit/tally.test.ts`:
  - `virtualShareRequired(CURRENT_RULES)` is `167`.
  - With `trainingThreshold: 300` and `maxVirtualShare: { num: 1, den: 3 }` it is `200`.
  - `tally()`'s `virtualShareMissing` cases that already exist stay unchanged.

### Implementation for the foundation

- [X] T004 [P] In `src/rynke/rules.ts`:
  - Add `export const RULES_HISTORY: readonly RynkeRules[] = [CURRENT_RULES]` and `export function rulesForVersion(version: number): RynkeRules | null`.
  - Extend the file's header comment: when raising `version`, keep the previous object in `RULES_HISTORY`, because the rider page explains stored results with it (research R3).
  - Makes T002 green.
- [X] T005 [P] In `src/rynke/tally.ts`:
  - Move the "required without virtual rides" line into `export function virtualShareRequired(rules: RynkeRules): number` (the `Math.ceil((threshold × (den − num)) / den)` with its comment).
  - `tally()` calls it.
  - Makes T003 green, and `test/unit/reference-riders.test.ts` stays green.
- [X] T006 [P] Create `test/support/rider-view.ts` with synthetic seed helpers that write straight to D1 (`env.DB`), the way `test/support/rynke.ts` builds rows:
  - **`seedBalance(athleteId, overrides)`**: inserts a `rynke_balances` row. The defaults are a consistent zero balance under `CURRENT_RULES.version` and `CURRENT_RULES.effectiveDate`: 0 Rynke, `elevation_to_next_step_dm` 10000, `training_missing` 250, `team_missing` 25, `virtual_share_missing` 167, `qualified` 0.
  - **`seedRide(athleteId, ride)`**: inserts one `activities` row (id, sport type, `start_date`/`start_date_local`, distance, moving and elapsed time, gain), plus a `ride_results` row when `ride.result` is given (counts, reasons JSON, `overlaps_activity_id`, `distance_rynke`, `elevation_dm`, `is_virtual`, `unknown_figures`, `rules_version`).
  - **`seedRides(athleteId, n, start)`**: n counting rides, one per day going back from `start`, for paging (45) and SC-005 (500).
  - **`riderPage(ctx, athleteId, path = "/me", lang?)`**: returns `{ status, html }` from `handleFetch` with a session cookie.
  - Use only synthetic IDs from `test/support/fixtures.ts`.

**Checkpoint**: the rules history and the seed helpers exist, and every story phase can start.

---

## Phase 3: User Story 1 — Tally and last 20 rides' points (Priority: P1, first delivery) 🎯 MVP

**Goal**: below the greeting and status, the rider sees Trainingsrynke and Teamrynke against their targets, what is missing, whether they are in, and the share without virtual rides when they have a virtual ride. The existing list of the 20 newest rides shows for each ride whether it counts, its Training Rynke and its metres towards the elevation total. A rider without a balance sees only a "still being worked out" notice. Plain numbers only: no gauges, reasons, paging or rules section yet.

**Independent Test**: seed balances and ride results for the riders of US1's independent test (in, short of one threshold, short of both, short only of the share without virtual rides, no balance), sign in as each, and compare the numbers and rows with what is stored (quickstart "US1 scenarios 1–11").

### Tests for User Story 1 (write first, confirm red) ⚠️

- [X] T007 [P] [US1] Create `test/unit/rider-view.test.ts` with `buildRiderView` tests for US1 (data-model.md "Validation and invariants"):
  - **Summary**: 12/0 → training `{ value 12, target 250, missing 238, reached false }`, team `{ 0, 25, 25, false }`, `qualified` false. 262/25 → both reached with missing 0. 400/20 → team missing 5, training reached, `qualified` false.
  - **Without virtual rides**: `withoutVirtual` is `null` when `virtualCount` is 0, and `{ 160, 167, 7, false }` when it is ≥ 1.
  - **S1-5**: rules with `trainingThreshold: 300` give target 300. Rules `null` give every target `null`, while values, missing amounts and `qualified` are still the stored ones (FR-013).
  - **Invariants**: `reached ⇔ missing === 0`, and `missing` is never negative.
  - **No balance**: `balance: null` gives `state: "not-worked-out"` with no summary.
  - **Ride lines**:
    - no result → `"being-evaluated"`, `distanceRynke` 0, `elevationM` 0;
    - `counts` → `"counts"` with the stored `distanceRynke` and `elevationM = elevationDm / 10`;
    - not counting → `"does-not-count"`, 0 and 0;
    - `isVirtual` from the result;
    - rows keep the read order.
- [X] T008 [P] [US1] Create `test/integration/me-rynke.test.ts` with one test per US1 scenario (German text, contracts/rider-page.md structure):
  - **S1-1**: "12 von 250", "238 fehlen noch", "0 von 25", "Noch nicht dabei".
  - **S1-2**: "Du bist dabei", "erreicht ✓", and no `rynke.withoutVirtual` text.
  - **S1-3**: "160 von 167" and "7 Trainingsrynke aus Fahrten draußen".
  - **S1-4**: names only "5 Teamrynke" as missing.
  - **S1-6**: the 79 km / 1240 m counting ride's main row has "zählt", `7` and "1.240 m", and the page has no per-ride elevation Rynke.
  - **S1-7**: a ride that doesn't count shows "zählt nicht", `0` and "0 m".
  - **S1-8**: a ride without a result shows "wird ausgewertet" and "–" twice.
  - **S1-9**: no balance gives `section.notice` with `rynke.notice.notWorkedOut`, and no `rynke-summary`, "von 250" or verdict.
  - **S1-10**: riders A and B with distinct figures each see only their own.
  - **S1-11**: signed out gives `302 /`.
  - **SC-004**: `tableCounts()` and a row snapshot are unchanged after `GET /me`, `ctx.queue.sent` is empty, and fake Strava saw no request.
  - **Order**: `section#rynke` comes after the import status and before `section#rides`, which comes before the consent section.
- [X] T009 [P] [US1] Update `test/integration/me-activities.test.ts` for the new ride table (contracts/rider-page.md `section#rides`):
  - The header cells are Datum, Distanz, Zählt?, Trainingsrynke and Für die Höhenmeter (and the English ones).
  - The sport type and the gain move into `tr.ride-details`.
  - Still the 20 newest, newest first, and only the rider's own.
  - The empty state is unchanged, and its assertion becomes `not.toContain("<table")`.
- [X] T010 [P] [US1] Extend `test/unit/catalogs.test.ts`:
  - Add the US1 keys of contracts/messages.md to `CONTRACT_IDS`:
    - labels: `rynke.training`, `rynke.team`, `rynke.withoutVirtual`;
    - notice: `rynke.notice.notWorkedOut`;
    - summary: `rynke.summary.heading`, `.ofTarget`, `.missing`, `.reached`, `rynke.verdict.in`, `.notYet`, `rynke.missing.training`, `.team`, `.withoutVirtual`;
    - ride table: `rynke.rides.col.status`, `.elevationTotal`, `rynke.ride.counts`, `.doesNotCount`, `.beingEvaluated`, `.virtual`.
  - Remove `me.recent.col.sport` and `me.recent.col.elevation`, which the new main row no longer uses.
  - Assert `de["rynke.training"] === "Trainingsrynke"`, `de["rynke.team"] === "Teamrynke"`, `en["rynke.training"] === "Training Rynke"` and `en["rynke.team"] === "Team Rynke"` (FR-060).
- [X] T011 [P] [US1] Extend `test/support/pages.ts` so the language tests cover the new sections (SC-008):
  - `seedPageRiders` seeds a balance and four rides (counting, not counting, being evaluated, virtual) for the `/me` rider.
  - Add a `RIDER_PAGES` entry for `/me` of a rider without a balance (the notice).
  - `test/integration/language-rendering.test.ts` and `no-hardcoded-copy.test.ts` then cover them unchanged. Confirm both are red until T014–T016 are done.

### Implementation for User Story 1

- [X] T012 [P] [US1] In `src/db/rynke.ts`, export the row mappers `fromBalanceRow` and `fromResultRow` (renamed `toStoredBalance` and `toStoredRideResult`), so the page maps rows the same way as feature 003. Existing tests stay green.
- [X] T013 [US1] Create `src/db/rider-view.ts` with `readRiderView(db, athleteId, page): Promise<RiderViewRead>` (data-model.md "The reading", research R2):
  - **One `db.batch`** of three `SELECT`s:
    1. `readBalanceStatement`;
    2. `SELECT (SELECT count(*) FROM activities WHERE athlete_id = ?1) AS rides, (SELECT count(*) FROM ride_results WHERE athlete_id = ?1 AND is_virtual = 1) AS virtual`;
    3. the table page: `activities a LEFT JOIN ride_results r` on rider and activity, `LEFT JOIN activities c ON c.athlete_id = a.athlete_id AND c.strava_activity_id = r.overlaps_activity_id`, `WHERE a.athlete_id = ?1 ORDER BY a.start_date DESC, a.strava_activity_id DESC LIMIT 20 OFFSET min((?2 - 1) * 20, max(0, ((SELECT count(*) FROM activities WHERE athlete_id = ?1) - 1) / 20 * 20))`.
  - **Export** that SQL as `RIDE_PAGE_SQL` for the query-plan test (T047).
  - **Mapping**:
    - rows go through T012's mappers;
    - the activity columns become `RideRow`;
    - `countedInstead` is `null` unless the join matched;
    - `page = min(requested, max(1, ceil(rides / 20)))`.
  - Rides without an activity row can't appear, because the join starts at `activities`.
- [X] T014 [P] [US1] Add the US1 keys of contracts/messages.md to `src/i18n/messages/de.ts` and `en.ts`, with the exact de and en texts:
  - labels, `rynke.notice.notWorkedOut`, summary, verdict, missing, rides columns, ride statuses and `rynke.ride.virtual`.
  - Remove `me.recent.col.sport` and `me.recent.col.elevation` from both catalogs, and record the removal under a "Removed" heading in [contracts/messages.md](contracts/messages.md).
- [X] T015 [US1] Create `src/http/rider-view.ts` with the US1 part of data-model.md's view model:
  - Types: `RiderView` (states `not-worked-out` and `ready`), `Summary`, `Condition`, `RideTable` (`rows`, `position`, `pager: null`) and `RideLine` (status, distanceRynke, elevationM, isVirtual, plus the activity fields).
  - `buildRiderView(read, rules, inEffect, context)`:
    - `rules` is `RynkeRules | null`, the version of the balance;
    - `inEffect` is `CURRENT_RULES`;
    - `context` is `{ seasonStart: string; importing: boolean }`.
  - Targets: `trainingThreshold`, `teamThreshold`, and `virtualShareRequired(rules)` (T005).
  - `missing` and `qualified` are the stored values (FR-004).
  - Later stories add their fields to these types. Leave them out for now, rather than adding placeholders.
  - Makes T007 green.
- [X] T016 [US1] Create `src/http/rider-sections.ts` with `renderNotice`, `renderSummary` and `renderRides` (`I18n` plus the view), with the markup of contracts/rider-page.md:
  - **Notice**: `section.notice` with `role="status"`.
  - **Summary**: `section#rynke.rynke-summary` with the verdict, `ul.rynke-missing` (only when not in, in the order training, team, without virtual), and the `dl`. An unknown target prints the value alone.
  - **Rides**: `section#rides` with `table.rides`:
    - a 5-cell main row with the class `ride ride-counting | ride-not-counting | ride-pending`, and `td.num` for the numbers;
    - "–" for both numbers while the ride is being evaluated;
    - a `tr.ride-details` row with `colspan="5"` holding `sport.*`, the gain as `units.m`, and `rynke.ride.virtual` when virtual.
  - **Empty**: `me.recent.empty` when there are no rides.
  - Keep `me.recent.heading` with its current text until US5.
- [X] T017 [US1] In `src/http/me.ts`:
  - Replace `recentRides` with `readRiderView(ctx.env.DB, rider.athleteId, 1)` and then `buildRiderView(read, read.balance ? rulesForVersion(read.balance.rulesVersion) : null, CURRENT_RULES, { seasonStart: ctx.env.SEASON_START_DATE, importing: rider.importStatus !== "done" })`.
  - Place the sections after the import-status paragraph, in the order of contracts/rider-page.md (notice, summary, rides). In the `not-worked-out` state, show only the notice and rides.
  - Update the file's header comment.
  - Drop the `listRecentActivities` import. The function stays, because `test/support/rynke.ts` and `db.test.ts` use it.
  - Makes T008, T009 and T011 green.
- [X] T018 [US1] Extend `STYLE` in `src/http/html.ts` for the US1 sections (research R9, contracts/rider-page.md "CSS"):
  - `main { overflow-wrap:anywhere }`;
  - `table.rides { width:100% }`, with `.num { white-space:nowrap; text-align:right }`;
  - `tr.ride-details td`: smaller, muted, wrapping text;
  - a `section.notice` box;
  - `@media (max-width:36rem)`: tighter cell padding.
  - Keep `test/unit/html.test.ts` green.
- [X] T019 [US1] Check US1:
  - `pnpm lint && pnpm typecheck && pnpm test` are green.
  - Do quickstart §3 steps 1, 2, 3 (360 px: the US1 sections and the ride table) and 5 (no balance) by hand.
  - Delivery 1 is then ready for its PR.

**Checkpoint**: US1 is complete and releasable. Every later story only adds to it.

---

## Phase 4: User Story 2 — Gauges (Priority: P2)

**Goal**: a gauge per condition (Training, Team, without virtual rides when shown) and an elevation gauge towards the next step:
- filled to a percentage rounded down and capped at 100;
- marked reached exactly at 100;
- with every figure in text;
- the Training gauge divided into distance and elevation.

The Team gauge stays undivided until US3b (research R5).

**Independent Test**: seed balances just below, at and above each threshold, with and without virtual rides, and check each gauge's caption, percentage, width and `gauge-reached` class (quickstart "Gauges", "Segments", "US2 scenarios").

### Tests for User Story 2 (write first, confirm red) ⚠️

- [X] T020 [P] [US2] Extend `test/unit/rider-view.test.ts` with gauges (SC-009, research R7):
  - **Percentages**: 249/250 → 99 and not reached; 250/250 and 262/250 → 100 and reached; 12/250 → 4; 0/25 → 0; 160/167 → 95.
  - **Elevation**: `elevationToNextStepDm` 7600 with a step of 1000 m → value 2400, target 10000, 24%. 10000 to the next step (3000 m) → 0%.
  - **Segments**: distance 70 and elevation 30 of 250 → `widthPercent` 28 and 12. Distance 200 and elevation 62 of 250 → widths summing to 100 in proportion. Parts of 0 are dropped.
  - **The segment helper** with six sources (70, 30, 50, 40, 10, 10 of 250) → widths summing to 84 (S2-6's arithmetic), and `parts: []` when the corrections part is negative (S2-7's rule).
  - **Invariants**: `0 ≤ percent ≤ 100` and `percent === 100 ⇔ reached`, over a sweep of values 0…300 against 250.
  - **When gauges are absent**: `gauges` is `null` when the rules are `null`, and `withoutVirtual` is `null` without a virtual ride.
  - **FR-023**: `qualified` equals "every shown gauge reached" for synthetic balances covering each combination of met and unmet conditions.
- [X] T021 [P] [US2] Extend `test/integration/me-rynke.test.ts`:
  - **S2-1**: the captions "Trainingsrynke: 12 von 250 · 4 %" and "Teamrynke: 0 von 25 · 0 %".
  - **S2-2**: 99 % without `gauge-reached`.
  - **S2-3**: 262 von 250 · 100 % with `gauge-reached` and "erreicht".
  - **S2-4**: 95 % for 160 of 167.
  - **S2-5**: the elevation caption with "1.000 m", 24 % and "noch 760 m".
  - **S2-8**: every gauge is reached, with "Du bist dabei".
  - **S2-9**: each `.gauge-bar` is `aria-hidden="true"`, and the legend lists "Distanz: 70" and "Höhenmeter: 30".
  - **Ordering**: `section.rynke-gauges` follows the summary (FR-026), and is absent in the not-worked-out state and for a balance with `rules_version` 99.
- [X] T022 [P] [US2] Extend `test/unit/catalogs.test.ts`'s `CONTRACT_IDS` with `units.percent`, `rynke.gauges.heading`, `rynke.gauge.caption`, `rynke.gauge.reached`, `rynke.gauge.elevation`, `rynke.source.distance` and `rynke.source.elevation`.

### Implementation for User Story 2

- [X] T023 [P] [US2] Add the US2 keys to `src/i18n/messages/de.ts` and `en.ts` (contracts/messages.md "Units", "Gauges").
- [X] T024 [US2] In `src/http/rider-view.ts`:
  - **Types**: add `Gauges`, `Gauge` and `GaugePart`, and `gauges: Gauges | null` on the ready state.
  - **`percent(value, target)`** = `Math.min(100, Math.floor((value * 100) / target))`.
  - **`gaugeParts(parts, target)`**:
    - widths = `part / max(total, target) × 100`, rounded to two decimals;
    - parts of 0 are dropped;
    - `[]` if any part is a negative correction.
  - **Gauges**:
    - Training: parts `distance` and `elevation`, with `elevationRynke`.
    - Team: undivided.
    - Without virtual rides: only with `virtualCount > 0`.
    - Elevation: `(stepDm − elevationToNextStepDm)` of `stepDm`.
  - **Absence**: `gauges` is `null` when `rules` is `null`.
  - Makes T020 green.
- [X] T025 [US2] In `src/http/rider-sections.ts`, add `renderGauges` per contracts/rider-page.md:
  - one `figure.gauge` per gauge, stacked;
  - `gauge-reached` on a reached gauge, and the caption with `units.percent` and "· ✓ erreicht" when reached;
  - a `div.gauge-bar` with `aria-hidden="true"`, holding `span.gauge-part.gauge-part-N` with `style="width:NN.NN%"`, or one `span.gauge-fill` when the gauge is undivided;
  - `ul.gauge-legend` only when the gauge is divided.
  - The style attribute holds a number the view model computed, never user input.
- [X] T026 [US2] In `src/http/me.ts`, place `renderGauges` right after the summary when `view.gauges` isn't `null`. Makes T021 green.
- [X] T027 [US2] Extend `STYLE` in `src/http/html.ts` (research R7–R10):
  - `:root` colour variables `--rp-part-1` … `--rp-part-6`, `--rp-reached` and `--rp-track`;
  - `.gauge` as a block at 100% width;
  - `.gauge-bar`: about 1rem high, with the `--rp-track` background and `display:flex`;
  - `.gauge-part-N` and `.gauge-key.gauge-part-N` coloured by their variable, with a 2 px white gap between parts;
  - `.gauge-reached .gauge-fill` coloured `--rp-reached`;
  - the legend inline and wrapping.
- [X] T028 [US2] Check US2: everything is green, and quickstart §3 step 3 shows the gauges stacked at 360 px.

**Checkpoint**: US1 and US2 work together. The numbers stay next to the gauges (FR-026).

---

## Phase 5: User Story 3a — Breakdown: distance, elevation, totals (Priority: P2)

**Goal**: "where do my Rynke come from" for the sources that exist today:
- Training Rynke from distance;
- the season's elevation total with its Rynke, the step, and the metres to the next step;
- totals the parts add up to (FR-030, FR-031, FR-035 without corrections).

**Independent Test**: seed the 79 km / 1240 m rider and a 3000 m rider, and check the breakdown's figures and that they add up (quickstart "US3a scenarios 1, 4, 5").

### Tests for User Story 3a (write first, confirm red) ⚠️

- [X] T029 [P] [US3a] Extend `test/unit/rider-view.test.ts` with `breakdown`:
  - **1240 m** (12400 dm, to next 7600): `elevationM` 1240, `elevationRynke` 5, `toNextStepM` 760, `elevationStepM` 1000, `elevationStepRynke` 5.
  - **3000 m**: 15 Rynke and 1000 m to go.
  - **Rounding**: 12345 dm gives `elevationM` 1234 (down), and 7655 dm to the next step gives `toNextStepM` 766 (up).
  - **Sum**: `distanceRynke + elevationRynke === trainingTotal` for corrections-free balances.
  - **Unknown rules** give a `null` step.
- [X] T030 [P] [US3a] Extend `test/integration/me-rynke.test.ts`:
  - **S3-1**: "7 Trainingsrynke" from distance, "1.240 m gesamt → 5 Trainingsrynke, noch 760 m bis zu den nächsten 5", and "Gesamt" with "12 Trainingsrynke · 0 Teamrynke".
  - **S3-4**: 3000 m → 15, "noch 1.000 m".
  - **S3-5, today's part**: a rider with no rides shows 0 from distance, "0 m gesamt → 0 Trainingsrynke, noch 1.000 m" and total 0. The event-kind rows and lists follow in US3b.
  - `section.rynke-breakdown` follows the gauges, or the summary when there are none.
- [X] T031 [P] [US3a] Extend `CONTRACT_IDS` in `test/unit/catalogs.test.ts` with `rynke.breakdown.heading`, `.trainingRynke`, `.elevation`, `.elevationNoStep`, `.total` and `.totals`.

### Implementation for User Story 3a

- [X] T032 [P] [US3a] Add the US3a keys to `src/i18n/messages/de.ts` and `en.ts` (contracts/messages.md "Breakdown").
- [X] T033 [US3a] In `src/http/rider-view.ts`, add `Breakdown` (data-model.md, without the US3b fields) and `breakdown` on the ready state:
  - `elevationM = floor(elevationDm / 10)`;
  - `toNextStepM = ceil(elevationToNextStepDm / 10)`;
  - steps come from `rules`, or are `null`.
  - Makes T029 green.
- [X] T034 [US3a] In `src/http/rider-sections.ts`, add `renderBreakdown` per contracts/rider-page.md:
  - a `dl` with distance, elevation (`rynke.breakdown.elevation`, or `.elevationNoStep` when the step is unknown) and the total line;
  - metres through `units.m`.
- [X] T035 [US3a] In `src/http/me.ts`, place `renderBreakdown` after the gauges. Makes T030 green.
- [X] T036 [US3a] Check US3a: everything is green, and the breakdown is readable at 360 px (quickstart §3 step 3).

**Checkpoint**: the breakdown adds up for every source that exists today.

---

## Phase 6: User Story 4 — Why each ride counts or doesn't (Priority: P2)

**Goal**: every ride that doesn't count lists every stored reason in plain words, with its own figure and the limit of its rules version. Virtual rides are marked, unknown figures are named with "may still change", and a fix hint appears for reasons the rider can fix (FR-042–FR-044).

**Independent Test**: seed one ride per reason code, plus counting, virtual and unknown-figure rides, and check every detail row in German and in English (quickstart "US4 scenarios", "Reason texts").

### Tests for User Story 4 (write first, confirm red) ⚠️

- [X] T037 [P] [US4] Extend `test/unit/i18n.test.ts`: `formatTime("2026-10-06T08:00:00Z")` is "08:00" in `de` and in `en`, and "2026-10-06T17:05:00Z" gives "17:05" (the UTC wall clock of `start_date_local`, research R13).
- [X] T038 [P] [US4] Extend `test/unit/rider-view.test.ts` with ride reasons (research R12, data-model.md `ReasonLine`):
  - **pause**:
    - 14400 s moving and 25200 s elapsed → `{ pausedS: 10800, movingS: 14400, share: null }` under a ½ limit;
    - a share of ⅓ is passed on as `{ num: 1, den: 3 }`;
    - 0 moving time → `pausedS: null`.
  - **too_slow**: 15 km in 7200 s → 75 tenths, limit 10. 9960 m in 3600 s → 99 tenths (rounded down, never 100).
  - **too_fast**: 45010 m in 3600 s → 451 tenths (rounded up), limit 45.
  - **climbing_rate**: 15004 dm in 3600 s → 1501 m/h (rounded up from the decimetres), limit 1500.
  - **excluded_sport_type**: carries the sport type.
  - **outside_window**: becomes `before_season` with `2026-01-01` for a ride dated before it. Otherwise it becomes `after_deadline` with the deadline of the result's rules, and `date: null` when the rules are unknown.
  - **overlap**: carries `countedInstead` from the join, or `null`.
  - **An unknown code** `"new_rule"` → `{ code: "unknown", stored: "new_rule" }`.
  - **Limits**: every limit is `null` when `rulesForVersion(result.rulesVersion)` is `null`.
  - **Order**: reasons keep the stored order.
  - **Fix hint**: `fixHint` is true when the reasons include `pause`, `too_slow`, `too_fast`, `climbing_rate` or `manual`, and false for `flagged`, `excluded_sport_type`, `outside_window` or `overlap` alone.
  - **Unknown figures**: `unknownFigures` is passed through for counting rides.
- [X] T039 [P] [US4] Extend `test/integration/me-rynke.test.ts`:
  - **S4-1**: the 78 km ride's detail row says "Doppelt aufgezeichnet: Deine Fahrt vom 06.10.2026, 08:00 Uhr, 80,0 km zählt stattdessen."
  - **S4-2**: "3 h 0 min Pause bei 4 h 0 min Bewegungszeit – mehr als die Hälfte ist nicht erlaubt."
  - **S4-3**: both "Manuell auf Strava eingetragen." and "Zu langsam: 7,5 km/h im Schnitt, mindestens 10 km/h sind nötig."
  - **S4-4**: flagged, too fast, climbing rate, `EBikeRide` ("E-Bike-Fahrt zählt nicht für die Rynke."), before the season start ("01.01.2026"), and after the deadline. Seed a deadline through a balance and result whose `rules_version` maps to rules with a deadline. If `RULES_HISTORY` has none, check the `afterDeadlineNoDate` text for an unknown version instead.
  - **S4-5**: a counting virtual ride shows "virtuell".
  - **S4-6**: a counting ride with `unknown_figures` `["elapsed_time"]` shows `rynke.unknown.elapsed_time` and "Das Ergebnis kann sich noch ändern."
  - **S4-7**: the fix hint appears once on the pause and manual rides, and not on the overlap or flagged rides.
  - **An unknown code** in `reasons` shows "Zählt nach den aktuellen Regeln nicht." and no error page.
  - **English**: the S4-1 and S4-2 rows in English (FR-061).
- [X] T040 [P] [US4] Extend `test/unit/catalogs.test.ts` (SC-003, FR-062):
  - Every `REASON_CODES` value has `rynke.reason.<code>`, and every `UNKNOWN_FIGURE_CODES` value has `rynke.unknown.<code>`, in every catalog.
  - Add every US4 key of contracts/messages.md to `CONTRACT_IDS`: `units.kmh`, `units.mPerH`, `units.duration`, `units.durationMin`, `rynke.ride.fixHint`, all `rynke.reason.*`, and all `rynke.unknown.*`.

### Implementation for User Story 4

- [X] T041 [P] [US4] In `src/i18n/i18n.ts`, add `formatTime(iso: string): string` to `I18n`: `HH:MM` of the UTC wall clock, through `Intl.DateTimeFormat` with `timeZone: "UTC"`, `hour: "2-digit"`, `minute: "2-digit"` and `hourCycle: "h23"`, in the catalog's `meta.intlLocale`. Makes T037 green.
- [X] T042 [P] [US4] Add the US4 keys to `src/i18n/messages/de.ts` and `en.ts` (contracts/messages.md "Units", "Reasons", "Unknown figures", `rynke.ride.fixHint`).
- [X] T043 [US4] In `src/http/rider-view.ts`, add `ReasonLine`, plus `reasons`, `unknownFigures` and `fixHint` on `RideLine`, built from each `StoredRideResult` and its activity fields as T038 specifies:
  - `rulesForVersion` is passed in as a function parameter, so the module stays pure;
  - it maps each reason code with a `switch` over `REASON_CODES`;
  - anything else becomes `unknown`.
  - Makes T038 green.
- [X] T044 [US4] In `src/http/rider-sections.ts`, extend `renderRides`'s detail row with `ul.ride-reasons`, the unknown-figure lines followed by `rynke.unknown.mayChange`, and `rynke.ride.fixHint` once. The key and parameters per reason:
  - **pause**: the base key when the share is ½, `.share` with "{num}/{den}" otherwise, `.noLimit` without rules, and `.noMovingTime` when `pausedS` is `null`. Durations use `units.duration` (h and min, minutes rounded down), or `units.durationMin` below 1 h.
  - **too_slow and too_fast**: the speed through `units.kmh` with one decimal, and the limit with 0 decimals.
  - **climbing_rate**: through `units.mPerH`.
  - **excluded_sport_type**: `sport.<type>`.
  - **outside_window**: the base key for before the season, `.afterDeadline` with a date, and `.afterDeadlineNoDate` without one.
  - **overlap**: date, `formatTime` and km of the ride that counted instead, or `.noRide`.
  - **Anything else**: `rynke.reason.unknown`.
  - Makes T039 and T040 green.
- [X] T045 [US4] Check US4: everything is green, and at 360 px the reasons wrap below the main row (quickstart §3 step 3).

**Checkpoint**: every ride that doesn't count explains itself.

---

## Phase 7: User Story 5 — Paging through all rides (Priority: P3)

**Goal**: the ride table covers every stored ride, 20 per page:
- the position as "Fahrten 21–40 von 45";
- first, previous, next and last links as 44 px tap targets;
- a page past the end shows the last page;
- switching the language keeps the page (FR-045, FR-046, research R11).

**Independent Test**: seed 45 rides and page through them, then 500 rides for SC-005 (quickstart "US5 scenarios", "500 rides").

### Tests for User Story 5 (write first, confirm red) ⚠️

- [X] T046 [P] [US5] Extend `test/unit/rider-view.test.ts`:
  - **`parsePage(url)`**:
    - `?page=2` → 2, and `?page=9999` → 9999;
    - missing, `0`, `-1`, `01`, `abc`, `1e3`, `10000`, `2.0` → 1;
    - two `page` parameters → 1;
    - other parameters are ignored.
  - **The pager** from `rideCount` and the page read:
    - 45 rides on page 1 → position 1–20 of 45, `first`/`previous` `null`, `next` 2, `last` 3;
    - page 2 → 21–40, all four set;
    - page 3 → 41–45, `next`/`last` `null`;
    - 20 rides → `pager: null`;
    - 0 rides → no rows and `pager: null`.
- [X] T047 [P] [US5] Extend `test/integration/me-rynke.test.ts`:
  - **S5-1**: 45 rides; `/me` shows the 20 newest, "Fahrten 1–20 von 45", and a `rel="next"` link to `/me?page=2#rides` with the class `tap`.
  - **S5-2**: `?page=2` shows 21–40 and `?page=3` shows 41–45, with first and previous links.
  - **S5-3**: 20 rides show no `nav.pager` and no position.
  - **S5-5**: a ride on page 3 overlapping a ride on page 1 names it by date, time and distance.
  - **Out of range**: `?page=99` shows 41–45, and `?page=abc` shows page 1.
  - **Read-only (SC-004)**: pages 1–3 leave `tableCounts()` and the row snapshot unchanged, with no queue message and no Strava request.
  - **SC-005**: 500 seeded rides; `/me` and `/me?page=25` render with 20 rows each, and `EXPLAIN QUERY PLAN` of `RIDE_PAGE_SQL` with `(ATHLETE_A, 25)` names `activities_by_rider` and contains no `SCAN activities` without an index.
- [X] T048 [P] [US5] Extend `test/integration/lang-switcher.test.ts`:
  - **S5-4**: `POST /lang` with `next=/me?page=2` redirects to `/me?page=2`.
  - **Refused**: `/me?page=0`, `/me?page=abc`, `/me?page=2&x=1` and `/me?foo=1` redirect to `/`.
  - **The switcher form** on `GET /me?page=2` carries `next` `/me?page=2`, and on `GET /me?page=1` it carries `/me`.
- [X] T049 [P] [US5] Extend `test/unit/catalogs.test.ts`:
  - `CONTRACT_IDS` gains `rynke.rides.position`, `rynke.pager.label`, `.first`, `.previous`, `.next` and `.last`.
  - Assert `de["me.recent.heading"] === "Deine Fahrten"`.
  - Update the existing heading assertions in `test/integration/me-activities.test.ts` to "Deine Fahrten" and "Your rides".

### Implementation for User Story 5

- [X] T050 [P] [US5] Add the US5 keys to `src/i18n/messages/de.ts` and `en.ts`, and change `me.recent.heading` to "Deine Fahrten" and "Your rides" (contracts/messages.md "Rides").
- [X] T051 [P] [US5] In `src/http/lang.ts`, `safeNext` also returns `next` when it matches `/^\/me\?page=[1-9][0-9]{0,3}$/` (contracts/http-routes.md). Makes T048's redirect cases green.
- [X] T052 [US5] In `src/http/rider-view.ts`, add `parsePage(url: URL): number` and `Pager`, and fill `RideTable.position` and `pager` from `read.rideCount` and `read.page`. Makes T046 green.
- [X] T053 [US5] In `src/http/rider-sections.ts`, `renderRides` adds `p.rides-position` and `nav.pager` with `aria-label`. Only the links that apply are shown, as `a.tap` with `rel` and `href="/me?page=N#rides"`. Both appear only when `pager` isn't `null`.
- [X] T054 [US5] In `src/http/me.ts`:
  - Read `parsePage(new URL(request.url))` and pass it to `readRiderView`.
  - Set the layout's `path` to `/me?page=${view.rides.pager.page}` when that page is above 1, otherwise `/me`.
  - Makes T047 and T048 green.
- [X] T055 [US5] Extend `STYLE` in `src/http/html.ts`:
  - `.tap { display:inline-flex; align-items:center; min-height:44px; min-width:44px }`;
  - `nav.pager`: flex, wrapping, with a gap;
  - phone padding under `@media (max-width:36rem)`.
  - If US6 was built first, `.tap` already exists; keep a single rule.
- [X] T056 [US5] Check US5:
  - Everything is green.
  - quickstart §3 step 3: the pager links are at least 44 × 44 px, and nothing scrolls sideways.
  - Step 6: with 500 rides, every page appears well under 2 s.
  - Step 7: switching the language on page 2 stays on page 2.

**Checkpoint**: every ride of the season can be checked.

---

## Phase 8: User Story 6 — Rules and freshness (Priority: P2)

**Goal**:
- The page states the rules version and since when it applies, the counting window, and links to the handout.
- It says when the numbers are being updated to new rules (FR-051), and when they will grow because the import is still running (FR-052).

**Independent Test**: seed balances under the current version and under another one, plus a rider whose import is still running, and check the rules section and the notices (quickstart "US6 scenarios").

### Tests for User Story 6 (write first, confirm red) ⚠️

- [X] T057 [P] [US6] Extend `test/unit/rider-view.test.ts` (research R4, SC-006):
  - **No update**: `updating` is `null` when `balance.rulesVersion === inEffect.version`.
  - **Update**: a balance under version 1 with `inEffect` version 2 (`effectiveDate` `2026-11-01`) gives `{ inEffectVersion: 2, inEffectSince: "2026-11-01" }`, and still `rules.version` 1.
  - **Labels**: `rules` carries the balance's version and effective date, `seasonStart`, and the deadline of the balance's rules (or `null`).
  - **Importing**: `importing` comes from the context, in both states.
- [X] T058 [P] [US6] Extend `test/integration/me-rynke.test.ts`:
  - **S6-1**:
    - "Berechnet nach Regel-Version 1, gültig seit dem 07.10.2026.";
    - "Es zählt alles ab dem 01.01.2026.";
    - an `a.tap` whose `href` is `RULES_HANDOUT_URL`, with "So funktionieren die Rynke";
    - no `rynke.notice.updating`.
  - **S6-2**: a balance with `rules_version` 2 shows the updating notice with "07.10.2026" and "Regel-Version 2", "Regel-Version 2" in the rules section, and no targets or gauges, because 2 isn't in `RULES_HISTORY` (FR-013).
  - **S6-3**: back to version 1, the notice is gone.
  - **S6-4**: a rider with `import_status` other than `done` sees their balance and `rynke.notice.importing`. Without a balance, they see both notices.
  - **S6-5**: in English, the handout link text contains "in German".
  - **S6-6**: opening `/me` three times starts no evaluation (`ctx.queue.sent` is empty) and makes no Strava request.
- [X] T059 [P] [US6] Extend `CONTRACT_IDS` in `test/unit/catalogs.test.ts` with `rynke.notice.updating`, `rynke.notice.importing`, `rynke.rules.heading`, `.version`, `.window`, `.windowDeadline` and `.handout`.

### Implementation for User Story 6

- [X] T060 [P] [US6] Add the US6 keys to `src/i18n/messages/de.ts` and `en.ts` (contracts/messages.md "Notices", "Rules").
- [X] T061 [US6] In `src/http/rider-view.ts`:
  - Add `UpdateNotice` and `RulesInfo`, with `updating` and `rules` on the ready state, and `importing` on both states.
  - `updating` is set exactly when the versions differ.
  - Makes T057 green.
- [X] T062 [US6] In `src/http/rider-sections.ts`:
  - Add `export const RULES_HANDOUT_URL = "https://github.com/SaSteffen/RynkePoints/blob/main/docs/rynke-punkte.md"` (research R14).
  - Extend `renderNotice` with `updating` (date via `formatDate`) and `importing`, in contract order.
  - Add `renderRules` per contracts/rider-page.md: `rynke.rules.window` or `.windowDeadline`, and the handout `a.tap`.
- [X] T063 [US6] In `src/http/me.ts`:
  - Place `renderRules` after the breakdown, or after the gauges or summary when US3a isn't built yet.
  - Show the notices in the ready state too.
  - Feature 001's import-status line stays.
  - Makes T058 green.
- [X] T064 [US6] Extend `STYLE` in `src/http/html.ts` with the `.tap` rule if US5 hasn't added it yet (T055), and the `section.notice` look for the updating and importing notices.
- [X] T065 [US6] Check US6: everything is green, plus quickstart §3 step 4 (`UPDATE rynke_balances SET rules_version = 2` shows the notice, and re-evaluating clears it) and step 7 (the handout link in English).

**Checkpoint**: deliveries 1–6 are complete. Everything except US3b is shipped.

---

## Phase 9: User Story 3b — Event kinds and events (Priority: P2)

**Unblocked**: feature 003 Story 3 (team events and attendance) is merged into `develop`, with `team_events`, `attendances`, the kind codes `TEAM_EVENT_KINDS` and the balance's per-kind breakdown `team_event_breakdown` (feature 003 FR-014a, research R5). Corrections (Story 6) are not built yet, so they are split off into Phase 9b; until then the page shows no correction line rather than zeros.

**Goal**:
- For each team-event kind: count, Team Rynke and Training Rynke, also for a count of 0.
- The events, newest first; one outside the window is marked as not counting.
- The event segments of the Training and Team gauges (FR-022, FR-032, FR-033).

**Independent Test**: seed attendance through feature 003's tables and a balance with its breakdown, and check every row and list entry and that the parts add up (spec US3 scenarios 2, 3, 5 without corrections; US2 scenario 6 without corrections).

### Design update (before any test)

- [X] T066 [US3b] Bring this feature's documents in line with what feature 003 Story 3 actually built:
  - in [data-model.md](data-model.md): the read tables, `RiderViewRead.attendance`, and `Breakdown`'s `kinds` and `events`;
  - research R2 (the attendance statement) and R5 (team events merged, corrections still to come);
  - in [contracts/rider-page.md](contracts/rider-page.md): the US3b markup and the fixed colour class per source;
  - in [contracts/messages.md](contracts/messages.md): the `rynke.source.<kind>` keys named after feature 003's kind codes, and final de and en wording for every team-event key;
  - quickstart's US3b rows.
  - Commit as `docs: …` before T067.

### Tests for User Story 3b (write first, confirm red) ⚠️

- [X] T067 [P] [US3b] Extend `test/unit/rider-view.test.ts`:
  - **Kind lines**: every kind is listed, in feature 003's order, also with count 0; a balance stored before Story 3 (empty breakdown) lists none.
  - **Events**: newest first as read; `counts` is false before the season start and after the deadline of the balance's rules, and only the season start is checked when the rules are unknown.
  - **Training gauge**: parts 70, 30, 50, 40, 10 of 250 → 80 %, five segments. **Team gauge**: divided by kind.
  - **Sum**: distance + elevation + kinds = the Training total, and the kinds' Team Rynke = the Team total (FR-035).
- [X] T068 [P] [US3b] Extend `test/integration/me-rynke.test.ts`:
  - **S3-2**: the kind rows.
  - **S3-3**: three events with date, kind and name, newest first.
  - **S3-5**: every kind listed with 0, plus `rynke.events.none`.
  - **Attendance**: an attendance outside the window is listed and marked `rynke.events.notCounting`. No stored rules version has a deadline, so the integration test uses the season start; the deadline is covered by T067.
  - **S2-6**: legend with five parts and their colour classes; the Team gauge's legend by kind.
  - **Read-only (SC-004)**: with attendance seeded, `GET /me` changes no table and no attendance row.
  - Update S3-1, S3-4 and S3-5's expected breakdown rows for the kind rows.
- [X] T069 [P] [US3b] Extend `test/unit/catalogs.test.ts`: every kind code of `TEAM_EVENT_KINDS` has `rynke.source.<kind>` in every catalog (FR-062), and `CONTRACT_IDS` gains every team-event key fixed in T066.

### Implementation for User Story 3b

- [X] T070 [P] [US3b] Add the team-event keys to `src/i18n/messages/de.ts` and `en.ts`, as fixed in T066.
- [X] T071 [US3b] In `src/db/rider-view.ts`, add feature 003's `listRiderAttendanceStatement` as a further statement of the **same** `db.batch` (FR-005), mapped to `AttendedEvent`. The balance's per-kind breakdown comes through feature 003's balance mapper.
- [X] T072 [US3b] In `src/http/rider-view.ts`, add `Breakdown.kinds` and `.events`, and the kind sources to `gaugeParts` for the Training and Team gauges, using the stored per-kind values only (FR-004). Makes T067 green.
- [X] T073 [US3b] In `src/http/rider-sections.ts`, extend `renderBreakdown` with the kind rows and the event list, and give every gauge part its source's colour class (`gauge-part-3` … `gauge-part-5` for the kinds). Makes T068 and T069 green.
- [X] T074 [US3b] Check US3b's team events: everything is green; the five-part gauge and the event list at 360 px are part of the manual checks after the deploy (quickstart §3 step 3).

**Checkpoint**: every user story is built except the corrections of US3b.

---

## Phase 9b: User Story 3b — Corrections (Priority: P3) ⛔ blocked

**Blocked until**: feature 003 Story 6 (corrections) is merged into `develop`, with its table and the balance's correction sums (feature 003 FR-014a, research R5). Don't start this phase before that, and don't show zeros for corrections in the meantime.

**Goal**: correction sums with their sign and the list of corrections, the "never below 0" note, and the corrections segment of the Training and Team gauges with its "negative → undivided" rule (FR-022, FR-034, FR-035).

**Independent Test**: seed corrections through feature 003's tables, and check the sums, the list and the note (spec US3 scenarios 2, 3 and 6; US2 scenarios 6 and 7).

- [ ] T084 [US3b] Bring data-model.md, research R2 and R5, contracts/rider-page.md, contracts/messages.md (`rynke.source.corrections`, `rynke.breakdown.corrections`, `.neverBelowZero`, `rynke.corrections.heading`, `.none`, `rynke.correction.line`) and quickstart in line with what feature 003 Story 6 built. Commit as `docs: …` first.
- [ ] T085 [P] [US3b] Extend `test/unit/rider-view.test.ts`: correction sums keep their sign; `clampedToZero` is true when a stored total is 0 and earned plus corrections is below 0; **S2-6** with corrections: parts 70, 30, 50, 40, 10, 10 of 250 → 84 %, six segments; **S2-7**: negative corrections → that gauge's `parts` is `[]`; distance + elevation + kinds + corrections = the Training total unless clamped (FR-035).
- [ ] T086 [P] [US3b] Extend `test/integration/me-rynke.test.ts`: **S3-2** "+10" Trainingsrynke from corrections; **S3-3** the correction with date, "+10" and its reason; **S3-5** `rynke.corrections.none`; **S3-6** negative corrections → total 0, the sign kept, and `rynke.breakdown.neverBelowZero`; **S2-6** legend with six parts; **S2-7** an undivided Training gauge.
- [ ] T087 [P] [US3b] Extend `CONTRACT_IDS` in `test/unit/catalogs.test.ts` with the corrections keys fixed in T084.
- [ ] T088 [US3b] Add the corrections keys to both catalogs; add the corrections read as a further statement of the same `db.batch` in `src/db/rider-view.ts`; add the corrections fields to `Breakdown` and the corrections source (last, `gauge-part-6`) to both gauges in `src/http/rider-view.ts`; extend `renderBreakdown` with the signed corrections line, the never-below-zero note and the corrections list. Makes T085–T087 green.
- [ ] T089 [US3b] Check: everything is green; the six-part gauge and both lists at 360 px are checked after the deploy.

**Checkpoint**: every user story is built.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: keep the documents true and the whole page coherent across deliveries.

- [X] T075 [P] Sync [contracts/messages.md](contracts/messages.md) with the catalogs: every key added by T014, T023, T032, T042, T050, T060 and T070 has its final de and en wording there, and the removed keys are listed.
- [X] T076 [P] Update [quickstart.md](quickstart.md) and [research.md](research.md) where implementation changed a detail. Examples: a renamed helper, the `buildRiderView` context argument (T015), `RIDE_PAGE_SQL` (T013), and the exported row mappers (T012).
- [X] T077 [P] Review `src/http/rider-view.ts`, `rider-sections.ts` and `src/db/rider-view.ts`:
  - no rider-facing literal;
  - no `INSERT`, `UPDATE` or `DELETE`;
  - no import of `CURRENT_RULES` values into text;
  - no rule number in a catalog text.
  - Fix any finding, test-first.
- [X] T078 Run all of quickstart §1 (the listed test files, then `pnpm lint && pnpm typecheck && pnpm test`). §3's manual checks happen on the live site after the deploy; the PR description says so.

---

## Phase 11: User Story 7 — Check the build against the diagrams (last phase, FR-092)

**Goal**: the build matches the spec's diagrams D0–D16 and the plan's design diagrams P1–P9. Where one disagrees, the requirement applies, and the diagram (or the code, if it broke a requirement) is corrected in the same change (FR-091).

**Independent Test**: a reviewer opens spec.md and plan.md on GitHub, every diagram renders, and each one matches the built page and code (spec US7 scenarios 1–4).

- [ ] T079 [P] [US7] Compare the built page against the spec's layout and state diagrams:
  - **D3** (who sees the page): signed out → `/`; only the rider's own data.
  - **D4** (desktop section order) against `handleMe`'s output.
  - **D5** (phone, 360 px) against the page in device mode.
  - **D6** (page states) against `buildRiderView`'s states.
  - **D7** (a ride row) against `renderRides`.
  - Fix any mismatch in the diagram or the code.
- [ ] T080 [P] [US7] Compare the gauges, qualification, reasons and paging against the spec's diagrams:
  - **D8** (how a gauge fills) and **D9** (US2 scenario 6) against `gaugeParts` and `percent`.
  - **D10** (qualification) against the summary.
  - **D11** (status and reasons) against `RideLine`.
  - **D12** (45 rides) against the pager.
  - **D15** (overlap) and **D16** (elevation) against the integration tests' figures.
- [ ] T081 [P] [US7] Compare the flow diagrams against the code:
  - **D0** (delivery phases) against what was merged; mark US3b's state.
  - **D1** and **D2** (where the numbers come from and what is read) against `readRiderView`'s batch.
  - **D13** (a page view over time) and **D14** (a rule change) against `handleMe` and research R4.
- [ ] T082 [P] [US7] Compare plan.md's design diagrams against the code:
  - **P1** (modules and imports) against the actual imports, with `rider-view.ts` importing no `I18n` or D1.
  - **P2** (read sequence).
  - **P3** (rules versions).
  - **P4** (page assembly).
  - **P5** (view model) against the final types.
  - **P6** (a gauge).
  - **P7** (the page parameter) against `parsePage` and `safeNext`.
  - **P8** (a ride row).
  - **P9** (deliveries).
- [ ] T083 [US7] Render every Mermaid block of spec.md and plan.md once more (GitHub preview, or `@mermaid-js/mermaid-cli` run through `pnpm dlx` without adding it to `package.json`) after T079–T082's corrections. Commit the corrections as `docs: …`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: none.
- **Phase 2 (Foundational)**: after Phase 1. Blocks every story.
- **Phase 3 (US1)**: after Phase 2. Delivery 1, the MVP.
- **Phases 4–8 (US2, US3a, US4, US5, US6)**: each after Phase 3. They are independent of each other and can be done in any order or in parallel. Where two touch the same file (`rider-view.ts`, `rider-sections.ts`, `me.ts`, `html.ts`, the catalogs, `me-rynke.test.ts`, `rider-view.test.ts`, `catalogs.test.ts`), the second one rebases onto the first (see the rebase rule in the repository conventions).
- **Phase 9 (US3b, team events)**: after Phases 4 and 5, and after feature 003 Story 3 is merged.
- **Phase 9b (US3b, corrections)**: after Phase 9, and after feature 003 Story 6 is merged. Blocked until then.
- **Phase 10 (Polish)**: after the stories being shipped.
- **Phase 11 (US7 check)**: last, after Phase 10. While US3b's corrections are still blocked, run it for what was built, and repeat T079–T083 after Phase 9b.

### User Story Dependencies

| Story | Needs | Notes |
|---|---|---|
| US1 | Phase 2 | first delivery |
| US2 | US1 | Team gauge undivided until US3b |
| US3a | US1 | |
| US4 | US1 | adds `formatTime` |
| US5 | US1 | adds `safeNext` rule, `.tap` |
| US6 | US1 | adds `.tap` if US5 hasn't |
| US3b | US2, US3a, feature 003 Story 3 (team events), Story 6 (corrections) | corrections blocked |
| US7 | every built story | last phase |

### Within each phase

- Tests before the implementation they cover, confirmed red.
- Catalog keys ([P]) can go in alongside the view model. The renderer needs both.
- `src/http/rider-view.ts` before `rider-sections.ts`, before `me.ts`. CSS last.
- US1: T012 → T013. T014 and T015 can run alongside them. Then T016 → T017 → T018 → T019.

### Parallel Opportunities

- **Phase 2**: T002 and T003, then T004, T005 and T006.
- **US1 tests**: T007, T008, T009, T010 and T011 (different files).
- **US1 implementation**: T012, T014 and T015 in parallel; T013 after T012.
- **Within each later story**: the test tasks are parallel with each other ([P]), and the catalog task is parallel with the view-model task.
- **Across stories**: US2, US3a, US4, US5 and US6 can be built in parallel by different people after US1, each on its own branch from `develop`.
- **Phase 11**: T079–T082 in parallel, then T083.

## Parallel Example: User Story 1

```text
# Tests first (all red):
Task: "T007 Create test/unit/rider-view.test.ts (US1 summary and ride lines)"
Task: "T008 Create test/integration/me-rynke.test.ts (S1-1 … S1-11, SC-004)"
Task: "T009 Update test/integration/me-activities.test.ts for the new columns"
Task: "T010 Extend CONTRACT_IDS in test/unit/catalogs.test.ts"
Task: "T011 Extend test/support/pages.ts for the language tests"

# Then, in parallel:
Task: "T012 Export the row mappers in src/db/rynke.ts"
Task: "T014 Add the US1 keys to de.ts and en.ts"
Task: "T015 Create src/http/rider-view.ts (buildRiderView, US1 part)"
```

## Implementation Strategy

### MVP first (US1 only)

1. Phase 1, then Phase 2 (the rules history, `virtualShareRequired`, seeding).
2. Phase 3: US1. Plain numbers and the 20 newest rides with points.
3. **Stop and validate**: quickstart §1 for US1, §3 steps 1–3 and 5. Open the PR for delivery 1 when asked.

### Incremental delivery

4. US2 (gauges), US3a, US4, US5 and US6, each its own PR, in whatever order is useful. Gauges first gives the look the project owner asked for. US6 is needed before the first rule change.
5. US3b's team events now that feature 003 Story 3 is merged, its corrections once Story 6 is.
6. Phase 10, then Phase 11 against every diagram.

### Material Design and issue #20

- Not in these tasks. The stable class names and the `--rp-*` variables (T018, T027, T055) are what a later restyle replaces (research R10).
- The phone rules here cover only this feature's sections. The rest of the site is issue #20.

## Notes

- [P] = different files, no dependency on an unfinished task.
- Never call Strava or production Cloudflare resources from tests. Seed only synthetic riders and rides.
- The page never computes Rynke. Figures are stored, or derived only as FR-004 allows (gauge percentages and reason figures).
- Feature 004's consent re-ask gate is not part of these tasks. When it is built, it applies to `/me` like every page.
- Don't raise `CURRENT_RULES.version` in this feature. Tests reach another version by seeding `rules_version` or by passing rules to `buildRiderView`.
