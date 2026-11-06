# Research: Ride Stats Leaderboard

## R1. Where the ride figures come from

**Decision**: a new column `rides` in `rider_summaries`. It holds one `[date, distanceM, elevationDm]` entry
per counting ride, sorted by date, then distance, then elevation. `summaryOf` writes it from the rides that
`figuresOf` already passes in (the rides whose `result.counts` is true, with the activity's full
`distance_m` and the result's full `elevationDm`). `RIDER_SUMMARY_VERSION` goes to 3, and a new
`RIDE_SUMMARY_SINCE = 3` marks the first rows that have the column.

**Rationale**:

- `days` already holds full distance and elevation per day, but neither the number of rides nor each ride's
  length. The count (FR-002) and the median (FR-009) need both.
- One entry per ride covers sessions, kilometres, elevation and the typical ride for every period, and the
  organiser's sessions per day too.
- An entry carries no ride ID, name or time, so the row stays derived data like the rest (Principle IV).
- Every change to a rider's rides already reaches this row through `riderWrites`: edits, deletions, private
  rides withdrawn and rule changes. `ON DELETE CASCADE` deletes it with the rider.
- A ride counts here exactly when it counts for Rynke, because both use the same `counts` (FR-001). Like
  `ownFiguresOf`, the readers also drop entries outside the season start and the deadline (FR-011 of 003).

**Filling existing riders**: as in feature 029 R1, the version bump makes the daily job evaluate every rider
again. That is about 27,000 rows for 40 riders, once. Existing readers keep using version 1 and 2 rows
(`TEAM_SUMMARY_SINCE`, `OWN_SUMMARY_SINCE`), so nothing else goes back to adding up rides.

**Rider without a version 3 row**: until the daily job has run, they are added up from `ride_results` joined
with `activities`. This happens in a second round trip for those riders only, with the consent checked again
there. They get correct figures, never a false zero (as in 029 R1).

**Alternatives considered**:

- Per-period aggregates stored per rider: "this week" and "this month" go stale at midnight without a write.
- Summing in SQL at load: about 18,000 rows read for 40 riders (029 R2), against about 160 now.
- Per-day counts plus a stored median: a median can't be combined across days or riders, so the team's
  typical ride needs the single lengths anyway.

## R2. Size and cost of the read

**Estimate**: a rider has about 150 counting rides a season, at about 25 bytes per entry, so 3.7 KB of JSON.
For 40 riders that is about 150 KB from D1 and well under 10 ms to parse. For 200 riders (SC-006) it is about
750 KB, still one row per rider.

**Decision**: the column is read only where it is needed:

- On `/team`, only when a ride figure is picked, or when the team has no Rynke views.
- On `/organiser/riders`, only when `RIDE_FIGURES` is on.

The Rynke default of `/team` reads exactly what it reads today (SC-003). The rows read grow only by the
consent `EXISTS` per rider (R4). `d1-rows.test.ts` and `d1-round-trips.test.ts` pin both pages.

**Alternatives considered**: a separate JSON request per period makes a tap cost a round trip and adds a
route to protect. Cutting the column to the current period in SQL (`json_each` with a date filter) saves
bytes but not rows, and spreads the period rules across SQL and TypeScript.

## R3. The pure step: `rideFigures`

**Decision**: `src/rynke/ride-figures.ts`, pure, holds:

- `periodOf(period, today, window)`: the first and last date of the season, current month or current
  Monday-to-Sunday week (`weekEndOf`), cut to the counting window.
- `figuresOf(entries, range)`: sessions, distance in metres, elevation in dm, and the typical ride.
- `typicalRide(lengths)`: the median, the mean of the two middle values for an even count, null with none.
- `rideRows(riders, viewerId, by, range)`: places and the viewer, shaped like `leaderboardRows`.
- `teamRideTotals(riders, range)` and `teamWeeksKm(riders, ends)` for the team line, card and chart.

The ranking compares the **shown** value: km as `round(m / 100)` (one decimal), elevation as `round(dm / 10)`
(whole metres), sessions as is (FR-005). Ties share a place, with standard competition ranking (1, 2, 2, 4).
Among equals the order is the picked figure, then sessions, km and elevation, then athlete ID. Athlete ID
only orders rows and never leaves the function (016 FR-010). The gap to the next place is in shown units, plus
one unit, as `toNext` is today.

**Rationale**: it keeps every figure and period unit-testable against hand counts (SC-001). It lives next to
`leaderboard.ts`, whose `neighbourhood` it reuses unchanged.

**Dates**: ride entries carry the local start date, as for Rynke (FR-003). "Today" is the Berlin date, as
everywhere else on `/team`.

## R4. Consent: who is in the figures others see

**Decision**: two new `RiderData` items in `src/visibility.ts`, both `SINCE_VERSION` 3:

- `rideFigures`, `TEAM`: sessions, km and elevation per period in an anonymous ranking row, the team line
  and the team chart.
- `rideFiguresByName`, `ORGANISER_ONLY`: sessions and typical ride in the riders table, and sessions per day
  in the graph.

Every read that feeds them filters inside SQL with `sharedRiderExists("r", SINCE_VERSION.<item>)`, so a rider
below version 3 is in no row, total, median or bar (FR-020, SC-004). The Rynke leaderboard keeps its own
`listedRiderFilter`, so the Rynke and the ride rankings may count different riders. That is intended.

**Why version 3**: the current major version. A rider on version 1 or 2 doesn't have a current consent. They
meet the consent gate and can't open `/team`, so "they still see their own figures" (FR-020) only matters
once they renew, and then they're in the ranking.

**Why two items**: FR-019 lists anonymous ranking figures for the team and named figures for organisers.
Feature 004's table keys each item to one audience set, so two rows keep it testable.

## R5. Minor consent revisions (constitution 2.4.0)

**Decision**:

- `ConsentVersion` gains `revisions: readonly ConsentRevision[]`, where `ConsentRevision` is
  `{ revision, published, changes }`, numbered from 1. Version 3 gains revision 1, published on the
  release day, with `changes: ["consent.rideFigures"]`.
- `currentRevision(versions)` returns `{ version, revision }`. The label is `"3.1"`, or `"3"` with no
  revision.
- `consentState` still compares major versions only. A rider on 3 (revision 0) is `current` and is not
  asked again (FR-021, US3 scenario 3).
- A rider renewing from version 2 sees the changes of version 3 and of all its revisions, so the gate's
  "what changed" list names the ride figures too.
- Migration `0026` adds `consent_records.revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0)`. New
  acceptances record the current revision, so the record says which revision a rider accepted (Principle
  I). Earlier ones read as revision 0. The primary key stays `(athlete_id, version)`: one record per major
  version, and `INSERT OR IGNORE` keeps the first.
- The form's `consent` value stays the major version (`"3"`), so a page loaded just before the release
  still works. The server records the revision.
- Settings shows the accepted label ("Version 3.1 accepted on …").

**Rationale**: this follows the amended Principle I with the least change. The rest of the code keeps
whole-number versions, and the previously deployed code keeps working after the migration: it never names
the new column, and its inserts get the default (CLAUDE.md "migration must keep the previous version
working").

**Alternatives considered**:

- Storing `3.1` as a real number: it breaks the integer `CHECK`, `Math.trunc` in the consent SQL and every
  `>=` comparison by meaning.
- A separate revisions table: more joins for nothing that a column can't hold.
- No record of the revision: Principle I requires knowing which version was accepted.

## R6. The switches

**Decision**: two settings in `wrangler.jsonc`, typed in `src/config.ts` like `TRAINING_LEADERBOARD`:

- `RIDE_FIGURES`: `"on"` or `"off"`. On in the founding team's settings and in fake mode (FR-018).
- `RYNKE_VIEWS`: `"on"` or `"off"`. Off gives `/team` the single view of FR-012: no kind switch, no Rynke
  cards, no peloton and no quote. "Rank by" offers no Rynke and defaults to kilometres. It is on for the
  founding team.

A wrong value throws, as for the other settings. When feature 026 builds team data, both move into it
unchanged (FR-017). No code branches on a team's name.

**Why `RYNKE_VIEWS` now**: US4 scenario 3 and FR-012 need a team without Rynke views, and no such setting
exists yet. It only covers the Team section. Whatever else Rynke means for the second team stays with feature
026.

**Quote with `RYNKE_VIEWS` off**: the quotes are picked by Rynke pace (`riderStatus`), which means nothing
without Rynke. No quote is shown. This feature adds no quote of its own (FR-013).

## R7. The Team section's URL and controls

**Decision**: `/team?by=sessions|km|elevation&period=season|month|week&all=1`, next to the existing
`kind=team`.

- Anything else is the default: Rynke (or km without Rynke views) and the season. Nothing answers 400.
- `by` and `period` are kept only on the Training view. The Team Rynke view ignores them.
- "Rank by" and the period choice are segmented links with `data-swap`, like the kind and scope switches
  today, so the page swaps in place at the same scroll position (issue #113). No new client code is needed.
- Every link keeps the other parameters (016 R5). This takes at most two taps from the Training view
  (SC-002).

**Remembering on the device** (FR-007's MAY): left out. The default is one tap away, and the links keep the
choice while browsing the section.

## R8. The organiser area

**Decision**:

- **Riders table**: a "Sessions" column before Distance, in the full table only (`ORGANISER_FIGURES`
  "full"). The percent table has no Distance column to sit beside. It shows the season count with the
  typical ride in small type beneath. A rider without version 3 shows "–", like other figures that can't
  be shown.
- **Progress section**: `GraphDay` gains a fifth value, the sessions on that day, and `teamSum` gains
  `sessions`. `organiserGraphsStatement` selects `s.rides` from version 3 rows. `public/app.js` adds
  `"sessions"` to `GRAPH_METRICS` with whole-number ticks. Range, Running total, Per day, the legend and the
  screen-reader table come from the shared code (FR-015).
- With `RIDE_FIGURES` off, nothing of it is read or rendered (US4 scenario 1).

## R9. Fake mode and tests

**Decision**: the synthetic samples get a few short trips (about 5 to 8 km) and one rider with many of them,
so the typical ride shows a difference. Riders held back below version 3 stay, from feature 029 R11. A test
config with `RYNKE_VIEWS` off covers FR-012. Slices start with failing tests (Principle V):

- Unit tests for `ride-figures.ts`: hand counts, ties, medians, periods and shown-value rounding.
- Unit tests for `summaryOf`'s new column, `consentState` with revisions, and visibility.
- Integration tests for `/team` with each `by` and `period`, the consent filter, the off switches, round trips
  and rows, the organiser column and graph data, the consent record's revision, and Settings.
- e2e tests for picking a figure and a period on a phone, and for the fourth graph.
