# Research: Rider Progress Charts

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-10-19
(re-planned; the first plan of 2026-10-07 was never built)

Each section records a decision, why it was taken, and what else was considered.
Since the first plan, features 011–020 were built. The ones this plan builds on:
- the Overview at `src/http/sections/overview.ts` (011, 015);
- `src/rynke/weeks.ts`: the weekly and daily figures of 016 and 013;
- `src/rynke/pace.ts`: the even pace (016);
- `src/http/charts.ts`: inline-SVG charts without a library (016);
- corrections (014);
- the tour's example rider (020);
- `public/app.js` as the one page script (010 R16);
- Playwright smoke tests in three browsers.

## R1. Rebuild the curve on every view, next to 016's weekly figures (FR-011, FR-012)

**Decision**:
- The curve is rebuilt on every Overview view from what is stored:
  - the counting ride results, summed per local start date and virtual flag;
  - the rider's attendance;
  - the rider's corrections.
  Nothing new is stored and there is no migration.
- The new pure `riderCurve(inputs, window, last, rules)` sits in
  `src/rynke/weeks.ts`, beside `riderWeeks` and `riderDays`. It reuses that file's
  `tallyUpTo`, which calls 003's `evaluateAttendance`, `extrasFrom` and `tally`.
  `tallyUpTo` is extended to carry the rides without virtual ones, so it also
  returns `trainingWithoutVirtual` (US2).
- It returns one point per day, from the season start to the last day (R2). The
  rides are summed as the days go, like `riderDays` does.
- The weekly table takes the curve's points at `weekEnds(seasonStart, lastDay)`.
  These are the same week ends that the Team section passes to `riderWeeks`.

**Rationale**:
- One file holds all the "Rynke up to a date" arithmetic. The elevation floor and
  the team-event amounts come from 003's functions, so there is no second copy of
  the rules (FR-012).
- The curve and 016's weekly line are both `tally` over the same stored rows, so
  their totals at a week's end are equal. A test checks this for every reference
  rider (FR-012, FR-051, SC-002).
- The cost is small: at most about 300 days, 500 ride rows, 100 events and a few
  corrections, so well under 10 ms.

**Alternatives considered**:
- *Store the curve with the balance*: needs a migration, a write on every
  evaluation, and a new way to disagree with the balance.
- *Build it from `riderDays` and fill the gaps*: `riderDays` has no
  without-virtual sum and skips days without input. Extending it would change
  badge code (013) for no gain.
- *The old plan's separate `seasonCurve` module with `ridingTotals` exported from
  `rides.ts`*: a third place doing the same sums as `weeks.ts`.

## R2. Which day a Rynke belongs to, and the last point (FR-011, FR-013)

**Decision**:
- **Placing items on days**:
  - A ride belongs to the date of its `start_date_local`, as in 003 FR-011.
  - A team event belongs to its `event_date`.
  - A correction belongs to its `correction_date`.
- **The last day**: `lastDay(today, deadline)` from `weeks.ts`. "Today" is
  `berlinDate(ctx.now())`. The time axis always runs to the deadline, a team
  setting that is always set (016 FR-005).
- **Items dated after the last day** count on the last day. This happens with
  attendance recorded for an event dated in the future, or a ride started in a
  time zone ahead of Berlin. As a result, the computed last point is the stored
  balance.
- **If the last point still disagrees** with the stored balance (a bug, since
  results, attendance and balance are written in one batch), the last point is
  replaced by the balance, as `riderWeeks` does. `console.error("Progress curve
  disagrees with the stored balance")` is logged without rider data.

**Rationale**:
- US1 scenario 5 asks for the last point to equal the gauges.
- Overriding the last point like `riderWeeks` does keeps the Overview and the Team
  section telling the same story, even in that case. The log still catches the
  bug.

## R3. The read: two SELECTs added to the Overview's batch (FR-041)

