---
description: "Task list for Rynke Evaluation — User Stories 2, 3 and 4"
---

# Tasks: Rynke Evaluation — Ride Rynke, Team Events and Stored Results

**Input**: Design documents from `/specs/003-rynke-evaluation/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Scope**: User Stories 2 and 4 (Phases 1–5, delivered) and User Story 3
(Phases 6–9, revision 2026-10-07), as in plan.md. Story 1 (rules handout) is
already delivered and needs no task (research R1). Stories 5 and 6 get their
own plan revision and tasks later.

**Already done**: storing Strava's flag (research R15, first part) shipped with
feature 001 (its tasks T097–T107): `migrations/0003_activity_flagged.sql`, the
`is_flagged` mapping in `src/strava/activity.ts`, `ACTIVITY_FIGURES_VERSION = 2`,
`is_flagged IS NULL` in `listActivityIdsMissingFigures`, both catalogs, and
the tests plan.md lists for it. Because `0003` and `0004` (feature 001's consent
migration) are taken, the results tables come in
**`migrations/0005_rynke_results.sql`**, and it does **not** add `is_flagged`
again. T037 aligns plan.md, data-model.md and quickstart.md.

**Tests**: REQUIRED. Constitution Principle V (Test-First, NON-NEGOTIABLE): every
test task comes before the implementation it covers. Run it and confirm it fails
(red) before implementing (green). Strava is never contacted: integration tests
use `test/support/fake-strava.ts`, which fails on any unexpected request.
Fixtures are synthetic (Principle I).

**Organization**: Phase 2 holds what both stories need (the rules and a ride
builder for tests). Phase 3 is Story 2 (pure evaluation, in memory). Phase 4 is
Story 4 (tally, storage, triggers); it needs Phase 3. Phases 6–9 are Story 3
(team events), built on the delivered Phases 1–5.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: the user story the task belongs to (US2, US3, US4)

## Conventions used by every task

- Paths are relative to the repo root; source in `src/`, tests in `test/`.
- TypeScript strict, tabs, Biome-formatted. No new dependency (Principle IV).
- `src/rynke/rules.ts`, `rides.ts` and `tally.ts` are pure: no bindings, no
  clock, no randomness, no imports from `src/db/`, `src/work/` or `src/http/`.
  The evaluation takes the rules as a parameter and never reads
  `CURRENT_RULES` itself (research R8).
- **Exact arithmetic** (research R3): elevation in whole decimetres
  (`Math.round(elevation_gain_m * 10)`), limits compared by cross-multiplication,
  shares as `{ num, den }` fractions. Never divide to compare against a limit,
  never use an epsilon.
- Codes are the exact strings in
  [contracts/ride-evaluation.md](contracts/ride-evaluation.md) (FR-016); no
  rider-facing text is added by this feature.
- Integration tests build a `Ctx` with `makeCtx()` from `test/support/ctx.ts`
  and call exported handlers directly; `SEASON_START_DATE` is `2026-01-01` in
  `vitest.config.ts`.
- Log messages are English and carry only numeric IDs and codes.
- Commit after each task or logical group with a Conventional Commits message
  (`test: …`, `feat: …`, `chore: …`).

---

## Phase 1: Setup

**Purpose**: confirm a green baseline in the worktree.

- [X] T001 Run `pnpm install`, `pnpm lint`, `pnpm typecheck` and `pnpm test` in the worktree root and confirm all green before any change; note any pre-existing failure in the task's commit message rather than fixing it here.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the versioned rules and the synthetic ride builder both stories use.

**⚠️ CRITICAL**: Phases 3 and 4 depend on this phase.

### Tests for the foundation (write first, confirm red) ⚠️

- [X] T002 [P] Create `test/unit/rules.test.ts` (research R8, data-model.md "Input: Rynke Rules"):
  - `CURRENT_RULES` has exactly the values of data-model.md: `version` 1, `distanceStepKm` 10, `distanceStepRynke` 1, `elevationStepM` 1000, `elevationStepRynke` 5, `maxPausedShare` `{ num: 1, den: 2 }`, `minSpeedKmh` 10, `maxSpeedKmh` 45, `maxClimbMPerH` 1500, `excludedSportTypes` `["EBikeRide", "EMountainBikeRide"]`, `qualificationDeadline` `null`, `trainingThreshold` 250, `teamThreshold` 25, `maxVirtualShare` `{ num: 1, den: 3 }`, and `effectiveDate` matching `/^\d{4}-\d{2}-\d{2}$/`.
  - **Fingerprint pin**: `rulesFingerprint(CURRENT_RULES)` (a stable JSON of every field except `version` and `effectiveDate`, keys sorted) equals a literal string written in the test next to `version: 1`; the test's failure message says "a rule value changed: raise CURRENT_RULES.version and effectiveDate, then update this fingerprint".
  - `RynkeRules` has no field for flagged rides (FR-005g): `Object.keys(CURRENT_RULES)` contains nothing matching `/flag/i`.
  - `assertValidRules` throws for each of: a step, limit or threshold ≤ 0 or not an integer; `minSpeedKmh >= maxSpeedKmh`; a share with `den <= 0`, `num < 0` or `num > den`; `effectiveDate` or `qualificationDeadline` not `YYYY-MM-DD`. It accepts `CURRENT_RULES`.
  - `countingWindow({ SEASON_START_DATE: "2026-01-01" }, rules)` returns `{ seasonStart: "2026-01-01", deadline: rules.qualificationDeadline }`.

### Test support

- [X] T003 [P] Create `test/support/rides.ts` with `makeRide(overrides)` returning a `Ride` (the `src/rynke/rides.ts` input type, see T005) built from human units: `{ id, km, movingH, pausedH?, elevationM?, start?, sportType?, manual?, trainer?, flagged?, elapsedUnknown? }` → `activityId: id`, `distanceM: km * 1000`, `movingS: Math.round(movingH * 3600)`, `elapsedS: elapsedUnknown ? null : movingS + Math.round((pausedH ?? 0) * 3600)`, `elevationM: elevationM ?? 0`, `startUtc: start ?? "2026-05-01T08:00:00Z"`, `startLocal` = the same wall-clock string, `sportType: sportType ?? "Ride"`, `manual`, `trainer`, `flagged` default `false` (pass `null` for unknown), `refreshedAt: 0`. Also export `WINDOW = { seasonStart: "2026-01-01", deadline: null }`. Synthetic values only.

### Implementation for the foundation

- [X] T004 Create `src/rynke/rules.ts` (research R8): `interface Share { num: number; den: number }`; `interface RynkeRules` with the fields of data-model.md; `CURRENT_RULES: RynkeRules` with those values and `effectiveDate` set to the date this change ships; `assertValidRules(rules)` (throws `Error` on the cases in T002, a programming error); `rulesFingerprint(rules)`; `interface CountingWindow { seasonStart: string; deadline: string | null }` and `countingWindow(env: Pick<Settings, "SEASON_START_DATE">, rules)`. A short header comment says a developer raises `version` and `effectiveDate` in the same change as any change of a value or of rule logic, and that flagged rides (FR-005g) are deliberately not a rule value. Makes T002 green.

**Checkpoint**: `pnpm exec vitest run test/unit/rules.test.ts` green.

---

## Phase 3: User Story 2 — Rides earn Training Rynke (Priority: P1)

**Goal**: a pure `evaluateRides(rides, rules, window)` that gives every stored
activity a ride result and the rider's riding totals, exactly as FR-004–FR-005g,
FR-011 and FR-013a say.

**Independent Test**: feed synthetic rides into `evaluateRides` and compare the
Training Rynke with a hand calculation (`test/unit/rides.test.ts`).

### Tests for User Story 2 (write first, confirm red) ⚠️

All in `test/unit/rides.test.ts`, built with `makeRide` and `CURRENT_RULES`
unless a test says otherwise. Test names start with the spec scenario number
where there is one (`"US2-7: commute with 7 h at work earns nothing"`). Riding
Training Rynke = `riding.distanceRynke + riding.elevationRynke`.

- [X] T005 [US2] Create `test/unit/rides.test.ts` with Story 2 scenarios 1–4 and 6, and the distance and elevation rules (FR-004, FR-004a, FR-011):
  - US2-1: 100 km, 0 m → distance 10, elevation 0, riding Training 10.
  - US2-2: 79 km, 1999 m → distance 7, `elevationDm` 19990, elevation Rynke 5, total 12.
  - US2-3: three rides of 7 km → distance 0. US2-4: two of 25 km → 4.
  - US2-6: a ride starting the day before `seasonStart` (local date) → `outside_window`, contributes nothing. A ride on `seasonStart` itself counts. With `deadline: "2026-08-31"`: a ride on 2026-08-31 counts, on 2026-09-01 → `outside_window` (Story 4 scenario 7 at unit level).
  - Placement by local date: `startUtc` `"2025-12-31T23:30:00Z"` with `startLocal` `"2026-01-01T00:30:00Z"` counts (research R4).
  - US2-12: two rides of 600 m → `elevationDm` 12000, 5 Rynke, `elevationToNextStepDm` not asserted here (tally). US2-13: 1999 m + 1 m → 10.
  - Decimetre exactness: 600.1 m + 399.9 m → `elevationDm` 10000 and 5 Rynke.
  - Zero elevation is never an error: a 20 km, 0 m, 2 h ride counts with `elevationDm` 0.
- [X] T006 [US2] Extend `test/unit/rides.test.ts` with the pause rule (FR-005a, research R7):
  - US2-7: 40 km, 2 h moving, 7 h paused → `["pause"]`, 0 Training. US2-8: 150 km, 6 h + 2 h → 15. US2-9: 100 km, 4 h + 3 h → `["pause"]`. US2-10: 6 h moving + exactly 3 h paused (60 km) → counts. One second more paused → `["pause"]`. US2-11: 600 km, 24 h + 6 h, start `"2026-06-20T18:00:00Z"` → 60.
  - US2-14: 1500 m from counting rides plus an 800 m ride failing the pause rule → `elevationDm` 15000, 5 Rynke; the paused ride's `elevationDm` is 0.
  - Zero moving time: `movingS` 0 with elapsed 0, with elapsed 600 and with elapsed unknown → exactly `["pause"]` (no `too_slow`, `too_fast`, `climbing_rate`).
- [X] T007 [US2] Extend `test/unit/rides.test.ts` with plausibility, manual, sport type and flagged rides (FR-005b, FR-005c, FR-005e, FR-005g):
  - US2-17: 300 km in 4 h → `["too_fast"]`. US2-18: 15 km in 2 h → `["too_slow"]`. US2-19: 20 km in 2 h (exactly 10 km/h) → counts, 2 Rynke. Exactly 45 km/h (90 km, 2 h) counts; 90.001 km in 2 h → `too_fast`.
  - US2-20: 30 km, 2000 m, 1 h → `["climbing_rate"]`, `elevationDm` 0. Exactly 1500 m/h (30 km, 1500 m, 1 h) counts; 1500.1 m → `climbing_rate`.
  - US2-21: 200 km manual (8 h moving) → `["manual"]`. US2-22: 100 km `EBikeRide` and `EMountainBikeRide` → `["excluded_sport_type"]`.
  - Story 4 scenario 4 at unit level: 15 km manual over 2 h → `["manual", "too_slow"]` (contract order).
  - US2-23: 100 km, 1000 m, 4 h, `flagged: true` → `["flagged"]`, distance 0, `elevationDm` 0.
  - FR-005g under relaxed rules: with a rules object where every limit is relaxed (`minSpeedKmh` 1, `maxSpeedKmh` 1000, `maxClimbMPerH` 100000, `maxPausedShare` `{ num: 100, den: 1 }`, `excludedSportTypes` `[]`), a flagged ride still gets `["flagged"]`.
  - A flagged ride never blocks an overlapping ride: flagged 100 km and unflagged 80 km at the same time → the 80 km ride counts, the flagged one has `["flagged"]` only (no `overlap`).
  - Code order: a ride before the season start, `EBikeRide`, flagged, manual, 0 moving → `["outside_window", "excluded_sport_type", "flagged", "manual", "pause"]`.
- [X] T008 [US2] Extend `test/unit/rides.test.ts` with overlaps (FR-005d, research R5):
  - US2-15: bike computer 80 km / 600 m and phone 78 km / 650 m overlapping → the 80 km ride counts; the 78 km ride `["overlap"]` with `overlapsActivityId` = the 80 km ride's ID; distance 8, `elevationDm` 6000.
  - US2-16: one ride ending at 10:00:00 and another starting at 10:00:00 (UTC) → both count.
  - Tie-breaks: same distance → more elevation wins; same distance and elevation → lower `activityId` wins.
  - Chain: A (100 km) overlaps B (90 km), B overlaps C (80 km), A does not overlap C → A and C count, B `overlap` naming A.
  - A ride excluded for another reason (pause, manual, too fast, outside window) never blocks an overlapping ride and itself carries no `overlap`.
  - Overlap interval with unknown elapsed time uses the moving time: A 08:00–10:00 moving, elapsed unknown; B starting 10:00 → both count; B starting 09:59 → B (smaller) is `overlap`.
- [X] T009 [US2] Extend `test/unit/rides.test.ts` with unknown figures and virtual rides (FR-005f, FR-013a, research R6):
  - Elapsed unknown on a 40 km, 2 h ride → counts, `unknownFigures` `["elapsed_time"]`, no pause check.
  - `manual: null` on a 100 km ride → counts, `["manual"]` in `unknownFigures`. `flagged: null` → counts, `["flagged"]` listed. All unknown → `unknownFigures` in contract order `["elapsed_time", "manual", "trainer", "flagged"]`.
  - Virtual: `VirtualRide` → `isVirtual` true; `Ride` with `trainer: true` → true; `Ride` with `trainer: null` → false and `"trainer"` listed; `VirtualRide` with `trainer: null` → true and `"trainer"` **not** listed.
  - Riding totals without virtual rides: an outdoor 100 km / 600 m ride and a `VirtualRide` 50 km / 600 m → `distanceRynke` 15, `elevationDm` 12000, `elevationRynke` 5; `withoutVirtual` `{ distanceRynke: 10, elevationDm: 6000, elevationRynke: 0 }`.
  - Virtual ride overlapping an outdoor ride: the overlap is decided first (FR-013a "virtual rides left out after FR-005d"); if the virtual one wins, the outdoor one is `overlap` and contributes to neither total.
- [X] T010 [US2] Extend `test/unit/rides.test.ts` with determinism and output shape (FR-002):
  - Every permutation of a set of 5 rides with two overlap pairs, a pause failure and a virtual ride → identical `results` and `riding`.
  - A set of 60 generated rides (deterministic loop, no randomness) evaluated forward, reversed and rotated by 17 → identical output.
  - `results` sorted by ascending `activityId`, one per input ride; `counts` is true exactly when `reasons` is empty; `overlapsActivityId` is `null` unless `reasons` is `["overlap"]`; non-counting rides have `distanceRynke` 0 and `elevationDm` 0; the input array is not mutated.
  - `evaluateRides` calls `assertValidRules` (invalid rules throw).

### Implementation for User Story 2

- [X] T011 [US2] Create `src/rynke/rides.ts` (contracts/ride-evaluation.md, data-model.md "Input: Ride", research R3–R7, R15):
  - Types: `Ride` (`activityId`, `sportType`, `startUtc`, `startLocal`, `distanceM`, `movingS`, `elapsedS: number | null`, `elevationM`, `manual`, `trainer`, `flagged`: `boolean | null`, `refreshedAt`); `REASON_CODES` and `UNKNOWN_FIGURE_CODES` as `as const` arrays in contract order with derived `ReasonCode` / `UnknownFigureCode`; `RideResult` (`activityId`, `counts`, `reasons`, `overlapsActivityId`, `distanceRynke`, `elevationDm`, `isVirtual`, `unknownFigures`, `activityRefreshedAt`); `RidingTotals` (`distanceRynke`, `elevationDm`, `elevationRynke`, `withoutVirtual: { distanceRynke, elevationDm, elevationRynke }`).
  - `evaluateRides(rides, rules, window): { results: RideResult[]; riding: RidingTotals }`: per ride, check every rule independently and collect codes in contract order; `flagged` when `flagged === true` regardless of `rules`; zero moving time → `pause` only and no speed or climb check; then the overlap pass over the rides without codes, sorted by distance desc, elevation desc, `activityId` asc, half-open intervals `[start, start + (elapsedS ?? movingS))` on `Date.parse(startUtc)`; then the totals, with elevation Rynke `Math.floor(elevationDm / (elevationStepM * 10)) * elevationStepRynke` once on each total.
  - Exported helper `rideFromRow(row)` mapping an `activities` row (`ActivityRecord` from `src/strava/activity.ts`) to `Ride` (`0/1/null` → `false/true/null`), so `src/db/` and `src/rynke/apply.ts` share it.
  - Makes T005–T010 green.

**Checkpoint**: `pnpm exec vitest run test/unit/rides.test.ts` green; Story 2 is done in memory (scenario 5, a ride edited or deleted on Strava, is proven through storage in T017).

---

## Phase 4: User Story 4 — Each ride's Rynke and the season tally are stored (Priority: P1)

**Goal**: the tally, the two tables, and every path that changes a rider's
activities writing activity, ride results and balance in one D1 batch; the
`evaluate-rider` message and the daily sweep; a consistent read.

**Independent Test**: synthetic rides through the webhook path into local D1;
every stored ride result and the stored balance match a hand calculation and
each other (`test/integration/rynke-store.test.ts`).

**Depends on**: Phase 3 (`evaluateRides`).

### Tests for User Story 4 (write first, confirm red) ⚠️

- [X] T012 [P] [US4] Create `test/unit/tally.test.ts` (FR-013, FR-013a, FR-014a, research R12) for `tally(riding, extras, rules)`; `extras` is `{ training: number; team: number }` (zero until Stories 3 and 6):
  - Story 4 scenario 1 fields from riding `{ distanceRynke: 7, elevationDm: 12400, … }`, zero extras: `distanceRynke` 7, `elevationDm` 12400, `elevationRynke` 5, `elevationToNextStepDm` 7600, `trainingRynke` 12, `teamRynke` 0, `trainingMissing` 238, `teamMissing` 25, `qualified` false, `rulesVersion` and `rulesEffectiveDate` from the rules.
  - `elevationToNextStepDm`: 0 m → 10000; exactly 20000 dm → 10000 (a full step, never 0); 19999 dm → 1.
  - Story 4 scenario 8: riding 260 with 100 from virtual rides (`withoutVirtual` giving 160) and extras `{ training: 0, team: 25 }` → `trainingWithoutVirtual` 160, `virtualShareMissing` 7 (167 needed), `qualified` false. Same with `withoutVirtual` 167 → missing 0, qualified true.
  - `extras.training` counts in both `trainingRynke` and `trainingWithoutVirtual` (research R12).
  - Negative extras floor every total and `trainingWithoutVirtual` at 0; missing amounts are `max(0, …)`.
  - Qualification: exactly 250 / 25 / 167 qualifies; 249 or 24 or 166 doesn't; the virtual-share requirement uses `ceil(threshold × (den − num) / den)` in integers (threshold 10 with share 1/3 → 7).
- [X] T013 [P] [US4] Extend `test/integration/schema-minimisation.test.ts` (FR-015): add `ride_results` with exactly the columns of data-model.md (`strava_activity_id`, `athlete_id`, `counts`, `reasons`, `overlaps_activity_id`, `distance_rynke`, `elevation_dm`, `is_virtual`, `unknown_figures`, `rules_version`, `activity_refreshed_at`) and `rynke_balances` (`athlete_id`, `distance_rynke`, `elevation_dm`, `elevation_rynke`, `elevation_to_next_step_dm`, `training_rynke`, `team_rynke`, `training_missing`, `team_missing`, `training_without_virtual`, `virtual_share_missing`, `qualified`, `rules_version`, `rules_effective_date`, `computed_at`); `activities` unchanged.
- [X] T014 [P] [US4] Extend `test/integration/db.test.ts` with the migration `0005` constraints (raw SQL): inserting a `ride_results` row whose activity doesn't exist fails (FK); `counts` 2, `reasons` `'not json'`, negative `distance_rynke` or `elevation_dm`, `rules_version` 0 each fail their `CHECK`; `rynke_balances` with `elevation_to_next_step_dm` 0, `qualified` 2 or `rules_effective_date` `'2026-1-1'` fails; deleting an activity deletes its result; deleting a rider deletes their results and balance.
- [X] T015 [P] [US4] Extend `test/unit/messages.test.ts`: `parseWorkMessage({ kind: "evaluate-rider", athleteId: 900001 })` returns it; a missing or non-integer `athleteId` → `null`; extra fields are dropped; `serializeWorkMessage` gives `{"kind":"evaluate-rider","athleteId":900001}`.
- [X] T016 [P] [US4] Create `test/integration/rynke-apply.test.ts` for `applyAndEvaluate` and `readRynke` directly (research R11, R13, contracts/ride-evaluation.md):
  - `{ kind: "none" }` on a rider with 3 activities and no results → 3 ride results and a balance equal to `evaluateRides` + `tally` of the same rows, all with `rules_version` 1 and `rules_effective_date` = `CURRENT_RULES.effectiveDate`.
  - Running `none` again writes nothing: `ride_results` and `rynke_balances` rows identical including `computed_at` while `ctx.now()` advanced (SC-002).
  - Diff writes: after adding one non-overlapping ride via `upsert`, only that ride's result is new; every other result row is byte-identical (compare full rows before/after) and `computed_at` of the balance changes only if a balance field changed.
  - `upsert` of a record whose `strava_activity_id` is stored for another rider changes nothing for either rider (mirrors the SQL guard in `src/db/activities.ts`).
  - `delete` of an activity ID removes the activity and its result in the same batch; `delete` of an unknown ID writes nothing but still leaves a correct balance.
  - `delete-private` removes `is_private = 1` activities and their results, and the balance drops accordingly.
  - Many rides: 300 synthetic activities evaluated with `none` succeed (stays under D1's 100 bound parameters by using `json_each`).
  - `readRynke` before the first evaluation → `{ balance: null, results: [] }`; afterwards the balance's riding fields equal the sums over the counting results, and all rows carry the same `rules_version` (FR-014b, SC-005).
  - Outdated rows (Story 4 scenario 11): after evaluating under `CURRENT_RULES` (version 1), `readRynke` shows every row at version 1; `none` with a rules copy at `version: 2` rewrites every result and the balance to version 2.
- [X] T017 [P] [US4] Create `test/integration/rynke-store.test.ts` through the webhook queue path (`activityEvent` handler, fake Strava activities from `makeStravaActivity`) for Story 4 scenarios 1–7, 10, 12 and Story 2 scenario 5:
  - S4-1: rider without rides, a 79 km / 1240 m ride arrives → result counts, `distance_rynke` 7, `elevation_dm` 12400; balance 7 distance, 12400 dm, 5 elevation, 7600 dm to next step, 12 Training, 0 Team, 238 and 25 missing, not qualified.
  - S4-2: second 600 m ride after a first → both results `elevation_dm` 6000, balance `elevation_rynke` 5, no result carries elevation Rynke (no such column).
  - S4-3: 100 km, 4 h moving, 7 h elapsed → result `counts` 0, `reasons` `["pause"]`, 0 and 0; balance unchanged from before.
  - S4-4: manual 15 km over 2 h → `["manual","too_slow"]`.
  - S4-5: counting 78 km phone recording, then an overlapping 80 km arrives → 80 km counts, 78 km `["overlap"]` with `overlaps_activity_id` = 80 km ID, balance 8 distance and only the 80 km ride's metres.
  - S4-6 / US2-5: a delete event → result gone, balance excludes it; an update event that changes distance from 79 to 101 km → `distance_rynke` 10 and the balance follows.
  - S4-7: a ride after a qualification deadline: evaluate via `applyAndEvaluate` with a rules copy whose `qualificationDeadline` is `"2026-08-31"` (a `CURRENT_RULES` deadline doesn't exist yet) → `["outside_window"]`, nothing added.
  - Title-only update still writes nothing (no activity, result or balance change).
  - Unknown figure filled later: a ride stored with `is_flagged` `NULL` counts with `unknown_figures` `["flagged"]`; a re-read update with `flagged: true` → `["flagged"]`, `unknown_figures` `[]`, balance drops.
  - S4-10/S4-12: after every step, `readRynke` returns a balance whose riding fields equal the sums over counting results, all rows with the same `rules_version`, and the balance has `rules_effective_date`.
  - SC-002 / SC-003: after the whole sequence, `applyAndEvaluate` with `none` writes nothing; replaying the same events (duplicates, reordered create/update) ends in identical rows.
  - Fake Strava fails on any unexpected request; `evaluate-rider` makes none.
- [X] T018 [P] [US4] Extend `test/integration/import-page.test.ts` and `test/integration/reread-page.test.ts`: after a page of 3 activities is stored, `ride_results` has 3 rows and a `rynke_balances` row exists for the rider, consistent with `readRynke`; existing assertions keep passing.
- [X] T019 [P] [US4] Create `test/integration/rynke-deletion.test.ts` (FR-015, research R11):
  - Activity delete event → its result is gone in the same batch and the balance excludes it.
  - Reconnect narrowing the scope (`activity:read_all` → shared only, via `test/support/callback.ts`) → private activities and their results gone, balance recomputed, and exactly one `evaluate-rider` for the rider in `ctx.queue.sent`.
  - Reconnect without narrowing → no `evaluate-rider` sent.
  - `delete-rider` → no `ride_results` or `rynke_balances` row left for the rider (cascade); other riders untouched.
- [X] T020 [P] [US4] Create `test/integration/rynke-sweep.test.ts` (research R14, contracts/queue-messages.md "Scheduled: evaluation sweep"):
  - `listRidersNeedingEvaluation(db, 1)` and the cron step `fanOutEvaluations(ctx)` send `evaluate-rider` exactly for connected riders with: no balance row; a balance or ride result with another `rules_version`; an activity without a result; an activity whose `refreshed_at` ≠ its result's `activity_refreshed_at`.
  - A fully evaluated rider, a `needs_reconnect` rider and a rider without activities but with a current balance get nothing; a connected rider without activities and without a balance gets one (so they get a zero balance).
  - 150 riders needing it → two `sendBatch` calls (100 + 50).
  - `handleScheduled` runs the sweep after the existing steps (assert message order in `ctx.queue.sent`).
- [X] T021 [P] [US4] Create `test/integration/evaluate-rider.test.ts`: the consumer (`processBatch` with the real handlers) handles `evaluate-rider` → results and balance written, no fetch; a second run writes nothing; a missing rider or `needs_reconnect` rider → dropped by common rule 1 with nothing written; a D1 failure is transient. Extend `test/integration/wiring.test.ts` so `evaluate-rider` reaches its handler through `exports.default.queue`.

### Implementation for User Story 4

- [X] T022 [US4] Create `migrations/0005_rynke_results.sql` (data-model.md "Table: ride_results", "Table: rynke_balances"), header comment in the style of `0002`/`0003` naming feature 003 and that it only adds tables (the deployed version ignores them):
  - `ride_results`: `strava_activity_id INTEGER PRIMARY KEY REFERENCES activities (strava_activity_id) ON DELETE CASCADE`, `athlete_id INTEGER NOT NULL REFERENCES riders (athlete_id) ON DELETE CASCADE`, `counts INTEGER NOT NULL CHECK (counts IN (0, 1))`, `reasons TEXT NOT NULL CHECK (json_valid(reasons))`, `overlaps_activity_id INTEGER` (no FK, data-model.md), `distance_rynke INTEGER NOT NULL CHECK (distance_rynke >= 0)`, `elevation_dm INTEGER NOT NULL CHECK (elevation_dm >= 0)`, `is_virtual INTEGER NOT NULL CHECK (is_virtual IN (0, 1))`, `unknown_figures TEXT NOT NULL CHECK (json_valid(unknown_figures))`, `rules_version INTEGER NOT NULL CHECK (rules_version >= 1)`, `activity_refreshed_at INTEGER NOT NULL`; index `ride_results_by_rider ON ride_results (athlete_id)`.
  - `rynke_balances`: `athlete_id INTEGER PRIMARY KEY REFERENCES riders (athlete_id) ON DELETE CASCADE`; `distance_rynke`, `elevation_dm`, `elevation_rynke`, `training_rynke`, `team_rynke`, `training_missing`, `team_missing`, `training_without_virtual`, `virtual_share_missing` each `INTEGER NOT NULL CHECK (… >= 0)`; `elevation_to_next_step_dm INTEGER NOT NULL CHECK (elevation_to_next_step_dm > 0)`; `qualified INTEGER NOT NULL CHECK (qualified IN (0, 1))`; `rules_version INTEGER NOT NULL CHECK (rules_version >= 1)`; `rules_effective_date TEXT NOT NULL CHECK (rules_effective_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')`; `computed_at INTEGER NOT NULL`.
  - Check the existing `activities` / `riders` key column names in `migrations/0001_init.sql` before writing the FKs. Update `resetDb()` and `tableCounts()` in `test/support/ctx.ts` to include both tables. Makes T013 and T014 green.
- [X] T023 [P] [US4] Create `src/rynke/tally.ts` (research R12): `interface Extras { training: number; team: number }`, `NO_EXTRAS`, `interface Balance` with the camelCase fields of `rynke_balances` except `athleteId` and `computedAt`, and `tally(riding, extras, rules): Balance`. Pure; integer arithmetic only. Makes T012 green.
- [X] T024 [US4] Extend `src/work/messages.ts` with `EvaluateRiderMessage { kind: "evaluate-rider"; athleteId: number }` in `WorkMessage`, `parseWorkMessage` and `serializeWorkMessage`. Makes T015 green.
- [X] T025 [US4] Refactor `src/db/activities.ts` so its writes can join a batch, without changing behaviour of existing callers: export `upsertActivityStatement(db, record)` (the current `upsertStatement`), `deleteActivityStatement(db, athleteId, activityId)`, `deletePrivateActivitiesStatement(db, athleteId)`; add `listRiderActivitiesStatement(db, athleteId)` selecting every column `rideFromRow` needs for all of the rider's activities (not only the season's, data-model.md), and `activityOwnersStatement(db, ids)` returning `strava_activity_id, athlete_id` for the given IDs via `json_each(?)`. Keep `upsertActivity`, `upsertActivities`, `deleteActivity`, `deletePrivateActivities` as thin wrappers until T029–T031 replace their callers. Existing tests stay green.
- [X] T026 [US4] Create `src/db/rynke.ts` (research R10, R13, R14):
  - Row ↔ object mapping for `ride_results` (JSON arrays for `reasons` and `unknown_figures`, `0/1` booleans) and `rynke_balances`.
  - `readRideResultsStatement(db, athleteId)`, `readBalanceStatement(db, athleteId)`.
  - `upsertRideResultsStatement(db, athleteId, results)`: one `INSERT INTO ride_results (…) SELECT … FROM json_each(?1) … ON CONFLICT (strava_activity_id) DO UPDATE SET …` with all changed rows as one JSON parameter (use `json_extract(value, '$.field')`; store `reasons` and `unknown_figures` as JSON text).
  - `deleteRideResultsStatement(db, activityIds)`: `DELETE FROM ride_results WHERE strava_activity_id IN (SELECT value FROM json_each(?1))`.
  - `upsertBalanceStatement(db, athleteId, balance, now)`.
  - `readRynke(db, athleteId): Promise<{ balance: StoredBalance | null; results: StoredRideResult[] }>` reading both in one `db.batch` (FR-014b); never evaluates.
  - `listRidersNeedingEvaluation(db, rulesVersion): Promise<number[]>`: connected riders (`status` as `listConnectedRiderIds` in `src/db/riders.ts`) for whom any R14 condition holds, ordered by `athlete_id`.
