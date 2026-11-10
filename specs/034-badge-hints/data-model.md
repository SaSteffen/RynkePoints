# Data Model: Badge Hints from the Monkey

Nothing is stored on the server. Everything below is worked out per request, except the browser
record.

## HintInput (server, per request)

What `hintCandidates` reads; all of it comes from the badges page's existing batch (research R2).

| Field | From | Note |
| --- | --- | --- |
| `today` | `berlinDate(ctx.now())` | `YYYY-MM-DD` |
| `seasonStart`, `seasonEnd` | `countingWindow(env)` | before `badgeWindow` clamps the end |
| `earned` | `rider_badges` | badge ids |
| `progress` | `personalProgress(...)` | value and next step per category |
| `days` | `rider_summaries.days` | `[date, distanceM, distanceRynke, elevationDm]` |
| `runDays` | `rider_summaries.run_days` | `[date, distanceM]` |
| `virtualDays` | `rider_summaries.virtual_days` | `[date, virtualM]` |
| `ownDays` | `rider_summaries.own_days` | `[date, longestM, outdoor]` |
| `active` | `rider_summaries.active` | `[date, hour, ride]`, rides, runs and swims |
| `longestSwimM` | `swims` | season |
| `ranBefore`, `swamBefore` | `runs`, `swims` | any in the previous season (FR-007) |

Day lists are filtered to `seasonStart`..`today`.

## HintCandidate (server)

| Field | Type | Note |
| --- | --- | --- |
| `key` | string | `next:<category>` or `surprise:<rule>`; stable, for the no-repeat rule |
| `kind` | `"next" \| "surprise"` | |
| `category` | `BadgeCategoryId` | the card it links to; `surprise` for surprise hints |
| `rule` | surprise rule name | surprise hints only (`new-year` … `winter-sleep`) |
| `line` | line id | which phrase, e.g. `winterSeveral`, `solsticeJune` |
| `values` | `{ n?, best?, next?, left?, month? }` | numbers for the placeholders, unformatted |
| `windowEnd` | `YYYY-MM-DD` | for the order (FR-011) |
| `closeness` | number 0..1 | missing ÷ next step; 1 for surprises |
| `monkey` | hint monkey id | from the FR-016 table |

Rules (spec FR-004 to FR-010, table "Hint windows"):

- Only the next step of a category, only if not earned, never team badges, never Team events,
  Technique or Tour de Paris.
- The candidate's window contains `today`, and the window lies inside the season.
- Amounts: `missing ≤ daysLeft × bestDay`, and `bestDay > 0`.
- Day counts: `missing ≤ daysLeft`, today left only if not yet counted.
- Length categories: `longest ≥ next ÷ 2`.
- Running, swimming, run and swim length, Dreikampf: `ranBefore`/`swamBefore` or any in the
  season.
- Rest day: a streak of at least 5 days in `active` ending today or yesterday; `values.n` is its
  length.

Order: `windowEnd`, then `closeness`, then `key`.

## Hint kind → monkey

| Monkey | Keys |
| --- | --- |
| `hint-down` | `next:distance`, `next:elevation`, `next:training_rynke`, `next:running`, `next:swimming`, `next:virtual_rides` |
| `hint-calendar` | `next:winter_*` |
| `hint-tape` | `next:ride_length`, `next:run_length`, `next:swim_length` |
| `hint-psst` | `surprise:christmas-eve`, `surprise:christmas`, `surprise:new-year`, `surprise:easter`, `surprise:pi-day` |
| `hint-binoculars` | `surprise:night-owl`, `surprise:early-bird`, `surprise:solstice`, `surprise:winter-sleep` |
| `hint-magnifier` | `surprise:stage-rider`, `surprise:triathlon`, `surprise:rest-day`, `surprise:everesting`, `surprise:festive-500` |

## Browser record (`localStorage`, key `rp-badge-hint`)

`{"date":"YYYY-MM-DD","key":"next:distance"}`: the day of the last visit to the badges page and
the last hint shown (or the one before, on a visit without one). Unreadable or missing: treated as
a first visit with no last hint. Never sent to the server.
