# Tasks: CPU Median Over the Season

**Input**: Design documents from `/specs/049-cpu-median-graph/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Required (constitution V, test-first per story). Each story's tests are
written first and fail before its implementation. Exception: the one-time fill
script gets no automated test (plan.md Complexity Tracking); the app pieces it
reuses are tested in Phase 2. Run only the named test files locally; CI runs the
full suites.

**Organization**: By user story. Phase 2 (recording the median) blocks every
story. US1 (season graph) is P1, US2 (table pair) P2, US3 (fill task) P3. The
design draft (Claude Design canvas "RynkePoints CPU Median",
https://claude.ai/artifact/Bs773SmPMa4bXFkoEYySPg, boards 1–3) is the look to
match; read it before the UI tasks.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: different files, no dependency on an unfinished task
- **[Story]**: US1–US3 from spec.md

---

## Phase 1: Setup

No setup: no dependency, no new tooling. Work on branch `049-cpu-median-graph`.

---

## Phase 2: Foundational — record the median (blocks every story)

**Purpose**: the hourly recording keeps the daily median per owner in a new
nullable column (FR-001 to FR-004, research R1, R2).

### Tests

- [ ] T001 [P] Add failing cases to test/unit/usage-cpu.test.ts: `parseCpu` reads `quantiles.cpuTimeP50` per Worker and day (1,400.4 µs → `p50Us` 1400, rounded like `p99Us`); an answer whose quantiles lack `cpuTimeP50` reads as unavailable, like one lacking `cpuTimeP99`; `cpuByOwner` keeps the highest `p50Us` of an owner's Workers (two Workers of one team at 1,200 and 1,800 µs → 1,800); `cpuRows` carries `p50Us` per owner and gives "others" the highest `p50Us` of all other team owners (1,200 and 1,800 → 1,800), and `null` when none of them has one
- [ ] T002 [P] Extend `cpuBody` in test/support/usage.ts with an optional `cpuTimeP50` per Worker entry, written into `quantiles` next to `cpuTimeP99` (default 0, like `cpuTimeP99`), so the tests can build answers with a median
- [ ] T003 [P] Add failing cases to test/integration/usage-record.test.ts: a recording stores `cpu_p50_us` with the other CPU figures for yesterday and today; a second recording with a new median replaces today's; a row inserted the way the release before writes it (its named columns only, without `cpu_p50_us`) keeps all its figures and a NULL median, and the next recording of that day sets it
- [ ] T004 [P] Add `cpu_p50_us` to the `usage_cpu_daily` column list in test/integration/schema-minimisation.test.ts (fails until the migration exists)

### Implementation

- [ ] T005 Create migrations/0042_usage_cpu_median.sql with exactly `ALTER TABLE usage_cpu_daily ADD COLUMN cpu_p50_us INTEGER;` and a header comment: "NULL: no median recorded (days before this release, days Cloudflare no longer holds). Only adds, so the release before keeps writing its named columns." Check test/unit/migrations.test.ts still passes
- [ ] T006 In src/usage/cpu.ts add `cpuTimeP50` to the `quantiles` block of `CPU_QUERY`; `parseCpu` requires it like `cpuTimeP99` and returns `p50Us` (rounded µs); `cpuByOwner` keeps the highest `p50Us` per owner; the `CpuDay` type gains `p50Us: number | null` ("NULL: none recorded"); `cpuRows` carries `p50Us` for own, others (max of the other teams' non-null values, else null) and shared. T001 passes
- [ ] T007 In src/db/usage.ts, `upsertCpuDayStatement` writes `cpu_p50_us` in both the INSERT column list and the `ON CONFLICT DO UPDATE` set; `readCpuDays` selects it and maps it to `p50Us` (NULL → `null`, never 0). Update src/usage/record.ts only if it builds the statement's values itself. T003 and T004 pass
- [ ] T008 Fix every other user of `CpuDay`/`cpuRows` that the new field breaks (`pnpm typecheck`; src/usage/state.ts, src/usage/attention.ts, src/http/admin/usage.ts): they ignore the median, so marks, alerts, the attention list and the Admin tab count stay as they are (FR-018)

**Checkpoint**: `pnpm test test/unit/usage-cpu.test.ts test/integration/usage-record.test.ts test/integration/schema-minimisation.test.ts test/unit/migrations.test.ts` passes; `pnpm typecheck` clean.

---

## Phase 3: User Story 1 - See whether the typical run is getting heavier (P1) 🎯 MVP

**Goal**: one season graph with three lines above the 30-day table, hover and
tap per week (contracts/cpu-row.md "Season graph").

**Independent Test**: with synthetic CPU days over several weeks of the season
for all three owners, open the CPU row: three lines, week values at the week's
highest median, the gateway's gap, weeks to come empty, the tip per week.

### Tests for User Story 1

- [ ] T009 [P] [US1] Add failing cases to test/unit/usage-cpu.test.ts for the season and week slots (data-model.md "Week slot"): the season of 2026-11-24 is 2026-09-01 … 2027-08-31, of 2027-03-01 the same, of 2027-09-01 the next; that season has 53 slots, the first 2026-09-01/2026-09-06, the last 2027-08-30/2027-08-31; a season starting on a Sunday that holds 29 February has 54 slots; on 2026-11-24 the current slot is index 12 (2026-11-23/2026-11-29) and slots after it are `toCome`; a week with this team's medians 1,100, 1,400 and 2,000 µs has `own` 2,000; days with `p50Us` null are skipped; a week with no gateway median has `shared` null; `others` is the highest of all other team owners' medians, never named; days before the season's start are ignored
- [ ] T010 [P] [US1] Add failing cases to test/unit/charts.test.ts for `seasonLines`: the scale's top is the smallest of 0.5, 1, 2, 5, 10, 20, 50 … ms at or above the highest slot value (1.8 ms → 2 ms; 11 ms → 20 ms; exactly 2 ms → 2 ms); the `cpu-limit` line is drawn only when the top is ≥ 10 ms; a gap breaks the owner's path into subpaths (a new `M`), never a point at zero; a lone week between gaps is a zero-length subpath (`h0`); one `<path>` per owner with classes `cpu-line cpu-own|cpu-others|cpu-shared` and `vector-effect="non-scaling-stroke"`; the `cpu-now` line sits at the current slot; the SVG has class `cpu-chart`, `preserveAspectRatio="none"`, `role="img"` and the given aria-label; slots to come draw nothing
- [ ] T011 [P] [US1] Add failing cases to test/integration/admin-usage-cpu.test.ts with synthetic CPU days (fixed today 2026-11-24) for this team, another team and `shared`: the opened row shows, in order, intro, graph, legend, line under it, table (contracts/cpu-row.md "Order inside the row"); the `.usage-graph` has `data-slots="53"`, `data-weeks` with one `from/to/own/others/shared` entry per slot up to the current one (µs, empty for no record), `data-names="Dieses Team|Anderes Team|Gemeinsam (Gateway)"`, `data-gap` from `admin.history.gap`; the scale labels read top, middle and "0 ms"; the axis has the twelve months Sep…Aug; the legend names the three owners; medians up to 1.8 ms give the `admin.cpu.under` line and no `cpu-limit`, a week at 11 ms gives `admin.cpu.underLimit` and the limit line; no other team's name appears; a season without any median shows the `cpu-empty` line instead of graph, legend and under line, and the table as before; the page makes no Cloudflare call
- [ ] T012 [P] [US1] Add a failing case to e2e/smoke.e2e.ts (Chromium, Hamburg fake mode): open Admin › Nutzung, open the CPU row, hover a past week of the `.cpu-chart`: the `usage-tip` shows a date range and the three owner names; the existing `.usage-chart` count of 8 stays

### Implementation for User Story 1

- [ ] T013 [US1] In src/usage/cpu.ts add the pure season and week-slot functions (research R3): the season of a UTC day (1 Sep of that year from September on, else of the year before, to 31 Aug; not `SEASON_START_DATE`), Monday–Sunday slots cut at the season edges, and per slot `{from, to, own, others, shared, toCome}` with the highest non-null `p50Us` per owner group, grouped like `cpuRows` (one notion of "others"). T009 passes
- [ ] T014 [US1] In src/http/charts.ts add `seasonLines` (research R5): viewBox `0 0 530 120`, straight segments between slot centres, subpaths broken at gaps, a lone week as `M…h0` (round caps make it a dot), grid lines at the top and middle, the dotted `cpu-now` line at the current slot, the `cpu-limit` line only when the top ≥ 10 ms, and a scale helper returning the top. No text inside the SVG. T010 passes
- [ ] T015 [US1] Add the catalog keys to src/i18n/messages/de.ts (German the source, contracts/cpu-row.md "Catalog keys"): `admin.cpu.chart` ("Median-CPU-Zeit je Woche, Saison {season}: {names}"), `admin.cpu.months` ("Sep|Okt|Nov|Dez|Jan|Feb|Mär|Apr|Mai|Jun|Jul|Aug"), `admin.cpu.under` ("Je Woche der höchste Tages-Median, die gepunktete Linie ist heute. Das Limit von 10 ms je Lauf liegt weit über diesem Ausschnitt."), `admin.cpu.underLimit` ("Je Woche der höchste Tages-Median, die gepunktete Linie ist heute, die rote gestrichelte das Limit von 10 ms je Lauf."), `admin.cpu.seasonNone` ("Für diese Saison ist noch kein Median aufgezeichnet. Die Grafik füllt sich ab dem ersten aufgezeichneten Tag."); then the same keys in en, da, fi, fr, is, lt, nb, nl, sv (month names in each language, September first); add them to the key list in test/unit/catalogs.test.ts
- [ ] T016 [US1] In src/http/admin/usage.ts read CPU days once from the earlier of the season's first day and 29 days ago (research R4), split into the table's 30 days and the season's days, build the week slots, and render the graph block exactly as contracts/cpu-row.md "Season graph": `cpu-graph` with `cpu-scale` labels (top, middle, 0 in `admin.cpu.ms`), the `.usage-graph` wrapper with `data-locale`, `data-slots`, `data-weeks`, `data-names`, `data-gap`, the `seasonLines` SVG with the `admin.cpu.chart` aria-label (season as "2026/27"), the `cpu-axis` months, the `cpu-legend` (solid, dashed, dotted swatches; names `admin.history.team`, `admin.teams.other`, `admin.teams.shared`), the `admin.cpu.under`/`underLimit` line; the `cpu-empty` line when no slot has a value (FR-012). Placed after the intro and the unavailable notice, before the table. T011 passes
- [ ] T017 [P] [US1] In src/http/style.ts add the `cpu-*` rules from the design draft (cpu-graph, cpu-scale, cpu-chart, cpu-grid, cpu-now, cpu-limit, cpu-line with cpu-own solid `--rp-graph-1`, cpu-others dashed `--rp-graph-2`, cpu-shared dotted `--rp-graph-3`, round caps, cpu-axis, cpu-legend, cpu-head, cpu-empty), and `white-space: pre-line` for the CPU tip; nothing else changes; phone and desktop without sideways scrolling (FR-013)
- [ ] T018 [P] [US1] In public/app.js extend `usageGraphs` with a `data-weeks` branch (research R6): the touched slot from the pointer's x over `data-slots`, the cursor covering that slot, the tip as text (`textContent` only) "dd.mm.–dd.mm.yyyy" then one line per owner name from `data-names` with its value in ms, one decimal, `Intl.NumberFormat(data-locale)`, or `data-gap` when empty; slots past the last `data-weeks` entry hide the tip
- [ ] T019 [P] [US1] In dev/fake-strava/seed.ts, beside `seedUsage`, seed synthetic CPU days (research R9) for every owner of `TEAMS` plus `shared` from the season's first day to the fake today: runs, cut-off 0, p99 and a p50 as a gentle repeatable wave well under 10 ms (e.g. 1–2.5 ms), one week with no `shared` row; clear these rows where `seedUsage` clears its own. Synthetic values only. T012 passes

**Checkpoint**: `pnpm test test/unit/usage-cpu.test.ts test/unit/charts.test.ts test/integration/admin-usage-cpu.test.ts test/unit/catalogs.test.ts` passes; the e2e case passes in Chromium (`pnpm test:e2e --project=chromium -g "CPU"` or the file's own filter).

---

## Phase 4: User Story 2 - The table shows the median next to the slowest runs (P2)

**Goal**: each cell reads "median / slowest ms" over the cut-off runs, the
meaning in each owner's header (contracts/cpu-row.md "Table").

**Independent Test**: with synthetic days, one with a median and one recorded
before this feature, check each cell and the headers.

### Tests for User Story 2

- [ ] T020 [P] [US2] Add failing cases to test/integration/admin-usage-cpu.test.ts: a day with median 1,400 µs, p99 7,800 µs, 0 of 1,234 cut off reads `1,4 / 7,8&nbsp;ms<br>0 von 1.234 abgebrochen`; a day with a NULL median reads `– / 7,8&nbsp;ms` over its cut-off line, never "0"; a cell with cut-off runs keeps its mark after the cut-off text (feature 025 FR-043 unchanged); an owner without a record that day reads `–`; each owner's header has the second line `<span class="cpu-head">Median / langsamste</span>`; the intro reads the short text of contracts/cpu-row.md; update the existing cell assertions in test/integration/admin-usage.test.ts that expect the old `admin.cpu.cell` text

### Implementation for User Story 2

- [ ] T021 [US2] In src/i18n/messages/de.ts add `admin.cpu.pair` ("{median} / {slowest} ms"), `admin.cpu.cutOff` ("{cut} von {runs} abgebrochen"), `admin.cpu.pairHead` ("Median / langsamste"), replace `admin.cpu.intro` with "Jeder Lauf eines Workers darf 10 ms CPU-Zeit nutzen. Abgebrochene Läufe sind Fehler, einzelne Ausreißer verzeiht Cloudflare. Median: Die Hälfte der Läufe eines Tages blieb darunter. Langsamste: die langsamsten 1 von 100 Läufen." and remove `admin.cpu.cell`; the same in the other nine catalogs; update the key list in test/unit/catalogs.test.ts (add the three, drop `admin.cpu.cell`)
- [ ] T022 [US2] In `cpuBody` in src/http/admin/usage.ts render each cell as `admin.cpu.pair` (median "–" when null, values with one decimal in the viewer's locale, `&nbsp;` before "ms") `<br>` `admin.cpu.cutOff` plus the existing mark; add the `cpu-head` second line to each owner's header. T020 passes

**Checkpoint**: `pnpm test test/integration/admin-usage-cpu.test.ts test/integration/admin-usage.test.ts test/unit/catalogs.test.ts` passes.

---

## Phase 5: User Story 3 - Fill the earlier part of the season once (P3)

**Goal**: a one-time manual script fills missing medians of the season per team
from Cloudflare, idempotently (contracts/fill-task.md, research R8). No
automated test for the script itself.

**Independent Test**: the local run in quickstart.md "The fill task, locally".

### Tests for User Story 3

- [ ] T023 [P] [US3] Add failing cases to the existing `queryCloudflare` tests (find them with `grep -rln "queryCloudflare\|cloudflareAnalytics" test`): without a range it still asks for yesterday to today; with an optional `{ from, to }` day range it sends exactly that range in the query variables

### Implementation for User Story 3

- [ ] T024 [US3] In src/usage/cloudflare.ts give `queryCloudflare` an optional day range (default yesterday–today, behaviour of every existing caller unchanged). T023 passes
- [ ] T025 [US3] Create scripts/cpu-median-fill.mjs (Node ES module, importing the app's TypeScript through `registerHooks` as scripts/sandbox-usage.mjs does; `TEAMS` from src/teams/index.ts; `CPU_QUERY`, `parseCpu`, `cpuByOwner` from src/usage/cpu.ts; `queryCloudflare` from src/usage/cloudflare.ts): refuses with one line and exit 2 without exactly one known `--team`, without exactly one of `--local`/`--remote`, or without `CLOUDFLARE_ANALYTICS_TOKEN`/`CLOUDFLARE_ANALYTICS_ACCOUNT_ID` (never prints the token); reads `SELECT day, owner FROM usage_cpu_daily WHERE cpu_p50_us IS NULL AND day >= <season start> AND day < <today>` via `wrangler d1 execute DB --env <team> --json (--local|--remote)`; a "no such column" answer prints "the release adding the median isn't applied to this database yet" and exits 1; asks Cloudflare one UTC day at a time from the earliest such day to yesterday, a refused or empty day counting as not held; writes one `UPDATE usage_cpu_daily SET cpu_p50_us = ? WHERE day = ? AND owner = ? AND cpu_p50_us IS NULL;` per answered row lacking a median into a temp SQL file run with `wrangler d1 execute --file`; never inserts; prints the summary of contracts/fill-task.md "Output"
- [ ] T026 [US3] Add `"cpu:fill-median": "node scripts/cpu-median-fill.mjs"` to package.json; make sure scripts/test-scope.mjs and scripts/e2e-scope.mjs need no change (the script is read by no test) and that nothing in src/ imports it (FR-017)

**Checkpoint**: `pnpm test` of the `queryCloudflare` test file passes; the local run of quickstart.md fills medians, and a second run reports 0 for every owner.

---

## Phase 6: Polish

- [ ] T027 `pnpm lint` and `pnpm typecheck` clean; run the checkpoint test files of Phases 2–5 together once; leave the full suites to CI

---

## Dependencies

- Phase 2 blocks every story (the column and `p50Us`).
- US1 (Phase 3) and US2 (Phase 4) both edit src/http/admin/usage.ts, the catalogs
  and test/integration/admin-usage-cpu.test.ts: do them one after the other, US1
  first.
- US3 (Phase 5) needs only Phase 2 and can run beside US1/US2.
- Inside a story: tests first and failing, then implementation.

## Parallel examples

- Phase 2: T001, T002, T003, T004 together; then T005 → T006 → T007 → T008.
- US1: T009, T010, T011, T012 together; after T013–T016, T017, T018, T019 together.
- US3: T023 beside any US1/US2 task.

## Implementation strategy

1. Phase 2: the median is recorded from the next hour on, nothing visible yet.
2. US1 (MVP): the season graph. Shippable alone; the table keeps its old cell.
3. US2: the table pair and the short intro.
4. US3: the fill script; the maintainer runs it once per team with `--remote`
   after CI has deployed the release (a manual step, never from here).
