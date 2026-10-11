---
description: "Task list for feature 013: part A, the art pipeline; part B, the app"
---

# Tasks: Badges and Achievements

Part A (the art pipeline, T001 to T023) comes first; part B (the app) starts at
[T024](#part-b-the-app). Both follow [plan.md](plan.md).

# Part A: the art pipeline

**Input**: Design documents from `/specs/013-badges-achievements/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md),
[research.md](research.md), [data-model.md](data-model.md),
[contracts/badge-assets.md](contracts/badge-assets.md),
[quickstart.md](quickstart.md)

**Scope**: the art pipeline only (plan.md). Evaluation, runs, storage and the
Badges section get their own tasks with the rest of the feature.

**Tests**: REQUIRED for the pure modules (constitution Principle V): write each
test first and see it fail. The Gemini automation and the tracer are checked by
[quickstart.md](quickstart.md) (plan.md, Complexity Tracking).

**Stories**: the pictures serve US1 (see my badges, FR-040, FR-040a); the team
frame and team pictures serve US4 (team badges).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on open tasks)
- **[Story]**: the spec's user story the task serves

## Phase 1: Setup

**Purpose**: what already exists on this branch, and the new command.

- [X] T001 Shared prompt `art/badges/prompt.txt` and one scene per badge of the
  spec's ladders in `art/badges/badges.json` (69 badges, snippets `bike`,
  `runner`, `team`, `coins`).
- [X] T002 Generation script `scripts/badge-art.mjs` with `pnpm badge-art`
  (`package.json`), documented in `art/badges/README.md`; strictly sequential,
  paced (`--step 3-8`, `--pause 90-180` doubled after a failure, `--max 10` per
  run).
- [X] T003 Reference images `art/badges/reference/badge-{personal,team}.png`:
  the project owner's design (sunflower petals, ring, three stars, Rynke),
  hand-made, 1024 px each.
- [X] T004 Add `"badge-build": "node scripts/badge-build.mjs"` to `package.json`
  next to `badge-art`, and a stub `scripts/badge-build.mjs` that only prints its
  usage.

---

## Phase 2: Foundational (blocking)

**Purpose**: the pure modules every later step uses.

- [X] T005 [P] Tests first: new `test/unit/badge-prompts.test.ts` for
  `validateBadges(data)` with the data-model rules quoted: ids unique and
  matching `^[a-z0-9]+(-[a-z0-9]+)*$`; `group` is `"personal"` or `"team"`;
  `threshold` a number > 0, strictly increasing within a category; a category
  in one group only; `scene` non-empty, every `{{name}}` an existing snippet, no
  `{{scene}}`. Also: the real `art/badges/badges.json` (JSON import) validates
  with no problems; `buildPrompt(template, snippets, badge)` fills `{{scene}}`
  once, expands snippets and throws on an unknown one.
- [X] T006 Implement `validateBadges` and `buildPrompt` in new
  `scripts/badge-prompts.mjs` (no `node:` imports, so Vitest loads it in the
  Workers runtime) until T005 passes.
- [X] T007 Use `scripts/badge-prompts.mjs` in `scripts/badge-art.mjs` instead of
  its own `prompt()`; it refuses to start (exit 2) when `validateBadges` reports
  problems. Check `pnpm badge-art --print distance-100` prints the same prompt
  as before.
- [X] T008 [P] Tests first: new `test/unit/badge-frame.test.ts`:
  `WINDOW` is `{ cx: 50, cy: 50, r: 31 }`; `PICTURE_TRANSFORM` maps the
  generated circle (r 43.95 at 50, 50) onto the window, `scale(WINDOW.r /
  43.95)` (research R4);
  `RYNKE` is contained in `COIN_SPRITE` from `src/http/coin.ts`; `frameSvg`
  returns an SVG per contracts/badge-assets.md: `viewBox="0 0 100 100"`, no
  `width`/`height`, `<title>` first, picture inside a group clipped to the
  window with the transform, 3 stars for both kinds, ring fill `#1c1b13` for
  personal and `#8cc4f0` for team, two petal layers (gold `#c99a2e` behind,
  yellow `#fbe122` in front), no `var(`, `<script>`, `<image>` or `href="http`.
- [X] T009 Implement `WINDOW`, `PICTURE_TRANSFORM`, `RYNKE` and `frameSvg(kind,
  pictureMarkup, title)` in new `scripts/badge-frame.mjs`, drawing the design of
  `art/badges/reference/badge-{personal,team}.png` in SVG with explicit coin
  colours: two layers of pointed petals (gold behind, offset half a petal;
  yellow in front), each with a centre vein, ink outlines; the ring; three
  yellow stars at the top of the ring; the cream window. Compare the rendered
  placeholder with the reference side by side and match proportions (petal
  count and length, ring width, window radius) until T008 passes and they look
  alike. Done: measured from the reference (window r 28.7, ring r 36.6, 22
  petals per layer); the back petals are the reference's sunflower amber
  `#f0b400`, not the coin's gold; each petal is drawn once and reused, so the
  frame is about 5 KB.
- [X] T010 After PR #101 is merged: move its tracing out of
  `scripts/illustrations.mjs` into new `scripts/trace.mjs`
  (`traceImage(file) → { viewBox, paths }`, plus `snapToPalette(file, out)` for
  research R7), with `illustrations.mjs` using it; `pnpm illustrations` output
  unchanged (`git status` clean after a run).

**Checkpoint**: `pnpm test badge` passes; the tracer is shared.

---

## Phase 3: User Story 1 - Personal badge pictures (P1)

**Goal**: personal badges have a placeholder and, once generated, a finished SVG
the app can show (FR-040, FR-040a).

**Independent test**: quickstart.md §2 and §3 with `distance-100`.

- [X] T011 [US1] `scripts/badge-build.mjs` steps 1 and 2 of the contract:
  validate (exit 2, nothing written, on problems) and write
  `public/badges/placeholder-{personal,team}.svg` from `frameSvg(kind, RYNKE,
  …)`. The reference images stay as they are.
- [X] T012 [US1] `scripts/badge-build.mjs` step 3: snap every file in
  `art/badges/originals/` (except dotfiles) in place to an indexed PNG of at
  most 2048 px with `snapToPalette` (research R7); a file whose id isn't in
  `badges.json` stops the build with an error.
- [X] T013 [US1] `scripts/badge-art.mjs`: before `badge-build` snaps them, keep a
  copy of each raw download in `~/.cache/rynkepoints/badge-art/raw/` (outside
  the repo), and say so in `art/badges/README.md`.
- [X] T014 [US1] `scripts/badge-build.mjs` steps 4 to 6: trace each original with
  `traceImage`, write `public/badges/<id>.svg` with `frameSvg(group, paths, id)`
  plus the provenance comment, remove finished SVGs without an original, write
  `src/badges/pictures.ts` (`export const BADGE_PICTURES: ReadonlySet<string>`,
  sorted ids, a "generated, don't edit" header), print sizes and warn above
  100 KB (traced pictures measure 47 to 74 KB). A second run without changes
  leaves `git status` clean.
- [X] T014a [US1] `scripts/badge-build.mjs` takes badge ids (contract: `pnpm
  badge-build [id ...]`): validation and placeholders always in full; snapping,
  tracing and composing only for the named ids; unknown id exits 2; a named id
  without an original is skipped with a note; no removal of finished SVGs in a
  filtered run; `src/badges/pictures.ts` from every finished SVG on disk. Check:
  `pnpm badge-build distance-100` touches only `distance-100`'s files and leaves
  the list complete.
- [ ] T015 [US1] Generate and review the personal pictures: `pnpm badge-art` for
  the 35 personal ids, check each against "Checking a picture" in
  `art/badges/README.md`, retake with `--force` where needed, `pnpm
  badge-build`, commit originals, SVGs and `src/badges/pictures.ts`.

**Checkpoint**: quickstart.md §2 to §5 pass for a personal badge.

---

## Phase 4: User Story 4 - Team badge pictures (P2)

**Goal**: team badges get the team frame and their pictures.

**Independent test**: quickstart.md §3 with `big-training-5`: light blue ring,
several Rynkes in the picture.

- [ ] T016 [US4] Check `public/badges/placeholder-team.svg` and one finished team
  badge at 64, 128 and 280 px on light and dark backgrounds (placeholders
  checked: both kinds read at all three sizes on both backgrounds; open: one
  finished team badge, after T017); adjust the team
  ring colour in `scripts/badge-frame.mjs` (with T008's test) if personal and
  team don't tell apart at a glance.
- [ ] T017 [US4] Generate and review the 34 team pictures as in T015 (the team
  reference is attached automatically by group), `pnpm badge-build`, commit.

---

## Phase 5: Polish

- [X] T018 [P] Update `art/badges/README.md`: `pnpm badge-build`, the snapped
  originals and the raw copies, tracing via `scripts/trace.mjs` instead of "after
  #101".
- [X] T019 [P] Note for the app's own tasks: a test that the app's badge catalog
  and `art/badges/badges.json` have the same ids, groups, categories and
  thresholds (research R9). Now part of T026.
- [ ] T020 Run [quickstart.md](quickstart.md) in full, then `pnpm lint`,
  `pnpm typecheck`, `pnpm test`.

---

## Phase 6: Ribbon (FR-040b)

**Purpose**: the frame carries the milestone ribbon of the drafts in
`drafts/abzeichen-{mobile,desktop}.png`; the text on it is the app's (its own
tasks).

- [X] T021 [US1] Tests first in `test/unit/badge-frame.test.ts`: `frameSvg` with a
  ribbon option draws the band and its two notched tails after the window and
  before nothing that covers them, in the ring colour (`#1c1b13` personal,
  `#8cc4f0` team) with an ink outline, and contains no `<text>`; without the
  option nothing changes; `RIBBON` exports the band's box in badge units (where
  the page puts the milestone). Then implement in `scripts/badge-frame.mjs`,
  matching `drafts/abzeichen-mock.mjs`.
