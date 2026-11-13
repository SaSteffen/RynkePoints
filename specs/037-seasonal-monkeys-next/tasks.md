---
description: "Tasks for the next seasonal quote monkey sets"
---

# Tasks: Seasonal Quote Monkeys (Next Sets)

**Input**: design documents in `specs/037-seasonal-monkeys-next/`.

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/team-holidays.md,
contracts/seasonal-art.md, quickstart.md.

**Tests**: required (constitution Principle V). Write each test first and see it fail.

**Deadlines**: Europe's December data before 29 Nov 2026 once Europe's site is live (SC-001); the
Karneval picture live before 4 Feb 2027, the rest by SC-002. Team data can merge before the
pictures: an unbuilt picture falls back to the regular monkeys (035 FR-010).

**Rules**:

- No code change (research R1): `src/http/holidays.ts`, `src/http/sections/team.ts` and
  `scripts/quote-monkeys.mjs` stay as they are.
- What differs between teams is team data, never a branch in code (feature 026).
- No rider-facing text; pictures are decorative (`alt=""`) and lossless like every monkey.
- No religious symbol, no year, digits or letters; no place, team name or team art (FR-002,
  FR-004); the only flag is Europe Day's European flag, drawn right (FR-003).
- `src/teams/*.ts` holidays in calendar order, January to December (research R3).
- The by-hand fake-mode table in quickstart.md is checked on the live site after the release, not
  as a task here.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: the user story in spec.md.

## Phase 1: Setup

- [ ] T001 Rebase `037-seasonal-monkeys-next` onto `origin/develop`, which now holds the Nikolaus
  boot change (red `#E32636` in `scripts/trace.mjs`'s `PALETTE` and in `art/quotes/prompt.txt`
  "only for the Nikolaus boot and the Santa hat"); no merge commit, no push
- [ ] T002 Correct the red in `specs/037-seasonal-monkeys-next/research.md` R5 (Karneval) from
  `#C8102E` to develop's `#E32636`, and its prompt quote to "only for the Nikolaus boot and the
  Santa hat"

## Phase 2: Foundational

No foundational work: the types, anchors and picture fallback are feature 035's.

## Phase 3: User Story 1 - Team Europe celebrates too (Priority: P1) 🎯 MVP

**Goal**: Team Europe shows Hamburg's Advent, Christmas and New Year monkeys, and no Nikolaus.

**Independent Test**: `pnpm test test/teams/holidays.test.ts`; Europe's holiday on 2026-11-29
(`advent`), 2026-12-06 (`advent`), 2026-12-24 (`christmas`), 2027-01-01 (`new-year`).

### Tests first

- [ ] T003 [US1] In `test/teams/holidays.test.ts`, replace "gives Team Europe none" with
  "gives Team Europe its holidays": `europe.holidays` toEqual the December rows of data-model.md ›
  Team Europe's holidays (`advent` `{ anchor: "first-advent", offset: 0 }`–`"12-23"` long,
  `christmas` `"12-24"`–`"12-26"` short, `new-year` `"12-31"`–`"01-01"` short); no id `nikolaus`;
  `europe.placeholders` does not contain `"holidays"`; `on(day, europe)` is `null` on 2026-11-28
  and 2027-01-02, `advent` on 2026-11-29 and 2026-12-06, `christmas` on 2026-12-24 and 2026-12-26,
  `new-year` on 2026-12-31 and 2027-01-01. Run it and see it fail

### Implementation

- [ ] T004 [US1] In `src/teams/europe.ts`, set `holidays` to the three December entries of T003,
  remove `"holidays"` from `placeholders`, and replace the comment above `holidays` with one
  naming the holidays as Team Europe's (feature 037 data-model.md), Hamburg's December pictures
  shared, no Nikolaus
- [ ] T005 [US1] Run `pnpm test test/teams/holidays.test.ts` and `node scripts/team-check.mjs`;
  both pass

**Checkpoint**: Europe's December is live wherever this merges; no picture needed.

## Phase 4: User Story 2 - Karneval and Easter in spring (Priority: P2)

**Goal**: Both teams show a Karneval monkey Weiberfastnacht–Ash Wednesday and an Easter monkey
Good Friday–Easter Monday.

**Independent Test**: holiday tests for the dates of contracts/team-holidays.md › Dates; the two
pictures pass contracts/seasonal-art.md.

