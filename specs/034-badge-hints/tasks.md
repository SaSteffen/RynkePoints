---
description: "Tasks for the badge hints from the monkey"
---

# Tasks: Badge Hints from the Monkey

**Input**: design documents in `specs/034-badge-hints/`.

**Prerequisites**: plan.md, spec.md, hint-phrases.md, research.md, data-model.md,
contracts/hint-candidates.md, contracts/hint-lines.md, contracts/badges-page.md, quickstart.md.

**Tests**: required (constitution Principle V). Write each test first and see it fail.

**Rules**:

- No new table, no database write, no new D1 statement, no Strava request, no queue message
  (FR-018 to FR-020, research R2).
- Hint lines live in `src/content/hints/`, German and English only (FR-014, plan Complexity
  Tracking); never in `src/i18n/messages/`.
- Dates are Berlin dates (`berlinDate`), like every badge rule.
- No team's name or place in a line (FR-015); no line speaks as the monkey ("Ich …").
- `src/` never imports `dev/`, `album/` or `gateway/`.
- The by-hand fake-mode steps in quickstart.md are checked on the live site after the release, not
  as tasks here.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: the user story in spec.md.

## Phase 1: Setup

No setup: no dependency, binding or migration. The six hint monkeys are built (`HINT_MONKEYS`).

## Phase 2: Foundational (blocks every story)

**Purpose**: the figures the hints need, passed on from the page's existing reads; the types.

### Tests first

- [ ] T001 [P] Extend `test/integration/rider-summaries.test.ts` (or `test/integration/badges-section.test.ts` if the reads are tested there): with a synthetic rider whose `rider_summaries` row has `days`, `run_days`, `virtual_days`, `own_days` and `active`, `toRiderBadges(...)` returns them parsed as `daily: { days, runDays, virtualDays, ownDays, active }`; a rider without a row at `OWN_SUMMARY_SINCE` gets `daily: null`; `ranBefore`/`swamBefore` are true for a run/swim dated in the previous season (season start minus one year up to the day before season start) and false for one older than that or none
- [ ] T002 [P] Add to the same test: `riderBadgesStatements(...)` still returns exactly five statements (no new statement, research R2)

### Implementation