- [X] T022 [US1] `pnpm badge-build` writes each badge twice, with and without the
  ribbon (`public/badges/<id>.svg` and `<id>-ribbon.svg`, same for the
  placeholders); update `contracts/badge-assets.md` and `src/badges/pictures.ts`
  stays one id per badge.
- [X] T023 [P] [US1] Add to `art/badges/prompt.txt`: keep the lowest strip of the
  circle (about the bottom 15 %) free of anything important, a ribbon goes there;
  check `pnpm badge-art --print` and the prompt tests.

---

## Dependencies & execution order

- T004 → T011. T005 → T006 → T007. T008 → T009 → T011.
- T010 needs PR #101 merged into `develop` and this branch rebased; it blocks
  T012 and T014.
- T011 → T012 → T013 → T014 → T014a → T015 → T016 → T017.
- T018 after T014; T020 last.
- T021 → T022. T023 any time, before the pictures are generated (T015, T017).
- Generation (T015, T017) can start any time with `pnpm badge-art`: originals
  wait in `art/badges/originals/` until `badge-build` exists.

## Parallel opportunities

- T005 and T008 (different test files), then T006 and T009.
- While waiting for #101: T004 to T009 and T011, and generating originals.
- T018 and T019 alongside T015/T017.

## Implementation strategy