**Decision**:
- `readRiderView(db, athleteId, page, { progress: true })` adds two statements to
  its existing `db.batch`:
  - **Daily ride sums**: the counting ride results grouped by the date of
    `start_date_local` and by `is_virtual`, with the sums of `distance_rynke` and
    `elevation_dm`.
  - **Corrections**: the rider's corrections (date, training, team).
- The attendance the batch already reads (`listRiderAttendanceStatement`) gives
  the team events with kind and date.
- Only the Overview passes `progress: true`. The Rides section's reads are
  unchanged.

**Rationale**: everything comes from one batch, and so from one snapshot, as the
balance and the gauges do (FR-041).

**Privacy**: the metre sums are read only to place the elevation steps. They are
never rendered, put in the page data or logged (FR-005).

## R4. A charting library? Re-checked: still none (Principle IV, FR-052)

**What the charts need**:
- two charts, at most four lines each, at most about 300 points per line;
- drawn on the server, so they show without the script (FR-052);
- zoom by pinch, drag, focused wheel and keys, plus move and reset (FR-022,
  FR-023, FR-053);
- one readout of a day's totals (FR-030);
- text alternatives (FR-050);
- light and dark mode (FR-072);
- no build step for browser code: `public/app.js` is served as written.

**Decision**: no library. The server draws each chart as inline SVG, as
`src/http/charts.ts` already does for the Team section.

The interaction is cheap because **zooming only changes the SVG's `viewBox` on
the x axis**:
- The server draws every curve for the whole time axis, one x unit per day.
- To zoom, the browser sets `viewBox="<from> 0 <days> 100"`.
- `preserveAspectRatio="none"` stretches the visible stretch to the plot's width,
  and `vector-effect="non-scaling-stroke"` keeps the lines 2 px wide.
- The browser never builds a path. It only:
  - moves the crosshair;
  - fills the readout;
  - lays out the date labels for the visible stretch (R10).

| Option | Why not |
|---|---|
| uPlot (~50 KB, canvas) | Has drag-to-zoom, but no pinch and no server rendering. A canvas has no text for screen readers. It would be the first vendored browser library. |
| Chart.js + zoom plugin + Hammer.js (~250 KB, canvas) | Same canvas limits, five times larger. |
| Apache ECharts (~1 MB; SVG server rendering) | Far too large for two line charts. The server renderer would need its full module in the Worker. |
| ApexCharts (~500 KB, SVG) | Draws only in the browser, so nothing shows without the script. |
| D3 (scale, shape, zoom; ~30 KB) | Needs a bundler for the browser. With the `viewBox` approach the paths never change anyway. |

The old plan's shared `public/progress/chart.js`, with `checkJs` and a second
tsconfig, is dropped. It existed so that the browser could redraw paths exactly
like the server, and with zoom done through the `viewBox` there are no paths to
redraw.

**Estimated size**: about 250 lines in `app.js`, a few kilobytes.

## R5. Drawing (FR-010, FR-013, FR-014, FR-070)

**Decision**:
- **Plot**: each chart's plot is
  `<svg viewBox="0 0 {axisDays} 100" preserveAspectRatio="none">`, where
  `axisDays` is the deadline's day index (season start = 0). CSS stretches it to
  the full width, `11rem` high and `13rem` from 600 px up (the Overview's
  breakpoint).
- **Coordinates**: x = day index. y = `100 − value / yMax × 100`, rounded to two
  decimals.
- **The y scale (`yMax`)**: the larger of the threshold and the season's highest
  value, rounded up to a step of 50 for Training and 5 for Team. It is fixed for
  the season, so zooming never moves the threshold out of view or makes the scale
  jump (FR-014).
- **Lines**:
  - the curve is a polyline from day 0 to the last day's index and stops there
    (FR-013);
  - the threshold is a horizontal line across the axis;
  - from US2, the pace is a line from (0, 0) to (`axisDays`, threshold).
- **Labels**: the y labels, the threshold's value and the date labels are HTML
  around the SVG, so the stretching never distorts text. Date labels are
  positioned in percent of the visible stretch (R10).
