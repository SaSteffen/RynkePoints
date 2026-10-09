# Research: Rider Page Cleanup

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## R1 — What "no data at all" is

- **Decision**: The waiting state shows while `readRiderView` finds no balance
  (`read.balance === null`). `buildRiderView`'s `"not-worked-out"` state becomes
  `"waiting"`, and nothing else changes in how it's decided.
- **Rationale**: `import-page` stores each page through `evaluateChange`, which
  writes the rider's balance, even for an empty page (`activity-page.ts`). So the
  balance appears with the first stored page, and a rider with no rides this
  season leaves the waiting state with zero Rynke (spec Assumptions, US1 #5).
- **Alternatives considered**: `import_status` (it would show the waiting state
  during a reconnect re-import, against the edge cases); counting rides (a rider
  with no rides would wait forever).

## R2 — Dropping the import status from the rider's pages

- **Decision**: `importing` leaves `ViewContext` and `RiderView`, and with it the
  notices `rynke.notice.notWorkedOut` and `rynke.notice.importing` and the line
  `me.import.done`. `renderNotice` keeps only the rule-change notice. The
  `riders.import_status` column and `setImportStatus` stay, because the import
  and re-read workers use them, and they're no longer shown.
- **Rationale**: FR-002 and FR-003. No migration means nothing for the deployed
  version to trip over.
- **Alternatives considered**: dropping the column (the workers still need it,
  and a drop would have to wait a release anyway).

## R3 — Rides with a balance but no rides

- **Decision**: `me.recent.empty` ("Noch keine Fahrten importiert") is replaced
  by `me.recent.none` ("Noch keine Fahrten in dieser Saison."). It shows only
  when the rider has a balance and no ride rows. Before that, Rides shows the
  waiting state.
- **Rationale**: FR-002 removes the old text, but a rider with no rides this
  season still needs to be told why the list is empty, without mentioning an
  import.

## R4 — The waiting state's markup and animation

- **Decision**: one `renderWaiting(i18n, seasonStart)` in `rider-sections.ts`,
  used by both Overview and Rides:
  `<section class="waiting" role="status" data-waiting>` with
  `coin("front", "large")` and a heading and a body text. The coin spins about its
  vertical axis with a new CSS `@keyframes coin-spin` (`rotateY`, 2.4 s,
  infinite). The existing `prefers-reduced-motion: reduce` block gains
  `.waiting .coin{animation:none}`.
- **Rationale**: The coin the rider meant is the one on the start screen. That
  start screen is drawn by the device from the manifest icon, and the icon is the
  coin's front. The SVG sprite already on every page is the same artwork, so
  there's no new image (spec Assumptions). It's pure CSS with no script (FR-007).
- **Alternatives considered**: an animated PNG/GIF of the icon (a new asset that
  is blurry at large sizes); a generic spinner (not what was asked for).

## R5 — How the open page learns the first data arrived

- **Decision**: a new `GET /me/ready` answers `{"ready": boolean}` with
  `Cache-Control: no-store`, `401` without a session. It is one D1 read: does
  the rider have a balance. `public/app.js` polls it every 15 s, but only on a page
  with `[data-waiting]` and only while the page is visible. When it answers
  `ready: true`, the page reloads once and polling stops. A 401 or a network error
  just waits for the next tick.
- **Rationale**: FR-004 needs the switch within a minute, and 15 s leaves room
  for a missed tick. FR-006: the route never touches Strava. The service worker
  ignores non-navigation fetches, so nothing is cached. The route answers before
  the page dispatcher, so polling doesn't renew the session (like
  `/me/notification-text`). It needs no consent check, since it tells the
  signed-in rider only whether their own balance exists.
- **Alternatives considered**: re-fetching the section's HTML (it renders the
  whole page and, on the Overview, writes "seen" Rynke); a `<meta refresh>`
  (it reloads whether or not anything changed, and loses scroll and focus);
  Server-Sent Events or WebSockets (they need long-lived connections or Durable
  Objects, so more moving parts on the free tier); push (spec: a new rider has no
  notifications yet). The existing reload-on-return (011 FR-009) still covers a
  page that was in the background.

## R6 — Starting the import

- **Decision**: no change. `handleCallback` already sends `import-page` page 1
  for a new rider on the first connection (`auth.ts`, feature 001). An existing
  test is extended to assert it, so FR-005 stays pinned.
- **Rationale**: The work queue is FIFO with `max_concurrency: 1`, so the first
  page runs right after whatever is already queued. A season is usually one page
  (200 rides). About 50 riders connecting at once is about 50 reads, inside 100
  per 15 minutes and the 5 minutes the message names (spec Assumptions).
  `import-page` already defers when the budget is spent (edge case), and the
  waiting text names no time beyond "about 5 minutes".
