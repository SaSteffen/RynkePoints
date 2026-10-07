# Research: Rider Progress Charts

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-10-07

Each section records a decision, why it was taken, and what else was considered.
"003" and "005" are the earlier features whose code this one reads and extends.

## R1. Rebuild the curve when the page is shown, with the evaluation's own functions (FR-011, FR-012)

**Decision**:
- The curve is rebuilt on every view of `/me` from what 003 stores: the counting
  ride results (distance Rynke, elevation decimetres, virtual flag), each ride's
  local start date, and the rider's attendance. Nothing new is stored.
- The rebuild reuses 003's pure functions instead of repeating their arithmetic.
  `rides.ts` exports the summing that `evaluateRides` already does, as
  `ridingTotals(results, rules)` (elevation floored once on the total, FR-004a;
  the same sums without virtual rides, FR-013a). For each day, the new pure
  `rynke/curve.ts` takes the results and the attendance dated up to that day and
  calls `ridingTotals`, `evaluateAttendance` and `tally`. The value of the day is
  the `tally` balance's `trainingRynke`, `teamRynke` and `trainingWithoutVirtual`,
  floor of 0 included.
- It uses the stored results, not a fresh `evaluateRides` over the activities:
  whether a ride counts (window, overlaps, speed limits) was decided by the
  evaluation and stored with the balance, and the page must show that decision
  (FR-041).

**Rationale**:
- By construction, the curve's last day gives the stored balance: the same
  results, the same attendance and the same functions as the evaluation (FR-011,
  SC-002).
- A rule change rewrites the stored results, so the curve follows with no
  migration and no invalidation (FR-040).
- The cost is small. A season has at most about 400 days and 500 rides (001
  SC-008), so a day-by-day prefix sum is at most about 200,000 additions, a few
  milliseconds in the Worker. The extra read is one `SELECT` of four columns
  (data-model.md).

**Alternatives considered**:
- *Store the curve with the balance* (the other option FR-012 allows): this needs
  a migration (a JSON column or a table of day rows), every evaluation writes it,
  and a stale curve would be a new way to disagree with the balance. It gains a
  few milliseconds per view.
- *Re-run `evaluateRides` over the activities for each day*: this re-decides
  counting and overlaps, reads all activity figures, and could differ from the
  stored results if code changed without a rules version bump.
- *A separate incremental sum in the curve module*: faster, but it is the second
  copy of the elevation and team-event rules that FR-012 forbids.

## R2. Which day a Rynke belongs to (FR-011, FR-013)

**Decision**:
- A ride belongs to the date of its `start_date_local` (as in 003 FR-011). A team
  event belongs to its `event_date`.
- The **last day** is today in Europe/Berlin (`berlinDate(ctx.now())`), or the
  deadline once it has passed. It is never before the season start.
- Anything dated after the last day is placed on the last day. Two cases make
  this possible: an organiser records attendance for an event dated in the
  future, which 003 FR-002 counts at once; and a ride started in a time zone
  ahead of Berlin. With this rule the last point is the stored balance.
- Nothing is dated before the season start: such rides and events are outside the
  counting window, earn nothing and so add nothing to the curve.

**Rationale**: FR-011 requires the last point to equal the balance (and US1
scenario 5 checks it). Leaving future-dated items out would make the curve end
below the gauges.

**Alternatives considered**: extending the curve into the future (this goes
against FR-013, which ends the curves today); leaving future items out (the last
point would then differ from the gauges).

## R3. Rules version unknown, and a last point that disagrees

**Decision**:
- **Unknown version** (005 FR-013: the balance records a version this code
  doesn't know, which only happens after a rollback because `RULES_HISTORY` keeps
  every version): the section is left out. The page's existing notices apply. The
  curve needs that version's elevation step and team-event amounts, so it cannot
  be rebuilt.
- **Disagreement**: if the rebuilt last day differs from the stored balance, the
  section is left out and `console.error("Progress curve disagrees with the
  stored balance")` is logged without the athlete ID. This cannot happen with
  consistent data: results, attendance and balance are written in one batch (003
  research R21). The check is cheap and keeps a bug from showing two different
  totals on one page.

**Rationale**: the curves cannot be computed without the version's rules.
Leaving them out, as 005 leaves out the gauges, is the only honest choice.