- **Clipping**: the SVG has `overflow: hidden`, so the parts outside the viewBox
  are clipped.

**Rationale**: the server needs no screen width, and the browser changes only one
attribute per chart to zoom both (FR-021).

## R6. Browser code lives in `public/app.js` (010 R16)

**Decision**:
- A `progressCharts()` function in `public/app.js`, called with the others at the
  end. It follows the file's rules:
  - it only wires up what the markup can't do;
  - it holds no text: every word comes from the markup, rendered from the
    catalogs and hidden until the script shows it;
  - it makes no request and writes no storage.
- **Data**: one `<script type="application/json" id="progress-data">` in the
  section. It holds only dates, day indexes and whole numbers (data-model.md
  "Chart data").
- **Formatting**: numbers and dates use `Intl` with the locale in the section's
  `data-locale` (the server's `meta.intlLocale`), with the same options as
  `I18n.formatNumber` and `I18n.formatDate` (FR-061).
- **No reload trouble**: after a reload (011 FR-009's refresh or the return after a
  minute), the script starts again on fresh markup.

**Rationale**: the app has one page script, loaded with `defer` on every page. A
second file would need its own `<script>` tag and cache handling, for no benefit.

## R7. Interaction (FR-022–FR-025, FR-030, FR-053, FR-071)

**Decision**:

| Input | Action |
|---|---|
| Mouse moving over a plot | crosshair and readout on the nearest day |
| Tap, or click without moving more than 8 px | select that day: crosshair in both charts and readout |
| Horizontal drag (one finger or the mouse) | shade the stretch; on release, zoom to it (at least 7 days) |
| Two-finger pinch | zoom around the midpoint between the fingers |
| Vertical swipe | scrolls the page: plots have `touch-action: pan-y` (FR-025) |
| Wheel over a plot that has focus (after a click or Tab) | zoom around the pointer; without focus the page scrolls |
| Keys on a focused plot | ←/→ previous/next day · `+`/`-` zoom around the selected day · PageUp/PageDown move by half the period · Home/End first/last day · `0` or Escape whole season |
| "Früher", "Später", "Ganze Saison" buttons | move by half the period; reset. Shown only while zoomed in. 44 × 44 px. |
| Period buttons | with the script: change the period in place (`preventDefault`). Without it: links to `/me?period=…#progress` (R8). |

Rules that apply to every input:
- One state is shared by both plots, so they always show the same period
  (FR-021).
- The period is clamped to at least 7 days and to the axis: no further than the
  season start and the deadline (FR-022, FR-023).
- The crosshair snaps to the nearest day up to the last day. Days after the last
  day have no values to show.
- Redraws are batched with `requestAnimationFrame`.

**Rationale**:
- Requiring focus for the wheel keeps page scrolling free (dataviz guidance, and
  the most common complaint about zoomable charts).
- Drag selects a stretch rather than panning, so phones don't need a gesture
  mode. Moving uses the buttons and keys instead.

## R8. The period in the URL only for the no-script buttons (FR-020, FR-026, FR-052)

**Decision**:
- `/me` accepts `period=3m` or `period=4w`. Anything else, or nothing, means the
  whole season. There are no free `from`/`to` parameters.
- The links carry `data-from`/`data-to` (day indexes) worked out by the server. With
  the script the link is intercepted, so the browser does no calendar
  arithmetic.
- `safeNext` is not changed: since 011 FR-016 the language switch is in Settings,
  and the spec now lets the period reset when the Overview loads again (FR-026).
- `/me?page=N` keeps redirecting to Rides (011 R2). `period` is a different
  parameter, so it is unaffected.
- **"Last 4 weeks"** is the 28 days ending on the last day: 10 September – 7
  October in US1 scenario 3.
- **"Last 3 months"** starts on the same day of the month three calendar months
  back, plus one day.
- Either is offered only once it starts after the season start (FR-020). "Last 3
  months" is therefore offered from 1 December 2026: on that day it covers 2
  September – 1 December.

**Alternatives considered**:
- *Free zoom in the URL with `replaceState`* (the old plan): it was only needed
  to keep the period across the language switch, which no longer happens on the
  Overview.
- *sessionStorage*: state the spec doesn't ask for.

## R9. Totals of a day: one readout under the charts (FR-030, FR-038)

**Decision**:
- One `<p class="progress-readout" aria-live="polite">` under both charts gives the
  selected day's date and totals. Values lead and labels follow (dataviz).
  Example: "Sonntag, 20. September 2026 · 69 Trainingsrynke · 11 Teamrynke".
- From US2 the readout also gives:
  - the pace and how far ahead or behind it the rider is, for each line;
  - the outdoor Training Rynke.
- **Templates**: the server renders each readout part once from the catalogs into
  hidden `<template>` elements. Each placeholder is a
  `<span data-slot="training"></span>`, made with `i18n.tHtml`, so the word order
  stays the language's.
- The script clones the template and fills the slots with `textContent`.
- **Ahead, behind and on pace** are three templates. The script picks one by the
  sign; it never words them itself. Being behind reads as a number, not a broken
  rule (FR-038).
- **Without the script** the readout and templates stay hidden, and the table
  carries the figures (FR-052).
- **When a day is selected**, a crosshair (1 px hairline) and an 8 px dot with a
  2 px surface ring mark the day on each curve (dataviz).

**Rationale**:
- One readout for both charts matches D3/D4.
- It never covers a curve on a 360 px screen, unlike a floating tooltip.
- Screen readers announce it (FR-050, US1 scenario 17).

## R10. Date labels: one simple rule, implemented on both sides (FR-024, FR-061)

**Decision**: the visible span picks the labels.

| Visible span | Labels | Format |
|---|---|---|
| more than 62 days | the first of each month | `Intl` `{ month: "short" }` |
| 15–62 days | each Monday | `{ day: "numeric", month: "short" }` |
| 7–14 days | every second day from the period's first | `{ day: "numeric", month: "short" }` |

The server renders the labels for the period it draws. The script renders them
again on every change, in the section's locale.

**Rationale**: the rule is short enough to have two copies (TypeScript on the
server, JS in `app.js`). An e2e test checks that the script's labels for the
whole season equal the server's.

**Alternative**: the server pre-renders every day's label for the script to pick
from. That is about 600 hidden elements for two charts.

## R11. The weekly table (FR-037, FR-051)

**Decision**:
- **Rows**: one per entry of `weekEnds(seasonStart, lastDay)`, oldest first, each
  labelled with its first day (`formatDate`).
- **Columns**: Training earned, Training total, Team earned, Team total. From
  US2, plus outdoor Training earned and total.
- **Figures**: "earned" is the total at the week's end minus the total at the
  previous week's end, so a negative correction shows as a negative number.
- **Placement**: in a `<details>`, closed by default, under the readout. It covers
  the whole season, whatever the period.
- **Width**: at 360 px the five columns fit with compact figures. From US2 the
  table scrolls inside its own box (`overflow-x: auto`), never the page (FR-070).

## R12. Look: Material 3, brand colours made readable (FR-050, FR-072)

**Decision**:
- **Container**: the section is a `card-outlined`. `.overview-grid>.progress` spans
  both columns, overriding the grid's rule that outlined cards take one column.
- **Colours**: the brand colours fail as lines on the light surface, so each
  curve uses a darker step of its hue. `validate_palette.js` (dataviz skill)
  gave these results:

| Line | Light (`#fffdf5`) | Dark (`#12110c`) | Look |
|---|---|---|---|
| Training curve | `#8a6e00` (gold step of `#fbe122`) | `#a88e00` | 2 px solid |
| Team curve | `#1f6fb2` (blue step of `#8cc4f0`) | `#4a94d2` | 2 px solid |
| US2 outdoor Training curve | `#7b4fa0` | `#a77fd0` | 2 px, dashed `6 3` |
| Threshold, 167 line | `on-surface-variant` | same token | 1 px, dashed `4 4`, value at its right end |
| US2 pace lines | `on-surface-variant` | same token | 1 px, dotted `1 3` |
| Grid | `outline-variant` | same token | 1 px |

- **What the validator showed**:
  - `#fbe122` reaches 1.3:1 and `#8cc4f0` 1.8:1 against the light surface.
  - All chosen colours pass lightness, chroma and 3:1 contrast in their mode.
  - Gold and lilac, which share the Training chart, are ΔE 22–25 apart, also for
    colour-blind vision.
  - The blue is never in the same chart as either, so the two charts don't need
    to be told apart by colour.
- **Tokens**: `--rp-line-training`, `--rp-line-team` and `--rp-line-outside`,
  defined in both schemes in `style.ts`. `design-tokens.test.ts` covers them.
- **The yellow stays as the accent**: the Training chart's card edge uses
  `--rp-coin-yellow` and the Team chart's `--rp-coin-team`, like the gauge cards.
  Each legend entry carries a mini coin, as the gauges do (012).
- **Telling lines apart**: line style plus a legend with a line key per line.
  Colour is never the only cue (FR-050). There are no fills or areas (FR-007).
- **Text**: labels use the text tokens, never the series colour (dataviz).

## R13. Testing (Principle V, FR-080)

**Decision**: written test-first.

**`test/unit/curve.test.ts`** (`riderCurve`):
- the example rider day by day (21, 30, 69, 80, 112; 1, 11, 16, 17);
- the 20 September elevation step;
- the floor of 0;
- a correction on its date;
- future-dated items placed on the last day;
- the deadline passed;
- the without-virtual sum;
- for every reference rider, equal to `riderWeeks` at every week end and to the
  balance on the last day (SC-002, FR-012).

**`test/unit/progress-view.test.ts`**:
- the presets: when each is offered, and their bounds;
- `yMax`;
- the date labels of R10;
- the weekly rows;
- the pace values (27 and 2 on 4 October);
- the even pace equal to `evenPace` on every day;
- an unknown rules version leaves the section out.

**`test/unit/progress-section.test.ts`**:
- the markup, legends, `aria` attributes and templates;
- the JSON holds only dates and numbers;
- no unit, metre, km, time or speed appears in the markup or the data (SC-004).

**`test/integration/overview-progress.test.ts`** (`/me` with seeded synthetic
riders):
- only the signed-in rider's data (SC-007);
- the waiting state shows no section;
- `?period=4w`;
- German and English;
- the tour's example rider (FR-043);
- no writes, no queue messages and no Strava calls (SC-006).

**`e2e/progress.e2e.ts`** (Chromium, Firefox, WebKit, on fake mode's samples):
- no sideways scroll at 320 and 360 px;
- the period buttons work with and without JavaScript;
- drag-to-zoom gives both charts the same period;
- keys step the readout;
- the wheel only zooms after focus;
- the labels after a reset equal the server's;
- dark mode;
- no console error.

Real-device checks (pinch on a phone, a screen reader) are part of the walkthrough
after release (memory "manual tests after deploy"), not tasks.

The existing `catalogs.test.ts` and `no-hardcoded-copy.test.ts` cover the new keys.

## R14. Performance (SC-005)

**Decision**: no cache.

| Step | Size | Estimate |
|---|---|---|
| Two extra SELECTs | ≤ 600 day rows, ≤ 50 corrections | < 5 ms |
| Rebuild | ≤ 300 days × (≤ 100 events + corrections) | < 5 ms |
| Markup | 2 polylines of ≤ 300 points | about 8 KB |
| JSON data | 2–3 arrays of ≤ 300 integers | about 4 KB |

Zooming changes two `viewBox` attributes and about 10 labels, well under 16 ms.
The Overview stays within 005 SC-005's 2 seconds.
