---
description: "Task list for the installable app and notifications for new Rynke"
---

# Tasks: Installable App and Notifications for New Rynke

**Input**: Design documents from `/specs/010-pwa-notifications/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: REQUIRED (constitution Principle V, spec FR-050). Write each test task
first, run it and confirm it fails, then implement. Riders and push endpoints are
synthetic, the VAPID key is a committed test key, and every push request goes to
the mocked `fetch`. `public/sw.js` and `public/app.js` have no unit tests
(research R15); what they call is tested on the server.

**Organization**: one phase per user story, in the spec's order. US1 (install,
offline notice, longer sign-in) ships on its own. US2 (sending) and US3 (on and
off) share the table and its statements from Phase 2. US2's tests seed
registrations directly, so it doesn't wait for US3.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 (install on the phone), US2 (notification for new Rynke),
  US3 (turn notifications on and off)

## Phase 1: Setup

- [X] T001 In the worktree, run `pnpm install`, then `pnpm lint`, `pnpm typecheck`
  and `pnpm test`. All pass before any change, so later failures are this
  feature's.
- [X] T002 The push key and subject (research R4, [data-model.md](data-model.md)
  "Configuration"):
  - Generate two separate synthetic keys with the one-liner in
    [quickstart.md](quickstart.md) §3, without the `wrangler` pipe. Neither is
    ever used in production.
  - `wrangler.jsonc`: add `"PUSH_SUBJECT": "https://trhh-rynke-coins.link"` to
    `vars`, and `"PUSH_VAPID_KEY"` to `secrets.required`.
  - `vitest.config.ts`: `PUSH_VAPID_KEY: '<first key JSON>'` in `bindings`, with
    a comment that it is a synthetic test key.
  - `dev/fake.env`: `PUSH_VAPID_KEY=<second key JSON>`, under a comment that it
    is synthetic and only reaches the developer's own browser's push service
    (research R15).
  - `package.json` `dev` script: add `-u PUSH_VAPID_KEY` to the `env -u` list.
  - `.dev.vars.example`: a `PUSH_VAPID_KEY=` line with the comment "EC P-256
    private key as JWK JSON; see README (keep it: a new key ends every
    device's notifications)".
  - Run `pnpm types` to regenerate `worker-configuration.d.ts`. `pnpm test`
    still passes.

---

## Phase 2: Foundational (blocks US2 and US3)

**Purpose**: the `push_subscriptions` table, its statements, the endpoint
allow-list and the test support every push test uses.

- [X] T003 [P] Tests first (failing):
  - `test/integration/schema-minimisation.test.ts`: `COLUMNS.push_subscriptions =
    ["subscription_id", "endpoint", "athlete_id", "created_at"]`.
  - `test/integration/delete-rider.test.ts` "deletes every row of the rider
    without calling Strava": seed two `push_subscriptions` rows for the rider
    and one for another rider; afterwards the rider has 0 rows and the other
    rider still has 1 (FR-013, SC-005).
  - New `test/integration/push-subscriptions.test.ts` for
    `src/db/push-subscriptions.ts`, with synthetic endpoints from T004:
    - `upsertSubscription` inserts; the same endpoint for another rider moves
      the row to them and updates `created_at`;
    - `trimSubscriptions` keeps a rider's newest 10 by `created_at`, then
      `subscription_id`, and leaves other riders alone;
    - `deleteSubscription(endpoint, athleteId)` deletes only a row of that
      rider; `deleteSubscriptionById`; `hasSubscription`;
    - `subscriptionIdsOfRiders([a, b])` returns `{ athleteId, subscriptionId }`
      for both riders;
    - `subscriptionEndpoint(id, athleteId)` is `null` when the row belongs to
      another rider;
    - inserting `http://…` or an endpoint of 1025 characters fails on the
      `CHECK`.
  - In the same file, `isPushEndpoint` accepts
    `https://fcm.googleapis.com/fcm/send/x`,
    `https://updates.push.services.mozilla.com/wpush/v2/x`,
    `https://web.push.apple.com/x` and `https://wns2-db5p.notify.windows.com/w/?token=x`;
    it rejects `http:` of those, `https://user:pw@fcm.googleapis.com/x`,
    `https://notify.windows.com.example/x`, `https://example.com/x`, a
    non-URL and 1025 characters (research R7).
