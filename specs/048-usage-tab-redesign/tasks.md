# Tasks: Usage Tab Redesign

**Input**: Design documents from `/specs/048-usage-tab-redesign/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Required (constitution V, test-first per story). Each story's tests are
written first and fail before its implementation.

**Organization**: By user story. US1 and US2 are P1, US3 and US4 P2, US5 P3. The
design draft (Claude Design canvas "RynkePoints Admin Usage", boards 1–4) is
the look to match; read it before the UI tasks.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: different files, no dependency on an unfinished task
- **[Story]**: US1–US5 from spec.md

---

## Phase 1: Setup

No setup: no dependency, no new tooling. Work on branch `048-usage-tab-redesign`.

---

## Phase 2: Foundational (blocks every story)

**Purpose**: the level scale with Hinweis, which the page, the alerts and the
number all read.

- [x] T001 [P] Write failing tests in test/unit/usage-figures.test.ts: every `AllowanceId` has an early threshold; each group's threshold is 25 (Strava per day, Strava per 15 minutes, connected riders, Cloudflare per day, database storage, per data-model.md); `levelOf(id, used, limit)` gives `"early"` at exactly 25 % (`used × 100 ≥ limit × level`), `"ok"` at 24.99 %, `"warning"` at 80 %, `"critical"` at 95 %, highest reached wins; a group with threshold ≥ 80 never gives `"early"`; `alertLevels(id)` is `[25, 80, 95]`, lowest first, and `[80, 95]` for a threshold ≥ 80
- [x] T002 Add the early thresholds in src/usage/allowances.ts: one constant per group (all 25, "A threshold is a whole percentage, 1–100. At 80 or more the group has no early level."), a map from every `AllowanceId` to its group's threshold, `earlyThreshold(id)` and `alertLevels(id)` (early threshold if below `WARNING_LEVEL`, then 80, 95); `WARNING_LEVEL`, `CRITICAL_LEVEL` unchanged
- [x] T003 Extend `Level` to `"ok" | "early" | "warning" | "critical"` and make `levelOf` take the allowance id in src/usage/figures.ts; update `makeFigure` and every caller of `levelOf` (`grep -rn "levelOf(" src`) so T001 passes and `pnpm typecheck` is clean; CPU and day-table levels keep `"ok" | "warning" | "critical"`

**Checkpoint**: `pnpm test test/unit/usage-figures.test.ts` passes.

---

## Phase 3: User Story 2 - Hear early when usage rises (P1)

**Goal**: Hinweis is stored and notified like 80 % and 95 % (contracts/alerts.md).

**Independent Test**: a daily Cloudflare figure crosses 25, 80 and 95 % in one
day with a synthetic push service: one notification per level, none on a second
check; a 15-minute figure at 30 % sends nothing; storage dropping below 25 %
clears its open Hinweis.

### Tests for User Story 2

- [x] T004 [P] [US2] Add failing cases to test/unit/usage-alerts.test.ts: crossing 25 % inserts a `usage_alerts` row with level 25 and notifies once; a second check that period inserts nothing; jumping from 10 % to 85 % in one check notifies once and the device text is worded by 80; an `open` allowance (`cf_d1_storage_bytes`, `riders_connected`) below 25 % deletes its open 25 row so the next rise notifies again; `cpu_cut_off` still fires only 80/95
- [x] T005 [P] [US2] Add a failing case to test/unit/migrations.test.ts (or its integration counterpart, following how existing migrations are tested): after `0041_usage_alerts_early.sql`, rows with level 80 and 95 are kept, a row with level 25 inserts, level 0 and 101 are refused, and the primary key `(allowance, period, level)` still refuses duplicates
- [x] T006 [P] [US2] Add failing cases to test/integration/notifications-route.test.ts: a stored level below 80 is worded "Hinweis: {allowance} bei {percent} %" (`notification.usage.early`); 80…94 and ≥ 95 keep their texts
- [x] T007 [P] [US2] Add a failing case to test/integration/admin-usage.test.ts: the alerts switch reads "Benachrichtigung bei Hinweis, Warnung und kritisch" and its explanation "Einmal je Wert und Stufe: ab der Hinweisgrenze, bei 80 % und bei 95 %."

### Implementation for User Story 2

- [x] T008 [US2] Create migrations/0041_usage_alerts_early.sql exactly as in contracts/alerts.md (create `usage_alerts_new` with `CHECK (level BETWEEN 1 AND 100)`, copy, drop, rename; same name, columns, primary key, `WITHOUT ROWID`), and register it wherever the migration list is checked
- [x] T009 [US2] In src/usage/alerts.ts, fire and clear with `alertLevels(allowance)` instead of `ALERT_LEVELS` for recorded allowances (insert first, `INSERT OR IGNORE`, one notification per subject with a newly reached level); CPU alerts keep 80/95; 15-minute figures stay unrecorded and never fire; adjust src/db/usage.ts statements only if they hard-code 80/95
- [x] T010 [US2] In src/http/pwa.ts, word a stored level below `WARNING_LEVEL` with the new key `notification.usage.early`; `currentAlertStatement` keeps picking the newest, highest row
- [x] T011 [P] [US2] Add `notification.usage.early` and change `admin.alerts.title` and the switch explanation in all ten catalogs src/i18n/messages/{de,en,da,fi,fr,is,lt,nb,nl,sv}.ts (German is the source; same placeholders)

**Checkpoint**: T004–T007 pass; Hinweis works with the old page layout.

---

## Phase 4: User Story 1 - See at once whether anything needs a look (P1)

**Goal**: "Das braucht deinen Blick" across the top, or "Alles im Rahmen"
(contracts/usage-view.md "The list").

**Independent Test**: one figure at 97 %, one at 85 %, one at 40 %, another team
silent, no device → five rows in that order, head "1 kritisch · 1 Warnung · 1
Hinweis"; all values below 25 %, teams answering, device present → calm line.

### Tests for User Story 1

- [x] T012 [P] [US1] Write failing tests in test/unit/usage-attention.test.ts for the new pure module: items sorted `critical`, `warning`, `early`, `hint`, within a level in page order (Strava figures, Cloudflare figures, then waiting, strava-calls, recheck, routing, cpu; newer day first); figure items carry `percent`, `used`, `limit` and target `#<allowance>`; CPU items one per owner marked today (this team, other teams, gateway) with target `#cpu`; re-check (`isRecheckWarningDay`: `over24h > 0 || unordered > 0`), routing (`isWarningDay`) and calls (`CallDayRow.marked`) items only for today and yesterday UTC, one per marked day; a day two days ago gives no item; team hint per other team whose exchange never succeeded or last failed (today's `teamNotices` rule), target `#strava`, never named, numbered "Anderes Team 2" when several; device hint when the viewer has no push subscription, target `/me/settings`; `markCount` counts every level but `hint`; 15-minute figures at Hinweis count
- [x] T013 [P] [US1] Rewrite the summary assertions in test/integration/admin-usage.test.ts as failing tests for the list: with marks and hints the page starts (after the tab switch) with `section.usage-lage` holding rows in attention order, each an `a.settings-row` with the right `href`; count chips only for levels present ("1 kritisch", "1 Warnung", "1 Hinweis", plural "2 Hinweise"); hints listed, not counted; with nothing, heading "Alles im Rahmen", the calm line with "nichts wartet" and the figures' time, and no list; with entries waiting and nothing else, the calm line without "nichts wartet"; "Jetzt aktualisieren" posts to `/admin/refresh` in both states; no other team's name anywhere on the page

