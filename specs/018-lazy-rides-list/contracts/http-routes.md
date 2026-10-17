# Contract: HTTP Routes

**Feature**: [../spec.md](../spec.md) | **Research**: R1–R3, R9

One new route. `GET /me/rides`, `GET /me/rides?page=N` and `GET /me?page=N`
keep their contracts (feature 005 contracts/http-routes.md, feature 011
FR-006); only the Rides markup changes ([pages.md](pages.md)).

## `GET /me/rides/more?after=<key>[&limit=<n>]` (new)

The signed-in rider's rides after `key` in the list's order, as a fragment.

| Case | Status | Body |
|---|---|---|
| No valid session, or the session's rider is gone | `401` | empty |
| Rider hasn't agreed to the current consent version, or has no current consent | `403` | empty |
| Rider has no balance yet (waiting state) | `409` | empty |
| `after` missing or not a ride key; `limit` not 1–1000 | `400` | empty |
| Otherwise | `200` | the fragment below |

- `after`: `<startDate>~<activityId>` ([../data-model.md](../data-model.md)).
  A key of a ride that no longer exists is fine: the read continues from where
  it would have sorted.
- `limit`: `^[1-9][0-9]{0,3}$` and at most 1000; default 20. Several `after` or
  `limit` parameters are a bad request.
- `200` body:

  ```html
  <ol class="ride-list" data-more="/me/rides/more?after=…">
  <li class="ride-card …">…</li>
  …</ol>
  ```

  The cards are exactly those of the page (contracts of feature 011). `data-more`
  is left out when no older ride follows. No rides after the key: an empty
  `<ol class="ride-list"></ol>`.
- Headers: `Content-Type: text/html; charset=utf-8`, `Content-Language`,
  `Vary: Accept-Language, Cookie`, `Cache-Control: no-store`.
- Only the rider's own rides; another rider's key returns the rider's own rides
  after that position, never the other rider's.
- D1 reads only, no Strava request and no outbound `fetch` (FR-011).
- `HEAD` works like `GET`. The session is renewed like any other page.
