# Quickstart: Installable App and Notifications for New Rynke

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## 1. Automated checks

```bash
pnpm install
pnpm lint && pnpm typecheck && pnpm test
```

These tests prove the feature. They use synthetic riders, synthetic push
endpoints on the allowed hosts, a test VAPID key and the mocked `fetch`. No
push service and no Strava are contacted (FR-050).

| Test file | Proves |
|---|---|
| `test/unit/vapid.test.ts` (new) | the JWK imports; the public key is `0x04‖x‖y`; the JWT has ES256, `aud` = the endpoint origin, `exp` ≤ 24 h, `sub` = `PUSH_SUBJECT`, and verifies with the public key |
| `test/unit/push-send.test.ts` (new) | empty body; `TTL`, `Urgency`, `Topic`, `Authorization` headers; 201 → `sent`, 410/404 → `gone`, 429/503/throw → `transient`, 403 → `refused`; nothing logged contains the endpoint |
| `test/unit/session.test.ts` | the session cookie has `Max-Age=15552000`; the expiry is read back with the value |
| `test/integration/session-renewal.test.ts` (new) | GET `/me` with a 10-day-old cookie renews it to 180 days; a cookie renewed within the day isn't renewed again; an expired cookie isn't renewed; logout still clears (FR-007) |
| `test/integration/notify-on-rise.test.ts` (new) | every row of [contracts/push-delivery.md](contracts/push-delivery.md)'s case table; the activity-event handler enqueues one `send-notification` per device on a rise and none otherwise; import, re-read and `evaluate-rider` enqueue none; an enqueue failure leaves the stored results and returns `ok` (FR-015–FR-018, SC-004) |
| `test/integration/send-notification.test.ts` (new) | sends to the right endpoint only; `gone` deletes the row; `transient` retries up to attempt 4, then acks; never in `failed_work`; a row moved to another rider is not sent; a disallowed host is deleted unsent (FR-018, FR-020, FR-021) |
| `test/integration/notifications-route.test.ts` (new) | `on`, `off` and `check` for the session's rider; 403 cross-origin; 401 without a session; 400 for a bad action, `http:`, a foreign host or an endpoint too long; the 11th device trims the oldest; a device moves to the rider who turns it on; `off` leaves other devices (FR-010–FR-012, SC-005) |
| `test/integration/logout.test.ts` (new, or in `me-status`) | logout with `push_endpoint` deletes that device of that rider only; without it, it just signs out (FR-013) |
| `test/integration/delete-rider.test.ts` | leaving deletes every `push_subscriptions` row (FR-013, SC-005) |
| `test/integration/schema-minimisation.test.ts` | `push_subscriptions` has exactly the four documented columns |
| `test/integration/pwa-pages.test.ts` (new) | every page's head links the manifest, icons and `app.js`, without `viewport-fit=cover`; `/` and `/me` have the hidden install hint; `/me` has the hidden notification section with `data-push-key` and the hidden `push_endpoint` input; `/offline` and `/notification-text` in `de`, `en` and by `lang`, with no rider data even with a session cookie, and no D1 access (FR-001–FR-005, FR-011, FR-041, SC-007, SC-008) |
| `test/unit/manifest.test.ts` (new) | the manifest's name, short name and description are "RynkePoints"; `start_url` `/me`, `scope` `/`, `display` `standalone`; 192, 512 and maskable icons listed (FR-001, FR-002, FR-032) |
| `test/unit/catalogs.test.ts` | all new keys are in both catalogs; `push.body` has no placeholder |
| `test/integration/landing.test.ts` | `/` shows `landing.notifications`; `CONSENT_VERSION` is still 1 (FR-030) |
| `test/integration/no-hardcoded-copy.test.ts` | the new markup takes all its text from catalogs |
| `test/unit/messages.test.ts` | `send-notification` parses and serializes; bad IDs are rejected |

## 2. Local walk-through (`pnpm dev`)

Use Chrome or Edge on the computer. `localhost` counts as a secure context, so
service workers and push work there. The push really goes through the browser's
push service, to your own browser only. `dev/fake.env` holds a synthetic VAPID
key.

1. Run `pnpm dev`, open `http://localhost:8789/_dev/`, connect a sample rider
   and open their page.
2. **Install (Story 1)**:
   - DevTools → Application → Manifest shows "RynkePoints", the icons and no
     errors.
   - The browser offers installing, and the page's own install button appears.
   - Installing opens `/me` in its own window. The hint isn't shown there.
3. **Offline**: DevTools → Network → Offline, then reload. The offline notice
   shows in the page's language. Switch the language while online, go offline
   again, and the notice follows. Cache Storage holds exactly two entries.
4. **On and off (Story 3)**:
   - Press "Benachrichtigungen einschalten" and allow it. The page says on.
     Reload, and it still says on.
   - Block the permission in the site settings and reload: the page says
     blocked.
5. **Notification (Story 2)**:
   - In `/_dev/`, send a ride that earns Rynke. One notification shows, "Neue
     Rynke – tippe zum Ansehen", without figures. Clicking it opens `/me`.
   - Send a too-slow ride: no notification.
   - Send the first ride again: no notification.
6. **Sign out** with notifications on, sign in again: the page says off. Send a
   ride that earns Rynke: no notification.
7. **iPhone texts**: in DevTools device mode with an iPhone profile, the
   `navigator.standalone` checks don't apply (Chrome doesn't define it). Check
   them on a real iPhone after release (§4).
8. At 360 px wide, the hint and the notification section fit without sideways
   scrolling, and the buttons are at least 44 px high (FR-040).

## 3. Before the release: the push key (manual, the user)

`secrets.required` makes the deploy fail without `PUSH_VAPID_KEY`, so set it
before merging into `main`:

```bash
node -e 'crypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign"]).then(k=>crypto.subtle.exportKey("jwk",k.privateKey)).then(({kty,crv,x,y,d})=>console.log(JSON.stringify({kty,crv,x,y,d})))' \
  | pnpm wrangler secret put PUSH_VAPID_KEY
```

Generate it once and keep it. A new key invalidates every rider's device
registration (research R4). For `pnpm dev:strava`, put a separately generated
key into `.dev.vars`.

## 4. After the release (live site, not tasks)

On an Android phone and an iPhone (iOS 16.4+):

- install from the page's hint;
- sign in with Strava from the installed app and land back in it (FR-003,
  research R13);
- turn notifications on and upload a short ride that earns Rynke. A
  notification arrives within 5 minutes (SC-001), and tapping it opens the
  installed app.

If the iPhone gets no notification while Android does, apply research R3's
fallback (an encrypted constant payload).
