# Contract: Manifest, Service Worker and Page Script

**Feature**: [../spec.md](../spec.md) | **Research**: R1, R2, R8, R9, R11, R12, R16

## `public/manifest.webmanifest`

```json
{
  "id": "/",
  "name": "RynkePoints",
  "short_name": "RynkePoints",
  "description": "RynkePoints",
  "start_url": "/me",
  "scope": "/",
  "display": "standalone",
  "theme_color": "#111111",
  "background_color": "#ffffff",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

## `<head>` additions in `layout()` (every page)

```html
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="/icons/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<meta name="theme-color" content="#111111">
<script src="/app.js" defer></script>
```

The viewport meta stays `width=device-width, initial-scale=1`, without
`viewport-fit=cover` (R12).

## Markup on `/` and `/me`: install hint (FR-004)

```html
<aside id="install" class="notice" hidden>
  <p data-install="prompt" hidden><button type="button" class="tap">{install.button}</button></p>
  <p data-install="ios" hidden>{install.ios}</p>
  <button type="button" data-install="dismiss" class="tap">{install.dismiss}</button>
</aside>
```

## Markup on `/me`: notifications (FR-010, FR-011)

The section goes after the rules section and before the ride table.

```html
<section id="notifications" data-push-key="{VAPID public key}" hidden>
  <h2>{notifications.heading}</h2>
  <p>{notifications.explain}</p>
  <p data-state="on" hidden>{notifications.on}</p>
  <p data-state="off" hidden>{notifications.off}</p>
  <p data-state="blocked" hidden>{notifications.blocked}</p>
  <p data-state="needsHomeScreen" hidden>{notifications.needsHomeScreen}</p>
  <p data-state="unsupported" hidden>{notifications.unsupported}</p>
  <p data-state="failed" hidden>{notifications.failed}</p>
  <button type="button" data-action="on" class="tap" hidden>{notifications.turnOn}</button>
  <button type="button" data-action="off" class="tap" hidden>{notifications.turnOff}</button>
</section>
```

The sign-out form gains `<input type="hidden" name="push_endpoint" value="">`.

## `public/app.js` (every page, `defer`)

1. **Register**: if `serviceWorker` is supported, register
   `/sw.js?lang=<document.documentElement.lang>` with scope `/`.
2. **Install hint**: if `#install` exists, `localStorage["rp-install-dismissed"]`
   isn't set, and the app isn't standalone (`display-mode: standalone` or
   `navigator.standalone`):
   - on `beforeinstallprompt`: `preventDefault()`, show the hint and the
     prompt button; clicking it calls `prompt()`, then hides the hint;
   - if `navigator.standalone === false`, show the hint with the iOS text;
   - dismissing sets the flag and hides the hint.
3. **Notifications**: if `#notifications` exists, unhide it and pick the state
   by research R8's table. `check` and the button actions `POST
   /me/notifications` with `credentials: "same-origin"`. The public key is
   decoded from base64url into a `Uint8Array`.
4. **Sign-out**: when a subscription exists, put its endpoint into every
   `input[name=push_endpoint]`.

The script contains no rider-facing text, no third-party URL and no
`localStorage` use other than the dismissal flag.

## `public/sw.js`

| Event | Behaviour |
|---|---|
| `install` | `lang` = the script URL's `lang` param, or `de`. `caches.open("rp-" + lang).addAll(["/offline?lang=" + lang, "/notification-text?lang=" + lang])`, then `skipWaiting()`. |
| `activate` | Delete every cache starting with `rp-` other than its own. `clients.claim()`. |
| `fetch` | Only `request.mode === "navigate"`: `respondWith(fetch(request).catch(() => caches.match("/offline?lang=" + lang)))`. Nothing else is intercepted or cached. |
| `push` | See [push-delivery.md](push-delivery.md). The text comes from `/me/notification-text`, then the cache, then the network, then the title alone. |
| `notificationclick` | Close; focus or open `/me` (FR-019). |

## Icons (`public/icons/`)

| File | Size | Use |
|---|---|---|
| `icon.svg` | vector | source of the PNGs |
| `favicon.svg` | vector | favicon (head on the coin) |
| `icon-192.png` | 192 × 192 | manifest, notification icon |
| `icon-512.png` | 512 × 512 | manifest, splash |
| `icon-maskable-512.png` | 512 × 512, mark inside the central 80 % | manifest `maskable` |
| `apple-touch-icon.png` | 180 × 180, opaque | iOS home screen |
| `badge-96.png` | 96 × 96, white on transparent | Android status bar badge |
