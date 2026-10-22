# Research: One Set of Controls, Themes in the Header and Fun Page Switches

**Feature**: 022-themes-and-controls | **Date**: 2026-10-22

The canvas "RynkePoints Themes" (https://claude.ai/artifact/8yciDe8Hycvc4Lo9v8gJBN)
was read with the Artifact tool on 2026-10-22 (all six boards). Its values are
carried into the contracts; where a decision below departs from the canvas it
says so.

## R1. How a theme reaches the page: `data-theme` next to today's `data-scheme`

- **Decision**: Keep feature 011's `data-scheme` attribute (`light` / `dark` /
  absent) and add `data-theme="<id>"` on `<html>`. Every theme has a base scheme
  (light or dark); the head script sets both. The stylesheet keeps today's
  light and dark rules unchanged and adds one rule per non-default theme,
  `:root[data-theme=<id>]{…tokens…}`, after them, so a theme overrides only the
  tokens it changes. "Automatisch" sets neither attribute, as "System" does
  today.
- **Rationale**: Everything that already follows the scheme keeps working with
  no change: the Strava light/dark images (`SHOW_DARK`), `color-scheme`, and
  the charts' recolouring, which watches `data-scheme` (it also watches
  `data-theme` from now on). Rynke Tag and Rynke Nacht are today's light
  and dark with the canvas's track and fill (FR-017), changed in the base
  rules, so they need no rule of their own.
- **Alternatives considered**: Replacing `data-scheme` with `data-theme` only —
  every existing selector and test touching the scheme would change for no
  gain. One stylesheet per theme — twelve requests or a swap on choice, and a
  flash on first paint.

## R2. Storage and carry-over

- **Decision**: localStorage key `rp-theme` holding a theme id; absent means
  Automatisch. The head script, on finding no `rp-theme` but an old
  `rp-scheme`, maps `light` → `rynke-day`, `dark` → `rynke-night`, writes
  `rp-theme` and removes `rp-scheme` (FR-015). An unknown id, or storage that
  throws, is Automatisch (edge case).
- **Rationale**: Same device-only setting as 011 FR-032a, never on the server
  (FR-014). Migrating in the head script means the first page after the update
  is already right, on any page, signed in or not.
- **Alternatives considered**: A cookie so the server renders the theme —
  rejected: rider-independent, device-only, and the head script already avoids
  the flash (SC-004).

## R3. First paint without a flash

- **Decision**: Extend `SCHEME_SCRIPT` in `src/http/html.ts` into `THEME_SCRIPT`:
  it reads `rp-theme` (with R2's carry-over), sets `data-theme` and
  `data-scheme`, and points both `theme-color` metas at the theme's surface
  colour without `media`. It carries a small id → [scheme, surface] table
  generated from the theme list in TypeScript, so it cannot drift. It holds no
  text. It also handles R7's show hand-over flag.
- **Rationale**: Today's mechanism, already proven on every page, public ones
  and the offline notice included.

## R4. Theme tokens: canvas roles mapped onto the app's tokens

- **Decision**: The canvas gives each theme 20 roles. They map onto the
  existing tokens (011 `contracts/design-tokens.md`) as in
  [contracts/themes.md](contracts/themes.md). Three roles have no token today
  because the hero cards borrow the coin's colours for text; three tokens are
  added, set in Rynke Tag/Nacht to the values used today so nothing changes
  there:
  - `--rp-on-hero` (canvas `heroText`, today `--rp-coin-face`),
  - `--rp-hero-accent` (canvas `heroAccent`, today `--rp-coin-yellow`),
  - `--rp-primary-text` (canvas `primaryText`: link, outlined and text button
    text; today `--md-sys-color-primary`). Disco is the one theme where it
    differs from `primary`.
  The tokens the canvas doesn't show (error, ok, neutral and push containers,
  the gauge parts, the chart lines, `surface-container-high`, …) keep the base
  scheme's values unless the contrast test (R10) fails for that theme; then the
  implementer picks a value in the theme's hue that passes and adds it to
  `contracts/themes.md`. The high-contrast themes set them all (values from the
  canvas board "Ein Satz Bedienelemente").
