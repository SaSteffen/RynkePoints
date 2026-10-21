# Research: Rider Progress Charts

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-10-19
(re-planned; the first plan of 2026-10-07 was never built)

Each section records a decision, why it was taken, and what else was considered.
Since the first plan, features 011–020 were built. The ones this plan builds on:
- the Overview at `src/http/sections/overview.ts` (011, 015);
- `src/rynke/weeks.ts`: the weekly and daily figures of 016 and 013;
- `src/rynke/pace.ts`: the even pace (016);
- `src/http/charts.ts`: small inline-SVG charts without a library (016), which
  stay as they are;
- corrections (014);
- the tour's example rider (020);
- `public/app.js` as the one page script (010 R16);
- Playwright smoke tests in three browsers.

Since constitution v2.2.0 the app requires JavaScript: the charts need no version
for a browser without scripts (spec FR-052, removed).

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

## R4. A charting library: Chart.js with its zoom plugin (Principle IV)

**What the charts need**:
- two charts, at most four lines each, at most about 300 points per line;
- zoom by pinch, mouse drag, focused wheel and keys, plus move and reset (FR-022,
  FR-023, FR-053);
- both charts always on the same period (FR-021);
- one readout of a day's totals (FR-030);
- a time axis labelled in the page language (FR-024, FR-061);
- light and dark mode (FR-072);
- touch: a vertical swipe scrolls the page (FR-025).

