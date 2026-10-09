# Contract: HTTP Routes

**Feature**: [../spec.md](../spec.md) | **Research**: R5

One new route. Every other route keeps its contract. Overview, Rides and
Settings change their markup only ([pages.md](pages.md)).

## `GET /me/ready` (new)

Whether the signed-in rider's first data is there, for the waiting state's
poll (FR-004, FR-006).

| Case | Status | Body |
|---|---|---|
| No valid session, or the session's rider is gone | `401` | empty |
| Rider has no balance yet | `200` | `{"ready":false}` |
| Rider has a balance | `200` | `{"ready":true}` |

- Headers: `Content-Type: application/json`, `Cache-Control: no-store`.
- `HEAD` works like `GET`, without a body.
- One D1 read and no Strava request, with no outbound `fetch` at all.
- It answers before the page dispatcher, so it doesn't renew the session
  cookie, like `/me/notification-text`.
- No consent check: it only tells the rider whether their own balance exists.

## Unchanged, asserted again

- `GET /auth/callback` for a new rider sends `import-page` page 1 with the
  season start as `after` to `WORK_QUEUE` before redirecting (FR-005, R6).