MVP: Phases 1 and 2 plus T011: frames from one module, tested prompts, and the
placeholders the app needs for its first release (FR-040a). Then T012 to T014
once #101 is merged, then the pictures, personal first (T015), team after
(T017). The app can ship with placeholders and gain pictures one commit at a
time, as only `public/badges/` and `src/badges/pictures.ts` change.

---

# Part B: the app

**Prerequisites**: [plan.md](plan.md) part B, [research.md](research.md) R10 to
R22, [data-model.md](data-model.md) "Part B",
[contracts/abzeichen-section.md](contracts/abzeichen-section.md),
[contracts/badge-messages.md](contracts/badge-messages.md),
[quickstart.md](quickstart.md) §6 to §9.

**Scope**: everything but the pictures. Picture generation (T015 to T017) runs
on its own branch; the app shows the placeholders for any id missing from
`BADGE_PICTURES` (FR-040a), so part B never waits for it.

**Tests**: REQUIRED (constitution Principle V): write each test first and see it
fail before the task that makes it pass.

**Stories**: US1 see my badges (P1), US2 earning a badge (P1), US3 running badges
(P2), US4 team badges (P2), as in [spec.md](spec.md).

## Phase 7: Setup (part B)

**Purpose**: the schema every story writes to.

- [ ] T024 Tests first: in `test/integration/schema-minimisation.test.ts` allow
  exactly the `runs` columns of data-model.md (`strava_activity_id`,
  `athlete_id`, `start_date`, `start_date_local`, `distance_m`, `is_private`,
  `refreshed_at`) and fail on any other; in `test/integration/db.test.ts`
  check that deleting a rider removes their `runs`, `rider_badges`,
  `badge_reveals` and `badge_rises` rows, and that an existing rider gets
  `badges_version` 0.
