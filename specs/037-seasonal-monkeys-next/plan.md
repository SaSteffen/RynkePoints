# Implementation Plan: Seasonal Quote Monkeys (Next Sets)

**Branch**: `037-seasonal-monkeys-next` | **Date**: 2026-11-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/037-seasonal-monkeys-next/spec.md`

## Summary

Five new seasonal monkeys (Karneval, Easter, Midsummer, Halloween, Europe Day) and new entries
in both teams' `holidays`. Feature 035's code already does everything this needs: fixed days and
days counted from Easter, short and long windows, the shortest-window rule and the fallback while
a picture is unbuilt (research R1). So the change is team data, five `seasonal: true` entries in
the quote monkey pipeline with their pictures, tests of the new dates and the docs that said
Europe holds none. No code path, database, dependency or rider-facing text changes.

## Technical Context

**Language/Version**: TypeScript (Cloudflare Workers); Node scripts (`.mjs`) for the picture build

**Primary Dependencies**: none new

**Storage**: none (static team data and the generated picture list)

**Testing**: Vitest in the Workers runtime (`pnpm test`); fake mode's clock for the by-hand check

**Target Platform**: Cloudflare Workers, Hamburg's and Europe's deployments

**Project Type**: server-rendered web app

**Performance Goals**: none; the Team page compares a few more dates

**Constraints**: Europe's December data released before 29 Nov 2026 if Europe's site is live by
then; the Karneval picture live before 4 Feb 2027; pictures lossless like every monkey; no picture
shows a place or a religious symbol; the only flag is Europe Day's European flag, drawn right

**Scale/Scope**: 5 pictures, 2 teams, 4 + 8 new holiday entries

## Constitution Check

| Principle | Check | Result |
|---|---|---|
| I. Privacy and consent | No rider data read or stored; pictures are drawings | Pass |
| II. Strava API | No Strava calls | Pass |
| III. Rider-authored content | Nothing written to Strava | Pass |
| IV. Serverless, minimal deps | Data only; no dependency, no resource | Pass |
| V. Test-first | The new team data and dates are pinned by tests written red first (tasks) | Pass |
| Language | No rider-facing text (pictures are decorative, `alt=""`); code and docs English | Pass |
| Team data (feature 026) | Holidays stay team data, no branch in code; shared pictures show no place or team (FR-004, FR-010), so FR-023 holds | Pass |

Re-checked after Phase 1 design: still passes; nothing to justify.

## Project Structure

### Documentation (this feature)

```text
specs/037-seasonal-monkeys-next/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── team-holidays.md     # amends 035 contracts/team-holidays.md
│   └── seasonal-art.md      # the five pictures
└── tasks.md                 # /speckit-tasks
```

### Source Code (repository root)

```text
src/teams/
├── hamburg.ts                  # + karneval, easter, midsummer, halloween; calendar order
└── europe.ts                   # holidays: the eight of data-model.md; "holidays" out of placeholders

scripts/trace.mjs               # + dark blue #003399 in the palette (Europe Day's flag)

src/http/quote-monkeys.ts       # generated: SEASONAL_MONKEYS + the five ids
src/http/art-versions.ts        # generated: their versions

art/quotes/
├── monkeys.json                # + karneval, easter, midsummer, halloween, europe-day (seasonal)
├── prompt.txt                  # red and dark blue "only where a scene names it" (nose, flag)
├── originals/                  # + their originals
└── README.md                   # Seasonal monkeys: new ids, shared pictures, Europe Day check

public/quotes/                  # + karneval.svg, easter.svg, midsummer.svg, halloween.svg, europe-day.svg

test/teams/holidays.test.ts     # both teams' tables, their dates 2026–2028, no overlap 2026–2035
```

**Structure Decision**: Everything lands where feature 035 put it. `src/http/holidays.ts`,
`src/http/sections/team.ts` and `scripts/quote-monkeys.mjs` stay unchanged; the date tests go in
the team data test, since the logic itself is already covered by `test/unit/holidays.test.ts`.

## Delivery

1. Team data and tests (no pictures yet): merging changes nothing visible except Europe's
   December, whose pictures exist (FR-010 of 035), so it can go to `develop` early.
2. The five pictures: `pnpm badge-art` / `pnpm badge-build`, checked by eye; Karneval and Easter
   first, on the same branch or a follow-up PR.
3. Release PR into `main` by the user: before 29 Nov 2026 if Europe's site is live by then,
   otherwise before 4 Feb 2027 (Karneval).
