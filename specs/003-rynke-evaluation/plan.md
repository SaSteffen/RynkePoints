# Implementation Plan: Rynke Evaluation — Handout, Ride Rynke and Stored Results

**Branch**: `003-rynke-evaluation` | **Date**: 2026-10-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-rynke-evaluation/spec.md`

**Scope of this plan**: User Stories 1, 2 and 4. Story 3 (team events), Story 5
(rule changes and recalculation) and Story 6 (corrections) get their own plan
revision later. Story 4 doesn't need Story 3: the tally's team-event and
correction parts are 0 until those inputs exist, and the design leaves room for
them without reshaping what is stored (research R2, R12).

## Summary

- **Story 1 (rules handout)** is already delivered: `docs/rynke-punkte.md` and
  `scripts/docs-pdf.sh` (`pnpm docs:pdf`). What remains is the manual review
  against the spec whenever it changes (FR-019); no code (research R1).
- **Story 2 (Training Rynke from rides)**: a pure, deterministic evaluation of one
  rider's stored activities in `src/rynke/`:
  - each activity gets a ride result: whether it counts, every reason it doesn't
    (language-independent codes, FR-016), the overlapping ride, its distance
    Rynke, the metres it adds to the elevation total, whether it is virtual and
    which figures were unknown;
  - the riding totals: distance Rynke, the elevation total with its Rynke and
    the metres to the next step, and the same without virtual rides (FR-013a);
  - arithmetic is exact at every rule boundary (research R3); unknown figures
    never exclude a ride (FR-005f, research R6); zero moving time is a full
    pause (FR-005a, research R7).
- **Story 4 (stored ride results and tally)**:
  - Migration `0003_rynke_results.sql` adds `ride_results` (one row per activity)
    and `rynke_balances` (one row per rider), both cascading from `riders`
    (research R10).
  - Every path that changes a rider's activities applies the change and the
    re-evaluation in **one D1 batch**: the activity write, the changed ride
    results and the balance commit together, so a reader never sees a balance
    that disagrees with the ride results (FR-014b) and a deleted activity's result
    goes with it (FR-015). These paths are the `activity-event` handler, the
    import and re-read pages, and the OAuth callback when it removes private
    activities. The callback runs outside the serial consumer, so it also sends
    an `evaluate-rider` message that settles a rare race within seconds
    (research R11).
  - Only ride results that changed are written, to stay far inside D1's free
    100,000 rows written per day (research R13).
  - The rules carry a version and the date they took effect; every row records
    the version (FR-023). Until Story 5 stores rules, they are a code constant
    whose version a developer raises with any change of values or logic
    (research R8).
  - The daily cron sends an `evaluate-rider` message for every connected rider
    whose stored results are missing, computed with another rules version, or
    older than one of their activities. This fills the tables after the first
    deploy, follows a rules-version bump within a day, and catches anything a
    lost message left behind (research R14).
  - Readers get the balance and ride results from one D1 batch, which reads a
    consistent snapshot (FR-014b); nothing on the read path evaluates.

## Technical Context

**Language/Version**: TypeScript 7 (`tsc --noEmit`), Cloudflare Workers runtime
(`compatibility_date` 2026-08-22), as feature 001

**Primary Dependencies**: None new. Pure TypeScript; D1 SQL including SQLite's
`json_each` for multi-row writes (research R13).

**Storage**: D1. Reads `activities` (feature 001). New tables `ride_results` and
`rynke_balances` in migration `0003_rynke_results.sql`, additive only, so the
previously deployed version keeps working while CI applies it
([data-model.md](data-model.md)).

**Testing**: Vitest in workerd (`pnpm test`). Unit tests for the pure evaluation
and tally; integration tests for every path that writes results, the read
snapshot, the cron sweep and rider deletion, with fake Strava and local D1
(research R9).

**Target Platform**: Cloudflare Workers (queue consumer, fetch handler for the
OAuth callback, daily cron), Workers Free plan

**Project Type**: Web service (existing single Worker)

**Performance Goals**: A new ride is reflected in the stored results within the
same queue message that stores it, so SC-004 (5 minutes) holds wherever feature
001's SC-002 does. Evaluating a full season of one rider (≤ 1,000 rides) takes
well under 10 ms of CPU.

**Constraints**:

- No Strava request for evaluating or storing (FR-022, SC-007).
- D1 free tier: 100,000 rows written and 5 million rows read per day; index
  updates and deletes count as writes. Expected use is a few hundred rows written
  per day after the initial fill (research R13).
- D1: at most 100 bound parameters per statement, 100 KB of SQL text per
  statement; ride results are written through one JSON parameter each way.

**Scale/Scope**: ≤ 10 riders (Strava capacity), a few hundred rides each per
season.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status |
|---|---|---|
| I. Privacy & consent | Results and balances are shown to no one by this feature (FR-015). No new scope. | ✅ |
| I. Minimisation | Stored results hold only values derived from feature 001's FR-013 fields, plus codes and versions; no Strava field is copied. | ✅ |
| I. Deletion | Both tables cascade from `riders`; a ride result is deleted in the same batch as its activity (FR-015). Private activities removed on a narrowed scope take their results with them. | ✅ |
| I. Secrets | None involved. | ✅ n/a |
| II. Webhook ack + queue | The webhook is unchanged; evaluation runs in the queue consumer (and the OAuth callback, research R11), never in the webhook path. | ✅ |
| II. Idempotency | Results are a pure function of the stored inputs and are written as a diff against what is stored; replays and duplicates converge (SC-003). | ✅ |
| II. Rate limits | No Strava request; `evaluate-rider` touches D1 only. | ✅ |
| III. Rider content | No description edits; corrections not yet in scope. | ✅ n/a |
| IV. Serverless, minimal deps | No new dependency or binding. | ✅ |
| IV. Recomputable points | Results are derived only from stored activities and rules; a full re-evaluation gives the incremental result (SC-002). | ✅ |
| IV. Free tier | Diff writes keep D1 writes in the hundreds per day (research R13). One extra cron step, no new trigger. | ✅ |
| V. Test-first | Each acceptance scenario of Stories 2 and 4 starts as a failing test; fixtures synthetic; Strava faked. | ✅ |
| Language | No rider-facing text: reasons and figures are codes (FR-016). Code and docs English. | ✅ |
| Migrations | `0003` only adds tables; the deployed version ignores them. | ✅ |

**Post-design re-check (after Phase 1)**: still passing. The design adds two
tables, one queue message kind (`evaluate-rider`), one cron step and no route,
binding or dependency. Feature 001's handlers change in one way: their activity
writes join the evaluation batch (research R11); what they store is unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/003-rynke-evaluation/
├── plan.md              # This file (Stories 1, 2, 4)
├── research.md          # Phase 0
├── data-model.md        # Phase 1: evaluation shapes, ride_results, rynke_balances
├── quickstart.md        # Phase 1
├── contracts/
│   ├── ride-evaluation.md   # evaluation and read functions, reason and figure codes
│   └── queue-messages.md    # evaluate-rider and the cron sweep
├── lazy-rider.md
├── checklists/
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
docs/rynke-punkte.md, docs/print.css, scripts/docs-pdf.sh   # Story 1 (exist)

migrations/
└── 0003_rynke_results.sql   # ride_results, rynke_balances

src/
├── rynke/
│   ├── rules.ts             # RynkeRules type, CURRENT_RULES (version, effective date, values)
│   ├── rides.ts             # evaluateRides(): pure, ride results + riding totals
│   ├── tally.ts             # tally(): pure, balance from riding totals + extras + rules
│   └── apply.ts             # applyAndEvaluate(): input change + evaluation in one D1 batch
├── db/
│   ├── activities.ts        # + listRiderActivities; upsert/delete as statements for the batch
│   └── rynke.ts             # stored results: read snapshot, diff writes, sweep query
├── work/
│   ├── messages.ts          # + evaluate-rider
│   ├── evaluate-rider.ts    # handler: applyAndEvaluate with no input change
│   ├── activity-event.ts    # writes through applyAndEvaluate
│   ├── activity-page.ts     # writes through applyAndEvaluate
│   └── scheduled.ts         # + fan-out of evaluate-rider (sweep)
├── http/
│   └── auth.ts              # private-activity removal through applyAndEvaluate
└── index.ts                 # registers the handler and the cron step

test/
├── support/rides.ts         # makeRide(): synthetic rides in km, h, m
├── unit/
│   ├── rides.test.ts        # Story 2 scenarios, boundaries, unknown figures, order independence
│   └── tally.test.ts        # Story 4 tally fields, qualification incl. virtual share
└── integration/
    ├── rynke-store.test.ts      # Story 4 scenarios through webhook → D1, diff writes, snapshot read
    ├── rynke-sweep.test.ts      # cron sends evaluate-rider for missing, outdated, stale riders only
    └── rynke-deletion.test.ts   # activity delete, private removal, rider deletion
```

**Structure Decision**: `src/rynke/` holds everything that computes Rynke:
`rides.ts` and `tally.ts` are pure and import nothing that needs bindings;
`apply.ts` is the single place that turns an input change into one D1 batch.
SQL lives in `src/db/` as in feature 001. Story 3 later adds team events as
another input to `tally()` and another kind of input change to `apply.ts`.

## Complexity Tracking

No violations.
