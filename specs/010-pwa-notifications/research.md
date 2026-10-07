# Research: Installable App and Notifications for New Rynke

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-10-07

## R1. Making the site installable

**Decision**: add a static web app manifest at `public/manifest.webmanifest`
and icons in `public/icons/`, and link both from the layout's `<head>`.
`wrangler.jsonc` already serves `public/` as static assets, so the Worker never
sees these requests. Manifest fields:

- `id` and `scope`: `/`.
- `start_url`: `/me`. Signed-out visitors are sent on to `/` as today
  (FR-002).
- `display`: `standalone`.
- `name`, `short_name` and `description`: all "RynkePoints" (FR-032).
- `theme_color`: `#fc5200`, the existing accent; `background_color`: `#ffffff`.
- `icons`: 192 and 512 px PNGs and a 512 px maskable PNG.

The `<head>` gains `<link rel="manifest">`, `<link rel="apple-touch-icon">`
(180 px; iOS doesn't use the manifest icons) and `<meta name="theme-color">`.

**Rationale**: these are all a browser needs to offer installing, together with
a registered service worker that has a `fetch` handler (R2). The name is
not translated (FR-032), so the manifest needs no catalog. A static file costs
nothing and can't leak anything.

**Icons**: one hand-made SVG mark (`public/icons/icon.svg`), not resembling
Strava's logo. The PNGs are rendered from it once with any SVG renderer
(e.g. `rsvg-convert`) and committed. They have no build step.

**Alternatives considered**: a Worker-rendered manifest with translated text
was rejected, because FR-032 keeps the name the same in every language. A
native or store app is out of scope.

## R2. Service worker: network only, with an offline notice

**Decision**: `public/sw.js` with four handlers:

- `install` caches exactly two URLs in a cache named after the language:
  `/offline?lang=<l>` and `/notification-text?lang=<l>`.
- `activate` deletes the other `rp-` caches and claims clients.
- `fetch` handles only navigations: `fetch(request)`, and only if that throws
  (no connection) the cached `/offline?lang=<l>`. Other requests aren't
  intercepted.
- `push` and `notificationclick`, as in R3 and R6.

The page registers the worker as `/sw.js?lang=<page language>`. When the rider
switches language, the script URL changes. The browser then installs the
worker again, and that fetches both texts in the new language. Push
subscriptions belong to the registration, not the script, so they survive the
update.

**Rationale**:
- FR-005: no rider page or data is ever put in a cache. A page's own HTTP cache
  entries are never used as an offline fallback, because the fallback is
  always the one notice.
- The notice comes from the server, rendered from the catalogs with the normal
  layout (FR-031). So the worker holds no text.
- The language in the script URL makes "the language the device last showed
  RynkePoints in" (spec, edge cases) automatic, without storing it anywhere
  else.

**Alternatives considered**:
- Caching pages for offline use: excluded by the spec.
- A Worker-rendered `sw.js` with the texts inlined: it works, but static assets
  keep the worker cacheable and the router unchanged.
- A notice in both languages: FR-005 asks for the rider's language.

## R3. Pushes without content

**Decision**: a push request has **no body**. The service worker's `push`
handler always shows the same notification:

- the title `app.name` ("RynkePoints") and the body "Neue Rynke – tippe zum
  Ansehen", both from the cached `/notification-text?lang=<l>` JSON;
- if that cache entry is missing, from the network, and failing that the title
  alone;
- `tag: "new-rynke"` and `renotify: true`, so a newer notification replaces an
  unread one and still alerts (FR-017);
- an icon, a badge and `data: { url: "/me" }`.

**Rationale**:
- FR-015 already rules out any rider data in the notification, and the text
  only depends on the language, which the device knows (R2). An empty push says
  everything needed.
- No payload means no RFC 8291 encryption (ECDH, HKDF, AES-GCM) and no
  per-device public keys to store (R7). The push service sees nothing but the
  delivery itself (FR-030).
- Every push shows a notification, which Chrome and Safari require
  (`userVisibleOnly`); a worker that showed nothing would lose its permission.

**Risk**: the Push API standard allows pushes without data, and Chrome and
Firefox deliver them. For Safari/iOS the plan relies on the same standard
behaviour. If the device check after release (quickstart §4) shows iOS
dropping empty pushes, the fallback is to encrypt a constant payload such as
`{}`. That is about 60 lines of Web Crypto, still with no dependency. It would
also mean storing each device's `p256dh` and `auth` keys (two more columns).

**Alternatives considered**:
- An encrypted payload carrying the text, with the language stored per
  registration: more code and more stored data for the same visible result.
- Declarative Web Push (Safari 18.4+): Safari only, and it still needs a
  payload.

## R4. VAPID with Web Crypto, one secret

**Decision**:
- **Key**: the secret `PUSH_VAPID_KEY` is an EC P-256 private key as JWK JSON
  (`kty`, `crv`, `x`, `y`, `d`).
- **Signature**: `src/push/vapid.ts` imports the key with
  `crypto.subtle.importKey("jwk", …, { name: "ECDSA", namedCurve: "P-256" })`
  and signs an ES256 JWT. Web Crypto's raw `r‖s` output is exactly JWS's ES256
  format. The claims are:
  - `aud`: the endpoint's origin;
  - `exp`: now + 12 h;
  - `sub`: the new plain var `PUSH_SUBJECT` = `https://trhh-rynke-coins.link`.
- **Header**: `Authorization: vapid t=<jwt>, k=<public key>`.
- **Public key**: base64url of `0x04‖x‖y`, derived from the same JWK. The rider
  page sends it to the browser as the subscription's `applicationServerKey`.
- **Tokens**: one per push-service origin and invocation, kept in a small map.

The user creates the key once, with a one-line Node command from the README
piped into `wrangler secret put PUSH_VAPID_KEY` (quickstart §3). Tests and
`pnpm dev` use committed synthetic keys (`vitest.config.ts`, `dev/fake.env`),
like the other fake-mode secrets.

**Rationale**:
- One secret, matching the spec's assumption, because the public key is
  derived.
- Apple rejects a malformed `sub`. The site's own https URL needs no personal
  e-mail address in a public repo.

**Caution**: changing the key invalidates every existing subscription.
Browsers bind them to the key. The README says so. Rotating means riders turn
notifications on again.

**Alternatives considered**: the `web-push` npm package depends on Node's
`crypto` and `https` and needs a written justification (Principle IV) for what
is about 40 lines here. A separate public-key var would just be a second value
to keep in sync.

## R5. Detecting new Rynke

**Decision**:
- **Comparison**: `applyAndEvaluate` (and `applyTeamEventChange` for each
  affected rider) computes the balance of the rider's state **before** the
  change under the **current** rules and window, and the balance after it, as
  today. A rider has risen if `after.trainingRynke > before.trainingRynke` or
  `after.teamRynke > before.teamRynke`. The functions return this (`rose:
  boolean`, or the list of risen riders). Storage is unchanged.
- **Who notifies**: only callers whose change counts as new Rynke act on it:
  - `activityEvent`, after its `evaluateChange`;
  - `teamEventChange`, for the organiser pages when they come;
  - future organiser corrections (feature 003, Story 6) must follow the same
    pattern.
- **Who doesn't**: `import-page` and `reread-page` (through
  `activity-page.ts`), `evaluate-rider` (the rule-change and catch-up
  recalculation) and the private-rides removal in `auth.ts` ignore it (FR-016).