- [X] T027 [US4] Create `src/rynke/apply.ts` (research R11, R13, contracts/ride-evaluation.md):
  - `type ActivityChange = { kind: "none" } | { kind: "upsert"; records: ActivityRecord[] } | { kind: "delete"; activityIds: number[] } | { kind: "delete-private" }`.
  - `applyAndEvaluate(db, athleteId, change, rules, window, now)`: (1) one read batch: the rider's activities, results, balance, and for `upsert` the owners of the records' IDs; (2) apply `change` in memory, dropping upsert records owned by another rider (as the SQL guard does) and private rows for `delete-private`; (3) `evaluateRides` + `tally(…, NO_EXTRAS, rules)`; (4) diff the new results against the stored ones field by field (incl. `rules_version` and `activity_refreshed_at`) and against removed activities; (5) one `db.batch` with the activity statements of `change`, the result upsert (only if any changed), the result delete (only if any), and the balance upsert (only if a field changed or no balance exists). Nothing is written when the batch would be empty.
  - Makes T016 green.
- [X] T028 [US4] Create `src/work/evaluate-rider.ts`: `evaluateRider: Handler<EvaluateRiderMessage>` calling `applyAndEvaluate(ctx.env.DB, rider.athleteId, { kind: "none" }, CURRENT_RULES, countingWindow(ctx.env, CURRENT_RULES), ctx.now())`, returning `{ kind: "ok" }`; register it in `handlers` in `src/index.ts`. Makes T021 green.
- [X] T029 [US4] Change `src/work/activity-event.ts`: `remove()` calls `applyAndEvaluate` with `{ kind: "delete", activityIds: [message.activityId] }`, the store path with `{ kind: "upsert", records: [record] }`; the title-only shortcut and the decision table stay as they are. Share a small `evaluateChange(ctx, athleteId, change)` helper in `src/rynke/apply.ts` that fills in `CURRENT_RULES`, `countingWindow(ctx.env, CURRENT_RULES)` and `ctx.now()`, and use it in T028–T031.
- [X] T030 [US4] Change `src/work/activity-page.ts` (`storeActivityPage`, shared by import and re-read): replace `upsertActivities` with `evaluateChange(ctx, rider.athleteId, { kind: "upsert", records })`, also when `records` is empty (so a first page without rides still creates the balance). Makes T018 green.
- [X] T031 [US4] Change `src/http/auth.ts`: when a reconnect narrows the scope, replace `deletePrivateActivities` with `evaluateChange(ctx, token.athleteId, { kind: "delete-private" })` and afterwards `ctx.queue.send({ kind: "evaluate-rider", athleteId: token.athleteId })` (research R11). Then remove the now-unused wrappers from `src/db/activities.ts` if nothing else calls them. Makes T019 green.
- [X] T032 [US4] Add `fanOutEvaluations(ctx)` to `src/work/scheduled.ts` (sends `evaluate-rider` for `listRidersNeedingEvaluation(ctx.env.DB, CURRENT_RULES.version)` via the existing `sendAll`) and call it in `handleScheduled` in `src/index.ts` after the existing steps. Makes T020 green.
- [X] T033 [US4] Run the Story 4 tests together (`pnpm exec vitest run test/unit/tally.test.ts test/integration/rynke-*.test.ts test/integration/evaluate-rider.test.ts test/integration/schema-minimisation.test.ts test/integration/db.test.ts`) and then the whole suite; fix regressions in feature 001's tests (`activity-event`, `import-page`, `reread-page`, `reconnect-scope`, `delete-rider`, `wiring`) by adjusting code, not by weakening their assertions. T017 must now be green.

