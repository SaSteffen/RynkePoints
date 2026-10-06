# Research: Strava Connection and Webhook Activity Intake

**Feature**: [spec.md](spec.md) | **Date**: 2026-10-06

Sources checked on 2026-10-06: Strava developer docs (authentication, webhooks),
Cloudflare docs (Queues pricing and retries, D1 data location), and the installed
`@cloudflare/vitest-pool-workers` 0.22.0 type definitions.

## R1. Strava OAuth scopes and the rider's choice of private activities (FR-003, FR-005)

- **Decision**: Send riders to `https://www.strava.com/oauth/authorize` with
  `scope=read,activity:read,activity:read_all`, `response_type=code`,
  `approval_prompt=force` and a CSRF `state`. Read the accepted scopes from the
  callback's `scope` parameter (and the token response's `scope`). `activity:read`
  missing → not connected, keep nothing. `activity:read_all` missing → connected
  with "shared activities only". `read` missing → treat like a refusal, because the
  club check (R4) needs it.
- **Rationale**: Strava's docs say "the user may opt out of any requested scopes",
  so asking for `activity:read_all` and letting the rider untick it is exactly the
  "rider chooses" answer from the clarification. `approval_prompt=force` makes sure
  a reconnecting rider actually sees the screen again and can change their choice
  (FR-007); with `auto` Strava skips it for riders who already approved.
- **Alternatives considered**: Two separate "connect" buttons (basic / incl.
  private) — more UI and still relies on the rider not unticking; rejected.
  Requesting only `activity:read` — contradicts the clarification.

## R2. Token exchange, refresh, revoke

- **Decision**:
  - Exchange the code at `POST https://www.strava.com/oauth/token`
    (`grant_type=authorization_code`). The response includes `athlete` (we keep
    `id` and `firstname` only), `access_token`, `refresh_token`, `expires_at`,
    `scope`.
  - Refresh with `grant_type=refresh_token` when the access token expires within
    the next 5 minutes. Always persist the returned refresh token: Strava rotates
    it and invalidates the old one immediately. Refresh answered with 400/401 →
    rider becomes `needs_reconnect`, their pending work is dropped (FR-020).
  - Revoke with the new `POST https://www.strava.com/oauth/revoke` (HTTP Basic auth
    `client_id:client_secret`, form field `token`). It becomes the only endpoint on
    2027-06-01, so we don't build on the legacy `/oauth/deauthorize`. 503 is
    retryable; 200 means done (even if the token was unknown).
- **Rationale**: Straight from Strava's authentication docs. Access tokens live
  6 hours, so most calls need a refresh first. That costs one request and is
  accounted for in R6.
- **Alternatives considered**: Legacy `/oauth/deauthorize` — deprecated; rejected.

## R3. Webhook subscription, validation and authenticity (FR-010–FR-012)

- **Decision**:
  - One app-wide subscription, created manually by the maintainer (see
    quickstart). The callback URL is `https://<host>/strava/webhook/<secret>`, where
    `<secret>` is the `STRAVA_WEBHOOK_VERIFY_TOKEN` secret.
  - `GET` on that path answers the validation handshake: check
    `hub.mode=subscribe` and `hub.verify_token`, then reply
    `{"hub.challenge": "<challenge>"}` as JSON.
  - `POST` on that path checks a 1,000-byte body limit, JSON shape, and
    `subscription_id === STRAVA_SUBSCRIPTION_ID`. Valid events are enqueued and
    answered `200` with nothing else done. A wrong path secret gives 404, an
    invalid shape 400, and a valid but foreign subscription 200 with the event
    dropped. Unknown athletes are dropped by the consumer.
- **Rationale**: Strava does not sign events. The only verification it documents
  is the `verify_token` echo at subscription time. An unguessable callback path
  plus the subscription ID is the strongest cheap check available.
  Activity events can't inject data, because we always fetch the activity from
  Strava with the rider's own token. Deauthorization events are acted on without
  checking back: a forged one could at most delete a rider's data, which they get
  back by reconnecting (the import restores it). Ignoring a real one would breach
  Principle I. So we err towards privacy.
