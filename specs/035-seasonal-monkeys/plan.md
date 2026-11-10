# Implementation Plan: Seasonal Quote Monkeys (December)

**Branch**: `035-seasonal-monkeys` | **Date**: 2026-11-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/035-seasonal-monkeys/spec.md`

## Summary

Hamburg's Team page dresses the quote monkey up for Advent, Nikolaus, Christmas and New Year.
Each team lists its holidays in team data (window, short or long, seasonal monkey); a pure
function finds the day's holiday from the Berlin date the Team page already computes, and
`quoteArt` picks the seasonal picture for every quote (short window) or about half of them by a
bit of the quote id (long window). The four pictures are new `seasonal: true` entries in the
existing quote monkey pipeline, which lists them apart from the regular eleven. No database,
no new dependency, no rider-facing text.

## Technical Context

**Language/Version**: TypeScript (Cloudflare Workers), Node scripts (`.mjs`) for the picture build

**Primary Dependencies**: none new

**Storage**: none (static team data and generated picture list)

**Testing**: Vitest in the Workers runtime (`pnpm test`); fake mode's clock for the by-hand check

**Target Platform**: Cloudflare Workers, Hamburg's and Europe's deployments

**Project Type**: server-rendered web app

**Performance Goals**: no measurable cost; a handful of date comparisons per Team page

**Constraints**: live on production before 29 Nov 2026 (release to `main` by ~27 Nov); pictures
lossless like every monkey

**Scale/Scope**: 4 pictures, 1 team; the format carries the later sets

## Constitution Check

| Principle | Check | Result |
|---|---|---|
| I. Privacy and consent | No rider data read or stored; pictures are drawings | Pass |
| II. Strava API | No Strava calls | Pass |
| III. Rider-authored content | Nothing written to Strava | Pass |
| IV. Serverless, minimal deps | Pure functions, no dependency, no new resource | Pass |
| V. Test-first | Window, choice and team-data tests written red first (tasks) | Pass |
| Language | No rider-facing text (pictures are decorative, `alt=""`); code and docs English | Pass |
| Team data (feature 026) | Holidays are team data; Europe lists none; no team's place in the art | Pass |

Re-checked after Phase 1 design: still passes; no complexity to justify.

## Project Structure

### Documentation (this feature)

```text
specs/035-seasonal-monkeys/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── team-holidays.md
│   └── quote-art.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── badges/easter.ts            # + firstAdventSunday(year), next to easterSunday
├── http/holidays.ts            # new: DayRef/Holiday types, holidayOn(today, holidays)
├── http/quote-monkeys.ts       # generated: + SEASONAL_MONKEYS
├── http/sections/team.ts       # quoteArt(quote, holiday, monkeys, seasonal); renderQuote gets the day's holiday
├── teams/types.ts              # TeamData.holidays
├── teams/hamburg.ts            # the four December holidays
└── teams/europe.ts             # holidays: []

scripts/
├── quote-monkeys.mjs           # split regular / seasonal, write both lists
└── quote-prompts.mjs           # accept "seasonal": true

art/quotes/
├── monkeys.json                # + advent, nikolaus, christmas, new-year (seasonal)
├── originals/                  # + their originals
└── README.md                   # seasonal monkeys and team holidays

public/quotes/                  # + advent.svg, nikolaus.svg, christmas.svg, new-year.svg

test/
├── unit/holidays.test.ts       # new: first Advent 2026–2035, windows, wrap, overlap
├── unit/quote-art.test.ts      # seasonal choice, Advent share, fallback when unbuilt
├── unit/quote-prompts.test.ts  # seasonal flag
└── teams/holidays.test.ts      # new: team data guarantees (contracts/team-holidays.md)
```

**Structure Decision**: The holiday logic sits in `src/http/` beside the quote monkey list it
serves; first Advent goes next to the existing Easter computation so both anchors live together.
`src/badges/evaluate.ts`'s own fixed Christmas days stay as they are (different feature, different
windows).

## Delivery

1. Code and tests (no pictures yet): merging changes nothing visible (FR-010), so it can go to
   `develop` early.
2. The four pictures: `pnpm badge-art` / `pnpm badge-build`, checked by eye; on the same branch or
   a follow-up PR.
3. Release PR into `main`, merged by the user by ~27 Nov 2026.
