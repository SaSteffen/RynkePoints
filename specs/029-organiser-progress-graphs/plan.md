# Implementation Plan: Organiser Progress Graphs

**Branch**: `029-organiser-progress-graphs` | **Date**: 2026-11-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/029-organiser-progress-graphs/spec.md`

## Summary

`/organiser/riders` gains a Progress section with three graphs, and its layout is adapted to teams of
30 or more. Strava isn't called. One small summary per rider is stored, because adding up rides on each
page load measured too expensive (research R1, R2).

- **Data**: each evaluation writes the rider's daily figures as one row. The page reads one row per
  rider, limited inside SQL to riders on consent version 3 or higher, in the batch that reads open
  requests, so it waits on no extra D1 round trip (research R1, R2).
- **Delivery**: the figures go inline as JSON, like the rider's progress charts. A pure function turns
  the rows into the view and the team totals, which keeps FR-011 unit-testable (R3).
- **Client**: a new `organiserGraphs()` in `public/app.js` draws with the vendored Chart.js and shares
  the rider charts' gestures, so a phone behaves the same way. Range, view and team lines survive a tile
  click through the existing page swap (R4, R5).
- **Consent**: version 3 with a new message, and `dailyFigures` in the visibility table (R6, R7).
- **Switches**: `ORGANISER_PROGRESS_GRAPH` and `ORGANISER_FIGURES` both decide whether the section and
  its reads exist. Neither touches the consent versions (R8).
- **Layout**: below 1100 px, one-line rows with search replace the cards, with a reports box and a
  Graphs / Riders switch. From 1100 px the table scrolls in its own box (R9, R10).
- **Fake mode**: about 25 ordinary riders, some held back on consent version 2 (R11).

## Technical Context

**Language/Version**: TypeScript on Cloudflare Workers; plain JavaScript in `public/app.js`

**Primary Dependencies**: None new. Chart.js 4.6.1 and chartjs-plugin-zoom 2.2.0 are already vendored.

**Storage**: D1. Forward-only migration `0024` adds `rider_daily_figures`, one row per rider, deleted
with the rider. The previous version never reads it.

**Testing**: Vitest in the Workers runtime; Playwright smoke tests in fake mode

**Target Platform**: Cloudflare Workers, Free plan; current browsers with JavaScript (constitution
v2.2.0)

**Project Type**: Server-rendered web app

**Performance Goals**: 40 riders, full season: about 25 KB more compressed on the page, no extra D1
round trip, about 250 more rows read per page load (measured basis in R2), and one more row written per
evaluation.

**Constraints**: No daily value of a rider below version 3 in any response (FR-024). No new Strava
request or field (FR-031). All words in the catalogs (FR-020).

**Scale/Scope**: 30 to 40 riders per team, about 300 days, 3 graphs.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design: all pass.*

| Principle | Status | How |
| --- | --- | --- |
| I. Rider privacy and consent | Pass | Newly shown to organisers, so version 3 asks again (R6). Enforced inside SQL (R2). Derived only, and the summary cascades with the rider (FR-026). Fixtures are synthetic. |
| II. Strava citizenship | Pass | No Strava request; the page reads D1 only. |
| III. Rider-authored content | Pass | Nothing a rider wrote is touched. |
| IV. Serverless, minimal dependencies | Pass | No new library. The summary is recomputable from stored rides, and keeps viewing cheap on the free tier (R2). |
| V. Test-first | Pass | Each slice starts with a failing test; see [quickstart.md](quickstart.md). |

## Project Structure

### Documentation (this feature)

```text
specs/029-organiser-progress-graphs/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── pages.md         # the page's order, markup and states
│   ├── client.md        # what the script does
│   └── messages.md      # consent, privacy and new texts
└── tasks.md             # /speckit-tasks
```

### Source Code

```text
src/
├── consent.ts                     # version 3, DAILY_FIGURES_SINCE_VERSION
├── visibility.ts                  # dailyFigures: organisers, since version 3
├── config.ts                      # organiserProgressGraph()
├── db/rider-daily-figures.ts      # new: write the summary, read it for agreed riders
├── db/rynke.ts                    # riders without a summary need evaluation
├── rynke/daily-figures.ts         # new: pure, from rides and results to days
├── rynke/apply.ts                 # riderWrites adds the summary
├── http/organiser/
│   ├── overview.ts                # order, rows, reports box, switch, scripts
│   └── progress-graphs.ts         # new: pure view and the section's markup
├── http/style.ts                  # table box, rows, section, line colours
├── http/consent-form.ts           # the new consent line
└── i18n/messages/{en,de}.ts       # contracts/messages.md
migrations/0024_rider_daily_figures.sql
public/app.js                      # organiserGraphs(), shared chart gestures, rider search, switch
dev/fake-strava/{samples,seed}.ts  # more riders, consent held back
wrangler.jsonc, vitest.config.ts, worker-configuration.d.ts  # the setting

test/unit/                         # view, config, visibility, consent, style
test/integration/                  # organiser overview, consent, round trips, fake mode
e2e/                               # graphs, drag, phone switch and search
```

**Structure Decision**: The existing single Worker. The section gets its own files because
`overview.ts` is already long, as `progress-section.ts` does for the rider's charts.

## Depends on

Stored rider summaries (`specs/030-rider-summaries/`, on its own branch) ships first and takes over the Team page's
weekly sums. Once it has merged, this plan is rebased onto it: the graphs use that per-rider row instead of creating
`rider_daily_figures`, adding only the outdoor and virtual split if it's missing, and keep their own consent-filtered read.

## Risks

- **Team page cost, already there**: `readTeam`'s weekly sums measured 18,199 rows per load at full season,
  on both `/team` and this page. This feature doesn't add to it; see R2.
- **Fake-mode seeding time**: more riders means more seeded rides, also in
  `dev-fake-strava.test.ts`. Rides per new rider stay modest (R11).
- **Existing tests** pin the cards' markup, the group filter and the current consent version. They
  change on purpose with this feature; `tasks.md` should list them.
- **All riders meet the consent gate at release**, on every deployment. That's intended (FR-023, FR-028).

## Complexity Tracking

No violations to justify.
