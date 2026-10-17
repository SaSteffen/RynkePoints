# Art: the hero coin's portraits

The coin at the top of the Du page (the rider's overview): the coin's rim,
black ring, stars and gold chain, with Rynke's head and shoulders in the
cream face. There are several portraits; the page picks one at random on
every load (`heroCoin()` in `src/http/coin.ts`, `HERO_PORTRAITS` is how many).
Everywhere else the coin stays the simplified sprite: the landing page's hero
and the small marks. The frame is drawn in code (`scripts/coin-art.mjs`, like the app's
sprite in `src/http/coin.ts`); only the portrait comes from the image
generator, made the same way as the badge pictures (`art/badges/README.md`), so
Rynke looks like the badges' character.

## Making the portrait

1. Open a fresh Gemini chat (or another image generator that takes a
   reference image).
2. Attach `art/coin/reference/rynke-hero-reference.png`: four badge pictures
   of the character, the character and style reference.
3. Paste `prompt.txt` from this folder as it is.
4. Save the image as `art/coin/originals/rynke-coin-hero-<n>.png` (or
   `.jpg`/`.jpeg`), numbered from 1. A screenshot is fine: the script trims
   it to the figure and places it on the coin by itself (below).
5. Run `pnpm coin-art`. It traces every portrait in the coin palette (plus
   the light blue of a sweat drop) and writes
   `public/coin/rynke-coin-hero-<n>.svg`. The other coin SVGs come out
   unchanged.
6. A new number: raise `HERO_PORTRAITS` in `src/http/coin.ts` (and its test).

To try another take, replace an original and run the script again. If a
picture has something besides the portrait in it (an app's toolbar, say),
cut it away with an entry in `HERO_CROPS` in the script.

## Checking the portrait

- Rynke looks like the badges' character: same head, orange fur, light
  muzzle, round black eyes, helmet with three vents, yellow jersey.
- Head and shoulders only, on plain white: no ring, circle, chain or
  background. The white around him is removed, so the coin's cream face shows.
- The head and ears stay inside the gold chain; only the shoulders run over it
  at the bottom, where the face's edge crops them.
- Still friendly at 96 px (the smallest hero, on small phones): clear eyes, few
  large shapes, no thin lines.

## How it fits the coin

The script trims each portrait to its figure and scales it onto a 2048 px
canvas, the helmet's top at 250 px and the shoulders' bottom at 1960 px,
centred. That canvas's centred 1800 px circle becomes the coin's face (radius
31 of 100), clipped there: the helmet sits just inside the chain (radius 29)
and the shoulders run over it at the bottom. The prompt asks for about this
layout, but the trimming makes any framing work.
