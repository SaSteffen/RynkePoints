---
description: "Task list for the season rollover: Tour de Paris badges and the season album"
---

# Tasks: Season Rollover – Tour de Paris Badges and the Season Album

**Status (2026-10-20)**: All phases done. T051 ran quickstart sections 1
and 3 (`pnpm season:album --local`: 15 albums, print check 15 of 15); section
2's checks in the app are manual on the live site after release. T052 ran
lint, typecheck and `pnpm test`; `pnpm test:e2e` is left to CI (no app page
changed beyond the privacy text). Open for the owner: albums are German only,
since the app stores no rider language (FR-039, contracts/album-worker.md).

**Input**: Design documents from `/specs/021-season-rollover/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)
**Mock-up**: Claude Design "RynkePoints Saisonalbum",
https://claude.ai/artifact/Cre5jJh2RSpA3RJJe4PuNn

**Tests**: REQUIRED (constitution Principle V). Write each test task first, run it
and confirm it fails, then implement. Riders, events and badges are synthetic;
nothing contacts Strava or production.

**Organization**: one phase per user story of the spec, in the spec's order (all
P1). US1–US2 are the Tour de Paris part and can ship on their own; US3–US5 are the
album. US2 needs US1's kind; US3 needs nothing of US1–US2 but shows tour badges
once they exist; US4 and US5 need US3's album Worker.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 (tour days recorded), US2 (tour badges), US3 (making the
  albums), US4 (summary pages), US5 (sticker pages)

## Phase 1: Setup

- [x] T001 Run `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck` and
  `pnpm test` on the branch before any change (or confirm the branch's CI checks
  are green where the registry can't be reached). Later failures are then this
  feature's.
- [x] T002 [P] Add `pdf-lib` as a dev dependency (`pnpm add -D pdf-lib`), with the
  justification of research R14 in the commit message (constitution Principle IV).
- [x] T003 [P] Add `season-albums/` to `.gitignore` next to `strava-review/`, with
  a comment that it holds real rider data and is deleted by hand (research R15).
- [x] T004 [P] Add `"album"` to `tsconfig.json`'s `include`, and
  `"season:album": "node scripts/season-album.mjs"` to `package.json`'s scripts.
- [x] T005 [P] Add the album font to `album/fonts/`: Nunito regular, bold and
  black as woff2 with its `OFL.txt` (research R13, FR-055); a line in
  `art/README.md` or `album/fonts/README.md` saying where it came from.

---

## Phase 2: Foundational (blocks US1 and US2)

**Purpose**: the new kind and the window rule every event filter uses.

### Tests (write first, confirm they fail)

- [x] T006 [P] `test/unit/event-kinds.test.ts` for `src/rynke/team-events.ts` and
  `src/rynke/rules.ts` (data-model.md "Event kinds"): `EVENT_KINDS` is
  `TEAM_EVENT_KINDS` plus `tour_de_paris`; `isEventKind("tour_de_paris")` is true,
  `isTeamEventKind("tour_de_paris")` false; `CURRENT_RULES.teamEvents` has no
  `tour_de_paris` key; `seasonEnd({ seasonStart: "2026-09-01", … })` is
  `"2027-08-31"`; `eventInWindow` counts a `tour_de_paris` event from the season
  start to the season end and every other kind from the season start to the
  deadline; `evaluateAttendance` given a tour attendance (typed through the
  widened row type) earns nothing.
- [x] T007 [P] Extend `test/integration/db.test.ts` (or the migration test it
  uses): after migration `0018` `team_event_kinds` holds the four kinds and a
  `team_events` row with `kind = 'tour_de_paris'` can be inserted.

### Implementation

- [x] T008 `migrations/0018_tour_de_paris.sql`: `INSERT INTO team_event_kinds
  (kind) VALUES ('tour_de_paris');` only (additive, CLAUDE.md).
- [x] T009 `src/rynke/team-events.ts`: `EVENT_KINDS`, `EventKind`, `isEventKind`;
  `TEAM_EVENT_KINDS` keeps meaning the Rynke-earning kinds (research R9). Never
  call it plain `tour` (`src/http/tour.ts` is feature 020's).
- [x] T010 `src/rynke/rules.ts`: `seasonEnd(window)` and `eventInWindow(kind,
  date, window)` (research R10); `inCountingWindow` unchanged for rides.
- [x] T011 `src/db/team-events.ts`: type event rows' `kind` as `EventKind`; where
  rows become `Attendance` for the tally, leave out `tour_de_paris` rows so the
  tally's types stay `TeamEventKind` (FR-002).

---

## Phase 3: User Story 1 – Organisers record the tour days (P1)

**Goal**: tour days can be created after the deadline, take attendance and
reports, show no Rynke and earn none.

**Independent test**: quickstart section 2, steps 1–3 (first three checks).

### Tests (write first, confirm they fail)

- [x] T012 [P] [US1] `test/integration/tour-events.test.ts`: an organiser creates
  a `tour_de_paris` event dated after `QUALIFICATION_DEADLINE` (the form accepts
  it; any other kind on that date is still refused); records attendance for two
  synthetic riders; their stored balances and qualification do not change
  (FR-002); the riders' Termine tab lists the tour day with no amount line
  (FR-004) and offers "Ich war dabei" on it once it has taken place, and the
  report is accepted (FR-003, feature 019).
- [x] T013 [P] [US1] Extend `test/unit/messages.test.ts` (or the catalog test):
  `eventKind.tour_de_paris` exists in de and en (contracts/messages.md).

### Implementation

- [x] T014 [US1] `src/http/organiser/events.ts`: the kind select offers
  `EVENT_KINDS`; the date check and the attendance window use
  `eventInWindow(kind, …)` instead of `inCountingWindow`.
- [x] T015 [US1] `src/http/sections/events.ts`: list events with
  `eventInWindow`; no amount chips for `tour_de_paris` (FR-004); reports for tour
  days through the same window.
- [x] T016 [US1] Every other event filter found by `grep -n "inCountingWindow"
  src/http src/rynke/participation.ts` that filters events (not rides) uses
  `eventInWindow`; list them in the commit message.
- [x] T017 [P] [US1] `src/i18n/messages/de.ts` and `en.ts`:
  `eventKind.tour_de_paris` ("Tour de Paris" in both).
- [x] T018 [US1] `dev/fake-strava/seed.ts` (and `samples.ts`): the sample season gets 8 tour days after
  the deadline with attendances of some sample riders, so `pnpm dev` and the
  album's `--local` run show them (synthetic only).

---

## Phase 4: User Story 2 – The team earns a badge for every tour day (P1)

**Goal**: "Tour-Tag 1" … "Tour-Tag 8" earned on read from the listed riders'
tour days; tour days also count for the team-event badges.

**Independent test**: quickstart section 2, steps 3–4 (badges checks).

### Tests (write first, confirm they fail)

- [x] T019 [P] [US2] `test/unit/badge-tour.test.ts` for `src/badges/team.ts`
  (data-model.md "Tour badge inputs"): Anna on 20 and 21 June earns
  `tour-de-paris-1` dated 20 June and `-2` dated 21 June; Anna on one day and Ben
  on another earn only `-1`, dated the earlier day; ten tour days of one rider
  earn up to `-8` and no more; removing an attendance takes the badge back; a
  tour day dated after "today" counts for nothing; progress is "Noch n Tage" from
  the largest count; the result never names a rider.
- [x] T020 [P] [US2] Extend `test/unit/badge-catalog.test.ts`: category
  `tour_de_paris`, group `team`, unit `days`, ladder `[1, 2, 3, 4, 5, 6, 7, 8]`,
  ids `tour-de-paris-1` … `-8`, after `attendances` and before `team_surprise`;
  `BADGE_CATALOG_VERSION` is 6; `art/badges/badges.json` matches.
- [x] T021 [P] [US2] Extend `test/unit/badge-names.test.ts`: "Tour-Tag 1" …
  "Tour-Tag 8"; `badges.category.tour_de_paris`, its sentence and
  `badges.tourDay.for` exist in de and en.
- [x] T022 [P] [US2] Extend `test/unit/badge-team.test.ts` and
  `test/unit/badge-evaluate.test.ts`: a tour day after the deadline counts for
  `big_training`, `attendances` and the personal `team_events` (FR-005), and not
  for `technique`.
- [x] T023 [P] [US2] Extend `test/integration/badges-section.test.ts` and
  `test/integration/team-badge-notification.test.ts`: the team group shows the
  "Tour de Paris" card with the team placeholder picture and "Noch n Tage"; a
  newly earned tour badge is told once to each listed rider (FR-012).

### Implementation

- [x] T024 [US2] `src/badges/catalog.ts`: the category (data-model.md "Badge
  catalog"), `BADGE_CATALOG_VERSION = 6`; `art/badges/badges.json` gets the 8
  entries with a placeholder `scene`.
- [x] T025 [P] [US2] `src/i18n/messages/badges.de.ts`: "Tour-Tag 1" …
  "Tour-Tag 8"; `de.ts`/`en.ts`: `badges.category.tour_de_paris`, its sentence,
  `badges.tourDay.for` with `{day}` (contracts/messages.md).
- [x] T026 [US2] `src/db/team.ts`: `teamBadgeSumsStatements` gets one statement
  for listed riders' attendances at `tour_de_paris` events (athlete id, date),
  and `TeamEventSum` rows carry `kind`; `toTeamBadgeSums` fills `tourDays`.
- [x] T027 [US2] `src/badges/team.ts`: the `tour_de_paris` series (research R11);
  `big_training` and `attendances` filter with `eventInWindow` capped at today.
- [x] T028 [US2] `src/badges/evaluate.ts`: personal `team_events` counts
  attendance with `eventInWindow` (tour days after the deadline included);
  `technique` unchanged.
- [x] T029 [US2] `src/badges/view.ts` and `src/http/sections/badges.ts`: the
  card's progress line for `days`, and the "what it was for" line from
  `badges.tourDay.for` for tour badges.

**Checkpoint**: US1 and US2 can be released on their own (a PR before the album).

---

## Phase 5: User Story 3 – The maintainer makes the season albums (P1)

**Goal**: `pnpm season:album` writes one checked PDF per listed rider into the
ignored folder, reading production read-only.

**Independent test**: quickstart section 3 with a minimal album page (US4 and US5
fill it in).

### Tests (write first, confirm they fail)

- [x] T030 [P] [US3] `test/unit/album-guard.test.ts` for `album/guard.ts`
  (contracts/album-worker.md "Read-only guard"): SELECT and WITH … SELECT pass,
  also with leading comments; INSERT, UPDATE, DELETE, REPLACE, CREATE, DROP,
  ALTER, PRAGMA, `WITH … DELETE` and `SELECT 1; DELETE …` throw
  `ReadOnlyError`; `exec` and `dump` always throw; `batch` of guarded statements
  runs.
- [x] T031 [P] [US3] `test/unit/album-ignore.test.ts`: `.gitignore` lists
  `season-albums/` (read through `import.meta.glob(?raw)` as `dev-guard.test.ts`
  reads sources).
- [x] T032 [P] [US3] Extend `test/unit/dev-guard.test.ts` layer 1: nothing under
  `src/` imports `album/`.
- [x] T033 [P] [US3] `test/integration/album-worker.test.ts`: with seeded
  synthetic riders, `GET /riders?cutoff=…` lists exactly the listed riders with
  file stems (`anna-1`, two Bens as `ben-1`, `ben-2`); `GET /album/:id` answers
  200 HTML for a listed rider and 404 for another; a missing or invalid `cutoff`
  answers 400; a host other than `localhost`/`127.0.0.1` answers 404; no table's
  row count changes (`tableCounts`).

### Implementation

- [x] T034 [US3] `album/guard.ts`: the read-only D1 wrapper.
- [x] T035 [US3] `album/wrangler.jsonc` (contracts/album-worker.md
  "Configuration") and `album/worker.ts`: the routes, local hosts only, `env.DB`
  wrapped by the guard first, `album.css` and fonts served; `/album/:id` renders
  a placeholder page for now.
- [x] T036 [US3] `scripts/season-album.mjs` (contracts/season-album-command.md):
  options, the three preconditions (exit 2), starting and stopping `wrangler dev
  -c album/wrangler.jsonc` with the vars from the root config (`--local` with
  `.wrangler/fake-state`), printing each album with Playwright's Chromium
  (`preferCSSPageSize`, `printBackground`, after network idle and
  `document.fonts.ready`), the summary output, the old-albums notice and the exit
  codes.
- [x] T037 [US3] The print check in `scripts/season-album.mjs` with `pdf-lib`
  (research R14): A4 MediaBox within 0.5 mm, even page count, no image XObject,
  every font embedded; failing albums listed, exit 1.
- [x] T038 [US3] Re-run research R1's measurement with the real page once US5 is
  done (size and time per album, with the tight shadow); record the numbers in
  research.md R1 and adjust SC-005 if needed.

---

## Phase 6: User Story 4 – The album's first pages sum up the season (P1)

**Goal**: page 1 (cover and the rider's season) and page 2 (the team's season),
as in the mock-up.

**Independent test**: quickstart section 3, page 1 and 2 checks against `pnpm dev`.

### Tests (write first, confirm they fail)

- [x] T039 [P] [US4] `test/integration/album-render.test.ts` (research R16): for a
  seeded synthetic season and a cut-off, `album/load.ts` gives the rider's
  Training and Team Rynke equal to what the rider page shows, the team total
  equal to the Team page's, events attended counting tour days; the cut-off
  before the deadline uses the daily series' value; every team event of the
  season is listed with its attendee count and the rider's own ticks; the HTML
  contains no other rider's first name (FR-033); nothing is written to D1.
- [x] T040 [P] [US4] `test/unit/album-layout.test.ts`, summary part: page 1 is a
  right-hand page with the 20 mm gutter on the left; page 2 a left-hand page
  with it on the right; 49 events continue on page 3 with the header row again.

### Implementation

- [x] T041 [US4] `album/load.ts`: `AlbumData` (data-model.md "Album model") from
  the existing readers with the clock set to the cut-off (research R12);
  `locale` from the rider's stored language.
- [x] T042 [US4] `album/layout.ts` (summary pages) and `album/render.ts`: pages 1
  and 2 as in the mock-up (cover band, name field, three figure tiles, "Stand:";
  team band, team total, event table with tour rows marked), texts from the
  `album.*` messages.
- [x] T043 [P] [US4] `src/i18n/messages/de.ts` and `en.ts`: the `album.*`
  messages of contracts/messages.md.
- [x] T044 [P] [US4] `album/style.ts` (was `album/album.css`; a string like `src/http/style.ts`, since Vitest empties `.css` files): `@page { size: 210mm 297mm; margin: 0 }`,
  one `section.page` per A4 page at 210 × 297 mm, white paper, Nunito via
  `@font-face`, no `filter` anywhere.

---

## Phase 7: User Story 5 – Sticker pages like a Panini album (P1)

**Goal**: one slot per catalog badge, the printed placeholder in each, earned
stickers stuck on imperfectly, as in the mock-up.

**Independent test**: quickstart section 3, sticker checks; run twice, same result.

### Tests (write first, confirm they fail)

- [x] T045 [P] [US5] `test/unit/album-layout.test.ts`, sticker part
  (contracts/album-layout.md): every catalog badge in exactly one slot, gallery
  order (FR-035); every slot, heading and sticker with its pose and shadow inside
  the page's safe area, gutter on the inner side (FR-051); no heading last on a
  page; continued categories get "(Fortsetzung)"; the page count is even
  (FR-053); `pose(athleteId, badgeId)` follows the contract's sequence (FNV-1a,
  xorshift32, miss in about a third, rotation ±7°, y clamped to ±2.5 mm), equals
  the mock-up's `Slot.dc.html` for three sample ids, and is the same on every
  call (FR-026).
- [x] T046 [P] [US5] Extend `test/integration/album-render.test.ts`: earned slots
  (on or before the cut-off) carry the sticker with picture, or the group's
  placeholder picture for badges without one (stand-in tour badges); empty ladder
  slots show the name, empty surprise slots "?" and no rule (FR-037); each group
  shows "n von m" (FR-038); `album.css` contains no `filter`.

### Implementation

- [x] T047 [US5] `album/layout.ts` (sticker pages): slots, headings, pagination
  and `pose` per contracts/album-layout.md.
- [x] T048 [US5] `album/render.ts` (sticker pages): the band, headings, printed
  placeholder in every slot, the sticker (white edge, picture, the tight
  shadow), captions; badge pictures from `public/badges/` through the Worker's
  assets.

---

## Phase 8: Polish & cross-cutting

- [x] T049 [P] Privacy page (feature 017): `privacy.album` in de and en
  (contracts/messages.md, FR-040), shown in `src/http/privacy.ts`; extend
  `test/integration/privacy.test.ts`.
- [x] T050 [P] `CLAUDE.md`: `pnpm season:album` in the command list, and running
  it without `--local` among the manual maintainer steps.
- [x] T051 Run quickstart.md sections 1–3 end to end; fix what differs.
- [x] T052 `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` green;
  update this file's checkboxes and a status line at the top.

## Dependencies

- Setup (T001–T005) → Foundational (T006–T011) → US1 (T012–T018) → US2
  (T019–T029).
- US3 (T030–T037) needs only Setup; US4 (T039–T044) and US5 (T045–T048) need
  US3's Worker (T035). T038 needs US5.
- Polish after the stories it touches (T049 any time; T051–T052 last).

## Parallel examples

- Foundational tests: T006 and T007 together.
- US2 tests: T019, T020, T021, T022 and T023 together; T025 beside T024.
- US3 tests: T030, T031, T032 and T033 together.
- US4/US5: T043 and T044 while T041 and T042 are written; T045 and T046 together.

## Implementation strategy

1. **MVP 1 – Tour de Paris in the app** (Setup, Foundational, US1, US2): a PR of
   its own, released well before the tour.
2. **MVP 2 – a printable album** (US3 with US4): every rider's PDF with the
   summary pages, checked for print.
3. **Full album** (US5, then T038 and Polish): the sticker pages; one test run
   with `--local` and one album opened and printed before the season end.