- [ ] T025 Write `migrations/0012_badges.sql`, adding only (the previous release
  never reads it):
  `runs` (`strava_activity_id INTEGER PRIMARY KEY`, `athlete_id INTEGER NOT
  NULL REFERENCES riders ON DELETE CASCADE`, `start_date TEXT NOT NULL`,
  `start_date_local TEXT NOT NULL`, `distance_m REAL NOT NULL CHECK (distance_m
  >= 0)`, `is_private INTEGER NOT NULL CHECK (is_private IN (0, 1))`,
  `refreshed_at INTEGER NOT NULL`, index `runs_by_rider (athlete_id,
  start_date_local)`); `rider_badges` and `badge_reveals` (`athlete_id`
  cascading, `badge_id TEXT NOT NULL`, `earned_on TEXT NOT NULL` as
  `YYYY-MM-DD`, PK `(athlete_id, badge_id)`); `badge_rises` (`athlete_id
  INTEGER PRIMARY KEY` cascading, `badge_ids TEXT NOT NULL` as a JSON array in
  catalog order, `risen_at INTEGER NOT NULL`); `ALTER TABLE riders ADD COLUMN
  badges_version INTEGER NOT NULL DEFAULT 0`. T024 passes.

---

## Phase 8: Foundational (part B, blocking)

**Purpose**: the catalog, the names and the text every story shows.

- [ ] T026 [P] Tests first: new `test/unit/badge-catalog.test.ts`: 13
  categories (7 personal, 6 team) with the spec's ladders (Assumptions table),
  each strictly increasing; units as data-model.md "Catalog"; 69 badges with ids
  `<category with dashes>-<threshold>`, except `run-length-half` (21.0975 km)
  and `run-length-marathon` (42.195 km); `BADGE_CATALOG_VERSION` an integer ≥ 1.
  Folds in T019 (research R9, R18): importing `art/badges/badges.json`, both
  list the same ids, groups, categories and thresholds.
- [ ] T027 Implement `src/badges/catalog.ts`: `BadgeCategory` (`id`, `group`
  `"personal" | "team"`, `unit` `"km" | "m" | "rynke" | "events" | "trainings" |
  "riders" | "attendances"`, `ladder`), `BADGE_CATEGORIES` in the spec's order,
  `BADGES` derived from them in catalog order, `type BadgeId`, `badgeById`,
  `BADGE_CATALOG_VERSION = 1`. No import from `scripts/` or `art/` (the test
  imports the JSON, the app doesn't). T026 passes.
- [ ] T028 [P] Tests first: new `test/unit/badge-names.test.ts`: `BADGE_NAMES`
  has exactly the catalog's ids, no empty name, no name twice; in
  `test/integration/no-hardcoded-copy.test.ts` treat
  `src/i18n/messages/badges.de.ts` like `quotes.de.ts` (German in every
  language, not catalog text).
- [ ] T029 Write `src/i18n/messages/badges.de.ts` (`BADGE_NAMES:
  Record<BadgeId, string>`, research R20): one German name per badge. Draft
  them dry and specific, gender-neutral wording first; the project owner
  confirms the list before the PR is merged (contracts/badge-messages.md).
  T028 passes.
- [ ] T030 [P] Add the keys of contracts/badge-messages.md "Catalog keys"
  (`badges.*`, `notification.badge`, `notification.badges`) to
  `src/i18n/messages/de.ts` and `en.ts`, German as in the contract, English
  mirroring it; `test/unit/catalogs.test.ts` keeps both locales' keys equal.
- [ ] T031 [P] Tests first: new `test/unit/badge-ribbon.test.ts`: the box
  exported by `src/badges/ribbon.ts` equals `RIBBON.box` of
  `scripts/badge-frame.mjs` and its text colours equal `RIBBON.text` (research
  R19). Then implement `src/badges/ribbon.ts` (box in badge units, plus the
  percentages the section uses: left 13 %, top 70 %, width 74 %, height 14 %).

**Checkpoint**: `pnpm test badge` passes; the catalog matches the art.

---

## Phase 9: User Story 1 - See my badges on my page (P1) 🎯 MVP

**Goal**: personal badges for the ride, event and Rynke categories are worked
out with the Rynke, stored, and shown in the Abzeichen section (FR-001 to
FR-005, FR-010 without runs, FR-013, FR-030, FR-040 to FR-042).

**Independent test**: quickstart.md §7 for sample riders with no badges, a few
badges and a full category.

- [ ] T032 [US1] Tests first in `test/unit/weeks.test.ts`: a new `riderDays`
  gives a rider's Training Rynke after each day that has an input (ride,
  attendance, correction), with the season elevation total floored once
  (003 FR-004a) as `riderWeeks` does; the existing `riderWeeks` tests keep
  passing.
