# Research: Rider View of Own Rynke

Decisions behind [plan.md](plan.md). Each one names the requirements it serves.
There were no open questions left in Technical Context; these decisions settle
the design choices the spec left to planning.

## R1. Extend `/me`; table pages are `/me?page=N` (FR-001, FR-045, FR-046)

- **Decision**: The Rynke sections go into the existing `GET /me` (feature 001,
  `src/http/me.ts`). The ride table's pages are the same route with a query
  parameter, `/me?page=N`. Paging links end in `#rides`, so the browser lands on
  the table. No second page.
- **Rationale**: Nothing argues for a second page. The rider page is already
  where a signed-in rider lands, it is already gated by the session, and its
  existing list of 20 rides is the first table page (FR-040, FR-045). A query
  parameter keeps the language switcher, the session check and the layout as
  they are. FR-001 needs no spec change.
- **Alternatives considered**: `/me/rides?page=N` for the full table, rejected
  because it splits the table from the list it extends, which FR-045 rules out.
  Client-side paging over all rides, rejected because it sends up to 500 rows on
  every view (SC-005) and needs JavaScript.

## R2. One D1 batch per page view (FR-003, FR-005, FR-046, SC-004)

- **Decision**: `readRiderView(db, athleteId, page)` in the new
  `src/db/rider-view.ts` sends **one** `db.batch` with four read statements:
  1. the rider's `rynke_balances` row;
  2. the counts: stored rides (`activities`) and virtual rides (`ride_results`
     with `is_virtual = 1`);
  3. one table page (`RIDE_PAGE_SQL`, exported for the query-plan test of
     SC-005): `activities` `LEFT JOIN ride_results`, plus `LEFT JOIN
     activities` on `overlaps_activity_id` for the ride that counted instead,
     newest first (`start_date DESC, strava_activity_id DESC`, as
     `listRecentActivities`), `LIMIT 20` and an `OFFSET` clamped to the last page
     inside SQL:
     `OFFSET min((?2 - 1) * 20, max(0, ((SELECT count(*) …) - 1) / 20 * 20))`;
  4. the rider's attendance with each event's kind, date and name, newest first
     (`event_date DESC, event_id DESC`): feature 003's
     `listRiderAttendanceStatement`, the same read its evaluation uses (US3b).

  The corrections become a fifth statement of the same batch once feature 003
  Story 6 exists (R5). The balance and result rows go through feature 003's
  exported mappers `toStoredBalance` and `toStoredRideResult`, so the page maps
  them exactly as the evaluation does. The rider, consent and import status
  keep coming from feature 001's own reads, as today.
- **Rationale**: D1 runs a batch as one transaction, so all statements see the same
  state. A balance can therefore never sit next to ride results from another
  moment or rules version. Feature 003's `readRynke` relies on the same property
  (its research R11). Clamping in SQL means a page number past the last page
  shows the last page in the same reading, with no redirect and no second round
  trip. SQLite accepts a scalar subquery in `OFFSET` (checked with SQLite 3 for
  page 99 of 5 rows). Only `SELECT`s are sent, so the page can't write (SC-004).
- **Alternatives considered**: reusing `readRynke`, rejected because it reads
  every ride result of the season and no activities, so the page would join 500
  rows in memory to show 20. A redirect to the last page, rejected because it
  costs a round trip, and the SQL clamp is simpler.

## R3. Rule values: the version in effect and older versions (FR-013, FR-050, FR-051)

- **Decision**:
  - The rules in effect are `CURRENT_RULES` (feature 003 research R8).
  - `src/rynke/rules.ts` gains `RULES_HISTORY: readonly RynkeRules[]`, which
    holds every version still worth explaining, `CURRENT_RULES` included, and
    `rulesForVersion(version): RynkeRules | null`.
  - When a developer raises the version, the old object stays in the history,
    and a unit test checks that versions are unique and that `CURRENT_RULES` is
    the highest.
  - The page takes every rule value it shows (thresholds, the amount needed
    without virtual rides, steps, limits, the deadline) from
    `rulesForVersion(balance.rulesVersion)`, or for a reason from
    `rulesForVersion(result.rulesVersion)`.
  - When that is `null`, the values and the gauges that need them are left out
    (FR-013).
