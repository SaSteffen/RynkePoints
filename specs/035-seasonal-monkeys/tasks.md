---
description: "Tasks for the seasonal quote monkeys (December set)"
---

# Tasks: Seasonal Quote Monkeys (December)

**Input**: design documents in `specs/035-seasonal-monkeys/`.

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/team-holidays.md,
contracts/quote-art.md, quickstart.md.

**Tests**: required (constitution Principle V). Write each test first and see it fail.

**Deadline**: release PR into `main` merged by about 27 Nov 2026 (SC-001). The code (Phases 2–5)
changes nothing visible on its own (FR-010), so it can merge before the pictures (Phase 6).

**Rules**:

- What differs between teams is team data, never a branch in code (feature 026).
- No rider-facing text: the pictures stay decorative, `alt=""` (FR-003).
- Pictures are lossless like every monkey; no religious symbols (FR-002), no year or digits on the
  New Year monkey.
- The by-hand fake-mode table in quickstart.md is checked on the live site after the release, not
  as a task here.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: the user story in spec.md.

## Phase 1: Setup

No setup: no dependency, no binding, no migration.

## Phase 2: Foundational (blocks every story)

**Purpose**: the holiday types, the date anchors, the day's holiday, and the seasonal picture list.

### Tests first

- [X] T001 [P] Add `firstAdventSunday` cases to `test/unit/badge-easter.test.ts`: 2026 → `2026-11-29`, 2027 → `2027-11-28`, 2028 → `2028-12-03`, 2033 → `2033-11-27`; for every year 2026–2035 the result is a Sunday between 27 Nov and 3 Dec and 21 days before the last Sunday on or before 24 Dec (the fourth Sunday before 25 Dec)
- [X] T002 [P] Create `test/unit/holidays.test.ts` for `holidayOn(today, holidays)` from `src/http/holidays.ts`, with Hamburg-shaped test holidays (data-model.md table, written in the test, not imported from team data):
  - fixed window: `"12-24"`–`"12-26"` holds 24, 25, 26 Dec, not 23 or 27 Dec
  - wrap: `"12-31"`–`"01-01"` holds 31 Dec 2026 and 1 Jan 2027, not 30 Dec or 2 Jan
  - anchored window: `{anchor:"first-advent",offset:0}`–`"12-23"` starts 29 Nov 2026, 28 Nov 2027, 3 Dec 2028; not the day before
  - `{anchor:"easter",offset:-48}` (Rosenmontag) resolves to 16 Feb 2026 (proves FR-013's Easter anchor)
  - overlap: 6 Dec → Nikolaus, not Advent (fewest days wins, FR-006); a tie → the first listed
  - 23 Dec 2028 (4th Advent on 24 Dec) → Advent; 24 Dec 2028 → Christmas
  - empty list → `null`
- [X] T003 [P] Extend `test/unit/quote-prompts.test.ts`: `validateMonkeys` accepts `"seasonal": true`, rejects a non-boolean `seasonal` (`"seasonal": "yes"` → a problem naming the id)

### Implementation

- [X] T004 [P] Add `export function firstAdventSunday(year: number): string` (`YYYY-MM-DD`) to `src/badges/easter.ts`, next to `easterSunday`: the Sunday 21 days before the last Sunday on or before 24 Dec (research R2); pure, UTC date math like `easterSunday`
- [X] T005 Create `src/http/holidays.ts`: export `DayRef` (`` `${string}-${string}` `` | `{ anchor: "first-advent" | "easter"; offset: number }`), `Holiday` (`id`, `monkey`, `from`, `to`, `kind: "short" | "long"`) exactly as contracts/team-holidays.md, and `holidayOn(today: string, holidays: readonly Holiday[]): Holiday | null`:
  - resolve `from`/`to` for the year of `today` (anchors via `firstAdventSunday` / `easterSunday` plus `offset` days)
  - `to` before `from` → the window wraps over the year end: check both the window starting last year and the one starting this year
  - days inclusive; of the holding windows the one with the fewest days, the first listed on a tie
  - no import from `dev/`, `album/` or `gateway/`
- [X] T006 Accept `"seasonal": true` in `validatePictures` (`scripts/quote-prompts.mjs`): when present it must be a boolean, else the problem `"<id>: seasonal must be true or false"`
- [X] T007 Write two lists in `scripts/quote-monkeys.mjs`: change `MONKEYS.source` to get the built items (or ids plus the set of seasonal ids) and emit `QUOTE_MONKEYS` (built, not seasonal, in monkeys.json order, unchanged for today's eleven) and `export const SEASONAL_MONKEYS: readonly string[]` (built and seasonal); update the call at `set.source(ids)` (around line 219) so `SHOWS` keeps working; update the generated header comment
- [X] T008 Regenerate `src/http/quote-monkeys.ts` with `pnpm badge-build` (no pictures named, so nothing is traced) or by hand to the generator's exact output: the eleven `QUOTE_MONKEYS` as today plus an empty `SEASONAL_MONKEYS`; `git diff` shows only the new list and comment

**Checkpoint**: T001–T003 pass; `src/http/quote-monkeys.ts` exports both lists.

## Phase 3: User Story 1 – Rynke celebrates the holidays (P1) 🎯 MVP

**Goal**: on 6, 24–26, 31 Dec and 1 Jan every Hamburg quote shows that holiday's monkey.

**Independent test**: `pnpm test test/unit/quote-art.test.ts test/teams` (the fake-mode days follow
after the release).

### Tests first

- [X] T009 [P] [US1] Extend `test/unit/quote-art.test.ts` for the new `quoteArt(quote, monkeys, holiday, seasonal)` (contracts/quote-art.md), with explicit lists passed in:
  - no holiday → `/quotes/<monkeys[n % length]>.svg`, same as before for several ids (FR-009)
  - short holiday with its monkey in `seasonal` → `/quotes/<holiday.monkey>.svg` for 20 different ids (FR-007, SC-002)
  - short holiday whose monkey is not in `seasonal` → the regular monkey (FR-010)
  - no regular monkey built, no holiday → the rider-state illustration (unchanged)
  - the existing cases still pass with the new parameters defaulted
- [X] T010 [P] [US1] Create `test/teams/holidays.test.ts` (contracts/team-holidays.md):
  - every team's holiday `monkey` is a `seasonal: true` entry of `art/quotes/monkeys.json` (read with `node:fs` as the other team tests read files, or via an import the Workers test runtime allows)
  - holiday ids unique within a team; every fixed `"MM-DD"` is a real day, never `02-29`
  - Hamburg lists exactly `advent`, `nikolaus`, `christmas`, `new-year` with the windows and kinds of data-model.md
  - Europe lists none
  - with Hamburg's data, `holidayOn` gives Christmas on 24 Dec 2026, Nikolaus on 6 Dec 2026, New Year on 1 Jan 2027, `null` on 27 Dec 2026 and 2 Jan 2027

### Implementation

- [X] T011 [US1] Add `holidays: readonly Holiday[]` with a doc comment (`/** The team's holidays with a seasonal quote monkey (feature 035). */`) to `TeamData` in `src/teams/types.ts`, importing `Holiday` from `../http/holidays` (or move the types to `src/teams/types.ts` and import them in `holidays.ts`, whichever keeps the import direction of the existing code)
- [X] T012 [P] [US1] Add `holidays: []` to `src/teams/europe.ts`
- [X] T013 [P] [US1] Add Hamburg's four holidays to `src/teams/hamburg.ts`, exactly data-model.md's table: `advent` (`{anchor:"first-advent",offset:0}`–`"12-23"`, long), `nikolaus` (`"12-06"`–`"12-06"`, short), `christmas` (`"12-24"`–`"12-26"`, short), `new-year` (`"12-31"`–`"01-01"`, short)
- [X] T014 [US1] Add the four seasonal entries to `art/quotes/monkeys.json` (`"seasonal": true`, ids `advent`, `nikolaus`, `christmas`, `new-year`) with names and scenes per spec FR-001 using the `{{kit}}` snippet like the regular entries; Advent and Nikolaus scenes say "no religious symbols" (FR-002), New Year's says "no year or digits anywhere"; `node scripts/quote-prompts.mjs` (or its test) passes
- [X] T015 [US1] Change `quoteArt` in `src/http/sections/team.ts` to `quoteArt(quote, monkeys = QUOTE_MONKEYS, holiday: Holiday | null = null, seasonal = SEASONAL_MONKEYS)` (monkeys stay second, so existing callers keep working): holiday with its monkey in `seasonal` and kind `short` → `/quotes/<holiday.monkey>.svg`; otherwise today's rule; update the doc comment
- [X] T016 [US1] Pass the day's holiday to the picture: in the Team page handler (around `src/http/sections/team.ts:707`) compute `holidayOn(today, ctx.team.holidays)` once and hand it to `renderQuote(quote, holiday)`, which passes it to `quoteArt`
- [X] T017 [US1] Run `node scripts/team-check.mjs` and `pnpm test test/teams test/unit/quote-art.test.ts test/unit/holidays.test.ts`; fix any `TeamData` fixture in `test/` that now lacks `holidays`

**Checkpoint**: short holidays work in tests; with no picture built yet the page is unchanged.

## Phase 4: User Story 2 – Advent weeks (P2)

**Goal**: during Advent about half of the quotes show the Advent monkey, each quote always the same.

**Independent test**: `pnpm test test/unit/quote-art.test.ts`.

- [X] T018 [US2] Extend `test/unit/quote-art.test.ts`:
  - long holiday: ids with bit 16 set (`0x00010000`) → `/quotes/advent.svg`; ids with it clear → `/quotes/<monkeys[n % length]>.svg`
  - SC-003: across the ids of 40 different synthetic quotes (FNV-1a ids as the quote code makes them, e.g. via the same hash helper `pickQuote` uses), between 12 and 28 (30–70 %) show the Advent monkey
  - the same quote gives the same picture on any two Advent days (the choice takes no date)
  - long holiday whose monkey is not built → the regular monkey (FR-010)
- [X] T019 [US2] Extend `quoteArt` in `src/http/sections/team.ts`: kind `long` and `(n >>> 16) & 1` set → the holiday's monkey, else today's rule (research R4)

**Checkpoint**: Advent share and stability pass.

## Phase 5: User Story 3 – Each team its own holidays (P3)

**Goal**: Europe sees the regular monkeys; a later holiday needs only data and pictures.

**Independent test**: `pnpm test test/teams`.

- [X] T020 [US3] Extend `test/teams/holidays.test.ts`: with Europe's data `holidayOn` is `null` on 6, 24 Dec 2026 and 1 Jan 2027; `test/teams/no-other-team.test.ts` still passes with the four new pictures listed (add `public/quotes/` seasonal ids to whatever it scans if it scans quote pictures by team)
- [X] T021 [US3] Document seasonal monkeys and team holidays in `art/quotes/README.md`: the `seasonal` flag, that seasonal monkeys never join the regular rotation, how a team names a holiday (`DayRef` forms, wrap-around, short vs long, fewest days wins), and the extra checks (no religious symbols, no year on New Year)

**Checkpoint**: code complete; can merge into `develop` before the pictures.

## Phase 6: The pictures (US1, US2)

**Purpose**: the four seasonal monkeys (FR-001, FR-002). Follow the badge-art run hygiene: one run
at a time, Chrome popups suppressed in the script, stopped by PID.

- [X] T022 [US1] Make the originals: `pnpm badge-art nikolaus christmas new-year`; check each by eye against `art/quotes/README.md` › Checking a picture plus FR-002 and "no digits"; rerun a picture until it passes; originals land in `art/quotes/originals/`
- [X] T023 [US2] Make the Advent original: `pnpm badge-art advent`; same checks
- [X] T024 Trace them: `pnpm badge-build advent nikolaus christmas new-year`; commit `public/quotes/{advent,nikolaus,christmas,new-year}.svg`, the regenerated `src/http/quote-monkeys.ts` (now four `SEASONAL_MONKEYS`, `QUOTE_MONKEYS` unchanged) and `src/http/art-versions.ts`; check `QUOTE_MONKEYS` did not change
- [X] T025 Run `pnpm test test/teams test/unit/quote-art.test.ts test/unit/holidays.test.ts` once more with the built list

## Phase 7: Polish

- [X] T026 [P] Amend feature 016's quote monkey contract (`specs/016-*/contracts/pages.md`, quote monkey amendment) with a pointer to `specs/035-seasonal-monkeys/contracts/quote-art.md`
- [X] T027 [P] Amend feature 026's `contracts/team-data.md` with the `holidays` field, pointing to `specs/035-seasonal-monkeys/contracts/team-holidays.md`
- [X] T028 Open the PR into `develop` when the user asks (Conventional Commit title, merge commit, the user merges); then the release PR into `main` by about 27 Nov 2026

## Dependencies

- Phase 2 blocks everything. T004 before T005; T006 before T014; T007 before T008.
- US1 (Phase 3) needs T005 and T008. T011 before T012/T013; T015 before T016.
- US2 (Phase 4) needs T015 (same function).
- US3 (Phase 5) needs T011–T013.
- Phase 6 needs T014 (entries) and T007 (two lists); it can run alongside Phases 3–5 once T014 is in.
- Phase 7 any time after Phase 5.

## Parallel examples

- Phase 2 tests: T001, T002, T003 together; then T004 and T006 together.
- US1: T009 and T010 together; T012 and T013 together.
- Polish: T026 and T027 together.

## Implementation strategy

1. **MVP**: Phases 2–3: the short holidays, the ones riders notice.
2. Add Advent (Phase 4) and the team checks and README (Phase 5); merge the code into `develop`
   (nothing visible changes).
3. Make the pictures (Phase 6) early: they are the slow part and the deadline is the first Advent
   Sunday, 29 Nov 2026.
4. Release into `main` by about 27 Nov.