- **Rynke Tag/Nacht vs. the gallery**: the gallery differs from today in two
  roles: the light track (`#e3dcc0`, today `#1c1b13`) and the gauge fill
  (`#1c1b13` light, `#fbe122` dark, today green `#7fcb92`). The owner prefers
  the canvas (clarification 2026-10-22), so the base light and dark tokens
  take the canvas values.
- **Alternatives considered**: Deriving every theme from a seed colour with
  Material's algorithm — needs a library (Principle IV) and wouldn't reproduce
  the canvas.

## R5. The one set of controls (Phase 1)

- **Decision**: The canvas board "Ein Satz Bedienelemente" is the rule set:
  44 px high, 14 px / 600, pill shape for buttons and segmented choices, 8 px
  corners for filters and status chips, selected = primary-container, outlines
  1 px (2 px in the contrast themes), one filled button per card. It becomes a
  new type token `--rp-type-control: 600 14px/20px` and an outline width token
  `--rp-outline-width` (1 px; 2 px in the contrast themes), used by every
  control rule instead of `--md-type-label` and literal `1px`. The audit's
  deviations are listed with their fix in
  [contracts/controls.md](contracts/controls.md).
- **Rationale**: `--md-type-label` is also used for table headers and labels
  that aren't controls; changing it would restyle more than FR-002 asks.
- **Alternatives considered**: Changing `--md-type-label` to 600 — rejected
  for that reason.

## R6. The theme menu: server-rendered radios in a popover panel

- **Decision**: `shell.ts` renders the palette button
  (`button.icon-button.theme-button[aria-haspopup=dialog][aria-expanded]`)
  before the refresh link, and a hidden panel (`div.theme-menu[role=dialog]`)
  holding a heading, a close button, and one radio group
  (`<fieldset>` of `<input type=radio name=theme>` in labels styled as the
  canvas tiles) with Automatisch first and the three groups. `app.js` opens
  and closes it (Escape, outside tap, close button; focus to the first radio
  on open and back to the palette button on close), and applies a choice on
  `change` without closing, as the canvas does.
- **Rationale**: Native radios give arrow-key movement and "selected"
  announcements for free (edge case: keyboard and screen readers). The canvas
  marks its items `menuitemradio` inside a dialog, which mixes two patterns;
  the look is kept, the semantics are the radio group's.
- **Alternatives considered**: `role=menu` with `menuitemradio` — needs
  hand-written roving focus. The Popover API — Safari support is fine now, but
  the light dismiss doesn't return focus the way FR/edge case needs, and
  `app.js` has to wire Escape anyway.

## R7. The page-switch show across a full page load

