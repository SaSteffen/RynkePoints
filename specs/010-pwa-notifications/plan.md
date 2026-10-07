# Implementation Plan: Installable App and Notifications for New Rynke

**Branch**: `010-pwa-notifications` | **Date**: 2026-10-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/010-pwa-notifications/spec.md`

## Summary

RynkePoints becomes installable and can tell a rider's devices that there are
new Rynke. The app stays server-rendered; the only new client code is two small
static scripts with no dependencies and no text of their own.

- **Install (Story 1)**: a static web app manifest, icons and a service worker
  in `public/`, served as static assets (research R1). The service worker
  caches nothing but an offline notice and the notification text in the
  device's language. Every page still comes from the network (R2). Two hints
  are rendered hidden and shown by `public/app.js`: an install button where the
  browser offers installing, and a "Zum Home-Bildschirm" explanation on iPhones
  (R11).
- **Notifications (Story 2)**: pushes carry no data at all. The service worker
  shows its cached text "Neue Rynke – tippe zum Ansehen" (R3), so there is no
  payload encryption and no language on the server. The VAPID signature uses
  Web Crypto and one new secret, `PUSH_VAPID_KEY` (R4). `applyAndEvaluate`
  evaluates the rider before and after the change under the current rules and
  reports whether a total rose. Only the activity-event handler and team-event
  changes act on that (R5), so imports, re-reads, recalculations and rule
  changes never notify. Each device gets one `send-notification` queue message.
  It is tried at most 4 times (about 7 minutes) and then dropped, and a device
  reported gone is deleted (R6).
- **On and off (Story 3)**: a `push_subscriptions` table holds only the
  endpoint, the rider and the time (migration 0008, R7). It is deleted by
  cascade when the rider leaves. `POST /me/notifications` turns a device on,
  turns it off, or checks whether it is on. The browser's permission is asked
  only after the button is pressed (R8). Signing out sends the device's endpoint
  along and deletes it (R9).
- **Sign-in**: `rp_session` lasts 180 days and is renewed on each page view, at
  most once a day (R10).
- **Privacy**: a new `landing.notifications` paragraph. `CONSENT_VERSION` stays
  1 (R14).

## Technical Context

**Language/Version**: TypeScript 7 (`tsc --noEmit`), Cloudflare Workers runtime,
as in features 001–008. The two client scripts in `public/` are plain modern
JavaScript, not bundled.

**Primary Dependencies**: none new. Push uses `fetch` and Web Crypto (ECDSA
P-256 for VAPID). The browser side uses the standard Service Worker, Push,
Notifications and Cache APIs.

**Storage**: D1. One new table, `push_subscriptions` (migration 0008,
[data-model.md](data-model.md)). The device's Cache Storage holds only the
offline notice and the notification text.

**Testing**: Vitest in workerd (`pnpm test`), with synthetic riders. The push
service is reached only through the existing deny-all `fetch` spy, so a test
that forgets to mock it fails. The tests per requirement are listed in
[quickstart.md](quickstart.md) §1.

**Target Platform**: Cloudflare Workers plus browsers that support service
workers: current Android Chrome, iOS/iPadOS 16.4+ for home-screen apps, and
desktop Chrome, Edge, Firefox and Safari.

**Project Type**: web service. A single Worker for pages, webhook, queue and
cron, plus static assets.

**Performance Goals**: SC-001: the notification shows within 5 minutes of the
upload. The queue adds one message per device; sending is one `fetch` without a
body. The webhook path is unchanged (SC-006). An evaluation now runs the pure
rules twice for the changed rider, which takes milliseconds at 500 rides.

**Constraints**:
- No rider data in pushes (SC-008), in the cache or offline (SC-007).
- Sending never makes a Strava request and never delays an evaluation.
- Rider-facing text comes only from the catalogs. The scripts contain none.
- The migration is additive, so the old code keeps working.
- Free tier: at most 10 riders × a few devices × a few notifications a day.

**Scale/Scope**: ≤ 10 riders, ≤ 10 devices each. About 12 source files touched
or added, 1 migration, about 14 catalog keys, 2 scripts, 1 manifest, 6 icons and
about 10 test files.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design
(below).*

| Principle | How this plan complies | Result |
|---|---|---|
| **I. Privacy and consent** | A push has no body, so the push service only learns that the device got a message (R3). A registration stores the endpoint, the rider and the time, and nothing else: no keys, language or device details (R7). It is deleted when the rider turns it off, signs out or leaves (cascade), or when the service reports the device gone. The device caches no rider data (R2). The privacy text names the push service and what is stored (FR-030). The consent version isn't raised: no new Strava scope or request, and nothing new is shown to anyone but the rider, which constitution v2.1.0 says is not growth (R14). The VAPID key is a Cloudflare secret. Tests and dev use synthetic keys. | Pass |
| **II. Strava API citizenship** | No Strava request is added. The webhook handler is untouched (SC-006). Rises are detected inside the existing idempotent evaluation: a replay changes nothing, so it notifies nobody (R5). | Pass |
| **III. Rider-authored content wins** | Nothing is written to Strava. | Pass |
| **IV. Serverless, TS, minimal deps** | No dependency: VAPID is ~40 lines of Web Crypto, and `web-push` was rejected (R4). The rules stay pure; evaluating the previous state is one more call of the same pure function (R5). Free tier: a few queue messages and outbound `fetch` calls a day. The first client scripts need no framework or bundler (R16). | Pass |
| **V. Test-first** | Each FR has a failing test first ([quickstart.md](quickstart.md) §1). Push requests go to the mocked `fetch`, riders are synthetic, and the VAPID key is a test key. The scripts in `public/` can't run in workerd (no DOM or service worker). They are kept to wiring, while what they call (routes, markup, manifest) is tested on the server, and the local walk-through checks them (R15). | Pass |
| **Language** | Every new text is in `de` and `en`: hints, notification settings, offline notice, notification text and privacy text. The scripts read text from the page or from the server-rendered `/notification-text`. The app name is "RynkePoints" everywhere (FR-032). Code and docs are in English. | Pass |
| **Brand guidelines** | The icon is a RynkePoints mark, not Strava's logo. The Strava attribution stays in the footer of every page, including `/offline`. | Pass |
| **Development workflow** | Spec Kit order, one PR into `develop`. The migration is forward-only. The new secret is set by the user with `wrangler secret put` **before** the release, because `secrets.required` makes the deploy fail without it. | Pass |

**Post-design re-check (after Phase 1)**: still Pass.
- [data-model.md](data-model.md): one table, three data columns, cascade
  delete.
- [contracts/http-routes.md](contracts/http-routes.md): one same-origin POST
  route, two static-text routes and session renewal. No new route reads rider
  data for anyone but the session's rider.
- [contracts/push-delivery.md](contracts/push-delivery.md): the push has no
  body and goes only to allow-listed push-service hosts.
- [contracts/client.md](contracts/client.md): the service worker caches two
  URLs without rider data.
- [contracts/messages.md](contracts/messages.md): all text is in the catalogs,
  and the consent version is unchanged.

## Delivery

One PR (spec clarification: one release). Tasks follow the stories:

1. Manifest, icons and service worker with the offline notice.
2. Install hints.
3. The sliding sign-in.
4. Migration and `POST /me/notifications`.
5. Rise detection and sending.
6. Privacy text, dev settings and docs.

Before merging into `main`, the user runs `wrangler secret put PUSH_VAPID_KEY`
(quickstart §3).

## Project Structure

### Documentation (this feature)

```text
specs/010-pwa-notifications/
├── spec.md
├── plan.md                  # this file
├── research.md              # R1–R16
├── data-model.md            # push_subscriptions, session cookie lifetime
├── quickstart.md            # tests per FR, local walk-through, the secret
├── contracts/
│   ├── http-routes.md       # /me/notifications, /offline, /notification-text,
│   │                        # /logout change, session renewal
│   ├── push-delivery.md     # rise detection, queue message, push request
│   ├── client.md            # manifest, service worker, app.js, page markup
│   └── messages.md          # new catalog keys
├── checklists/requirements.md
└── tasks.md                 # /speckit-tasks, not this command
```

### Source Code (repository root)

```text
migrations/
└── 0008_push_subscriptions.sql       # new