### Tests first

- [ ] T006 [US2] In `test/teams/holidays.test.ts`, rename "gives Hamburg the four December
  holidays" to "gives Hamburg its holidays" and put `karneval` (monkey `karneval`,
  `{ anchor: "easter", offset: -52 }`–`{ anchor: "easter", offset: -46 }`, short) and `easter`
  (`{ anchor: "easter", offset: -2 }`–`{ anchor: "easter", offset: 1 }`, short) before `advent`;
  in "gives Team Europe its holidays" put `carnival` (monkey `karneval`, same window) and `easter`
  before `advent`
- [ ] T007 [US2] In `test/teams/holidays.test.ts`, add "finds both teams' spring holidays": for
  `hamburg` and `europe`, `null` on 2027-02-03, 2027-02-11, 2027-03-25, 2027-03-30; Karneval
  (`karneval` for Hamburg, `carnival` for Europe) on 2027-02-04, 2027-02-10, 2028-02-24,
  2028-02-29, 2028-03-01; `easter` on 2027-03-26, 2027-03-29, 2028-04-14, 2028-04-17
- [ ] T008 [US2] In `test/teams/holidays.test.ts`, add "has no overlapping windows, 2026–2075":
  for each team and every day from 2026-01-01 to 2075-12-31, at most one of `team.holidays`
  holds the day (count with a window check per holiday, not `holidayOn`), except Hamburg on
  12-06 (`advent` and `nikolaus`). Run T006–T008 and see T006/T007 fail

### Implementation

