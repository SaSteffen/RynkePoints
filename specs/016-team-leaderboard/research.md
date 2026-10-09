# Research: Team Leaderboard and Organiser Overview

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-10-09

Each section records the decision, why it was taken, and what else was considered.
"003", "009", "014" are earlier features whose code or specs this one reads and
extends.

## R1. Weekly history is rebuilt on every view, not stored (FR-015, FR-017)

**Decision**:

- Nothing stores or computes a rider's Rynke over time yet. 016 builds it on its
  own: a pure module
  `src/rynke/weeks.ts` that turns stored inputs into each rider's Training and Team
  Rynke at the end of every week.
- Inputs, all already stored by 003 and 014:
  - counting ride results summed per rider and week in SQL (R2);
  - attendance with the event's date;
  - corrections with their date.
- For each week end it accumulates the sums and calls 003's `tally` with the
  rules of the rider's stored balance (`rulesForVersion`, falling back to
  `CURRENT_RULES` when the version is unknown). So distance, elevation (floored
  once on the running total, 003 FR-004a), team-event amounts, corrections and the
  floor at 0 follow the evaluation's own functions.
- The **current week's** point is the stored balance itself, not a rebuilt one.
  Anything dated after today (a future-dated event, a ride in a time zone ahead of
  Berlin) therefore lands in the current week, as in 009 research R2.

**Rationale**:

- No migration, nothing new to keep in sync. A rule change or re-evaluation
  rewrites stored results, and the history follows.
- The headline figures (place, total, peloton) come straight from the stored
  balances, so they always agree with each rider's own Overview.
- Cost is small: about 30 riders × about 40 weeks of additions.

**Alternatives considered**:

- *Store a weekly snapshot table written by the evaluation*: one more write per
  evaluation and a backfill for past weeks; rejected as more moving parts.
- *Wait for 009's day-by-day curve*: 009 is not built, and the Team page may
  make it unnecessary. Nothing here is shaped for 009; if it is ever built, it
  reuses these modules only where that is cheap.

## R2. One grouped SQL read for the rides (FR-003)

**Decision**: `SELECT r.athlete_id, date(substr(a.start_date_local, 1, 10),
'weekday 0') AS week_end, SUM(r.distance_rynke), SUM(r.elevation_dm) FROM
ride_results r JOIN activities a ON a.strava_activity_id = r.strava_activity_id
WHERE r.counts = 1 AND r.athlete_id IN (listed riders) GROUP BY 1, 2`.

- `'weekday 0'` moves a date forward to the next Sunday, or keeps it when it is a
  Sunday, so `week_end` is the Sunday ending the ride's Monday-to-Sunday week
  (009 FR-037).
- The ride's day is its `start_date_local`, as in 003 FR-011.

**Rationale**: returns at most riders × weeks rows (about 1,200) instead of every
ride result (up to about 15,000). Elevation is summed in decimetres and floored
only after accumulating, so grouping loses nothing.

**Alternatives considered**: reading every ride result and grouping in TypeScript;
correct but ten times the rows per page view.

## R3. Week boundaries (FR-015, FR-017)

**Decision**:

- Weeks run Monday to Sunday in Europe/Berlin; the first week starts on
  `SEASON_START_DATE` and may be shorter (009 FR-037).
- The **last day** is today (`berlinDate(ctx.now())`), or the deadline once it has
  passed. The weeks shown are those whose Sunday is on or after the season start,
  up to the week holding the last day.
- Before the season starts there is one week, with every figure 0.

**Rationale**: same week as feature 009's table, so riders never see two
different weeks in the app.

## R4. Even pace and rider status are one pure function (FR-021, FR-030, FR-032)

**Decision**: `src/rynke/pace.ts`:

- `evenPace(amount, seasonStart, deadline, day)` = ⌊amount × (day − seasonStart) ÷
  (deadline − seasonStart)⌋ in whole days, clamped to 0…amount. This is the spec's
  FR-030 definition.
- `riderStatus(balance, rules, window, today)` returns `"in"` when the balance
  qualifies, else `"push"` when the deadline has passed or any of Training, Team
  or outdoor Training (`trainingWithoutVirtual` against `virtualShareRequired`)
  is below its even pace; else `"on_track"`.
- The deadline is the team setting `QUALIFICATION_DEADLINE` (spec FR-005), read
  with the season start by `countingWindow(env)`; it is always set, so there is
  no "no deadline" case. It left `RynkeRules` (`qualificationDeadline`): a team
  date, not a rule value, and the even pace needs it from day one.
- The leaderboard calls it only for the viewer (their own quote list); the overview
  calls it for every rider.
- Thresholds come from `CURRENT_RULES`; the stored balance's `qualified` decides
  "in".

**Rationale**: one rule for the quote list and the organiser groups, so a rider in
"Need a push" always gets a push quote (FR-021, FR-032).

## R5. Server-rendered, no client script (FR-011, FR-013, FR-020)

**Decision**:

- The kind switch and the list toggle are links: `/team`, `/team?kind=team`,
  `/team?all=1`, `/team?kind=team&all=1`. A plain `/team` is always Training and
  the neighbourhood, so the defaults hold every time the page opens (FR-011,
  FR-013).