public/
├── manifest.webmanifest              # new: name, start_url /me, standalone
├── sw.js                             # new: offline notice, push, click
├── app.js                            # new: SW registration, hints, on/off
└── icons/                            # new: icon.svg source + PNGs (192, 512,
                                      # maskable 512, apple-touch 180, badge 96)

src/
├── push/
│   ├── vapid.ts                      # new: JWK import, ES256 JWT, public key
│   └── send.ts                       # new: one push request, response classes
├── db/push-subscriptions.ts          # new: upsert, delete, check, list ids
├── rynke/apply.ts                    # before/after balance, report risers
├── work/
│   ├── activity-event.ts             # enqueue notifications on a rise
│   ├── send-notification.ts          # new: handler
│   ├── messages.ts                   # SendNotificationMessage
│   └── consumer.ts                   # send-notification never to failed_work
├── http/
│   ├── notifications.ts              # new: POST /me/notifications
│   ├── pwa.ts                        # new: GET /offline, /notification-text
│   ├── router.ts                     # routes; session renewal on GET/HEAD
│   ├── session.ts                    # 180 days; renewal helper
│   ├── me.ts                         # notification section, install hint,
│   │                                 # logout deletes the device
│   ├── landing.ts                    # install hint; privacy paragraph
│   └── html.ts                       # manifest, icons, theme colour, script
├── crypto/sign.ts                    # expiry returned with the value
├── index.ts                          # handler registration
└── i18n/messages/{de,en}.ts          # new keys

dev/fake.env                          # synthetic PUSH_VAPID_KEY
package.json                          # `pnpm dev` unsets PUSH_VAPID_KEY
wrangler.jsonc                        # PUSH_SUBJECT var; PUSH_VAPID_KEY secret
vitest.config.ts                      # synthetic PUSH_VAPID_KEY binding
.dev.vars.example                     # PUSH_VAPID_KEY line
worker-configuration.d.ts             # regenerated (`pnpm types`)

test/
├── unit/        vapid (new), push-send (new), manifest (new), session,
│                catalogs, messages
├── integration/ notifications-route (new), notify-on-rise (new),
│                send-notification (new), pwa-pages (new), session-renewal
│                (new), logout (new), delete-rider, schema-minimisation,
│                landing, no-hardcoded-copy
└── support/     push (new): synthetic endpoints, push-service fetch mock

README.md                             # stored data, secrets, key generation
```

**Structure Decision**: the existing single-Worker layout. Push gets its own
small `src/push/` like `src/strava/`, since it is a second outbound service. The
client files go into the existing static-assets directory `public/`, so they
never reach the Worker.

## Complexity Tracking

None. The first client-side scripts are not a dependency. R16 says why the
feature can't work without them.
