# Contract: The Hint on the Badges Page

## Server markup (`src/http/sections/badges.ts`)

Right after the badges switch, before the personal group, when research R8 allows a hint:

```html
<div class="badge-hints" data-today="2026-11-20" hidden>
  <template data-hint="next:winter_november">
    <a class="badge-hint" href="#badge-card-winter_november">
      <img class="quote-monkey-art" src="/quotes/hint-calendar.svg?v=…" alt="" width="104" height="104">
      <span class="quote" lang="de">
        <span class="badge-hint-label">Tipp</span>
        <span class="badge-hint-text">Noch ein Tag draußen auf dem Rad, dann gibt's das nächste November-Abzeichen.</span>
        <span class="badge-hint-more">Zur Karte<svg aria-hidden="true">…</svg></span>
      </span>
    </a>
  </template>
  <!-- up to three templates, in the order of contracts/hint-candidates.md -->
</div>
```

- At most three `<template>`s; none, and no slot, when there are no candidates.
- Every personal card, with or without a badge, carries `id="badge-card-<category>"`.
- `lang` is the line's language (`de` or `en`, research R6); numbers in the rider's format.
- The link's accessible name is its text; the picture is decorative (FR-003).
- Nothing about hints in push notifications, Strava descriptions, shared pictures or organiser
  pages (FR-002).

## Browser (`public/app.js`, `badgeHint(signal)`)

1. No `.badge-hints` slot: nothing.
2. In-place refresh of the same page with a hint shown before (research R5): show the template
   with that key if present, else nothing. Done.
3. Read `rp-badge-hint` (try/catch; unreadable → `{}`).
4. Show when `record.date !== slot.dataset.today`, else with probability ½.
5. When showing: drop `record.key` from the keys if another remains, pick by research R4's
   weights, clone the template into the slot, unhide it, remember the key in memory.
6. Write `{date: today, key: <shown key, or record.key when none was shown>}` (try/catch).
7. On a click on the hint, if the "Alle" filter is checked, check "Neueste" first.

## Styles

- `.badge-hint`: the draft's main layout, monkey left (104 px) and the quote's bubble right,
  whole block one link, no underline except "Zur Karte"; `max-width: 640px`; fits 360 px without
  horizontal scroll (FR-017); colours from theme tokens, so every theme and dark mode work.
- `.badge-card:target`: the draft's outline (`--md-sys-color-primary-container` with the coin
  ink ring), fading after about two seconds; `scroll-margin-top` clears the sticky switch;
  no animation under `prefers-reduced-motion`, the outline stays briefly.

## Tests

- `test/integration/badges-section.test.ts`: slot and templates
  present for a rider with candidates; none in the waiting state, with a reveal, or without
  candidates; card ids; `lang` and German/English choice; at most three templates.
- An e2e test in fake mode (Chromium): a rider with a known candidate opens the badges page with
  an empty `localStorage`, sees the hint, taps it, the card is the `:target`; reload in place keeps
  the same text.
- `test/teams/no-other-team.test.ts` keeps passing: no team's name or place in the lines (FR-015).