The spec says the same (FR-040 and its edge case "Rules version of the stored
balance unknown to the app").

## R4. No charting library: inline SVG plus a small script of our own (FR-052, Principle IV)

**Decision**: the server renders each chart as inline SVG, so the page shows the
charts without any script. A small vanilla ES module, served as a static asset,
adds zoom, moving the period and the totals of a day. There is no runtime
dependency and no build step.

**Rationale**:
- The charts are simple: two charts, at most four lines each (curve, threshold,
  pace, without virtual rides), about 400 points.
- FR-052 requires the charts and period buttons to work without the script. That
  needs server-rendered markup anyway, and most libraries draw only in the
  browser.
- Principle IV: a library needs a justification, and none is needed for this.
- An estimated 6–8 KB of our own code, against 45–200 KB for a library.

**Alternatives considered**:

| Library | Why not |
|---|---|
| uPlot (~50 KB, canvas) | Canvas: no server rendering, no no-script fallback, no text in the drawing. It would also need a bundling step for the browser. |
| Chart.js (~200 KB, canvas) | As uPlot, and about four times larger. |
| Apache ECharts | Very large. Its server-side SVG rendering would need a Node-style build in the Worker. |
| D3 modules (scale, shape, zoom) | About 30 KB and SVG, but we would still write all the markup, and it needs a bundler. |
| Mermaid `xychart` | For documents, not interactive charts. |

## R5. Drawing that doesn't depend on screen width (FR-070, SC-008)

**Decision**:
- Each chart's plot is an `<svg viewBox="0 0 1000 100" preserveAspectRatio="none">`.
  It is stretched to the chart's width and height by CSS: `100%` wide, `10rem`
  high, `12rem` from 36rem up.
- Lines use `vector-effect="non-scaling-stroke"`, so they keep their thickness.
- Axis labels, the threshold label and the legend are HTML around the SVG, placed
  with percentage offsets (`style="left:37.5%"`). Text is therefore never
  stretched and stays readable at 360 px.
- x: day index of the period → 0…1000. y: 0…yMax → 100…0. yMax is the larger of
  the threshold and the highest value of the whole season, rounded up to a nice
  step (FR-014). It is fixed for the season and doesn't change with zoom, so the
  threshold stays in view and the scale doesn't jump.

**Rationale**: the server never knows the width of the screen. With this
approach, the server and the browser produce the same markup for the same
period, and nothing has to be redrawn on resize.

**Alternatives considered**:
- *A fixed `viewBox` with scaled text*: at 360 px, 12 px labels shrink to about
  7 px.
- *Measuring in the browser and redrawing*: the version without the script would
  then have no good layout.

## R6. One drawing module for server and browser

**Decision**:
- `public/progress/chart.js` is a plain ES module with JSDoc types. It has no DOM,
  no I/O and no text of its own. It turns chart data, a period and the
  pre-formatted labels into markup strings (SVG path, ticks, marker), and it
  holds the period arithmetic (zoom, move, clamp to 7 days and to the axis,
  nearest day, keyboard and gesture → action).
- `src/http/progress-section.ts` imports it, and Wrangler's bundler includes it in
  the Worker. `public/progress/progress.js`, the browser glue, imports it as
  `./chart.js`.
- Type checking: `tsconfig.json` gains `allowJs`, `checkJs` and includes
  `public/progress/chart.js`. `public/progress/tsconfig.json` (lib `dom`) checks
  the glue. `pnpm typecheck` runs both. `public/.assetsignore` excludes the
  tsconfig from the public site.
- Biome lints both files as it lints `src/`.
- Unit tests import `chart.js` directly (R13).

**Rationale**: one implementation of the drawing and the period rules means the
page without a script and the page with it cannot drift apart. It is also
testable in workerd, because it has no DOM. No build step is added.

**Alternatives considered**:
- *TypeScript in `src/` with an esbuild step that writes into `public/`*: this
  adds a build artefact to keep in sync, plus a CI step.
- *Two renderers* (TS on the server, JS in the browser): duplicated logic that
  could diverge.
- *Serving the script from a Worker route as a string*: still needs compiled JS,
  and static assets are cheaper and cached.

**Risk**: TypeScript 7's JSDoc checking is a little less complete than for `.ts`
files. If a type can't be expressed, `chart.js` keeps a `// @ts-expect-error`
with a reason, not `any`.

## R7. Interaction model (FR-022–FR-025, FR-053, FR-071)

**Decision**:

| Input | Action |
|---|---|
| Tap, or click without moving more than 8 px | select that day: a marker in both charts and the readout (R9) |
| Pointer moving over a chart (mouse) | select the day under it |
| Horizontal drag, one finger or the mouse | select a stretch; on release, zoom to it (at least 7 days) |
| Two-finger pinch | zoom around the midpoint between the fingers |
| Vertical swipe | scrolls the page: the chart has `touch-action: pan-y`, so the browser keeps vertical panning (FR-025) |
| Mouse wheel over a chart that has focus (after a click or Tab) | zoom around the pointer; without focus the page scrolls |
| Keys on a focused chart | ←/→ previous/next day · `+`/`-` zoom in/out around the selected day · PageUp/PageDown move the period by half its length · Home/End first/last day · `0` or Escape reset |
| Buttons "Earlier", "Later", "Reset" | move by half the period; reset to the whole season. Shown only while zoomed in and only with the script. 44 × 44 px. |

- Both charts share one state object, so they always show the same period
  (FR-021).
- The period is clamped to at least 7 days and to the time axis (FR-022,
  FR-023).
- Redrawing is throttled with `requestAnimationFrame`.

**Rationale**:
- Requiring focus for the wheel avoids taking over page scrolling when a rider
  scrolls past the charts, which is the most common complaint about zoomable
  charts.
- Moving by buttons and keys rather than by dragging keeps drag free for
  selecting a stretch, and avoids a gesture conflict on phones.

**Alternatives considered**:
- *Wheel always zooms*: the page gets stuck under the pointer.
- *Drag pans*: then zooming needs either pinch only (none on a desktop) or a
  separate mode.

## R8. The period in the URL (FR-020, FR-026, FR-052)

**Decision**:
- `/me` accepts `period=3m` or `period=4w`, or `from=YYYY-MM-DD&to=YYYY-MM-DD`,
  next to `page`. Anything invalid, or missing, means the whole season. The
  server clamps the dates to the axis and to at least 7 days.
- The period buttons are links (`/me?period=4w#progress`), so they work without
  the script. With the script they are intercepted: the charts redraw in place,
  and `history.replaceState` writes the new query.
- After every change the script also writes the query into the language form's
  `next` field. `safeNext` accepts `/me` with the parameters `page`, `period`,
  `from`, `to` in a fixed order, each validated, so a language switch keeps the
  period (FR-026). Pager links keep the period, and period links keep the page.
- **Last 4 weeks** is the 28 days ending on the last day (10 September – 7
  October in US1 scenario 3). **Last 3 months** starts on the same day number
  three calendar months back, plus one day. Either is offered only if it is
  shorter than the axis (FR-020).

**Rationale**: without the script the URL is the only state there is. With it,
the same URL keeps reloads and language switches consistent. Using no cookie and
no storage follows Principle I.

**Alternatives considered**:
- *`sessionStorage`*: lost on the language switch's server redirect, and it
  doesn't work without the script.
- *A cookie*: state on the server for a view setting, which `Vary` handling
  would have to cover.

## R9. Totals of a day: one readout under the charts (FR-030)

**Decision**:
- One `<p id="progress-readout" aria-live="polite">` under both charts shows the
  selected day, for example "Sonntag, 20.09.2026: 69 Trainingsrynke, 11 Teamrynke".
- From US2, the pace and the virtual-ride figure join it.
- Both charts draw a vertical marker on that day.
- Without the script the readout is hidden and the table carries the figures.
- The text comes from catalog templates passed in the chart data (R10); the
  script only fills `{placeholders}` and formats with
  `Intl.*Format(intlLocale)`.

**Rationale**: one readout for both charts matches D3/D4 ("date and totals of the
tapped day"). It avoids a tooltip covering the curve on a 360 px screen, and it
is announced to screen readers (FR-050, US1 scenario 17).

**Alternatives considered**:
- *A floating tooltip*: it covers the line on phones and is hard to make
  accessible.
- *`<title>` per point*: 400 elements, and it does nothing on touch.

## R10. Chart data in the page, and text only from catalogs (FR-050, FR-060, FR-061)

**Decision**: the section carries `<script type="application/json"
id="progress-data">`. It holds:
- the daily series;
- the axis;
- the rule values for the lines;
- `intlLocale`;
- the already-translated templates and labels.

`<` is escaped as `<` in the JSON. The script reads the data once and
contains no rider-facing text. Month and day labels come from
`Intl.DateTimeFormat(intlLocale)`, the same `meta.intlLocale` as the server.

**Rationale**: the catalogs stay the only source of text, as CLAUDE.md requires
(FR-028 of 001). The language switch reloads the page, so the new language comes
with the new data.

## R11. The table is derived from the curve (FR-037, FR-051)

**Decision**:
- Weeks run Monday to Sunday by calendar date. The first week starts on the season
  start and the last ends on the last day.
- Per week: earned = total at the week's end − total at the previous week's end,
  for Training and Team (and Training without virtual rides with US2). The totals
  are those at the week's end. Rows are oldest first, as in the spec's example.
- The table is in `<details>`, closed by default, under the readout.
- It shows the whole season regardless of the period.

**Rationale**:
- Differences of the curve can never disagree with the curve.
- A week with a negative correction shows a negative number. That is honest, and
  it is not a bar.
- Dates are already Europe/Berlin calendar dates (R2), so no time-zone arithmetic
  is needed.

## R12. Lines and how they are told apart (FR-050, FR-072)

**Decision**:

| Line | Look |
|---|---|
| Curve | 2.5 px solid, `--rp-part-1` |
| Threshold | 1.5 px dashed (`6 4`), `#555`, labelled at its right end with its value |
| US2: pace | 1.5 px dotted (`2 3`), `#555` |
| US2: without virtual rides | 2 px dash-dot (`8 3 2 3`), `--rp-part-2` |
| US2: the 167 line | dashed like the threshold, labelled with its value |

- The legend shows each line's dash pattern and its name, so colour is never the
  only cue.
- Gridlines are light (`#eee`), and there are no fills or areas (FR-007).

**Rationale**: the look stays plain, and Material Design can later restyle the
colours and fonts without changing what is drawn (FR-072).

## R13. Testing (Principle V, FR-080)

**Decision**: written test-first.
- `test/unit/curve.test.ts`:
  - the example rider day by day (21, 30, 69, 80, 112; 1, 11, 16, 17);
  - the 20 September elevation step;
  - floor of 0;
  - future-dated items on the last day;
  - deadline passed;
  - a ride on the season start.
  - It also checks that `seasonCurve` and `ridingTotals` give the stored balance
    for each of 003's reference riders (SC-002), reusing
    `test/unit/reference-riders.test.ts`'s set.
- `test/unit/chart.test.ts` imports `public/progress/chart.js`:
  - path points;
  - yMax;
  - ticks (months or days);
  - zoom, move and clamp;
  - nearest day;
  - the keyboard map;
  - the gesture classification (tap / drag / vertical swipe).
- `test/unit/progress-view.test.ts`:
  - period parsing and offering;
  - the "last 4 weeks" and "last 3 months" bounds;
  - axis end with and without a deadline;
  - the 7-day minimum;
  - weekly rows;
  - unknown rules version;
  - the mismatch check.
- `test/integration/me-progress.test.ts`, on `/me` with seeded synthetic riders:
  - the section's markup and the JSON data;
  - only the signed-in rider's data (SC-007);
  - no km, m, time or speed in the section or in the JSON (SC-004, FR-005);
  - no ride names or links;
  - German and English;
  - no writes, queue messages or Strava calls (SC-006).
- `lang.test.ts`: `safeNext` with the period parameters.
- `catalogs.test.ts` and `no-hardcoded-copy.test.ts` cover the new keys.

The browser glue (`progress.js`) only connects DOM events to `chart.js`'s tested
functions. workerd has no DOM to test it in. The checks with a real browser
(pinch, wheel, screen reader) belong to the walk-through after release (memory
"manual tests after deploy"), not to tasks.

## R14. Performance (SC-005)

**Decision**: no cache.

| Step | Size | Estimated time |
|---|---|---|
| Extra read | ≤ 500 rows × 4 columns, in the existing batch | < 5 ms |
| Rebuild | ≤ 400 days × ≤ 500 results | < 5 ms |
| Markup | 2 SVG paths of ≤ 400 points (about 6 KB) | negligible |
| JSON data | about 8 KB | negligible |
| Script | about 8 KB, cached by the asset server | — |

A redraw on zoom builds two path strings and swaps them in, well under 16 ms
on a mid-range phone. The page stays within 005 SC-005's 2 seconds.
