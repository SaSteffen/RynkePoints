# Implementation Plan: Dismiss Day Warnings

**Branch**: `050-dismiss-day-warnings` | **Date**: 2026-11-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/050-dismiss-day-warnings/spec.md`

## Summary

Each day warning row in "Das braucht deinen Blick" gets a "Gesehen" button. It
posts the row's kind, day and the reasons it showed to a new admin route, which
keeps one row per reason for that administrator in a new D1 table. The list's
builder, which already feeds the list, its head and the Admin tab's number,
leaves out a day warning whose every current reason the viewer dismissed, so all
three drop together and a new reason brings the row back. The day tables don't
read dismissals, so their marks stay. Dismissals go with the daily run once their
day has left the list, when the administrator loses the Admin role, and with the
rider. Details in [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript on Cloudflare Workers

**Primary Dependencies**: none new

**Storage**: D1; migration `0043_usage_dismissals.sql` adds one table, nothing
else changes ([data-model.md](data-model.md))

**Testing**: Vitest in the Workers runtime (`@cloudflare/vitest-plugin`)

**Target Platform**: every team's app Worker; the gateway is untouched

**Project Type**: web service (server-rendered admin page)

**Performance Goals**: one more small D1 read (at most a handful of rows) in the
usage state that administrators' pages already read, in parallel with its other
reads

**Constraints**: viewing and dismissing make no Strava or Cloudflare call
(feature 025 FR-027); no rider data, counts or other team's name kept; the
existing in-place form save (`data-swap`), no new client script

**Scale/Scope**: one page, three kinds of day warning, at most two days each;
a handful of administrators per team

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|---|---|---|
| I. Privacy and consent | Keeps only which administrator marked which kind of day warning, which day and which reasons, for about two days; deleted with the rider. Nothing read from Strava, nothing shown to anyone else. No consent revision; the privacy notice needs no line (research R7). | Pass |
| II. Strava API citizenship | No Strava request added. | Pass |
| III. Rider content wins | Nothing written to Strava or to rider data. | Pass |
| IV. Serverless, minimal deps | No dependency; one add-only migration; a few rows per admin page view, well within the free D1 allowance. | Pass |
| V. Test-first | Each story starts with failing tests ([quickstart.md](quickstart.md)). | Pass |
| Language | Two new keys in all ten catalogs, German the key source. Code and docs English. | Pass |
| Teams | No branch per team; each team's D1 keeps its own dismissals, so nothing crosses teams (FR-012). | Pass |

Re-check after Phase 1: unchanged, all pass. The migration only adds a table, so
the release before keeps working (research R8).

## Project Structure

### Documentation (this feature)

```text
specs/050-dismiss-day-warnings/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── dismiss-route.md
│   └── usage-view.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
migrations/
└── 0043_usage_dismissals.sql        # new: the dismissals table (R1)

src/db/
├── usage.ts                         # read, add and prune dismissals (R1, R6)
└── riders.ts                        # setRole drops them when Admin is taken (R6)

src/usage/
├── attention.ts                     # reasons per day item; leaves dismissed ones out (R2, R3)
└── state.ts                         # reads the viewer's dismissals into the list (R3)

src/work/
└── scheduled.ts                     # pruneUsage drops days past yesterday (R6)

src/http/
├── admin/usage.ts                   # "Gesehen" form on day rows; POST /admin/dismiss (R4, R5)
├── router.ts                        # the route
└── style.ts                         # the row with its button (R5)

src/i18n/messages/*.ts               # all ten catalogs

test/unit/
└── usage-attention.test.ts          # dismissed items, new reasons
test/integration/
├── admin-usage-dismiss.test.ts      # new: route, list, head, Admin tab number, other admin, prune
└── admin-roles.test.ts               # taking Admin drops the dismissals
```

**Structure Decision**: The feature stays inside the usage modules feature 048
built. The list's builder already owns "what needs a look" for the page and the
Admin tab, so leaving dismissed items out there keeps both equal without a
second count. Saving reuses the admin POST guard and the in-place form save the
app already has.

## Complexity Tracking

None.
