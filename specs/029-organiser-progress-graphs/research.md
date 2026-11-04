# Research: Organiser Progress Graphs

## R1. Where the daily figures come from

**Decision**: from `rider_summaries`. `days` already holds each counting day's distance and elevation. A new
`virtual_days` adds `[date, virtualM]`, only for days with a virtual ride, and outdoor is the day's distance
minus that. `summaryOf` works it out from the `virtual` flag `figuresOf` already gives.

**Rationale**: every change to a rider's rides already reaches this row through `riderWrites`: edits, deletions,
private rides withdrawn, rule changes. `ON DELETE CASCADE` removes it with the rider (FR-026). A separate column
keeps it out of the team reads, which don't need it.

**Filling existing riders**: the version goes to 2, so the daily job evaluates every rider once, about 27,000
rows. A migration backfill isn't used: rides arriving between migration and deploy would leave it stale.

**Rider without a version 2 row**: nobody can have agreed to consent version 3 before the release, but one may
agree before the next daily job. Their days are added up in a second round trip, for those riders only, as the
team reads do. So they get correct lines, never a false zero.

## R2. Measured cost, and enforcing consent

**Measurement**: 40 riders with 150 counting rides each, at `meta.rows_read`:

| Read | Rows read |
| --- | --- |
| Summing per day at load, joined over `ride_results` and `activities` | 18,239 |
| A table with one row per rider and day | 6,199 |
| One row per rider, as the Team page now reads | about 160 |

**Decision**: one statement in the requests batch, from `riders r`: `listedRiderFilter("r")`, an `EXISTS` on
`consent_records` with `SINCE_VERSION.dailyFigures`, and a `LEFT JOIN` on `rider_summaries` at version 2 or
higher. It selects `days` and `virtual_days` only. The left join gives agreed riders without rides. It runs only
when the section is on.

**Rationale**: this is the rule in `src/db/consents.ts`: a rider without the consent is in no row. Batching keeps
the page's D1 round trips as they are, which `d1-round-trips.test.ts` guards. `d1-rows.test.ts` gets SC-008.

**Alternatives considered**: a cached team-wide blob reads less still, but a leaver's data would stay in it until
the next write, against FR-026. A separate JSON route with an ETag only helps repeat views.

## R3. How the figures reach the page

**Decision**: Inline `<script type="application/json" id="organiser-graphs-data">`, escaped as in
`progress-section.ts`, with sparse per-rider rows and dense team totals (data-model.md).

**Rationale**: It's the existing pattern, takes one request and has one place to test what is sent. About
6,000 days at 18 bytes is about 100 KB raw and about 25 KB compressed. With the summary, a tile click reloading
it costs few rows.

**Alternatives considered**: A separate JSON route adds a route to protect, a loading state and an error state
for little gain now.

## R4. Drawing and gestures

**Decision**: Chart.js line charts with the zoom plugin, using the rider charts' interaction. `progressCharts()`'s
pointer handling moves into a shared helper in `public/app.js`, and both use it.

| Input | Action |
| --- | --- |
| Touch | Vertical swipe scrolls the page (`touch-action: pan-y`), pinch zooms, sideways drag moves the period, tap selects a day |
| Mouse | Drag selects a stretch, wheel zooms when focused, shift-drag moves, hover selects a day |
| Keyboard | As the rider charts, and the date boxes for a range |

Each zoom or move sets `from` and `to`, updates the date boxes and the other graphs, and recalculates running
totals and the y axis for the new range. Season resets the zoom.

**Rationale**: The user asked for phones to work as the existing charts do. This replaces the draft's sideways
drag to select on touch; a sideways drag can't both move and select, and consistency wins. The date boxes still
give any range, down to a single day, which gestures limit to `PROGRESS_MIN_DAYS`.

**Performance**: `animation: false`, `parsing: false`, `normalized: true`, no points. Below 1100 px only one chart
exists at a time. Check 40 lines × 300 points on a mid-range phone while building.

**Alternatives considered**: The draft's SVG polylines are a draft's convenience; a canvas is lighter at this count
and already loaded elsewhere.

## R5. State across a tile click

