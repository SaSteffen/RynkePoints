# Research: Usage Tab Redesign

All decisions below follow the spec, the design draft (Claude Design canvas
"RynkePoints Admin Usage", boards 1–4 and the "Decided" note) and the code as
it is on `develop` (features 025, 036, 046, 047). Nothing was left open.

## R1: One level scale with an early level

- **Decision**: `Level` in `src/usage/figures.ts` becomes
  `"ok" | "early" | "warning" | "critical"`. The early thresholds live in
  `src/usage/allowances.ts` beside the limits, as one constant per group
  (`EARLY_LEVEL` per group, all 25) and a map from each allowance to its group's
  threshold. `levelOf(id, used, limit)` takes the allowance so it can look up the
  threshold; the exact comparison of `reachesLevel` stays (24.9 % is no
  Hinweis). A group whose threshold is 80 or more has no early level.
- **Rationale**: The user wants the threshold per stat but decided by us where
  stats share one (spec FR-010). A map keyed by allowance keeps every caller
  (page, alerts, nav count) on one rule, and a pull request changes it like a
  limit.
- **Alternatives considered**: a threshold per allowance with no groups (ten
  numbers that move together today); a setting on the page (the user said code,
  not page).

## R2: Storing a notified Hinweis

- **Decision**: Migration `0041_usage_alerts_early.sql` rebuilds `usage_alerts`
  with the same name and columns, changing only the check from
  `level IN (80, 95)` to `level BETWEEN 1 AND 100`: create
  `usage_alerts_new`, copy the rows, drop `usage_alerts`, rename the new table.
  A Hinweis is stored with its threshold as `level` (25 today). The insert-first
  rule, periods and the clearing of `open` rows stay as they are; the levels an
  allowance can fire become `alertLevels(allowance)` = its early threshold (if
  below 80), 80, 95.