- **Decision**: Tabs and links go to another document (a full GET; only
  `data-swap` views swap in place). The show is therefore played in two
  halves, using the same overlay and the same keyframes:
  1. **Leaving page** (0–1.6 s): on a qualifying click (R8) in Konfetti or
     Disco, `app.js` prevents the default, mounts `div.show` (aria-hidden,
     `pointer-events` on only to catch a skip tap) and plays it from 0. At
     1.6 s it writes `sessionStorage["rp-show"] = "<theme>:<timestamp>"` and
     calls `location.assign(href)`. The browser keeps the covered page
     painted until the next one paints (paint holding), so the cover holds
     while the server answers (US4 scenario 6).
  2. **Arriving page** (1.6–3.2 s): the head script finds a fresh `rp-show`
     flag (under 10 s old, same theme, navigation type `navigate`), removes
     it and sets `data-show="<theme>"` on `<html>`; the stylesheet then paints
     a static peak cover (`:root[data-show]::before`, the theme's peak look)
     from the first paint. `app.js` mounts the same overlay with every
     animation delayed by −1.6 s, so it continues from the peak, removes
     `data-show`, and removes the overlay at the end.
  A tap or key press in half 1 navigates at once without setting the flag; in
  half 2 it removes the overlay at once (FR-043, FR-047).
- **Rationale**: Works in all three engines without View Transitions, needs
  no prefetch, and never shows a blank page: the old page holds at the peak,
  the new one starts covered.
- **Alternatives considered**: Cross-document View Transitions — not in
  Firefox, and a 3.2 s transition blocks interaction with the new page.
  Prefetching the target on click to shorten the hold — section GETs are
  `no-store` and some record "seen" state (quote, Rynke), so a prefetch could
  mark something seen that the rider then skips; rejected.

## R8. Which navigations play a show

- **Decision**: A left click without modifier keys on an `a[href]` that
  `pageLoading()` already treats as "leaving for another of our pages", and
  additionally: not `data-swap`, not the refresh link, not `aria-current=page`
  and not the current path and query (FR-044). Form submits, reloads,
  back/forward (no flag is set, and a back-forward-cache restore runs no head
  script) and non-fun themes never play one. The progress bar of issue #108 is
  started at the switch moment, not at the click.
- **Rationale**: Reuses the one place that already defines "another page of
  ours".

## R9. Reduced motion, celebrations, accessibility

- **Decision**:
  - With `prefers-reduced-motion: reduce` the show is a 0.5 s fade in the
    theme's surface colour, switched at 0.25 s, split the same way (FR-045).
  - While `data-show` is set, the page's own celebrations (012's
    `.celebrate-coins`, the badge reveal and sparkles) are paused with
    `animation-play-state: paused` and run once the overlay is gone (edge
    case).
  - The overlay is `aria-hidden="true"`, holds nothing focusable and never
    takes focus; the new page gets focus and its title as any page load does
    today (FR-046).
  - The fun decorations (Phase 2) stop moving under reduced motion; the
    falling bursts are hidden (canvas).
- **Rationale**: Canvas rules; FR-033, FR-045, FR-046.

## R10. Contrast test for all twelve themes

- **Decision**: Extend `test/unit/design-tokens.test.ts`: for each theme, the
  resolved token set (base scheme + theme override) is checked pair by pair —
  text pairs ≥ 4.5 : 1, large text, icons and outlines ≥ 3 : 1 (FR-018), and in
  the two contrast themes every text pair ≥ 7 : 1. The pairs are the ones 011
  already checks plus the new tokens and the fun themes' fixed texts (rainbow
  pill text `#1c1b13` against every rainbow band).
- **Rationale**: SC-003 is then checked on every commit; the look itself is
  checked by the owner on the live site (owner's habit).

## R11. The Rynke pictures: a third art set, `art/shows/`

- **Decision**: A new set beside badges and quote monkeys: `art/shows/`
  with `shows.json` (two entries, `unicorn` and `disco`, scenes from the
  canvas board "Rynke in den Seitenwechseln"), its own `prompt.txt` (the quote
  prompt's character, style, proportions and canvas rules, without the speech
  bubble and the talking expression; a joyful open grin instead), and
  `originals/`. `pnpm badge-art` gets the set as a third entry of `SETS` with
  the hero coin's reference sheet. `pnpm badge-build` builds it with the quote
  monkeys' code, generalised to take a set (dir, output dir, list file,
  palette): it snaps to the coin palette plus, for `unicorn` only, the bright
  rainbow's twelve colours (FR-048), traces into `public/shows/<id>.svg`, and
  writes `src/http/show-pictures.ts` listing the built ids; `art-versions.ts`
  gets their hashes as for every picture.
- **Rationale**: Adding them to `monkeys.json` would make them quote monkeys on
  the Team page. A per-set palette exists already (`coin-art.mjs`), so the
  rainbow mane survives the snapping.
- **FR-049**: The show markup includes Rynke only when the id is in
  `SHOW_PICTURES`; until then the show plays without Rynke. The hand-drawn
  canvas drafts never go into `public/`.

## R12. The rain's cost on slow phones

- **Decision**: 220 pieces (110 confetti, 110 coins), each an absolutely
  positioned element animated with `transform` only (compositor-friendly), as
  on the canvas. The counts are one constant; if the owner's test phones
  stutter, both halves are reduced together (edge case). The coins are CSS
  gradients as on the canvas, not the coin SVG, so 110 of them cost no
  image decoding.
- **Rationale**: Canvas look; the count is a single place to tune.
