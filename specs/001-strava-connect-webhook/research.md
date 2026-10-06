# Research: Strava Connection and Webhook Activity Intake

**Feature**: [spec.md](spec.md) | **Date**: 2026-10-06

Sources checked on 2026-10-06: Strava developer docs (authentication, webhooks,
brand guidelines), Cloudflare docs (Queues pricing and retries, D1 data location),
RFC 9110 §12.5.4 (`Accept-Language`), and the installed
`@cloudflare/vitest-pool-workers` 0.22.0 type definitions.

R16–R19 were added after constitution v1.1.0 (Language section) and spec FR-028–
FR-030, FR-029a, SC-010 and SC-011. They supersede the earlier assumption that
rider pages are English.

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
    rider becomes `needs_reconnect`, their pending work is dropped (FR-020). If
    they haven't reconnected 7 days later, the daily cron deletes them. A 400/401
    on refresh is not taken as a deauthorization on its own, because a broken
    client secret would then delete every rider at once.
  - Revoke with the new `POST https://www.strava.com/oauth/revoke` (HTTP Basic auth
    `client_id:client_secret`, form field `token`). It becomes the only endpoint on
    2027-06-01, so we don't build on the legacy `/oauth/deauthorize`. 503 is
    retryable; 200 means done (even if the token was unknown). For a stored rider
    we send the refresh token, so revoking never needs a refresh first and still
    works for `needs_reconnect` riders. Any non-transient error means there is
    nothing left to revoke, and deletion goes ahead.
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
  disconnect on those. At connect time an inconclusive answer turns a new rider
  away (nothing stored), but signs an existing rider in as usual: revoking their
  new token would end their existing authorization too.
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
  - `update` whose `updates` keys are exactly `title` → no call. We store no
    title.
  - Any other `update` (`type`, `private`, an empty `updates`, or keys Strava adds
    later) → refetch. Refetching when unsure costs one read; skipping could leave
    stale figures.
  - `delete` → delete the row, no call.
  - Refetch answered 404 (or 403) → treat as deletion or inaccessible (removes the
    row).
  - Stored fields: `id`, `sport_type`, `start_date` (UTC), `start_date_local`,
    `timezone`, `distance`, `moving_time`, `elapsed_time`, `total_elevation_gain`,
    `manual`, `trainer`, `flagged`, `private`. `elapsed_time`, `manual`,
    `trainer` and `flagged` are part of both the summary (import) and the
    detailed (event) representation, so they cost no extra request. If Strava
    omits one, it is stored as unknown (`NULL`), never guessed.
    Everything else in the response is dropped before it touches storage.
  - Strava sends no event when it flags an activity. The stored `flagged`
    follows whenever the activity is read anyway: a refetch for any non-title
    `update`, the import after a reconnect, or a re-read (R20). A title-only
    `update` makes no call, so it doesn't refresh the flag. Nothing polls for
    it (FR-010); the delay is accepted (spec edge case "Strava flags a stored
    activity later").
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
    (10 for 15-min, 50 for daily), don't call. Instead re-send the message body
    with `delaySeconds` until the next window or the next UTC midnight, capped at
    43200 s, and ack the original.
  - `429` → same deferral.
  - Why re-send rather than `retry()`: every `retry()` counts toward
    `max_retries`, so a long budget shortage would use up a message's attempts
    and Queues would delete it. A re-sent message starts at attempt 1. Queues
    accepts at most 12 h of delay; a message that arrives too early is simply
    deferred again.
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
  message reaches its last attempt with a transient error, the consumer upserts it
  into a D1 table `failed_work` (rider ID plus the canonical message JSON, which
  holds only identifiers), logs it, and acks it. The upsert keeps
  `first_failed_at` and counts `failures`.
  - The daily cron re-enqueues every row whose `first_failed_at` is less than
    7 days ago and keeps the row. Older rows are given up: deleted, and logged as
    such.
  - When a message succeeds, the consumer deletes its row (matched on the
    canonical JSON).
  - Rows cascade-delete with the rider.

  Organisers read the table with `wrangler d1 execute` to "see" open failures,
  or look for the log lines (FR-019).
- **Rationale**: Queues on the Workers Free plan keep messages only 24 hours, and
  a dead-letter queue has the same retention. A Strava outage longer than that
  would otherwise lose activities. Keeping the row until success makes failures
  visible for as long as they're open. `first_failed_at` makes the 7-day limit
  real, instead of resetting each time a re-enqueued message fails again.
- **Alternatives considered**: A dead-letter queue. Same 24-hour retention; rejected.

## R8. Past-season import (FR-021)

- **Decision**:
  - After a successful connect, a reconnect that newly grants
    `activity:read_all`, or a reconnect that ends `needs_reconnect`, enqueue
    `import-page { athleteId, page: 1, after: <SEASON_START epoch> }`.
  - The handler calls
    `GET /api/v3/athlete/activities?after=<after>&per_page=200&page=N`
    and upserts the cycling activities from the summary objects. The summary
    already has every field from R5, so no per-activity call is needed.
  - If the page was full, it enqueues `page N+1` with the same `after`.
    Otherwise it marks the rider's import `done`. Carrying `after` in the
    message means a changed season start only affects imports started
    afterwards (spec Edge Cases).
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
    `POST /lang` needs the same `Origin` check but no session (R18).
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
    tagged template. Templates contain markup only; every piece of rider-facing
    text comes from the message catalogs (R16).
  - Routing is a small path switch, with no framework.
  - The official "Connect with Strava" button and "Powered by Strava" logo are
    served from Workers static assets (`public/strava/<locale>/`), picked per page
    language through the catalogs (R19). The maintainer downloads them from
    Strava's brand guidelines page, which is a manual step.
- **Rationale**: Principle IV (no runtime dependencies) plus brand-guideline
  compliance (Principle I). A handful of pages don't justify a framework.

## R14. Strava capacity reached (FR-008)

- **Decision**: A `403` from the token exchange redirects to the "team is full
  for now" notice (`/notice/team-full`, R18). Any other non-2xx gets a generic "connection failed, try again" page.
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
  list, and the cron deletes them 7 days later anyway (FR-020).
- **Rationale**: Principle I forbids keeping data "for stats", not routine backups
  outside the app's control. Disclosing the window keeps the promise honest.
  Checked 2026-10-06 in Cloudflare's D1 Time Travel docs.
- **Alternatives considered**: Encrypting each rider's data with a per-rider key
  and discarding the key on deletion ("crypto-shredding"), which would make backup
  copies unreadable at once. Too much machinery for low-sensitivity ride figures;
  rejected for now.

## R16. Message catalogs (FR-028, FR-030, constitution "Language")

- **Decision**:
  - Plain typed TypeScript catalogs, no i18n library. One file per locale under
    `src/i18n/messages/`: `de.ts` and `en.ts`. Each exports a flat object
    `{ "<message.id>": "<text>" }`. The full inventory of message IDs, with the
    German and English text, is [contracts/messages.md](contracts/messages.md).
  - German is the source catalog. `MessageId = keyof typeof de` and
    `Catalog = Readonly<Record<MessageId, string>>`. `en.ts` is declared as
    `Catalog`, so `tsc` rejects a missing or an extra key (FR-028 parity at build
    time).
  - The registry `src/i18n/catalogs.ts` exports `CATALOGS = { de, en }`,
    `Locale = keyof typeof CATALOGS`, `DEFAULT_LOCALE = "de"` and
    `FOREIGN_LOCALE = "en"`. Adding a locale
    means adding `src/i18n/messages/<code>.ts` and listing it in the registry. No
    page, routing or processing code changes (FR-030): the switcher, locale
    resolution and validation all iterate over the registry.
  - Placeholders use `{name}` syntax. `t(id, params)` returns a plain string, which
    the `html` template escapes when it's interpolated. `tHtml(id, params)` escapes
    the message text itself and inserts `SafeHtml` params unescaped. It's used
    where a message embeds markup, such as the club link.
  - Each catalog also carries `meta.languageName` (the language's own name for the
    switcher, e.g. "Deutsch") and `meta.intlLocale` (the BCP 47 tag used for
    `Intl.NumberFormat` and `Intl.DateTimeFormat`: `de-DE` and `en-GB`). Numbers
    and dates on rider pages are formatted through these, e.g. `42,2 km` and
    `06.10.2026` in German.
  - Strava sport types shown to riders are messages too (`sport.<SportType>`), so
    no raw enum value like `GravelRide` reaches a page.
  - Fallback: if a message were missing at runtime (it can't be, per the types),
    `t` falls back to the `de` text. An unknown placeholder or a missing param
    throws, so tests catch it.
  - Handlers never import a catalog directly. The router builds one `I18n` object
    per request (`{ locale, t, tHtml, formatNumber, formatDate, locales }`) from
    `ctx.catalogs` and passes it in. `ctx.catalogs` defaults to `CATALOGS`. Tests
    can inject an extra pseudo-locale to prove that no copy is hard-coded (R18) and
    that a new locale needs no code change.
  - Log messages, errors thrown in code, and webhook/health responses stay English
    and are not catalogued. They aren't rider-facing.
- **Rationale**: The constitution's Language section prefers plain typed catalogs
  over a library (Principle IV). Fewer than 100 strings, two locales and no
  plurals beyond what fits in separate messages don't need ICU MessageFormat.
  Type-level parity makes FR-028's "every message in both languages" a build
  error rather than a runtime surprise. A runtime test still covers what types
  can't: empty strings and differing placeholders. `Intl` is built into
  the Workers runtime (the plan already uses it for the Europe/Berlin season
  start).
- **Alternatives considered**:
  - `i18next`, `@formatjs/intl` or `typesafe-i18n`. Each is a new runtime dependency
    for features (plurals, ICU, lazy loading) this feature doesn't need; rejected
    per Principle IV.
  - JSON catalogs. They lose compile-time key parity unless a codegen step is
    added; rejected.
  - Messages as functions (`(p) => string`). Typed params, but the catalogs stop
    being plain strings that a translator can edit; rejected.

## R17. Locale resolution (FR-029, FR-029a)

- **Decision**: `resolveLocale(request, catalogs)` is a pure function, applied in
  this order:
  1. **Cookie** `rp_lang`, if its value is a key of `catalogs`. Any other value,
     such as a locale that was removed later, is ignored, and resolution falls
     through (spec edge case "Picked language no longer provided").
  2. **`Accept-Language`**. Parse the comma-separated ranges with their `q`
     weights (default 1; malformed weights count as 0) and reduce each range to its
     primary subtag in lowercase (`en-US` → `en`). Drop `q=0` and `*`. Then pick
     the supported locale with the highest weight. On a tie, the one listed first
     in the header wins.
  3. **`en`** (`FOREIGN_LOCALE`), if the header still names at least one language
     after dropping, but none of them is supported.
  4. **`de`** (`DEFAULT_LOCALE`). This covers no header, an empty header, or a
     header that names no language once `q=0`, `*` and malformed entries are
     dropped.

  Examples: `en-US,en;q=0.9,de;q=0.8` → `en`; `de-DE,en;q=0.5` → `de`;
  `da,en;q=0.3` → `en`; `da,de;q=0.5` → `de`; `da` → `en`; `*` → `de`;
  none → `de`.
- Every HTML response carries `<html lang="<locale>">`, `Content-Language:
  <locale>` and `Vary: Accept-Language, Cookie`.
- **Rationale**: This is the spec's FR-029 rule: German only when the browser
  explicitly prefers it, English for browsers that name only other languages, and
  German when there is no preference at all. Steps 2–4 don't name `de` or `en`
  except as the two constants, so a new catalog joins step 2 without code changes
  (FR-030). Taking the primary subtag only is enough while each language has one
  catalog.
- **Alternatives considered**:
  - Storing the language in the rider record. Forbidden by FR-029a, and it would
    not work before sign-in.
  - A path prefix (`/en/me`). Every route and redirect would need it, and it
    changes URLs; rejected.
  - A `?lang=` query parameter. Not remembered, so it doesn't meet FR-029a;
    rejected.

## R18. Language switcher (FR-029a, SC-011)

- **Decision**:
  - The page layout renders the switcher on every rider-facing page. It's a plain
    HTML form that needs no JavaScript, and no script is shipped:

    ```html
    <form method="post" action="/lang"> <input type="hidden" name="next" value="<current path>">
      <button name="lang" value="de" lang="de" aria-current="true">Deutsch</button>
      <button name="lang" value="en" lang="en">English</button> </form>
    ```

    One click on a language is the "one action" of SC-011. Buttons are generated
    from the registry, labelled with each catalog's `meta.languageName`, and the
    current language is marked `aria-current="true"`. The form is labelled with the
    `layout.switcher.label` message.
  - `POST /lang` (contracts/http-routes.md) reads `lang` and `next` from the
    form body. It requires a same-origin `Origin` header, like the other POST
    routes (R9).
    - Supported `lang`: set the cookie `rp_lang=<lang>` with
      `Path=/; Max-Age=31536000; SameSite=Lax; Secure; HttpOnly`.
    - Unsupported `lang`: leave the cookie unchanged.

    Either way it answers `303 See Other` to `next`.
  - `next` is accepted only if it is a known rider-facing GET path: `/`, `/me`,
    `/me/disconnect`, or `/notice/<known id>`. Anything else, including absolute
    and protocol-relative URLs, becomes `/`. This prevents an open redirect.
  - The cookie isn't signed: its value is validated against the registry on every
    read, it carries no rider identity, and forging it only changes the forger's
    own language. It is never written to D1 (FR-029a). It is a strictly necessary,
    user-requested preference cookie, so it needs no consent banner. The landing
    page's privacy text still lists it (`landing.cookies`).
  - **Every page has a stable GET URL**, so "keep the visitor on the same page"
    always works. Outcomes that used to be rendered inline by `GET /auth/callback`
    (refusal, team full, not a member, Strava busy, failed, expired sign-in) and by
    `POST /me/disconnect` (deleted, deleted but revoke failed) now redirect
    `303 /notice/<id>`. That page renders the outcome from the catalog in the
    current language. Re-submitting a used OAuth `code`, or re-POSTing the
    deletion, can then never happen through the switcher or a page reload.
- **Hard-coded copy guard**: a test injects a pseudo-locale `qps` into
  `ctx.catalogs`, where every message is the `de` text wrapped in `⟦…⟧`. It renders
  every rider-facing page with `rp_lang=qps` and asserts that every visible text
  node and every `alt`/`aria-label`/`title` attribute lies inside markers. Only
  numbers, dates and the rider's first name are allowed outside them. That proves
  FR-028 (no copy outside the catalogs) and FR-030 (a new locale works with no code
  change, and the switcher lists it).
- **Rationale**: A form POST plus a cookie is the smallest mechanism that applies
  at once, works before sign-in, needs no JavaScript, and is remembered per
  browser. PRG (post/redirect/get) for outcome pages is a standard pattern and
  also fixes "reload re-submits".
- **Alternatives considered**:
  - `GET /lang?l=en&next=…` links. Simpler markup, but it's a state-changing GET
    that prefetchers and crawlers can trigger; rejected.
  - A client-side `<select>` with JavaScript. Adds a script, and still needs a
    no-JS fallback; rejected.
  - Keeping the inline callback pages and sending the switcher there to `/`. That
    breaks "keeps the visitor on the same page"; rejected.

## R19. Strava brand assets per language (FR-001, constitution "Language")

- **Decision**:
  - Brand images are localised resources referenced from the catalogs:
    `brand.connectWithStrava.src`, `brand.connectWithStrava.alt`,
    `brand.poweredByStrava.src` and `brand.poweredByStrava.alt`.
  - The files live in `public/strava/<locale>/connect-with-strava.svg` and
    `public/strava/<locale>/powered-by-strava.svg`. The maintainer fills them from
    Strava's downloads (`1.1-Connect-with-Strava-Buttons.zip` and
    `1.2-Strava-API-Logos.zip`), using the orange button at 48 px height.
  - The `de` catalog points at Strava's original (English) files in
    `public/strava/en/` until a German variant is confirmed in Strava's
    downloads. Then it switches to `public/strava/de/`. The constitution allows
    that fallback: "in the German variant where one exists". Defaulting to `en/`
    means a deploy can't ship broken images because nobody added German files.
  - Tests don't need the files, so the quickstart's pre-deploy steps check that
    every `brand.*.src` in every catalog exists under `public/`.
  - The button's `alt` text is translated ("Mit Strava verbinden" / "Connect with
    Strava"). The attribution's `alt` stays "Powered by Strava" in every locale,
    because the guidelines require that exact wording for text references.
  - The images are never modified, re-lettered or translated by us.
- **Rationale**: Checked on 2026-10-06, Strava's guidelines say to "never modify,
  alter or animate Strava logos". They list the button in orange and white
  (EPS/SVG/PNG, 48 px @1x) and point to developers@strava.com for anything else.
  The page doesn't say whether the downloads include German variants. Keeping the
  path in the catalog makes "German if it exists" a data change, not a code change,
  and tests stay independent of the actual files.
- **Alternatives considered**:
  - A path convention (`/strava/${locale}/…`) built in code. It forces a German
    file to exist even when Strava supplies none, which tempts someone to make an
    unofficial translation; rejected.
  - Our own German-lettered button. It violates the brand guidelines; rejected.
- **Open**: whether Strava's downloads include a German variant has to be confirmed
  when the maintainer downloads them (quickstart §3). If they don't, FR-001's "variant
  matching the page language" is met only for English, and the German page shows
  the official English button (see plan.md, Open questions).

## R20. Re-reading stored activities when FR-013 gains a figure (spec Edge Cases)

- **Decision**:
  - Each rider row carries `figures_version`: the FR-013 field set its stored
    activities were last read with. The code holds the current version as
    `ACTIVITY_FIGURES_VERSION` in `src/strava/activity.ts`, next to the
    allow-list mapping. Version 1 is the set with `elapsed_time`, `manual` and
    `trainer`; version 2 adds `flagged` (migration `0003`). Migration `0002`
    adds the column with default 0, so riders who exist at that point are
    marked as needing a re-read. A newly connected rider
    is inserted with the current version, because their import already reads
    every current figure.
  - The daily cron selects connected riders with
    `figures_version < ACTIVITY_FIGURES_VERSION`. For each of them it enqueues
    `reread-page { athleteId, page: 1, after: <current season start> }`, then
    sets their `figures_version` to the current version. Sending comes first. If
    setting the version fails, the next cron enqueues the rider again, which
    is harmless because re-reading is idempotent. Marking at enqueue time keeps
    the re-read to once per rider: a slow, budget-deferred chain is not
    enqueued a second time by the next cron. A chain that fails is still covered
    by `failed_work` (R7).
  - `reread-page` pages `GET /athlete/activities` exactly like `import-page`.
    It uses the same scope rule and upserts, so it costs one request per 200
    activities. Unlike the import, it never touches `import_status`. A re-read
    is maintenance, so `/me` doesn't show "importing" again.
  - After the last page (fewer than 200 items), the handler handles the rider's
    rows that still lack a figure. That can be a row the list didn't return (the
    activity was deleted on Strava, made private, changed to a non-cycling type,
    or started before the season start), or a row whose summary omitted a field.
    For each one it enqueues `activity-event { aspect: "update", changed: [] }`.
    That is one `GET /activities/{id}` per row, and the existing decision table
    then either fills the row or deletes it. No new code path decides
    whether a row stays.
  - Riders in `needs_reconnect` are skipped by the cron and keep their older
    version. Reconnecting enqueues the import (R8), and the next cron re-reads
    them once.
  - Version 2 (`flagged`) is the first use of the "another figure" path: `0003`
    adds `activities.is_flagged`, the constant becomes 2, and every rider at
    version 1 is re-read once. The "still lacks a figure" check gains
    `is_flagged`; nothing else changes.
- **Rationale**:
  - The list endpoint already carries every figure (R5), so the whole re-read
    costs about one request per rider and season. That is far below the read
    budget, and it interleaves with live events on the serial consumer (R6).
  - Refetching each stored activity instead would cost one request per row.
    A full season for the team is a few thousand requests: several days of
    budget, with live events waiting behind them.
  - The version marker is what makes the re-read happen once, as the spec
    requires. "Rider has a `NULL` figure" can't be the trigger on its own,
    because a field Strava omits stays `NULL` and would be re-read every day.
  - The marker is generic: when FR-013 gains another figure, a migration adds
    the column and the constant goes up by one. That re-reads every rider once
    more, with no new code.
- **Alternatives considered**:
  - A one-off script or admin route that the maintainer triggers. It's an extra
    manual production step and an extra authenticated surface, and it would be
    forgotten for riders in `needs_reconnect`; rejected.
  - Reusing `import-page` with a flag. It would flip `import_status` and the
    `/me` text, and mix two meanings into one message kind; rejected.
  - Using `after` = the earliest stored row still missing a figure. The
    leftover refetch already covers rows older than the season start, so this
    only saves a request in rare cases; rejected for simplicity.
