---
description: "Task list for rider progress charts (re-planned 2026-10-19, Chart.js)"
---

# Tasks: Rider Progress Charts

**Input**: Design documents from `/specs/009-rider-progress-charts/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: REQUIRED (constitution Principle V, spec FR-080).
- Write each test task first, run it and confirm it fails, then implement.
- All riders, rides, events, corrections and names are synthetic.
- Expected figures are worked out by hand, never by running the code under test.

**Organization**: one phase per user story, in delivery order (plan "Delivery"):
- **US1** is built and tested first and works alone.
- **US2** builds on it. Both went into one PR (#173) at the maintainer's request
  (FR-004, revised 2026-10-19).
- **US3** (the diagrams) came with the spec. Its remaining part is the check
  against the build (FR-092), which is the last phase.

There are no tasks for manual checks after deployment: those happen on the live
site.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished
  task)
- **[Story]**: US1 (curves and zoom), US2 (pace and outdoor curve), US3 (diagrams)

## The example rider as test data

The test data uses:
- season start 2026-09-01 and deadline 2027-06-30 (`axisDays` 302);
- "today" 2026-10-07 (`lastIndex` 36);
- rules `CURRENT_RULES` (version 3).

Team-event amounts:
- team training: +5 Training, +1 Team;
- training-weekend day: +10 Training, +5 Team;
- technique training: +5 Training, +5 Team.

| Date | What | Training total | Team total |
|---|---|---|---|
| 2 Sep | team training | 5 | 1 |
| 3 Sep | ride 55 km, 600 m (5) | 10 | 1 |
| 5 Sep | ride 65 km, 500 m (6); elevation 1100 m → step (5) | 21 | 1 |
| 12 Sep | ride 95 km, 300 m (9) | 30 | 1 |
| 19 Sep | training-weekend day; ride 64 km, 300 m (6) | 46 | 6 |
| 20 Sep | training-weekend day; ride 80 km, 400 m (8); 2100 m → step (5) | 69 | 11 |
| 23 Sep | technique training | 74 | 16 |
| 26 Sep | ride 60 km, 200 m (6) | 80 | 16 |
| 30 Sep | team training | 85 | 17 |
| 3 Oct | ride 120 km, 800 m (12); 3100 m → step (5) | 102 | 17 |
| 4 Oct | correction +10 Training, reason "Synthetic lost ride" | 112 | 17 |

**Its stored balance**:
- `distanceRynke` 52, `elevationDm` 31000, `elevationRynke` 15,
  `elevationToNextStepDm` 9000;
- `trainingRynke` 112, `trainingMissing` 138;
- `teamRynke` 17, `teamMissing` 8;
- `trainingWithoutVirtual` 112, `virtualShareMissing` 55;
- `qualified` false.

**Weekly table**:

| Week from | Training earned | Training total | Team earned | Team total |
|---|---|---|---|---|
| 1 Sep | 21 | 21 | 1 | 1 |
| 7 Sep | 9 | 30 | 0 | 1 |
| 14 Sep | 39 | 69 | 10 | 11 |
| 21 Sep | 11 | 80 | 5 | 16 |
| 28 Sep | 32 | 112 | 1 | 17 |
| 5 Oct | 0 | 112 | 0 | 17 |

**Its curve**: the totals above on each listed day, flat in between, 0 on 1
September.

---

## Phase 1: Setup

**Purpose**: a green baseline, shared test data and the vendored chart library.

- [X] T001 In the worktree, run `pnpm install`, `pnpm lint`, `pnpm typecheck`,
  `pnpm test` and `pnpm test:e2e`, and confirm all pass before any change. Note
  any test that already fails in the PR description rather than fixing it here.
- [X] T002 [P] Create `test/support/progress.ts` with the example rider above:
  - `EXAMPLE_INPUTS: CurveInputs`, using the data-model.md shape (rides per day
    with `virtual: false`, attendance, one correction);
  - `EXAMPLE_BALANCE: Balance`;
  - `EXAMPLE_WINDOW = { seasonStart: "2026-09-01", deadline: "2027-06-30" }`;
  - `EXAMPLE_TODAY = "2026-10-07"`;
  - `seedExampleRider(ctx, athleteId)`, which stores the same data in D1
    (activities, counting `ride_results`, `team_events`, `attendances`, one
    `corrections` row and the `rynke_balances` row) using the helpers in
    `test/support/rynke.ts`. Add a raw correction insert helper there if none
    exists.
- [X] T003 [P] Move the reference rider set out of
  `test/unit/reference-riders.test.ts` into `test/support/reference-riders.ts`
  (export the riders, their window and their expected balances), and import it
  back. `test/unit/reference-riders.test.ts` must still pass unchanged in what it
  asserts.
- [X] T004 [P] Vendor the chart library (research R4, R6):
  - add `chart.js` 4.5.1, `chartjs-plugin-zoom` 2.2.0 as
    exact-pinned `devDependencies` in `package.json`;
  - write `scripts/vendor.mjs`: it copies `chart.js/dist/chart.umd.min.js`,
    `chartjs-plugin-zoom/dist/chartjs-plugin-zoom.min.js` into `public/vendor/` as
    `chart-<version>.umd.min.js` and `chartjs-plugin-zoom-<version>.min.js`
    (versions read from each package's
    `package.json`), plus each package's licence as `<name>-<version>.LICENSE.txt`,
    and removes older versioned copies. With `--check` it changes nothing and
    exits 1 when a copy is missing or differs;
  - add `"vendor": "node scripts/vendor.mjs"` and make `"lint"` run
    `biome check . && node scripts/vendor.mjs --check`;
  - exclude `public/vendor` in `biome.json` (`"!public/vendor"`);
  - add to `public/_headers`:
    `/vendor/*` → `Cache-Control: public, max-age=31536000, immutable`, with a
    comment that the file names carry the version;
  - run `pnpm vendor` and commit the copies. `pnpm lint` passes.
- [X] T005 [P] Write failing tests in `test/unit/html.test.ts` for a new
  `LayoutOptions.scripts?: string[]`: each path is emitted as
  `<script src="…" defer></script>` in the given order, all before
  `<script src="/app.js" defer>`; a page without the option renders exactly as
  before.
- [X] T006 Implement `scripts` in `layout` in `src/http/html.ts` (and pass it
  through `shellPage` if that builds the layout options), so that T005 passes.
  Export the two vendor paths once, as `CHART_SCRIPTS` in
  `src/http/progress-section.ts` or a small constant beside it, matching
  `scripts/vendor.mjs`'s names.

**Checkpoint**: baseline green; test data importable; `/vendor/*` served.

---

## Phase 2: Foundational (blocking)

**Purpose**: the curve and the read, which both user stories need (research R1–R3).

- [X] T007 Write failing tests in `test/unit/curve.test.ts` for
  `riderCurve(inputs, window, last, balance, rules)` (data-model.md "Pure
  values"):
  - **(a) The example rider**: 37 points from 2026-09-01 to 2026-10-07, and
    `training`/`team` on 5, 6, 13, 19, 20, 27 September and 4 and 7 October equal
    21/1, 21/1, 30/1, 46/6, 69/11, 80/16, 112/17 and 112/17. Day 0 is 0/0. 4
    October gains exactly the correction's 10.
  - **(b) The elevation step**: on 20 September, 19 September has 46 and 20
    September has 69, so the step's +5 lands on the day the total passes 2000 m.
  - **(c) The floor of 0**: a correction of −30 Training on a day when the total
    is 20 gives 0, and a later +5 ride still gives 0 (25 − 30, the floor applies
    to the total); with a correction of −20 instead, the later ride gives 5.
  - **(d) Items dated after the last day count on the last day**: attendance
    dated 2026-10-09 with `last` = 2026-10-07 adds to 7 October.
  - **(e) The deadline has passed**: with today 2027-07-10 the last point is
    2027-06-30 and there are `axisDays + 1` points.
  - **(f) Without virtual rides**: a rider with a virtual ride of 100 km on 10
    September has `outside` 10 below `training` from that day on.
  - **(g) A disagreeing balance** makes the last point equal the balance and
    calls `console.error` once, with a message containing no athlete ID.
  - **(h) Every reference rider** in `test/support/reference-riders.ts`: the last
    point equals their expected balance (SC-002), and at every entry of
    `weekEnds(seasonStart, last)` the point equals `riderWeeks(...)`'s point for
    the same week (FR-012).
- [X] T008 Implement `CurveRideSum`, `CurveInputs`, `CurvePoint` and
  `riderCurve` in `src/rynke/weeks.ts`, so that T007 passes:
  - Extend `tallyUpTo` to take the rides without virtual ones and return
    `outside` (`trainingWithoutVirtual`). `riderWeeks` and `riderDays` pass the
    same rides for both, so their results don't change; their existing tests
    must still pass.
  - Sum the rides as the days go, as `riderDays` does.
  - Place anything dated after `last` on `last`.
  - Override the last point with the balance on a mismatch and
    `console.error("Progress curve disagrees with the stored balance")`.
- [X] T009 Write failing tests in `test/integration/rider-view-progress.test.ts`
  for `readRiderView(db, athleteId, 1, { progress: true })` on the seeded example
  rider and a second synthetic rider:
  - `progress.rides` lists the example rider's counting rides per day, with sums
    and `virtual: false`;
  - `progress.corrections` holds the one correction (`date` 2026-10-04, training
    10, team 0);
  - nothing of the second rider appears;
  - without the option, `progress` is `undefined`;
  - all statements run in the existing single `db.batch`. Spy on `db.batch` and
    assert one call.
- [X] T010 Implement the two statements of data-model.md "What is read" in
  `src/db/rider-view.ts`:
  - add the optional `{ progress?: boolean }` parameter and `progress?:
    CurveInputs` on `RiderViewRead`;
  - map the existing attendance rows to `Attendance` for `progress.attendance`;
  - add the statements only when `progress` is set, so T009 passes.

**Checkpoint**: `pnpm test -- curve rider-view-progress weeks reference-riders html`
is green.

---

## Phase 3: User Story 1: Rider sees how their Rynke grew and zooms in (P1, PR 1) 🎯 MVP

**Goal**: below the breakdown on the Overview, the rider gets:
- the Training and Team charts with threshold lines, drawn by Chart.js;
- period buttons, free zoom and move;
- a day readout;
- a weekly table.

**Independent Test**: seed the example rider, a rider with 0/0, a rider past both
thresholds and a rider without a balance. Sign in as each and compare the chart
data, labels and table with the figures above. Then zoom to 14–20 September with
mouse and keyboard in the e2e tests.

### Tests for User Story 1 (write first, confirm they fail)

- [X] T011 [P] [US1] Write failing tests in `test/unit/progress-view.test.ts` for
  `buildProgressView(read, rules, window, today)` (data-model.md "View model"):
  - **(a) Axis**: the example rider has `axisDays` 302 and `lastIndex` 36, and
    `training.values`/`team.values` hold 37 entries, equal to `riderCurve`.
  - **(b) `yMax`** (research R5): 250 for Training at 112, 25 for Team at 17,
    300 for Training at 262 (rounded up to a step of 50), and 30 for Team at 26.
  - **(c) Presets** (FR-020, research R8): "season" is always first with `from`
    0 / `to` 302;
    - on 2026-10-07, "4w" is offered as `from` 9 / `to` 36 (10 September – 7
      October) and "3m" is not offered;
    - on 2026-11-30, "3m" is not offered; on 2026-12-01 it is, with `from` 1
      (2 September);
    - on 2026-09-20, neither is offered.
  - **(d) Weeks** equal the weekly table above (six rows, oldest first, labelled
    with their first day).
  - **(e) `nothingYet`** is true for a 0/0 balance.
  - **(f) `state` is "none"** without a balance and when
    `rulesForVersion(balance.rulesVersion)` is `null`.
- [X] T012 [P] [US1] Write failing tests in `test/unit/progress-section.test.ts`
  for `renderProgress(i18n, view)` with the example rider's view, in `de` and
  `en`, following [contracts/overview-section.md](contracts/overview-section.md):
  - **Structure**: `section#progress.progress.card-outlined` with `data-locale`.
  - **Period buttons**: `button[type=button]` in a `role="group"`, with
    `data-from`/`data-to`: the season (0/302, `aria-pressed="true"`) and 4w (9/36,
    `aria-pressed="false"`), plus "3m" only when offered. No move or reset
    buttons.
  - **Each chart**: a `canvas[data-series]` with `role="img"`, `tabindex="0"`,
    `aria-describedby="progress-help"` and an `aria-label` with the whole
    season's period, the value at its end and the target; a
    `template[data-label]` with `span[data-slot]` for from, to, value and
    threshold.
  - **Legend**: a line key and a label per line, with the threshold's value.
  - **Readout**: `p.progress-readout[aria-live=polite]`, `#progress-help`, and a
    `template[data-readout="day"]` whose content has `span[data-slot]` for date,
    training and team.
  - **Table**: a `details.progress-table` with the six week rows.
  - **Chart data**: `#progress-data` JSON parses to exactly the keys of
    data-model.md "Chart data", with only strings of the form `YYYY-MM-DD` and
    numbers inside.
  - **Nothing to see yet**: the "nothing yet" note appears only for 0/0.
  - **Forbidden content** (FR-005, SC-004): the HTML contains no `km`, ` m<`,
    `Höhenmeter`, `km/h` or ride name, and no `strava.com` link.
- [X] T013 [P] [US1] Write failing tests in
  `test/integration/overview-progress.test.ts`, using `test/support/pages.ts`
  helpers, for `GET /me`:
  - **(a) The example rider**: the section appears after `.rynke-breakdown`, with
    the figures of T012, and the head has the two vendor scripts in order
    before `/app.js`.
  - **(b) A second seeded rider**: their own figures only. No value of the other
    rider appears in the HTML (SC-007).
  - **(c) No balance**: the waiting state, no `#progress` and no vendor script
    (FR-016).
  - **(d) An unknown rules version**: no `#progress` and no vendor script
    (FR-040).
  - **(e) Other sections** (`/me/rides`, `/team`, `/settings`) load no vendor
    script.
  - **(f) `Accept-Language: en`** gives the English texts (SC-009).
  - **(g) The tour's example rider**: on the tour's Overview step the section
    shows the example rider's data, not the signed-in rider's (FR-043).
  - **(h) Nothing written or fetched**: no D1 write, no queue message and no
    `fetch` to Strava during any of these requests (SC-006). Use the existing
    spies in `test/support/ctx.ts`.
  - **(i) Rides redirect unchanged**: `/me?page=2` still redirects to
    `/me/rides?page=2`.
- [X] T014 [P] [US1] Extend `test/unit/design-tokens.test.ts`:
  - `--rp-line-training`, `--rp-line-team` and `--rp-line-outside` are defined in
    both schemes, with the values of research R12 (light `#8a6e00`, `#1f6fb2`,
    `#7b4fa0`; dark `#a88e00`, `#4a94d2`, `#a77fd0`);
  - each has at least 3:1 contrast against its scheme's
    `--md-sys-color-surface`.

### Implementation for User Story 1

- [X] T015 [P] [US1] Add the 18 US1 keys of
  [contracts/messages.md](contracts/messages.md) to
  `src/i18n/messages/de.ts` and `src/i18n/messages/en.ts`. Make the
  `progress.chart.*` and `progress.day` placeholders work with `i18n.tHtml` slot
  spans. `test/unit/catalogs.test.ts` and `no-hardcoded-copy` stay green.
- [X] T016 [US1] Implement `buildProgressView` in `src/http/progress-view.ts`
  (pure, no I/O):
  - use `riderCurve`, `lastDay` and `weekEnds` from `src/rynke/weeks.ts`;
  - implement the presets of research R8, `yMax` of research R5 and the week rows
    of research R11,

  so that T011 passes.
- [X] T017 [US1] Add to `src/http/style.ts`:
  - the `--rp-line-*` tokens in the light and dark token blocks;
  - the `.progress` styles: the card spans both grid columns via
    `.overview-grid>.progress{grid-column:1/-1}`;
  - `.progress-plot{position:relative;height:11rem}`, `13rem` from 600 px, with
    the canvas filling it and `touch-action:pan-y` on the canvas (FR-025);
  - the HTML legend keys of research R12: curve 2 px solid in its token;
    threshold 1 px dashed in `--md-sys-color-on-surface-variant`;
  - labels in `--md-type-label` and text tokens only;
  - the period chips (`aria-pressed="true"` styled as selected)
    at `--rp-tap` height;
  - focus-visible outline on the canvases as elsewhere;
  - the table inside `.progress-table-scroll{overflow-x:auto}`;
  - the Training card edge `--rp-coin-yellow` and the Team card edge
    `--rp-coin-team`.

  T014 must pass.
- [X] T018 [US1] Implement `renderProgress(i18n, view)` in
  `src/http/progress-section.ts` following
  [contracts/overview-section.md](contracts/overview-section.md):
  - the canvases with the whole season's `aria-label`;
  - a mini coin in each figcaption (`miniCoin` from `src/http/coin.ts`);
  - the label and readout templates with `i18n.tHtml` slots;
  - the period buttons from `view.presets`;
  - the table, formatted with `formatDate`;
  - the JSON escaped with `<` → `<`.

  T012 must pass.
- [X] T019 [US1] Wire the section into `src/http/sections/overview.ts`:
  - read with `readRiderView(db, id, 1, { progress: true })`;
  - call `buildProgressView` with `berlinDate(ctx.now())` and
    `countingWindow(ctx.env)`;
  - render `renderProgress` after `renderBreakdown` inside `.overview-grid`;
  - pass `scripts: CHART_SCRIPTS` to the layout only when the section is
    rendered.

  T013 (a)–(f), (h), (i) must pass.
- [X] T020 [US1] Extend `exampleRiderView` in `src/http/tour-example.ts` to fill
  `progress` from its synthetic rides (summed per day and virtual flag, counting
  rides only), its attendance and no corrections (data-model.md "The tour's
  example rider"). Nothing is stored and `dev/` is not imported. T013 (g) must
  pass, as must the existing tour tests.
- [X] T021 [US1] Add `progressCharts()` to `public/app.js` following
  [contracts/client.md](contracts/client.md) and research R5, R7, R9, R10 and
  R12, and call it with the others at the end of the file. It covers:
  - **Start**: the `window.Chart` check, `Chart.register(window.ChartZoom)`, the
    JSON parse, and one chart per `canvas[data-series]` with the options of the
    contract (linear x of day indexes, fixed y, no animation, legend and tooltip
    off, `interaction.mode: "index"`).
  - **Ticks** (research R10): `afterBuildTicks` sets month starts, Mondays or
    every second day by the visible span; `ticks.callback` formats them with
    `Intl.DateTimeFormat(section.dataset.locale, …)`.
  - **Zoom plugin**: `limits.x = { min: 0, max: axisDays, minRange: 7 }`; wheel and
    drag (`threshold: 8`) on, pinch off, `mode: \"x\"`; pan
    `{ enabled: true, modifierKey: \"shift\" }` so drag-zoom ignores a shift-drag; `onZoomStart` returns `false` for a wheel event when
    the canvas is not `document.activeElement`; `onZoomComplete` calls
    `applyPeriod`.
  - **Gestures** (contracts/client.md \"Gestures\"): Pointer Events on each
    canvas, no Hammer.js: one touch pointer, or Shift + mouse, pans with
    `chart.pan` after 8 px sideways; two pointers zoom with `chart.zoom` by the
    change in their distance around their midpoint; when the last pointer is
    up or cancelled, `applyPeriod`.
  - **`applyPeriod(from, to)`**: sets the other chart with `zoomScale`, guarded
    against echo; updates `aria-pressed`, both `aria-label`s from
    `template[data-label]`.
  - **Buttons**: period buttons apply `data-from`/`data-to`.
  - **Keys** on a focused canvas: ←/→, +/−, PageUp/PageDown, Home/End, 0 and
    Escape (research R7), calling the plugin's `zoom`, `pan` and `resetZoom`.
  - **Selected day**: hover, tap or keys set the active index on both charts
    (`setActiveElements`), capped at `lastIndex`; a small crosshair plugin draws
    the 1 px hairline; the readout is rebuilt from `template[data-readout="day"]`
    with `textContent` and `Intl.NumberFormat`. It starts on the last day.
  - **Colours**: tokens and font from `getComputedStyle`, read again on a
    `prefers-color-scheme` change or a `data-scheme` change on `<html>`
    (`MutationObserver`), then `chart.update("none")`.
  - **Not allowed**: no `fetch`, storage, cookie, URL change or literal
    rider-facing text.
- [X] T022 [US1] Write `e2e/progress.e2e.ts` for Chromium, Firefox and WebKit,
  using the fake mode's sample rider "Paula Paging" (45 rides over several weeks;
  `signIn` and `skipTours` from `e2e/sign-in.ts`) and the `errors` fixture
  pattern of `e2e/smoke.e2e.ts`. Read chart state with
  `page.evaluate(() => Chart.getChart(canvas).scales.x)` (research R13):
  - **(a) Layout**: at 320 × 568 and 360 × 740, `#progress` is visible, both
    canvases have a non-zero size, and the page doesn't scroll sideways.
  - **(b) Period buttons**: tapping "Letzte 4 Wochen" sets both charts' x
    `min`/`max` to the button's `data-from`/`data-to` without a navigation, and
    its `aria-pressed` becomes `true`.
  - **(c) Drag to zoom**: dragging across the Training canvas with the mouse from
    25 % to 50 % of its width gives both charts the same `min`/`max`, at least 7
    days apart. "Ganze Saison" brings back
    0 … `axisDays`.
  - **(d) Keyboard**: focus the Team canvas with Tab, press ← three times, and
    the readout names the date three days before the last day. `+` narrows the
    x range of both charts.
  - **(e) Wheel**: a wheel over an unfocused canvas scrolls the page without
    changing the x range. After a click, the wheel changes it.
  - **(f) Readout = table**: the readout for a selected day at a week's end
    equals that week's totals in the table.
  - **(g) Touch**: each canvas's computed `touch-action` is `pan-y` and
    `window.Hammer` is undefined. With synthetic `pointerType: "touch"` events
    (`dispatchEvent` of `pointerdown`/`pointermove`/`pointerup`): two pointers
    moving apart narrow both charts' x range around their midpoint; one pointer
    moving 100 px sideways shifts both ranges equally; one pointer moving only
    vertically changes neither.
  - **(h) Dark mode**: with the dark scheme, the Training dataset's
    `borderColor` equals the token `#a88e00`.
  - **(i) Vendor files**: `/vendor/chart-4.5.1.umd.min.js` responds 200 with
    `Cache-Control` containing `immutable`.
  - **(j)** There is no console error in any test.

  If no sample rider has rides in at least three different weeks, add rides to a
  sample in `dev/fake-strava/samples.ts` (synthetic only) rather than changing
  the test.
- [X] T023 [US1] Run `pnpm format`, `pnpm lint` (including `vendor --check`),
  `pnpm typecheck`, `pnpm test` and `pnpm test:e2e` (WebKit via
  `pnpm test:e2e:webkit` where it doesn't run natively), and fix every failure.
  T002–T022 are all green.
- [X] T024 [US1] Check the US1 build against the spec's diagrams (D0, D1, D2,
  D3, D4, D5, D7) and the plan's P1–P6. Where the build differs for a reason the
  spec allows, update the diagram in `specs/009-rider-progress-charts/spec.md` or
  `plan.md` in the same PR (FR-091, FR-092). Re-render them with the Mermaid CLI
  to confirm they parse.

**Checkpoint**: PR 1 (US1) is complete and releasable alone.

---

## Phase 4: User Story 2: On pace and how much may come from virtual rides (P3, PR 2)

**Goal**:
- both charts gain the even pace line;
- the Training chart gains the outdoor curve, the 167 line and its pace line, for
  riders with virtual rides;
- the readout gives the pace and how far ahead or behind the rider is;
- the table gains the outdoor columns.

**Independent Test**: seed the example rider and a rider with 100 Training Rynke
from virtual rides. Compare the pace values and the outdoor curve with
hand-worked figures and with `riderStatus` from `src/rynke/pace.ts`.

### Tests for User Story 2 (write first, confirm they fail)

- [X] T025 [P] [US2] Extend `test/unit/progress-view.test.ts`:
  - **(a) Pace for the example rider**: `training.pace` and `team.pace` are
    true. The pace formula `⌊threshold × i ÷ axisDays⌋` gives 27 and 2 at index
    33 (4 October), so the rider is 85 and 15 ahead.
  - **(b) Pace formula = `evenPace`**: for every index 0…302 and thresholds 250,
    25 and 167, it equals `evenPace(threshold, "2026-09-01", "2027-06-30",
    date(i))`.
  - **(c) A rider with 100 virtual Rynke**: `outside` is set with `needed` 167
    and values 100 below `training` at the end. Without virtual rides, `outside`
    is `null`.
  - **(d) Agreement with the status**: for the reference riders on several days,
    a value below the pace on any drawn line happens exactly when `riderStatus`
    is `"push"` (and not `"in"`) for that reason (US2 scenario 2).
  - **(e) Week rows** gain `outside` only when `outside` is set.
- [X] T026 [P] [US2] Extend `test/unit/progress-section.test.ts`:
  - **Legend**: a pace entry in both charts; for riders with virtual rides,
    entries for the outdoor curve and the 167 line.
  - **Chart data**: `pace` is `true`, and `outside` has `values`, `threshold`
    167 and `needed` only for riders with virtual rides.
  - **Readout templates**: `template[data-readout="pace-ahead"]`, `"pace-behind"`
    and `"pace-on"`, and `"outside"`.
  - **Table**: the outdoor columns appear only with virtual rides.
  - **Wording**: no German or English text containing "Regel", "verstoßen",
    "rule" or "broken" in the behind template (FR-038).
- [X] T027 [P] [US2] Extend `e2e/progress.e2e.ts` with the sample rider "Vera
  Virtual":
  - the Training chart has the outdoor and pace datasets (through
    `Chart.getChart`);
  - selecting a day with the keyboard fills the pace part of the readout with
    "vor dem Tempo" or "hinter dem Tempo" and the outdoor value.

### Implementation for User Story 2

- [X] T028 [P] [US2] Add the 6 US2 keys of
  [contracts/messages.md](contracts/messages.md) to both catalogs.
- [X] T029 [US2] Extend `buildProgressView` in `src/http/progress-view.ts`:
  - `pace: true` for both series;
  - `outside` with `needed` = `virtualShareRequired(rules)` when `virtualCount >
    0`;
  - the outdoor week columns,

  so that T025 passes.
- [X] T030 [US2] Extend `renderProgress` in `src/http/progress-section.ts` and
  the styles in `src/http/style.ts`:
  - the legend keys: pace 1 px dotted, outdoor 2 px dashed in
    `--rp-line-outside`, the 167 line like the threshold;
  - the templates and the table columns,

  so that T026 passes.
- [X] T031 [US2] Extend `progressCharts()` in `public/app.js`:
  - datasets for the pace lines (from (0, 0) to (`axisDays`, threshold), 1 px,
    `borderDash: [1, 3]`), the outdoor curve (2 px, `borderDash: [6, 3]`,
    `--rp-line-outside`) and the 167 line;
  - the readout appends, per line with a pace, the ahead, behind or on-pace
    template filled with `n = |value − pace|` and `pace`;
  - for riders with virtual rides, it adds the outdoor template;
  - the pace comes from `⌊threshold × i ÷ axisDays⌋`, clamped to
    `0…threshold`, so no new data is needed.

  T027 must pass.
- [X] T032 [US2] Run `pnpm format`, `pnpm lint`, `pnpm typecheck`, `pnpm test`
  and `pnpm test:e2e`, and fix every failure.

**Checkpoint**: PR 2 (US2) is complete. Nothing US1 shows is taken away (FR-004).

---

## Phase 5: User Story 3: Diagrams checked against the build (FR-092)

**Goal**: the spec's and plan's diagrams match what was built.

**Independent Test**: a reviewer opens `spec.md` and `plan.md` on GitHub, every
diagram renders, and each agrees with the requirements and the code.

- [X] T033 [US3] After PR 2, check D0–D7 in `specs/009-rider-progress-charts/spec.md`
  and P1–P6 in `plan.md` against the built section, including the US2 parts of
  D3 and D7. Correct any diagram that differs for a reason the spec allows, and
  update the requirement text in the same change if a requirement changed
  (FR-091).
- [X] T034 [US3] Render every Mermaid block of `spec.md` and `plan.md` with the
  Mermaid CLI (system Chrome via a puppeteer config in the scratchpad, never in
  the repo) and fix any block that fails to parse.

---

## Dependencies & Execution Order

- **Phase 1** (T001–T006) has no dependencies beyond T001. T002–T005 run in
  parallel; T006 needs T005.
- **Phase 2**: T007 → T008, and T009 → T010. T009/T010 can run beside
  T007/T008. Both need T002, and T007 needs T003.
- **US1** needs Phase 2:
  - T011–T014 (tests) in parallel;
  - T015 and T017 in parallel with T016;
  - T018 needs T015, T016 and T017;
  - T019 needs T018, T010 and T006;
  - T020 needs T019;
  - T021 needs T018 and T004;
  - T022 needs T019 and T021;
  - T023 after all of them, then T024.
- **US2** needs US1 merged:
  - T025–T027 in parallel, with T028 beside them;
  - T029 → T030 → T031 → T032.
- **US3** (T033, T034) comes last, after US2.

## Parallel Examples

```text
Phase 1:  T002 (test/support/progress.ts) ‖ T003 (test/support/reference-riders.ts) ‖ T004 (vendor) ‖ T005 (html.test.ts)
Phase 2:  T007→T008 (weeks.ts) ‖ T009→T010 (rider-view.ts)
US1 tests: T011 ‖ T012 ‖ T013 ‖ T014
US1 impl:  T015 (catalogs) ‖ T016 (progress-view.ts) ‖ T017 (style.ts)
US2 tests: T025 ‖ T026 ‖ T027, with T028 (catalogs)
```

## Implementation Strategy

1. **MVP = Phases 1–3**, one PR into `develop`. The Overview shows the two charts
   with zoom, the readout and the table.
2. **PR 2 = Phase 4** (pace and outdoor curve), on top of the merged MVP.
3. **Phase 5** closes the feature: the diagrams match the build.
4. Each PR runs the full `pnpm lint`, `pnpm typecheck`, `pnpm test` and
   `pnpm test:e2e` before review (T023, T032).
