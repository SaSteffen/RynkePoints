---
description: "Tasks for the December quote monkeys"
---

# Tasks: December Quote Monkeys

**Input**: design documents in `specs/038-december-monkeys/`.

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/quote-art.md,
contracts/team-holidays.md, contracts/seasonal-art.md, quickstart.md.

**Tests**: required (constitution Principle V). Write each test first and see it fail.

**Deadline**: code, team data, the Advent set and the one-candle wreath released to `main` before
29 Nov 2026 (release PR by about 27 Nov); wreaths 2–4 before 6, 13 and 20 Dec; the trainer before
27 Dec (SC-001). Code and data can merge before the pictures: an unbuilt picture is left out of
its set, and an empty set falls back to the regular monkeys (035 FR-010).

**Rules**:

- What differs between teams is team data, never a branch in code (feature 026).
- No rider-facing text; pictures are decorative (`alt=""`) and lossless like every monkey.
- No religious symbol except the wreaths' candles; no year, digits or letters; no place, landmark,
  team name or team art (FR-002, FR-003). Existing palette only, `scripts/trace.mjs` unchanged
  (research R7).
- `src/teams/*.ts` holidays in calendar order of their first day (research R5).
- Picture runs: Chrome popups suppressed in the script, one `pnpm badge-art` run at a time,
  stopped by PID.
- Targeted tests only; CI runs the full suites. The by-hand fake-mode checks of quickstart.md are
  done on the live site after the release, not as tasks here.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: the user story in spec.md.

## Phase 1: Setup

No setup: types, anchors, the picture pipeline and the fallback are feature 035's.

## Phase 2: Foundational — picture sets and ties (blocks every story)

**Goal**: A holiday names a set of monkeys, ties return every window, and `quoteArt` picks one
picture of the day's set by the quote id (research R1–R3, contracts/quote-art.md). Every existing
holiday becomes a set of one and shows exactly as before.

### Tests first

- [X] T001 [P] In `test/unit/holidays.test.ts`, switch to `holidaysOn` (import and the `on`
  helper, which returns the ids of `holidaysOn(day, holidays)` as an array); rename "lets the
  shortest window win, the first listed on a tie" to "lets the shortest window win, every one on a
  tie": `["advent"]` on 2026-12-05 and 2026-12-07, `["nikolaus"]` on 2026-12-06,
  `["other", "nikolaus"]` for `[other, NIKOLAUS]` on 2026-12-06 (list order kept), and a
  one-day window inside a two-day one still wins alone; "gives no holiday without any" expects
  `holidaysOn("2026-12-24", [])` toEqual `[]`; the fixtures use `monkeys: ["…"]`
- [X] T002 [P] In `test/unit/quote-art.test.ts` › "quoteArt on a holiday", change the fixtures to
  `monkeys: [...]` and every call's third argument from a holiday or `null` to an array
  of holidays (`[CHRISTMAS]`, `[ADVENT]`, `[]`); the existing cases keep their expectations (a set
  of one behaves as before). Add, with `SEASONAL` widened to the ids used:
  - "picks from a long window's set by the quote id": `ADVENT_SET` long with monkeys
    `["advent", "christmas-market", "mulled-wine", "christmas-biscuits"]`; over the 40 `ids`,
    every quote with bit 16 set shows `/quotes/<ADVENT_SET.monkeys[floor(n / 2^17) % 4]>.svg`, the
    others their regular monkey; all four pictures show; none on more than twice its fair share of
    the Advent quotes; 30–70 % of the quotes show one (contracts/quote-art.md › Guarantees)
  - "keeps a quote's picture on every day of the same windows": the same id with `[ADVENT_SET]`
    twice gives the same picture (`quoteArt` takes no date, so this pins that the pick depends on
    the id and windows only)
  - "leaves an unbuilt picture out of the set": with `seasonal` lacking `mulled-wine`, no quote
    shows it and the other three still do; with only `advent` built, every Advent quote shows
    `advent`
  - "splits a tie of two short one-picture windows": `[NIKOLAUS, WREATH_2]` (both short, monkeys
    `["nikolaus"]` and `["advent-wreath-2"]`); every one of the 40 quotes shows one of the two,
    each on 30–70 %
  - "shows every quote a picture when any tied window is short": `[ADVENT_SET, WREATH_1]` (long
    and short) gives every quote a picture of the combined set
  - "drops duplicates in a tie's set": two short windows both naming `["christmas"]` give every
    quote `/quotes/christmas.svg`