**Checkpoint**: Stories 2 and 4 complete; every path that changes a rider's
activities stores consistent results; the cron fills and repairs them.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T034 [P] Add an invariant check to `test/integration/rynke-store.test.ts` (data-model.md "Invariants"): a helper `assertConsistent(athleteId)` used after each step asserts every activity has exactly one result and no result lacks its activity, no two counting results of the rider overlap, the balance equals `tally` of the stored counting results, and all rows share one `rules_version`.
- [X] T035 [P] Add a reference-set test `test/unit/reference-riders.test.ts` (SC-001): at least 20 synthetic riders, each a short ride list with a hand-calculated expected `trainingRynke`, `teamRynke` (0) and `qualified`, covering every rule, rounding case, window boundary and code; written as a table with a one-line comment per rider explaining the hand calculation.
- [X] T036 [P] Document `evaluate-rider` and the sweep in `specs/001-strava-connect-webhook/contracts/queue-messages.md` only by a one-line pointer to `specs/003-rynke-evaluation/contracts/queue-messages.md` (no duplication).
- [X] T037 Align `specs/003-rynke-evaluation/plan.md`, `data-model.md`, `quickstart.md` and `research.md` R15 with what was built: the results migration is `0005_rynke_results.sql`; `is_flagged` came in feature 001's `0003_activity_flagged.sql`; list `test/unit/rules.test.ts`, `test/integration/rynke-apply.test.ts`, `test/integration/evaluate-rider.test.ts` and `test/unit/reference-riders.test.ts` in the structure and quickstart commands.
- [X] T038 Update `README.md` if it lists tables, queue message kinds or cron steps: add `ride_results`, `rynke_balances`, `evaluate-rider` and the evaluation sweep.
- [X] T039 Run `pnpm lint`, `pnpm typecheck`, `pnpm test` and the quickstart's Stories 2 and 4 commands; apply `migrations/0005_rynke_results.sql` locally with `pnpm wrangler d1 migrations apply rynke-points --local` to check it parses in D1. Do not touch `--remote`.