- **Alternatives considered**: Verifying every deauthorization by probing the
  token. It has a race with Strava's own token invalidation and adds a request;
  rejected. A separate path secret alongside the verify token. That's one more
  secret to manage for no real gain, since both are only known to us and Strava;
  rejected.
- **Facts used**: events must be answered within 2 s, otherwise Strava retries up to
  3 attempts in total. Payload fields: `object_type` (`activity`|`athlete`),
  `object_id`, `aspect_type` (`create`|`update`|`delete`), `updates` (`title`,
  `type`, `private`, or `authorized: "false"`), `owner_id`, `subscription_id`,
  `event_time`. A single save can produce several events, and type updates can
  arrive later. With only `activity:read`, an activity switched to "Only You"
  arrives as `delete`, and one switched back arrives as `create`.

## R4. Club membership gate (FR-004, FR-004a)

- **Decision**: Check membership with `GET /api/v3/athlete/clubs` using the rider's
  own token. Page with `per_page=200` until the configured `STRAVA_CLUB_ID`
  (`2372209`) is found or a page comes back short. This happens:
  - at connect time, inline in the OAuth callback;
  - daily, from the cron trigger, which enqueues one `check-membership` message per
    connected rider.

  A definitive "not a member" leads to revoke plus full deletion. Network errors,
  5xx, 429, or an exhausted rate budget count as inconclusive: retry later and never
  disconnect on those.
- **Rationale**: Strava has no club→application link and no club-membership
  webhook. The rider's own club list is the only reliable source. The club-members
  endpoint returns names, not athlete IDs. It is also a call the rider consented to
  through `read`. Cost is about 1–2 requests per rider per day (≤20 at 10 riders),
  well within the budget in R6.
- **Constitution note**: this is a scheduled lookup at Strava, not activity polling.
  It is listed in the plan's Complexity Tracking for transparency.
- **Alternatives considered**: Checking membership on every activity event. Costs
  more requests and misses riders who stop riding; rejected.
  `GET /clubs/{id}/members`. Returns no athlete IDs, so it can't be matched;
  rejected.

## R5. Activity intake: which calls, which fields, which sports (FR-013–FR-017)

- **Decision**:
  - `create` → `GET /api/v3/activities/{id}`.
  - `update` with `type` or `private` in `updates` → refetch.
  - `update` with only `title` → no call. We store no title.
  - `delete` → delete the row, no call.
  - Refetch answered 404 (or 403) → treat as deletion or inaccessible (removes the
    row).
  - Stored fields: `id`, `sport_type`, `start_date` (UTC), `start_date_local`,
    `timezone`, `distance`, `moving_time`, `total_elevation_gain`, `private`.
    Everything else in the response is dropped before it touches storage.
  - Cycling sport types are `Ride`, `MountainBikeRide`, `GravelRide`, `EBikeRide`,
    `EMountainBikeRide` and `VirtualRide`, kept as one constant. A row whose
    `sport_type` leaves that set is deleted.
  - Writes are `INSERT … ON CONFLICT(strava_activity_id) DO UPDATE`. Every handler
    converges to Strava's current state, so duplicates and reordering are harmless
    (FR-017, SC-004).
- **Rationale**: Event `updates` tell us which change happened. Skipping title-only
  updates saves read budget. Always refetching (rather than applying `updates`
  locally) is what makes out-of-order delivery safe. The `private` flag is the
  smallest extra field needed to honour FR-007 when a rider narrows their scope.
- **Alternatives considered**: Storing `updates` deltas. Order-dependent;
  rejected. Dropping `private` and handling scope narrowing by deleting all the
  rider's activities and re-importing. Saves one field, but later team-visible
  features would need the flag anyway to keep "Only You" rides private; rejected
  (confirmed with the project owner, 2026-10-06). Including `Velomobile` and `Handcycle`. Unlikely for the team, and
  trivial to add to the constant later; deferred.

