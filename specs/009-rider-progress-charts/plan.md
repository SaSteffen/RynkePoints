# Implementation Plan: Rider Progress Charts

**Branch**: `009-rider-progress-charts` (work on `docs/009-spec-refresh`) | **Date**:
2026-10-19 (re-planned; replaces the unbuilt plan of 2026-10-07) | **Spec**:
[spec.md](spec.md)

**Input**: Feature specification from `/specs/009-rider-progress-charts/spec.md`,
revised 2026-10-19

## Summary

The Overview ("Du") gets a progress section below the breakdown:
- two zoomable line charts of the rider's Training and Team Rynke over the season,
  each with its threshold line;
- a readout of the selected day;
- a weekly table as the text version.

US2 later adds the pace lines and the outdoor curve.

- **Curve**: rebuilt on every view by a new `riderCurve` in `src/rynke/weeks.ts`.
  It reuses that file's `tallyUpTo`, the same code behind 016's weekly line, so
  the table's week totals equal the Team section's (R1, R2).
  - Input: two SELECTs added to the Overview's existing batch (R3).
  - Nothing is stored and there is no migration.
- **Drawing**: inline SVG rendered on the server, as in `src/http/charts.ts`, one
  x unit per day across the whole axis (R5). Without JavaScript, the charts, the
  `?period=` links and the table work (FR-052).
- **Interaction, no library** (re-checked in R4): zooming only changes the SVG's
  `viewBox`. A `progressCharts()` function in `public/app.js` handles:
  - drag, pinch, focused wheel and keys;
  - move and reset;
  - the crosshair and the readout;
  - the date labels.

  It holds no text: readout templates come from the catalogs, rendered hidden by
  the server (R6, R7, R9).
- **Look**: a Material 3 outlined card across both grid columns. Curves use
  darker, validated steps of the brand colours, readable in light and dark mode
  (R12).
- **Pace (US2)**: 016's `evenPace`, so the charts agree with the rider status.

## Technical Context

**Language/Version**:
- TypeScript 7 (`tsc --noEmit`) on Cloudflare Workers.
- Browser: plain JS in `public/app.js`, as for 010–020.

**Primary Dependencies**: none new. The existing ones used:
- the `html` template, `I18n` (`t`, `tHtml`, `formatDate`, `formatNumber`);
- `readRiderView`;
- `src/rynke/weeks.ts`, `pace.ts`, `tally.ts` and `team-events.ts`;
- `shellPage`.

**Storage**: D1, read only. Two SELECTs added to `readRiderView`'s batch when the
Overview asks for them ([data-model.md](data-model.md)). No migration.

**Testing**:
- Vitest in workerd (`pnpm test`) for the pure modules, the markup and `/me`.
- Playwright (`pnpm test:e2e`, Chromium, Firefox and WebKit) for the browser
  interaction (R13).

**Target Platform**: Cloudflare Workers. Server-rendered HTML with the deferred
`app.js`, on current evergreen browsers. Pointer Events are needed for zoom
gestures.

**Project Type**: web service (one Worker with pages, webhook, queue and cron, plus
static assets).

**Performance Goals**:
- The Overview within 2 s at 500 rides (SC-005); the rebuild under 10 ms (R14).
- Zoom and select respond within 0.5 s on a mid-range phone, with each redraw
  under 16 ms.

**Constraints**:
- 320–360 px wide without sideways scrolling (FR-070).
- Works without the script (FR-052).
- No Strava call and no write on view (FR-003).
- Only Rynke are shown (FR-005).
- Line charts only (FR-007).
- All text from the catalogs (FR-060).
- Light and dark mode (FR-072).

**Scale/Scope**:
- ≤ 10 riders, ≤ 500 rides each, a 303-day axis.
- About 8 source files touched, 2 new (`src/http/progress-view.ts`,
  `src/http/progress-section.ts`).
- 18 + 6 catalog keys.
- 4 new Vitest files, 1 new e2e file.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design
(below).*

| Principle | How this plan complies | Result |
|---|---|---|
| **I. Privacy and consent** | Nothing new is read from Strava and nothing new is stored. The rider sees only their own derived Rynke (FR-002), which their consent covers (spec Assumptions). The page data holds only dates and whole numbers of Rynke. The metre sums used to place elevation steps never leave the Worker (data-model.md). The script makes no request and keeps no storage or cookie. Fixtures and e2e samples are synthetic. | Pass |
| **II. Strava API citizenship** | No Strava request on view, zoom or select (FR-003, SC-006). | Pass |
| **III. Rider-authored content wins** | Nothing is written. | Pass |
| **IV. Serverless, TS, minimal deps** | No dependency: libraries were re-checked and rejected (R4). The curve reuses the pure rules functions through `weeks.ts` (R1), so the points stay recomputable from stored data. The cost is two SELECTs and a few KB in `app.js`, within the free tier. | Pass |
| **V. Test-first** | Every FR maps to a test written first ([quickstart.md](quickstart.md) §1). The browser part, untested in the first plan, now gets Playwright tests in three browsers (R13). | Pass |
| **Language** | 18 keys for US1 and 6 for US2, in `de` and `en`. `app.js` holds no text (R9). Code and docs are in English. | Pass |
| **Brand / Strava API Agreement** | Line charts of Rynke only: no training analysis, rides or performance figures, so nothing that "replicates Strava functionality" (FR-005, FR-007). | Pass |
| **Development workflow** | Spec Kit order. US1 is one PR into `develop`, US2 a later one. No migration. | Pass |

