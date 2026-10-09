---
description: "Task list for the team leaderboard and organiser overview"
---

# Tasks: Team Leaderboard and Organiser Overview

**Input**: Design documents from `/specs/016-team-leaderboard/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: REQUIRED (constitution Principle V). Write each test task first, run it
and confirm it fails, then implement. Riders are synthetic and nothing contacts
Strava. The live-site check after release has no tasks ([quickstart.md](quickstart.md) §3).

**Organization**: one phase per user story. The spec gives US1, US2 and US4 P1 and
US3 P2; the phases run US1 → US2 → US3 → US4 because US1–US3 all build `/team`
and US4 is a separate page. The quotes (`src/i18n/messages/quotes.de.ts`) and their
copy-guard exemption are already committed.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 (place and leaderboard), US2 (team progress), US3 (quote),
  US4 (organiser overview)

## Phase 1: Setup

- [ ] T001 Run `pnpm install --frozen-lockfile`, then `pnpm lint`, `pnpm typecheck`
  and `pnpm test`. All pass before any change, so later failures are this
  feature's.

---

## Phase 2: Foundational (blocks every story)

**Purpose**: the one read batch, the weekly history and the even pace, which both
pages need.

### Tests (write first, confirm they fail)

- [ ] T002 [P] `test/unit/weeks.test.ts` for `src/rynke/weeks.ts` (research R1, R3,
  data-model.md `WeekPoint`):
  - `weekEnds(seasonStart, lastDay)`: Sundays from the first Sunday on or after
    the season start up to the week holding `lastDay`, the last entry being
    `lastDay` itself; a season starting on a Wednesday gives a short first week;
    `lastDay` on a Sunday ends on that Sunday; a `lastDay` before the season start
    gives exactly one week end.
  - `lastDay(today, deadline)`: today, or the deadline once it has passed, or
    today when the deadline is null.
  - `riderWeeks(inputs, rules, weekEnds, balance)`: distance and elevation sums
    accumulate per week with elevation floored on the running total (not per
    week); attendance counts from its event date and corrections from their
    `correction_date`, both through `tally`; a negative correction floors the
    total at 0; the last point equals the stored balance's `trainingRynke` and
    `teamRynke` even when the rebuilt figure would differ (a future-dated event);
    a rider with no balance and no inputs gives every point 0.
- [ ] T003 [P] `test/unit/pace.test.ts` for `src/rynke/pace.ts` (research R4,
  FR-030, data-model.md `RiderStatus`):
  - `evenPace(amount, seasonStart, deadline, day)`: 0 on the season start,
    `amount` on the deadline, ⌊amount × elapsed ÷ total⌋ midway (a case where it
    rounds down), clamped to 0 before the start and to `amount` after the
    deadline.
  - `riderStatus(balance, rules, today)`: `"in"` when `balance.qualified`;
    `"push"` when Training alone, Team alone or outdoor Training
    (`trainingWithoutVirtual` against `virtualShareRequired`) alone is below its
    even pace; `"on_track"` when all are on or above it; with
    `qualificationDeadline: null` or a deadline before `today` only `"in"` or
    `"push"`; a rider without a balance (null) is `"push"`.
- [ ] T004 [P] `test/integration/team-read.test.ts` (new) for `src/db/team.ts`
  against the test D1: `readTeam(db)` returns the listed riders (014's
  `listListedRidersStatement`: connected and sharing consent; a rider without
  consent and one with `needs_reconnect` are missing), their balances, the weekly
  ride sums, attendance with event dates and corrections with
  `correction_date`. The weekly sums: two counting rides on Monday and Sunday of
  one week land in the same `week_end` (that Sunday); a ride on the next Monday
  in the next week; a ride with `counts = 0` is left out; elevation comes back in
  decimetres unfloored (research R2).

### Implementation

- [ ] T005 Add `correction_date` to the columns of
  `listCorrectionsOfRidersStatement` and its row type in `src/db/corrections.ts`;
  keep every existing caller compiling.
- [ ] T006 Create `src/db/team.ts`:
  - `listWeeklyRideSumsStatement(db)` with research R2's SQL (`date(substr(
    a.start_date_local, 1, 10), 'weekday 0') AS week_end`, `SUM` of
    `distance_rynke` and `elevation_dm`, `counts = 1`, riders limited to
    `SHARED_RIDER_IDS` and `status = 'connected'`, `GROUP BY 1, 2`).
  - `readTeam(db)`: one `db.batch` of the five statements in
    [data-model.md](data-model.md) "Read per request" (listed riders, balances,
    weekly sums, attendance, corrections), returning typed arrays. Only
    `SELECT`s (research R11). T004 passes.
- [ ] T007 [P] Create `src/rynke/weeks.ts` with `weekEnds`, `lastDay` and
  `riderWeeks` as in T002, reusing `tally`, `extrasFrom`, `evaluateAttendance`
  and `rulesForVersion` (falling back to `CURRENT_RULES` for an unknown version).
  "Values never fall below 0". T002 passes.
- [ ] T008 [P] Create `src/rynke/pace.ts` with `evenPace` and `riderStatus` as in
  T003. Dates are `YYYY-MM-DD` strings (today is `berlinDate(ctx.now())` at the
  caller); whole days are the difference of their `Date.UTC` values ÷ 86 400 000.
  T003 passes.

**Checkpoint**: the read and the pure history and pace are tested; no page changed
yet.

---

## Phase 3: User Story 1 — Where the rider stands (Priority: P1) 🎯 MVP

**Goal**: `/team` shows the viewer's place, the Rynke to the next place, and the
leaderboard around them with medals, the other kind and sparklines; a kind switch
and an "Everyone" toggle.

**Independent Test**: `pnpm dev`, sign in as a sample rider in the middle of the
team, compare places, totals and rows with hand-worked figures for both kinds and
both list modes ([quickstart.md](quickstart.md) §2 steps 1–2).

### Tests for User Story 1 (write first, confirm they fail)

- [ ] T009 [P] [US1] `test/unit/leaderboard.test.ts` for `src/rynke/leaderboard.ts`
  (research R6, data-model.md `LeaderboardRow`, `Neighbourhood`):
  - order by the picked kind descending, then the other kind descending, then
    athlete ID ascending; `kind: "team"` reorders;
  - competition ranking "1, 2, 2, 4" with `joint: true` on both 2nd rows;
  - `toNext` = the smallest total above the viewer's minus the viewer's plus 1;
    1st place has none (`lead: true`);
  - `neighbourhood(rows, all)`: viewer 6th of 14 → places 3–9, `hiddenAhead` 2,
    `hiddenBehind` 5; viewer 2nd → places 1–5; viewer last → the last 4 rows;
    7 rows → every row and `toggle: false`; 8 rows → `toggle: true`;
    `all: true` → every row;
  - a viewer who is not listed → every row, no `you` row, no `Viewer`;
  - a listed rider without a balance counts with 0 in both kinds and gets a row
    (spec edge cases);
  - no returned object has an `athleteId`, `firstName` or `profileLink` key
    (checked with `JSON.stringify`).
- [ ] T010 [P] [US1] `test/unit/charts.test.ts` for `src/http/charts.ts`:
  `sparkline(values, label)` renders one `svg` with `role="img"`, the escaped
  `aria-label`, a `viewBox`, `preserveAspectRatio="none"` and one `polyline`
  whose point count equals `values.length`; all-zero values draw a flat line, not
  NaN (research R5, R12).
- [ ] T011 [P] [US1] `test/integration/team-leaderboard.test.ts` (new), through
  `handleFetch` with 14 synthetic listed riders seeded with balances, the viewer
  6th in Training, one listed rider without a balance, plus one rider without
  consent with the largest balance:
  - "6th of 14" (`team.place`), the gap to 5th, `ol` with `start="3"` and rows
    3–9, `li.row.you` with "You 🦧"/"Du 🦧", "2 … ahead" and "5 … behind";
  - `?all=1` shows 14 rows; `?kind=team` reorders and changes the place;
    `?kind=team&all=1` combines; an unknown `kind` counts as Training;
  - the links in `nav.kind-switch` and `nav.list-scope` keep the other parameter
    and mark the current one `aria-current="true"`;
  - 🥇🥈🥉 only on places 1–3; a viewer in 1st sees `team.place.lead`;
  - the HTML contains no other rider's first name, athlete ID or
    `strava.com/athletes` link, and nothing of the unconsented rider (SC-002,
    US1 #5, US2 #2);
  - the rider without a balance is counted with 0 (last place);
  - a viewer who is also an organiser is ranked like everyone else;
  - a visitor gets `302 /` (FR-001).
- [ ] T012 [P] [US1] Replace the placeholder assertions in
  `test/integration/team.test.ts` with: the Team tab is current and
  `section.leaderboard` is rendered; keep the organiser-entry cases and expect
  both links (`/organiser/riders` with `team.organiser.overview`, `/organiser`)
  for organisers only (FR-002, research R8). The consent gate on `/team` stays
  covered by `test/integration/consent-gate.test.ts`.
- [ ] T013 [P] [US1] `test/integration/team-leaderboard.test.ts`, read-only case:
  wrap `env.DB` so `prepare` throws for any statement not starting with
  `SELECT`, spy on `globalThis.fetch`, open `/team` and `/team?kind=team&all=1`:
  `200`, no throw, no `fetch` call (FR-003, SC-003, research R11).

### Implementation for User Story 1

- [ ] T014 [P] [US1] Add the `team.*` keys of
  [contracts/messages.md](contracts/messages.md) "Team page" to
  `src/i18n/messages/de.ts` and `en.ts` (the wording rule at the end of that file
  applies), plus a small English ordinal helper for `{place}` (`1st`, `2nd`,
  `3rd`, `4th`, `11th`–`13th`) in `src/i18n/` and the German `{place}.`. Remove
  `team.placeholder.heading` and `team.placeholder.body` from both catalogs and
  from the key list in `test/unit/catalogs.test.ts`; add the new keys there.
- [ ] T015 [US1] Create `src/rynke/leaderboard.ts` with `leaderboardRows(riders,
  viewerId, kind)` (the rows and the `Viewer` of [data-model.md](data-model.md))
  and `neighbourhood(rows, all)` per T009; rows carry only `you`, `place`,
  `joint`, `total`, `other`, `weeks`. T009 passes.
- [ ] T016 [P] [US1] Create `src/http/charts.ts` with `sparkline(values, label)`
  per T010 (inline SVG, no library). T010 passes.
- [ ] T017 [US1] Rewrite `src/http/sections/team.ts`: `handleTeam` reads
  `readTeam`, builds week ends from `SEASON_START_DATE` and
  `lastDay(berlinDate(ctx.now()), CURRENT_RULES.qualificationDeadline)`, each
  listed rider's `riderWeeks`, then the rows and neighbourhood; parses `kind` and
  `all` per [contracts/http-routes.md](contracts/http-routes.md) and renders in
  the order of [contracts/pages.md](contracts/pages.md) `/team` sections 2, 3, 6
  and 8 (`nav.kind-switch`, `section.my-place`, `section.leaderboard`,
  `p.organiser-entry` with two links). The sparkline label is
  `team.list.weeks` with locale-formatted values. T011, T012 and T013 pass.
- [ ] T018 [US1] In `src/http/style.ts`, add styles for `.kind-switch`,
  `.my-place`, `.leaderboard`, `.list-scope`, `li.row`, `li.row.you` and the
  sparkline: Rynkeby colours and the mini coin (012), 44 px controls (011), no
  horizontal scrolling at 360 px, light and dark (FR-040). Remove the
  placeholder's styles if nothing else uses them.

**Checkpoint**: US1 works on its own: `/team` ranks the viewer and lists the
neighbourhood.

---

## Phase 4: User Story 2 — The team's progress at a glance (Priority: P1)

**Goal**: the team total with "+N this week 🔥", the peloton of every listed
rider, and the weekly team chart with the best week and a details table.

**Independent Test**: for synthetic riders, compare the team total, this week's
gain, the weekly bars and the best week with hand-worked sums.

### Tests for User Story 2 (write first, confirm they fail)

- [ ] T019 [P] [US2] `test/unit/leaderboard.test.ts`: `teamTotals(riderWeeks,
  kind)` sums per week end; `thisWeek` = last minus previous week (0 with one
  week); `bestWeek` = the largest gain, earliest on ties, none before the second
  week (data-model.md `TeamTotals`).
- [ ] T020 [P] [US2] `test/unit/charts.test.ts`: `peloton(totals, own, label)`
  draws one mini coin per total, the viewer's larger with the `team.peloton.you`
  text, `role="img"` and the label, and no threshold line; `weekBars(points,
  label)` draws one `rect` per week with the last one marked current, `role="img"`
  and the label (research R12).
- [ ] T021 [P] [US2] `test/integration/team-leaderboard.test.ts`: on `/team` and
  `/team?kind=team`, `section.team-total` shows the sum over the 14 listed riders
  (the unconsented rider excluded) and the week's gain; `figure.peloton` has 14
  coins also on the neighbourhood view; `figure.team-chart` has one bar per week,
  `team.chart.best` with the hand-worked week, and a `<details>` table with one
  row per week (US2 #1–#3, FR-041). Seed rides in two different weeks so the
  gain is not the total.

### Implementation for User Story 2

- [ ] T022 [US2] Add `teamTotals` to `src/rynke/leaderboard.ts` per T019. T019
  passes.
- [ ] T023 [P] [US2] Add `peloton` and `weekBars` to `src/http/charts.ts` per
  T020, using `viewBox` and `preserveAspectRatio="none"` where they stretch and
  the coin symbols of `src/http/coin.ts`. T020 passes.
- [ ] T024 [US2] In `src/http/sections/team.ts`, render `section.team-total`
  (coin front for Training, back for Team; no "this week" badge when 0),
  `figure.peloton` and `figure.team-chart` with its details table in the order of
  [contracts/pages.md](contracts/pages.md) `/team` sections 1, 5 and 7. Dates use
  the locale's date format. T021 passes.
- [ ] T025 [US2] In `src/http/style.ts`, add `.team-total`, `.peloton` and
  `.team-chart` styles (current week highlighted), light and dark, 360 px.

**Checkpoint**: US1 and US2 hold; `/team` is complete except the quote.

---

## Phase 5: User Story 3 — A quote that fits the rider (Priority: P2)

**Goal**: one German quote per page load from the list that matches the viewer's
status.

**Independent Test**: sign in as a synthetic rider behind the even pace and as
one who qualifies, load Team several times, and check each quote comes from the
matching list ([quickstart.md](quickstart.md) §1 "Team page").

### Tests for User Story 3 (write first, confirm they fail)

- [ ] T026 [P] [US3] `test/unit/quotes.test.ts`: `QUOTES_PUSH` and
  `QUOTES_ON_TRACK` each have at least 180 entries, no duplicates within or
  across the lists, no empty or whitespace-only strings, and none contains `*`
  or `/` as a gender mark (research R10). It should pass at once; it pins the
  committed lists.
- [ ] T027 [P] [US3] `test/integration/team-leaderboard.test.ts`: a viewer who
  doesn't qualify gets `blockquote.quote.quote-push[lang="de"]` whose text is in
  `QUOTES_PUSH`; a viewer whose balance has `qualified = 1` gets
  `.quote-on-track` with a text in `QUOTES_ON_TRACK` (the current rules have no
  deadline, so the lists follow qualification; the deadline cases are covered by
  T003); with `rp_lang=en` the quote is still from the German list, still
  `lang="de"`, and its heading is the English `team.quote.*` (US3 #1, #2, #4).
  Stub `crypto.getRandomValues` to show two loads can pick different quotes
  (US3 #3).

### Implementation for User Story 3

- [ ] T028 [US3] Add `pickQuote(status)` to `src/http/sections/team.ts`: `"push"` →
  `QUOTES_PUSH`, otherwise `QUOTES_ON_TRACK`, index from
  `crypto.getRandomValues(new Uint32Array(1))`. Render
  `<blockquote class="quote quote-push|quote-on-track" lang="de">` with the
  catalog heading and `<p>` quote after `section.my-place`
  ([contracts/pages.md](contracts/pages.md) `/team` section 4). The viewer's
  status is `riderStatus(own balance, CURRENT_RULES, today)`; a viewer who isn't
  listed gets no quote. T026 and T027 pass.
- [ ] T029 [US3] In `src/http/style.ts`, style `.quote` (Rynkeby accent per list,
  readable at 360 px, light and dark).

**Checkpoint**: `/team` is complete.

---

## Phase 6: User Story 4 — Organisers see who needs help (Priority: P1)

**Goal**: `/organiser/riders` becomes the organiser overview: deadline, qualified
count, group tiles, cards on a phone and a table on a desktop, and the qualified
list.

**Independent Test**: sign in as synthetic organiser "Olga Organiser", compare each
rider's group, figures and breakdown with the stored balance; sign in as a rider
and check the overview is refused ([quickstart.md](quickstart.md) §2 step 3).

### Tests for User Story 4 (write first, confirm they fail)

- [ ] T030 [P] [US4] `test/unit/overview.test.ts` (new) for the pure
  `overviewRiders(read, rules, today)` and `overviewBody(read, rules, today, group,
  i18n)` exported from `src/http/organiser/overview.ts` (data-model.md
  `OverviewRider`), with a rules copy that has a running deadline (`{
  ...CURRENT_RULES, qualificationDeadline: "<date after today>" }`), since
  `CURRENT_RULES` has none:
  - each rider's `status` is `riderStatus`'s; `pace` per amount is `evenPace`;
    `missing` is `trainingMissing`, `teamMissing`, `virtualShareMissing` from the
    balance, each flagged `behind` when its amount is below its pace;
  - `breakdown`: distance and elevation Rynke from the balance, per team-event
    kind the attended count with its Training and Team, corrections summed from
    the read, virtual share in whole percent;
  - group counts for push, on_track, in and all; with no deadline and with a
    passed deadline there is no on_track (spec edge cases);
  - `overviewBody` with the running deadline renders `organiser.overview.deadline`
    with the hand-worked days to go, the "Need a push" and "On track" tiles with
    their counts, the even-pace marks, and `?group=on_track` renders only the
    on-track riders; with a passed deadline it renders
    `organiser.overview.deadlinePassed` and no "On track" tile (FR-031, FR-032).
- [ ] T031 [P] [US4] `test/integration/organiser-overview.test.ts` (new), through
  `handleFetch` with synthetic listed riders (one qualified, two named Jonas, one
  without consent):
  - access: visitor `302 /`, rider who isn't an organiser `403`, organiser `200`
    (US4 #4);
  - `organiser.overview.noDeadline`; tiles "Not yet in", "In for Paris",
    "Everyone" with counts and no "On track" tile; "{n} of {count} in for Paris";
  - `?group=in` renders only the qualified rider and marks its tile
    `aria-current="true"`; `?group=on_track` without a deadline renders everyone;
  - both Jonas carry "View on Strava" links, other riders none (US4 #3);
  - each rider's name links to `/organiser/riders/{id}`; the card and the table
    row show the stored balance's Training, Team and outdoor Training and the
    breakdown figures; `section.qualified` lists the qualified rider (US4 #2,
    FR-034); nobody qualified → `organiser.overview.nobodyYet`; nobody listed →
    `organiser.overview.none`;
  - the unconsented rider appears nowhere;
  - the read-only wrapper and `fetch` spy of T013 on `/organiser/riders` (FR-003).
- [ ] T032 [P] [US4] Update `test/integration/organiser-corrections.test.ts`:
  "lists the listed riders only, without balances (FR-042)" becomes "lists the
  listed riders only" (balances are now shown, 016 FR-033); the
  `?error=rider_not_listed` and `?error=correction_missing` redirects still show
  their notice on the overview; `/organiser` links to `/organiser/riders` with
  the new `organiser.riders.link` text; the corrections page's back link leads
  to `/organiser/riders`.
- [ ] T033 [P] [US4] `test/unit/style.test.ts`: below 840 px `.rider-table` is
  `display:none` and, without `aria-current` on a tile, cards outside
  `.status-push` are hidden; from 840 px `.rider-cards` is `display:none`
  (research R9, FR-035).

### Implementation for User Story 4

- [ ] T034 [P] [US4] Add the `organiser.overview.*` keys of
  [contracts/messages.md](contracts/messages.md) to both catalogs and to
  `test/unit/catalogs.test.ts`; change `organiser.riders.link` to "Team overview" /
  "Teamübersicht"; remove `organiser.riders.heading` and `organiser.riders.none`
  if nothing uses them any more (keep `organiser.riders.back`).
- [ ] T035 [P] [US4] Add `thresholdBars(value, threshold, pace)` to
  `src/http/charts.ts`: `aria-hidden="true"`, a filled bar and an even-pace mark
  when `pace` is set (research R12).
- [ ] T036 [US4] Create `src/http/organiser/overview.ts`: `overviewRiders` and
  `overviewBody` per T030, and `handleOrganiserOverview(request, ctx, i18n)` through
  `organiserPage(…, "/organiser/riders", …)` that reads `readTeam`, keeps the
  `noticeFromQuery` notice, parses `group` per
  [contracts/http-routes.md](contracts/http-routes.md), and renders
  `overviewBody(read, CURRENT_RULES, berlinDate(ctx.now()), group, i18n)`. The body
  is pure and holds the deadline card, qualified card, `nav.group-tiles`,
  `ul.rider-cards`, `table.rider-table` and `section.qualified` in the order of [contracts/pages.md](contracts/pages.md)
  `/organiser/riders`. Without `group`, a visually hidden "Showing: …" line per
  breakpoint (research R9). T030 passes.
- [ ] T037 [US4] Remove `handleOrganiserRiders` from
  `src/http/organiser/corrections.ts` (keep `LIST` for the redirects), route
  `/organiser/riders` to `handleOrganiserOverview` in `src/http/router.ts`, and
  add the overview to `RIDER_PAGES` in `test/support/pages.ts` as an organiser
  page (`ATHLETE_C`). T031 and T032 pass.
- [ ] T038 [US4] In `src/http/style.ts`, add `.group-tiles`, `.rider-card` with
  its `status-*` accents, the threshold bars, `.rider-table` in its own scroll
  container, and the 840 px media queries of T033. T033 passes.

**Checkpoint**: all four stories hold.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T039 [P] `test/integration/no-hardcoded-copy.test.ts` covers `/team` and
  `/organiser/riders` in the pseudo-locale and passes; `test/unit/catalogs.test.ts`
  passes with the added and removed keys; `grep -rn "team.placeholder"` over
  `src/` and `test/` finds nothing.
- [ ] T040 [P] `test/unit/dev-guard.test.ts` still passes (no `src/` import of
  `dev/`), and `src/http/sections/team.ts` and `src/http/organiser/overview.ts`
  import nothing from `src/rynke/apply.ts` or `src/strava/` (research R11).
- [ ] T041 Run `pnpm lint`, `pnpm typecheck` and `pnpm test`; all pass.

---

## Dependencies and order

- Setup → Foundational (T002–T008) → US1 → US2 → US3 → US4 → Polish.
- US4 needs only Foundational and could run beside US1–US3, but every story edits
  `style.ts`, `charts.ts` and the catalogs, so doing them in order avoids
  conflicts.
- US2 and US3 extend the page US1 rewrites (`sections/team.ts`).
- Within a story: tests first, then pure modules, catalogs, rendering, routes,
  styles.

## Parallel examples

- Foundational: T002, T003 and T004 together; then T007 beside T008 (T005 → T006
  in sequence).
- US1: T009–T013 together; T014 beside T016.
- US2: T019–T021 together; T022 beside T023.
- US3: T026 and T027 together.
- US4: T030–T033 together; T034 beside T035.

## Implementation strategy

MVP is US1: the leaderboard around the viewer is the point of the feature and
replaces the placeholder. US2 completes the "team" feeling with little new
logic. US3 is small; the lists already exist. US4 replaces a working page, so it
can ship in a later release if time is short; until then organisers keep 014's
plain list.