---

## Story 3 (revision 2026-10-07)

Phases 6–9 add User Story 3 on top of the delivered Stories 2 and 4 (plan.md
"Story 3", research R16–R23). The conventions above still apply. Additionally:

- `src/rynke/team-events.ts` is pure like `rides.ts`. It imports from
  `rules.ts` **with `import type` only**, because `rules.ts` imports
  `TEAM_EVENT_KINDS` from it at runtime. It checks the window inline
  (`date >= seasonStart && (deadline === null || date <= deadline)`) and doesn't
  import `rides.ts`.
- Team-event kinds are the exact codes `team_training`, `training_weekend_day`
  and `technique_training`, in this order (contracts/ride-evaluation.md
  "Team-event kind codes").
- There are no organiser pages, routes or rider-facing text: the
  organiser-admin feature and feature 005's US3b come later (research R16).
- Multi-rider reads go through **one** statement per table, filtered with
  `json_each(?)` over the rider list (research R21).
- Synthetic riders `ATHLETE_A`, `ATHLETE_B`, `ATHLETE_C` from
  `test/support/fixtures.ts`, seeded with `seedRider`; event names are synthetic
  ("Synthetic team ride").

---

## Phase 6: Story 3 Setup

- [X] T040 Run `pnpm install`, `pnpm lint`, `pnpm typecheck` and `pnpm test` on branch `003-rynke-evaluation` and confirm all green before any Story 3 change. If something already fails, note it in the commit message instead of fixing it here.