## R6. Rate-limit budget and backoff (FR-018, FR-019)

- **Decision**:
  - After every Strava API response, store `X-ReadRateLimit-Usage` and
    `X-RateLimit-Usage` (format `"<15min>,<daily>"`) with the response time in a
    single-row D1 table.
  - Before a call, if the stored usage in the current 15-minute window (aligned to
    :00/:15/:30/:45) or the current UTC day is within a safety margin of the limit
    (10 for 15-min, 50 for daily), don't call. Instead retry the message with
    `delaySeconds` until the next window or the next UTC midnight.
  - `429` → same deferral.
  - Other transient failures (5xx, network) → `retry({ delaySeconds:
    min(30 * 2^attempts, 3600) })`.
  - Run the queue consumer with `max_concurrency: 1`, so the stored budget can't be
    overspent by parallel consumers.
- **Rationale**: Strava limits apply per app, so the budget is global and the
  serial consumer makes a simple shared counter correct. Expected load: 10 riders
  × a few activities a day, plus 10 membership checks, plus token refreshes. That
  is under 100 requests a day against a read limit of 1,000.
- **Alternatives considered**: A Durable Object as the rate-limit coordinator.
  Correct under concurrency, but an extra component the load doesn't need;
  rejected for now.

## R7. Durable retries beyond queue retention (SC-005)

- **Decision**: The queue's own retries are capped (`max_retries: 10`). When a
  message reaches its last attempt with a transient error, the consumer writes it
  to a D1 table `failed_work` (rider ID plus the message body, which holds only
  identifiers) and acks it. The daily cron re-enqueues `failed_work` rows younger
  than 7 days and deletes them. Organisers read the table with `wrangler d1
  execute` to "see" failures (FR-019). Rows cascade-delete with the rider.
- **Rationale**: Queues on the Workers Free plan keep messages only 24 hours, and
  a dead-letter queue has the same retention. A Strava outage longer than that
  would otherwise lose activities.
- **Alternatives considered**: A dead-letter queue. Same 24-hour retention; rejected.

## R8. Past-season import (FR-021)

- **Decision**:
  - After a successful connect (or a reconnect that newly grants
    `activity:read_all`), enqueue `import-page { athleteId, page: 1 }`.
  - The handler calls
    `GET /api/v3/athlete/activities?after=<SEASON_START epoch>&per_page=200&page=N`
    and upserts the cycling activities from the summary objects. The summary
    already has every field from R5, so no per-activity call is needed.
  - If the page was full, it enqueues `page N+1`. Otherwise it marks the rider's
    import `done`.
  - The rider's `import_status` goes `pending → running → done` and is shown on
    `/me`.
- **Rationale**: One request per 200 activities. 500 activities is 3 requests,
  so SC-008 is trivially met and live events never wait behind the import (both
  share the serial consumer, each import step is a single message). Each page
  message is idempotent, so a crash simply re-runs that page.
- **Alternatives considered**: A separate import queue. Unnecessary at this volume;
  rejected.

## R9. Rider sign-in sessions and CSRF

- **Decision**:
  - Session: cookie `rp_session` containing `<athleteId>.<expiresAt>.<HMAC-SHA256>`
    signed with the `SESSION_SIGNING_KEY` secret. Attributes: `HttpOnly`, `Secure`,
    `SameSite=Lax`, `Path=/`, 30 days. A session for a deleted rider is treated as
    signed out.
  - OAuth CSRF: a random `state` value in a short-lived signed `rp_oauth_state`
    cookie (10 minutes), compared with the callback's `state`.
  - State-changing routes (`POST /me/disconnect`, `POST /logout`) require the
    session cookie and an `Origin` header matching the request host.
- **Rationale**: Web Crypto HMAC, no session table and no dependency. Signing in
  happens only through Strava (FR-009).
- **Alternatives considered**: A D1 session table. Gives server-side revocation,
  which deleting the rider already provides; rejected.

## R10. Token encryption at rest (FR-027)