- [ ] T033 [US1] Implement `riderDays` in `src/rynke/weeks.ts`, sharing the
  per-date tally with `riderWeeks` (one helper, research R14). T032 passes.
- [ ] T034 [P] [US1] Tests first: new `test/unit/badge-evaluate.test.ts` for
  `evaluateBadges(inputs, rules, window)` → `{ earned: EarnedBadge[], progress:
  CategoryProgress[] }` (data-model.md "Evaluation"), personal categories
  without runs: distance and elevation from counting rides only, by local start
  date; team events of any kind by event date; technique training counting
  `technique_training` attendances; Training Rynke from `riderDays`. US1
  scenario 1 (the 100 km badge carries the date of the ride that reached it),
  scenario 2 (412 of 500 km: `next` 500, `missing` 88), scenario 3 (last badge
  earned: `next` none), two thresholds crossed by one ride share its date, a
  correction's date dates a Training Rynke badge, a ride that stops counting
  drops the badge. Same inputs, same output.
- [ ] T035 [US1] Implement `src/badges/evaluate.ts` (pure, no D1) until T034
  passes.
- [ ] T036 [US1] Tests first: new `test/integration/badges-apply.test.ts`:
  `applyAndEvaluate` stores the rider's personal badges in `rider_badges` in the
  same batch as the Rynke; evaluating again writes no badge row (SC-002, US2
  scenario 1); a deleted ride takes its badge back; `applyTeamEventChange` and
  `applyCorrectionChange` award and take back too; `riders.badges_version` is set
  to `BADGE_CATALOG_VERSION`.
- [ ] T037 [US1] Implement: new `src/db/badges.ts` (read the riders' badges and
  `badges_version`, upsert and delete `rider_badges` rows, set
  `badges_version`); in `src/rynke/apply.ts` `readRiders` reads them in its one
  batch, `RiderState` gains `badges` and `badgesVersion`, its corrections gain
  their date (`listCorrectionsOfRidersStatement` in `src/db/corrections.ts`
  selects `correction_date`), and `riderWrites` writes only badges that
  appeared, disappeared or changed date (research R13). T036 passes.
- [ ] T038 [P] [US1] Tests first: new `test/unit/badge-view.test.ts` for
  `buildBadgeSection` (data-model.md "View model"): cards one per category with
  its highest earned badge, newest first (US1 scenario 8); gallery in catalog
  order, newest first inside (scenario 6); counts; not-yet rows for categories
  without a badge; no progress on a complete category (FR-004); the missing
  value from the value rounded down, whole units, run length to one decimal,
  never 0 (spec Assumptions); nothing while the waiting state shows (FR-005).
- [ ] T039 [US1] Implement `src/badges/view.ts` (pure) until T038 passes.
- [ ] T040 [US1] Tests first: new `test/integration/badges-section.test.ts`
  against contracts/abzeichen-section.md "Rules the tests check": the section
  after the Rynke figures with heading and intro; cards, gallery `<details>`
  without `open`, not-yet list; images `/badges/<id>-ribbon.svg` and
  `/badges/<id>.svg`, or `placeholder-personal[-ribbon].svg` for ids missing from
  `BADGE_PICTURES`; `.badge-ribbon-text` with the milestone; one `popover` per
  earned badge with name, what it was for and the date; the empty state (US1
  scenario 4); no section in the waiting state or without a balance (US1
  scenario 5); the English page shows the German names; SC-003: no unearned
  badge's id or name anywhere in the HTML; `/me` of another rider shows nothing
  of this rider's badges.
- [ ] T041 [US1] Implement `src/http/sections/badges.ts` and wire it into
  `src/http/sections/overview.ts` inside `overview-grid`, full width; the rider's
  badges come with the Overview's existing read (`readRiderView` in
  `src/db/rider-view.ts`). Numbers and dates through `I18n.formatNumber` and
  `formatDate`. T040 passes.