- [ ] T003 Extend `src/db/badges.ts`:
  - the `rider_summaries` SELECT adds `run_days, active`
  - the runs and swims SELECTs each add `EXISTS (SELECT 1 FROM runs|swims WHERE athlete_id = ?1 AND substr(start_date_local, 1, 10) >= ?4 AND substr(start_date_local, 1, 10) < ?2) AS before`, `?4` the previous season's start (the season start's year minus one, same month and day)
  - `RiderBadgesRead` gains `daily: { days: DayEntry[]; runDays: RunDayEntry[]; virtualDays: VirtualDayEntry[]; ownDays: OwnDayEntry[]; active: ActiveEntry[] } | null` and `ranBefore: boolean`, `swamBefore: boolean`; `toRiderBadges` fills them (`daily: null` when there's no summary row)
  - existing callers keep working unchanged
- [ ] T004 [P] Create `src/badges/hints.ts` with the types only: `HintInput` (data-model.md › HintInput: `today`, `seasonStart`, `seasonEnd`, `earned: ReadonlySet<string>`, `progress: readonly CategoryProgress[]`, `daily`, `longestSwimM`, `ranBefore`, `swamBefore`), `HintCandidate` (data-model.md › HintCandidate: `key` `next:<category>` | `surprise:<rule>`, `kind`, `category`, `rule?`, `line`, `values { n?, best?, next?, left?, month? }`, `windowEnd`, `closeness` 0..1, `monkey`), `LineId`; and `hintMonkey(candidate, built = HINT_MONKEYS)` per the data-model.md table, falling back to `/quotes/<first quote monkey>.svg` when the monkey isn't in `built`
- [ ] T005 [P] Create `src/content/hints/types.ts`: `HintLines` with `label`, `more`, `monthName(month: number): string`, and one entry per line id of hint-phrases.md, each an array of variants `(values: FormattedValues) => string`; `hintLinesFor(team)` in `src/content/hints/index.ts` returns the set in `phraseSet(team).locale` (German for Hamburg, English otherwise), never by the rider's language (contracts/hint-lines.md)
- [ ] T006 [P] Add `hintMonkey` cases to `test/unit/badge-hints.test.ts`: each key of the data-model.md table → its monkey's `/quotes/<id>.svg`; with `built = []` → the first quote monkey

**Checkpoint**: the page reads what the hints need, with no new statement.

## Phase 3: User Story 1 – A hint about the next step that is in reach (P1) 🎯 MVP

**Goal**: the badges page shows one next-step hint in the monkey's bubble; tapping it goes to the
card.

**Independent test**: fake mode, Bea Badges with 4 outdoor riding days in November, 20 Nov: the
hint is the November one; 28 Nov with 1 day: no November hint (spec US1).

### Tests first

- [ ] T007 [P] [US1] Add next-step cases to `test/unit/badge-hints.test.ts` for `hintCandidates` (contracts/hint-candidates.md):
  - 462 km, next 500 → `next:distance`, `values.n` 38, when 38 km ≤ days left × best day
  - an amount larger than days left × best day → no candidate; no ride day in the season → no amount candidate (FR-006)
  - 4 November days on 2026-11-20, today not ridden → `next:winter_november`, line one-day; on 2026-11-28 with 1 day → none; on 2026-11-30 with 4 days → still there; on 2026-12-01 → none
  - today already counted (an outdoor `ownDays` entry for today) → days left start tomorrow (spec edge case)
  - several days missing, more days left → line several-days with `left`; missing equal to days left → line no-day-to-spare
  - ride length: longest 60 km, next 100 → none (below half); longest 55 km, next 100 → `next:ride_length` with `best` 55 and `next` 100
  - running, swimming, run and swim length: no run/swim in this or the last season → none; `ranBefore` → allowed (FR-007)
  - a complete category → none; team categories, `team_events`, `technique`, `tour_de_paris` → never (FR-008)
  - order: the November hint (month ends 30 Nov) before Distance (season end); equal ends → smaller closeness first
- [ ] T008 [P] [US1] Create `test/unit/hint-lines.test.ts` for the next-step lines: German and English both present for every next-step line id; placeholders filled, numbers formatted in the line's language (German `1.234`, English `1,234`); the month name in the line's language; no line starts with "Ich" or "I "
- [ ] T009 [P] [US1] Extend `test/integration/badges-section.test.ts`: a rider with a next-step candidate gets `.badge-hints[data-today]` with `hidden` and at most three `<template data-hint>`s right after `.badges-switch`; each template holds `a.badge-hint[href="#badge-card-<category>"]` with the monkey `img[alt=""]`, `lang="de"` and German text on Hamburg also for a rider who picked English or French, `lang="en"` on Europe also for a rider who picked German, the label "Tipp", the text and "Zur Karte"; every personal card (with and without a badge) has `id="badge-card-<category>"`; no slot in the waiting state, with a badge reveal, or without candidates (research R8); the batch makes no more statements than before (SC-002)

### Implementation

- [ ] T010 [US1] Implement the next-step part of `hintCandidates` in `src/badges/hints.ts` (data-model.md › HintCandidate rules, research R3):
  - only the next step from `progress`, only personal categories with hints: distance, elevation, training_rynke, running, swimming, virtual_rides, ride_length, run_length, swim_length, winter_*
  - day lists filtered to `seasonStart`..`today`; best day per research R3's table
  - amounts: window end `seasonEnd`; days left = days from `today` to the end, both included; `missing ≤ daysLeft × bestDay` and `bestDay > 0`
  - winter months: the month of the season (`winterMonthOver` logic from `src/badges/view.ts`); today left only if `ownDays` has no outdoor entry for today; `missing ≤ daysLeft`; line one-day (missing 1), no-day-to-spare (missing = days left), else several-days with `left`
  - lengths: `longest ≥ next ÷ 2`; values `best`, `next`
  - FR-007 for running, swimming, run and swim length
  - `values.n` = what is missing, as `shownMissing` gives it
  - order by `windowEnd`, then `closeness`, then `key`
- [ ] T011 [P] [US1] Create `src/content/hints/de.ts` and `src/content/hints/en.ts` with the next-step lines of hint-phrases.md exactly as approved, `label` ("Tipp"/"Tip"), `more` ("Zur Karte"/"To the card"), `monthName` via `Intl.DateTimeFormat(<lang>, { month: "long", timeZone: "UTC" })`
- [ ] T012 [US1] Add `hintLine(candidate, today)` to `src/badges/hints.ts`: the variant from a 32-bit FNV-1a hash of `` `${today}|${candidate.key}` `` modulo the line's variant count (research R5)
- [ ] T013 [US1] In `src/http/sections/badges.ts`: build `HintInput` in `handleBadges`/`badgesOf` from the read (`seasonEnd` = `countingWindow(ctx.env).deadline`, before `badgeWindow`), call `hintCandidates`, and render `renderHints(team, candidates, today)` after `renderSwitch` per contracts/badges-page.md (first three candidates, `hidden` slot, templates, `artUrl(hintMonkey(...))`, numbers via `Intl.NumberFormat` in the hint's language with the category's decimals); skip it per research R8; add `id="badge-card-<category>"` to `card()` and `emptyCard()` for personal cards only
- [ ] T014 [US1] Add styles to `src/http/style.ts` (contracts/badges-page.md › Styles): `.badge-hints`, `.badge-hint` (flex, monkey 104 px left, the quote's bubble, `max-width: 640px`, inherits colour, only "Zur Karte" underlined), `.badge-hint-label`, `.badge-hint-text`, `.badge-hint-more`; `.badge-card:target` outline with `--md-sys-color-primary-container` and the coin ink ring, fading after about 2 s, none of the fade under `prefers-reduced-motion`; `scroll-margin-top` clearing the sticky `.badges-switch`; works in every theme, light and dark, at 360 px
- [ ] T015 [US1] Add `badgeHint(signal)` to `public/app.js` in its MVP form, called from `enhance` like the other page parts: with a `.badge-hints` slot, show the first template (clone into the slot, unhide); on a click on the hint while the "Alle" filter is checked, check "Neueste" first (contracts/badges-page.md › Browser, step 7)

**Checkpoint**: every visit with a candidate shows the first next-step hint; the link reaches the
card.

## Phase 4: User Story 2 – A nudge towards a surprise badge (P2)

**Goal**: veiled surprise hints inside their windows.

**Independent test**: fake mode, 2026-12-20, a rider without the Christmas Eve badge: the Christmas
Eve nudge is among the candidates; on 2026-12-27 it isn't.

### Tests first

- [ ] T016 [P] [US2] Add surprise cases to `test/unit/badge-hints.test.ts`, one block per row of the spec's "Hint windows" table: first and last day of the window in, the day before and after out; the "Also needs" condition on and off:
  - New Year 27 Dec–1 Jan; Christmas Eve 17–24 Dec; Christmas 17–26 Dec
  - Festive 500 17–31 Dec; from 24 Dec only when `500 km − km since 24 Dec ≤ days left to 31 Dec × best day`
  - Night owl, early bird: the season, a counting ride in the season
  - Rest day: a streak of ≥ 5 active days ending today or yesterday (`active`, any kind); `values.n` = the streak
  - Etappenfahrer: a day of ≥ 70 km counting rides in the season
  - Dreikampf: runs and swims both allowed by FR-007
  - Kreiszahl 7–14 Mar, a counting ride ≥ 25 km in the season (`ownDays` longest)
  - Sonnenwende 14–21 Dec (December lines); 14–21 Jun only after an outdoor ride on 21 Dec of the season (June lines)
  - Easter: Easter Monday minus 7 days to Easter Monday (`easterSunday`), 2027 and 2028
  - Everesting: each calendar month, `8848 m − the month's climbing ≤ days left in the month × best elevation day`
  - Winterschlaf beendet: from 1 Jan of the season's second year to the season end, no outdoor counting ride since 1 Jan
  - an earned surprise badge → never its hint; the window must lie inside the season
- [ ] T017 [P] [US2] Add surprise cases to `test/unit/hint-lines.test.ts` (SC-005, FR-009, FR-010): every surprise rule with a row in "Hint windows" has at least two lines per language; no surprise line contains a shown surprise badge name (Hamburg's own names from `src/teams/hamburg.ts` and the catalog names in `de`/`en`), nor `21:30`, `6:00`, `06:00`, `500`, `100 km`, `70`, `31,4`, `31.4`, `8848`, `8.848`, `8,848`, `7 Tage`, `7 days`
- [ ] T018 [P] [US2] Add an SC-001 sweep to `test/unit/badge-hints.test.ts`: for three synthetic riders (a commuter with daily short rides, a weekend rider with long rides, a rider who runs and swims) over every date of a season from 2026-09-01 to 2027-08-31, every candidate is achievable by an independent check written in the test (its window holds today, and for amounts and day counts what is missing fits into the days left at the rider's best day)

### Implementation

- [ ] T019 [US2] Implement the surprise part of `hintCandidates` in `src/badges/hints.ts` per T016, with `closeness` 1, `windowEnd` the window's last day (season end for season-long rules), the rule names of `src/badges/catalog.ts`, and one candidate per rule; the June solstice uses the June lines, December the December ones
- [ ] T020 [P] [US2] Add the surprise lines of hint-phrases.md exactly as approved to `src/content/hints/de.ts` and `src/content/hints/en.ts`
- [ ] T021 [US2] Link surprise hints to `#badge-card-surprise` in `renderHints` (`src/http/sections/badges.ts`) and cover it in `test/integration/badges-section.test.ts`

**Checkpoint**: surprise nudges appear in their windows and give nothing away.

## Phase 5: User Story 3 – The monkey does not nag (P3)

**Goal**: about half of the visits, always the first of the day, never the same hint twice in a
row, the same hint while on the page.

**Independent test**: ten visits as a rider with several candidates: hints on 3 to 7, never the
same twice in a row (SC-004).

### Tests first

- [ ] T022 [P] [US3] Create `e2e/badge-hints.e2e.ts` (fake mode, Chromium; a sample rider with at least two candidates on a pretended day):
  - empty `localStorage` → the first visit shows a hint; `rp-badge-hint` then holds today and its key
  - with the record set to today and a key, and `Math.random` stubbed to show: the shown key differs from the stored one
  - with `Math.random` stubbed to skip and the record from today: no `.badge-hint`, no monkey
  - tap the hint → the card is `:target` and in view
  - `refreshPage()` in place (dispatch the return from the background after more than a minute, or call the top bar's refresh) → the same hint text
  - ten fresh visits on the same day with the real `Math.random`: never the same key twice in a row

### Implementation

- [ ] T023 [US3] Complete `badgeHint(signal)` in `public/app.js` per contracts/badges-page.md › Browser steps 1–6 and research R4, R5: the in-memory key kept across `refreshPage()` (a flag set by `refreshPage` before `showPage`), `localStorage` read and write wrapped in try/catch, the weights ½/¼/¼ (two left: ⅔/⅓) after dropping the last key when another remains, show on the first visit of the day else with probability ½

**Checkpoint**: all three stories work together.

## Phase 6: Polish & cross-cutting

- [ ] T024 [P] Run `test/teams/no-other-team.test.ts` and `test/unit/dev-guard.test.ts`; extend no-other-team to scan `src/content/hints/` if it doesn't already (FR-015)
- [ ] T025 [P] Measure SC-003 locally: median time of `/me/badges` for a sample rider in fake mode before and after (20 requests each); note the result in the PR description
- [ ] T026 [P] Update `art/quotes/README.md` › Hint monkeys: they now show on the badges page; and mark the spec's Status as Ready in `specs/034-badge-hints/spec.md`
- [ ] T027 Run the targeted tests of quickstart.md › Automated (not the full suites, which CI runs)

## Dependencies

- Phase 2 before every story. T003 before T013; T004 before T006, T010, T019; T005 before T011, T020.
- US1 (Phase 3) before US2's T021 and US3 (they extend `renderHints` and `badgeHint`).
- US2's candidate and line tasks (T016–T020) can run alongside US1's page tasks (T013–T015).
- Polish last.

## Parallel examples

- Phase 2: T001, T002, T004, T005 together, then T003 and T006.
- US1: T007, T008, T009 together; then T010 and T011 together; then T012 → T013 → T014, T015.
- US2: T016, T017, T018 together; then T019 and T020 together; then T021.

## Implementation strategy

1. MVP: Phases 2 and 3. The page shows next-step hints on every visit with one; mergeable to
   `develop` on its own if the owner wants to see it early.
2. Add US2 (surprise nudges), then US3 (rotation and rest), each tested on its own.
3. One PR for the whole feature is fine (all three stories are small); the release PR into `main`
   follows the usual way.
