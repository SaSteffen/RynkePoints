# Research: Organiser Progress Graphs

## R1. Where the daily figures come from

**Decision**: Sum at read time from `ride_results` joined to `activities`, where `counts = 1`, grouped
by rider and `substr(start_date_local, 1, 10)`. Distance is `activities.distance_m`, split by
`ride_results.is_virtual`. Elevation is `ride_results.elevation_dm`.

**Rationale**: FR-005 wants recorded distance, not Rynke; `distance_rynke` is rounded per ride. The
result follows edits, deletions and reprocessing, and vanishes with the rider through the cascade
(FR-026). `counts = 1` already excludes rides outside the season, flagged, manual and overlapping ones.

**Alternatives considered**: A stored daily table costs a migration and writes to keep in step, and
would be data that can outlive its source. Reusing `listWeeklyRideSumsStatement` gives weeks in Rynke.

## R2. Enforcing consent, and the cost

**Decision**: Both statements filter inside SQL with `LISTED_RIDER_IDS` and
`sharedRiderIdsSince(SINCE_VERSION.dailyFigures)`. They run in one `db.batch` with the open requests,
only when the section is on.

**Rationale**: This is the existing rule in `src/db/consents.ts`: a rider without the consent is in no
row. A second statement lists the agreed riders, because a rider who agreed and has no rides still needs
a flat line. Batching keeps the page's D1 round trips as they are, which `d1-round-trips.test.ts` guards.

**Cost**: 40 riders × 150 rides, reading each `ride_results` and `activities` row, is about 12,000 rows
per page load. `readTeam` already costs the same for its weekly sums, so a load costs about 24,000 in all.
The Free plan's 5 million rows a day would take about 200 such loads, far above what organisers do. `ride_results_by_rider` already
exists; no new index.

**Alternatives considered**: Filtering in TypeScript breaks the repository's rule and risks leaking on a
mistake.

## R3. How the figures reach the page

**Decision**: Inline `<script type="application/json" id="organiser-graphs-data">`, escaped as in
`progress-section.ts`, with sparse per-rider rows and dense team totals (data-model.md).

**Rationale**: It's the existing pattern, takes one request and has one place to test what is sent. About
6,000 rows at 18 bytes is about 100 KB raw and about 25 KB compressed. Tiles reload it, which is fine at
organiser traffic.

**Alternatives considered**: A separate JSON route would avoid resending on tile clicks, but adds a route
to protect, a loading state and an error state for little gain.

## R4. Drawing and dragging

**Decision**: Chart.js line charts with `animation: false`, `parsing: false`, `normalized: true` and no
points. Pointer handling and the marked stretch are our own, as in `progressCharts()`. The zoom plugin
isn't registered. The canvas has `touch-action: pan-y`.

**Rationale**: FR-013 makes a drag a date choice, not a zoom, and all graphs must follow together. The
plugin would own the scales and fight the date boxes. `pan-y` gives story 3's rule: up and down scrolls,
sideways selects. The library needs no change, and `organiserPage` returns `{ body, scripts }` as the
Overview section does. Only `chart-4.6.1.umd.min.js` is listed.

**Check while building**: 40 lines × 300 points × 3 charts on a mid-range phone. Below 1100 px only one
chart draws at a time, so the cost is one chart.

**Alternatives considered**: The draft's SVG polylines are a draft's convenience; a canvas is lighter at
this count and already loaded elsewhere. No new library, so Principle IV needs no justification.

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

**Decision**: Add version 3 with `changes: ["consent.dailyFigures", "landing.purpose"]`. `requiredScopes` stay the same, so no trip through Strava. Its `published` date is
the release day. `consent-form.ts` renders the new line after `consent.organisers`.

**Rationale**: Constitution Principle I: anything newly shown to someone else needs asking again. A
separate message tells returning riders exactly what grew, as `consent.admins` did for version 2.

**Text that has to change** (contracts/messages.md):

- `privacy.visibility.organisers` ends "but no individual activities".
- `landing.purpose` says "Only you see your individual rides and their names". On a day with one ride, the
  organiser's daily total equals that ride's distance and elevation, so the sentence is reworded to say what
  stays private: the list of rides and their names.
- Private rides that count enter the totals, and the new line says so (`landing.private` is about reading
  them).

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
