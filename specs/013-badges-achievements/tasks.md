---
description: "Task list for the badges art pipeline (feature 013, art scope only)"
---

# Tasks: Badges and Achievements (art pipeline)

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
- [ ] T019 [P] Note for the app's own tasks (later in this feature): a test that
  the app's badge catalog and `art/badges/badges.json` have the same ids,
  groups, categories and thresholds (research R9); add it to this file when
  those tasks are written.
- [ ] T020 Run [quickstart.md](quickstart.md) in full, then `pnpm lint`,
  `pnpm typecheck`, `pnpm test`.

---

## Phase 6: Ribbon (FR-040b)

**Purpose**: the frame carries the milestone ribbon of the drafts in
`drafts/abzeichen-{mobile,desktop}.png`; the text on it is the app's (its own
tasks).

- [ ] T021 [US1] Tests first in `test/unit/badge-frame.test.ts`: `frameSvg` with a
  ribbon option draws the band and its two notched tails after the window and
  before nothing that covers them, in the ring colour (`#1c1b13` personal,
  `#8cc4f0` team) with an ink outline, and contains no `<text>`; without the
  option nothing changes; `RIBBON` exports the band's box in badge units (where
  the page puts the milestone). Then implement in `scripts/badge-frame.mjs`,
  matching `drafts/abzeichen-mock.mjs`.
- [ ] T022 [US1] `pnpm badge-build` writes each badge twice, with and without the
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