- [X] T003 [P] In `test/teams/holidays.test.ts`, "%s: names seasonal monkeys, unique ids, real
  days" checks `holiday.monkeys` instead: at least one entry, no duplicates, every entry in
  `SEASONAL`; the `on` helper returns the ids of `holidaysOn(day, team.holidays)` joined by
  `" / "`, or `null` for none; the overlap test counts with `holidaysOn(day, [h]).length > 0`;
  every expected table row's `monkey: "x"` becomes `monkeys: ["x"]`. Run T001–T003 and see them
  fail (type errors count)

### Implementation

- [X] T004 In `src/http/holidays.ts`, replace `monkey: string` with
  `monkeys: readonly string[]` ("at least one; each a `seasonal: true` entry of
  art/quotes/monkeys.json; no duplicates", data-model.md), and `holidayOn` with
  `holidaysOn(today, holidays): readonly Holiday[]`: every window holding `today` with the fewest
  days, in list order, `[]` without any; update the header comment and doc comment (feature 038
  research R2)
- [X] T005 In `src/http/sections/team.ts`, `quoteArt`'s third parameter becomes
  `holidays: readonly Holiday[] = []`: the set is the holidays' `monkeys` together, without
  duplicates, kept only if in `seasonal`; empty set → the regular monkey; the day is short if any
  holiday is short; short, or long with `((n >>> 16) & 1) === 1` →
  `/quotes/${set[Math.floor(n / 2 ** 17) % set.length]}.svg`, else the regular monkey; the
  rider-state fallback unchanged. `renderQuote` takes `holidays: readonly Holiday[]`, and line
  ~762 passes `holidaysOn(today, ctx.team.holidays)`; update both doc comments (feature 038
  contracts/quote-art.md)
- [X] T006 [P] In `src/teams/hamburg.ts` and `src/teams/europe.ts`, rename every holiday's
  `monkey: "x"` to `monkeys: ["x"]`; nothing else changes yet
- [X] T007 [P] In `specs/035-seasonal-monkeys/drafts/seasonal-monkeys.html` (around line 106),
  parse `monkeys:\s*\[([^\]]*)\]` and list the holiday's window under each monkey of its set
  instead of reading `monkey: "x"`
- [X] T008 Run `pnpm test test/unit/holidays.test.ts test/unit/quote-art.test.ts
  test/teams/holidays.test.ts test/integration/team-leaderboard.test.ts` and
  `node scripts/team-check.mjs`; all pass (the integration test's `quoteArt(...)` call keeps the
  default `[]`). `pnpm typecheck` passes

**Checkpoint**: same pictures as today on every day; sets and ties are ready.

## Phase 3: User Story 1 - More than one Advent picture (Priority: P1) 🎯 MVP

**Goal**: Advent's long window shows one of four pictures per quote, the same each day.

**Independent Test**: `pnpm test test/teams/holidays.test.ts test/unit/quote-art.test.ts`; the
three pictures pass contracts/seasonal-art.md.

### Tests first

- [X] T009 [US1] In `test/teams/holidays.test.ts`, the `advent` row of both "gives Hamburg its
  holidays" and "gives Team Europe its holidays" expects `monkeys: ["advent",
  "christmas-market", "mulled-wine", "christmas-biscuits"]`. Run it and see it fail

### Implementation

- [X] T010 [P] [US1] In `art/quotes/monkeys.json`, add after `advent` three entries with
  `"seasonal": true`, scenes ending in `{{kit}}` like the others, each saying "no digits, no
  letters": `christmas-market` "Weihnachtsmarkt" (a paper bag of roasted almonds or a plain
  gingerbread heart without writing, scarf and bobble hat over the helmet, a hint of yellow and
  gold fairy lights), `mulled-wine` "Glühwein" (a steaming cream mug of red #E32636 mulled wine
  held in both hands, scarf; a mug only, no bottle), `christmas-biscuits` "Plätzchen backen" (an
  apron over the kit, a baking tray of cut-out biscuits in one hand, a cutter in the other, a
  little flour on the face) (contracts/seasonal-art.md, research R7)
- [X] T011 [US1] In `src/teams/hamburg.ts` and `src/teams/europe.ts`, set `advent`'s
  `monkeys` to T009's set
- [X] T012 [US1] Run `pnpm test test/teams/holidays.test.ts`; it passes
- [X] T013 [US1] `pnpm badge-art christmas-market mulled-wine christmas-biscuits`, then
  `pnpm badge-build christmas-market mulled-wine christmas-biscuits`: originals in
  `art/quotes/originals/`, the `.svg` in `public/quotes/`, the ids in `SEASONAL_MONKEYS` of
  `src/http/quote-monkeys.ts`, versions in `src/http/art-versions.ts`
- [X] T014 [US1] Check the three pictures by eye against contracts/seasonal-art.md and
  `art/quotes/README.md` › Checking a picture; redo T013 for one that fails

**Checkpoint**: Advent shows four pictures, about half the quotes, for both teams.

## Phase 4: User Story 2 - The Advent Sundays (Priority: P1)

**Goal**: Each Advent Sunday shows its wreath on every quote; Nikolaus on the second Advent and
Christmas Eve on the fourth split 50/50.

**Independent Test**: holiday tests for the dates of contracts/team-holidays.md › Dates; the four
wreaths pass contracts/seasonal-art.md, the candles countable at 120 px.

### Tests first

- [X] T015 [US2] In `test/teams/holidays.test.ts`, both table tests list, in order after
  `advent`: `advent-1` (monkeys `["advent-wreath-1"]`, from and to
  `{ anchor: "first-advent", offset: 0 }`, short), Hamburg's `nikolaus` unchanged, `advent-2`
  (offset 7), `advent-3` (offset 14), `advent-4` (offset 21), `christmas-eve` (`["christmas"]`,
  `"12-24"`–`"12-24"`, short), `christmas` from `"12-25"` to `"12-26"`, then `new-year`; each
  team lists 15 holidays (data-model.md)
- [X] T016 [US2] In `test/teams/holidays.test.ts`, add "finds both teams' Advent Sundays" per
  contracts/team-holidays.md › Dates: for `hamburg` and `europe`, `null` on 2026-11-28 and
  2028-12-02; `advent-1` on 2026-11-29 and 2028-12-03; `advent` on 2026-11-30, 2026-12-07 and
  2026-12-23; `advent-3` on 2026-12-13, `advent-4` on 2026-12-20; `advent-1` / `advent-2` /
  `advent-3` / `advent-4` on 2027-11-28 / 12-05 / 12-12 / 12-19; `advent-4 / christmas-eve` (list order) on
  2028-12-24; `christmas` on 2028-12-25. On 2026-12-06 Hamburg `nikolaus / advent-2`, Europe
  `advent-2`; on 2027-12-06 and 2028-12-06 Hamburg `nikolaus`, Europe `advent`. Update the
  existing Christmas expectations: `christmas-eve` on 24 Dec, `christmas` on 25–26 Dec
- [X] T017 [US2] In `test/teams/holidays.test.ts`, the overlap test "%s: has no overlapping
  windows, 2026–2075" allows two windows on an Advent Sunday in Advent, Hamburg's 12-06 in Advent,
  and 02-14 in Karneval; three only on Hamburg's 12-06 when it is also the second Advent Sunday.
  Add "ties only where research R6 says, 2026–2075": over every day, `holidaysOn` returns two
  windows for Hamburg exactly on 12-06 of 2026, 2037, 2043, 2048, 2054, 2065, 2071, and for both
  teams exactly on 12-24 of 2028, 2034, 2045, 2051, 2056, 2062, 2073; one or none on every other
  day. Run T015–T017 and see them fail

### Implementation

- [X] T018 [P] [US2] In `art/quotes/monkeys.json`, add after `nikolaus` the entries
  `advent-wreath-1` … `advent-wreath-4` ("1. Advent" … "4. Advent"), `"seasonal": true`, scenes
  ending in `{{kit}}`: Rynke holds a sage fir wreath in front of the body with four big cream
  candles evenly spaced, exactly 1 / 2 / 3 / 4 lit with yellow and gold flames and the others
  unlit; the four scenes word for word alike apart from the count; no star, angel or other
  religious symbol, no digits, no letters (contracts/seasonal-art.md, research R7)
- [X] T019 [US2] In `src/teams/hamburg.ts` and `src/teams/europe.ts`, add T015's entries in
  calendar order, split `christmas` into `christmas-eve` and `christmas`, and update the comment
  above `holidays` to name feature 038 (sets, Advent Sundays, Christmas Eve as its own window)
- [X] T020 [US2] Run `pnpm test test/teams/holidays.test.ts test/teams/no-other-team.test.ts` and
  `node scripts/team-check.mjs`; all pass
- [X] T021 [US2] `pnpm badge-art advent-wreath-1`, then `pnpm badge-build advent-wreath-1` (as
  T013); this one is needed for 29 Nov
- [X] T022 [US2] `pnpm badge-art advent-wreath-2 advent-wreath-3 advent-wreath-4`, then
  `pnpm badge-build advent-wreath-2 advent-wreath-3 advent-wreath-4` (as T013), keeping them
  alike to `advent-wreath-1`
- [X] T023 [US2] Check the four wreaths by eye against contracts/seasonal-art.md: count the lit
  candles in the 120 px picture, the four alike apart from the flames; redo T021/T022 for one that
  fails

**Checkpoint**: every Advent Sunday of contracts/team-holidays.md › Dates shows its wreath.

## Phase 5: User Story 3 - The days after Christmas (Priority: P2)

**Goal**: 27–30 December shows Rynke on an indoor trainer next to leftover biscuits.

**Independent Test**: holiday tests for 26, 27, 30 and 31 December; the picture passes
contracts/seasonal-art.md.

### Tests first

- [X] T024 [US3] In `test/teams/holidays.test.ts`, both table tests list `between-the-years`
  (`["between-the-years"]`, `"12-27"`–`"12-30"`, short) between `christmas` and `new-year`; add
  "finds both teams' days between the years": for `hamburg` and `europe`, `christmas` on
  2026-12-26, `between-the-years` on 2026-12-27 and 2026-12-30, `new-year` on 2026-12-31. Run it
  and see it fail

### Implementation

- [X] T025 [P] [US3] In `art/quotes/monkeys.json`, add `between-the-years` "Zwischen den Jahren"
  after `christmas`, `"seasonal": true`, scene ending in `{{kit}}`: pedalling Rynke's own bike on
  a plain ink indoor trainer, a plate of leftover cut-out biscuits beside it, a towel over the
  shoulder, still talking, not straining; standing on nothing; no digits, no letters
- [X] T026 [US3] In `src/teams/hamburg.ts` and `src/teams/europe.ts`, add T024's entry between
  `christmas` and `new-year`
- [X] T027 [US3] Run `pnpm test test/teams/holidays.test.ts` and `node scripts/team-check.mjs`;
  both pass
- [X] T028 [US3] `pnpm badge-art between-the-years`, then `pnpm badge-build between-the-years`
  (as T013); check it by eye against contracts/seasonal-art.md, redo for a failure

**Checkpoint**: every window of contracts/team-holidays.md › Dates shows its pictures.

## Phase 6: Polish

- [X] T029 [P] Update `art/quotes/README.md` › Seasonal monkeys: a holiday names a set
  (`monkeys`), how a quote picks from it, ties of the fewest days combine their sets, the eight new
  ids, the wreaths' candles as the one exception to "no candles" with the count check, and
  Christmas Eve as its own window
- [ ] T030 [P] `pnpm monkeys:seasonal`: the overview shows every new picture under each team's
  windows, Advent's four together
- [X] T031 `pnpm exec biome check` on the changed files and fix what it reports; commit per phase

## Dependencies

- Phase 2 (T001–T008) before every story: the field rename and `holidaysOn` touch all files.
- US1 and US2 both edit `test/teams/holidays.test.ts`, the two team files and `monkeys.json`, so
  run them one after the other (US1, then US2); US3 after US2 for the same reason.
- Within a story: tests, then `monkeys.json` and team data, then the picture runs; the picture
  runs need the `monkeys.json` entries.
- T021 before 27 Nov; T022 before 6 Dec (wreath 2), T028 before 27 Dec.
- Polish after the stories; T030 after the pictures it should show.

## Parallel examples

- Phase 2: T001, T002, T003 together (three test files); then T006 and T007 together beside
  T004–T005.
- US1: T010 (`monkeys.json`) beside T009/T011.
- US2: T018 (`monkeys.json`) beside T015–T017; picture runs one at a time.
- Polish: T029 and T030 together.

## Implementation strategy

1. MVP: Phase 2, US1, then US2's data and wreath 1 (T015–T021). That is everything 29 Nov needs;
   it can go to `develop` before the other pictures exist.
2. Wreaths 2–4 (T022–T023) and US3 on this branch or a follow-up PR.
3. The user opens the release PR into `main` by about 27 Nov 2026, and a later one for any picture
   not ready by then, before its window.
