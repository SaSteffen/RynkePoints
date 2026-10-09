# Implementation Plan: Team Leaderboard and Organiser Overview

**Branch**: `016-team-leaderboard` | **Date**: 2026-10-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/016-team-leaderboard/spec.md`

## Summary

`/team` stops being a placeholder and becomes the team leaderboard, and
`/organiser/riders` grows from a plain rider list into the organiser overview. Both
are server-rendered pages that read what 003 and 014 store in one batch and write
nothing.

- **Weekly history (R1–R3)**: nothing computes Rynke over time yet. A pure `src/rynke/weeks.ts` rebuilds each rider's
  week-end totals from ride sums grouped per week in SQL, attendance and
  corrections, with 003's `tally`. The current week is the stored balance itself.
- **Pace and status (R4)**: a pure `src/rynke/pace.ts` holds the even pace (FR-030) and
  one `riderStatus` used for both the viewer's quote list and the organiser groups.
- **Leaderboard (R6)**: a pure `src/rynke/leaderboard.ts` orders rows, shares
  places on ties, cuts the neighbourhood and drops every identity before rendering.
- **Page mechanics (R5, R9)**: the kind switch, the list toggle and the group tiles
  are links with query parameters; no client script. The quote is picked on the
  server per request. Charts are inline SVG.
- **Quotes (R10)**: the German lists in `src/i18n/messages/quotes.de.ts` and the
  copy-guard exemption are already committed.

No migration, no new dependency, no Strava request, no consent change.

## Technical Context

**Language/Version**: TypeScript (`tsc --noEmit`) on Cloudflare Workers, as in
features 001–015.

**Primary Dependencies**: none new. Inline SVG and CSS, no client JavaScript (R5).

**Storage**: D1, read only. One new grouped `SELECT` (R2); 014's
`listCorrectionsOfRidersStatement` gains `correction_date`
([data-model.md](data-model.md)).

**Testing**: Vitest in workerd (`pnpm test`) with synthetic riders. Unit tests for
the three pure modules, integration tests through `handleFetch`
([quickstart.md](quickstart.md) §1).

**Target Platform**: Cloudflare Workers; phone browsers 360 px wide, desktop for the
overview table.

**Project Type**: web service with server-rendered pages.

**Performance Goals**: one D1 batch of five `SELECT`s per view, returning about
30 riders × 40 weeks of grouped rows at most; rendering is pure arithmetic over
that.

**Constraints**:

- riders filtered by consent inside SQL (004 FR-021);
- the leaderboard renders no identity of another rider (004 FR-020, SC-002);
- all text except the quotes comes from the catalogs (FR-042);
- controls at least 44 px tall (011); no horizontal scrolling at 360 px (FR-040).

**Scale/Scope**:

- about 30 riders and 40 weeks a season;
- 2 GET routes (one replaced), no POST;
- about 60 catalog keys ([contracts/messages.md](contracts/messages.md)).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. Privacy and consent | Riders see only accumulated Rynke without identity (`accumulatedRynke` is TEAM in 004's visibility table). Names, thresholds, status and breakdown go only to organisers, as 004 already allows. The listed-rider filter runs in SQL. Nothing is shown beyond 004's table, so no new consent version. | ✅ |
| II. Strava API citizenship | No Strava call; "View on Strava" is a plain profile link (008, 014). | ✅ |
| III. Rider-authored content | Not touched. | ✅ |
| IV. Serverless, minimal deps | No dependency, no client script, no migration. Weekly history is a pure recomputation from stored results (R1), so a rule change needs no data change. | ✅ |
| V. Test-first | Every module and page gets a failing test first ([quickstart.md](quickstart.md) §1). | ✅ |
| Repo rules | Text in catalogs except the quotes, a documented exception (spec FR-023, R10); `src/` doesn't import `dev/`; synthetic fixtures. | ✅ |

**Post-design re-check**: still passes. `leaderboard.ts` returns rows without
athlete IDs, so a rendering bug can't leak one; the integration test checks the
HTML for every other rider's first name and ID (SC-002).

## Project Structure

### Documentation (this feature)

```text
specs/016-team-leaderboard/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── http-routes.md   # /team and /organiser/riders, query parameters
│   ├── pages.md         # what each page contains, in order
│   └── messages.md      # catalog keys in German and English
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── db/
│   ├── team.ts                  # new: weekly ride sums; one read batch for both pages
│   └── corrections.ts           # + correction_date in the of-riders read
├── rynke/
│   ├── weeks.ts                 # new: week ends, week-end totals per rider (R1, R3)
│   ├── pace.ts                  # new: evenPace, riderStatus (R4)
│   └── leaderboard.ts           # new: rows, places, neighbourhood, team totals (R6)
├── http/
│   ├── charts.ts                # new: peloton, sparkline, weekly bars, threshold bars (SVG)
│   ├── sections/team.ts         # placeholder → leaderboard; organiser entry with two links
│   ├── organiser/overview.ts    # new: the organiser overview (replaces the riders list)
│   ├── organiser/corrections.ts # − the old riders list handler
│   ├── router.ts                # /organiser/riders → overview
│   └── style.ts                 # + leaderboard, quote, peloton, chart, overview styles
└── i18n/messages/
    ├── {de,en}.ts               # + team.*, organiser.overview.*; − team.placeholder.*
    └── quotes.de.ts             # done

test/
├── unit/
│   ├── weeks.test.ts
│   ├── pace.test.ts
│   ├── leaderboard.test.ts
│   └── quotes.test.ts
└── integration/
    ├── team-leaderboard.test.ts
    ├── organiser-overview.test.ts
    └── no-hardcoded-copy.test.ts   # done; the overview joins its page list
```

**Structure Decision**: same single Worker. The pure parts go next to 003's rules
in `src/rynke/`; the SVG helpers get their own `src/http/charts.ts` because both
pages draw with them. Nothing is shaped for feature 009, which the Team page may
make unnecessary.

## Complexity Tracking

No constitution violations.
