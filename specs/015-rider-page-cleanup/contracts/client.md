# Contract: Client Script

**Feature**: [../spec.md](../spec.md) | **Research**: R5, R8–R11

Changes to `public/app.js` (feature 010 and 011 `contracts/client.md`). The
script still holds no text and no dependencies. `sw.js` is unchanged.

## `waitForFirstData()` (new)

On a page with `[data-waiting]`:

- every `data-poll-seconds` seconds (10 if the attribute is missing or not a
  positive number), while `document.visibilityState === "visible"`, it fetches
  `GET /me/ready` with `credentials: "same-origin"` and `cache: "no-store"`;
- on `{"ready":true}` it stops and calls `location.reload()` once;
- on a 401, a network error or `{"ready":false}` it waits for the next tick;
- on a page without `[data-waiting]` it does nothing (FR-006: it stops once the
  real content shows).

`refreshOnReturn()` stays as it is, so a page back from the background after a
minute reloads anyway.

## `appPrompt()` (new; replaces the hint part of `installHint()`)

On a page with `#app-prompt` (signed-in sections only):

| Step | Condition | Action |
|---|---|---|
| Read state | `localStorage` throws | do nothing |
| Legacy | `rp-install-dismissed` set | remove it; it doesn't count as an answer |
| Install panel | not standalone, `rp-install-prompt` unset, and `beforeinstallprompt` fired (call `preventDefault`, keep the event) or `navigator.standalone === false` | show `[data-panel=install]` with the matching `data-install` paragraph |
| Install tap | | `deferred.prompt()`, set `rp-install-prompt`, hide the panel |
| `appinstalled` | | set `rp-install-prompt`, hide the install panel, then try the notify panel |
| Notify panel | (`appinstalled` fired or the display is standalone), `rp-notify-offer` unset, push supported, `Notification.permission === "default"`, no `pushManager` subscription | show `[data-panel=notify]` |
| Accept | | `subscribePush(pushKey)`, set `rp-notify-offer`, hide; refresh `#notifications` if on the page |
| Decline / close / Escape | | set the key of the panel shown, hide |

Only one panel shows at a time, and the aside is hidden whenever no panel
shows. Nothing moves focus.

## `subscribePush(pushKey)` (extracted)

It is the Settings switch's turn-on, moved out of `notifications()`:
`Notification.requestPermission()` inside the tap, `pushManager.subscribe`, then
`POST /me/notifications action=on`, then the sign-out endpoint field. It
resolves to `"on" | "off" | "blocked"` and throws on failure. The Settings switch
and the offer both use it (FR-014).

## `installSettings()` (was `installHint()`)

Only `#settings-app #install`:

- it shows the group on `beforeinstallprompt` (with the `prompt` paragraph) or on
  iOS Safari (with the `ios` paragraph);
- it hides the group when standalone or on `appinstalled`;
- the install button calls the kept `beforeinstallprompt` event's `prompt()`;
- it has no dismiss and ignores both prompt keys (FR-011).

Both `appPrompt()` and `installSettings()` listen for `beforeinstallprompt`. One
shared listener keeps the event for both, so either can call `prompt()` once.
