# Data Model: Lazy-Loading Rides List

**Feature**: [spec.md](spec.md) | **Research**: R1, R5

No table, column or migration changes. The feature adds views of what Rides
already reads.

## Ride key (R1)

The position of a ride in the list's order.

| Field | Type | From |
|---|---|---|
| `startDate` | ISO UTC, `YYYY-MM-DDTHH:MM:SSZ` (optional `.sss`) | `activities.start_date` |
| `activityId` | positive integer | `activities.strava_activity_id` |

- Written in a query string as `<startDate>~<activityId>`, e.g.
  `2026-09-16T08:00:00Z~8000021`.
- Parsing accepts exactly that shape; anything else is a bad request.
- "After" means later in the list: `start_date < startDate`, or the same
  `start_date` and a smaller id.

## RideRow (changed)

Gains `startDate` (UTC), read with the other columns, so the last row of a page
or batch gives the key of what follows.

## RideTable (changed)

Gains `more: RideKey | null`: the key of the last row when older rides follow
it, otherwise `null` (always `null` without a pager).

## Ride batch (new, read only)

| Field | Meaning |
|---|---|
| `rides` | up to `limit` `RideRow`s after the key, newest first |
| `more` | the key of the last of them when older rides follow, else `null` |

`limit` is 20 by default and at most 1000 (restoring a place, R5).

## List position (browser only, R5)

`sessionStorage["rp-rides-place"]`, JSON, one per tab:

| Field | Meaning |
|---|---|
| `url` | `location.pathname + location.search` when it was kept |
| `loaded` | number of ride cards in the list |
| `anchor` | activity id of the first card in view |
| `offset` | that card's distance from the viewport top, px |
| `y` | `scrollY`, used when the anchor card is gone |

Written on `pagehide`, read once on a `reload` or `back_forward` load of the
same URL, never sent to the server.
