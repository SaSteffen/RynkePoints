# Contract: HTTP routes changed by this feature

This contract adds to feature 001's
[http-routes.md](../../001-strava-connect-webhook/contracts/http-routes.md).
Everything it says about rider-facing pages (language resolution, `Vary`,
`Content-Language`, session cookie, `HEAD`) still applies. No route is added.

## `GET /me` and `GET /me?page=N`

- **Not signed in**: `302 /`, unchanged. The landing page asks the visitor to
  sign in with Strava (FR-002).
- **Signed in**: `200 text/html`, the rider page with the sections of
  [rider-page.md](rider-page.md), for the signed-in rider only (FR-002, SC-007).
- **`page`** (US5):
  - An optional query parameter. A value matching `^[1-9][0-9]{0,3}$` is
    the requested table page. Anything else, including a missing value, `0`, a
    negative number or several `page` parameters, counts as page 1. None of
    these is an error.
  - A page past the last one shows the last page. The URL is not rewritten
    (research R2).
  - Other query parameters are ignored.
  - Before US5 is delivered, the parameter is ignored and page 1 is shown.
- **Side effects**: none. The handler sends only `SELECT` statements, in one
  batch, plus feature 001's existing reads. It sends no queue message, makes no
  Strava request, and sets no cookie except those feature 001 already sets
  (FR-003, SC-004).
- **Layout `path`**: `/me` on page 1, otherwise `/me?page=N` with the page shown.
  The language switcher sends it back as `next`.
- **Fragment**: pager links point to `/me?page=N#rides`. The fragment never
  reaches the server.

## `POST /lang` (changed)

- `safeNext` additionally accepts `/me?page=N` with N matching
  `^[1-9][0-9]{0,3}$`, unchanged, so the rider stays on the same table page
  (FR-046, US5 scenario 4).
- Everything else is unchanged. Any other query string, or `/me?page=` with
  anything else, becomes `/`, as today for unknown paths.
