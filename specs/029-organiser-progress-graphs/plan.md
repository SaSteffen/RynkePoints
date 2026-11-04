# Implementation Plan: Organiser Progress Graphs

**Branch**: `029-organiser-progress-graphs` | **Date**: 2026-11-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/029-organiser-progress-graphs/spec.md`

## Summary

`/organiser/riders` gains a Progress section with three graphs, and its layout is adapted to teams of
30 or more. Nothing new is stored and Strava isn't called.

- **Data**: one more SQL read sums counting rides per rider and day, limited inside SQL to riders on
  consent version 3 or higher. It joins the batch that reads open requests, so the page waits on no
  extra D1 round trip (research R1, R2).
- **Delivery**: the figures go inline as JSON, like the rider's progress charts. A pure function turns
  the rows into the view and the team totals, which keeps FR-011 unit-testable (R3).
- **Client**: a new `organiserGraphs()` in `public/app.js` draws with the vendored Chart.js. Range,
  view and team lines survive a tile click through the existing page swap (R4, R5).
- **Consent**: version 3 with a new message, and `dailyFigures` in the visibility table (R6, R7).
- **Switches**: `ORGANISER_PROGRESS_GRAPH` and `ORGANISER_FIGURES` both decide whether the section and
  its reads exist. Neither touches the consent versions (R8).
- **Layout**: below 1100 px, one-line rows with search replace the cards, with a reports box and a
  Graphs / Riders switch. From 1100 px the table scrolls in its own box (R9, R10).
- **Fake mode**: about 25 ordinary riders, some held back on consent version 2 (R11).

## Technical Context

**Language/Version**: TypeScript on Cloudflare Workers; plain JavaScript in `public/app.js`

**Primary Dependencies**: None new. Chart.js 4.6.1 is already vendored. The zoom plugin isn't needed
here (R4).

**Storage**: D1, read only. No migration: the existing `ride_results`, `activities` and
`consent_records` hold everything.

**Testing**: Vitest in the Workers runtime; Playwright smoke tests in fake mode

**Target Platform**: Cloudflare Workers, Free plan; current browsers with JavaScript (constitution
v2.2.0)

**Project Type**: Server-rendered web app

**Performance Goals**: 40 riders, full season: about 25 KB more compressed on the page, no extra D1
round trip, and one page view adds about 12,000 rows read (R2, R3).

**Constraints**: No daily value of a rider below version 3 in any response (FR-024). No new Strava
request and no new stored field (FR-031). All words in the catalogs (FR-020).

**Scale/Scope**: 30 to 40 riders per team, about 300 days, 3 graphs.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design: all pass.*

| Principle | Status | How |
| --- | --- | --- |
| I. Rider privacy and consent | Pass | Newly shown to organisers, so version 3 asks again (R6). Enforced inside SQL (R2). Derived only, so leaving removes it with the rider's rows (FR-026). Fixtures are synthetic. |
| II. Strava citizenship | Pass | No Strava request; the page reads D1 only. |
| III. Rider-authored content | Pass | Nothing is written. |
| IV. Serverless, minimal dependencies | Pass | No new library, no migration, within the free tier (R2). |
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
├── db/organiser-progress.ts       # new: the daily read and the agreed riders
├── http/organiser/
│   ├── overview.ts                # order, rows, reports box, switch, scripts
│   └── progress-graphs.ts         # new: pure view and the section's markup
├── http/style.ts                  # table box, rows, section, line colours
├── http/consent-form.ts           # the new consent line
└── i18n/messages/{en,de}.ts       # contracts/messages.md
public/app.js                      # organiserGraphs(), rider search, switch
dev/fake-strava/{samples,seed}.ts  # more riders, consent held back
wrangler.jsonc, vitest.config.ts, worker-configuration.d.ts  # the setting

test/unit/                         # view, config, visibility, consent, style
test/integration/                  # organiser overview, consent, round trips, fake mode
e2e/                               # graphs, drag, phone switch and search
```

**Structure Decision**: The existing single Worker. The section gets its own files because
`overview.ts` is already long, as `progress-section.ts` does for the rider's charts.

## Risks

- **Fake-mode seeding time**: more riders means more seeded rides, also in
  `dev-fake-strava.test.ts`. Rides per new rider stay modest (R11).
- **Existing tests** pin the cards' markup, the group filter and the current consent version. They
  change on purpose with this feature; `tasks.md` should list them.
- **All riders meet the consent gate at release**, on every deployment. That's intended (FR-023, FR-028).

## Complexity Tracking

No violations to justify.
