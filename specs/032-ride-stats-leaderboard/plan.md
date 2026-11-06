# Implementation Plan: Ride Stats Leaderboard

**Branch**: `032-ride-stats-leaderboard` | **Date**: 2026-11-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/032-ride-stats-leaderboard/spec.md`

## Summary

The Training view's ranking on `/team` gains a "Rank by" choice: Rynke (the default), sessions, km and
elevation. With a ride figure it also gets a period choice: season, month or week. Organisers get a Sessions
column and a fourth Progress graph. Strava isn't called, and nothing new is read from it.

- **Data**: `rider_summaries` gains `rides`, one `[date, distanceM, elevationDm]` entry per counting ride.
  The summary version goes to 3, and the daily job fills existing rows. A rider without a version 3 row is
  added up from their rides in a second round trip (research R1, R2).
- **Pure step**: a new `src/rynke/ride-figures.ts` works out periods, sums, the typical ride (median),
  places on the shown value, the team line and weekly km. It is unit-tested against hand counts (R3).
- **Consent**: version 3 gets minor revision 3.1. `consent_records.revision` records the revision a rider
  accepted, and `consentState` still compares major versions, so nobody is asked again. Two new visibility
  items, both since version 3, filter every read inside SQL (R4, R5; constitution 2.4.0).
- **Switches**: `RIDE_FIGURES` (on for the founding team) and `RYNKE_VIEWS` (off gives the single view of
  FR-012). Both are settings in `wrangler.jsonc`, and they move into feature 026's team data later (R6).
- **Team section**: `by` and `period` query parameters with `data-swap` segmented links, so no new client
  code. The default `/team` renders and reads exactly as today (R7, SC-003).
- **Organiser area**: a Sessions column with the typical ride in the full table. `GraphDay` gains sessions,
  and `public/app.js` adds a fourth metric (R8).

## Technical Context

**Language/Version**: TypeScript on Cloudflare Workers; plain JavaScript in `public/app.js`

**Primary Dependencies**: none new. The graph uses the vendored Chart.js.

**Storage**: D1. Forward-only migration `0026` adds `rider_summaries.rides` and `consent_records.revision`,
both with defaults, so the previously deployed code keeps working.

**Testing**: Vitest in the Workers runtime; Playwright in fake mode

**Target Platform**: Cloudflare Workers, Free plan; current browsers

**Project Type**: server-rendered web app

**Performance Goals**: the default `/team` reads the same rows in the same round trips as today. A ride figure
adds no round trip and at most one consent check per rider. At 40 riders that is about 150 KB more from D1,
parsed in under 10 ms. The ranking for 200 riders stays as fast as today's leaderboard (SC-006).

**Constraints**:

- No ride figure of a rider below consent version 3 in any response for someone else (FR-020).
- No name on `/team` (FR-019).
- No new Strava request or field.
- All words in the catalogs.
- No code branches on a team's name.

**Scale/Scope**: 30 to 40 riders per team (up to 200 for SC-006), about 150 counting rides each a season, and
3 periods × 3 figures.

## Constitution Check

*GATE: must pass before Phase 0 research. Re-checked after Phase 1 design: all pass.*

| Principle | Status | How |
| --- | --- | --- |
| I. Rider privacy and consent | Pass | This is a minor revision (3 → 3.1) under 2.4.0. The data read is unchanged, and the consent text and privacy notice name the new figures before they're shown. Riders on 3 aren't asked again, and new acceptances record the revision (R5). Consent is enforced inside SQL with version 3 for both new items (R4). There are no names on `/team`. The summary column is derived and cascades with the rider. Fixtures are synthetic. |
| II. Strava citizenship | Pass | No Strava request. The pages read D1 only, and the backfill is the existing daily job. |
| III. Rider-authored content | Pass | Nothing a rider wrote is touched. |
| IV. Serverless, minimal dependencies | Pass | No new library. The figures are recomputable from stored ride results, and viewing reads one row per rider. |
| V. Test-first | Pass | Each slice starts with a failing test; see [quickstart.md](quickstart.md). |

## Project Structure

### Documentation (this feature)

```text
specs/032-ride-stats-leaderboard/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── pages.md        # /team, /organiser/riders, settings, consent and privacy
│   └── messages.md     # consent 3.1, privacy and new texts
└── tasks.md            # /speckit-tasks
```

### Source Code

```text
src/
├── consent.ts                      # revisions, currentRevision, consentLabel, 3.1
├── visibility.ts                   # rideFigures, rideFiguresByName (since 3)
├── config.ts                       # rideFigures(), rynkeViews()
├── db/consents.ts                  # revision in records and reads
├── db/rider-summaries.ts           # rides column, RIDE_SUMMARY_SINCE, added-up rides
├── db/team.ts                      # consent-filtered ride read for /team
├── db/organiser-graphs.ts          # rides for sessions per day
├── rynke/summary.ts                # version 3, RideEntry, summaryOf writes rides
├── rynke/apply.ts                  # riderWrites compares rides
├── rynke/ride-figures.ts           # new: periods, sums, median, places, team figures
├── http/sections/team.ts           # Rank by, period, ride rows, place card, team line, no-Rynke view
├── http/sections/settings.ts       # "3.1" label
├── http/consent-form.ts            # consent.rideFigures paragraph
├── http/auth.ts, consent-gate.ts   # record the current revision
├── http/privacy.ts                 # privacy.team.rideFigures
├── http/organiser/overview.ts      # Sessions column
├── http/organiser/progress-graphs.ts  # sessions in GraphDay and teamSum
├── http/style.ts                   # rank-by, period, ride bar, typical ride
└── i18n/messages/{en,de}.ts        # contracts/messages.md
migrations/0026_ride_figures.sql
public/app.js                       # fourth graph metric
dev/fake-strava/samples.ts          # short trips
wrangler.jsonc, vitest.config.ts, worker-configuration.d.ts  # the two settings

test/unit/                          # ride-figures, rider-summary, consent-versions, visibility, config
test/integration/                   # team-ride-figures, organiser-overview, consent, settings, privacy, d1-*
e2e/                                # ride-stats
```

**Structure Decision**: the existing single Worker. The ride figures get their own pure module next to
`leaderboard.ts`, whose `neighbourhood` and `MEDALS` they reuse.

## Builds on

Stored rider summaries (feature 030) and the organiser graphs (feature 029), both merged. Feature 026 (team
data) isn't built yet. This feature adds its two settings in the existing way, for 026 to take over.

## Risks

- **Existing tests** pin `RIDER_SUMMARY_VERSION`, the `consent_records` columns, `GraphDay`'s length,
  `GRAPH_METRICS`, the organiser table's columns and the `/team` markup. They change on purpose.
- **Daily job after the release**: every rider is evaluated once more, as with feature 029. Until it has run,
  the ride figures are added up from rides, which costs about 18,000 rows per page load. This lasts hours at
  most.
- **Consent text change without a re-ask**: this is intended under constitution 2.4.0. A review checks that
  `consent.short.shown` and `consent.rideFigures` describe exactly what is shown.
- **`RYNKE_VIEWS` covers `/team` only.** Rynke elsewhere for the second team stays with feature 026.

## Complexity Tracking

No violations to justify.