**Decision**: Tiles stay links and go through `swapPage`. A module-level object keeps range, Running/Per
day, team lines, metric tab and Graphs/Riders. Rider selection comes from the new group. A full reload
starts afresh.

**Rationale**: Story 4 says a tile replaces the riders and leaves team lines alone. Keeping tiles as links
keeps `?group=`, back and forward working. Module state resets on reload, as the spec's "not saved"
assumption says.

**Alternatives considered**: Client-side tiles would duplicate the server's group logic and break the
tests that pin it. `sessionStorage` would outlive a reload.

## R6. Consent version 3

**Decision**: Add version 3 with `changes: ["consent.dailyFigures"]`. `requiredScopes` stay the same, so no trip
through Strava. Its `published` date is the release day. `consent-form.ts` renders the new line after
`consent.organisers`.

**Rationale**: Constitution Principle I: anything newly shown to someone else needs asking again. A separate
message tells returning riders exactly what grew, as `consent.admins` did for version 2.

**Text** (contracts/messages.md): `landing.purpose` stays as it is, and the privacy page keeps "but no individual
activities": organisers see daily kilometres, not rides. The privacy line gains the daily totals. Private rides
that count enter the totals, and the new line says so.

## R7. The visibility table

**Decision**: Add `dailyFigures` to `RiderData`, in `VISIBILITY` as `ORGANISER_ONLY` and in `SINCE_VERSION`
as `DAILY_FIGURES_SINCE_VERSION = 3`. `rides` stays `NOBODY`.

**Rationale**: It's the single table of who sees what, and the SQL reads its number. Daily figures aren't
`rides`, as the spec decides, and the separate entry keeps single rides at nobody.

## R8. The two settings

**Decision**: `organiserProgressGraph(env)` throws on anything but "on" or "off", like
`trainingLeaderboard`. The section and its reads exist only when it's on and `organiserFigures(env)` is
"full". `wrangler.jsonc` gets "on", which a team can change before release.

**Rationale**: FR-027, FR-029. Nothing in `src/consent.ts` imports either setting, and a test pins that
versions are the same in both states (FR-028).

## R9. One breakpoint

**Decision**: 1100 px, the existing point where table takes over from cards. Below it the phone layout
applies with no separate tablet layout. The two-column cards from 840 px go away with the cards.

**Rationale**: The draft has two layouts. A third adds styling without a request behind it.

## R10. Rows, search and groups on narrow screens

**Decision**: The narrow list renders every listed rider, with those outside the current group `hidden`.
The script applies search, and expands rows when 5 or fewer show. Each row is a `<details>`: the summary is
the one line, and the body is today's card content in its full or percent form. The table keeps filtering
on the server.

**Rationale**: Search must reach the whole team regardless of group, without a request per keystroke. Reusing
the card content keeps the breakdown and the percent mode as they are.

**Default group**: `group === null` stays "Everyone" on wide and "Need a push" on narrow. Today's CSS rule
moves to the rows, and the script picks the preselection from `matchMedia("(min-width: 1100px)")`.

**Reports box**: narrow only, through CSS. It uses `riderRequestLines` for up to 3 requests. "Show all N"
links to `?group=requests&view=riders`, and `view=riders` opens the Riders view.

## R11. Fake-mode riders

**Decision**: About 25 riders from a small generator, in the unused part of IDs 990001–990099, about 30
rides each, varied in rhythm and virtual share, some starting late, some stopping. A new optional
`consentVersion: 2` on `SampleRider` for three or four. After `connectThroughApp`, the seed replaces that
rider's records with version 2, because `/connect` only accepts the current version.

**Rationale**: About 750 extra rides keep seeding and `dev-fake-strava.test.ts` reasonable while still
looking like a season. Signing in as a held-back rider shows the consent gate, which also demonstrates
story 2.

## R12. Text alternative

**Decision**: Legends are real HTML buttons with the values. Each canvas has an `aria-label` naming measure
and range. Highlights and day values go through an `aria-live` readout, and arrow keys move the day. Date boxes
are the keyboard way to choose a range.

**Rationale**: FR-009. A table per day and rider would be 12,000 cells; the legend holds the same totals, and the
readout gives each day on request.

