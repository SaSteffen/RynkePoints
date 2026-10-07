# Research: Run the Daily Job on Demand

## R1. How to start the run

- **Decision**: an authenticated `POST` route on the Worker that calls the
  existing `handleScheduled`.
- **Rationale**: Cloudflare can't run a deployed Worker's cron on demand. The
  dashboard and the API only show or edit the schedule. A route reuses the exact
  steps the cron runs (FR-001), with no second copy of them.
- **Alternatives considered**:
  - Temporarily setting the cron to `* * * * *`: slow, easy to forget to revert,
    and reset by the next deploy.
  - `wrangler dev --test-scheduled`: only runs locally.
  - A new queue message kind (`daily-run`) that the consumer handles: queue
    retries would buy little, since the steps already queue their own retried
    work. It needs a new message contract and validation, and the run would wait
    behind other work at `max_concurrency: 1`.

## R2. Running in the background

- **Decision**: add `waitUntil(promise)` to `Ctx`. `src/index.ts` builds the
  `Ctx` with the entry point's `ExecutionContext` (`fetch`, `queue` and
  `scheduled` all receive one). The route passes `handleScheduled(controller,
  ctx)` to it and answers `202` right away (FR-003). The test `makeCtx` collects
  the promises so tests can await them.
- **Rationale**: this is the platform's way to keep working after the response.
  Putting it on `Ctx` keeps the router signature unchanged and makes it fakeable
  like `queue` and `now`.
- **Limit**: work passed to `waitUntil` from `fetch` gets about 30 s after the
  response. The run's steps are D1 reads and queue sends for a few riders, and
  the Strava calls happen later in the queue consumer, so it fits easily. If the
  team grows to the point where it doesn't, R1's queue alternative is the way
  out.
- **Errors**: `handleScheduled` already runs every step and throws the first
  failure, so a failing step shows up in the Worker logs as an uncaught
  `waitUntil` rejection, much like a failing cron run. The response has already
  gone out, so the script only reports "started" (spec edge case).
- **Controller**: `handleScheduled` ignores its controller argument. The route
  passes `{ cron: "manual", scheduledTime: Date.now(), noRetry() {} }`, so there
  is no need to change the signature.

## R3. Token check and hiding the route

- **Decision**: only `POST /admin/run-daily` with header `Authorization: Bearer
  <token>` starts a run, and only when the token equals `env.ADMIN_TOKEN`. The
  comparison hashes both sides with SHA-256 and uses `timingSafeEqual`, the same
  way `webhook.ts` does. That helper moves to `src/crypto/` so both routes can use
  it. Every other case answers with the router's existing `notFound(i18n, path)`
  page: a missing or malformed header, a wrong token, an empty or unset
  `ADMIN_TOKEN`, or any other method. That makes the answer identical to an
  unknown address (FR-002, US2).
- **Rationale**: a header keeps the token out of URLs and access logs, unlike the
  webhook, where Strava dictates a path secret. An empty configured token would
  otherwise match an empty bearer token, so it counts as "not configured".
- **Alternatives considered**: a token in the path, as the webhook does. It ends
  up in logs and browser history, and nothing forces it here. Cloudflare Access
  in front of the route: more setup than one volunteer-maintained route deserves.

## R4. The secret

- **Decision**: `ADMIN_TOKEN`. It goes in `secrets.required` in `wrangler.jsonc`,
  then `pnpm types`. The test value goes in the `vitest.config.ts` bindings, and
  `.dev.vars.example` gets an `openssl rand -base64 32` hint.
- **Rollout**: the maintainer runs `pnpm wrangler secret put ADMIN_TOKEN` before
  the release that contains this feature is merged into `main` (quickstart). If
  the secret is missing, the route still just answers 404 (R3). Listing a secret
  as required may also make the deploy refuse to go ahead, and putting it first
  avoids finding that out in CI.

## R5. The script

- **Decision**: `scripts/run-daily.sh`, in bash with `set -euo pipefail`, in the
  same style as `docs-pdf.sh`, also run by `pnpm daily:run`:
  - It fails with `error: ADMIN_TOKEN is not set` and sends nothing when the
    token is missing.
  - The base URL is `RYNKE_URL`, with `https://trhh-rynke-coins.link` as the
    default.
  - It sends the `Authorization` header through `curl -H @-` from stdin, so the
    token never appears in the process list.
  - With `--fail-with-body` and `--max-time`, a non-2xx answer or a timeout exits
    non-zero with curl's error. The body, an HTML page, is dropped. On `202` it prints `daily run started on
    <url>`.
- **Rationale**: curl is already assumed by the quickstarts, and a Node script
  would add nothing.
- **Tests**: none, like `docs-pdf.sh`. This is manual tooling, and the route
  behind it is tested.