- [ ] T042 [P] [US1] Section styles in `src/http/style.ts`, following
  `drafts/abzeichen-{mobile,desktop}.png`: 128 px cards two per row at 360 px
  and four at 1100 px, 96 px gallery three per row, 280 px popover within 360 px
  and beside the badge on wider screens (FR-002b), ribbon text placed by the
  ribbon box in `#fbe122` (personal) and `#1c1b13` (team) and shrinking to fit,
  personal bars yellow and team bars team blue (FR-002c) from feature 011's
  tokens, light and dark mode, no horizontal scroll (SC-005); extend the CSS
  checks in `test/integration/layout.test.ts` as for earlier sections.
- [ ] T043 [P] [US1] `public/app.js`: on `pointerenter` with `pointerType ===
  "mouse"` a `.badge` button shows its popover, `pointerleave` hides it; tap,
  click and keyboard stay native (research R19).
- [ ] T044 [US1] `dev/fake-strava/samples.ts`: sample riders with no badge, a few
  badges, a full category (both technique trainings) and earlier and later
  badges in one category, so quickstart.md §7 shows every case; extend
  `test/integration/dev-fake-strava.test.ts` if it lists the samples.

**Checkpoint**: US1 works on `pnpm dev`; the MVP can be shown.

---

## Phase 10: User Story 2 - Earning a badge (P1)

**Goal**: a new badge is revealed once and named in the notification; silent
cases stay silent (FR-031, SC-001, SC-002).

**Independent test**: quickstart.md §8.

- [ ] T045 [US2] Tests first: new `test/integration/badge-reveals.test.ts`: a
  GET of `/me` with a newly earned badge shows `.badges-reveal` once and writes
  its `badge_reveals` row; a HEAD writes nothing; a reload shows no reveal; a
  badge taken back and earned again on a later date is revealed again, on the
  same date it isn't (spec edge case); a new rider's first visit after the
  import shows one reveal for all their badges (FR-031); the reveal's animation
  stops under `prefers-reduced-motion`.
- [ ] T046 [US2] Implement reveals: reveal statements in `src/db/badges.ts`,
  `reveal` in `src/badges/view.ts` (earned without a reveal row, or with an
  earlier `earned_on`, research R16), the `.badges-reveal` aside in
  `src/http/sections/badges.ts` in the look of feature 012's `.celebrate`, and
  the rows written on GET only in `src/http/sections/overview.ts`, like
  `writeSeen`. T045 passes.
- [ ] T047 [US2] Tests first in `test/integration/badges-apply.test.ts`: an
  ordinary evaluation with new personal badges writes `badge_rises` (their ids
  in catalog order) and returns them; a badge taken back writes no rise; an
  evaluation under new rules (stored balance on an older rules version) or a
  rider on an older `badges_version` writes `badge_reveals` rows for the badges
  that appear instead, and no rise (research R16, R18).
- [ ] T048 [US2] Implement in `src/rynke/apply.ts`: the silent check, the
  `badge_rises` write in the same batch, and the new badges in the results of
  `applyAndEvaluate`, `applyTeamEventChange` and `applyCorrectionChange` next to
  `rose`. T047 passes.
- [ ] T049 [US2] Tests first in `test/integration/notify-on-rise.test.ts`: an
  activity event, a team-event change or a correction that earns a badge without
  any Rynke rise notifies the rider; the import, the re-read, `evaluate-rider`
  and a taken-back badge don't (feature 010 "Which changes notify").
- [ ] T050 [US2] Implement: `src/work/activity-event.ts`, `teamEventChange` and
  `correctionChange` in `src/rynke/apply.ts` notify when Rynke rose or a badge
  is new. T049 passes.
- [ ] T051 [US2] Tests first: new `test/integration/badge-notification.test.ts`
  for `/me/notification-text`: the latest rise is a badge rise →
  `notification.badge` with the German name (also with English as the app
  language), several → `notification.badges`; a later Rynke rise → the existing
  Rynke text; no rise → 204 as today.
- [ ] T052 [US2] Implement in `src/http/pwa.ts`: read `badge_rises` next to
  `rynke_rises` (statement in `src/db/badges.ts`) and pick the later by
  `risen_at` (research R17). T051 passes.
