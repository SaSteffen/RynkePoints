# Contract: The Page-Switch Shows (Phase 3)

Source: canvas board "Seitenwechsel: Konfetti und Disco (klickbar)"
(Transitions), read 2026-10-22. Coordinates on the canvas are for a 390 × 844
phone; here they are given relative to the viewport.

## Timing

| Constant | Value |
|----------|-------|
| `SHOW_MS` (show) | 2700 |
| `SHOW_HIDE_MS` (peak: `main` goes, under the full cover) | 1350 |
| `SHOW_SWAP_MS` (the section swaps in, still hidden) | Konfetti 1650 (the rainbow still covers), Disco 2200 |
| `SHOW_IN_MS` (Konfetti: `main` fades in as the rainbow starts clearing the view) | 1815 |
| `SECTION_FADE_MS` (Konfetti's fade in) | 300 |
| `SHOW_ROOM_OUT` (Disco: `main` fades in with the room's fade out, opacity the reverse of the room's) | 0.6 of `SHOW_MS` |
| `FADE_MS` (reduced motion: fade in, swap, fade out as long again) | 250 |

Changed after release: the show first loaded the next page at its peak
(1.6 s) and played the rest on the arriving page from a `sessionStorage` flag
(research R7). That stuttered; loading at the show's end showed the page
change. Now nothing loads as a page: the click fetches the section, at the
peak `main` goes (unseen), the section swaps in place (Disco half a second
before the end, where the show is nearly gone, as a swap at the peak hitched
visibly; Konfetti just before the retracting rainbow clears the view, as the
owner found its later fade in too late) and
`main` fades in on the show's clock (its `startTime` is the show's first
part's), so a slow swap can't put Disco's fade out of step with the room. The swap is `swapPage` (the same as the Team section's views,
plus the header's section title), with a history entry, at the top of the
page, the navigation's item focused for a keyboard user. The flag, the head
script's part and the `data-show` peak cover are gone.

## When it plays (FR-040, FR-040a, FR-044)

Theme is `confetti` or `disco`, and a plain left click (no modifier) on a link
in `nav.app-nav` (the top or bottom bar) to another section: not
`aria-current=page`, not Settings (`/me/settings`). Never for links or buttons
inside a page (the Orga group tiles, say), form submits, reloads,
back/forward, other themes, while a tour step shows
(`aside.tour .tour-progress`), or when Settings' switch turned the shows off
on this device (`localStorage["rp-shows"] = "off"`).

## Playing

- Skip (FR-043): `pointerdown` or `keydown` anywhere during the show ends it
  and swaps the section in at once if it is there; the overlay catches the tap
  so it doesn't also hit a control.
- Not there by `SHOW_SWAP_MS`: it swaps in when it arrives, where the
  show's clock has the fade by then; a skip swaps at once without the fade; past the show's end the
  page progress bar (#108) shows. Not swappable (a redirect, an error, a page
  without the shell): `location.assign` at the show's end.
- Back and forward: `popstate` to an entry this document pushed swaps that
  view or section in place, no show (FR-044).
- The turning coin has a rim: 13 one-pixel discs between the faces, each a
  `repeating-conic-gradient` of 3° stripes in the rim colour and a darker
  one (reeding), the two outer discs lighter as a lip; the faces 6.5 px in
  front and behind.
- The overlay: `<div class="show show-confetti|show-disco" aria-hidden="true">`,
  `position: fixed; inset: 0; z-index` above everything (nav and header
  included), nothing focusable (FR-046).

## Konfetti (FR-041)

| Piece | Look and motion |
|-------|-----------------|
| Rainbow | circle 2000 × 2000 px centred on the bottom edge's middle (`left: calc(50% - 1000px); top: calc(100% - 1000px)`), `radial-gradient(circle, #fffcf7 0 12%, #c45cff 12% 19%, #8a7dff 19% 26%, #3fa9ff 26% 33%, #1fd0ff 33% 40%, #14e6cf 40% 47%, #2bea7c 47% 54%, #a6f21f 54% 61%, #ffe61a 61% 68%, #ffb31a 68% 75%, #ff7a2e 75% 82%, #ff4566 82% 89%, #ff4fb4 89% 95%, #ff85dc 95% 100%)`; scale 0 → 1 at 42 %, hold to 58 %, → 0 at 100 %, `cubic-bezier(.5,0,.3,1)`. Viewports taller than ~1000 px: the circle grows to `max(2000px, 220vmax)` so it still covers. |
| Coin pop | the Rynke coin, both sides back to back (the app's front and back SVGs, so the turn shows the back too; the board drew the front only), 300 px, centred; `pop`: up at once, scale 1.15 rot 8° at 10 %, 1 at 16–58 %, gone by 70 % (changed after release: it first waited to 30 %, which the owner found late); spins `rotateY` 1.1 s linear |
| Rain | 220 pieces from 24 px above the top edge, falling 900 px (`100vh + 60px`) with sideways sway ±80 px and spin 360–1080°; each piece's start (0–1.35 s) and duration (1.4–2.4 s) from a fixed seeded sequence (`seeded(n) = frac(sin(n·9301+49297)·233280)`, canvas). Odd pieces are coins: 20 × 20 px, `rotateY` spin, faces alternating training (`#fbe122` face, `#e0b52a`, `#c99a2e` rim) and team (`#8cc4f0`, `#5aa2dc`, `#c99a2e`) with a white glint, as the canvas's `COIN_FACES`. Even pieces are confetti: 7 × 15 or 9 × 9 px, 30 % round, colours #ff4566 #ffb31a #ffe61a #2bea7c #3fa9ff #c45cff #ff8fd1 #7bdff2 in turn |
| Rynke (FR-042a) | the unicorn picture, a third of the screen's height and at least 170 px (`max(170px, 33vh)`, the owner's call after the pictures came in; the board drew 200 px), linear over the whole show from off-screen lower left `translate(calc(-30px - <size>), 85vh) rotate(-14deg)` through `translate(24vw, 64vh) rotate(-10deg)` at 50 % to the middle of the right edge `translate(calc(100vw + 20px), 39vh) rotate(-6deg)`; gallop: `translateY(0) rotate(-3deg)` ↔ `translateY(-8px) rotate(2deg)`, .45 s alternate. Above the rainbow, below the rain. Only when `unicorn` is in `SHOW_PICTURES` (FR-049) |


## Disco (FR-042)

| Piece | Look and motion |
|-------|-----------------|
| Room | `radial-gradient(ellipse at 50% 12%, #3a1f6b 0, #120a22 55%, #07040f 100%)`; opacity 0 → 1 at 38 %, hold to 60 %, → 0 |
| Wire | 2 px, 70 px long, `linear-gradient(#cdbde8, #9a88bf)`, from the top centre |
| Ball | 120 px at 70 px from the top, centred; `drop`: from −240 px to 0 at 28 %, bounce −6 px at 34 %, rest 40–62 %, up −260 px at 100 %, `cubic-bezier(.5,0,.3,1.2)`; face `#9a9aa8` with glow `0 0 30px rgba(255,255,255,.35), 0 0 60px rgba(255,92,184,.35)`; facets 12 px grid of `rgba(20,10,40,.55)` lines over moving bands `#d9d9e3 #8f8fa3 #f4f4fb #b3b3c4`, .9 s linear; shade highlight top left and dark rim; three 18 px glints, 1.2 s, staggered .4 s |
| Beams | 1400 px disc centred on the ball, `repeating-conic-gradient` of 3° beams in pink `rgba(255,92,184,.55)`, cyan `rgba(123,223,242,.5)`, yellow `rgba(255,226,74,.5)`, green `rgba(184,242,161,.45)` every 18°, masked to a ring from 60 px to 72 %; in from 18 % to 40 %, out by 88 %; turning 4 s linear |
| Spots | 34 light spots 10–32 px, colours #ff5cb8 #7bdff2 #ffe61a #b8f2a1 #ffffff #d7a6ec, blur 1.5 px, spread over the page (seeded); visible 40–62 %; sweeping ±110 × ±60 px, 1.6 s linear |
| Rynke (FR-042a) | the disco picture, the same size as the unicorn (the board drew 170 px), centred, 70 px + .15 × its size above the bottom; on a floor glow 1.5 × .33 its size, 70 px above the bottom, `radial-gradient(ellipse, rgba(255,92,184,.75) 0, rgba(123,223,242,.35) 45%, transparent 70%)`; both: hidden to 22 %, rise 40 px into view by 40 %, stay to 62 %, gone by 86 %; sways ±5° about the feet, .5 s alternate. Only when `disco` is in `SHOW_PICTURES` |


## Reduced motion (FR-045)

As built: the text below, one layer in the surface colour, 0 → 1 → 0 over
500 ms, the section swapping in at 250 ms.

One full-screen layer in the theme's `--md-sys-color-surface`, opacity
0 → 1 → 0 over 500 ms, switch at 250 ms, the same two halves. No rain, ball,
beams or Rynke.

## Constants in one place

The piece counts (110 + 110), spot count (34) and timings are constants in
`public/app.js`; reducing the rain keeps coins equal to confetti (edge case).
