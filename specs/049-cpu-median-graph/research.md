# Research: CPU Median Over the Season

## R1. Where the median comes from

**Decision**: Add `cpuTimeP50` to the `quantiles` block of the existing
`CPU_QUERY` (`src/usage/cpu.ts`), next to `cpuTimeP99`. `parseCpu` reads it
per Worker and day; `cpuByOwner` keeps the highest of an owner's Workers, as it
does for the 99th percentile.

**Rationale**: Cloudflare's `workersInvocationsAdaptive` returns every quantile
of a group in the same answer, so the median costs no extra request and shares
the CPU query's failure handling (FR-003, feature 025 FR-045). The parser stays
strict: an answer without the field reads as unavailable, like one without
`cpuTimeP99`, so a changed API is noticed rather than recorded as zero.

**Alternatives considered**: A query of its own for the median (another request
per hour, a second failure path, for no gain); `cpuTimeP25`/`P75` as a band
(not asked for; one line per owner is what the graph can show readably).

## R2. Storage

**Decision**: Migration `0042_usage_cpu_median.sql` adds one nullable column,
`usage_cpu_daily.cpu_p50_us INTEGER`, in microseconds like `cpu_p99_us`. NULL
means "no median recorded" (days before the release, days Cloudflare no longer
holds). The upsert sets it with the other figures; the reader returns it.
Pruning already deletes whole rows, so it goes with them (FR-004).

**Rationale**: Only adds (CLAUDE.md, FR-002). The release before names its
columns in its `INSERT … ON CONFLICT DO UPDATE`, so it keeps working and leaves
the new column untouched while CI rolls out. NULL rather than 0 keeps "no
record" apart from "very fast" (SC-003).

**Alternatives considered**: A separate median table (two writes, a join, a
second prune for one number per row); a default of 0 (reads as a real value).

## R3. Week values and the season

**Decision**: A pure function in `src/usage/cpu.ts` turns the season's CPU days
into week slots:

- The season of a UTC day: 1 September of that year when the day is in
  September or later, else of the year before, to 31 August (the same for every
  team, FR-020; not `SEASON_START_DATE`, which differs per team).
- Slots run Monday to Sunday by UTC day, the first cut at 1 September and the
  last at 31 August: 53 slots, 54 in a season that starts on a Sunday and holds
  29 February.
- Per slot and owner group (this team, the other teams, the gateway) the
  highest non-null median of its days, or null. The other teams' value is the
  highest of all other team owners (FR-006), never named.
- Slots after today are "to come": no value and no tip.

**Rationale**: Mirrors `cpuRows`, which already groups owners the same way for
the table; keeping it next to it keeps one notion of "other teams". Pure, so the
max strategy, cut weeks and gaps are unit-tested without a page.

**Alternatives considered**: Computing weeks in SQL (`strftime` week numbers
start on Sunday or follow ISO years, neither cuts at the season edge); the
team's `SEASON_START_DATE` (Europe's code still starts in January; the spec
fixes 1 Sep – 31 Aug).

## R4. Reading for the page

**Decision**: The page makes one `readCpuDays` call from the earlier of the
season's first day and the table's first day (29 days ago), and splits the rows:
the last 30 days for the table, the season's for the graph.

**Rationale**: At most ~370 days × 3–4 owners ≈ 1,500 small rows, read by the
primary key's day range (`WITHOUT ROWID`), well inside the free D1 allowance and
the page's CPU budget (SC-004). One read instead of two.

## R5. Drawing the graph

**Decision**: A new `seasonLines` in `src/http/charts.ts` draws the SVG: one
`<path>` per owner whose subpaths break at gaps (a lone week is a zero-length
subpath with round caps, so it shows as a dot), straight segments between week
centres, a dotted line at today, grid lines at the scale's top and middle, and
the 10 ms limit line only when the scale reaches it. Classes `cpu-chart`,
`cpu-line cpu-own|cpu-others|cpu-shared`; colours `--rp-graph-1..3`, and line
style (solid, dashed, dotted) tells the owners apart without colour (FR-008).
`preserveAspectRatio="none"` with `vector-effect="non-scaling-stroke"`, as the
other usage charts, so it fills the row at any width (FR-013).

Scale: the smallest of 0.5, 1, 2, 5, 10, 20, 50 … ms at or above the season's
highest week value. Labels (top, middle, 0 ms) and the twelve month names
(September to August, evenly spaced as in the design draft) are HTML around the
SVG, so text never stretches. The line under the graph says either that the
dashed red line is the limit, or, when the scale stays below 10 ms, that the
limit lies far above (FR-010).