- **Alternatives considered**: a separate priority queue for first imports (a
  second consumer would break the one-at-a-time Strava budget, R6 of feature
  001); merging riders' imports (Strava lists rides per rider token, so nothing
  is saved).

## R7 — Greeting on top

- **Decision**: the Overview renders the hero first. Then come the reconnect
  notice, the rule-change notice, and then either the waiting state or the
  celebration, summary, gauges, breakdown and rules. The hero shows totals only
  when they exist.
- **Rationale**: FR-008 and FR-009. In the two-column grid on wide screens, the
  hero still comes first in source order, so it is first for screen readers too.

## R8 — One floating prompt for install, then notifications

- **Decision**: `shellPage` adds one hidden
  `<aside id="app-prompt" class="app-prompt" aria-labelledby=… hidden>` to every
  signed-in section. It sits after the content, carries
  `data-push-key`, and has two panels:
  `data-panel="install"` (install button, or the iPhone text, plus a close button)
  and `data-panel="notify"` (turn on, not now, close). CSS fixes it above the
  bottom navigation (`bottom: calc(var(--rp-nav-height) + env(safe-area-inset-bottom) + space)`),
  so it overlays the content without moving it (FR-012). It's non-modal: no focus
  trap and no focus moved to it. Its buttons are ordinary tab stops and Escape
  closes it (FR-016). The landing page gets no prompt (Assumptions).
- **Rationale**: One element and one script keep the "once per device" logic in
  one place. Rendering it on the server keeps every word in the catalogs. The
  script holds no text (010 contracts/client.md).
- **Alternatives considered**: the `<dialog>` element shown non-modally (its
  default positioning and focus behaviour differ between browsers); a toast that
  closes by itself (the issue asks for one that stays until clicked away).

## R9 — When each prompt shows (device state)

- **Decision**: two `localStorage` keys, set only when the rider answers or
  closes a prompt:
  - `rp-install-prompt = "done"`
  - `rp-notify-offer = "done"`

  Install panel shows when:
  - it's not standalone,
  - the key isn't set, and
  - the browser fires `beforeinstallprompt`, or it's iOS Safari
    (`navigator.standalone === false`).

  Install, close or `appinstalled` sets the key.

  The notify panel shows when:
  - `appinstalled` fires (Android/desktop Chromium, also after installing from
    Settings), or the app runs standalone (iOS from the home screen, and others
    the first time);
  - and the key isn't set;
  - and push is supported;
  - and `Notification.permission === "default"`;
  - and there is no push subscription.

  Accept runs the same subscribe as the Settings switch. Accept, not now and
  close all set the key.
  The old key `rp-install-dismissed` counts as `rp-install-prompt` done, because
  a rider who hid the old hint already said no once.
- **Rationale**: FR-013 – FR-015 and the edge cases (dismiss then install from
  Settings still gets one offer; notifications already on means no offer;
  blocked means no offer). It's per device and survives sign-out and another
  rider, like the scheme choice (Assumptions). Setting the key only on an answer
  means a prompt the rider never touched comes back on the next page, as "stays
  until they act on it" asks.
- **Alternatives considered**: storing it on the server per rider (spec: per
  device and never sent); a cookie (sent with every request for no reason).

## R10 — Sharing the subscribe step

- **Decision**: `public/app.js` moves the "permission → subscribe → POST on"
  steps out of `notifications()` into `subscribePush(pushKey)`, used by the
  Settings switch and the offer. When the Settings section is on the same page,
  it re-reads its state after the offer, so there is one source of truth.
- **Rationale**: FR-014 "exactly as the Settings switch does".

## R11 — The install group in Settings

- **Decision**: `renderInstallHint` loses its dismiss button and is used only by
  Settings. `app.js`'s `installHint()` becomes `installSettings()`. It shows the
  App group on `beforeinstallprompt` or iOS Safari and hides it when standalone or
  after `appinstalled`, and it ignores both prompt keys. Overview and landing drop
  the call.
- **Rationale**: FR-010 and FR-011.

## R12 — Testing

- **Decision**: integration tests through `handleFetch` cover:
  - markup and order: hero first, the waiting state, none of the removed texts,
    the prompt in the four sections and not on `/`, the Settings group without
    dismiss;
  - `/me/ready`: 401, false, true, and no outbound `fetch`;
  - the callback's import enqueue.

  Unit tests cover `buildRiderView`'s `"waiting"` state and `renderNotice`. The
  catalog parity and no-hard-coded-copy tests cover the keys, and `style.test`
  covers the reduced-motion rule. `public/app.js` has no test harness today
  (feature 010/011 test it by its markup contract), so its behaviour is checked
  in the local walk-through and on the live site after release.
- **Rationale**: Principle V for everything on the server. Adding a DOM test
  runner for one script would be a new dependency for little gain (Principle IV).