**Post-design re-check (after Phase 1)**: still Pass.
- [data-model.md](data-model.md): two SELECTs, nothing stored. The chart JSON has
  no names, units or ride data.
- [contracts/overview-section.md](contracts/overview-section.md): the section is
  only on the Overview, only for the signed-in rider (or the tour's synthetic
  example).
- [contracts/client.md](contracts/client.md): no network, storage or URL changes.
- [contracts/http-routes.md](contracts/http-routes.md): only `period=3m|4w`;
  `safeNext` is unchanged.
- [contracts/messages.md](contracts/messages.md): `de` and `en`, same keys.

## Delivery

| Delivery | Stories | Requirements | Depends on | Releasable alone |
|---|---|---|---|---|
| **1 (first PR)** | US1 | FR-001–FR-007, FR-010–FR-016, FR-020–FR-026, FR-030, FR-037, FR-040–FR-043, FR-050–FR-053, FR-060, FR-061, FR-070–FR-072, FR-080 | 003, 005, 011, 014, 015, 016, 020, all merged | yes |
| 2 (later PR) | US2 | FR-038, FR-039, and what FR-030, FR-051 and FR-080 add | delivery 1 | yes |
| with the spec | US3 | FR-090–FR-092 | — | — |

Within PR 1, the tasks follow the dependencies:
1. `riderCurve` and the `tallyUpTo` extension.
2. The read.
3. The view model.
4. The catalogs.
5. The markup and CSS tokens.
6. The Overview wiring and the tour example.
7. `progressCharts()` in `app.js`.
8. The e2e tests.
9. The diagram check (FR-092).

## Project Structure

### Documentation (this feature)

```text
specs/009-rider-progress-charts/
├── spec.md                      # revised 2026-10-19
├── plan.md                      # this file
├── research.md                  # R1–R14
├── data-model.md                # the read, riderCurve, ProgressView, chart data
├── quickstart.md                # tests per FR, local walk-through
├── contracts/
│   ├── overview-section.md      # section markup and rules
│   ├── client.md                # progressCharts() in app.js
│   ├── http-routes.md           # ?period=, nothing else
│   └── messages.md              # progress.* keys
├── checklists/requirements.md
└── tasks.md                     # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── rynke/weeks.ts                    # + riderCurve, CurveInputs; tallyUpTo carries without-virtual
├── db/rider-view.ts                  # + { progress: true }: daily ride sums, corrections, same batch
├── http/progress-view.ts             # new: buildProgressView, presets, ticks, yMax, weeks (pure)
├── http/progress-section.ts          # new: renderProgress (SVG, labels, templates, table, JSON)
├── http/sections/overview.ts         # read with progress; section after the breakdown
├── http/tour-example.ts              # exampleRiderView fills progress (FR-043)
├── http/style.ts                     # .progress styles, --rp-line-* tokens in both schemes
└── i18n/messages/{de,en}.ts          # progress.* keys

public/app.js                         # + progressCharts()

test/
├── unit/        curve, progress-view, progress-section (new);
│                weeks/reference-riders, design-tokens, catalogs (extended)
├── integration/ overview-progress (new)
└── support/     progress fixtures: the example rider (new)
e2e/progress.e2e.ts                   # new
dev/fake-strava/samples.ts            # only if no sample rider has several weeks of rides
```

**Structure Decision**: the existing single-Worker layout.
- The curve sits with the other "Rynke up to a date" code in `src/rynke/weeks.ts`.
- The view model and markup sit beside the Overview's.
- The browser part goes into the one page script.

## Design diagrams

These cover what FR-092 asks for: where the curve is rebuilt, what is read and in
which order, and how the charts are drawn and made interactive. The spec's
diagrams D0–D7 stay authoritative.

### P1. Modules and what they may import

```mermaid
flowchart LR
    ov["http/sections/overview.ts<br/>handleOverview"] --> read["db/rider-view.ts<br/>readRiderView(progress)"]
    ov --> ex["http/tour-example.ts<br/>exampleRiderView (tour)"]
    ov --> pview["http/progress-view.ts<br/>buildProgressView (pure)"]
    ov --> psec["http/progress-section.ts<br/>renderProgress"]
    pview --> weeks["rynke/weeks.ts<br/>riderCurve · weekEnds · lastDay"]
    pview --> pace["rynke/pace.ts<br/>evenPace (US2)"]
    weeks --> tally["rynke/tally.ts · team-events.ts<br/>003's functions"]
    team["http/sections/team.ts<br/>riderWeeks (016)"] --> weeks
    psec --> i18n["i18n · html"]
    app["public/app.js<br/>progressCharts()"] -. "reads markup + JSON only" .-> psec
    read -. "SELECT only" .-> d1[("D1")]
```