- **Decision**: Access and refresh tokens are encrypted with AES-256-GCM through
  Web Crypto, using the `TOKEN_ENCRYPTION_KEY` secret (32 random bytes, base64).
  The stored value is `v1:<base64 iv>:<base64 ciphertext>`, where the version
  prefix allows key rotation later. Tokens never appear in logs or HTML. Errors
  from Strava are logged with status and endpoint only.
- **Rationale**: The constitution requires refresh tokens to be encrypted. Access
  tokens are encrypted too, because the cost is nil.

## R11. EU data location

- **Decision**: Create the production D1 database with
  `wrangler d1 create rynke-points --jurisdiction=eu` (a manual step for the
  maintainer). If the account's plan rejects `--jurisdiction`, fall back to
  `--location=weur` and note it in the README. Queue messages hold only numeric
  identifiers.
- **Rationale**: Principle I says "EU where the platform allows". The jurisdiction
  can only be set at creation time, so it must happen before the first deploy.

## R12. Testing approach (Principle V)

- **Decision**:
  - Tests use Vitest in workerd via `@cloudflare/vitest-pool-workers`.
    `readD1Migrations()` in `vitest.config.ts`, plus `applyD1Migrations()` in a
    setup file, give every test file a migrated local D1.
  - Bindings used in tests are synthetic values set in `vitest.config.ts`
    (`miniflare.bindings`), so `.dev.vars` never feeds tests.
  - Strava is a fake router installed with `vi.spyOn(globalThis, "fetch")` in a
    test helper. It also fails the test on any request to an unexpected host.
  - Handlers are invoked through `exports.default` (`fetch`, `queue` via
    `createMessageBatch`/`getQueueResult`, `scheduled` via
    `createScheduledController`).
- **Rationale**: Pool-workers 0.22 no longer ships `fetchMock`. Because the worker
  runs in the test isolate, spying on global `fetch` intercepts its outbound calls.
  If that turns out not to hold for `exports.default`, the Strava client takes an
  injectable `fetch` as a fallback.

## R13. HTML, brand assets, routing

- **Decision**:
  - Server-rendered HTML built from template literals with an escaping `html`
    tagged template.
  - Routing is a small path switch, with no framework.
  - The official "Connect with Strava" button and "Powered by Strava" logo are
    served from Workers static assets (`public/`). The maintainer downloads them
    from Strava's brand guidelines page, which is a manual step.
- **Rationale**: Principle IV (no runtime dependencies) plus brand-guideline
  compliance (Principle I). Four pages don't justify a framework.

## R14. Strava capacity reached (FR-008)

- **Decision**: A `403` from the token exchange is shown as the "team is full for
  now" page. Any other non-2xx gets a generic "connection failed, try again" page.
- **Rationale**: Strava does not document the capacity error. A 403 at token
  exchange with a valid code has no other known cause. Confirm the exact response
  during the first real second-rider connection and refine the check if needed
  (tracked in quickstart).

## R15. Database backup history and the deletion promise (FR-022a)

- **Decision**: Rider deletion is a hard delete in the live database. D1 Time
  Travel keeps a restorable history for 7 days on Workers Free (30 on Paid). It is
  always on and cannot be disabled. The app tells riders about this retention on
  the landing page and on the deletion confirmation. Restoring the database from
  Time Travel is a manual disaster-recovery step only. A restore can bring back
  riders deleted after the restore point, and nothing in the app would remove
  them again: their deauth event has already been processed. So after a restore,
  the maintainer MUST delete every restored rider whose Strava access is refused.
  The next daily membership check marks them `needs_reconnect`, which gives the
  list.
- **Rationale**: Principle I forbids keeping data "for stats", not routine backups
  outside the app's control. Disclosing the window keeps the promise honest.
  Checked 2026-10-06 in Cloudflare's D1 Time Travel docs.
- **Alternatives considered**: Encrypting each rider's data with a per-rider key
  and discarding the key on deletion ("crypto-shredding"), which would make backup
  copies unreadable at once. Too much machinery for low-sensitivity ride figures;
  rejected for now.