**Decision**: [Chart.js](https://www.chartjs.org/) 4 with
[chartjs-plugin-zoom](https://www.chartjs.org/chartjs-plugin-zoom/) 2. Both are
MIT licensed and ship ready-made minified browser builds, so there is still no
build step for browser code (R6). The plugin's own pinch and touch pan need
[Hammer.js](https://hammerjs.github.io/), which is not loaded: the two gestures
are done with the browser's Pointer Events instead (below, R7).

| File | Version | Minified | gzip |
|---|---|---|---|
| `chart.umd.min.js` | 4.5.1 | 204 KB | 69 KB |
| `chartjs-plugin-zoom.min.js` | 2.2.0 | 15 KB | 6 KB |
| **Together** | | 219 KB | 75 KB |

Measured 2026-10-19 from the npm packages. They are loaded only on the Overview and
then come from the browser cache (R6).

**Justification (Principle IV)**:
- The hard part of interactive charts is input handling: pinch on iOS Safari,
  telling a scroll from a pan, wheel handling, resize, high-density screens.
  These libraries have years of fixes for exactly that. The hand-rolled `viewBox`
  plan of this morning was only cheaper because it also had to render without
  JavaScript, and that requirement is gone (constitution v2.2.0).
- The zoom plugin covers most of FR-022/FR-023 out of the box: mouse drag to a
  stretch, wheel, limits (`min`, `max`, `minRange` = 7 days) and reset, with an
  API (`zoom`, `pan`, `zoomScale`, `resetZoom`) for the gestures, keys and
  buttons.
- Chart.js covers the rest: a linear x axis of day indexes with our own tick list
  and labels (R10), hover and tap picking the nearest day (`interaction.mode:
  "index"`, `intersect: false`), fixed y scales, high-density
  canvases and resizing.
- Cost: 75 KB gzip once per device, nothing in the Worker bundle, no change to
  the free tier.

**Why not Hammer.js**: the plugin would use it for pinch and touch pan, but
Hammer has had no release since 2016, and it was written for browsers without
Pointer Events. Every browser the app supports (011 FR-005) has them now. The
plugin checks for `window.Hammer` and simply skips its own gestures without it;
wheel, drag-zoom and the API keep working. Our two gestures are about 50 lines on
`pointerdown`/`pointermove`/`pointerup` calling the plugin's `zoom` and `pan`
(R7). That is 7 KB less and one unmaintained dependency fewer, and Hammer's
`touch-action: none` on the canvas, which would have needed an override, never
happens.

**What we still write** (in `app.js`, R7): pinch and sideways drag on Pointer
Events, the keys, the move and reset buttons, keeping both charts on one period,
the readout, the crosshair (a 15-line inline plugin) and the colours from the CSS
tokens.

**Known weak spots**, each covered by a test or a rule:
- The gesture code is ours. It only turns pointer positions into a zoom factor
  or a pan distance; the plugin applies them within its limits. e2e tests drive
  it with synthetic touch pointer events in all three browsers (R13); a real
  pinch on a phone is part of the device check after release.
- A canvas has no text for screen readers. Each canvas is `role="img"` with an
  `aria-label` of the period, and the readout and weekly table carry the figures
  (FR-050, R9, R11).

| Option | Why not |
|---|---|
| Hand-rolled SVG with `viewBox` zoom (this morning's plan) | Every gesture, the wheel and resizing are ours to get right in three browsers, for a nice graph that is not the app's main feature. |
| uPlot (~50 KB) | Smaller and faster, but no zoom limits, drag-zoom or wheel zoom built in; we would write more than the two gestures. |
| Apache ECharts (~330 KB gzip full, less with a custom build) | The richest zoom, but four times the size, or a build step for a custom bundle. |
| D3 (scale, shape, zoom) | Needs a bundler for the browser and leaves the chart itself to us. |
| ApexCharts (~140 KB gzip) | Larger, with more features we don't need; its zoom is less configurable for touch. |

## R5. Drawing (FR-010, FR-013, FR-014, FR-070)

**Decision**:
- **Canvas**: each chart is a `<canvas>` in a box of fixed height, `11rem` and
  `13rem` from 600 px up (the Overview's breakpoint). Chart.js fills the box's
  width (`responsive: true`, `maintainAspectRatio: false`).
- **x axis**: `type: "linear"`, one unit per day, `min: 0`, `max: axisDays`
  (season start = 0, deadline = `axisDays`). Day indexes avoid a date adapter
  library; the labels come from R10.
- **y axis**: `min: 0`, `max: yMax`. `yMax` is the larger of the threshold and the
  season's highest value, rounded up to a step of 50 for Training and 5 for Team.
  It is fixed for the season, so zooming never moves the threshold out of view or
  makes the scale jump (FR-014). Zoom and pan act on x only (`mode: "x"`).
- **Lines** (datasets, `pointRadius: 0`, `tension: 0`):
  - the curve, from day 0 to `lastIndex`, and it stops there (FR-013). Team's is
    `stepped: "before"`, so a day's Rynke rise straight up on that day instead
    of sloping in from the day before; Training's (and the outside curve) use
    `cubicInterpolationMode: "monotone"`, a smooth rise that never dips or
    overshoots the total;
  - the threshold, two points across the axis; its value is in the HTML legend
    ("Ziel (250)"), not drawn on the canvas, so the canvas holds no text;
  - from US2, the pace line from (0, 0) to (`axisDays`, threshold).
- **Legend**: Chart.js's legend is off; the server renders an HTML legend with a
  line key per line (R12), so it uses the catalogs and the app's type.
- **Built-in tooltip**: off. The readout under the charts replaces it (R9); a
  floating box would cover the curve on a 360 px screen.

## R6. Browser code and how the library is delivered (010 R16)

**Decision**:
- **Our code** is a `progressCharts()` function in `public/app.js`, called with
  the others at the end. It follows the file's rules:
  - it holds no text: every word comes from the markup, rendered from the
    catalogs (R9);
  - it makes no request and writes no storage or cookie.
- **The library files** are vendored, not built:
  - `chart.js` and `chartjs-plugin-zoom` become exact-pinned `devDependencies`,
    so the versions are visible and Dependabot sees them. (`hammerjs` comes along
    as the plugin's dependency in `node_modules`; it is not copied or loaded.)
  - `scripts/vendor.mjs` (`pnpm vendor`) copies the two minified files into
    `public/vendor/`, with the version in the file name (for example
    `public/vendor/chart-4.5.1.umd.min.js`), plus each package's `LICENSE`.
  - The copies are committed, so deploying needs no build step.
  - `pnpm vendor --check` fails when the copies differ from `node_modules`; it
    runs as part of `pnpm lint`, so CI catches a version bump without a copy.
  - Biome ignores `public/vendor/`.
- **Loading**: `LayoutOptions` gains `scripts?: string[]`. The Overview passes the
  two vendor paths when it renders the section. They are emitted as `<script
  src defer>` before `app.js`, so they run in order: Chart.js, the plugin, then
  `app.js`. No other page loads them.
- **Caching**: `public/_headers` gives `/vendor/*` `Cache-Control: public,
  max-age=31536000, immutable`. The versioned file names make that safe. The
  service worker only handles navigations and needs no change.
- **Data**: one `<script type="application/json" id="progress-data">` in the
  section, with only dates, day indexes and whole numbers (data-model.md "Chart
  data").
- **Formatting**: numbers and dates use `Intl` with the locale in the section's
  `data-locale` (the server's `meta.intlLocale`), with the same options as
  `I18n.formatNumber` and `I18n.formatDate` (FR-061).
- **If the library fails to load** (an old cached page, a network error): the
  script finds no `window.Chart`, leaves the canvases empty and logs one error. The
  table still has the figures. This is a failure, not a supported mode.

**Rationale**:
- Copying ready-made builds keeps the "no bundler for browser code" setup.
- Loading the files only on the Overview keeps every other page as light as now.

**Alternatives considered**:
- *An esbuild step bundling `app.js` with tree-shaken Chart.js*: about 30 KB less,
  but a build step in dev, CI and deploy for every page's script.
- *A CDN*: a third party would learn who opens the Overview (Principle I), and
  the app would depend on it.
- *Loading the files from `app.js` on demand*: same bytes, but the ordering and
  error handling become our code instead of the browser's.

## R7. Interaction (FR-021–FR-025, FR-030, FR-053, FR-071)

**Decision**:

| Input | Action | Done by |
|---|---|---|
| Mouse moving over a chart | crosshair and readout on the nearest day | Chart.js hover (`mode: "index"`, `intersect: false`) |
| Tap or click | select that day in both charts; readout | Chart.js events + `setActiveElements` on the other chart |
| Mouse drag across a chart | shade the stretch; on release, zoom to it | plugin `zoom.drag` (`mode: "x"`, `threshold: 8`) |
| Shift + mouse drag | move the period | our pointer handler calling `chart.pan`; `pan: { enabled: true, modifierKey: "shift" }` makes the plugin's drag-zoom ignore a shift-drag |
| Two-finger pinch | zoom around the fingers | our pointer handler: `chart.zoom({ x: d / d0, focalPoint })` with the fingers' distance and midpoint |
| One-finger sideways drag | move the period | our pointer handler: `chart.pan({ x: dx })` once the finger has moved 8 px |
| Vertical swipe | scrolls the page | `touch-action: pan-y` on the canvas in the stylesheet: the browser scrolls and sends `pointercancel` (FR-025) |
| Wheel over a chart that has focus (after a click or Tab) | zoom around the pointer; without focus the page scrolls | plugin `zoom.wheel` + `onZoomStart` returning `false` for a wheel on an unfocused canvas, so the plugin neither zooms nor calls `preventDefault` |
| Keys on a focused chart | ←/→ previous/next day · `+`/`-` zoom around the selected day · PageUp/PageDown move by half the period · Home/End first/last day · `0` or Escape whole season | our `keydown` handler calling `zoom`, `pan`, `resetZoom` |
| Period buttons | `zoomScale("x", { min: from, max: to })` on both charts | our handler; `data-from`/`data-to` from the server (R8) |

Rules that apply to every input:
- **Pointer gestures**: `pointerdown` records the pointer (for the mouse only with
  Shift and the main button) and captures it; `pointermove` with one pointer pans
  by the change in x, with two zooms by the change in their distance;
  `pointerup` and `pointercancel` forget it, and when the last one is gone the
  period is applied. `pinch.enabled` stays `false` in the plugin options, and
  `window.Hammer` is never loaded.
- **One period for both charts** (FR-021): the plugin's `onZoomComplete` of either
  chart, and the end of a pointer gesture, call one `applyPeriod(from, to)`, which
  sets the
  other chart with `zoomScale(…, "none")` and updates the buttons and labels. A
  guard flag stops the two charts from echoing each other.
- **Limits** (FR-022, FR-023): `limits.x = { min: 0, max: axisDays, minRange: 7 }`
  in the plugin, so no input goes past the axis or below 7 days.
- **After a change**: `aria-pressed` on the period button whose stretch is shown
  (none while zoomed freely); each canvas's `aria-label` from its label template
  (R9).
- **Selecting**: days after `lastIndex` can't be selected; the selection snaps to
  the last day. The keys move the same active index the pointer sets.
- **Focus**: each canvas has `tabindex="0"`, rendered by the server, with
  `aria-describedby="progress-help"`.
- **Animations**: off (`animation: false`), and so no motion for riders who
  prefer reduced motion.

**Rationale**:
- Requiring focus for the wheel keeps page scrolling free, the most common
  complaint about zoomable charts.
- On touch, a sideways drag moves and a pinch zooms, as in map apps. A mouse drag selects a stretch, the usual desktop
  gesture. The spec's FR-022/FR-023 are worded to match.

## R8. Period presets in the markup, not in the URL (FR-020, FR-026)

**Decision**:
- The period buttons are `<button type="button">` with `data-from`/`data-to` (day
  indexes) worked out by the server, so the browser does no calendar arithmetic.
- `/me` gets no `period` parameter. Each Overview load starts with the whole
  season (FR-026); nothing goes into the URL, storage or a cookie.
- **"Last 4 weeks"** is the 28 days ending on the last day: 10 September – 7
  October in US1 scenario 3.
- **"Last 3 months"** starts on the same day of the month three calendar months
  back, plus one day.
- Either is offered only once it starts after the season start (FR-020). "Last 3
  months" is therefore offered from 1 December 2026: on that day it covers 2
  September – 1 December.

**Alternatives considered**:
- *`?period=3m|4w` links* (this morning's plan): only needed for a browser
  without scripts.
- *Free zoom in the URL with `replaceState`* (the first plan): only needed to keep
  the period across the language switch, which no longer happens on the
  Overview.

## R9. Totals of a day: one readout under the charts (FR-030, FR-038, FR-050)

**Decision**:
- One `<p class="progress-readout" aria-live="polite">` under both charts gives the
  selected day's date and totals. Values lead and labels follow (dataviz).
  Example: "Sonntag, 20. September 2026 · 69 Trainingsrynke · 11 Teamrynke".
  Before any selection it shows the last day.
- From US2 the readout also gives:
  - the pace and how far ahead or behind it the rider is, for each line;
  - the outdoor Training Rynke.
- **Templates**: the server renders each readout part once from the catalogs into
  `<template>` elements. Each placeholder is a
  `<span data-slot="training"></span>`, made with `i18n.tHtml`, so the word order
  stays the language's. The same is done for each canvas's `aria-label`
  (`data-label-template`).
- The script clones the template and fills the slots with `textContent`.
- **Ahead, behind and on pace** are three templates. The script picks one by the
  sign; it never words them itself. Being behind reads as a number, not a broken
  rule (FR-038).
- **The crosshair**: a small inline Chart.js plugin draws a 1 px vertical
  hairline at the active day; Chart.js draws an 8 px point with a 2 px surface
  ring on each curve (`pointHoverRadius`, `pointHoverBorderWidth`; dataviz).

**Rationale**:
- One readout for both charts matches D3/D4.
- It never covers a curve on a 360 px screen, unlike a floating tooltip.
- Screen readers announce it (FR-050, US1 scenario 17).

## R10. Date labels: one rule, in the browser (FR-024, FR-061)

**Decision**: the visible span picks the labels.

| Visible span | Labels | Format |
|---|---|---|
| more than 62 days | the first of each month | `Intl` `{ month: "short" }` |
| 15–62 days | each Monday | `{ day: "numeric", month: "short" }` |
| 7–14 days | every second day from the period's first | `{ day: "numeric", month: "short" }` |

The x axis's `afterBuildTicks` replaces Chart.js's ticks with these day indexes,
and `ticks.callback` formats them in the section's locale. `ticks.autoSkip` drops
labels that would overlap on a narrow screen.

**Rationale**: the server no longer draws the charts, so the rule exists once.
The old plan's second copy in TypeScript, and the e2e test keeping both in step,
are gone.

## R11. The weekly table (FR-037, FR-051)

**Decision**:
- **Rows**: one per entry of `weekEnds(seasonStart, lastDay)`, oldest first, each
  labelled with its first day (`formatDate`).
- **Columns**: Training earned, Training total, Team earned, Team total. From
  US2, plus outdoor Training earned and total.
- **Figures**: "earned" is the total at the week's end minus the total at the
  previous week's end, so a negative correction shows as a negative number.
- **Placement**: in a `<details>`, closed by default, under the readout. It covers
  the whole season, whatever the period. It is the text version of the charts for
  screen readers (FR-050), rendered by the server.
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
| Training curve | `#8a6e00` (gold step of `#fbe122`) | `#a88e00` | 3 px solid |
| Team curve | `#1f6fb2` (blue step of `#8cc4f0`) | `#4a94d2` | 3 px solid |
| US2 outdoor Training curve | `#7b4fa0` | `#a77fd0` | 3 px solid |
| Threshold | `#a6344f` | `#d64651` | 1.5 px solid, value at its right end |
| US2 167 line | the outdoor curve's colour | same | 1.5 px solid |
| US2 pace lines | `#2b9667` | `#24a684` | 1.5 px solid |
| Grid | `outline-variant` | same token | 1 px |
| Axis labels | `on-surface-variant` | same token | the app's label type |

- **What the validator showed**:
  - `#fbe122` reaches 1.3:1 and `#8cc4f0` 1.8:1 against the light surface.
  - All chosen colours pass lightness, chroma and 3:1 contrast in their mode.
  - Gold and lilac, which share the Training chart, are ΔE 22–25 apart, also for
    colour-blind vision.
  - The blue is never in the same chart as either, so the two charts don't need
    to be told apart by colour.
- **No dashes or dots** (maintainer, 2026-10-19): they were hard to make out, so
  every line is solid and told apart by colour and width.
- **Tokens**: `--rp-line-training`, `--rp-line-team`, `--rp-line-outside`,
  `--rp-line-threshold` and `--rp-line-pace`,
  defined in both schemes in `style.ts`. `design-tokens.test.ts` covers them.
- **Canvas colours**: a canvas can't use CSS variables, so the script reads the
  tokens with `getComputedStyle` when it creates the charts, and again (then
  `chart.update("none")`) when the scheme changes: a `prefers-color-scheme`
  change, or `data-scheme` on `<html>` (observed with a `MutationObserver`).
  Fonts come from the section's computed `font-family`.
- **The yellow stays as the accent**: the Training chart's card edge uses
  `--rp-coin-yellow` and the Team chart's `--rp-coin-team`, like the gauge cards.
  Each legend entry carries a mini coin, as the gauges do (012).
- **Telling lines apart**: line style plus the HTML legend with a line key per
  line. Colour is never the only cue (FR-050). There are no fills or areas
  (FR-007).
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
- the weekly rows;
- the pace values (27 and 2 on 4 October);
- the even pace equal to `evenPace` on every day;
- an unknown rules version leaves the section out.

**`test/unit/progress-section.test.ts`**:
- the markup, legends, `aria` attributes and templates;
- the JSON holds only dates and numbers;
- no unit, metre, km, time or speed appears in the markup or the data (SC-004).

**`test/unit/html.test.ts`** (extended): `scripts` are emitted in order before
`app.js`, and pages without them are unchanged.

**`test/integration/overview-progress.test.ts`** (`/me` with seeded synthetic
riders):
- only the signed-in rider's data (SC-007);
- the waiting state shows no section and loads no vendor script;
- German and English;
- the tour's example rider (FR-043);
- no writes, no queue messages and no Strava calls (SC-006).

**`e2e/progress.e2e.ts`** (Chromium, Firefox, WebKit, on fake mode's samples):
- no sideways scroll at 320 and 360 px;
- the period buttons set both charts to the same stretch, without a reload;
- a mouse drag zooms both charts to the same period, and never below 7 days;
- the keys step the readout and zoom;
- the wheel only zooms after focus, and scrolls the page before;
- each canvas has `touch-action: pan-y`;
- synthetic touch pointer events: two pointers moving apart zoom both charts in,
  one pointer moving sideways moves both, and a vertical move changes neither;
- `window.Hammer` is undefined;
- the readout for 20 September of a sample rider equals the table's figures;
- dark mode: the line colour is read from the dark tokens;
- no console error, and the vendor files are served with the immutable header.

Chart.js draws on a canvas, so the e2e tests check state through the charts'
public API (`Chart.getChart(canvas).scales.x.min/max`) and the DOM, not pixels.

Real-device checks (pinch and swipe on a phone, a screen reader) are part of the
walkthrough after release (memory "manual tests after deploy"), not tasks.

The existing `catalogs.test.ts` and `no-hardcoded-copy.test.ts` cover the new keys.

## R14. Performance (SC-005)

**Decision**: no cache on the server.

| Step | Size | Estimate |
|---|---|---|
| Two extra SELECTs | ≤ 600 day rows, ≤ 50 corrections | < 5 ms |
| Rebuild | ≤ 300 days × (≤ 100 events + corrections) | < 5 ms |
| JSON data | 2–3 arrays of ≤ 300 integers | about 4 KB |
| Vendor scripts | first visit only, then cached | 75 KB gzip |

Chart.js draws 2 charts of ≤ 300 points each in a few milliseconds, and zooming
redraws without animation. The Overview stays within 005 SC-005's 2 seconds.
