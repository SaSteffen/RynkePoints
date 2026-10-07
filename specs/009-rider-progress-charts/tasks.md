---
description: "Task list for rider progress charts"
---

# Tasks: Rider Progress Charts

**Input**: Design documents from `/specs/009-rider-progress-charts/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: REQUIRED (constitution Principle V, spec FR-080). Write each test task
first, run it and confirm it fails, then implement. All riders, rides, events and
names are synthetic. Expected figures are worked out by hand, never by running
the code under test.

**Organization**: one phase per user story, in delivery order (plan "Delivery").
US1 is PR 1 and releasable alone. US2 is a later PR on top of it. US3 (the
diagrams) came with the spec. Its remaining part is the check against the build
(FR-092), which ends each delivery and is the last phase.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 (curves and zoom), US2 (pace and without virtual rides),
  US3 (diagrams)

## The example rider as test data

Feature 003 Story 6 (corrections) isn't built, so nothing stores a correction.
The test data stands in for the spec's +10 correction on 4 October with a
counting 100 km ride with 0 m that day. Every total of the spec's example
stays the same. Season start 2026-09-01, "today" 2026-10-07, rules
`CURRENT_RULES` (no deadline).

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
| 4 Oct | ride 100 km, 0 m (10), standing in for the correction | 112 | 17 |

Its stored balance:
- `distanceRynke` 62, `elevationDm` 31000, `elevationRynke` 15 and
  `elevationToNextStepDm` 9000;
- `trainingRynke` 112, `trainingMissing` 138, `teamRynke` 17 and `teamMissing` 8;
- `trainingWithoutVirtual` 112 and `virtualShareMissing` 55;
- `qualified` false;
- `teamEvents`: `team_training` 2/2/10, `training_weekend_day` 2/10/20 and
  `technique_training` 1/5/5 (attended/team/training).

---

## Phase 1: Setup

- [ ] T001 In the worktree, run `pnpm install`, then `pnpm lint`, `pnpm typecheck`
  and `pnpm test`. All pass before any change, so later failures are this
  feature's.
- [ ] T002 Add plain JS in `public/progress/` to the type check, as research R6
  describes:
  - `tsconfig.json`: `"allowJs": true` and `"checkJs": true`, and
    `"public/progress/chart.js"` in `include`.
  - New `public/progress/tsconfig.json`: extends `../../tsconfig.json`, with
    `lib` `["es2024", "dom"]` and `types` `[]`. It includes `chart.js` and
    `progress.js`.
  - `package.json`: `"typecheck": "tsc --noEmit && tsc --noEmit -p public/progress"`.
  - `public/.assetsignore`: add `progress/tsconfig.json` under the existing
    comment.
  - Create `public/progress/chart.js` and `public/progress/progress.js`, each
    with only its header comment:
    - `chart.js`: pure drawing and period arithmetic shared by the Worker and
      the browser; no DOM, no I/O, no text (research R6).
    - `progress.js`: browser glue; holds no decisions and no text (research
      R13).
  - `pnpm lint` and `pnpm typecheck` pass.

---

## Phase 2: Foundational (blocking prerequisites)

- [ ] T003 Move the reference riders into shared test data, so both the
  evaluation test and the curve test can use them (SC-002). Move `WINDOW`,
  `daily`, `at`, `Rider` and `RIDERS` from `test/unit/reference-riders.test.ts`
  into a new `test/support/reference-riders.ts` (exported, with the comment
  block unchanged). Leave the test file holding only its `describe`. It still
  passes unchanged.
- [ ] T004 [P] New `test/support/progress.ts` with the example rider of the
  table above, in two forms:
  - `EXAMPLE_RIDES: CountingRide[]` (date, `distanceRynke`, `elevationDm`,
    `isVirtual: false`) and `EXAMPLE_ATTENDANCE: Attendance[]` (event IDs
    1–5), for the unit tests;
  - `seedExampleRider(athleteId)`, for the integration tests. It writes the
    same rides with `seedRide` (IDs `8_950_001` …, `start_date`
    `<date>T08:00:00Z`, `name` `"Synthetic progress ride"`, results
    `counts: true`) and the events with `insertEvent(kind, date, "Synthetic
    progress event")` and `attendRaw`. It writes the stored balance above with
    `seedBalance`.
  - `EXAMPLE_TODAY = Date.UTC(2026, 9, 7, 10) / 1000`.
  The `CountingRide` import comes from `src/db/rider-view.ts`. Until T010
  lands, declare it locally with a `// T010 moves this` comment.
- [ ] T005 [P] Export `ridingTotals` from `src/rynke/rides.ts`, test first. In
  `test/unit/rides.test.ts`, new `describe("ridingTotals (009 research R1)")`
  (failing):
  - For three rides (55 km/600 m, 65 km/500 m, a 40 km `VirtualRide` with
    300 m): `ridingTotals(evaluateRides(...).results.filter((r) => r.counts),
    CURRENT_RULES)` equals `evaluateRides(...).riding`.
  - `ridingTotals([], CURRENT_RULES)` gives all zeros.
  - Elevation is floored on the total: 600 m + 500 m gives `elevationRynke` 5.

  Then rename the private `sums` pair to:

  ```ts
  export function ridingTotals(
  	results: readonly Pick<RideResult, "distanceRynke" | "elevationDm" | "isVirtual">[],
  	rules: RynkeRules,
  ): RidingTotals
  ```

  It returns `{ ...sums(all), withoutVirtual: sums(not virtual) }`, and
  `evaluateRides` calls it. Every existing case in `rides.test.ts` and
  `reference-riders.test.ts` still passes (FR-012: one copy of the rules).

**Checkpoint**: the shared test data exists, and the evaluation's sums can be
called on their own.

---

## Phase 3: User Story 1 - Rider sees how their Rynke grew over the season and zooms in (Priority: P1) 🎯 MVP

**Goal**: `/me` shows `section#progress` between the rules and the rides, with
both curve charts, the period links, the weekly table, the chart JSON and the
script ([contracts/rider-page.md](contracts/rider-page.md)). The period is kept
in the URL ([contracts/http-routes.md](contracts/http-routes.md)).

**Independent test**: T006–T013 pass, and `pnpm typecheck` passes.

### Tests for User Story 1

- [ ] T006 [P] [US1] New `test/unit/curve.test.ts` (failing), for
  `seasonCurve` from `src/rynke/curve.ts` with `CURRENT_RULES` and the window
  `{ seasonStart: "2026-09-01", deadline: null }`:
  - **Example rider**, `lastDay` `2026-10-07`:
    - 37 entries, dated 2026-09-01 … 2026-10-07.
    - Every row of the table above, by date.
    - 6 Sep 21/1, 13 Sep 30/1, 20 Sep 69/11, 27 Sep 80/16, 4 Oct 112/17, and
      7 Oct 112/17 (US1 scenarios 1, 5 and 13).
    - `trainingWithoutVirtual` equals `training` every day.
  - **Elevation step**: 19 Sep is 46 and 20 Sep is 69. The step's 5 belong to
    the day whose ride passes 2000 m (spec edge case).
  - **Floor of 0**: with no input, every entry is 0/0/0.
  - **Dated after the last day**: with `lastDay` `2026-10-03`, the ride and
    the team training dated later count on 3 Oct. The last entry is then 112
    training and 17 team (research R2).
  - **Not in the window**: an event dated after the window's deadline adds
    nothing, even when `lastDay` is earlier than its date. Clamping only places
    an item, it never puts it in the window.
  - **Deadline passed**: with window deadline `2026-09-20` and `lastDay`
    `2026-09-20`, there are 20 entries and the last is 69/11.
  - **Season start**: a ride on 2026-09-01 counts on entry 0.
  - **Bad input**: `lastDay` before the season start throws.
  - **SC-002**: `it.each(RIDERS)` from `test/support/reference-riders.ts`:
    - Evaluate the rides with `evaluateRides(…, CURRENT_RULES, WINDOW)`.
    - Map the counting results to `CountingRide`, with the date taken from each
      ride spec's local start.
    - `seasonCurve(rides, attendance, CURRENT_RULES, WINDOW, "2026-08-31")`.
    - Its last entry's `training`, `team` and `trainingWithoutVirtual` equal
      `tally(evaluation.riding, extrasFromAttendance(events), CURRENT_RULES)`.
      Riders whose `team` stand-in is not 0 compare without it.
- [ ] T007 [P] [US1] New `test/unit/progress-view.test.ts` (failing), for
  `src/http/progress-view.ts`. Use a `RiderViewRead` built from
  `EXAMPLE_RIDES`, `EXAMPLE_ATTENDANCE` and the example balance, and `today`
  `2026-10-07`.
  - **Axis**:
    - Without a deadline: 2026-09-01 … 2026-10-07, and `lastDay` 2026-10-07.
    - With rules whose deadline is `2027-05-31` (a copy of `CURRENT_RULES`):
      the axis ends 2027-05-31 and `lastDay` stays 2026-10-07 (US1
      scenario 2).
    - With `today` `2026-09-02`: the axis is 2026-09-01 … 2026-09-07 (at
      least 7 days).
    - With the deadline `2026-09-20` and `today` after it: `lastDay` is
      2026-09-20.
  - **Presets**:
    - `4w` is 2026-09-10 … 2026-10-07 (US1 scenario 3).
    - `3m` is not offered: its start, 2026-07-08, is not after the season start.
    - With `lastDay` 2027-05-31 and the deadline axis, `3m` is 2027-03-01 …
      2027-05-31 (28 February + 1 day).
  - **`parsePeriod`**:
    - `?period=4w` gives the preset, and `?period=3m` while not offered gives
      the season.
    - `?from=2026-09-14&to=2026-09-20` is kept as given.
    - `?from=2026-09-14&to=2026-09-15` is widened to 2026-09-14 … 2026-09-20.
    - `?from=2026-10-05&to=2026-10-06` becomes 2026-10-01 … 2026-10-07 (it
      keeps `from` where possible, else ends on the axis end).
    - `?from=2026-08-01&to=2026-09-03` is clamped to start on 2026-09-01.
    - These give the whole season: `?from=2026-02-30&to=2026-03-01`, `from`
      after `to`, only one of the two, and `?period=x`.
    - `period` wins over `from`/`to`.
  - **Weeks**: six rows, oldest first, as the spec's example table. The first
    starts 2026-09-01 and the last runs 2026-10-05 … 2026-10-07 (FR-037,
    FR-051).
  - **Other values**:
    - `thresholds` is 250/25 and `yMax` 300/30.
    - `nothingYet` is true only for a 0/0 balance.
    - `pace` and `withoutVirtual` are `null`.
  - **`state: "none"`** in these cases:
    - no balance (FR-016);
    - `rules` `null`, an unknown version (FR-040);
    - a balance of 113 training (a mismatch). This logs `console.error`
      exactly once with "Progress curve disagrees with the stored balance",
      and the arguments hold no athlete ID (research R3).
- [ ] T008 [P] [US1] New `test/unit/chart.test.ts` (failing), importing
  `../../public/progress/chart.js`:
  - **Dates**: `addDays("2026-09-30", 2)` is `"2026-10-02"`, and `daysBetween`
    also works across the end of March (UTC arithmetic).
  - **`clampPeriod`**:
    - at least 7 days;
    - within the axis;
    - keeps `from` where possible;
    - a period longer than the axis becomes the axis.
  - **`zoom`**:
    - Factor 0.5 around a day halves the period, and the day stays at the same
      fraction.
    - It never zooms in below 7 days or out beyond the axis.
  - **`move`**: by half the period, ±1. Stops at the season start and at the
    axis end (US1 scenario 14).
  - **`resetPeriod`** gives the axis.
  - **`niceMax`**: 250 → 300, 25 → 30, 262 → 300, 300 → 300. A curve above
    the threshold is never cut off (FR-014).
  - **`curvePath`**: for values `[0, 10, 10]` over the period 2026-09-01 …
    2026-09-03 with `yMax` 20, it is exactly `"M0 100L500 50L1000 50"`.
    - x is `(i − fromIndex) × 1000 ÷ (toIndex − fromIndex)`; y is
      `100 − v × 100 ÷ yMax`.
    - At most 2 decimals.
    - No point after the last value (FR-013), and only days within the period.
  - **`thresholdPath(250, 300)`** is `"M0 16.67H1000"`.
  - **`yTicks(300)`** are 0, 100, 200 and 300 at `bottom` 0, 33.33, 66.67 and
    100.
  - **`xTicks`**:
    - Whole season 2026-09-01 … 2027-05-31 with `"de-DE"`: month labels, at
      most 6, each `left` in 0…100.
    - 2026-09-14 … 2026-09-20: day labels like `"14.9."`.
    - 62 days or fewer means days, more means months (FR-024).
  - **`nearestDay`**: fraction 0 gives `from` and 1 gives `to`. Within the
    period, the nearest day wins, and a day after `lastDay` gives `lastDay`.
  - **`markerPath`** for a day is a vertical `M<x> 0V100`.
  - **`keyAction`**:
    - `ArrowLeft`/`ArrowRight` step ±1;
    - `+` and `=` zoom in, `-` zooms out;
    - `PageUp` moves −1 and `PageDown` +1;
    - `Home` and `End` go to the first and last day;
    - `0` and `Escape` reset;
    - anything else gives `null` (FR-022, FR-053).
  - **`classifyGesture(dx, dy)`**:
    - |dx| and |dy| both ≤ 8 is `"tap"`;
    - |dy| > |dx| is `"scroll"`, so a vertical swipe never zooms (FR-025);
    - otherwise `"drag"`.
  - **`periodQuery(page, period, presets)`**:
    - `""` for page 1 with the whole season;
    - `"?page=2"`;
    - `"?period=4w"` when the period equals that preset;
    - `"?page=2&from=2026-09-14&to=2026-09-20"`.
- [ ] T009 [P] [US1] New `test/integration/me-progress.test.ts` (failing). Use
  `makeCtx({ now: EXAMPLE_TODAY })`, `resetDb`, `installFakeStrava`,
  `seedRider(ctx, { athleteId: ATHLETE_A })` and `seedExampleRider(ATHLETE_A)`.
  The `section`/`text` helpers are copied from `me-rynke.test.ts`. A helper
  `chartData(html)` parses `#progress-data`.
  - **Place**: `section#progress` comes after `section.rynke-rules` and before
    `section#rides` (FR-001).
  - **Content**:
    - The heading "Dein Saisonverlauf" and "Berechnet mit den Regeln Version 2,
      für die ganze Saison." (FR-040).
    - Two `figure.progress-chart` (`training`, `team`), each with
      `path.line-curve` and `path.line-threshold`.
    - The legend "Ziel (250)" / "Ziel (25)".
    - The plot `aria-label` "Trainingsrynke vom 01.09.2026 bis 07.10.2026: 112
      am Ende, Ziel 250" (FR-050). The dates use `formatDate`.
    - A `<script type="module" src="/progress/progress.js">`.
  - **JSON**:
    - `seasonStart` and `lastDay`.
    - `charts.training.values[5]` 21, `[19]` 69 and `[36]` 112.
    - `charts.team.values[19]` 11 and `[36]` 17.
    - `threshold` 250/25 and `yMax` 300/30.
    - `presets["3m"]` null and `presets["4w"]` 2026-09-10 … 2026-10-07.
    - `intlLocale` "de-DE", `pace` null and `withoutVirtual` null.
    - `text.day` is the German template.
    - No keys other than those of contracts/rider-page.md.
  - **Table**: under `details.progress-table`, six rows:
    - `01.09.2026 21 21 1 1`
    - `07.09.2026 9 30 0 1`
    - `14.09.2026 39 69 10 11`
    - `21.09.2026 11 80 5 16`
    - `28.09.2026 32 112 1 17`
    - `05.10.2026 0 112 0 17`

    (US1 scenario 4.)
  - **Period**:
    - `?period=4w`: the JSON period is 2026-09-10 … 2026-10-07, and the 4w link
      has `aria-current`.
    - `?from=2026-09-14&to=2026-09-20`: no link has `aria-current`.
    - Every period link ends in `#progress`.
    - `/me?page=2&period=4w` sends the hidden `next` value `/me?period=4w`.
      The page is clamped to 1, the period kept (FR-026).
  - **English** (`acceptLanguage: "en"`): "Your season so far",
    `intlLocale` "en-GB", and the table's first cell `01/09/2026`.
  - **Nothing yet**: a rider with only `seedBalance(ATHLETE_A)` (0/0) shows
    "Du hast in dieser Saison noch keine Rynke gesammelt." and flat curves
    (FR-015, US1 scenario 6).
  - **Above the threshold**: the example plus fifteen 100 km rides with 0 m
    (training 262) gives `yMax` 300, and the curve's highest point stays at
    y ≥ 0 (US1 scenario 7).
  - **No section** in these cases:
    - no balance (FR-016, US1 scenario 8);
    - `rulesVersion: 99`;
    - a mismatched balance (113).
  - **Nothing of the rides** (FR-005, SC-004): in the section's HTML and JSON,
    none of these appear:
    - `km`, ` m<`, `km/h`, ` h<`;
    - `strava.com`, "Synthetic progress ride", "Synthetic progress event";
    - any `8950` activity ID.
  - **Only their own** (SC-007): ATHLETE_B has one counting 50 km ride on
    2026-09-10 (5) and a matching balance of 5. B's JSON ends in 5/0, and B's
    section contains neither 112 nor 17. A's JSON is still the example's.
  - **Read only** (SC-006, FR-003): `tableCounts()` is the same before and
    after three views with different periods. `ctx.queue.sent` is empty, and
    `fake.calls` is empty.
- [ ] T010 [P] [US1] In `test/integration/lang-switcher.test.ts`, `describe("the
  switcher on /me (US5)")`, add cases (failing). `safeNext` keeps:
  - `/me?period=4w`;
  - `/me?page=2&period=3m`;
  - `/me?from=2026-09-14&to=2026-09-20`;
  - `/me?page=2&from=2026-09-14&to=2026-09-20`.

  It turns these into `/`:
  - `/me?`;
  - `/me?page=2&`;
  - `/me?period=1y`;
  - `/me?to=2026-09-20&from=2026-09-14`;
  - `/me?period=4w&page=2`;
  - `/me?from=2026-09-14`.

  `POST /lang` with `next=/me?period=4w` answers `Location: /me?period=4w`
  (US1 scenario 15).
- [ ] T011 [P] [US1] Catalog tests (failing):
  - In `test/unit/catalogs.test.ts`, add the 18 US1 IDs of
    [contracts/messages.md](contracts/messages.md) to `CONTRACT_IDS`. Add a
    case: `progress.heading` is "Dein Saisonverlauf" in `de` and "Your season
    so far" in `en`.
  - In `test/unit/i18n.test.ts`: the new `template(id)` returns
    `progress.day` with `{date}`, `{training}` and `{team}` left in. The
    script fills them (research R10), so `t()`, which throws on a missing
    param, can't be used.
- [ ] T012 [P] [US1] In `test/unit/html.test.ts`, new `describe("jsonScript")`
  (failing). `jsonScript("progress-data", { t: "</script><b>&" })` renders:
  - `<script type="application/json" id="progress-data">`;
  - a body with no `<`, `>` or `&`;
  - text whose `JSON.parse` gives back the input after unescaping
    `<`/`>`/`&`.
- [ ] T013 [P] [US1] In `test/unit/rider-sections.test.ts`, new
  `describe("renderRides pager keeps the period")` (failing). With the period
  query `"&period=4w"`, the next link is `/me?page=2&period=4w#rides`. Without
  it, links are as before.

### Implementation for User Story 1

- [ ] T014 [US1] New `src/rynke/curve.ts` (pure; header comment as research R1
  and R2):
  - Exports `DayTotals` and `seasonCurve(rides, attendance, rules, window,
    lastDay)` as in [data-model.md](data-model.md).
  - It throws when `lastDay < window.seasonStart`.
  - It places each item on `min(date, lastDay)` only to choose its day.
    `evaluateAttendance` still gets the original dates, so the window check is
    unchanged.
  - For each day it calls:

    ```ts
    tally(
    	ridingTotals(ridesUpTo),
    	extrasFromAttendance(evaluateAttendance(attendanceUpTo, rules, window)),
    	rules,
    )
    ```

  - It returns `trainingRynke`, `teamRynke` and `trainingWithoutVirtual`.
  - No arithmetic of its own beyond the day placement (FR-012).

  T006 passes.
- [ ] T015 [US1] In `src/db/rider-view.ts`:
  - Add `CountingRide` (as in data-model.md) and
    `RiderViewRead.countingRides`.
  - Add the counting-rides `SELECT` of data-model.md as the fifth statement of
    the existing `db.batch` (FR-041).
  - Map the rows to `CountingRide` (`is_virtual === 1`), and extend the
    too-few-results check.
  - Update `test/support/progress.ts` to import `CountingRide` from here.
  - Add `countingRides: []` to every `RiderViewRead` literal that
    `pnpm typecheck` flags in `test/unit/rider-view.test.ts`.
- [ ] T016 [US1] New `public/progress/chart.js`: the functions T008 names, with
  JSDoc types and no DOM.
  - `drawChart(values, threshold, yMax, period, seasonStart, intlLocale)`
    returns everything renderProgress and progress.js need for one chart:
    - `grid`, `curve` and `threshold` paths;
    - `lineLabelBottom`;
    - `yTicks` as `{ bottom, value }`;
    - `xTicks` as `{ left, label }`.
  - `xTicks` labels use `Intl.DateTimeFormat(intlLocale, { timeZone: "UTC",
    ... })`.
  - In `contracts/rider-page.md`, change the example `L27.03 93` to match
    T008's formula for 37 days (`L27.78`).

  T008 passes.
- [ ] T017 [US1] New `src/http/progress-view.ts` (pure; header comment: no D1,
  no clock, no text):
  - `Period`, `WeekRow` and `ProgressView` as in data-model.md, with US2's
    fields always `null` for now.
  - `presets(lastDay, seasonStart)` as in research R8.
  - `parsePeriod(url, axis, offered)`. Dates are checked with `isCalendarDate`
    from `src/rynke/rules.ts`, and clamped with `clampPeriod` from
    `../../public/progress/chart.js`.
  - `buildProgressView(read, rules, { seasonStart, today, url })`:
    - `state: "none"` when there is no balance or `rules` is `null`;
    - the mismatch check and `console.error` of research R3;
    - weeks derived from the curve (research R11).

  T007 passes.
- [ ] T018 [P] [US1] Add the 18 US1 `progress.*` keys of
  contracts/messages.md, after the `rynke.*` keys, to
  `src/i18n/messages/de.ts` and `src/i18n/messages/en.ts`. T011 passes.
- [ ] T019 [P] [US1] In `src/http/html.ts`:
  - Export `jsonScript(id, value)`, which returns a `SafeHtml` with `<`, `>`
    and `&` written as `<`, `>` and `&`.
  - Append the CSS block of contracts/rider-page.md to `STYLE`.

  T012 passes, and `html.test.ts` "ships no script" still passes (the layout
  itself has none).
- [ ] T020 [US1] New `src/http/progress-section.ts`:
  - `renderProgress(i18n, view, page)` returns the markup of
    contracts/rider-page.md, or `null` for `state: "none"`.
  - It draws both charts with `drawChart` from `chart.js` for `view.period`.
  - It formats numbers with `formatNumber(n, { fractionDigits: 0 })` and dates
    with `formatDate`, and takes `intlLocale` from `i18n.t("meta.intlLocale")`.
  - Period links use `periodQuery` + `#progress`; only offered presets get a
    link, and `aria-current` marks the preset shown.
  - It renders the weekly table and the hidden readout, help and move
    controls.
  - The chart JSON goes through `jsonScript`, with exactly the keys of
    contracts/rider-page.md "Chart data". Its `text` holds the translated
    templates with their placeholders, read with `i18n.template(id)`.
  - `src/i18n/i18n.ts`: add `template(id: MessageId): string` to `I18n`
    (the raw message, placeholders left in). T011's i18n case passes.
- [ ] T021 [US1] Wire it into `/me`:
  - **`src/http/me.ts`**:
    - Call `buildProgressView(read, read.balance ?
      rulesForVersion(read.balance.rulesVersion) : null, { seasonStart:
      ctx.env.SEASON_START_DATE, today: berlinDate(ctx.now()), url })`.
    - Render `${renderProgress(i18n, progress, read.page)}` right after
      `renderRules`.
    - The layout `path` becomes `/me` + `periodQuery(read.page, period,
      presets)` (the whole season when the section is left out).
  - **`src/http/rider-sections.ts`**: `renderRides(i18n, rides, periodQuery =
    "")`, and `renderPager` appends it after `page=N`. T013 passes.
  - **`src/http/lang.ts`**: `safeNext` also accepts the canonical query regex
    of contracts/http-routes.md, but not when `next` ends in `?` or `&`. The
    comment cites 009 FR-026. T010 passes.
- [ ] T022 [US1] Keep the copy guard covering the section:
  - **`test/support/pages.ts` `seedPageRiders`**: make rider A's stored balance
    the one their stored results and attendance give. The section is left out
    on a mismatch (research R3), so the guard would never see it.
    - Add five unnamed `training_weekend_day` events (2026-09-12, 09-13, 09-19,
      09-26 and 09-27) attended by A.
    - The balance becomes:
      - `distanceRynke` 11, `elevationDm` 12400, `elevationRynke` 5 and
        `elevationToNextStepDm` 7600;
      - `trainingRynke` 71, `trainingMissing` 179, `teamRynke` 26 (still
        reached) and `teamMissing` 0;
      - `trainingWithoutVirtual` 67 and `virtualShareMissing` 100;
      - `teamEvents` `team_training` 1/1/5, `training_weekend_day` 5/25/50 and
        `technique_training` 0/0/0.
    - Update the comment above it.
  - **`test/integration/no-hardcoded-copy.test.ts` `unmarkedText`**:
    - Drop `<script…>…</script>` like `<style>`, with a comment that the chart
      data isn't visible text.
    - Add a case for `/me connected`: the page contains `section#progress`,
      and every string in its JSON `text` is wrapped in ⟦…⟧.

  `no-hardcoded-copy` and `language-rendering` pass. T009 passes.
- [ ] T023 [US1] `public/progress/progress.js`, the browser glue of
  contracts/rider-page.md "Script behaviour" and research R7:
  - It reads `#progress-data`, adds `js` to the section, and makes the plots
    focusable with `role`, `tabindex` and `aria-describedby`. It shows the help
    and the readout.
  - It keeps one state `{ period, selected }` for both charts (FR-021).
  - **Pointer events**:
    - `classifyGesture` decides between tap, drag and scroll.
    - A drag shows the stretch and zooms on release.
    - A two-pointer pinch calls `zoom` around the midpoint.
  - **Wheel**: zooms only while the plot is `document.activeElement`.
  - **Keys**: `keyAction`.
  - **Buttons and links**: the Earlier/Later/Reset buttons, and the period
    links intercepted with `preventDefault`.
  - **Each change**:
    - redraws both charts with `drawChart` inside `requestAnimationFrame`;
    - updates the `aria-label`s (from `text.chartTraining`/`chartTeam`) and
      `aria-current`;
    - shows the move buttons only while zoomed;
    - calls `history.replaceState(null, "", "/me" + periodQuery(...) +
      "#progress")`;
    - sets `header input[name=next]` to `/me` + that query.
  - **Selecting a day**: sets `markerPath` in both charts and fills the readout
    from `text.day`. It formats with `Intl.NumberFormat`/`DateTimeFormat`
    (`intlLocale`).
  - If anything throws, nothing replaces the server markup (FR-052).
  - No `fetch`, cookie or storage.

  `pnpm typecheck` (both projects) and `pnpm lint` pass.

**Checkpoint**: PR 1's feature is complete. `pnpm test` passes, and the curves,
table, periods and zoom work on `pnpm dev`.

---

## Phase 4: Delivery 1 wrap-up (PR 1)

- [ ] T024 [P] In `specs/005-rider-view/contracts/rider-page.md`, at the section
  order, add one line: 009's [contracts/rider-page.md](../../009-rider-progress-charts/contracts/rider-page.md)
  adds `section#progress` between `section.rynke-rules` and `section#rides`.
  In `specs/005-rider-view/contracts/http-routes.md`, add one line pointing at
  009's query parameters.
- [ ] T025 [US3] Diagram check for delivery 1 (FR-092, US3 scenario 3). Compare
  the build with the spec's D0–D7 and the plan's P1–P6:
  - module imports (P1);
  - the batch order (P2);
  - the curve flow (P3);
  - drawing and script (P4);
  - period states (P5);
  - the layout at 360 px in `pnpm dev`'s device mode (P6, D3/D4).

  Where the build differs for a reason the spec allows, update the diagram in
  the same change (FR-091). A difference the spec doesn't allow is a bug in the
  code, so fix the code instead.
- [ ] T026 Run `pnpm lint`, `pnpm typecheck` and `pnpm test`. All pass.

**Checkpoint**: PR 1 (US1) is ready. The `pnpm dev` walk-through in
[quickstart.md](quickstart.md) §2 and the checks on the live site after release
are manual and get no task.

---

## Phase 5: User Story 2 - Rider sees whether they are on pace and how much may come from virtual rides (Priority: P3)

**Goal**: with a deadline, both charts get the pace line, and the readout gives
the pace and ahead/behind. With virtual rides, the Training chart gets the curve
without virtual rides and the line at 167, and the table gets that column
(contracts/rider-page.md "Additions of User Story 2").

**Independent test**: T027–T031 pass.

The **virtual rider** used below is the example rider plus ten `VirtualRide`s of
100 km with 0 m on 2026-09-08 … 2026-09-17 (`isVirtual: true`, 10 each). Their
balance:
- `distanceRynke` 162, `trainingRynke` 212 and `trainingMissing` 38;
- `trainingWithoutVirtual` 112 and `virtualShareMissing` 55;
- everything else as the example rider.

### Tests for User Story 2

- [ ] T027 [P] [US2] In `test/unit/curve.test.ts`, for the virtual rider (it
  may pass at once, since T014 already yields the value; it pins US2's data):
  - On 2026-10-07, `training` is 212 and `trainingWithoutVirtual` is 112: 100
    below (US2 scenario 3).
  - On 2026-09-07 the two are equal.
- [ ] T028 [P] [US2] In `test/unit/progress-view.test.ts` (failing):
  - **Pace**: with the deadline 2027-05-31, `pace` is `{ deadline:
    "2027-05-31", totalDays: 273 }`. Without a deadline it is `null` (US2
    scenario 2).
  - **Without virtual rides**: `withoutVirtual` is `{ needed: 167 }` when
    `virtualCount > 0`, and `null` without virtual rides (US2 scenario 4).
  - **Table**: the virtual rider's weeks get `withoutVirtualTotal` (112 in the
    last row). Without virtual rides it is `null`.
- [ ] T029 [P] [US2] In `test/unit/chart.test.ts` (failing):
  - `pacePath(threshold, yMax, period, seasonStart, totalDays)` runs from (0,
    100) on the season start to the threshold's y on the deadline.
  - `paceOn(250, 34, 273)` is 31 and `paceOn(25, 34, 273)` is 3 (US2
    scenario 1).
  - `dayReadout(text, …)` on 4 October contains "112", "Tempo: 31" and "81 vor
    dem Tempo". Behind the pace it gives "… hinter dem Tempo", and on the pace
    "genau im Tempo". It never says a rule was broken (US2 scenario 5).
- [ ] T030 [P] [US2] New `test/unit/progress-section.test.ts` (failing), because
  no stored rules version has a deadline yet. Call `renderProgress(createI18n("de",
  CATALOGS), view, 1)` with a `ProgressView` built for deadline rules:
  - Each chart has a `path.line-pace` and the legend "Gleichmäßiges Tempo bis
    zum Stichtag".
  - The JSON `pace` is `{ "deadline": "2027-05-31", "totalDays": 273 }`.
  - `text` gains `pace`, `ahead`, `behind`, `onPace` and `withoutVirtual`.

  Without a deadline, there is no `line-pace`.
- [ ] T031 [P] [US2] Tests in the existing files (failing):
  - **`test/integration/me-progress.test.ts`**, the virtual rider:
    - The Training chart has `path.line-without-virtual` and `path.line-needed`,
      the label 167, and the legend "Trainingsrynke ohne virtuelle Fahrten" and
      "Nötig ohne virtuelle Fahrten (167)".
    - The JSON's `withoutVirtual.values[36]` is 112 and `needed` is 167.
    - The table has a sixth column, last cell 112.
    - The Team chart has neither. The example rider has neither (US2
      scenarios 3 and 4).
  - **`test/unit/catalogs.test.ts`**: the 7 US2 IDs in `CONTRACT_IDS`.

### Implementation for User Story 2

- [ ] T032 [P] [US2] Add the 7 US2 `progress.*` keys of contracts/messages.md to
  `src/i18n/messages/de.ts` and `en.ts`.
- [ ] T033 [US2] In `public/progress/chart.js`:
  - add `pacePath`, `paceOn` and `dayReadout`;
  - `drawChart` takes optional `pace` and `withoutVirtual` and returns their
    paths and the `needed` line;
  - `.line-pace`, `.line-without-virtual` and `.line-needed` are already in the
    CSS (T019).

  T029 passes.
- [ ] T034 [US2] In `src/http/progress-view.ts`:
  - fill `pace` (the rules' deadline, and `totalDays` from the season start to
    it, inclusive);
  - fill `withoutVirtual` (`virtualCount > 0`, `needed:
    virtualShareRequired(rules)`);
  - fill `WeekRow.withoutVirtualTotal`.

  T028 passes.
- [ ] T035 [US2] In `src/http/progress-section.ts`, render the additions of
  contracts/rider-page.md: the paths, the legend entries, the label at 167, the
  table column `rynke.withoutVirtual`, and the JSON's `pace`,
  `withoutVirtual` and extra `text`. In `public/progress/progress.js`, the
  readout uses `dayReadout`. T027, T030 and T031 pass.

**Checkpoint**: PR 2 (US2) is ready. Nothing PR 1 shows is taken away (FR-004).

---

## Phase 6: User Story 3 - Diagrams checked against the build (Priority: P2)

**Goal**: FR-092. The tasks end by checking the built section against every
diagram.

- [ ] T036 [US3] Repeat T025 for the whole feature, including US2:
  - the pace line and the curve without virtual rides in D3/D4 and P4;
  - the readout's lines in D5;
  - the example rider's curves in D7, against T006's figures.

  Update any diagram that the build changed for a reason the spec allows
  (FR-091).
- [ ] T037 Run `pnpm lint`, `pnpm typecheck` and `pnpm test`. All pass.

---

## Dependencies & Execution Order

- T001 → T002 → Phase 2 (T003–T005) → US1 (T006–T023) → T024–T026 (PR 1) →
  US2 (T027–T035) → T036–T037 (PR 2).
- **Within Phase 2**: T003, T004 and T005 are independent. T004's
  `CountingRide` import is settled by T015.
- **Within US1**:
  - T006–T013 are written first.
  - T014 needs T005.
  - T015 needs T004.
  - T016 is independent of T014 and T015.
  - T017 needs T014, T015 and T016.
  - T020 needs T016–T019.
  - T021 needs T017 and T020.
  - T022 needs T021.
  - T023 needs T016 and T020's markup.
- **Within US2**:
  - T027–T031 are written first.
  - T033 and T034 are independent.
  - T035 needs T032–T034.

### Parallel opportunities

```text
Phase 2:      T003, T004, T005 together.
US1 tests:    T006–T013 together (different files).
US1 code:     T014, T015, T016, T018, T019 together; then T017; then T020–T023.
US2 tests:    T027–T031 together.
US2 code:     T032, T033, T034 together; then T035.
```

## Implementation Strategy

- **PR 1** (Phases 1–4, MVP): the curves, periods, zoom, table and readout.
  Releasable alone (FR-004).
- **PR 2** (Phases 5–6): the pace line and the curve without virtual rides. No
  stored rules version has a deadline yet, so the pace shows only once one
  does. T030 covers it until then.
- Corrections (feature 003 Story 6) join the curve when they are built, as
  extras dated by their day (data-model.md). Until then the test data stands in
  for the spec's +10 correction with a ride (see "The example rider as test
  data").
- The `pnpm dev` walk-through and the checks with real phones, the wheel and a
  screen reader happen on the live site after release and get no task (memory
  "manual tests after deploy").
