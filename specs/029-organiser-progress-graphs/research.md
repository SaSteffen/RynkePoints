# Research: Organiser Progress Graphs

## R1. Where the daily figures come from

**Decision**: One row per rider in a new `rider_ride_summaries`, holding that rider's counting days as
compact JSON. `riderWrites` in `src/rynke/apply.ts` writes it with every evaluation, from a pure function
of the rides and results it already holds. Distance is the recorded `distance_m`, split by whether the ride
is virtual. Elevation is the result's `elevationDm`.

**Rationale**: FR-005 wants recorded distance, not Rynke. Every change to a rider's rides already goes
through this one place: edits, deletions, private rides withdrawn, rule changes. It stays correct without
new triggers, and it's recomputable from stored data as Principle IV asks. `ON DELETE CASCADE` removes it
with the rider (FR-026).

**Filling existing riders**: `listRidersNeedingEvaluation` also returns riders without a row, so the existing
daily job fills them. Nobody can have agreed to version 3 before the release, so nothing shows wrongly in
that time. A migration backfill isn't used: rides arriving between migration and deploy would leave it stale.

**Alternatives considered**: See R2.

## R2. Measured cost, and enforcing consent

**Measurement**: Workers-runtime D1 with synthetic data, 40 riders with 150 counting rides each, at
`meta.rows_read`:

| Read | Rows read |
| --- | --- |
| Summing per day at load, joined over `ride_results` and `activities` | 18,239 |
| A table with one row per rider and day | 6,199 |
| One row per rider (this plan; 40 rows plus about 200 for the consent and listing filters, estimated from the above) | about 250 |
| Existing weekly sums in `readTeam`, for comparison | 18,199 |

Summing at load would cost about 37,000 rows per page load in all, or about 135 loads to use the Free plan's
5 million rows a day. This is why the plan stores a summary.

**Decision**: One statement in the requests batch: `riders LEFT JOIN rider_ride_summaries`, filtered inside SQL
with `LISTED_RIDER_IDS` and `sharedRiderIdsSince(SINCE_VERSION.dailyFigures)`. The left join gives riders who
agreed without any rides. It runs only when the section is on.

**Rationale**: This is the rule in `src/db/consents.ts`: a rider without the consent is in no row. Batching
keeps the page's D1 round trips as they are, which `d1-round-trips.test.ts` guards. Writes grow by one row per
evaluation, against a Free plan of 100,000 written rows a day.

## R2a. The Team page's weekly sums

**Decision**: Decided with the maintainer: `readTeam` takes its weekly sums from a second column of the same
summary, `weeks`. `riderWrites` writes it next to `days`, from the same results. A second statement adds up
rides only for listed riders who have no summary yet, so the pages stay right between the release and the
daily job.

**Measurement**, same synthetic data, statements measured singly (no attendance or corrections seeded, so those
two grow with real use):

| `readTeam` statement | Today | With the summary |
| --- | --- | --- |
| Listed riders | 240 | 240 |
| Balances | 200 | 200 |
| Attendance | 161 | 161 |
| Corrections | 161 | 161 |
| Weekly sums | 18,199 | 200 |
| Riders still without a summary, once all are filled | none | 162 |
| **Total** | **18,961** | **1,124** |

With no summaries yet the second statement costs 18,200, as today. So 40 riders opening the Team page 5 times a
day go from about 3.8 million to about 225,000 rows a day. The Riders view pays the same read, plus the graphs.

**Rationale**: `weeks` has its own column so that this read never selects `days`. The Team page shows weekly
sums under earlier consent, and riders who haven't agreed to the daily figures must stay out of every read of
`days` (FR-024, FR-032). `EXCEPT` in the second statement is needed: filtering with `NOT IN` afterwards still
read 6,200 rows with every summary filled.

**Alternatives considered**: Working the weeks out of `days` at load would read daily values of riders who
haven't agreed. Filling summaries in the migration would miss rides arriving before the new code is live.
No fallback would blank riders' weekly sums for up to a day. `teamBadgeSumsStatements`, used by the badge pages,
stays as it is: it needs more than these sums, and the decision was about the Team page.

**Alternatives considered**: Summing at load, and one row per day, cost too much, as above. A cached team-wide
blob reads less still, but a leaver's data would stay in it until the next write, against FR-026. A separate
JSON route with an ETag only helps repeat views.

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