**Rationale**:
- Comparing against the state just read, under the same rules, makes the
  notification depend only on what this change did:
  - a replay or duplicate leaves `before == after` (FR-017, Story 2 scenario
    4);
  - the 78 → 80 km overlap gives +1 once (scenario 3);
  - a 9 km ride over the next elevation step raises the total (scenario 5);
  - a ride processed while a rule change is pending is compared under the new
    rules on both sides, so the rule change itself never counts (edge case
    "ride evaluated during a recalculation");
  - a passed deadline yields no rise because the ride earns nothing.
- Comparing with the stored balance instead would count a pending rule change
  or a stale balance as new Rynke.
- The extra evaluation is one call of the existing pure function on data
  already in memory (Principle IV).

**Alternatives considered**:
- A "sent notification" table keyed by change: not needed, because the
  evaluation is already idempotent. The spec lists it as optional.
- Notifying from `evaluate-rider`: it carries both rule changes and catch-ups,
  which must not notify.

## R6. Sending through the queue, with a short retry

**Decision**: on a rise, the caller reads the rider's subscription IDs and
sends one `{ kind: "send-notification", athleteId, subscriptionId }` message
per device (`sendAll`). A failure to enqueue is logged and swallowed. The
evaluation has already been stored, and FR-018 says a notification never fails
it. The handler:

1. reads the endpoint for `(subscriptionId, athleteId)`. If it is gone or now
   belongs to another rider, it acks.
2. Checks the endpoint host against the allow-list (R7). Otherwise it deletes
   the row and acks.
3. `POST`s with no body and the headers `TTL: 86400`, `Urgency: normal`,
   `Topic: new-rynke` and the VAPID `Authorization`.
4. Classifies the response:
   - 2xx: ok.
   - 404 or 410: the device is gone. Delete the row and ack (FR-021).
   - 429, 5xx or a network error: transient. Retry with the consumer's backoff
     (60, 120, 240 s) up to `NOTIFY_MAX_ATTEMPTS = 4`, then log and ack.
   - Other 4xx (400, 401, 403, 413): log the status and the push host, never
     the endpoint, and ack. These are configuration errors that a retry can't
     fix.