---

## Phase 7: Story 3 Foundational (schema, kinds, rules version 2)

**Purpose**: the tables, the kind codes and the rules with event amounts. Every
Story 3 task depends on them.

**⚠️ CRITICAL**: Phase 8 depends on this phase.

### Tests (write first, confirm red) ⚠️

- [X] T041 [P] Extend `test/unit/rules.test.ts` (research R18, data-model.md "Input: Rynke Rules"):
  - `CURRENT_RULES.version` is 2.
  - `CURRENT_RULES.teamEvents` equals `{ team_training: { team: 1, training: 5 }, training_weekend_day: { team: 5, training: 10 }, technique_training: { team: 5, training: 5 } }`.
  - `Object.keys(CURRENT_RULES.teamEvents)` equals `TEAM_EVENT_KINDS`, imported from `src/rynke/team-events.ts`.
  - **Fingerprint pin**: update the literal and its comment to `version: 2`, keeping the failure message.
  - `RULES_HISTORY` has versions `[1, 2]` in this order. `rulesForVersion(1)` has `teamEvents` with the same amounts, and `rulesFingerprint(rulesForVersion(1)) === rulesFingerprint(CURRENT_RULES)`: version 2 changes logic, not values.
  - `assertValidRules` throws when `teamEvents`:
    - misses a kind;
    - has a kind not in `TEAM_EVENT_KINDS`;
    - has an amount that is negative, not an integer, or missing.
  - `assertValidRules` accepts an amount of 0.
- [X] T042 [P] Extend `test/integration/schema-minimisation.test.ts` (data-model.md, FR-015):
  - `team_event_kinds` has `["kind"]`.
  - `team_events` has `["event_id", "kind", "event_date", "name"]`.
  - `attendances` has `["event_id", "athlete_id"]`.
  - `rynke_balances` ends with `team_event_breakdown`, appended after `computed_at` (`ALTER TABLE … ADD COLUMN` appends).
- [X] T043 [P] Extend `test/integration/db.test.ts` with the migration `0006` constraints, in raw SQL (research R17, R20):
  - The seeded `team_event_kinds` rows equal `TEAM_EVENT_KINDS`.
  - Inserting into `team_events` fails for kind `'ride'` (FK), for `event_date` `'2026-5-1'`, and for `name` `''` or 101 characters. It succeeds with a 100-character name and with `NULL`.
  - Inserting into `attendances` fails for a missing event or a missing rider (FK) and for a second `(event_id, athlete_id)` (PK). A second `INSERT … ON CONFLICT DO NOTHING` leaves one row.
  - Deleting an event deletes its attendances. Deleting a rider (`DELETE FROM riders`) deletes their attendances and keeps the event and other riders' attendances.
  - A `rynke_balances` insert without `team_event_breakdown`, as the previously deployed version writes it, stores `'[]'`. `team_event_breakdown = 'not json'` fails its `CHECK`.

### Implementation

- [X] T044 Create `migrations/0006_team_events.sql` (data-model.md "Table: team_event_kinds", "Table: team_events", "Table: attendances", "Table: rynke_balances"):
  - Header comment in the style of `0005`: it names feature 003 Story 3, says it only adds tables and one column with a default so the deployed version keeps working, and points to research R17 and R20.
  - `CREATE TABLE team_event_kinds (kind TEXT PRIMARY KEY)`.
  - `INSERT INTO team_event_kinds (kind) VALUES ('team_training'), ('training_weekend_day'), ('technique_training')`.
  - `CREATE TABLE team_events`:
    - `event_id INTEGER PRIMARY KEY`
    - `kind TEXT NOT NULL REFERENCES team_event_kinds (kind)`
    - `event_date TEXT NOT NULL CHECK (event_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')`
    - `name TEXT CHECK (name IS NULL OR length(name) BETWEEN 1 AND 100)`
  - `CREATE TABLE attendances` with `event_id INTEGER NOT NULL REFERENCES team_events (event_id) ON DELETE CASCADE`, `athlete_id INTEGER NOT NULL REFERENCES riders (athlete_id) ON DELETE CASCADE` and `PRIMARY KEY (event_id, athlete_id)`.
  - `CREATE INDEX attendances_by_rider ON attendances (athlete_id)`.
  - `ALTER TABLE rynke_balances ADD COLUMN team_event_breakdown TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(team_event_breakdown))`.
  - In `test/support/ctx.ts`:
    - `resetDb()` deletes `attendances` and then `team_events`, before `riders`, but keeps `team_event_kinds` (seeded).
    - `tableCounts()` lists `team_events` and `attendances`.
  - Makes T042 and the schema part of T043 green.
