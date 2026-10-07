# Implementation Plan: Rynke Evaluation — Handout, Ride Rynke, Team Events and Stored Results

**Branch**: `003-rynke-evaluation` | **Date**: 2026-10-06, Story 3 revision
2026-10-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-rynke-evaluation/spec.md`

**Scope of this plan**: User Stories 1, 2 and 4 (delivered), and Story 3 (team
events, this revision). Story 5 (rule changes and recalculation) and Story 6
(corrections) get their own plan revision later. Story 4 didn't need Story 3:
the tally's team-event and correction parts were 0 until those inputs existed,
and Story 3 fills the team-event part without reshaping what is stored
(research R2, R12, R20).

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
  - a ride Strava has flagged never counts, whatever the rule values
    (FR-005g). Storing Strava's flag shipped with feature 001 (its migration
    `0003_activity_flagged.sql`, research R15): one nullable column, the
    mapping, a one-time re-read of stored activities, and the privacy text
    naming it;
  - the riding totals: distance Rynke, the elevation total with its Rynke and
    the metres to the next step, and the same without virtual rides (FR-013a);
  - arithmetic is exact at every rule boundary (research R3); unknown figures
    never exclude a ride (FR-005f, research R6); zero moving time is a full
    pause (FR-005a, research R7).
- **Story 4 (stored ride results and tally)**:
  - Migration `0005_rynke_results.sql` adds `ride_results` (one row per activity)
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
- **Story 3 (team events earn Team and Training Rynke)**:
  - Migration `0006_team_events.sql` adds `team_event_kinds` (the three kind
    codes, seeded), `team_events` (kind, date, optional name) and
    `attendances` (one row per rider and event, cascading from both), plus a
    `team_events` JSON breakdown column on `rynke_balances` with a default
    (research R17, R20).
  - The fixed amounts per kind become rule values; the rules go to version 2
    and version 1 stays in the history (research R18).
  - A pure `evaluateAttendance()` counts each attended event inside the counting
    window once, per kind, and multiplies by the amounts; it reads no ride, and
    rides keep earning their own Rynke (FR-007–FR-009, research R19). `tally()`
    adds the sums and stores the breakdown, one entry per kind also when 0.
  - Every evaluation reads the rider's attendances, so an activity event never
    drops their event Rynke. Organiser changes (create, change and delete an
    event; add and remove attendances) go through `applyTeamEventChange()`,
    which writes the change and every affected rider's balance in one D1 batch
    (FR-014b); its `ctx` wrapper then sends `evaluate-rider` for them, the race
    guard of research R11 (research R21).
  - No organiser page or route: those belong to the organiser-admin feature,
    which calls these functions. Until it exists the maintainer enters events
    with SQL and runs `pnpm daily:run`; the sweep finds riders whose in-window
    attendance count per kind differs from their stored breakdown (research
    R16, R22).
  - The rider page's per-kind rows and event list are feature 005's US3b; it
    reads the breakdown and `listRiderAttendanceStatement`.

## Technical Context

**Language/Version**: TypeScript 7 (`tsc --noEmit`), Cloudflare Workers runtime
(`compatibility_date` 2026-08-22), as feature 001

**Primary Dependencies**: None new. Pure TypeScript; D1 SQL including SQLite's
`json_each` for multi-row writes (research R13).

**Storage**: D1. Reads `activities` (feature 001). New tables `ride_results` and
`rynke_balances` in migration `0005_rynke_results.sql` (`activities.is_flagged`
came with feature 001's `0003_activity_flagged.sql`); Story 3's
`team_event_kinds`, `team_events`, `attendances` and the balance column
`team_events` in `0006_team_events.sql`. Both additive only, so the previously
deployed version keeps working while CI applies them
([data-model.md](data-model.md)).

**Testing**: Vitest in workerd (`pnpm test`). Unit tests for the pure evaluation
and tally; integration tests for every path that writes results, the read
snapshot, the cron sweep and rider deletion, with fake Strava and local D1
(research R9); for Story 3 the attendance evaluation, every team-event change,
the sweep's attendance check and the cascades (research R23).

**Target Platform**: Cloudflare Workers (queue consumer, fetch handler for the
OAuth callback, daily cron), Workers Free plan

**Project Type**: Web service (existing single Worker)

**Performance Goals**: A new ride is reflected in the stored results within the
same queue message that stores it, so SC-004 (5 minutes) holds wherever feature
001's SC-002 does. Evaluating a full season of one rider (≤ 1,000 rides) takes
well under 10 ms of CPU.

**Constraints**:

- No Strava request for evaluating or storing (FR-022, SC-007). Storing
  Strava's flag adds no request per activity; the one-time re-read costs one
  list request per 200 activities per rider (feature 001 research R20).
- D1 free tier: 100,000 rows written and 5 million rows read per day; index
  updates and deletes count as writes. Expected use is a few hundred rows written
  per day after the initial fill (research R13). A team-event change writes
  its own rows and one balance row per affected rider; the version-2 bump
  rewrites every rider's rows once (research R18).
- D1: at most 100 bound parameters per statement, 100 KB of SQL text per
  statement; ride results are written through one JSON parameter each way.
  A team-event change reads the affected riders with one statement per table
  and stays below 50 statements per batch for up to 10 riders (research R21).

**Scale/Scope**: ≤ 10 riders (Strava capacity), a few hundred rides each per
season.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status |
|---|---|---|
| I. Privacy & consent | Results, balances and attendance are shown to no one by this feature (FR-015). No new scope. | ✅ |
| I. Minimisation | Stored results hold only values derived from feature 001's FR-013 fields, plus codes and versions; no Strava field is copied. The one new activity field, Strava's flag, is in feature 001's FR-013, needed for FR-005g and named in the privacy text (feature 001 FR-002). Story 3 stores only event kind, date and optional name, and which connected rider attended; nothing from Strava, no organiser identity yet (research R17). | ✅ |
| I. Deletion | Results, balances and attendances cascade from `riders`; a ride result is deleted in the same batch as its activity (FR-015). Private activities removed on a narrowed scope take their results with them. Team events are the team's, not a rider's, and stay. | ✅ |
| I. Secrets | None involved; the interim entry uses feature 007's existing `ADMIN_TOKEN`. | ✅ n/a |
| II. Webhook ack + queue | The webhook is unchanged; evaluation runs in the queue consumer (and the OAuth callback, research R11; later the organiser pages, R21), never in the webhook path. | ✅ |
| II. Idempotency | Results are a pure function of the stored inputs and are written as a diff against what is stored; replays and duplicates converge (SC-003). Recording an attendance twice changes nothing (primary key, R17). | ✅ |
| II. Rate limits | No Strava request; `evaluate-rider` and team-event changes touch D1 only. The flag's one-time re-read uses feature 001's throttled `reread-page`. | ✅ |
| III. Rider content | No description edits. Attendance is an organiser decision: evaluation only reads it and never changes or removes it (FR-026). Corrections not yet in scope. | ✅ |
| IV. Serverless, minimal deps | No new dependency or binding. | ✅ |
| IV. Recomputable points | Results are derived only from stored activities, attendance and rules; a full re-evaluation gives the incremental result (SC-002). | ✅ |
| IV. Free tier | Diff writes keep D1 writes in the hundreds per day (research R13); a team-event change writes a few rows per affected rider. One extra cron step and one sweep condition, no new trigger. | ✅ |
| V. Test-first | Each acceptance scenario of Stories 2, 3 and 4 starts as a failing test; fixtures synthetic; Strava faked. | ✅ |
| Language | No new rider-facing page: reasons, figures and event kinds are codes (FR-016), translated by feature 005. The privacy-text change is made in both catalogs (feature 001 FR-028). Code and docs English. | ✅ |
| Migrations | `0005` only adds two tables; `0006` adds three tables and one column with a default, which the deployed version's inserts fill. | ✅ |

**Post-design re-check (after Phase 1)**: still passing. The design adds two
tables, one queue message kind (`evaluate-rider`), one cron step and no route,
binding or dependency. Feature 001's handlers change in one way: their activity
writes join the evaluation batch (research R11). Storing Strava's flag (research
R15) shipped with feature 001.

**Post-design re-check, Story 3**: still passing. Story 3 adds three tables, one
balance column, a rules version, one sweep condition and the team-event write
functions; no route, message kind, binding or dependency. One deviation from the
spec, not the constitution: on the interim manual path (SQL, then `pnpm
daily:run`) the balance lags the stored attendance until the run's messages are
processed, against FR-014b's "never sees a balance that differs". The spec's
Assumptions name that path as temporary, and the functions the organiser pages
will use keep FR-014b (research R22).

## Project Structure

### Documentation (this feature)

```text
specs/003-rynke-evaluation/
├── plan.md              # This file (Stories 1, 2, 4; Story 3 revision)
├── research.md          # Phase 0 (R1–R15; Story 3: R16–R23)
├── data-model.md        # Phase 1: evaluation shapes, ride_results, rynke_balances, team events
├── quickstart.md        # Phase 1
├── contracts/
│   ├── ride-evaluation.md   # evaluation, team-event changes, reads; reason, figure and kind codes
│   └── queue-messages.md    # evaluate-rider and the cron sweep
├── lazy-rider.md
├── checklists/
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
docs/rynke-punkte.md, docs/print.css, scripts/docs-pdf.sh   # Story 1 (exist)

