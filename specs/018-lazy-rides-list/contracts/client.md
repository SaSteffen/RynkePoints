# Contract: Page Script

**Feature**: [../spec.md](../spec.md) | **Research**: R4–R6, R8

`lazyRides()` in `public/app.js`. It holds no text; every word comes from the
markup of [pages.md](pages.md).

## Start

- Runs only for `section#rides[data-lazy]`.
- Sets `history.scrollRestoration = "manual"`.
- Shows `div.rides-more` while the list has `data-more`.

## Loading (FR-002–FR-009)

- Observes `div.rides-more` with `rootMargin: "0px 0px 100% 0px"`; on
  intersection, and with no request running, GETs the list's `data-more`
  (`credentials: "same-origin"`, `cache: "no-store"`).
- While it runs: `div.rides-more[data-state=loading]`, status text
  `data-loading`, the list `aria-busy="true"`.
- `200`: appends the fragment's `li.ride-card`s, takes its `data-more` (or
  removes the list's), sets `data-state=added` and the status text to
  `data-added`, then observes `div.rides-more` afresh. Without `data-more` the
  block hides and observing stops.
- `401`, `403`, `409`: starts the progress bar and reloads.
- Any other status or a network error: `data-state=failed`, status text
  `data-failed`, the retry button shows. Retry by the button, on `online`, or
  on the next intersection.

## Keeping the place (FR-013)

- `pagehide`: writes `rp-rides-place` ([../data-model.md](../data-model.md)).
- On start, for a `reload` or `back_forward` load of the same URL with more
  cards kept than shown: one GET of `data-more` with `&limit=<missing>`, then
  the anchor card (found by its `a.strava-activity` link) is scrolled to its
  offset; without it, `scrollY` is restored. The entry is read once.
