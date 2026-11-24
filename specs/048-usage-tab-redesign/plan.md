# Implementation Plan: Usage Tab Redesign

**Branch**: `048-usage-tab-redesign` | **Date**: 2026-11-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/048-usage-tab-redesign/spec.md`

## Summary

Rebuild Admin › Nutzung around one list, "Das braucht deinen Blick", and add an
early level, Hinweis, from 25 % for every figure. A pure module builds the list
and its counts from the figures, CPU marks, the day tables' marks of today and
yesterday, the other teams' exchange state and the viewer's devices; the page,
its head and a new number on the Admin tab all use it. The figures become
Settings-style grouped lists with a three-tick bar; the operations become
"Betrieb" rows that open to today's tables. Hinweis is stored and notified like
80 % and 95 %, after a migration relaxes `usage_alerts`' level check. Details in
[research.md](research.md). Completes issue #435.

## Technical Context

**Language/Version**: TypeScript on Cloudflare Workers

**Primary Dependencies**: none new

**Storage**: D1; migration `0041_usage_alerts_early.sql` rebuilds `usage_alerts`
with a wider level check, same name and columns
([data-model.md](data-model.md))

**Testing**: Vitest in the Workers runtime (`@cloudflare/vitest-plugin`)

**Target Platform**: every team's app Worker; the gateway is untouched

**Project Type**: web service (server-rendered admin page)

**Performance Goals**: the Admin tab's number adds one small D1 batch per page
view for administrators only, run in parallel with the page

**Constraints**: viewing makes no Strava or Cloudflare call (feature 025
FR-027); no rider data or other team's name on the page, in the number or in a
notification; Settings' existing classes, new CSS limited to the bar ticks,
level icon colours and the phone rule

**Scale/Scope**: one page, ten figures, five Betrieb rows; a handful of
administrators per team; 2–3 teams

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|---|---|---|
| I. Privacy and consent | No new data read or kept; counts and levels only; admin-only; no other team named. No consent revision, privacy notice unchanged. | Pass |
| II. Strava API citizenship | No Strava request added; the page and the number read D1 only. Notifications are on our own push. | Pass |
| III. Rider content wins | Nothing written to Strava or to rider data. | Pass |
| IV. Serverless, minimal deps | No dependency; one migration; the number's reads stay in the free D1 allowance (a few rows per admin page view). | Pass |
| V. Test-first | Each story starts with failing tests ([quickstart.md](quickstart.md)). | Pass |
| Language | New and changed text in all ten catalogs, German the key source; removed keys go from all ten. Code and docs English. | Pass |
| Teams | No branch per team; thresholds are shared code, not team data. | Pass |

Re-check after Phase 1: unchanged, all pass. The migration rebuilds one table but
keeps its name and columns, so the release before keeps reading and writing it
(research R2).

## Project Structure

### Documentation (this feature)

```text
specs/048-usage-tab-redesign/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── usage-view.md
│   ├── alerts.md
│   └── nav-count.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
migrations/
└── 0041_usage_alerts_early.sql      # new: wider level check (R2)

src/usage/
├── allowances.ts                    # early thresholds per group, alertLevels()
├── figures.ts                       # Level gains "early"; levelOf by allowance
├── alerts.ts                        # fires and clears the early level
└── attention.ts                     # new: the list, its order and mark count (R4)

src/db/
└── usage.ts                         # lean reader for the list and the number (R5)

src/http/
├── admin/usage.ts                   # page rebuilt: list, figure rows, Betrieb rows, switch (R6)
├── admin/access.ts                  # adminSwitch carries the count
├── charts.ts                        # thresholdBars takes tick positions (R7)
├── shell.ts                         # Admin tab number (R5)
├── pwa.ts                           # Hinweis notification text (R3)
└── style.ts                         # bar ticks, level icons, quiet rows (R8)

public/
└── app.js                           # open the usage row the hash names (R9)

src/i18n/messages/*.ts               # all ten catalogs

test/unit/
├── usage-figures.test.ts
├── usage-alerts.test.ts
└── usage-attention.test.ts          # new
test/integration/
├── admin-usage*.test.ts             # assertions follow the new markup
└── admin-usage-badge.test.ts        # new
```

**Structure Decision**: The feature stays inside the existing usage modules.
The one new module, `src/usage/attention.ts`, owns "what needs a look" so the
page and the navigation can't disagree. The section bodies (re-check, calls,
routing, CPU tables) are kept and moved into the Betrieb rows' panels, not
rewritten.

## Complexity Tracking

None.