### P2. What is read, and in which order (one Overview view)

```mermaid
sequenceDiagram
    actor R as Rider
    participant O as handleOverview
    participant DB as D1
    participant V as buildProgressView
    participant C as riderCurve
    participant X as renderProgress

    R->>O: GET /me?period=4w
    O->>DB: db.batch([balance, counts, ride page, attendance,<br/>daily ride sums, corrections])
    Note over DB: one batch, one snapshot (FR-041)
    DB-->>O: balance, attendance, ≤ 600 day rows, corrections
    O->>V: read, rules of the balance's version, window, today, period
    V->>C: inputs, window, lastDay, balance, rules
    C-->>V: one point per day, last = balance
    V-->>O: ProgressView (axis, period, presets, series, ticks, weeks)
    O->>X: ProgressView + I18n
    X-->>O: section HTML with SVG, templates, table, JSON
    O-->>R: 200, the Overview
    Note over O,DB: no write, no queue message, no Strava request (FR-003)
```

### P3. How a day's total is rebuilt

```mermaid
flowchart TD
    rides[("Daily ride sums<br/>date · virtual · distance Rynke · elevation dm")]
    att[("Attendance<br/>kind · date")]
    cor[("Corrections<br/>date · training · team")]
    rides & att & cor --> clamp["Dated after the last day?<br/>→ count on the last day (R2)"]
    clamp --> loop{"For each day d<br/>season start … last day"}
    loop --> sum["running ride sums ≤ d<br/>all and without virtual"]
    sum --> t["tallyUpTo(d): evaluateAttendance, extrasFrom, tally<br/>elevation floored on the total, floor of 0"]
    t --> point["CurvePoint d<br/>training · team · outside"]
    point --> last{"Last point equal<br/>to the stored balance?"}
    last -- yes --> view["ProgressView"]
    last -- no --> fix["Use the balance,<br/>log without rider data"] --> view
    view --> wk["Table: points at weekEnds()<br/>= the Team section's line (FR-012)"]
```

### P4. How the charts are drawn and made interactive

```mermaid
flowchart TB
    subgraph server["Worker (every view)"]
        pv["ProgressView"] --> sec["renderProgress"]
        sec --> svg["SVG per chart: whole axis,<br/>viewBox = the URL's period"]
        sec --> lbl["HTML labels: y, threshold,<br/>dates of the period (R10)"]
        sec --> tpl["hidden readout templates<br/>with data-slot spans"]
        sec --> json["#progress-data: dates and numbers"]
        sec --> table["weekly table in details"]
    end
    subgraph browser["Browser"]
        page["Overview as served"] --> has{"app.js runs?"}
        has -- no --> static["Stays as is: links reload<br/>with ?period= (FR-052)"]
        has -- yes --> init["progressCharts(): .js class,<br/>plots focusable"]
        init --> input["pointer, pinch, focused wheel,<br/>keys, buttons, period links"]
        input --> clampp["clamp ≥ 7 days within the axis"]
        clampp --> vb["set viewBox on both SVGs (FR-021)"]
        vb --> relabel["re-lay date labels,<br/>aria-label, aria-current"]
        input --> sel["selected day → crosshair, dot,<br/>readout from templates"]
    end
    svg & lbl & tpl & json & table --> page
```

### P5. The period

```mermaid
stateDiagram-v2
    [*] --> Served: GET /me[?period=3m|4w]
    Served: Period from the URL<br/>(whole season if missing,<br/>invalid or not offered)
    Served --> Scripted: app.js starts
    Scripted --> Scripted: zoom, move, preset<br/>(viewBox only, no URL change)
    Scripted --> Scripted: reset → whole season
    Scripted --> [*]: Overview loaded again<br/>(reload, other section, Settings)
    Served --> Served: without script: preset link<br/>loads /me?period=…
```

### P6. The section at 360 px

```mermaid
flowchart TB
    subgraph phone["360 px − 2 × 16 px page padding − card padding = about 312 px"]
        direction TB
        h["Heading · rules version line"]
        nav["Period chips (wrap) · Früher · Später · Ganze Saison<br/>44 px tap height"]
        c1["Training: 32 px y labels | stretched SVG, 11rem high<br/>date labels as HTML below"]
        c2["Team: the same"]
        ro["Readout (aria-live)"]
        tb["details: weekly table (5 columns; US2 scrolls in its box)"]
        h --> nav --> c1 --> c2 --> ro --> tb
    end
```

## Complexity Tracking

| Deviation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| The date-label rule exists twice: TypeScript on the server, JS in `app.js` (R10) | The server draws labels without the script, and the browser must re-lay them on zoom without a request. | Pre-rendering every day's label adds about 600 hidden elements. A shared JS module needs a second tsconfig and `checkJs` for a 20-line rule. An e2e test keeps both in step. |