migrations/
├── 0003_activity_flagged.sql   # activities.is_flagged (feature 001, exists)
├── 0004_consent_and_write_scope.sql  # consent_records (feature 001, exists)
├── 0005_rynke_results.sql      # ride_results, rynke_balances (exists)
└── 0006_team_events.sql        # Story 3: team_event_kinds, team_events, attendances, rynke_balances.team_events

src/
├── rynke/
│   ├── rules.ts             # RynkeRules type, CURRENT_RULES (version, effective date, values); Story 3: teamEvents, version 2
│   ├── rides.ts             # evaluateRides(): pure, ride results + riding totals
│   ├── team-events.ts       # Story 3: TEAM_EVENT_KINDS, evaluateAttendance(): pure, per-kind sums
│   ├── tally.ts             # tally(): pure, balance from riding totals + extras + rules; Story 3: breakdown
│   └── apply.ts             # applyAndEvaluate(): input change + evaluation in one D1 batch;
│                            # Story 3: reads attendance, applyTeamEventChange(), teamEventChange()
├── strava/
│   └── activity.ts          # is_flagged mapping; ACTIVITY_FIGURES_VERSION 2 (feature 001, exists)
├── i18n/messages/
│   ├── de.ts, en.ts         # privacy text names Strava's flag (feature 001, exists)
├── db/
│   ├── activities.ts        # + listRiderActivitiesStatement, activityOwnersStatement; upsert/delete as statements for the batch
│   ├── rynke.ts             # stored results: read snapshot, diff writes, sweep query; Story 3: breakdown column, attendance sweep condition
│   └── team-events.ts       # Story 3: event and attendance statements, listRiderAttendanceStatement
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
├── support/
│   ├── rides.ts             # makeRide(): synthetic rides in km, h, m
│   └── rynke.ts             # stored rows, expected evaluation, invariant check; Story 3: events, attendance
├── unit/
│   ├── rules.test.ts        # rule validation, fingerprint pinned to the version; Story 3: version 2, amounts
│   ├── rides.test.ts        # Story 2 scenarios, boundaries, flagged, unknown figures, order independence
│   ├── team-events.test.ts  # Story 3 scenarios 1–4, window, every kind listed, order independence
│   ├── tally.test.ts        # Story 4 tally fields, qualification incl. virtual share; Story 3 scenarios 5, 6
│   └── reference-riders.test.ts   # SC-001: hand-calculated reference riders, with attendance
└── integration/
    ├── schema-minimisation.test.ts, db.test.ts   # + the Rynke tables, Story 3's tables and column
    ├── rynke-apply.test.ts      # applyAndEvaluate and readRynke against D1
    ├── rynke-store.test.ts      # Story 4 scenarios through webhook → D1, diff writes, invariants
    ├── team-events-apply.test.ts   # Story 3: every team-event change in one batch, evaluate-rider sent
    ├── rynke-sweep.test.ts      # cron sends evaluate-rider for missing, outdated, stale riders only
    ├── rynke-deletion.test.ts   # activity delete, private removal, rider deletion, event deletion
    └── evaluate-rider.test.ts   # the message: full evaluation, no Strava call
```

**Structure Decision**: `src/rynke/` holds everything that computes Rynke:
`rides.ts` and `tally.ts` are pure and import nothing that needs bindings;
`apply.ts` is the single place that turns an input change into one D1 batch.
SQL lives in `src/db/` as in feature 001. Story 3 adds team events as another
input to `tally()` (through the pure `team-events.ts`) and another kind of input
change to `apply.ts`, sharing its read, evaluate and diff steps; its SQL lives in
`src/db/team-events.ts`.

## Complexity Tracking

No violations.