- **Rationale**: SQLite can't change a check in place. The table keeps its name
  and columns, so the release before this one reads and writes it unchanged
  while the new code isn't live yet (CLAUDE.md: a migration keeps the previous
  version working). That release words a stored 25 like a warning ("Worker-
  Anfragen: 25 %"), which is harmless for the minutes between migration and
  code. The device's wording query (`currentAlertStatement`) already picks the
  newest, highest level, so a figure that passes 25 % and 80 % in one run is
  worded by 80 % (spec US2 scenario 3).
- **Alternatives considered**: a second table for Hinweis alerts (avoids the
  rebuild, but every read and insert would need to look in two places); storing
  Hinweis as a magic level such as 1 (would also need the rebuild and hides the
  threshold that fired). If the threshold changes, a figure already past the old
  one notifies once more that period; acceptable for a value changed by pull
  request.

## R3: Notification text

- **Decision**: The device's text (`src/http/pwa.ts`) picks
  `notification.usage.early` ("Hinweis: {allowance} bei {percent} %") when the
  stored level is below `WARNING_LEVEL`, otherwise today's warning and critical
  texts. 15-minute figures never fire (they aren't recorded), as feature 025
  US5 scenario 4 says.
- **Rationale**: FR-009 asks the notification to say it is a Hinweis; the
  warning text today has no word, so the early one needs its own key.

## R4: What needs a look: one pure list

- **Decision**: A new pure module `src/usage/attention.ts` builds the list from
  plain inputs: the figures (with levels), today's CPU levels per owner, the
  re-check, routing and Strava-calls days, each peer's exchange state and
  whether the viewer has a device. It returns items, each with a kind, a level
  (`critical`, `warning`, `early`, or `hint` for state hints), the target
  anchor and what the row shows. Sorted by level, then by the page's order.
  `markCount(items)` counts all but hints, per level. Day marks come only from
  today and yesterday (UTC). The re-check's day rule (`over24h > 0 ||
  unordered > 0`) moves from the page into `src/usage/attention.ts` as
  `isRecheckWarningDay`, beside `isWarningDay` (routing) and `CallDayRow.marked`
  (calls), which are reused as they are.
- **Rationale**: The page, its head count and the nav number must agree (SC-005);
  one pure function guarantees it and is unit-testable without a page.
- **Alternatives considered**: counting in each section as today's `summary()`
  does (that's how the counts drifted apart, issue #435).

## R5: The number on the Admin tab

- **Decision**: For administrators, `src/http/shell.ts` computes the mark count
  next to the open-requests count (same `Promise.all`) through
  `countUsageMarks(ctx)` and shows it with `countBadge` on the Admin tab, with an
  accessible label ("Admin, 3 Dinge brauchen deinen Blick"). `adminSwitch` takes
  the count for "Nutzung". `countUsageMarks` reads only what the list needs:
  the rate-limit row, the connected count and each peer's latest connected
  count, the Cloudflare figures' latest values, today's CPU rows, and the
  re-check, routing and Strava-calls rows of today and yesterday, in one D1
  batch where possible. No history, no Strava, no Cloudflare call (FR-021). The
  usage page uses the same reader for its list, then reads its history and
  tables as today.
- **Rationale**: The badge must equal the page's count (SC-005) and must stay
  cheap on every page: about ten small reads per page view, only for
  administrators (a handful of riders).
- **Alternatives considered**: storing the count at each hourly recording
  (cheaper, but Strava's figures and connected riders change between
  recordings, so the number would disagree with the page); counting only
  Kritisch and Warnung (the user decided Hinweis counts).

## R6: Page structure

- **Decision**: `src/http/admin/usage.ts` keeps the handler and data reads; its
  output changes to Settings' grouped lists (`settings-page`, `settings-col`,
  `settings-section`, `settings-list`, `details > summary.settings-row`,
  `settings-icon`, `settings-text`, `settings-value`, `settings-panel is-wide`,
  `settings-note`). The list at the top is a `settings-list` of links. Each
  figure is a `details` row; its panel holds what `figureItem` shows today
  (levels line, team split, time, history). Each Betrieb row's panel holds the
  existing section body unchanged (re-check, calls, routing and CPU tables,
  waiting text). The "Alle Teams" table (`overviewSection`), `summary()` and the
  separate team notices go; the team notice becomes a hint in the list and the
  "Anderes Team: keine Zahlen" line on the figures. New CSS is limited to the
  bar's ticks, the level icon colours and the phone rule of R8, in
  `src/http/style.ts`.
- **Rationale**: FR-023 asks for Settings' pieces; the canvas boards were built
  from exactly these classes with the app's stylesheet, so they render as drawn.
- **Alternatives considered**: new card components (more CSS, two looks for one
  app).

## R7: Bar marks

- **Decision**: `thresholdBars` in `src/http/charts.ts` gains an optional list of
  tick positions (percent of the limit); the usage rows pass the early
  threshold, 80 and 95. Other callers pass nothing and look as today.
- **Rationale**: One bar component across the app; the ticks are the only new
  visual piece (FR-023).

## R8: Hiding quiet 15-minute rows on the phone

- **Decision**: A 15-minute row at 0 % gets the class `is-quiet`; a rule below
  Settings' two-column breakpoint hides it. The note under Strava has a sentence
  that only shows on the phone and only when a row is hidden ("Bei 0 % sind sie
  ausgeblendet.").
- **Rationale**: Pure CSS, no layout script; on desktop the rows stay
  (spec FR-016).

## R9: Opening rows from links

- **Decision**: Rows carry stable ids: each figure its allowance id (as today),
  the Betrieb rows `#waiting`, `#strava-calls`, `#recheck`, `#routing`, `#cpu`
  (only `#waiting` new), the switch `#alerts`. A few lines in
  `public/app.js` (the app's one script) open the `details` named by the URL's hash on load and on
  `hashchange`, and scrolls it into view. The server opens the Strava-Aufrufe
  row when `?calls=` is present and the figure named by `?days=` (the "Alle
  Tage" link), so those links work as today. An opened row stays open across
  "Jetzt aktualisieren" because the refresh redirects back with the same hash.
- **Rationale**: Links in the list must open their target (FR-003); JavaScript
  is assumed in this app.

## R10: The calm line

- **Decision**: Two catalog texts: with nothing waiting, "Kein Wert hat seine
  Hinweisgrenze erreicht, alle Teams haben geantwortet, nichts wartet. Stand:
  {time}."; with entries waiting (which is no mark), the same without "nichts
  wartet". The time is the newest of the figures' times.
- **Rationale**: Waiting for the budget isn't a mark (it is normal during
  imports), so the page can be calm while something waits; the line mustn't
  claim otherwise.

## R11: The alerts switch

- **Decision**: The switch is a `settings-row is-static` with a
  `button role="switch" aria-checked` inside the existing `POST /admin/alerts`
  form; pressing it submits, as the button does today. The no-device line shows
  under it when the viewer has no push subscription.
- **Rationale**: Same route and rule (feature 025 FR-039), Settings' look.

## R12: Tests

- **Decision**: Unit tests for the levels with early thresholds
  (`usage-figures`), the early alert and its period and clearing
  (`usage-alerts`), and the new `usage-attention` (order, counts, day window,
  hints not counted). Integration tests: the usage page's list, calm state, rows
  and deep links (rewriting the assertions in `admin-usage*.test.ts` that read
  the old sections), the nav number (`admin-usage-badge.test.ts`), the early
  notification text, and the migration keeping rows. The pages snapshot
  doesn't hold Admin pages, so it stays. No new e2e test; the review screenshots
  pick up the page as it is.
- **Rationale**: Constitution V, test-first per story.