- [X] T045 Create `src/rynke/team-events.ts` with `TEAM_EVENT_KINDS` (an `as const` array in contract order), `type TeamEventKind` and `isTeamEventKind(value: string)`, with a header comment naming FR-006 and research R17–R19. Then extend `src/rynke/rules.ts` (research R18):
  - Add `interface TeamEventAmounts { team: number; training: number }` and the field `teamEvents: Readonly<Record<TeamEventKind, TeamEventAmounts>>` on `RynkeRules`.
  - Rename today's constant to `const RULES_V1` (version 1, its `effectiveDate` unchanged, with the amounts of T041).
  - `CURRENT_RULES` becomes `{ ...RULES_V1, version: 2, effectiveDate }`, with `effectiveDate` the day T045 is implemented (`YYYY-MM-DD`, not before `RULES_V1.effectiveDate`), and `RULES_HISTORY` becomes `[RULES_V1, CURRENT_RULES]`.
  - `assertValidRules` checks that the keys equal `TEAM_EVENT_KINDS` and that every amount is a whole number ≥ 0.
  - Extend the header comment: event amounts are rule values, and version 2 is Story 3's logic change.
  - Makes T041 green and the kinds part of T043 green.
- [X] T046 Update tests that hard-code rules version 1. Use `CURRENT_RULES.version` for the version in effect, and `CURRENT_RULES.version + 1` where a test needs "a newer version". Don't weaken any assertion. Known places:
  - `test/integration/rynke-apply.test.ts`: `rulesVersion: 1` in the full-evaluation case, the `[1, 1, 1]` versions, and the "rules copy at version 2" case.
  - `test/integration/me-rynke.test.ts`: "Computed with rules version 1", and the S6 cases that use a stale version.
  - Anything else `pnpm test` shows failing because of the bump.

  `pnpm test` is green again, except for T043's checks that need Phase 8.

**Checkpoint**: `pnpm exec vitest run test/unit/rules.test.ts test/integration/schema-minimisation.test.ts test/integration/db.test.ts` green, and the full suite green.

---

## Phase 8: User Story 3 — Team events earn Team Rynke and Training Rynke (Priority: P1)

**Goal**: attendance at team events earns the fixed Team and Training Rynke per
kind (FR-006–FR-009). Every evaluation includes it. Every team-event change
stores the change and the affected balances in one batch (FR-014b).

**Independent Test**: record team events and a rider's attendance, evaluate,
and compare both totals and the per-kind breakdown with a hand calculation
(`test/unit/team-events.test.ts`, `test/integration/team-events-apply.test.ts`).

### Test support

- [ ] T047 [US3] Extend `test/support/rynke.ts` for Story 3:
  - `insertEvent(kind, date, name = null)` inserts a `team_events` row with plain SQL and returns `event_id` via `RETURNING`.
  - `attendRaw(eventId, athleteIds)` does `INSERT … ON CONFLICT DO NOTHING` with plain SQL. These two are the interim path of research R22.
  - `expectedRynke(rules, athleteId)` also reads the rider's attendances with `listRiderAttendanceStatement` and feeds `evaluateAttendance` into `tally` as extras.
  - `expectConsistent(athleteId, rules)` also asserts data-model.md's Story 3 invariants:
    - `balance.teamEvents` equals `evaluateAttendance(<stored attendance>, rules, window).byKind`;
    - `teamRynke` equals its Team sum;
    - `trainingRynke` equals riding plus its Training sum.

  It imports `evaluateAttendance` (T055) and `listRiderAttendanceStatement` (T057), so tests using it stay red until then.

### Tests for User Story 3 (write first, confirm red) ⚠️

- [ ] T048 [P] [US3] Create `test/unit/team-events.test.ts` for `evaluateAttendance(attendance, rules, window)` (research R19). It uses `CURRENT_RULES` and `WINDOW` from `test/support/rides.ts`, with a local helper `attend(eventId, kind, date = "2026-05-01")`. Test names start with the scenario number:
  - US3-1: 3 team trainings → `team_training` `{ attended: 3, team: 3, training: 15 }`, the other kinds 0; sums 3 Team and 15 Training.
  - US3-2: two `training_weekend_day` events on 2026-06-13 and 2026-06-14 → 10 Team, 20 Training.
  - US3-3: one technique training → 5 Team, 5 Training.
  - US3-4: the same `eventId` twice in the input counts once.
  - No attendance → `byKind` has every kind in `TEAM_EVENT_KINDS` order with zeros.
  - Window:
    - an event on `seasonStart` counts, the day before doesn't;
    - with `deadline: "2026-08-31"`, an event on 2026-08-31 counts and one on 2026-09-01 doesn't;
    - an event in the far future (2026-12-31, open deadline) counts, because the clock is never read.
  - The amounts come from the `rules` parameter: a copy with `team_training: { team: 2, training: 0 }` → 2 Team and 0 Training per training.
  - Order independence: every permutation of 5 attendances over all kinds gives identical output, and the input is not mutated.
- [ ] T049 [P] [US3] Extend `test/unit/tally.test.ts` (research R12, R20, R23):
  - `Extras` now carries `teamEvents`. `tally` copies it into `balance.teamEvents` unchanged. `NO_EXTRAS.teamEvents` has one zero entry per kind.
  - US3-5: `evaluateRides([makeRide({ id: 1, km: 60, movingH: 2.5, elevationM: 1000 })])` with `evaluateAttendance` of one team training → `teamRynke` 1, `trainingRynke` 16.
  - US3-6: the same ride without attendance → `teamRynke` 0, `trainingRynke` 11, breakdown all zero.
  - Story 4 scenario 9, team-event part: 2 team trainings and 1 technique training → `teamRynke` 7, `trainingRynke` 15 from events. The breakdown lists `training_weekend_day` with 0.
  - Qualification through events: riding 250 non-virtual and 5 technique trainings (25 Team) → qualified. With 4 technique trainings and 1 team training (21 Team) → `teamMissing` 4, not qualified.
  - Event Training Rynke count in `trainingWithoutVirtual`.
  - Existing tests switch to the new `Extras` shape. Their expected values don't change.
- [ ] T050 [P] [US3] Extend `test/unit/reference-riders.test.ts` (SC-001):
  - Riders now carry an optional attendance list, and the test evaluates `evaluateRides` + `evaluateAttendance` + `tally`.
  - Add at least 6 riders, each with a one-line hand calculation:
    - one per kind;
    - a whole training weekend;
    - attendance outside the window;
    - a duplicated attendance in the input;
    - a rider who qualifies only thanks to event Team Rynke;
    - a rider with virtual rides whose event Training Rynke close the non-virtual gap.
  - Expected `teamRynke` is non-zero for them.
- [ ] T051 [P] [US3] Create `test/integration/team-events-apply.test.ts`. It calls `applyTeamEventChange(env.DB, change, CURRENT_RULES, countingWindow(env, CURRENT_RULES), NOW)` and `teamEventChange(ctx, change)` (research R21, contracts/ride-evaluation.md "A team-event change"). Riders A and B are connected with one counting ride each; C is `needs_reconnect`. `expectConsistent` runs after every successful step.
  - **create-event**:
    - It returns `{ eventId, affected: [] }`, stores kind, date and name, and writes no balance (`snapshot()` unchanged).
    - It is refused with `TeamEventRefused` code `unknown_kind` for kind `"ride"`, `invalid_date` for `"2026-5-1"` and `"2026-02-30"`, and `invalid_name` for `""` and 101 characters. A refusal leaves `tableCounts()` unchanged.
  - **add-attendance**:
    - `[A, B]` at a team training → `affected` `[A, B]`. Both balances +1 Team and +5 Training, and the ride results are byte-identical to before (attendance changes no ride result).
    - US3-4: adding A again → `affected` `[]`, and nothing is written (snapshot including `computed_at` identical while `NOW` advanced).
    - `[A, C]` and `[A, 900999]` (unknown) → `rider_not_connected`, and nothing is written for A either.
    - An event dated before the rider's `connected_at` still counts (FR-006a).
  - **update-event**:
    - The kind changes from team training to technique training → `affected` = the attendees, who go to 5 Team and 5 Training.
    - Only the name changes → `affected` `[]`, the balances are byte-identical, and the name is stored.
    - The date moves to 2025-12-31, outside the window → the event's Rynke go. Moving it back restores them.
    - With a rules copy whose `qualificationDeadline` is `"2026-08-31"`, moving the event to 2026-09-01 takes its Rynke away.
  - **remove-attendance**:
    - `[A]` → `affected` `[A]`, and A's balance drops. Removing again → `affected` `[]`, nothing written.
    - A rider with rides worth 225 non-virtual Training Rynke and 5 technique trainings is qualified. Removing one attendance → `qualified` 0, `teamMissing` 5.
  - **delete-event**: `affected` = the attendees, the event's attendances are gone, and the balances drop.
  - **Missing event**: update, delete, add or remove on a missing `eventId` → `event_missing`, nothing written.
  - **Scenarios**, numbered like the spec, for rider D (connected, one ride of 60 km, 2.5 h and 1000 m):
    - US3-6: before any attendance → 0 Team, 11 Training, breakdown all zero.
    - US3-5: after `add-attendance` at a team training → 1 Team, 16 Training.
    - Story 4 scenario 9 (team-event part): after also attending a second team training and a technique training → `team_training` `{ attended: 2, team: 2, training: 10 }`, `training_weekend_day` all 0, `technique_training` `{ attended: 1, team: 5, training: 5 }`.
  - **Order** (SC-003): the same final attendance reached in two orders, once as add `[A, B]`, remove `[B]`, add `[B]` and once as add `[B]`, add `[B]`, add `[A]` (after `resetDb()` and the same seed), gives the same balances apart from `computed_at`.
  - **Stale rows**: a rider evaluated under a rules copy of version 1 who is then added → all their rows carry `CURRENT_RULES.version`.
  - **Ten attendees**: 10 connected riders with 3 rides each attend one event, and `delete-event` succeeds in one batch with every balance right.
  - **`teamEventChange(ctx, …)`**:
    - It sends exactly one `evaluate-rider` per affected rider, ascending `athleteId`, after its batch (`ctx.queue.sent`).
    - It sends none for create, a name-only update or a refusal.
  - **No Strava**: no fake-Strava request is made.