- **Rationale**: Feature 003 re-evaluates riders stored under another version
  in the daily cron (its research R14), so after a version bump a rider can see
  older numbers for up to a day. Keeping the old object (about 20 lines per
  version) means the page stays complete during that day and doesn't drop its
  thresholds and gauges. The spec's Assumptions allow this. The `null` path still
  covers versions dropped from the history and the database-stored rules of
  feature 003 Story 5, where `rulesForVersion` becomes a read.
- **Alternatives considered**: the current rules only, which follows the spec
  but hides thresholds and gauges for up to a day after every rule change.
  Rejected, because keeping the old object costs almost nothing. Storing the
  rule values in each balance row, rejected because it changes feature 003's
  schema, and Story 5 will store rules properly.
- **Required amount without virtual rides**: `tally.ts` computes 167 from the
  threshold and `maxVirtualShare`. The page needs the same figure as a target,
  so that line moves into an exported `virtualShareRequired(rules)` that
  `tally()` calls. It is one definition, and the page never repeats the
  arithmetic.

## R4. When the page says "being updated" (FR-051, SC-006)

- **Decision**:
  - The notice shows exactly when a balance is stored and
    `balance.rulesVersion !== CURRENT_RULES.version`.
  - The numbers are labelled with `balance.rulesVersion` and its
    `rulesEffectiveDate`. The notice names the date of the rules in effect
    (`CURRENT_RULES.effectiveDate`).
  - "Differs" rather than "older": a version higher than the code's appears only
    while a deploy is rolled back, and then the numbers are also about to change.
- **Rationale**: Feature 003 writes a rider's balance and ride results in one
  batch with one version (its FR-014b, R11), so the balance's version is the
  version of every result on the page. One comparison, no second query.
- **Alternatives considered**: also comparing every shown ride result's version,
  rejected because it is redundant by feature 003's invariant and a second source
  of truth for one fact.

## R5. Inputs that don't exist yet (FR-032–FR-034, FR-022, FR-002, FR-006)

What other features still have to build, and how this plan handles it:

| Input | Built by | State on 2026-10-07 | Effect here |
|---|---|---|---|
| Team events, attendance | feature 003 Story 3 | **merged** (`team_events`, `attendances`, `team_event_kinds`) | US3's event-kind rows and event list (FR-032, FR-033): built (US3b, team events) |
| Per-kind breakdown in `rynke_balances` | feature 003 FR-014a, Story 3 | **merged** (`team_event_breakdown`, JSON, one entry per kind in `TEAM_EVENT_KINDS` order) | the kind rows and the event segments of both gauges, from the stored values only (FR-004) |
| Corrections | feature 003 Story 6 | spec only | US3's correction sums and list (FR-034); FR-022's corrections segment and its "negative → undivided" rule; FR-035's "never below 0" note |
| Correction sums in `rynke_balances` | feature 003 FR-014a, Story 6 | not stored | the same; the page must not compute them (FR-004) |
| Stored, organiser-editable rules | feature 003 Story 5 | code constant | `rulesForVersion` becomes a read (R3) |
| Re-asking for a changed consent | feature 004 FR-013 | spec only | `/me` keeps its current consent section; the gate arrives with feature 004 for every page |

- **Decision**: US3 is planned in two parts.
  - **US3a** (no dependency): distance Rynke, the elevation total with its Rynke,
    step and metres to the next step, and the totals the parts add up to.
  - **US3b**: the three event-kind rows, the event list, the correction sums and
    list, and the "never below 0" note. It reads feature 003's tables and
    balance columns, and is built in two steps as they arrive:
    - **team events** (Story 3, merged): the kind rows, the event list, and the
      kind segments of the Training and Team gauges;
    - **corrections** (Story 6, still to come): the correction sums and list,
      the corrections segment with its "negative → undivided" rule, and the
      "never below 0" note. Without corrections a total can't be clamped
      (feature 003 `tally`), so the note has nothing to say before them.

  Until a source exists, the page shows no row and no line for it rather than
  zeros for something nobody can record yet. A balance stored before Story 3
  (an empty `team_event_breakdown`, rules version 1) shows no kind rows: it was
  computed without events, and the "being updated" notice is shown next to it
  (R4).