- [ ] T009 [P] [US2] In `art/quotes/monkeys.json`, add `karneval` and `easter` with
  `"seasonal": true` after the December entries, scenes ending in `{{kit}}` like theirs, per
  research R5: Karneval a round red (#E32636) clown nose over Rynke's own nose, a jester's collar
  with points in yellow, cream and gold with small gold bells, confetti and streamers in yellow,
  gold, cream and sage; Easter cream bunny ears with muzzle (#F0A868) insides over the helmet,
  holding a small gold wicker basket of eggs in yellow, cream, sage and light blue; no cross, no
  digits or letters
- [ ] T010 [P] [US2] In `art/quotes/prompt.txt`, widen the red to "red #E32636 (only where a
  scene names it)", and light blue to "(only for water and sweat drops, or where a scene names
  it)"
- [ ] T011 [US2] In `src/teams/hamburg.ts`, add `karneval` and `easter` (T006's rows) before
  `advent`, and update the comment above `holidays` to name feature 037's sets; in
  `src/teams/europe.ts` add `carnival` and `easter` before `advent`
- [ ] T012 [US2] Run `pnpm test test/teams/holidays.test.ts`; it passes
- [ ] T013 [US2] `pnpm badge-art karneval easter` (Chrome popups suppressed, one run at a time,
  stopped by PID), then `pnpm badge-build karneval easter`: originals in
  `art/quotes/originals/`, `public/quotes/karneval.svg` and `public/quotes/easter.svg`, the ids
  in `SEASONAL_MONKEYS` of `src/http/quote-monkeys.ts`, versions in `src/http/art-versions.ts`
- [ ] T014 [US2] Check both pictures by eye against contracts/seasonal-art.md and
  `art/quotes/README.md` › Checking a picture; redo T013 for one that fails

**Checkpoint**: Karneval and Easter show for both teams.

## Phase 5: User Story 3 - Midsummer, Europe Day and Halloween (Priority: P3)

**Goal**: Both teams show Midsummer (20–24 June) and Halloween (29–31 October); Team Europe also
Europe Day (9 May).

**Independent Test**: holiday tests for the dates of contracts/team-holidays.md › Dates; the three
pictures pass contracts/seasonal-art.md, Europe Day the flag check.

### Tests first

- [ ] T015 [US3] In `test/teams/holidays.test.ts`, make both table tests match data-model.md
  exactly: Hamburg `karneval`, `easter`, `midsummer` (`"06-20"`–`"06-24"`, short), `halloween`
  (`"10-29"`–`"10-31"`, short), `advent`, `nikolaus`, `christmas`, `new-year`; Europe `carnival`,
  `easter`, `europe-day` (`"05-09"`–`"05-09"`, short), `midsummer`, `halloween`, `advent`,
  `christmas`, `new-year`
- [ ] T016 [US3] In `test/teams/holidays.test.ts`, add "finds both teams' summer and autumn
  holidays": for both teams `null` on 2027-06-19, 2027-06-25, 2027-10-28, 2027-11-01; `midsummer`
  on 2027-06-20 and 2027-06-24; `halloween` on 2027-10-29 and 2027-10-31; on 2027-05-09
  `europe-day` for Europe and `null` for Hamburg; `null` for Europe on 2027-05-08 and 2027-05-10.
  Run T015–T016 and see them fail

### Implementation

- [ ] T017 [P] [US3] In `art/quotes/monkeys.json`, add `midsummer`, `halloween` and `europe-day`
  with `"seasonal": true`, scenes ending in `{{kit}}`, per research R5: Midsummer a crown of sage
  leaves with yellow and cream flowers over the helmet, holding a bunch of the same flowers, no
  maypole; Halloween holding a carved pumpkin in fur orange #C8641E with a sage stalk and a
  friendly smiling face glowing yellow, one or two small black cartoon bats fluttering around and
  a little black spider dangling on its thread from the stalk, both with friendly cream eyes, no
  fangs, skulls or blood; Europe Day holding up a big European flag on a short gold pole, the
  cloth waving out to the right above the head, about as wide as Rynke's body, dark blue
  (#003399) with exactly twelve five-pointed yellow (#FBE122) stars evenly in a circle, upright
  like clock hours, each big enough to count, a few confetti dots in yellow and cream, the yellow
  kit unchanged, no other flag, map or country shape
- [ ] T018 [P] [US3] In `scripts/trace.mjs`, add `{ name: "navy", hex: "#003399" }` to `PALETTE`
  before `ink`; in `art/quotes/prompt.txt`, add "dark blue #003399 (only where a scene names it)"
  to the colour list
- [ ] T019 [US3] In `src/teams/hamburg.ts` add `midsummer` and `halloween` between `easter` and
  `advent`; in `src/teams/europe.ts` add `europe-day`, `midsummer` and `halloween` between
  `easter` and `advent`
- [ ] T020 [US3] Run `pnpm test test/teams/holidays.test.ts test/unit/holidays.test.ts
  test/unit/quote-art.test.ts` and `node scripts/team-check.mjs`; all pass
- [ ] T021 [US3] `pnpm badge-art midsummer halloween europe-day`, then `pnpm badge-build
  midsummer halloween europe-day` (as T013)
- [ ] T022 [US3] Check the three pictures by eye against contracts/seasonal-art.md; for Europe
  Day count the stars in the 120 px picture; redo T021 for one that fails

**Checkpoint**: every window of contracts/team-holidays.md › Dates shows its monkey.

## Phase 6: Polish

- [ ] T023 [P] Update `art/quotes/README.md` › Seasonal monkeys: the nine seasonal ids, the
  Karneval and Easter windows as the Easter-offset example, that two teams may share a monkey
  showing no place, team name or team art (FR-010), red and dark blue only where a scene names
  them, and the Europe Day flag check
- [ ] T024 [P] Check `test/teams/no-other-team.test.ts` still passes with Europe listing the shared
  pictures: `pnpm test test/teams/no-other-team.test.ts`
- [ ] T025 `pnpm lint` on the changed files (`pnpm exec biome check <files>`) and fix what it
  reports; commit per story

## Dependencies

- T001 before everything (red in the palette and prompt).
- US1 (T003–T005) needs nothing else; it's the MVP and can merge alone.
- US2 after US1 only because both edit the same test and `europe.ts`; T013 after T009–T011.
- US3 after US2 (same files); T021 after T017–T018.
- Polish after the stories.

## Parallel examples

- US2: T009 (`monkeys.json`) and T010 (`prompt.txt`) together.
- US3: T017 (`monkeys.json`) and T018 (`trace.mjs`, `prompt.txt`) together; T021's picture runs
  one at a time.
- Polish: T023 and T024 together.

## Implementation strategy

1. MVP: Setup, then US1; Europe's December can go to `develop` on its own.
2. US2 next (Karneval before 4 Feb 2027), then US3.
3. The user opens the release PR into `main` before 29 Nov 2026 if Europe is live, else before
   4 Feb 2027.