- [ ] T052 [P] [US3] Extend `test/integration/rynke-apply.test.ts` (research R21):
  - A rider attends 2 team trainings (via `attendRaw`), and an `upsert` of a new ride keeps 2 Team and the 10 event Training in the balance.
  - `none` on a rider with attendance but no activities creates a balance with the event Rynke. A second `none` writes nothing.
  - The stored `team_event_breakdown` column is the JSON array in kind order, and `readRynke` returns it as `balance.teamEvents`.
  - The rides of another rider attending the same event are untouched.
- [ ] T053 [P] [US3] Extend `test/integration/rynke-store.test.ts` and `test/integration/evaluate-rider.test.ts` (research R23):
  - Through the webhook path, a rider with attendance keeps the event Rynke after a create, an update and a delete event for their rides. `expectConsistent` covers the breakdown.
  - Attendance inserted with `attendRaw` is in the balance after `evaluate-rider`. A second `evaluate-rider` writes nothing. Rows carry version 2.
  - FR-026: the `attendances` rows are identical before and after `evaluate-rider` and after each webhook event.
- [ ] T054 [P] [US3] Extend `test/integration/rynke-sweep.test.ts` and `test/integration/rynke-deletion.test.ts` (research R22, R23):
  - `listRidersNeedingEvaluation(db, CURRENT_RULES.version, window)` has the new signature, and existing cases pass `countingWindow(env, CURRENT_RULES)`.
  - The sweep lists the rider after:
    - `attendRaw` for an evaluated rider;
    - deleting an attended event with plain SQL;
    - changing its kind with plain SQL;
    - moving it past a deadline (window with `deadline: "2026-08-31"`) or before the season start.
  - It doesn't list the rider:
    - after `evaluate-rider` for those cases;
    - after renaming an event with plain SQL;
    - after moving an attendance to another team training in the window;
    - for attendance outside the window on an evaluated rider;
    - for a `needs_reconnect` rider with attendance.
  - A balance with `rules_version` 1 and `team_event_breakdown` `'[]'` is listed.
  - `fanOutEvaluations` passes the window of `countingWindow(ctx.env, CURRENT_RULES)`.
  - In the deletion tests:
    - `delete-rider` removes their attendances, keeps the events, and leaves other attendees' attendances and balances untouched;
    - `delete-event` through `applyTeamEventChange` leaves no attendance of the event.

### Implementation for User Story 3

- [ ] T055 [US3] Implement `evaluateAttendance` in `src/rynke/team-events.ts` (research R19, contracts/ride-evaluation.md):
  - `interface Attendance { eventId: number; kind: TeamEventKind; date: string }`.
  - `interface TeamEventSum { kind: TeamEventKind; attended: number; team: number; training: number }`.
  - `interface AttendanceEvaluation { byKind: TeamEventSum[]; team: number; training: number }`.
  - Count each distinct `eventId` inside the window once per kind, then multiply by `rules.teamEvents[kind]`. Return one entry per `TEAM_EVENT_KINDS` entry, in order.
  - Pure, integers only, and the input isn't mutated.
  - Makes T048 green.
- [ ] T056 [US3] Extend `src/rynke/tally.ts` (research R12, R20):
  - `Extras` gains `teamEvents: readonly TeamEventSum[]`, and `NO_EXTRAS` gets one zero entry per kind.
  - Add `extrasFromAttendance(evaluation: AttendanceEvaluation): Extras`.
  - `Balance` gains `teamEvents: TeamEventSum[]`, copied from `extras`.
  - Update the comment on `Extras`: Story 3 fills it, and Story 6 adds corrections.
  - Update typed fixtures that build a `Balance` by hand, such as `test/unit/rider-view.test.ts` and `test/support/rynke.ts`, with a zero breakdown.
  - Makes T049 and T050 green.
- [ ] T057 [US3] Create `src/db/team-events.ts` (data-model.md, research R17, R21), with row types and mapping (`toAttendance(row)`):
  - **Reads**:
    - `listRiderAttendanceStatement(db, athleteId)`: `SELECT a.event_id, e.kind, e.event_date, e.name FROM attendances a JOIN team_events e ON e.event_id = a.event_id WHERE a.athlete_id = ?1 ORDER BY e.event_date DESC, a.event_id DESC`.
    - `listAttendanceOfRidersStatement(db, athleteIds)`: the same columns plus `a.athlete_id`, filtered with `a.athlete_id IN (SELECT value FROM json_each(?1))`.
    - `readTeamEventStatement(db, eventId)` and `listEventAttendeesStatement(db, eventId)` (athlete IDs, ascending).
    - `riderStatusesStatement(db, athleteIds)` (`athlete_id, status` from `riders` via `json_each`).
  - **Writes**:
    - `insertTeamEventStatement(db, event)` with `RETURNING event_id`.
    - `updateTeamEventStatement(db, eventId, event)`.
    - `deleteTeamEventStatement(db, eventId)` (attendances go by cascade).
    - `insertAttendancesStatement(db, eventId, athleteIds)`: `INSERT INTO attendances (event_id, athlete_id) SELECT ?1, value FROM json_each(?2) WHERE true ON CONFLICT DO NOTHING`.
    - `deleteAttendancesStatement(db, eventId, athleteIds)`.
- [ ] T058 [US3] Extend `src/db/rynke.ts` and `src/db/activities.ts` for the breakdown and multi-rider reads (research R20, R21):
  - `BalanceRow` and `StoredBalance` carry `team_event_breakdown` / `teamEvents`. `toStoredBalance` parses the JSON, and `'[]'` stays `[]`.
  - `upsertBalanceStatement` writes `team_event_breakdown = JSON.stringify(b.teamEvents)` as `?16` in both the insert and the update.
  - Add `readRideResultsOfRidersStatement(db, athleteIds)` and `readBalancesOfRidersStatement(db, athleteIds)` in `src/db/rynke.ts`, and `listActivitiesOfRidersStatement(db, athleteIds)` in `src/db/activities.ts`, each filtered via `json_each(?1)` and returning `athlete_id`.
  - Check `src/db/rider-view.ts` still maps the balance through `toStoredBalance`. Feature 005's US3b renders the breakdown later; nothing here shows it.
- [ ] T059 [US3] Refactor `src/rynke/apply.ts` so activity changes and team-event changes share read, evaluate and diff (research R21):
  - Add an internal `readRiders(db, athleteIds, extraReads)`. It runs one `db.batch` with T058's four multi-rider statements plus `extraReads` and returns per-rider state (activities map, stored results, stored balance, attendance) along with the extra results.
  - Add an internal `riderWrites(db, athleteId, state, rules, window, now)`. It runs `evaluateRides` and `evaluateAttendance` → `tally(riding, extrasFromAttendance(…), rules)` → the existing diff, and returns the result and balance statements.
  - `applyAndEvaluate` uses both with `[athleteId]`. Its activity-change handling and its "nothing written when the batch would be empty" rule stay as they are.
  - Update the file's header comment.
  - Makes T052 and T053 green, and keeps every Story 4 test green.