- **Rationale**: Zeros before team events can be recorded would read as "you
  attended none", which is wrong, and riders would ask organisers about it.
  Computing per-kind Rynke from counts on the page would break FR-004. Everything
  else in the spec can be delivered now.
- **Alternatives considered**: delaying all of US3 until feature 003 Stories 3
  and 6 are done, rejected because the distance and elevation part answers "where
  do my Rynke come from" for the only source that exists today. Building feature
  003 Stories 3 and 6 inside this feature, rejected because it is out of scope and
  has its own spec.

## R6. A pure view model between the read and the HTML (FR-004, FR-013, FR-020)

- **Decision**:
  - `src/http/rider-view.ts` holds pure functions that turn what
    `readRiderView` returned, the rules lookup and the rules in effect into a
    `RiderView`: summary, gauges, breakdown, ride rows, pager and notices
    ([data-model.md](data-model.md)). It has no I/O, no `I18n` and no clock:
    `buildRiderView(read, rules, inEffect, context)` takes the season start,
    whether the import is running, and `rulesForVersion` (for each ride
    result's own version) in its `ViewContext`.
  - `src/http/rider-sections.ts` renders one section per function from a
    `RiderView` and an `I18n`.
  - `src/http/me.ts` parses `page`, calls the read, builds the view and places
    the sections.
- **Rationale**: Gauge percentages at the boundaries (SC-009), segment shares,
  reason figures and paging maths are what can go wrong, and as pure functions
  they get exhaustive unit tests without D1. The HTML stays a thin mapping, and
  can be swapped for a Material Design look later without touching the
  arithmetic (Assumptions).
- **Alternatives considered**: computing inside the templates, as `me.ts` does
  today for its four columns, rejected because it is fine for formatting but not
  for gauge rounding and reason limits, which need boundary tests.

## R7. Gauges are plain HTML and CSS bars (FR-020–FR-026, SC-009)

- **Decision**: A gauge is markup:

  ```html
  <figure class="gauge">
    <figcaption>…label · figures · reached…</figcaption>
    <div class="gauge-bar" aria-hidden="true">
      <span class="gauge-part gauge-part-1" style="width:…%"></span>…
    </div>
    <ul class="gauge-legend">…</ul>
  </figure>
  ```

  - **Percentage**: `Math.floor(value * 100 / target)`, capped at 100. These are
    integers below 10⁶, so the result is exact. 249 of 250 is 99, 250 of 250 is
    100, 262 of 250 is 100.
  - **Reached**: `value >= target`. It is shown as a word and a ✓ in the
    caption, not only as a colour.
  - **Segments**: each part's width is `part / max(total, target) × 100`, to two
    decimals. The filled width is the same share as the percentage, and above
    the target the parts fill the whole bar in proportion. An empty remainder is
    the bar's own background. Parts of 0 get no segment.
  - **Elevation gauge**: `(step − toNext) / step`, in decimetres. For example,
    1240 m gives 2400 of 10000, which is 24%.
- **Rationale**: There is no JavaScript on the site and no reason to add it. A
  sized `<span>` renders the same everywhere, works at any width, and needs no
  dependency (Principle IV). `<progress>` and `<meter>` can't show parts and
  look different in every browser. The arithmetic lives in the view model (R6),
  so the markup only prints numbers.
- **Alternatives considered**: inline SVG, rejected because it is more markup for
  the same result and harder to restyle for Material Design. A chart library,
  rejected because it is a dependency and client JavaScript for four bars. Rounding
  to the nearest percent, rejected because 249.5/250 would show 100% before the
  threshold is reached (FR-020).

## R8. Gauges without colour or sight (FR-025)

- **Decision**:
  - The bar is `aria-hidden`. Its full meaning is in text next to it: the caption
    reads, for example, "Trainingsrynke: 210 von 250 · 84 %". The legend lists
    each part with its number, in the same order as the segments.
  - Segments are told apart by a 2 px white gap and by their order as well as
    their colour.
  - "Reached" is a word and a ✓, not a colour.
  - The numbers of FR-010–FR-012 stay in the summary above the gauges (FR-026).
- **Rationale**: This is the simplest way to meet FR-025: everything a gauge says
  is already printed.
- **Alternatives considered**: `role="img"` with an `aria-label` on the bar,
  rejected because the label would repeat the caption, and screen readers would
  read it twice.

## R9. Phones with CSS only (FR-070–FR-072, SC-010)

- **Decision**: All rules go into the shared `STYLE` in `src/http/html.ts`,
  scoped to this feature's classes. Other pages are left alone (issue #20).
  - Gauges are block elements at 100% width, so they always stack. There are no
    side-by-side gauges, on desktop either, where the page is only 40rem wide.
  - The ride table (`table.rides`) keeps date, distance, "counts?", Training
    Rynke and metres as columns. Sport type, elevation gain, the virtual mark,
    reasons, unknown figures and the fix hint go into a second row per ride
    (`tr.ride-details`, one cell spanning all columns). That works on both
    desktop and phone, and keeps the main row at 5 short columns, which fit in
    360 px.
  - Below `36rem`, the table cells get smaller padding, and numbers don't wrap
    (`white-space:nowrap` on number cells). The detail row's text wraps.
  - Pager links and the handout link are at least 44 × 44 px
    (`min-height:44px;min-width:44px;display:inline-flex;align-items:center`).
  - Long words such as German compounds wrap, through
    `overflow-wrap:anywhere` on `main`.
- **Rationale**: The detail row solves FR-071 without a separate card layout,
  and doesn't hide anything on either screen. One stylesheet with no media-query
  tricks is easy to replace with Material Design later.
- **Alternatives considered**: turning each `td` into a block on phones with
  `data-label::before`, rejected because it doubles the label text, needs more
  CSS, and the main row already fits. A separate mobile template, rejected
  because it duplicates the markup.

## R10. Ready for Material Design later (Assumptions)

- **Decision**:
  - Markup is semantic, with stable class names: `rynke-summary`, `gauge`,
    `gauge-bar`, `gauge-part-N`, `gauge-legend`, `rynke-breakdown`,
    `rynke-rules`, `notice`, `rides`, `ride-details`, `pager`.
  - The colours are 6 CSS custom properties (`--rp-part-1` … `--rp-part-6`,
    `--rp-reached`, `--rp-track`) on `:root`.
  - No styling decision lives in the TypeScript, except a segment's width.
- **Rationale**: A later restyle changes `STYLE` and maybe the wrapper elements.
  The view model and the tests that check figures stay the same.
- **Alternatives considered**: adopting a Material CSS library now, rejected
  because the spec defers it and it would be a dependency.

## R11. Paging (FR-045, FR-046, US5)

- **Decision**:
  - **The page number**: `page` comes from the query. Anything that is not
    `^[1-9][0-9]{0,3}$` counts as 1. SQL clamps it to the last page (R2), and
    the view model reports the page actually shown (`min(requested, lastPage)`,
    computed from the count read in the same batch).
  - **Position text**: "Fahrten {from}–{to} von {total}".
  - **Links**: first, previous, next and last are `<a href="/me?page=k#rides">`.
    Links that don't apply are left out, not shown disabled. With 20 rides or
    fewer, there is no pager.
  - **Language switch**: the layout's `path` is `/me?page=N` when N > 1.
    `safeNext` in `src/http/lang.ts` accepts `/me?page=<digits>`, in addition to
    the existing exact paths, so switching the language keeps the table page.
  - **US1**: the first delivery always reads page 1 and shows no pager. US5 only
    adds the parameter, the pager and the `safeNext` rule.
- **Rationale**: Offset paging is enough for at most 500 rows, and the rider index
  `activities_by_rider (athlete_id, start_date DESC)` serves the order. Rides
  moving between pages in between are accepted (FR-046).
- **Alternatives considered**: keyset paging (the `start_date` of the last row),
  rejected because it can't jump to the last page or say "21–40 of 45" without
  extra queries.

## R12. Reason figures and their rounding (FR-042–FR-044, SC-003)

- **Decision**: The view model derives each reason's figures from the ride's
  activity columns, which FR-004 allows. The limit comes from
  `rulesForVersion(result.rulesVersion)`, or is left out when that is `null`
  (FR-013). The text then uses the reason's variant without a limit.
  - **Flagged by Strava**: no figure. The text says to settle it with Strava.
  - **Pause**: paused = `elapsed_time_s − moving_time_s`, shown in h and min
    with minutes rounded down. Moving time is shown with minutes rounded down
    too. The limit is the share from `maxPausedShare`, as "mehr als die Hälfte".
    The catalog has one text per known share: ½ today, and a generic
    "{num}/{den}" text otherwise.
  - **Too slow**: `distance_m × 3.6 / moving_time_s` km/h, to one decimal,
    **rounded down**, against `minSpeedKmh`.
  - **Too fast**: the same speed, **rounded up**, against `maxSpeedKmh`.
  - **Climbing rate**: `round(elevation_gain_m × 10) × 360 / moving_time_s` m/h
    (the decimetres feature 003 compares), as a whole number, **rounded up**,
    against `maxClimbMPerH`.
  - **Excluded sport type**: the sport type's existing `sport.*` text.
  - **Outside the counting window**: before the season start
    (`SEASON_START_DATE`) or after the deadline (`qualificationDeadline`), with
    the date. Which of the two applies is told by the ride's local date against
    the season start.
  - **Overlap**: the joined activity's local date, local start time and distance
    (R2). If the join finds nothing, which is a race feature 003 rules out,
    the text names no ride.
  - **Manual entry**: no figure.
  - **Unknown code**: the general text.
  - **Fix hint**: shown once per ride when its reasons include `pause`,
    `too_slow`, `too_fast`, `climbing_rate` or `manual` (FR-044).
  - **Unknown figures**: one line per code in `unknownFigures`, plus "may still
    change" (FR-043).
- **Rationale**: Rounding towards the side of the violated limit means a shown
  figure never seems to satisfy the limit, so "9,9 km/h" never appears as
  "10,0 km/h, below 10 km/h". With zero moving time, feature 003 records only
  `pause` (its research R7, `reasonsFor`). The page then says the ride had no
  moving time, and shows no paused time, which may be unknown, and no speed.
- **Alternatives considered**: storing the figures in `ride_results`, rejected
  because it changes feature 003's schema for numbers that are derivable from
  stored activity data.

## R13. Formatting (FR-060, FR-061)

- **Decision**:
  - `I18n` gains `formatTime(iso)`, the UTC wall-clock `HH:MM` of
    `start_date_local`, which carries local time with a `Z` (as `formatDate`).
  - Numbers use the existing `formatNumber`, which groups digits per locale:
    "1.240" in German, "1,240" in English.
  - Percent, duration, km/h, m/h and the position text are catalog messages
    with parameters, for example `units.percent` "{value} %" in German and
    "{value}%" in English.
  - **Metres**: totals are rounded down to whole metres, and missing metres are
    rounded up. The per-ride metres for the elevation total are
    `elevationDm / 10`, rounded like the elevation gain column, so the two show
    the same figure.
- **Rationale**: These are the smallest additions that cover the spec's formats.
  The rounding directions mean the page never claims more progress than stored.
- **Alternatives considered**: `Intl.NumberFormat` with `style:"percent"` and
  `style:"unit"`, rejected because of its spacing and unit names in de-DE and
  en-GB ("84 %", "84%", "km/h") in Workers' ICU. Catalog strings make each
  language's format visible and testable.

## R14. Rules handout link (FR-053)

- **Decision**: `RULES_HANDOUT_URL =
  "https://github.com/SaSteffen/RynkePoints/blob/main/docs/rynke-punkte.md"` is a
  constant in `src/http/rider-sections.ts`. The link text comes from the catalog.
  The English text says "(in German)".
- **Rationale**: The handout is published in the public repository (spec
  Assumptions), and GitHub renders it, mermaid included. A URL is not
  rider-facing text, so it doesn't belong in the catalogs. `landing.ts` builds
  the Strava club link the same way.
- **Alternatives considered**: serving the Markdown or PDF from the Worker,
  rejected because the spec rules it out.

## R15. When the virtual-ride share is shown (FR-012)

- **Decision**: The share is shown when at least one stored ride result of the
  rider has `is_virtual = 1`, whether or not it counts. This is the `virtual`
  count in the batch (R2).
- **Rationale**: This is the spec's wording ("at least one of the rider's rides
  is a virtual ride"). Without a counting virtual ride, the share equals the
  Training total and can't be the only thing missing (edge case), so showing it
  is harmless.
- **Alternatives considered**: only when a virtual ride counts, rejected because
  it is a second rule for the same thing, and riders with an e-trainer ride that
  didn't count would wonder where the gauge went.

## R16. Tests (Principle V; SC-002–SC-010)

- **Decision**: Test-first, as in features 001 and 003:
  - **Unit** (`test/unit/rider-view.test.ts`): gauge percentages just below, at
    and above each threshold (SC-009); segment widths; elevation gauge on and
    off a step; summary and missing amounts; rule values left out for an unknown
    version (FR-013); the "being updated" decision (SC-006); paging maths; every
    reason's figures and rounding direction; the fix hint and unknown figures.
  - **Unit** (`test/unit/rules.test.ts`, extended): `RULES_HISTORY` versions are
    unique, `CURRENT_RULES` is the highest, and `rulesForVersion` finds each one.
    `virtualShareRequired` gives 167.
  - **Integration** (`test/integration/me-rynke.test.ts`): one test per
    acceptance scenario of US1, US2, US3a, US4, US5 and US6, through
    `handleFetch` with seeded `rynke_balances`, `ride_results` and
    `activities`, asserting the German text. A test case for SC-007 has two
    riders. For SC-004, a test opens every table page and checks that
    `tableCounts()` and a row snapshot are unchanged, that the fake queue
    received nothing, and that fake Strava saw no request.
  - **Integration, existing files extended**:
    - `lang-switcher.test.ts`: `/me?page=2` survives a switch, and anything else
      after `?` is refused.
    - `language-rendering.test.ts`: the Rynke sections are fully German and
      fully English (SC-008).
    - `no-hardcoded-copy.test.ts`: the new modules hold no rider-facing literals.
    - `catalogs.test.ts`: every `REASON_CODES` and `UNKNOWN_FIGURE_CODES` value
      has a text in each language (SC-003, FR-062).
  - **Performance (SC-005)**: an integration test seeds 500 rides, renders
    pages 1 and 25, and checks with `EXPLAIN QUERY PLAN` that the page statement
    uses `activities_by_rider` and does no full scan of `activities`. Wall-clock
    time is checked by hand ([quickstart.md](quickstart.md)), because timings in
    the test runtime are not reliable.
  - **Phones (SC-010)**: checked by hand at 360 px in a browser's device mode
    ([quickstart.md](quickstart.md)). Tests assert the markup the CSS depends on
    (classes, the detail row, the pager links).
- **Rationale**: Each automatable success criterion gets a test, and those that
  need a real screen or real timing get a documented manual check, as feature 003
  did for its handout.
- **Alternatives considered**: a headless browser for layout tests, rejected
  because it is a dev dependency and CI cost for a one-page feature. Issue #20 can
  bring one in for the whole site.

## R17. No dependency, no migration (Principle IV)

- **Decision**: no new runtime or dev dependency and no migration. Every column
  the page needs exists in `0001`, `0003` and `0005`. US3b's reads arrive with
  the migration of feature 003 Stories 3 and 6.
- **Rationale**: The page only reads (FR-003). The index the table needs exists
  (R11).
