# Implementation Plan: Season and Qualification Window

**Branch**: `040-season-window-split` | **Date**: 2026-11-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/040-season-window-split/spec.md`

## Summary

Every team's season runs 1 September – 31 August; the qualification window gets its own start.

- **Settings**: new Wrangler var `QUALIFICATION_START_DATE`; Europe's `SEASON_START_DATE` moves to
  2026-09-01; `team-check` enforces the date rules (research R1, R9).
- **Window type**: `CountingWindow` gains `windowStart`; every reader of the old `seasonStart`
  chooses season or window, forced by `tsc` (R2).
- **Pre-window rides**: new reason `before_window`; a ride with only that reason earns no Rynke,
  keeps its elevation, takes part in overlap resolution, and feeds badges through one SQL
  fragment; graphs and totals keep `counts = 1` (R3, R4). No migration.
- **Badges**: list and evaluation from the season start (R5).
- **Pages**: ride status `not-yet` (orange chip, "–", open reason) and the status box text, as
  drafted and settled (R6, R7); three keys in ten catalogs.
- **Fake mode**: Europe samples with September–December rides; Europe's e2e day re-picked (R8).
- **Hamburg safety**: both dates equal, no `before_window`; the pages and season snapshots must
  not change.

## Technical Context

**Language/Version**: TypeScript on Cloudflare Workers; Node `.mjs` for `team-check` and the album
script

**Primary Dependencies**: none new

**Storage**: D1 unchanged, no migration (reasons are JSON without a constraint)

**Testing**: Vitest in the Workers runtime (`app` and `team:<id>` projects); Playwright
`europe-smoke`

**Target Platform**: Hamburg's and Europe's Workers, both sandboxes, fake mode

**Project Type**: server-rendered web app

**Performance Goals**: none new; Europe's first fetch reads up to four more months (R10)

**Constraints**: Hamburg byte-identical (FR-019); no team branch in code (026); rider text in ten
catalogs

**Scale/Scope**: ~25 files reading the window, 4 Wrangler blocks, 3 message keys × 10, Europe samples,
e2e config

## Constitution Check

| Principle | Check | Result |
|---|---|---|
| I. Privacy and consent | Same data from the same scope, four more months of a connected Europe rider's own activities, inside "this season" as consented; nothing new shown to others | Pass |
| II. Strava API | Same requests, earlier `after` for Europe; within budget (R10); webhooks unchanged | Pass |
| III. Rider-authored content | Nothing written to Strava | Pass |
| IV. Serverless, minimal deps, pure rules | `before_window` is a pure rule result; no dependency, no migration | Pass |
| V. Test-first | Hamburg snapshots already pinned; evaluation, badge query, status and team-check tests red first | Pass |
| Language | Three keys in ten catalogs, German key source | Pass |
| Team data (026) | Dates are Wrangler vars per team; no `team.id` branch | Pass |

Re-checked after Phase 1 design: still passes; nothing to justify.

## Project Structure

### Documentation (this feature)

```text
specs/040-season-window-split/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── window.md        # team data, evaluation, readers, pages, messages
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
wrangler.jsonc                    # QUALIFICATION_START_DATE ×4; Europe SEASON_START_DATE 2026-09-01
worker-configuration.d.ts         # pnpm types
src/config.ts                     # new var in Settings
src/rynke/rules.ts                # CountingWindow.windowStart; inCountingWindow; eventInWindow
src/rynke/rides.ts                # before_window; overlap over pre-window candidates; elevation kept
src/rynke/pace.ts, weeks.ts, ride-figures.ts, apply.ts   # window start
src/db/badges.ts (+ team badge totals)   # BADGE_RIDE fragment
src/db/participation.ts, team-events.ts  # season start
src/badges/catalog.ts, evaluate.ts, hints.ts, view.ts   # season start
src/work/team-badge-news.ts       # season start
src/http/rider-view.ts            # status not-yet; before_window reason line
src/http/rider-sections.ts        # orange chip, "–", open reason, status box date
src/http/style.ts                 # .ride-not-yet
src/http/progress-view.ts, progress-section.ts, organiser/*, sections/*  # window vs season per R2
src/i18n/messages/*.ts            # rynke.ride.notYet, rynke.reason.beforeWindow, rynke.deadline.notStarted
album/load.ts, scripts/season-album.mjs   # season start; pass the new var
scripts/team-check.mjs            # date rules
dev/fake-strava/samples.europe.ts # Sep–Dec rides incl. Nov/Dec
package.json / playwright config  # Europe e2e day; pre-window day
test/unit/rides-window.test.ts    # NEW: before_window, overlap, elevation, Hamburg never
test/unit/badge-ride.test.ts      # NEW: pre-window rides feed badges, not Rynke
test/teams/*                      # Europe badge list = Hamburg minus event-only; snapshots unchanged
e2e/europe-smoke.e2e.ts           # pre-window marks and status box
```

**Structure Decision**: Window semantics stay in `src/rynke/rules.ts`; the SQL fragment sits with
the badge queries; page decisions in the rider view model.

## Delivery

0. Rebase onto `develop` (#359 is merged) and drop the draft working-tree changes.
1. **Settings and type** (US2): var, `team-check`, `windowStart` rename and per-file choice; Hamburg
   snapshots unchanged.
2. **Pre-window rides** (US3): `before_window`, overlap, rider view status, card, reason, catalogs.
3. **Badges** (US4): `BADGE_RIDE`, season-based badge list and evaluation.
4. **Status box** (US5): window-start date and text.
5. **Fake mode and e2e**: Europe samples, e2e days.
6. One pull request into `develop`; after the release the user runs **Sandbox reseed** for Europe.