**Rationale**: The usage charts are server-drawn SVG with no library and no
client rendering (feature 016 R5); the CPU budget for one path per owner over
53 points is negligible. A new class keeps `.usage-chart` (and the e2e count of
those) for the allowance histories.

**Alternatives considered**: Smooth curves (`monotonePath`): suggest values
between weeks that were never measured; reusing `sparkline` (one series, no
gaps).

## R6. Hover and tap

**Decision**: The graph's wrapper is a `.usage-graph` with `data-weeks`: one
entry per slot up to the current week, `from/to/own/others/shared` (days as
`YYYY-MM-DD`, values in µs, empty for no record), plus `data-slots` (all slots),
`data-names` (the three owner names, `|`-separated) and `data-gap` ("Nichts
aufgezeichnet"). `usageGraphs` in `public/app.js` gains a branch for
`data-weeks`: the cursor covers the touched slot, and the tip, as text with
line breaks (`white-space: pre-line`), says the week's dates and the three
values with one decimal in ms. Slots to come hide the tip.

**Rationale**: Same pattern as the allowance histories: figures in data
attributes, words from the catalogs, formatting with `Intl` in the viewer's
locale, `textContent` only. The server decides the slot dates, so the client
does no calendar arithmetic.

## R7. Table cell and copy

**Decision**: The cell becomes two lines: `admin.cpu.pair` ("{median} /
{slowest} ms", the median "–" when null) and `admin.cpu.cutOff` ("{cut}
von {runs} abgebrochen") with the existing mark after it. Each owner's column
header gains a second line `admin.cpu.pairHead` ("Median / langsamste",
class `cpu-head`). `admin.cpu.intro` is replaced by the short text of the
design draft; `admin.cpu.cell` goes from all ten catalogs.

The legend and the tip use the table's own owner names (`admin.history.team`,
`admin.teams.other`, `admin.teams.shared`), so the graph and the table name the
owners alike. The design draft's "Andere Teams" / "Gateway" were example words.

## R8. The one-time fill task

**Decision**: `scripts/cpu-median-fill.mjs`, run as
`pnpm cpu:fill-median --team <id> (--local | --remote)`:

1. Refuses without exactly one known team and exactly one of `--local` /
   `--remote`, and without `CLOUDFLARE_ANALYTICS_TOKEN` and
   `CLOUDFLARE_ANALYTICS_ACCOUNT_ID` in the environment (FR-016).
2. Reads the team's rows of the season lacking a median through
   `wrangler d1 execute DB --env <team> --json --command "SELECT day, owner …
   WHERE cpu_p50_us IS NULL AND day >= ?"`. A missing column means the release
   isn't deployed there yet: it says so and stops.
3. Asks Cloudflare `CPU_QUERY` one UTC day at a time, from the earliest such
   day to yesterday, through the app's own `queryCloudflare` (gaining an
   optional day range) and `parseCpu`/`cpuByOwner` with `TEAMS`, imported from
   Node as `scripts/team-check.mjs` and `scripts/sandbox-usage.mjs` do. A day
   Cloudflare refuses or returns nothing for is "not held".
4. Writes one `UPDATE usage_cpu_daily SET cpu_p50_us = ? WHERE day = ? AND
   owner = ? AND cpu_p50_us IS NULL` per answered row lacking a median, in one
   SQL file executed with `wrangler d1 execute --file`.
5. Prints per owner the days filled and the first and last day Cloudflare
   answered for.

**Rationale**: The `IS NULL` guard and updating only existing rows make a
second run a no-op and keep every other figure and every recorded median
(FR-015, FR-016). Day-by-day requests stay inside any per-query range limit of
the dataset and make "how far back does Cloudflare answer" fall out of the run
instead of needing to be known. Reusing the app's query and parser means the
filled medians are the same figure the hourly recording keeps. Nothing in
`src/` imports it and it is no CI step (FR-017); once it has run on every team
it can be deleted.

**Alternatives considered**: Fill logic in the Worker behind a flag or a run-once
marker (permanent code and state for a one-off); a guard against a second run
(not needed, the update is idempotent).

**Tests**: The parts it reuses (median parsing, owner max, day range) are
covered by the app's tests. The script itself is a seldom-run manual tool and
gets no automated test, per the maintainer's standing rule for such tools; its
check is the local run in [quickstart.md](quickstart.md).

## R9. Fake mode

**Decision**: The fake-mode seed (`dev/fake-strava/seed.ts`, beside
`seedUsage`) adds synthetic CPU days for every owner from the season start to
today, with one gap week for the gateway, so the graph, the table and the e2e
smoke test have something to show. Values are a gentle repeatable wave well
under the limit, never real figures.

**Rationale**: Without them fake mode shows "no CPU figures" and the hover can't
be checked in a browser. `dev/` never reaches the bundle.