### Implementation for User Story 1

- [x] T014 [US1] Create src/usage/attention.ts per data-model.md "Attention item": the item type (`kind`, `level`, `target`, `subject`, figure numbers), `attentionItems(inputs)` taking plain inputs (figures with levels, today's CPU levels per owner, re-check/routing/calls day rows, peers' exchange states, has-device, today's UTC day), `markCount(items)` returning `{ critical, warning, early }` and total, and `isRecheckWarningDay` moved here from src/http/admin/usage.ts; reuse `isWarningDay` and `CallDayRow.marked` as they are
- [x] T015 [US1] Add the lean reader to src/db/usage.ts (research R5): one D1 batch for the Strava rate-limit row, this team's connected count and each peer's latest, the Cloudflare figures' latest values, today's CPU rows, the re-check, routing and Strava-calls rows of today and yesterday, the peers' exchange states; no history, no Strava or Cloudflare call; plus `countUsageMarks(ctx)` (in src/usage/attention.ts or beside the reader) that feeds it to `attentionItems` and returns `markCount`
- [x] T016 [US1] In src/http/admin/usage.ts, render the list section from `attentionItems` per contracts/usage-view.md (badge icon by worst level, count chips, rows with name, one line, value; day rows' reasons; CPU "{owner}: Läufe abgebrochen"; team and device hints) and the calm block (two calm-line variants, research R10); remove `summary()` and `teamNotices` and the no-device notice above the figures; the list and the page's figures come from the same reader so they agree
- [x] T017 [P] [US1] Add the list's and calm block's texts and remove the keys of `summary()`, the team notices and the no-device notice from all ten catalogs src/i18n/messages/*.ts (`pnpm test test/unit/catalogs.test.ts` must stay green)
- [x] T018 [P] [US1] Add the list styles to src/http/style.ts: `usage-lage`, `lage-head`, `lage-badge is-{critical,warning,early,hint,ok}`, `lage-counts`, `usage-mark-early`, `settings-icon.lvl-{critical,warning,early}`; light and dark; match board 1 and board 4 of the design draft

**Checkpoint**: US1 tests pass; the list works above the old sections.

---

## Phase 5: User Story 3 - Read the figures at a glance (P2)

**Goal**: Strava and Cloudflare as grouped lists of `details` rows
(contracts/usage-view.md "Figure rows").

**Independent Test**: at phone and desktop width every row matches its recorded
value; an opened row shows levels line, team split, time, history, "Alle Tage".

### Tests for User Story 3

- [x] T019 [P] [US3] Add failing tests to test/unit/charts.test.ts: `thresholdBars` with tick positions `[25, 80, 95]` draws three ticks at those percentages; without ticks the output is unchanged; over 100 % the bar stays full
- [x] T020 [P] [US3] Rewrite the figure assertions in test/integration/admin-usage.test.ts, admin-usage-teams.test.ts and admin-usage-cloudflare-teams.test.ts as failing tests: rows `li#{allowance}` in the fixed order (Strava: `strava_read_daily`, `strava_all_daily`, `strava_read_15m`, `strava_all_15m`, `riders_connected`; Cloudflare: `cf_worker_requests`, `cf_queue_operations`, `cf_d1_rows_read`, `cf_d1_rows_written`, `cf_d1_storage_bytes`); closed row has name, mark word (never colour alone), bar, "{used} von {limit}", whose line ("Dieses Team {n} · Anderes Team {m}", "Anderes Team: keine Zahlen", "nur dieses Team", "ganzes Konto") and percentage; panel has "Hinweis ab 25 %, Warnung ab 80 %, kritisch ab 95 %.", team split without names, time, history, "Alle Tage"; a 15-minute row at 0 % has class `is-quiet` and the Strava note carries the phone-only sentence, above 0 % no class; a Cloudflare figure without value says "Noch kein Wert · Limit {limit}" with no mark; `?days={allowance}` renders that row `open` with its day list; the "Alle Teams" table is gone; group heads "heute, UTC" and "Stand {time}"

### Implementation for User Story 3

- [x] T021 [US3] Give `thresholdBars` in src/http/charts.ts an optional list of tick positions (percent of the limit); other callers pass nothing
- [x] T022 [US3] In src/http/admin/usage.ts, render Strava and Cloudflare as `settings-section` groups with `settings-list` of `li#{allowance}` > `details` rows per contracts/usage-view.md; move `figureItem`'s content (levels line, team split, time, history graph, "Alle Tage") into the row panel; mark `is-quiet` on 15-minute rows at 0 %; open the row named by `?days=`; remove `overviewSection` and the figure cards; lay out the page as `settings-page` with two `settings-col` (Strava and Cloudflare left, Betrieb and Nutzungshinweise right, list across the top), one column on the phone
- [x] T023 [P] [US3] Add to src/http/style.ts the bar ticks, the meter row, and below Settings' two-column breakpoint `.settings-list > li.is-quiet { display: none }` and the `.phone-only` note sentence; match boards 1 and 2 of the design draft at 390 and 1280 px
- [x] T024 [P] [US3] Add the figure rows' texts (levels line, whose lines, "Noch kein Wert · Limit {limit}", group heads, "Bei 0 % sind sie ausgeblendet.") and remove the overview table's and figure cards' keys in all ten catalogs src/i18n/messages/*.ts

**Checkpoint**: US3 tests pass; the figures read as on board 1.

---

## Phase 6: User Story 4 - Operations in short rows (P2)

**Goal**: five Betrieb rows and the Nutzungshinweise switch row
(contracts/usage-view.md "Betrieb rows", "Nutzungshinweise").

**Independent Test**: all five rows show with their one line; each opens to
today's table and explanation; `?calls={day}` opens Strava-Aufrufe on that day.

### Tests for User Story 4

- [ ] T025 [P] [US4] Rewrite the section assertions in test/integration/admin-usage-recheck.test.ts, admin-usage-routing.test.ts, admin-usage-calls.test.ts and admin-usage-cpu.test.ts as failing tests: rows `li#waiting`, `#strava-calls`, `#recheck`, `#routing`, `#cpu` always present in that order under "Betrieb" (head "letzte 30 Tage"); each one line per the table in contracts/usage-view.md ("Nichts wartet." / "{n} Einträge warten, fertig in etwa {time}.", calls, re-check, routing, CPU with "Limit 10 ms je Lauf"); a summary mark at the highest of today's (CPU) or today's and yesterday's (day tables) marks; a routing day marked two days ago shows inside the opened row but gives no summary mark; the panel holds today's table unchanged; `?calls={day}` renders `#strava-calls` `open` with that day's breakdown
- [ ] T026 [P] [US4] Add failing cases to test/integration/admin-usage.test.ts for the switch row: `section#alerts` with a `button role="switch"` whose `aria-checked` follows the stored setting, the hidden `admin_alerts` input, posting to `/admin/alerts`; the no-device line under it when the viewer has no push subscription; the recording start date note

### Implementation for User Story 4

- [ ] T027 [US4] In src/http/admin/usage.ts, wrap the waiting text, `callsSection`, `recheckSection`, `routingSection` and `cpuSection` bodies unchanged in Betrieb `details` rows with ids `waiting`, `strava-calls`, `recheck`, `routing`, `cpu`, each summary with icon, title, mark, one line and optional value; compute the summary mark from the same day/CPU levels `attentionItems` uses; open `strava-calls` when `?calls=` is present
- [ ] T028 [US4] In src/http/admin/usage.ts, replace `alertsSwitch` with the Nutzungshinweise section per contracts/usage-view.md (R11): `settings-row is-static`, `button role="switch" aria-checked` inside the existing `POST /admin/alerts` form, no-device line under it, recording start note
- [ ] T029 [P] [US4] Add the Betrieb titles and one-liners and the switch row's texts, remove the replaced section headings' keys, in all ten catalogs src/i18n/messages/*.ts
- [x] T030 [P] [US4] Open rows from links in public/app.js (R9): on load and on `hashchange`, open the `details` inside the `li` whose id equals the hash and scroll it into view; nothing else

**Checkpoint**: US4 tests pass; the page matches boards 1, 3 and 4.

---

## Phase 7: User Story 5 - The page counts in the navigation (P3)

**Goal**: the Admin tab and "Nutzung" carry the mark count
(contracts/nav-count.md).

**Independent Test**: one figure at Hinweis and one CPU value at Warnung → the
Admin tab shows 2 with a label saying so, on any page; only hints → no number; a
non-administrator has no Admin tab.

### Tests for User Story 5

- [ ] T031 [P] [US5] Write failing tests in test/integration/admin-usage-badge.test.ts: an administrator on a non-admin page sees `countBadge(2)` in the Admin tab's `.nav-icon` and the link's `aria-label` "Admin, 2 brauchen deinen Blick"; on `/admin` the Admin tab, the "Nutzung" segment (`aria-label` "Nutzung, 2 brauchen deinen Blick") and the list's head show the same total; with only state hints no badge; above 9 shows "9+"; a rider who isn't an administrator gets no Admin tab and the reader isn't run; an organiser who is also administrator keeps the Orga number unchanged; no request to Strava or Cloudflare is made

### Implementation for User Story 5

- [ ] T032 [US5] In src/http/shell.ts, compute `countUsageMarks(ctx)` for administrators in the same `Promise.all` as `countOpenRequests`, and show it on the Admin tab with `countBadge` and the `nav.admin.marks` label, as the Orga tab does
- [ ] T033 [US5] Let `adminSwitch` in src/http/admin/access.ts take the count and show `countBadge` with `admin.switch.usage.marks` on "Nutzung"; pass it from src/http/admin/usage.ts (the list's own count) and from src/http/admin/riders.ts and src/http/admin/remove.ts (via `countUsageMarks`), so one request shows one number
- [ ] T034 [P] [US5] Add `nav.admin.marks` and `admin.switch.usage.marks` to all ten catalogs src/i18n/messages/*.ts

**Checkpoint**: all stories pass.

---

## Phase 8: Polish & cross-cutting

- [ ] T035 Update the admin test in e2e/smoke.e2e.ts to the new page: the warning and critical marks still visible; the alerts switch is the `button[role=switch]` and its hidden input still flips; open a figure row before hovering its graph and counting `.usage-chart`; "Alle Tage" opens `/admin?days=strava_read_daily#…` with its row open
- [ ] T036 Remove code and CSS left unused by T016, T022, T027, T028 (old summary, overview table, card styles) from src/http/admin/usage.ts and src/http/style.ts; `pnpm lint` and `pnpm typecheck` clean
- [ ] T037 [P] Check the page and the number show no other team's name or rider data (`pnpm test test/teams/no-other-team.test.ts`) and run the targeted tests of quickstart.md
- [ ] T038 [P] Note the feature in docs that describe Admin › Nutzung, if any (`grep -rln "Nutzung" docs README.md`), and the Hinweis level in feature 025's description only where docs list the alert levels

---

## Dependencies & Execution Order

- **Foundational (T001–T003)** blocks everything: every story reads the new `Level`.
- **US2 (T004–T011)** needs only Foundational; it changes no layout.
- **US1 (T012–T018)** needs Foundational. T016 is the first big rewrite of
  src/http/admin/usage.ts.
- **US3 (T019–T024)** and **US4 (T025–T030)** need US1 (they place their sections
  around the list in the same file); US3 before US4, since T022 lays out the
  columns T027 fills.
- **US5 (T031–T034)** needs US1's `countUsageMarks` (T015).
- **Polish** last.
- Within a story: tests first and failing, then implementation; catalog and CSS
  tasks [P] run beside the page task.

### Parallel opportunities

- After T003: US2 and US1 can run side by side (different files apart from the
  catalogs; merge catalog edits).
- US1: T012 and T013 together; T017 and T018 beside T016.
- US3: T019 and T020 together; T023 and T024 beside T022.
- US4: T025 and T026 together; T029 and T030 beside T027/T028.
- US5: T034 beside T032/T033.

```text
# US1 tests together
T012 test/unit/usage-attention.test.ts
T013 test/integration/admin-usage.test.ts
```

## Implementation Strategy

- **MVP**: Foundational + US2 (Hinweis notifications) + US1 (the list). That
  answers the issue's two core asks: early warning and one place to look.
- Then US3 and US4 shorten the page; US5 carries the number into the navigation.
- One pull request for the whole feature (it completes issue #435); commits per
  story, `Refs #435`.
- Checks in fake mode and on the live site happen after release, not as tasks.
