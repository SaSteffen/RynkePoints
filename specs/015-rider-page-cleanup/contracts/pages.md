# Contract: Pages

**Feature**: [../spec.md](../spec.md) | **Research**: R2–R4, R7, R8, R11

Changes to feature 011's `contracts/pages.md`. The markup and class names below
are what the tests check. Texts are catalog keys; German is in
[catalog.md](catalog.md).

## Waiting state (Overview and Rides)

```html
<section class="waiting" role="status" data-waiting data-poll-seconds="10">
  <svg class="coin coin-large" …><use href="#coin-front"/></svg>
  <h2>{waiting.heading}</h2>
  <p>{waiting.body, date = season start}</p>
</section>
```

- It is shown when the view is `"waiting"` (no balance) and replaces all the
  Rynke content of the section.
- `data-poll-seconds` carries the configured `READY_POLL_SECONDS` for the page
  script (R5).
- `.waiting .coin` spins with `@keyframes coin-spin`. Under
  `prefers-reduced-motion: reduce` it has `animation: none` (FR-007).
- No rider page contains `me.import.done`, `me.recent.empty`,
  `rynke.notice.notWorkedOut` or `rynke.notice.importing`, because those keys no
  longer exist (FR-002, FR-003).

## Overview `/me` (order changed)

Inside `div.overview-grid`, in this order:

1. `section.hero`: the coin, `p.greeting`, and the totals only when ready (FR-008).
2. `aside.notice.notice-error`: the reconnect notice, only for `needs_reconnect` (FR-009).
3. `section.notice[role=status]`: the rule-change notice (`rynke.notice.updating`), only when ready and the rules differ (FR-009).
4. Waiting: `section.waiting`. Ready: the celebration, summary, gauges,
   breakdown and rules as today.

There is no `aside#install` any more (FR-010).

## Rides `/me/rides`

- When waiting it shows only `section.waiting`, with no `section#rides`.
- When ready it shows the rule-change notice, if any, then `section#rides`.
  An empty list shows `coin-large` and `me.recent.none` (R3).

## Settings `/me/settings`

`section#settings-app` still holds `aside#install` with `data-install="prompt"`
and `data-install="ios"`, and no `data-install="dismiss"` (FR-011).

## Landing `/`

There is no `aside#install` and no `#app-prompt` (FR-010, Assumptions).

## App prompt (every signed-in section, new)

Rendered by `shellPage` after the section content, before the navigation:

```html
<aside id="app-prompt" class="app-prompt" aria-labelledby="app-prompt-title"
       data-push-key="{VAPID public key}" hidden>
  <div data-panel="install" hidden>
    <p id="app-prompt-title">{prompt.install.text}</p>
    <p data-install="prompt" hidden><button type="button" class="tap">{install.button}</button></p>
    <p data-install="ios" hidden>{install.ios}</p>
  </div>
  <div data-panel="notify" hidden>
    <p>{prompt.notify.text}</p>
    <button type="button" class="tap" data-action="accept">{prompt.notify.accept}</button>
    <button type="button" class="tap" data-action="decline">{prompt.notify.decline}</button>
  </div>
  <button type="button" class="icon-button" data-action="close"
          aria-label="{prompt.close}">✕</button>
</aside>
```

- It is `position: fixed` above `nav.app-nav` and the safe area, and as wide as
  the content column. It never changes the layout of the content (FR-012).
- It has no `role=dialog` and no focus trap. Its buttons are reachable by Tab,
  are at least 44 px, and Escape closes it like close (FR-016).
- The script reveals one panel at a time ([client.md](client.md)). The
  `aria-labelledby` points at the visible panel's first paragraph. The script
  moves the id when it shows the notify panel.