- [ ] T053 [US2] Tests first: new `test/integration/badges-scheduled.test.ts`:
  the daily cron sends one `evaluate-rider` per connected rider on an older
  `badges_version`, the evaluation awards silently (reveal rows, no rise, no
  notification), and the next cron run sends nothing for them.
- [ ] T054 [US2] Implement: `listRidersNeedingEvaluation` in `src/db/rynke.ts`
  also lists riders with `badges_version <> ?`, given `BADGE_CATALOG_VERSION`
  from `fanOutEvaluations` in `src/work/scheduled.ts`. T053 passes.

**Checkpoint**: quickstart.md §8 passes for a ride that crosses a threshold.

---

## Phase 11: User Story 3 - Running badges (P2)

**Goal**: outdoor runs are kept on their own and give the two running categories,
without touching any Rynke (FR-020 to FR-023, SC-004).

**Independent test**: a sample rider with runs of 7.8 and 4.6 km: "Laufen
gesamt" at 12 km, Rynke, ride list and Team page unchanged.

- [ ] T055 [P] [US3] Tests first in `test/unit/activity.test.ts`:
  `toRunRecord` keeps `Run` and `TrailRun`, returns null for `VirtualRun`, for
  `trainer: true`, for `manual: true` and for cycling; a flag Strava doesn't
  send counts as not set (research R11); the record has only the `runs`
  columns; `toActivityRecord` still returns null for runs;
  `ACTIVITY_FIGURES_VERSION` is 4.
- [ ] T056 [US3] Implement `RunRecord` and `toRunRecord` in
  `src/strava/activity.ts`; raise `ACTIVITY_FIGURES_VERSION` to 4 with "version
  4 runs (feature 013)" in its comment (research R12). T055 passes.
- [ ] T057 [US3] Tests first: new `test/integration/runs-intake.test.ts`: an
  activity event for an outdoor run stores it in `runs`, never in `activities`;
  an update to treadmill or virtual removes it (FR-020a), as do a delete event,
  a 404 and a private run without read-all; `delete-private` removes private
  runs; a list page (import and re-read) stores runs; leaving deletes them; with
  and without runs, `ride_results`, `rynke_balances`, the ride list and the Team
  page are identical (SC-004, US3 scenario 2).
- [ ] T058 [US3] Implement: new `src/db/runs.ts`; in `src/rynke/apply.ts`
  `ActivityChange`'s `upsert` carries `runs: RunRecord[]` too, `delete` removes
  runs with those ids, `delete-private` removes private runs, `readRiders` reads
  the riders' runs in its batch; `src/work/activity-event.ts` and
  `src/work/activity-page.ts` map each activity with `toRunRecord` when
  `toActivityRecord` gives null, with the same private-scope rule. T057
  passes.
- [ ] T059 [US3] Tests first in `test/unit/badge-evaluate.test.ts`: run length
  and running from runs by local start date: US3 scenarios 1 (7.8 + 4.6 km →
  12.4 km, shown as 12), 1a (9.6 then 0.5 km → the 10 km running badge on the
  second run's date), 1b (a first run of 10.4 km → run length 5 and 10 and
  running 10, one date), 1c (longest 21.3 km → progress towards 42.2 km, one
  decimal); a first run of 22 km earns 5, 10 and half marathon on one date.
- [ ] T060 [US3] Implement the run categories in `src/badges/evaluate.ts` from
  `RiderState.runs`. T059 passes.
- [ ] T061 [US3] Tests first in `test/integration/scheduled-reread.test.ts`: a
  rider on figures version 3 is re-read once, their runs since the season start
  are stored, their badges come without a notification (US3 scenario 3, FR-022).
  Make it pass (expected: no code beyond T056 and T058).
- [ ] T062 [P] [US3] Tests first in `test/unit/consent-versions.test.ts`: the
  German `consent.short.read` and details mention runs ("Lauf") and team sums
  ("Team"), and `CONSENT_VERSIONS` stays at 1; then update `de.ts`, `en.ts` and
  the comment in `src/consent.ts` (feature 013 next to 008 and 010, research
  R22).
- [ ] T063 [US3] `dev/fake-strava/samples.ts`: a run rider with outdoor runs, a
  trail run, a treadmill run, a virtual run and a manual run, so only the
  outdoor ones count (quickstart.md §7).

**Checkpoint**: quickstart.md §7's run rider and §9 pass.

---

## Phase 12: User Story 4 - Team badges (P2)