`send-notification` messages never go to `failed_work`, so the daily requeue
can't revive them (FR-018: not indefinitely).

**Rationale**:
- One message per device retries only the failed device, so the others never
  get a second notification (SC-004).
- `Topic` lets the push service replace an undelivered older push. With the
  `tag` (R3), FR-017 holds on and off the device.
- The TTL of one day lets the push service deliver to a phone that was off
  overnight.
- Four attempts span about 7 minutes. That keeps SC-001's 5 minutes in the
  normal case and gives up before the news is stale.
- The serial consumer (`max_concurrency: 1`) is fine: a push takes
  milliseconds and makes no Strava request, so it needs no budget check.

**Alternatives considered**:
- Sending inline in the activity-event handler: no retry, and push latency
  inside Strava-budgeted work.
- One message per rider: a retry would notify the devices that already
  succeeded again.

## R7. What a registration stores

**Decision**: `push_subscriptions` has four columns:

- `subscription_id`: integer key;
- `endpoint`: unique, at most 1024 characters;
- `athlete_id`: references `riders`, cascading on delete;
- `created_at`.

The endpoint must be `https:` with a host in a fixed allow-list:

- `fcm.googleapis.com` (Chrome, Android, Samsung Internet, Opera);
- `updates.push.services.mozilla.com` (Firefox);
- `web.push.apple.com` (Safari);
- hosts ending in `.notify.windows.com` (Edge).

At most 10 per rider: turning on an 11th device deletes that rider's oldest.

