# Implementation Plan: Rynke Evaluation — Rules Handout and Training Rynke from Rides

**Branch**: `003-rynke-evaluation` | **Date**: 2026-10-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-rynke-evaluation/spec.md`

**Scope of this plan**: User Stories 1 and 2 only. Stories 3–6 (team events,
stored ride results and tally, rule changes with recalculation, corrections) get
their own plan revision later; this plan shapes its outputs so they can build on
it without changes (research R2).

## Summary

- **User Story 1 (rules handout)** is already delivered on this branch:
  `docs/rynke-punkte.md` and `scripts/docs-pdf.sh` (`pnpm docs:pdf`). What remains
  is the review against the spec (acceptance scenario 2) whenever the spec
  changes (FR-019); no code (research R1).
- **User Story 2 (Training Rynke from rides)** adds a pure, deterministic
  evaluation of one rider's stored activities (`src/rynke/`):
  - Each activity gets a ride result: whether it counts, every reason it doesn't
    (as language-independent codes, FR-016), the overlapping ride, its distance
    Rynke, the metres it adds to the elevation total and whether it is virtual.
  - The riding totals: distance Rynke, the elevation total with its Rynke and the
    metres to the next step, Training Rynke from riding, and the same without
    virtual rides (FR-013a's input).
  - Rule values are a typed code constant for now (research R8); storing them as
    organiser configuration (FR-012) belongs to Story 5.
  - A read-only loader evaluates a rider straight from D1. Nothing is stored and
    nothing triggers it yet: storing results and re-deriving them on every input
    change (FR-003, FR-014–FR-014b) is Story 4.

All arithmetic is exact at the rule boundaries (research R3): limits are compared
by cross-multiplication, elevation is summed in whole decimetres, and distance is
floored per ride.

## Technical Context

**Language/Version**: TypeScript 7 (`tsc --noEmit`), Cloudflare Workers runtime
(`compatibility_date` 2026-08-22), as feature 001

**Primary Dependencies**: None new. Pure TypeScript plus D1 for the loader.

**Storage**: Reads `activities` (feature 001, migrations `0001`/`0002`). No new
table, column or migration in Stories 1–2.

**Testing**: Vitest in workerd (`pnpm test`). Unit tests for the pure evaluation
(one test per acceptance scenario of Story 2, plus boundaries, unknown figures and
order independence); one integration test that stores activities through the
existing webhook path with fake Strava and evaluates from D1 (research R9).

**Target Platform**: Cloudflare Workers (the code runs in the queue consumer once
Story 4 wires it in)

**Project Type**: Web service (existing single Worker)

**Performance Goals**: Evaluating a full season of one rider (≤ 1,000 rides) takes
well under 10 ms of CPU, so it fits any Worker invocation; the overlap check is
O(n²) on counting candidates, about 10⁶ comparisons at worst (research R5).

**Constraints**: No Strava request (FR-022, SC-007). Same output for the same
stored activities regardless of arrival or row order (FR-002). No rider-facing
text (FR-016).

**Scale/Scope**: ≤ 10 riders (Strava capacity), a few hundred rides each per
season.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status |
|---|---|---|
| I. Privacy & consent | Nothing is shown to anyone; the evaluation reads only the rider's own stored activities. No new scope. | ✅ |
| I. Minimisation | Uses only feature 001's FR-013 fields; stores nothing new. The handout contains no rider data. | ✅ |
| I. Deletion | Nothing stored, so nothing outlives a deleted activity or rider. | ✅ n/a |
| I. Secrets | None involved. | ✅ n/a |
| II. Webhook/queue, rate limits | No Strava request; the loader reads D1 only. | ✅ |
| II. Idempotency | Pure function of the current stored activities; order of arrival or rows cannot change the result (FR-002, research R5). | ✅ |
| III. Rider content | No description edits, no corrections yet. | ✅ n/a |
| IV. Serverless, minimal deps | No new dependency. | ✅ |
| IV. Recomputable points | The evaluation is a pure, deterministic function of stored activity data and the rule values, so any season can be recomputed from scratch. | ✅ |
| IV. Free tier | No new binding. | ✅ |
| V. Test-first | Every acceptance scenario of Story 2 starts as a failing test. Fixtures are synthetic. The handout script needs no tests (FR-018). | ✅ |
| Language | No rider-facing text in the app: reasons are codes (FR-016). The handout is German and outside the app's catalogs (FR-020). Code and docs are English. | ✅ |

**Post-design re-check (after Phase 1)**: still passing. The design adds no table,
route, queue message, binding or dependency. One gap in the spec surfaced: what an
activity with an unknown figure (feature 001's `NULL`) earns. The plan decides it
conservatively (it doesn't count, reason `figures_unknown`, research R6); FR-014's
list of reasons should gain it (see Open questions).

## Project Structure

### Documentation (this feature)

```text
specs/003-rynke-evaluation/
├── plan.md              # This file (Stories 1–2)
├── research.md          # Phase 0
├── data-model.md        # Phase 1: evaluation input and output (nothing stored yet)
├── quickstart.md        # Phase 1
├── contracts/
│   └── ride-evaluation.md   # inputs, outputs and reason codes of the evaluation
├── lazy-rider.md        # the review behind FR-005b–FR-005e
├── checklists/
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
docs/
├── rynke-punkte.md          # Story 1: German rules handout (exists)
└── print.css                # exists
scripts/
└── docs-pdf.sh              # Story 1: `pnpm docs:pdf` (exists)

src/
├── rynke/
│   ├── rules.ts             # RideRules type and DEFAULT_RIDE_RULES
│   ├── rides.ts             # evaluateRides(): pure, ride results + riding totals
│   └── evaluate-rider.ts    # loads a rider's activities from D1 and evaluates them
└── db/
    └── activities.ts        # + listRiderActivities(db, athleteId)

test/
├── support/
│   └── rides.ts             # makeRide(): synthetic RideInput with readable units (km, h, m)
├── unit/
│   └── rides.test.ts        # Story 2 scenarios, boundaries, unknown figures, order independence
└── integration/
    └── evaluate-rider.test.ts   # webhook → D1 → evaluation, edit and delete follow
```

**Structure Decision**: a new `src/rynke/` directory for everything that computes
Rynke, next to `strava/`, `work/` and `db/`. `rides.ts` imports nothing that needs
bindings, so it is unit-tested without D1; only `evaluate-rider.ts` touches the
database, through a new read function in the existing `src/db/activities.ts`.
Story 3 adds team events next to it, Story 4 adds storage and the queue wiring.

## Complexity Tracking

No violations.

## Open questions

- **Unknown figures** (research R6): FR-014's closed list of reasons has no entry
  for an activity whose elapsed time, manual flag or trainer flag feature 001
  recorded as unknown. The plan adds the reason `figures_unknown`; the spec and
  the handout should say so (a one-line spec change, run before `/speckit-tasks`
  or with it).
- **Zero moving time** (research R7): FR-005c says such a ride earns nothing but
  names no reason; the plan records `too_slow`. Worth a sentence in the spec too.