**Goal**: the team's badges, worked out per request from listed riders only,
under "Team-Abzeichen" (FR-011, FR-014, FR-032).

**Independent test**: 10 sample riders at one team training: every rider's page
shows the team badge with that training's date.

- [ ] T064 [P] [US4] Tests first: new `test/unit/badge-team.test.ts` for
  `evaluateTeamBadges(sums, rules, window)` → earned team badges with dates and
  progress: big training as the most attendees at one event, dated by that
  event (US4 scenario 1); attendances summed over events (scenario 3: 92 →
  `missing` 8); Training Rynke together as the sum of each rider's `riderDays`
  (scenario 2: 4,210 → `missing` 790); distance, elevation and running
  together per day; a badge taken back when the sums fall.
- [ ] T065 [US4] Implement `src/badges/team.ts` (pure) until T064 passes.
- [ ] T066 [US4] Tests first in `test/integration/team-read.test.ts`: a new
  `readTeamBadgeSums(db)` reads in one batch, only over `LISTED_RIDER_IDS`:
  per rider and day the counting ride distance and elevation and the Training
  Rynke inputs, run distance per day, and per team event its date and number of
  listed attendees; riders without a current consent count towards nothing (US4
  scenario 4).
- [ ] T067 [US4] Implement `readTeamBadgeSums` in `src/db/team.ts`, next to
  `readTeam`. T066 passes.
- [ ] T068 [US4] Tests first in `test/integration/badges-section.test.ts` and
  `test/integration/badge-reveals.test.ts`: the team group after the personal
  one with "Team-Abzeichen" and "Alle Team-Abzeichen (n)", team placeholders and
  team-blue bars; team badges never in the personal cards or gallery (FR-014);
  no rider name or per-rider figure in the team group; team not-yet rows after
  the personal ones; a team badge earned after the rider's `connected_at` is
  revealed once, one earned before is shown without a reveal (US4 scenario 5);
  team badges never write `badge_rises` or notify (FR-032).
- [ ] T069 [US4] Implement: the Overview reads `readTeamBadgeSums` and passes
  `evaluateTeamBadges`'s result to `buildBadgeSection`; the view adds the team
  group, team not-yet rows and team reveals by `connected_at`. T068 passes.
- [ ] T070 [US4] `dev/fake-strava/samples.ts`: team events with enough sample
  attendees to earn the first big-training and attendance badges, and team
  sums that show progress in every team category.

**Checkpoint**: quickstart.md §7 shows team badges for every sample rider.

---

## Phase 13: Polish (part B)

- [ ] T071 [P] `e2e/smoke.e2e.ts`: on a sample rider with badges at 360 px, the
  Abzeichen section shows without horizontal scroll, "Alle meine Abzeichen"
  opens, tapping a badge opens its large view and Escape closes it.
- [ ] T072 Run [quickstart.md](quickstart.md) §6 to §9 at 360 px and desktop
  width, light and dark mode.
- [ ] T073 `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`.

---

## Dependencies & execution order (part B)

- T024 → T025 → everything else.
- Foundational: T026 → T027 → T028 → T029; T030, T031 alongside. All before
  Phase 9.
- US1: T032 → T033 → T034 → T035 → T036 → T037; T038 → T039 (after T035);
  T040 → T041 (after T037, T039); T042, T043 after T041; T044 last.
- US2 after US1: T045 → T046; T047 → T048 → T049 → T050; T051 → T052 (after
  T048); T053 → T054.
- US3 after T037 (needs `RiderState` and the badge writes), independent of US2:
  T055 → T056 → T057 → T058 → T059 → T060 → T061; T062 any time; T063 after
  T058.
- US4 after T039 and T046 (view and reveals): T064 → T065; T066 → T067; T068 →
  T069 (after T065, T067); T070 after T069.
- Polish last.

## Parallel opportunities (part B)

- T026, T028, T030, T031 (different files).
- T034 and T038 (pure modules) while T032/T033 run.
- T042 and T043 once T041 stands.
- US3 (T055 to T063) next to US2 once T037 is done; T064 and T066 next to
  either.
- T062 and T071 any time after their dependencies.

## Implementation strategy (part B)

MVP: Phases 7 to 9, the section with personal ride, event and Rynke badges
on placeholders. Then US2 (reveal and notification, which make it fun), then US3
and US4 in either order. Each phase ends green and can be released on its own;
pictures arrive from the art branch without touching any of it.