- The quote is picked on the server with `crypto.getRandomValues` for each
  request. The service worker fetches navigations from the network first, so a
  reload gives a new pick (FR-020).
- Charts (peloton, sparklines, team bars, organiser bars) are inline SVG drawn
  with `viewBox` and `preserveAspectRatio="none"` where they stretch, as 009
  research R4 planned. No charting library.

**Rationale**: matches 011–014 (server-rendered shell, forms and links); nothing to
hydrate, and a link keeps working without JavaScript (Principle IV).

**Alternatives considered**: a small script for in-page toggles; it would keep
the scroll position but adds client code for a link's job.

## R6. Places, ties and the neighbourhood (FR-012, FR-013, FR-016)

**Decision**: pure `src/rynke/leaderboard.ts`:

- Rows sorted by the picked kind descending, then the other kind descending, then
  athlete ID ascending (fixed, never shown, names nobody).
- Places are standard competition ranking: equal totals share a place, the next
  place skips ("1, 2, 2, 4"). A shared place reads "joint 4th".
- "To pass the next place": the smallest total above the viewer's minus the
  viewer's, plus one. 1st place gets the "You lead the peloton" line instead.
- The neighbourhood is the viewer's index ±3 in the sorted list, cut at the ends
  and not filled up from the other side. With seven rows or fewer the toggle is
  not rendered.
- Medals go by place (1, 2, 3), so a shared 2nd gives two 🥈.
- A viewer who is not listed (cannot happen with a current consent, but the code
  doesn't assume it) gets the full list without a "You" row or place card.

## R7. Who is listed (FR-004)

**Decision**: both views use 014's listed riders, `status = 'connected' AND
athlete_id IN (SHARED_RIDER_IDS)`, read in the same batch as the balances. A rider
who needs to reconnect drops out until they reconnect, as on 014's pages.

**Rationale**: one definition of "the team" for the leaderboard, the overview and
the organiser pages, so counts match everywhere (SC-001).

**Alternatives considered**: consent only, keeping riders who need to reconnect;
the overview would then list riders 014's correction page refuses.

## R8. The overview replaces `/organiser/riders` (FR-002, FR-032–FR-035)

**Decision**:

- `/organiser/riders` becomes the organiser overview. Each rider's card or table
  row links to their existing corrections page `/organiser/riders/{id}`.
- `/organiser` keeps its link to it, renamed "Team overview".
- The Team page's organiser entry gets two links: "Team overview" and the existing
  "Organiser" (events).

**Rationale**: the old page listed the same riders by first name with Strava links
and nothing else; the overview is a superset with the same audience and data rules,
so a second list would only duplicate it.

## R9. Group filter and phone/desktop defaults (FR-032, FR-035)

**Decision**:

- The tiles are links: `?group=push`, `?group=on_track`, `?group=in`, `?group=all`.
  With an explicit `group` the server renders only that group and marks its tile
  `aria-current="true"`.
- Without `group`, the page renders every rider; a CSS rule below 840 px hides the
  cards outside "Need a push" and highlights its tile, so a phone opens on "Need a
  push" and a desktop on everyone. A visually hidden line names the filter in each
  case and is switched by the same media query.
- Phone and desktop get the same markup data twice: a card list (shown below
  840 px) and a table (shown from 840 px). Hidden copies use `display: none`, so
  assistive technology reads only one.
- On a phone the breakdown is a `<details>` per card (folded); the table shows it
  in columns.

**Rationale**: no script and no user-agent sniffing, and both defaults of FR-032
hold.

**Alternatives considered**: one responsive table restyled as cards; the breakdown
column set doesn't fold into a `<details>` without duplicating cells anyway.

## R10. Quotes outside the catalogs (FR-022–FR-024)

**Decision**: `src/i18n/messages/quotes.de.ts` exports `QUOTES_PUSH` and
`QUOTES_ON_TRACK` (already committed). The quote is rendered as
`<blockquote class="quote" lang="de"><p>…</p></blockquote>`. The hard-coded-copy
test lets exactly these strings through (already committed). A unit test checks
both lists: at least 180 entries each, no duplicates, no empty strings.

**Rationale**: the catalogs require every key in every language; the quotes are
German by decision (FR-023).

## R11. No evaluation, no Strava (FR-003, SC-003)

**Decision**: both handlers run one read batch (`db.batch` of `SELECT`s) and render.
They import nothing from `rynke/apply.ts` or `strava/`. An integration test wraps
`ctx.env.DB` to fail on any non-`SELECT` statement and checks no `fetch` to Strava
happens.

## R12. Text alternatives (FR-041)

**Decision**:

- Peloton SVG: `role="img"` with an `aria-label` from the catalog ("14 riders
  between {min} and {max} Rynke; you have {own}").
- Sparklines: `role="img"` with an `aria-label` listing the rider's week-end totals
  ("Week by week: {values}"), formatted with the locale's number format.
- Team chart: `role="img"` with a summary label, followed by a `<details>` table
  of every week's team total and gain.
- Organiser bars: `aria-hidden`; the same figures stand as text in the card or
  table cell.
