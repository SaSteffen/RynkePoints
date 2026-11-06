# Contract: Pages

The look follows the design draft "RynkePoints Ride Stats"
(https://claude.ai/artifact/1FzcR5Qd9UfTdxmX9wCsXW). Read it before building any markup (FR-023). Every word
comes from the catalogs ([messages.md](messages.md)). No element on `/team` carries a name, athlete ID,
profile link or picture of another rider (FR-019).

## `/team`, Training view

### Query

| Parameter | Values | Default | Notes |
| --- | --- | --- | --- |
| `kind` | `team` | Training | unchanged (016) |
| `by` | `sessions`, `km`, `elevation` | Rynke; `km` with `RYNKE_VIEWS` off | Training view only |
| `period` | `month`, `week` | `season` | only with a ride figure |
| `all` | `1` | the viewer's neighbourhood | unchanged |

Unknown values fall back to the default. Every link keeps the other parameters. Links to the default leave
their parameter out, so `/team` stays `/team`.

### Rynke picked (the default)

The page is today's page plus the "Rank by" control above the leaderboard (SC-003). The
control's Rynke segment is `aria-current`. No period control is shown and no ride figures are read.

### A ride figure picked

- The team total, kind switch, place card position, peloton and team chart above the leaderboard stay as
  they are with Rynke (the draft's "new rider ranking" row). Only the place card and the leaderboard follow
  the pick.
- **"Rank by"**: `nav.rank-by` with four `a.segmented[data-swap]` links (Rynke, Sessions, km, Elevation).
  The current one has `aria-current="true"`.
- **Period**: `nav.rank-period` with Season, Month and Week, the same way. It is shown only with a ride
  figure.
- **Team line**: `p.ride-team-line`, above the rows. It gives the team's sessions, km, elevation and typical
  ride for the period, over every ranked rider (FR-011). With no ride in the period it says nobody has ridden
  yet.
- **Place card**: the place out of the ranked riders, the picked figure and period, and the gap to the next
  place in its unit (or the lead line). Below that, "Typical ride: X km" with the one-line explanation
  (FR-010). There is no typical ride with no ride in the period.
- **Rows**: `li.row` as today, with the medal or place, "You" on the own row, the picked figure emphasised
  with a bar against the leader (`.ride-bar`, its width as a share of the leader's shown value), and the
  other two figures small. There is no sparkline and no typical ride in any row (FR-009).
- **Scope**: the neighbourhood toggle and the "riders ahead/behind" lines as today.
- **Count**: the riders ranked in the ride figures (consent version 3 or higher), which may differ from the
  Rynke count.

### `RYNKE_VIEWS` off

There is one view and no kind switch (FR-012), in this order:

- Team card: season km, sessions and elevation, and this week's km gain.
- A chart of the team's km per week, with the running total, from the existing `weekBars`.
- The place card.
- The ranking. "Rank by" offers Sessions, km and Elevation only; with `by` absent it picks km.

There is no quote, peloton or coin.

### `RIDE_FIGURES` off

There is no "Rank by" and no period control. Any `by` and `period` are ignored. The page is today's page
(US4 scenario 1).

## `/organiser/riders`

- **Full table** (`ORGANISER_FIGURES` "full"): a `th` "Sessions" column before Distance. Each cell holds
  `<span>12</span><small class="typical">typical 38.4 km</small>`, with the season count and
  the season's typical ride.
  - A rider with no ride shows 0 and no typical ride.
  - A rider below consent version 3 shows "–" and is counted in no figure.
  - The phone's one-line rows add the count after the distance.
- **Progress section**: a fourth tab and graph, "Sessions", after Elevation. The same range presets, Running
  total and Per day, rider picker, team lines, legend and screen-reader table as the other three. The y axis
  uses whole numbers. Its data is the fifth `GraphDay` value and `teamSum.sessions` (data-model.md).
- With `RIDE_FIGURES` off, there is no column and no tab, and `rides` isn't selected.

## `/settings` (Settings section)

"Agreed on {date} (version {version})" shows `3.1` for a revision-1 record and `3` for revision 0.

## Consent gate, start page and `/privacy`

- The consent summary gains the `consent.rideFigures` paragraph in its details and the revised
  `consent.short.shown`.
- A rider renewing from version 2 sees `consent.rideFigures` among the changes.
- `/privacy` gains `privacy.team.rideFigures` (FR-022).
