# Implementation Plan: Badge Hints from the Monkey

**Branch**: `034-badge-hints` | **Date**: 2026-11-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/034-badge-hints/spec.md`

## Summary

The badges page gets a hint monkey with a tip in the quote's speech bubble, above the cards, as in
the design draft's main layout. A pure function works out the achievable hints from figures the
page already reads (the rider's stored day lists, run and swim sums, earned badges and progress),
following the spec's hint windows and feasibility rules. The page renders the first three as
templates; `public/app.js` decides per visit whether one shows (always on the first visit of the
day, else about half the time), picks one that differs from the last, and keeps that record in
`localStorage`. The lines are German and English only, beside the quote phrases. The bubble links
to the card, which gets a short outline. No new table, no write, no extra statement, no Strava
call.

## Technical Context

**Language/Version**: TypeScript (Cloudflare Workers), plain JavaScript in `public/app.js`

**Primary Dependencies**: none new

**Storage**: none new on the server; `localStorage` key `rp-badge-hint` in the browser (FR-019)

**Testing**: Vitest in the Workers runtime; one Playwright test in fake mode (Chromium)

**Target Platform**: Cloudflare Workers, every team's deployment

**Project Type**: server-rendered web app

**Performance Goals**: SC-003, no more than 50 ms slower at the median; the candidate work is a
few loops over at most a season of day entries

**Constraints**: zero extra D1 statements (research R2), zero writes, zero Strava requests;
360 px, every theme

**Scale/Scope**: 15 personal categories considered (11 with hints), 14 surprise rules, 6 pictures,
2 languages

## Constitution Check

| Principle | Check | Result |
|---|---|---|
| I. Privacy and consent | Only the rider's own stored figures, shown only to them; no new data, no consent change (FR-021); `localStorage` holds a date and a hint key, never sent | Pass |
| II. Strava API | No Strava requests (FR-018) | Pass |
| III. Rider-authored content | Nothing written to Strava | Pass |
| IV. Serverless, minimal deps | Pure functions in the Worker, a few lines in `app.js`, no dependency, no new resource | Pass |
| V. Test-first | Candidates, lines and markup tests written red first (tasks) | Pass |
| Language | Hint lines are content shared by all teams but exist in German and English only | Exception, see Complexity Tracking |
| Team data (feature 026) | No team's name or place in lines or pictures; `no-other-team` test covers it | Pass |

Re-checked after Phase 1 design: unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/034-badge-hints/
├── spec.md
├── hint-phrases.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── hint-candidates.md
│   ├── hint-lines.md
│   └── badges-page.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── badges/hints.ts             # new: HintInput, hintCandidates, hintLine, hintMonkey (pure)
├── content/hints/de.ts         # new: German lines, label, "Zur Karte"
├── content/hints/en.ts         # new: English lines
├── content/hints/types.ts      # new: HintLines, LineId
├── db/badges.ts                # summary read + run_days, active; runs/swims + previous-season EXISTS;
│                               #   RiderBadgesRead passes the day lists on
└── http/sections/badges.ts     # renderHints slot after the switch; card ids

public/
└── app.js                      # badgeHint(signal): pick, localStorage, keep on in-place refresh, filter

src/http/style.ts               # .badge-hint, .badge-card:target

test/
├── unit/badge-hints.test.ts    # new: windows, feasibility, order, SC-001 sweep
├── unit/hint-lines.test.ts     # new: both languages, veiling (SC-005), no "Ich"
└── integration/badges-section.test.ts # slot, templates, card ids, no hint with reveal or waiting

e2e/
└── badge-hints.e2e.ts          # new: show, tap, :target, same hint after in-place refresh
```

**Structure Decision**: The rules sit in `src/badges/` beside `evaluate.ts` and `view.ts`, whose
rule names and progress they reuse; the lines sit beside the quote phrases in `src/content/`,
since they share the German-and-English exception; the pick is in `app.js` because the record is
in the browser (research R1).

## Delivery

1. Pictures and spec (PR #300, open).
2. This plan, then tasks, on the same branch.
3. Implementation, after the owner's go: candidates and lines first (no visible change), then the
   page and `app.js`.

## Complexity Tracking

| Violation | Why needed | Simpler alternative rejected because |
|---|---|---|
| Hint lines, shared by all teams, exist in German and English only (Language: "content shared by all teams MUST exist in every shipped locale") | The owner decided it (spec Clarifications, FR-014), as for the quotes (feature 026 FR-025, translation shelved 2026-11-09): veiled nudges need natural wording, and maintainer translations into eight more languages would read flat | Ten-language catalog entries: the owner shelved phrase translation; adding them later only means more `src/content/hints/<l>.ts` files |