Turning on is an upsert on `endpoint`. If the device was registered to another
rider, it moves to the one turning it on now (spec edge case "two riders on one
device").

**Rationale**:
- No payload (R3) means no device keys.
- The language stays on the device (R2).
- The endpoint is the only thing needed to reach the device (FR-014).
- The allow-list stops the Worker from posting to arbitrary URLs a client
  submitted. The cap keeps a misbehaving client from growing the table.

**Alternatives considered**:
- Storing the full `PushSubscription` JSON: unnecessary data.
- A per-device cookie or ID: the endpoint already is one.

## R8. Turning notifications on and off

**Decision**: the rider page renders a `section#notifications` with the
heading, the explanation, one paragraph per state and the two buttons, all
`hidden`, plus `data-push-key="<VAPID public key>"`. `public/app.js` shows the
state:

| Condition (checked in order) | State shown |
|---|---|
| no `serviceWorker`, `PushManager` or `Notification` | `unsupported` |
| `navigator.standalone === false` (iOS/iPadOS browser tab) | `needsHomeScreen` |
| `Notification.permission === "denied"` | `blocked` |
| no `pushManager.getSubscription()`, or the server's `check` says no | `off` + turn-on button |
| otherwise | `on` + turn-off button |

- **Turn on**: `Notification.requestPermission()` inside the click handler,
  then `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`,
  then `POST /me/notifications action=on endpoint=…`. If permission is denied,
  the page shows `blocked`, and the POST isn't sent, so nothing is stored
  (Story 3 scenario 3). A network failure shows `failed`.
- **Turn off**: `subscription.unsubscribe()`, then `action=off`.
- **Check**: the server's view decides, because sign-out (R9), a "gone" report
  or another rider taking the device can end a registration while the browser
  still holds the subscription. Turning on again reuses that subscription
  (same endpoint).
- **Without JavaScript**, the section stays hidden and the page works as
  before (scenario 6).

**Rationale**:
- The permission prompt appears only after a tap (FR-010, and Safari requires
  it).
- All text stays in server-rendered markup from the catalogs.
- `navigator.standalone` is defined only by iOS Safari, so no user-agent
  sniffing is needed.

## R9. Signing out ends notifications on that device

**Decision**: the sign-out form gets a hidden `push_endpoint` input, which
`app.js` fills when the browser has a subscription. `POST /logout` deletes the
registration with that endpoint **and** the session's rider, then clears the
cookie as before. A missing or unknown endpoint just signs out.

**Rationale**:
- Only the device's browser knows its endpoint. Without JavaScript there is no
  subscription, so nothing needs deleting.
- Binding the delete to the session's rider keeps one rider from deleting
  another's device.
- A sign-in that ends by itself deletes nothing (FR-013).

**Alternatives considered**: storing a session ID with each registration means
a new cookie format, for the same result.

## R10. Sign-in for 180 days after the last use

**Decision**: `SESSION_MAX_AGE` becomes 180 days. `verifySignedValue` also
returns the expiry it checked (`readSigned` passes it on). In the router, after
a GET or HEAD response, if the request had a valid session:

- **Condition**: its expiry is more than one day older than a fresh one would
  be, and the response sets no `rp_session` of its own.
- **Action**: a fresh session cookie is appended.

Sign-out still clears the cookie; leaving still deletes the rider, and the
cookie of a deleted rider finds no rider.

**Rationale**:
- FR-007: every page view extends the sign-in. Renewing at most once a day
  avoids a `Set-Cookie` on every response, and a day is nothing against 180.
- Cookies issued by the old 30-day code get the 180 days on their next visit.

**Alternatives considered**: a server-side session table with last-used
times would mean a D1 write per page view and a new table for the same effect.

## R11. Install hints

**Decision**: `/` and `/me` render a hidden `aside#install`, which `app.js`
shows. It holds:

- a button "Als App installieren": shown after the browser fires
  `beforeinstallprompt` (Chrome and Edge on Android and desktop). It calls
  `prompt()`.
- the iPhone explanation: shown when `navigator.standalone === false`.
- a dismiss button: it stores `rp-install-dismissed` in `localStorage` and
  hides the hint for good on that device.

Nothing shows when `matchMedia("(display-mode: standalone)")` matches, or when
`navigator.standalone` is true (FR-004, Story 1 scenario 5).

**Rationale**:
- Android shows its own offer too, but not reliably. The button is the "MAY"
  of FR-004 and takes a few lines.
- `localStorage` keeps a UI choice on the device. It is no rider data and
  nothing is sent to the server.

## R12. Status bar and notch

**Decision**: don't opt into `viewport-fit=cover`, and don't set
`apple-mobile-web-app-status-bar-style`. The browser then keeps the page inside
the safe area in standalone mode on iOS and Android (FR-041).

**Rationale**: the defaults already satisfy FR-041. Opting into edge-to-edge
would need `env(safe-area-inset-*)` padding everywhere for no visible gain.

## R13. Signing in from the installed app

**Decision**: nothing to build beyond R1. The OAuth start (`/connect`), Strava
and the callback (`/auth/callback`) are unchanged:

- the callback is same-origin and inside `scope: "/"`;
- the Android installed app shares Chrome's cookies, so the callback's
  `Set-Cookie` reaches it;
- iOS opens out-of-scope pages (Strava's approval screen) in an in-app browser
  and hands navigations back into scope to the app.

FR-003 is checked on real phones after release (quickstart §4).

**Rationale**: the code can't influence how the platforms move between the app
window and Strava's pages, and unit tests can't observe it. Where a platform
keeps the rider in the in-app browser, the rider can still sign in there and
reopen the app (spec edge case: "may be separate").

## R14. Privacy text and consent version

**Decision**: one new catalog paragraph, `landing.notifications`, on `/` next
to `landing.cookies`. It says:

- notifications are optional, per device, and say only that there are new
  Rynke;
- they pass through the device maker's push service (Google, Apple, Mozilla,
  Microsoft);
- per device, only the address that service gives it is stored;
- that address is deleted when the rider turns them off, signs out or leaves.

The rider page's notification section repeats the short version
(`notifications.explain`). `CONSENT_VERSION` stays 1.

**Rationale**: constitution v2.1.0 says consent grows with a new Strava scope,
a new kind of Strava request, or anything newly shown to someone else. None of
these happens; turning notifications on is its own optional, per-device choice
with the browser's permission prompt (FR-030). The sign-in cookie is already
named as necessary, and the text states no duration, so FR-007 changes no text.

## R15. How the feature is tested

**Decision**:
- **Server side**: tested as usual. The push service is reached only through
  the deny-all `fetch` spy from `test/setup.ts`. `test/support/push.ts`
  installs a mock that answers per endpoint (201, 410, 500, …) and records the
  requests, so tests assert the headers, the empty body and the JWT.
- **VAPID**: tested by verifying the JWT with the derived public key.
- **Manifest**: imported as `?raw` and its fields asserted.
- **Scripts**: `sw.js` and `app.js` aren't unit-tested: workerd has no DOM,
  service worker or push globals, and a browser test runner would be a new
  dependency. They are kept to wiring around server-tested contracts and are
  checked in the local walk-through (quickstart §2) and on phones after
  release.
- **`pnpm dev`**: the fake Strava sends a ride that earns Rynke, and the real
  push goes to the developer's own browser through its push service. That is no
  Strava or production resource (FR-050).

## R16. Client JavaScript

**Decision**: two hand-written files with no imports, no build step and no
text:

- `public/app.js`: about 120 lines, loaded with `defer` on every page;
- `public/sw.js`: about 60 lines.

**Rationale**: browsers only offer installing, notification permission and
push to a page that runs script: service worker registration, `subscribe()`,
`requestPermission()`, `beforeinstallprompt`. The rest of the site stays
server-rendered with no client logic. This is not a dependency under Principle
IV, so it needs no exception.
