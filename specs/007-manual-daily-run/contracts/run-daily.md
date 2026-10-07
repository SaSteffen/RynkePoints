# Contract: Manual Daily Run

Adds to feature 001's
[http-routes.md](../../001-strava-connect-webhook/contracts/http-routes.md).

## `POST /admin/run-daily`

- **Request**: header `Authorization: Bearer <ADMIN_TOKEN>`. No body is read, and
  query parameters are ignored.
- **Token matches and `ADMIN_TOKEN` is non-empty**:
  - The app starts the same steps as the daily cron, in the background (research
    R2).
  - It answers `202 text/plain; charset=utf-8` with body `started`.
  - The response doesn't wait for the run.
- **Anything else** (header missing or not `Bearer`, wrong token, `ADMIN_TOKEN`
  unset or empty):
  - The answer is the same as for an unknown address: the catalog 404 page, in
    the resolved language.
  - Nothing is started, queued or written.
- **Other methods on `/admin/run-daily`**: the same 404, whatever the token.
- **Comparison**: SHA-256 of both values, then `timingSafeEqual` (research R3).

## `scripts/run-daily.sh` (`pnpm daily:run`)

| Input | Meaning | Default |
|-------|---------|---------|
| `ADMIN_TOKEN` (env) | the run token | required |
| `RYNKE_URL` (env) | base URL without a trailing slash | `https://trhh-rynke-coins.link` |

| Outcome | Output | Exit |
|---------|--------|------|
| `ADMIN_TOKEN` unset or empty | `error: ADMIN_TOKEN is not set` on stderr, nothing sent | 1 |
| `202` | `daily run started on <RYNKE_URL>` | 0 |
| any other status, timeout or connection error | curl's error (e.g. `returned error: 404`); the body, an HTML page, is dropped | non-zero |