- [ ] T060 [US3] Add the team-event changes to `src/rynke/apply.ts` (research R21, contracts/ride-evaluation.md):
  - Types:
    - `TeamEventInput = { kind: string; date: string; name: string | null }`.
    - `TeamEventChange`, with the five variants of the contract.
    - `class TeamEventRefused extends Error { code: "unknown_kind" | "invalid_date" | "invalid_name" | "event_missing" | "rider_not_connected" }`, the codes of the contract's refusal table.
  - **Validation**, before any read:
    - `isTeamEventKind` for the kind;
    - the date matches `YYYY-MM-DD` and is a real calendar date (round-trips through `Date.UTC`);
    - the name is `null` or 1–100 characters (`[...name].length`).
  - `applyTeamEventChange(db, change, rules, window, now): Promise<{ eventId: number | null; affected: number[] }>`:
    1. one read batch with the event and its attendees (and the listed riders' statuses for `add-attendance`), refusing `event_missing` or `rider_not_connected` before anything is written;
    2. the affected riders, in ascending order:
       - create → none;
       - update → every attendee if `kind` or `date` changed, otherwise none;
       - delete → every attendee;
       - add → listed riders not yet attending;
       - remove → listed riders attending;
    3. `readRiders` for the affected riders, with the change applied to their attendance in memory;
    4. one `db.batch` with the change's statement (only if it changes something) and every affected rider's `riderWrites`;
    5. for create, `eventId` from the `RETURNING` result.
  - `teamEventChange(ctx, change)` runs `applyTeamEventChange` under `CURRENT_RULES`, `countingWindow(ctx.env, CURRENT_RULES)` and `ctx.now()`. It then calls one `ctx.queue.sendBatch` with an `evaluate-rider` per affected rider (none if empty) and returns the result.
  - Makes T051 and the event part of T054 green.
- [ ] T061 [US3] Extend the sweep (research R22, contracts/queue-messages.md "Scheduled: evaluation sweep"):
  - `listRidersNeedingEvaluation(db, rulesVersion, window)` binds `?2 = window.seasonStart` and `?3 = window.deadline` (`NULL` = open). It adds `OR EXISTS (SELECT kind, count(*) FROM attendances a JOIN team_events e ON e.event_id = a.event_id WHERE a.athlete_id = r.athlete_id AND e.event_date >= ?2 AND (?3 IS NULL OR e.event_date <= ?3) GROUP BY kind EXCEPT SELECT json_extract(value, '$.kind'), json_extract(value, '$.attended') FROM rynke_balances b, json_each(b.team_event_breakdown) WHERE b.athlete_id = r.athlete_id AND json_extract(value, '$.attended') > 0)`, and the same `EXCEPT` the other way round.
  - Update its doc comment.
  - `fanOutEvaluations` in `src/work/scheduled.ts` passes `countingWindow(ctx.env, CURRENT_RULES)`, and its comment mentions attendance.
  - Makes T054 green.
- [ ] T062 [US3] Run the Story 3 tests together (quickstart.md "Story 3: automated checks"), then the whole suite. Fix regressions by adjusting code or typed fixtures, not by weakening assertions, for example in `me-rynke`, `rider-view`, `dev-fake-strava`, `wiring` and `delete-rider`. Confirm `test/unit/dev-guard.test.ts` still passes.

**Checkpoint**: Story 3 complete. Every evaluation includes attendance, every
team-event change is one batch, and the sweep catches attendance entered by
hand.

---

## Phase 9: Story 3 Polish & Cross-Cutting Concerns

- [ ] T063 [P] Check `specs/003-rynke-evaluation/contracts/ride-evaluation.md` against the code: the exported names and signatures of T055–T061 match "Functions", and `TeamEventRefused['code']` matches the refusal table. Where the code had to differ, update the contract in the same commit and give the reason in the commit message.
- [ ] T064 [P] Update `README.md` if it lists tables or what the sweep checks: add `team_event_kinds`, `team_events`, `attendances` and the balance's `team_event_breakdown` breakdown, and point to quickstart.md "Story 3: entering team events by hand".
- [ ] T065 Run `pnpm lint`, `pnpm typecheck`, `pnpm test` and the quickstart's Story 3 command. Apply `migrations/0006_team_events.sql` locally with `pnpm wrangler d1 migrations apply rynke-points --local` to check that it parses in D1. Do not touch `--remote`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: none.
- **Phase 2 (Foundational)**: after Phase 1; blocks Phases 3 and 4.
- **Phase 3 (US2)**: after Phase 2.
- **Phase 4 (US4)**: after Phase 3 (`tally` and storage consume `evaluateRides`). Its tests (T012–T021) can be written while Phase 3 is implemented.
- **Phase 5 (Polish)**: after Phase 4.
- **Phase 6 (Story 3 setup)**: after Phase 5 (delivered).
- **Phase 7 (Story 3 foundational)**: after Phase 6; blocks Phase 8. T043's kinds check turns green only with T045; T046 after T045.
- **Phase 8 (US3)**: after Phase 7. Its tests (T048–T054) can be written while T055–T058 are implemented.
- **Phase 9 (Story 3 polish)**: after Phase 8.

### Within each phase

- Tests before the implementation they cover, confirmed red.
- T005–T010 share `test/unit/rides.test.ts` and run in order; T011 makes them green.
- T022 (migration) before T025–T027; T023 and T024 can run alongside T022.
- T025 → T026 → T027 → T028–T032. T029, T030, T031 touch different files but all use T029's `evaluateChange` helper: do T029 first, then T030 and T031 in parallel.
- T033 closes the phase.
- Story 3: T047 (test support) before T051–T054. T055 → T056 → T057 and T058 (in parallel, different files) → T059 → T060 → T061. T062 closes the phase.

### Parallel Opportunities

- Phase 2: T002 and T003.
- Phase 4 tests: T012–T021 are all different files ([P]).
- Phase 4 implementation: T022, T023, T024 in parallel; then T030 and T031 after T029.
- Phase 5: T034, T035, T036.
- Phase 7 tests: T041, T042, T043.
- Phase 8 tests: T048–T054 are all different files ([P]); T053 and T054 each touch two files no other task touches.
- Phase 8 implementation: T057 and T058 in parallel.
- Phase 9: T063 and T064.

## Parallel Example: User Story 4 tests

```text
Task: "T012 Create test/unit/tally.test.ts"
Task: "T013 Extend test/integration/schema-minimisation.test.ts"
Task: "T014 Extend test/integration/db.test.ts with migration 0005"
Task: "T016 Create test/integration/rynke-apply.test.ts"
Task: "T017 Create test/integration/rynke-store.test.ts"
Task: "T020 Create test/integration/rynke-sweep.test.ts"
```

## Parallel Example: User Story 3 tests

```text
Task: "T048 Create test/unit/team-events.test.ts"
Task: "T049 Extend test/unit/tally.test.ts"
Task: "T050 Extend test/unit/reference-riders.test.ts"
Task: "T051 Create test/integration/team-events-apply.test.ts"
Task: "T052 Extend test/integration/rynke-apply.test.ts"
Task: "T054 Extend test/integration/rynke-sweep.test.ts and rynke-deletion.test.ts"
```

## Implementation Strategy

### MVP: Story 2 in memory

1. Phases 1–3. `evaluateRides` is complete and exhaustively unit-tested, but
   nothing is stored or deployed differently yet. Safe to merge on its own.

### Then Story 4

2. Phase 4: migration, tally, storage, the batch paths, `evaluate-rider`, the
   sweep. After the merge into `main`, CI applies `0005` before publishing; the
   next daily cron fills every rider's results (quickstart "Rollout").
3. Phase 5: invariants, the SC-001 reference set, docs.

### Story 3

4. Phases 6–8: schema, rules version 2, the attendance evaluation, every
   evaluation reading attendance, the team-event changes and the sweep. One
   release: after the merge into `main`, CI applies `0006` before publishing,
   and the maintainer runs `pnpm daily:run` so every rider is re-evaluated
   under version 2 (quickstart "Story 3 release"). Until the organiser-admin
   feature ships, events are entered by hand (quickstart "Story 3: entering
   team events by hand").
5. Phase 9: contract codes, README, final checks.

## Notes

- [P] = different files, no dependency on an unfinished task.
- Never call Strava or production Cloudflare resources from tests.
- No rider-facing text: reasons and figures are codes; the rider view is a
  separate feature.
- Raising `CURRENT_RULES.version` re-evaluates everyone at the next daily cron.
  Story 3 raises it to 2 (T045); don't raise it further in this feature.
- No organiser page, route or rider-facing text for team events here; the
  organiser-admin feature and feature 005's US3b build on these functions.