## R13. Line colours and themes

**Decision**: The draft's eight line colours become style tokens, checked per theme from feature 022 for
contrast against the graph background, and adjusted where a theme fails. Team average keeps the draft's yellow
halo in light themes and uses the theme's accent elsewhere.

**Rationale**: The draft shows one theme; the app has several.

## R14. Changing the row's format without a costly day

**Finding**: reads today only accept `version = RIDER_SUMMARY_VERSION`. Raising it would send the whole team
back to adding up rides until the daily job has run: about 8 million rows on a full-season day, over the free
limit of 5 million, which would make the app fail until D1's daily reset.

**Decision**: each read states the lowest version whose columns it can use. Team reads keep accepting 1, since
`days`, `weeks`, `run_days`, `active` and `attended` are unchanged. The graphs and the rider's own figures need 2.
`riderWrites` and the daily job still aim for the current version, so all rows reach 2 by the next daily job.

**Rationale**: no new moving part, and it removes the risk at its cause. Until the refill, only the Badges page's
own part and the graphs of riders who agreed in that time add up, each at today's cost or less. A test with all
rows at version 1 guards this.

**Alternatives considered**: refilling on deploy needs a route or a CI step reaching production, and a more
frequent job still leaves a costly period. A later change to what an existing column means would need its floor
raised and so a full refill. Then, and only then, a refill run from the hourly job (`USAGE_CRON`) is worth building.

**During deploy**: CI applies the migration before publishing. Old code keeps writing version 1 and reading only
version 1, so a rider evaluated by the new code counts as added up for the seconds until the old code is gone.

## R15. The Badges page's own part

**Measured**, one view with 150 rides: 996 rows, of which 752 are the rider's rides, read by the two statements
for totals and for outdoor days per month. Teams: 161. Badges and reveals: 79.

**Decision**: a new `own_days` holds `[date, longestM, outdoor]` per counting day. With `days` and `virtual_days`
it gives every figure of those two statements, keeping their `date <= deadline` filter. The batch reads the
rider's row by primary key, one row. A rider without a version 2 row gets the two statements in a second round
trip, as today's figures. Runs and swims stay as they are: few rows.

**Rationale**: about 30,000 rows a day at 150 rides per rider, and the page stops growing with rides. `own_days` is
separate from `virtual_days` so that the graphs' read never touches a rider's longest ride.

**Exactness**: `evaluate` still decides earned badges from rides; these figures only show progress. Distances may
differ from SQL's sum by floating-point noise, as stored-summary research found, and are shown rounded. A test
compares them with the two statements on decimal distances.

**Evaluating a new ride** keeps reading the rider's rides. It has to.

## Measured on the finished code

40 riders with 150 rides, 20 runs and 10 swims each, at `meta.rows_read`; `d1-rows.test.ts` guards the limits.

| Use | Rows read | Limit |
| --- | --- | --- |
| Organiser's rider list with the graphs | 743 | under 1,000 more than without |
| The same with the setting off | 623 | |
| Badges page | 395 (1,146 before) | 500 |
| Opening the app | 301 | 400 |
| Team page | 264 | 500 |
| New ride | 858 | 1,500 |
| Daily estimate, as in the stored rider summaries | 123,585, about 2.5% of the free limit | 5% |

The stored rider summaries' figures for team reads did not move, so they stay as recorded.

**The day of the release**: team reads stay cheap (R14). One cost remains until the daily job has run: a rider who
agrees to version 3 before their row reaches version 2 is added up per organiser page, about 440 rows per rider.
If all 40 agree first, a page costs about 19,000 rows, less than the 21,152 this page cost before the stored rider
summaries, and it ends with the next daily job.

**Drawing**: 42 lines over 300 days, chromium with a phone viewport and CPU throttling, software rendering:

| CPU | Page to first chart | A preset | One frame of a drag |
| --- | --- | --- | --- |
| Unthrottled | 676 ms | 9 ms | 17 ms |
| 4x slower | 1,134 ms | about 45 ms | about 55 ms |
| 6x slower | 1,407 ms | about 60 ms | about 85 ms |

A phone shows one graph at a time, so this needs no thinning of the lines.
