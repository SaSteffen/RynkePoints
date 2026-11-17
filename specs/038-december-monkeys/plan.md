# Implementation Plan: December Quote Monkeys

**Branch**: `038-december-monkeys` | **Date**: 2026-11-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/038-december-monkeys/spec.md`

## Summary

Eight new seasonal monkeys (three more Advent pictures, four Advent wreaths with one to four lit
candles, and the indoor trainer for 27–30 December) and new windows in both teams' `holidays`.
Unlike feature 037 this needs a small code change: a holiday names a **set** of monkeys
(`monkeys: string[]` instead of `monkey`), `holidayOn` returns every window tied for the fewest
days instead of the first listed, and `quoteArt` picks one picture of the day's set by the quote
id (research R1–R3). The Advent Sundays are offsets from the first Advent Sunday and 27–30 December
is a fixed window, so no new kind of date is needed. Christmas Eve becomes its own one-day window
so it can split with the fourth Advent wreath (R4). No database, dependency or rider-facing text
changes.

## Technical Context

**Language/Version**: TypeScript (Cloudflare Workers); Node scripts (`.mjs`) for the picture build

**Primary Dependencies**: none new

**Storage**: none (static team data and the generated picture list)

**Testing**: Vitest in the Workers runtime (`pnpm test`); fake mode's clock for the by-hand check

**Target Platform**: Cloudflare Workers, Hamburg's and Europe's deployments

**Project Type**: server-rendered web app

**Performance Goals**: none; the Team page compares a few more dates

**Constraints**: the code, the Advent set and the one-candle wreath released to `main` before
29 Nov 2026 (the release PR by about 27 Nov); the other wreaths before 6, 13 and 20 Dec, the
trainer before 27 Dec. Pictures lossless, in the existing palette; candles only on the wreaths; no
digits, letters, place or team art.

**Scale/Scope**: 8 pictures, 2 teams, 6 new holiday entries each (four Advent Sundays,
Christmas Eve, between the years); one type field renamed in 30 existing entries

## Constitution Check

| Principle | Check | Result |
|---|---|---|
| I. Privacy and consent | No rider data read or stored; pictures are drawings | Pass |
| II. Strava API | No Strava calls | Pass |
| III. Rider-authored content | Nothing written to Strava | Pass |
| IV. Serverless, minimal deps | A few lines in two functions; no dependency, no resource | Pass |
| V. Test-first | Sets, ties and the new dates are pinned by tests written red first (tasks) | Pass |
| Language | No rider-facing text (pictures are decorative, `alt=""`); code and docs English | Pass |
| Team data (feature 026) | Holidays and their sets stay team data, no branch in code; shared pictures show no place or team (FR-003), so FR-023 holds | Pass |

Re-checked after Phase 1 design: still passes; nothing to justify.

## Project Structure

### Documentation (this feature)

```text
specs/038-december-monkeys/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── quote-art.md         # amends 035 contracts/quote-art.md (sets, ties)
│   ├── team-holidays.md     # amends 037 contracts/team-holidays.md
│   └── seasonal-art.md      # the eight pictures
└── tasks.md                 # /speckit-tasks
```

### Source Code (repository root)

```text
src/http/holidays.ts            # Holiday.monkeys; holidayOn → holidaysOn (every tied window)
src/http/sections/team.ts       # quoteArt picks from the day's set; renderQuote passes the list
src/teams/hamburg.ts            # monkeys: [...]; advent set; advent-1..4, christmas-eve,
                                # between-the-years; christmas from 12-25
src/teams/europe.ts             # the same, without Nikolaus

src/http/quote-monkeys.ts       # generated: SEASONAL_MONKEYS + the eight ids
src/http/art-versions.ts        # generated: their versions

art/quotes/
├── monkeys.json                # + eight seasonal entries
├── originals/                  # + their originals
└── README.md                   # sets, ties, the wreath candles exception, new ids

public/quotes/                  # + the eight .svg

specs/035-seasonal-monkeys/drafts/seasonal-monkeys.html   # overview reads `monkeys: [...]`

test/unit/holidays.test.ts      # ties return every window of the fewest days
test/unit/quote-art.test.ts     # sets: spread, same picture each day, unbuilt left out, 50/50
test/teams/holidays.test.ts     # both teams' tables, dates 2026–2028, allowed overlaps 2026–2075
test/integration/team-leaderboard.test.ts   # quoteArt's new holidays argument
```

**Structure Decision**: Everything lands where features 035 and 037 put it. The set and tie
logic belongs in `holidays.ts` (which windows hold the day) and `quoteArt` (which picture a quote
gets), the two places that own those decisions today.

## Delivery

1. Code, team data and tests on this branch. Merging changes nothing visible before Advent: the
   Advent set holds only `advent` until the others are built, and every other new window falls
   back to the regular monkeys while its picture is missing (035 FR-010).
2. The pictures: `pnpm badge-art` / `pnpm badge-build`, checked by eye. Order: Christmas market,
   mulled wine, Christmas biscuits, wreath 1 (needed for 29 Nov), then wreaths 2–4 and the
   trainer. Same branch, or a follow-up PR for the later ones.
3. Release PR into `main` by the user by about 27 Nov 2026; a later release for any picture not
   ready by then, before its window.