- [X] T004 [P] New `test/support/push.ts`:
  - `pushEndpoint(n: number, host = "fcm.googleapis.com")` returns
    `https://<host>/fcm/send/synthetic-<n>`.
  - `seedSubscription(athleteId, endpoint, createdAt = NOW)` inserts a row and
    returns its `subscription_id`.
  - `installPushService(statusFor: (url: string) => number | "throw")` takes
    over the deny-all `fetch` spy from `test/setup.ts` for push hosts only,
    records each request (`url`, `headers`, body length) in the returned
    array, and still fails the test for any other URL.
  - `test/support/ctx.ts`: add `push_subscriptions` to `resetDb()` (before
    `riders`) and to `tableCounts()`.
- [X] T005 Add `migrations/0008_push_subscriptions.sql`, word for word as in
  [data-model.md](data-model.md).
- [X] T006 New `src/db/push-subscriptions.ts` with the statements T003 tests,
  in the style of `src/db/team-events.ts`. The upsert is
  `INSERT … ON CONFLICT (endpoint) DO UPDATE SET athlete_id = excluded.athlete_id,
  created_at = excluded.created_at`. The trim deletes the rider's rows not in
  their newest 10. `subscriptionIdsOfRiders` takes several riders, for
  team-event changes (data-model.md's `subscriptionIdsOfRider`, generalised).
- [X] T007 In `src/db/push-subscriptions.ts`: `MAX_ENDPOINT_LENGTH = 1024` and
  `isPushEndpoint(value: string): boolean` per research R7 (`URL.canParse`,
  `https:`, empty `username` and `password`, host equal to one of the three
  fixed hosts or ending in `.notify.windows.com`), with a comment naming R7: the
  table only takes, and the Worker only posts to, such endpoints. T003 and
  T005–T007 pass.

**Checkpoint**: the table exists, cascades with the rider and only takes allowed
endpoints through `isPushEndpoint`.

---

## Phase 3: User Story 1 - Install RynkePoints on the phone (Priority: P1) 🎯 MVP

**Goal**: the site is installable, opens on `/me`, shows an install hint where it
helps, shows the offline notice without a connection, and keeps the rider signed
in for 180 days after the last visit ([contracts/client.md](contracts/client.md),
[contracts/http-routes.md](contracts/http-routes.md), research R1, R2, R10–R12).

**Independent test**: T008–T012 pass; quickstart §2 steps 2, 3 and 8 in Chrome.

### Tests for User Story 1

- [X] T008 [P] [US1] New `test/unit/manifest.test.ts`: import
  `../../public/manifest.webmanifest?raw`, `JSON.parse` it and assert every
  field of the manifest in [contracts/client.md](contracts/client.md): `name`,
  `short_name` and `description` are `"RynkePoints"`, `id` and `scope` `/`,
  `start_url` `/me`, `display` `standalone`, the two theme colours, and the
  three icons with their sizes and the `maskable` purpose (FR-001, FR-002,
  FR-032).
- [X] T009 [P] [US1] In `test/unit/catalogs.test.ts` (failing): add
  `install.button`, `install.ios`, `install.dismiss`, `offline.title`,
  `offline.body` and `push.body` to `CONTRACT_IDS`, and a case that
  `push.body` contains no `{` in any catalog (SC-008).
- [X] T010 [P] [US1] New `test/integration/pwa-pages.test.ts` (failing):
  - For `/`, `/me` (signed in), `/me/disconnect` and `/notice/deleted`: the head
    has `<link rel="manifest" href="/manifest.webmanifest">`, the SVG icon, the
    `apple-touch-icon`, `<meta name="theme-color" content="#fc5200">` and
    `<script src="/app.js" defer></script>`, and no `viewport-fit` (FR-041,
    research R12).
  - `/` and `/me` contain `<aside id="install" class="notice" hidden>` with the
    three children of the contract and the German `install.*` texts (FR-004).
  - `GET /offline?lang=de` and `?lang=en`: 200, `offline.title` and
    `offline.body` in that language, the Strava footer, `Cache-Control:
    no-cache`. Without `lang` it follows `Accept-Language`. An unknown `lang`
    falls back the same way.
  - `GET /notification-text?lang=de`: JSON
    `{"title":"RynkePoints","body":"Neue Rynke – tippe zum Ansehen"}`, `en` the
    English body, `Cache-Control: no-cache`.
  - Both routes with a session cookie of a seeded rider: the responses are
    byte-identical to those without one, contain neither the rider's first name
    nor a `Set-Cookie`, and run with a `ctx` whose `env.DB` throws on every
    method (SC-007, SC-008).
- [X] T011 [P] [US1] In `test/unit/session.test.ts` and `test/unit/sign.test.ts`
  (failing):
  - `createSessionCookie` has `Max-Age=15552000`;
  - `verifySignedValue` returns `{ value, expiresAt }` (adapt the existing
    assertions);
  - `readSessionExpiry(request, env, now)` returns `{ athleteId, expiresAt }`,
    or `null` when missing, tampered or expired.
- [X] T012 [P] [US1] New `test/integration/session-renewal.test.ts` (failing),
  through `handleFetch` with a fixed clock (FR-007, research R10):
  - `GET /me` with a cookie issued 10 days ago gets
    `Set-Cookie: rp_session=…; Max-Age=15552000`, and the new cookie reads back
    as the same rider;
  - a cookie issued 2 hours ago gets no `Set-Cookie`;
  - an expired or tampered cookie gets none, and `/me` redirects to `/` as
    before;
  - a 30-day cookie of the old code, with 1 day left, is renewed;
  - `GET /` with a valid old cookie (it redirects to `/me`) is renewed too;
  - `POST /lang`, `GET /offline`, `GET /notification-text` and `/health` are
    never renewed;
  - `POST /logout` still answers only the clearing cookie.

### Implementation for User Story 1

- [X] T013 [P] [US1] Icons in `public/icons/` (research R1, client.md
  "Icons"): draw `icon.svg`, a simple RynkePoints mark in `#fc5200` and white
  that doesn't resemble Strava's logo. Render `icon-192.png`, `icon-512.png`,
  `icon-maskable-512.png` (mark inside the central 80 %, full background),
  `apple-touch-icon.png` (180, opaque) and `badge-96.png` (white on
  transparent) once with `rsvg-convert` or another SVG renderer, and commit
  them. No build step.
- [X] T014 [P] [US1] `public/manifest.webmanifest`, exactly the contract's JSON.
  T008 passes.
- [X] T015 [P] [US1] Catalog keys in `src/i18n/messages/de.ts` and `en.ts`:
  `install.button`, `install.ios`, `install.dismiss`, `offline.title`,
  `offline.body` and `push.body`, worded as in
  [contracts/messages.md](contracts/messages.md). T009 passes.
- [X] T016 [US1] `src/http/html.ts`, `layout()`: the five `<head>` lines of
  client.md after the viewport meta. In `STYLE`: `#install button{margin-right:.5rem}`
  and nothing else; the hint reuses `section.notice`'s look, so change that
  selector to `.notice`.
- [X] T017 [US1] New `src/http/pwa.ts` with `handleOffline(request, ctx)` and
  `handleNotificationText(request, ctx)`:
  - the locale is the `lang` query parameter if it is in `ctx.catalogs`, else
    `resolveLocale(request, ctx.catalogs)`;
  - `/offline` renders `layout()` with `path: "/me"`, `<h1>offline.title</h1>`
    and `<p>offline.body</p>`; `/notification-text` returns
    `{ title: i18n.t("app.name"), body: i18n.t("push.body") }`;
  - both set `Cache-Control: no-cache`, and neither reads the session or D1.
  - `src/http/router.ts`: `GET`/`HEAD` cases `/offline` and
    `/notification-text`.
- [X] T018 [US1] Install hint markup: a `renderInstallHint(i18n)` in
  `src/http/pwa.ts`, exactly the `aside#install` of client.md. Render it after
  the `<h1>` in `handleLanding` (`src/http/landing.ts`) and in `handleMe`
  (`src/http/me.ts`). T010 passes.
- [X] T019 [US1] Sliding sign-in (research R10):
  - `src/crypto/sign.ts`: `verifySignedValue` returns
    `{ value: string; expiresAt: number } | null`. Update `readSigned` in
    `src/http/session.ts` and every other caller `pnpm typecheck` flags.
  - `src/http/session.ts`: `SESSION_MAX_AGE = 180 * 24 * 3600` with a comment
    naming 010 FR-007; export `readSessionExpiry`; `readSession` uses it.
  - `src/http/session.ts`: `renewSession(request, response, ctx):
    Promise<Response>`. It returns `response` unchanged unless the request has
    a valid session with `expiresAt < now + SESSION_MAX_AGE - 86400` and no
    `Set-Cookie` of the response starts with `rp_session=`. Otherwise it returns
    `new Response(response.body, response)` with a fresh
    `createSessionCookie` appended.
  - `src/http/router.ts`: the `GET`/`HEAD` switch assigns its response and
    returns `renewSession(request, response, ctx)`, except for `/offline` and
    `/notification-text`, which return before it. Add one line to
    `contracts/http-routes.md` "Session renewal": those two routes are
    excluded, so their responses are the same for everyone.
  T011 and T012 pass.
- [X] T020 [US1] `public/sw.js` without the `push` handlers (client.md
  `public/sw.js`, research R2): `install`, `activate` and `fetch` exactly as
  the table says. `lang` comes from `new URL(location).searchParams`, limited
  to `/^[a-z]{2}$/`, default `de`. A header comment: network only; the only
  cached responses are the two texts, never a page (FR-005).
- [X] T021 [US1] `public/app.js`, steps 1 and 2 of client.md (registration and
  install hint). Plain script, no imports, no text. A header comment names
  research R16 and that every word shown comes from the page's markup.

**Checkpoint**: Chrome offers installing, the installed app opens on `/me`,
offline shows the notice, and the sign-in lasts 180 days after the last visit.

---

## Phase 4: User Story 2 - Get a notification for new Rynke (Priority: P2)

**Goal**: a rise of a rider's Training or Team Rynke from a ride or attendance
sends one empty push per device; nothing else does
([contracts/push-delivery.md](contracts/push-delivery.md), research R3–R6).

**Independent test**: T022–T026 pass; quickstart §2 step 5 in Chrome.

### Tests for User Story 2

- [X] T022 [P] [US2] New `test/unit/vapid.test.ts` (failing), with the test key
  from `env.PUSH_VAPID_KEY`:
  - `vapidPublicKey(env)` is 65 bytes base64url-decoded, starting with `0x04`,
    then the JWK's `x` and `y`;
  - `vapidAuthorization("https://fcm.googleapis.com", env, NOW)` is
    `vapid t=<jwt>, k=<public key>`. The JWT header is
    `{"typ":"JWT","alg":"ES256"}`; the claims are `aud` the origin,
    `exp` `NOW + 43200` and `sub` `env.PUSH_SUBJECT`; the signature verifies with
    `crypto.subtle.verify` (ECDSA P-256 SHA-256) against the imported public
    key;
  - a second call for the same origin within the hour returns the same token;
    one for another origin a different one.
- [X] T023 [P] [US2] New `test/unit/push-send.test.ts` (failing), with
  `installPushService` from T004:
  - `sendPush(endpoint, ctx)` posts to exactly the endpoint with an empty body
    and the headers `TTL: 86400`, `Urgency: normal`, `Topic: new-rynke`,
    `Authorization: vapid t=…, k=…`, and no `Content-Encoding`;
  - 200, 201 and 202 → `sent`; 404 and 410 → `gone`; 429, 500, 503 and a
    throwing `fetch` → `transient`; 400, 401, 403 and 413 → `refused`;
  - with `console` spied on, no logged line contains the endpoint path or the
    JWT.
- [X] T024 [P] [US2] New `test/integration/notify-on-rise.test.ts` (failing):
  - Every row of push-delivery.md's case table, as a `rose` assertion on
    `applyAndEvaluate` or `applyTeamEventChange` with synthetic rides built
    with `test/support/rynke.ts`. The overlap and elevation cases reuse the
    figures of `test/integration/rynke-apply.test.ts`.
  - `activityEvent` with a mocked Strava ride that earns Rynke, for a rider
    with two seeded subscriptions and another rider with one: `ctx.queue.sent`
    holds exactly two `send-notification` messages, with the rider's ID and
    each subscription ID. Delivering the same event again sends none. A ride
    earning 0 sends none. A delete sends none.
  - `importPage`, `rereadPage` and `evaluateRider` that raise a total send no
    `send-notification` (FR-016).
  - `teamEventChange` adding attendance for two riders with subscriptions sends
    one per device, besides the two `evaluate-rider` messages.
  - A `ctx.queue` whose `sendBatch` throws: `activityEvent` still returns `ok`
    and the ride's results and balance are stored (FR-018).
- [X] T025 [P] [US2] New `test/integration/send-notification.test.ts`
  (failing), through `handleQueue` with `createMessageBatch`:
  - a row of the message's rider: one push to its endpoint, message acked;
  - the row is gone, or belongs to another rider: no push, acked (FR-020);
  - `410` and `404`: the row is deleted, acked (FR-021);
  - a stored endpoint whose host isn't allowed (inserted with SQL): deleted, no
    push;
  - `503` on attempts 1–3: retried with 60, 120 and 240 s; on attempt 4:
    acked, the row kept; `failed_work` stays empty;
  - `403`: acked, row kept, nothing in `failed_work`;
  - a `send-notification` whose handler throws on attempt `MAX_ATTEMPTS`:
    acked without a `failed_work` row.
- [X] T026 [P] [US2] In `test/unit/messages.test.ts` (failing):
  `send-notification` with `athleteId` and `subscriptionId` parses and
  serializes in that key order; a missing, zero, negative or fractional
  `subscriptionId` gives `null`.

### Implementation for User Story 2

- [X] T027 [P] [US2] New `src/push/vapid.ts` (research R4):
  - `vapidPublicKey(env: Pick<Env, "PUSH_VAPID_KEY">): string`: base64url of
    `0x04‖x‖y` from the JWK, without Web Crypto.
  - `vapidAuthorization(origin, env, now): Promise<string>`: imports the JWK
    once per key (module map, like `src/crypto/sign.ts`), signs the ES256 JWT,
    and keeps tokens per origin in a module map while `exp - now > 3600`.
  - Base64url helpers stay local to the file.
  T022 passes.
- [X] T028 [US2] New `src/push/send.ts`: `type PushOutcome = "sent" | "gone" |
  "transient" | "refused"` and `sendPush(endpoint: string, ctx: Ctx):
  Promise<PushOutcome>` with the request and response mapping of
  push-delivery.md. It logs nothing itself. T023 passes.
- [X] T029 [US2] Rise detection in `src/rynke/apply.ts` (research R5):
  - Split `riderWrites` into `evaluateState(state, rules, window)` returning
    `{ evaluation, balance }`, and the writes built from it, so the balance is
    computed once.
  - `rose(before: Balance, after: Balance)`: `after.trainingRynke >
    before.trainingRynke || after.teamRynke > before.teamRynke`.
  - `applyAndEvaluate`: compute `before` from the state just read, before the
    `switch` changes `activities`; return `{ rose }`. `evaluateChange` passes it
    on.
  - `applyTeamEventChange`: per affected rider, `before` from the state before
    `edit`; return `rose: number[]` (sorted) with `eventId` and `affected`.
    `create-event` returns `rose: []`.
  - Update the module's header comment: callers decide whether a rise
    notifies (contracts/push-delivery.md).
- [X] T030 [US2] `src/work/messages.ts`: `SendNotificationMessage` (data-model.md
  "Types in code") in `WorkMessage`, `parseWorkMessage` and
  `serializeWorkMessage`. T026 passes.
- [X] T031 [US2] New `src/work/send-notification.ts`:
  - `NOTIFY_MAX_ATTEMPTS = 4`, with a comment: about 7 minutes with the
    consumer's backoff, then the news is stale (research R6).
  - `notifyRiders(ctx, athleteIds: number[]): Promise<void>`: one read with
    `subscriptionIdsOfRiders`, then `sendAll` with one message per row. It
    catches every error and logs `console.error` with the error name and the
    rider count only (FR-018).
  - `sendNotification: Handler<SendNotificationMessage>`: the step table of
    push-delivery.md, using `subscriptionEndpoint`, `isPushEndpoint`,
    `sendPush`, `deleteSubscriptionById` and the handler's `attempt.attempts`.
    `refused` and giving up log the status or outcome and the endpoint's host
    only.
  - `src/index.ts`: register `"send-notification": sendNotification`.
- [X] T032 [US2] Callers (contracts/push-delivery.md "Which changes notify"):
  - `src/work/activity-event.ts`: after each `evaluateChange`, `if (rose) await
    notifyRiders(ctx, [rider.athleteId])`. Add a line to the header comment.
  - `src/rynke/apply.ts`, `teamEventChange`: after `sendAll` of the
    `evaluate-rider` messages, `await notifyRiders(ctx, result.rose)`.
  - `activity-page.ts`, `evaluate-rider.ts` and `auth.ts` stay as they are and
    ignore the result.
  T024 passes.
- [X] T033 [US2] `src/work/consumer.ts`, `transientFailure`: on the last attempt
  a `send-notification` is logged and acked, never written to `failed_work`,
  with a comment naming FR-018 (defence in depth: the handler stops at 4).
  T025 passes.
- [X] T034 [US2] `public/sw.js`: the `push` and `notificationclick` handlers of
  push-delivery.md "What the device shows". The text is read with
  `caches.match("/notification-text?lang=" + lang)`, then `fetch` of the same
  URL, and on any failure `{ title: "RynkePoints" }` (the app name is the same
  in every language, FR-032). `event.waitUntil` wraps both handlers. Click:
  `clients.matchAll({ type: "window", includeUncontrolled: true })`, focus and
  `navigate("/me")` the first one, else `clients.openWindow("/me")` (FR-019).

**Checkpoint**: a ride that earns Rynke queues one empty push per device;
replays, imports, re-reads and rule changes queue none.

---

## Phase 5: User Story 3 - Turn notifications on and off (Priority: P2)

**Goal**: the rider page shows this device's state and turns notifications on
or off; signing out ends them on that device
([contracts/http-routes.md](contracts/http-routes.md),
[contracts/client.md](contracts/client.md), research R8, R9).

**Independent test**: T035–T037 pass; quickstart §2 steps 4 and 6 in Chrome.

### Tests for User Story 3

- [X] T035 [P] [US3] New `test/integration/notifications-route.test.ts`
  (failing), `POST /me/notifications` with a `FormData` body (FR-010–FR-012,
  SC-005):
  - `on` stores the endpoint for the session's rider and answers `{"on":true}`;
    `check` then answers `{"on":true}`; `off` deletes it and answers
    `{"on":false}`, leaving the rider's other device;
  - `check` for a device registered to another rider answers `{"on":false}`;
    `on` there moves it to the session's rider;
  - the 11th `on` leaves 10 rows, without the oldest;
  - 403 without or with a foreign `Origin`; 401 without a session; 400 for an
    unknown `action`, a missing endpoint, `http:`, `https://example.com/x` and
    1025 characters, with nothing written;
  - every response has `Cache-Control: no-store`, and the bodies contain no
    rider name.
- [X] T036 [P] [US3] In `test/integration/disconnect.test.ts`,
  `describe("POST /logout")` (failing): with `push_endpoint` of the rider's
  device, that row is deleted and the cookie cleared; the rider's other device
  and another rider's row with the same host stay; an endpoint of another rider
  deletes nothing; without the field, or with an empty one, it only signs out
  (FR-013, research R9).
- [X] T037 [P] [US3] In `test/integration/pwa-pages.test.ts` and
  `test/unit/catalogs.test.ts` (failing):
  - `/me` contains `<section id="notifications" data-push-key="<vapidPublicKey>"
    hidden>` between the rules section and the ride table, with the heading,
    the explanation, the six `data-state` paragraphs and the two `data-action`
    buttons in German, all `hidden`;
  - the sign-out form contains
    `<input type="hidden" name="push_endpoint" value="">`; adapt the form regex
    in `test/integration/me-status.test.ts`;
  - `/` has no `#notifications`;
  - `CONTRACT_IDS` gains the ten `notifications.*` keys.

### Implementation for User Story 3

- [X] T038 [P] [US3] Catalog keys `notifications.heading`, `.explain`, `.on`,
  `.off`, `.turnOn`, `.turnOff`, `.blocked`, `.needsHomeScreen`,
  `.unsupported` and `.failed` in `src/i18n/messages/de.ts` and `en.ts`, as in
  contracts/messages.md.
- [X] T039 [US3] New `src/http/notifications.ts`, `handleNotifications(request,
  ctx)`: the checks and actions of http-routes.md, in that order, using
  `isSameOrigin`, `readSession`, `isPushEndpoint` and the Phase 2 statements
  (`on` runs `upsertSubscription` and `trimSubscriptions` in one batch).
  Responses are `Response.json` or empty with the status, all with
  `Cache-Control: no-store`. `src/http/router.ts`: `POST /me/notifications`.
  T035 passes.
- [X] T040 [US3] `src/http/me.ts`:
  - `renderNotifications(i18n, pushKey)` producing client.md's section, placed
    after `renderRules` and before `renderRides`, with
    `vapidPublicKey(ctx.env)`;
  - the sign-out form gains the hidden `push_endpoint` input;
  - `handleLogout(request, ctx, i18n)` is async: after the origin check, read
    `push_endpoint` from the form; if it is a non-empty string of at most
    `MAX_ENDPOINT_LENGTH` and the session is valid, `deleteSubscription(endpoint,
    athleteId)`; then redirect and clear as before. Update the call in
    `src/http/router.ts`.
  - `src/http/html.ts` `STYLE`: `#notifications button{margin-right:.5rem}`.
  T036 and T037 pass.
- [X] T041 [US3] `public/app.js`, steps 3 and 4 of client.md with research R8's
  state table: show exactly one `data-state` paragraph and at most one button;
  `on` asks permission inside the click handler, subscribes with the decoded
  `data-push-key`, posts `action=on`; `off` unsubscribes and posts
  `action=off`; a failed `fetch` or a non-200 shows `failed`. Every
  `fetch` uses `credentials: "same-origin"`.

**Checkpoint**: a rider turns notifications on and off per device, and signing
out ends them there.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T042 [P] Privacy text (FR-030, research R14), test first in
  `test/integration/landing.test.ts` (failing): `/` shows `landing.notifications`
  in German and English after `landing.cookies`, and `CONSENT_VERSION` is still
  1. Then add `landing.notifications` to both catalogs and `CONTRACT_IDS`,
  render `<p>${i18n.t("landing.notifications")}</p>` after `landing.cookies`
  in `src/http/landing.ts`, and add a sentence to the comment in
  `src/consent.ts`: 010 named the push service without raising the version,
  because notifications need no Strava scope or request and show nothing to
  anyone but the rider (010 research R14; constitution v2.1.0).
- [X] T043 [P] Guards:
  - `test/unit/no-secret-logging.test.ts`: add the test key's `d` to `SECRETS`
    and a case where a `send-notification` gets `403`, `503` on its last
    attempt and a throwing `fetch`; no logged line contains a secret, the
    endpoint or `vapid t=`.
  - `test/integration/no-hardcoded-copy.test.ts`: include `/offline` in the
    checked pages (via `RIDER_PAGES` in `test/support/pages.ts` if that is
    where the list lives).
  - `test/unit/dev-guard.test.ts` stays green.
- [X] T044 [P] `README.md`: the stored data list gains the device's push
  address (deleted on turning off, signing out or leaving); the secrets list
  gains `PUSH_VAPID_KEY` with quickstart §3's command and the warning that a new
  key ends every device's notifications; the sign-in lasts 180 days after the
  last visit.
- [X] T045 [P] `specs/001-strava-connect-webhook/data-model.md`: one line that
  010's [data-model.md](data-model.md) adds `push_subscriptions` and changes the
  session lifetime to 180 days.
- [X] T046 Run `pnpm lint`, `pnpm typecheck` and `pnpm test`. All pass.

---

## Dependencies & Execution Order

- T001 → T002 → Phase 2 (T003–T007) → US1, US2 and US3.
- US1 (T008–T021) needs only T002 and could start right after it; it is listed
  first because it is the MVP.
- US2 (T022–T034) needs Phase 2. T027 → T028; T029 → T032; T030 → T031 → T032,
  T033. T034 needs T020's `sw.js`.
- US3 (T035–T041) needs Phase 2 and T027's `vapidPublicKey`. T041 needs T021's
  `app.js`.
- T042–T045 can be done at any time after the catalogs they touch exist. T046
  last.

## Parallel Example

```text
Phase 2:  T003 and T004 together; then T005, T006 and T007 in order.
US1:      T008–T012 together; T013, T014 and T015 alongside; then T016–T021.
US2:      T022–T026 together; T027 alongside T029 and T030.
US3:      T035–T037 together; T038 alongside T039.
Polish:   T042–T045 together.
```

## Implementation Strategy

There is one PR (plan "Delivery"), built in story order. After Phase 3 the
installable app and the longer sign-in work on their own. After Phases 4 and 5 a
rider who turns notifications on gets one per rise.

Before the PR is merged into `main`, the user sets `PUSH_VAPID_KEY` with
quickstart §3; the deploy fails without it. That, the `pnpm dev` walk-through in
quickstart §2 and the checks on real phones after release (§4) are manual and
get no task.
