# Quickstart: Ride Stats Leaderboard

How to show that the feature works. Contracts: [pages](contracts/pages.md), [messages](contracts/messages.md).
Data: [data-model.md](data-model.md).

## Prerequisites

- `pnpm install`
- `pnpm exec playwright install chromium firefox webkit` for the e2e tests
- No `.dev.vars` or real Strava. Fake mode uses synthetic riders only.

## Automated checks

```bash
pnpm test        # unit and integration, in the Workers runtime
pnpm test:e2e    # smoke and ride-stats scenarios against fake mode
pnpm lint && pnpm typecheck
```

What they must show:

| Check | Proves |
| --- | --- |
| `test/unit/ride-figures.test.ts` | Sums, ties (1, 2, 2, 4), shown-value rounding, medians for odd, even, one and no rides, and season, month and week ranges (SC-001, FR-005, FR-009) |
| `test/unit/rider-summary.test.ts` (extended) | `rides` is complete, sorted and stable, and an unchanged evaluation writes nothing |
| `test/unit/consent-versions.test.ts` (extended) | A rider on 3 (revision 0) is current after 3.1. Renewing from 2 lists `consent.rideFigures`. A revision never adds a scope (US3 scenario 3, SC-004) |
| `test/unit/visibility.test.ts` (extended) | `rideFigures` and `rideFiguresByName` audiences and since-version |
| `test/integration/team-ride-figures.test.ts` (new, beside `team-leaderboard.test.ts`) | Each `by` and `period`; default `/team` unchanged; no name or ID in the markup; a rider below version 3 in no row, total, median or count; `RIDE_FIGURES` off; `RYNKE_VIEWS` off (US1, US3, US4, SC-003, SC-005) |
| `test/integration/organiser-overview.test.ts` (extended) | Sessions column and typical ride; graph data with sessions per day; nothing with the switch off (US2) |
| `consent-gate.test.ts`, `connect.test.ts`, `callback.test.ts`, `settings.test.ts`, `privacy.test.ts` (extended) | New acceptances record revision 1; Settings shows "3.1" |
| `test/integration/d1-round-trips.test.ts`, `d1-rows.test.ts` | Default `/team` reads as today. A ride figure adds no round trip and at most one consent check per rider (SC-006) |
| `e2e/ride-stats.e2e.ts` | On a phone and on a wide screen: pick km, then Week, then Sessions; places and the place card follow. The organiser's Sessions tab draws |

## By hand in fake mode

```bash
pnpm dev   # http://localhost:8789, synthetic riders, RIDE_FIGURES on
```

1. Sign in as a sample rider and open Team. The page looks as before, with "Rank by" on Rynke (US1 scenario
   1).
2. Pick km, then Month, then Week. Check that the list, place card, typical ride and team line change. No row
   shows a name.
3. Sign in as the sample organiser.
   - On Team, the ranking looks the same as a rider's (US2 scenario 4).
   - On Orga › Riders, check the Sessions column and the fourth graph.
   - The sample rider held back on consent version 2 is in neither the column figures nor the ranking.
4. To see a team without Rynke views, set `RYNKE_VIEWS` to `"off"` in `wrangler.jsonc` (locally, don't
   commit it) and restart. Team then shows the single view of FR-012.
5. Set `RIDE_FIGURES` to `"off"` the same way and restart. No trace of the feature is left (US4 scenario
   1).

Checks on the live site happen after the release, not as tasks here.
