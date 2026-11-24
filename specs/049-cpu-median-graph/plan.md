# Implementation Plan: CPU Median Over the Season

**Branch**: `049-cpu-median-graph` | **Date**: 2026-11-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/049-cpu-median-graph/spec.md`

## Summary

Record the daily median CPU time per owner beside the slowest runs' value, and
draw it on Admin › Nutzung's CPU row as one season graph with three lines (this
team, the other teams, the gateway), one point per week at the week's highest
daily median. The median comes from the CPU query the hourly recording already
makes (one more quantile), lands in one new nullable column, and is grouped
into week slots by a pure function next to the table's owner grouping. The
graph is server-drawn SVG with the usage graphs' hover pattern; the table cell
becomes "median / slowest ms" over the cut-off runs. A one-time Node script
fills the season's earlier medians per team from Cloudflare, idempotently.
Details in [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript on Cloudflare Workers; the fill task is a Node
ES module (`.mjs`) importing the app's TypeScript as the existing scripts do

**Primary Dependencies**: none new

**Storage**: D1; migration `0042_usage_cpu_median.sql` adds
`usage_cpu_daily.cpu_p50_us INTEGER` (nullable) ([data-model.md](data-model.md))

**Testing**: Vitest in the Workers runtime; the e2e smoke test gains the CPU
graph's hover

**Target Platform**: every team's app Worker; the gateway Worker is untouched
(it is only measured)

**Project Type**: web service (server-rendered admin page) plus one manual script

**Performance Goals**: the admin page reads at most ~1,500 small CPU rows (a
season × owners) in its existing read, one query; the hourly recording makes no
extra request

**Constraints**: viewing makes no Cloudflare call (feature 025 FR-027); the
migration only adds; no other team named on the page (feature 026 FR-023); new
CSS only for the `cpu-*` pieces of the design draft

**Scale/Scope**: one row of one admin page, one column, one script; 2–3 teams,
a handful of administrators

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|---|---|---|
| I. Privacy and consent | One more aggregate per Worker and day from Cloudflare; no rider data, no identifiers, admin-only, other teams unnamed. No consent revision. | Pass |
| II. Strava API citizenship | No Strava request. | Pass |
| III. Rider content wins | Nothing written to Strava or to rider data. | Pass |
| IV. Serverless, minimal deps | No dependency; one additive migration; the fill task is outside the bundle and uses Wrangler and the existing analytics token. | Pass |
| V. Test-first | App changes start with failing tests per story ([quickstart.md](quickstart.md)). The fill script gets no automated test, see Complexity Tracking. | Pass (justified) |
| Language | New and changed text in all ten catalogs, German the key source; `admin.cpu.cell` removed from all ten. Code and docs English. | Pass |
| Teams | Same graph on every team; the season is fixed 1 Sep – 31 Aug, not team data; only "this team" differs. | Pass |
| Production safety | The fill task touches production only with `--remote`, run by the maintainer after the release (CLAUDE.md non-negotiables). | Pass |

Re-check after Phase 1: unchanged, all pass. The release before keeps writing
its named columns and leaves the median NULL during the rollout (research R2).

## Project Structure

### Documentation (this feature)

```text
specs/049-cpu-median-graph/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── cpu-row.md
│   └── fill-task.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
migrations/
└── 0042_usage_cpu_median.sql        # new: cpu_p50_us column (R2)

src/usage/
├── cpu.ts                           # P50 in CPU_QUERY, parse, owner max, cpuRows; season + week slots (R1, R3)
└── cloudflare.ts                    # queryCloudflare takes an optional day range (R8)

src/db/
└── usage.ts                         # upsert and read the median (R2)

src/http/
├── admin/usage.ts                   # one season read; graph, legend, empty line; table pair and header (R4, R7)
├── charts.ts                        # seasonLines (R5)
└── style.ts                         # cpu-* classes from the design draft

public/
└── app.js                           # usageGraphs: week tips from data-weeks (R6)

src/i18n/messages/*.ts               # all ten catalogs

dev/fake-strava/
└── seed.ts                          # synthetic CPU days for the season (R9)

scripts/
└── cpu-median-fill.mjs              # new: one-time fill task (R8); package.json "cpu:fill-median"

test/unit/
├── usage-cpu.test.ts                # median, owner max, season, week slots
├── charts.test.ts                   # seasonLines
└── migrations.test.ts               # list
test/support/usage.ts                # cpuBody carries cpuTimeP50
test/integration/
├── admin-usage-cpu.test.ts          # graph, empty season, cell, header
├── usage-record.test.ts             # median recorded and replaced
└── schema-minimisation.test.ts      # new column listed
e2e/smoke.e2e.ts                     # CPU graph hover
```

**Structure Decision**: Everything stays in the existing CPU and usage modules.
Week slots live beside `cpuRows` in `src/usage/cpu.ts`, so the graph and the
table share one owner grouping. The fill task is a script, like the sandbox
usage check, so the app carries no fill logic and no run-once state.

## Complexity Tracking

| Deviation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| The fill script has no automated test (principle V) | It is a one-time manual maintainer tool; the maintainer's standing rule is that such seldom-run tools get no tests. Everything it reuses from the app (median parsing, owner max, day range) is tested, and its own write is one guarded `UPDATE … WHERE cpu_p50_us IS NULL` checked by a local run (quickstart). | A test harness around Wrangler and Cloudflare for a script deleted after one run costs more than the script. |
