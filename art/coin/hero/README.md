# Art: the hero coin's portrait

The coin at the top of the landing page and the rider's overview: the coin's
rim, black ring, stars and gold chain, with Rynke's head and shoulders in the
cream face. The frame is drawn in code (`scripts/coin-art.mjs`, like the app's
sprite in `src/http/coin.ts`); only the portrait comes from the image
generator, made the same way as the badge pictures (`art/badges/README.md`), so
Rynke looks like the badges' character.

## Making the portrait

1. Open a fresh Gemini chat (or another image generator that takes a
   reference image).
2. Attach `art/coin/reference/rynke-hero-reference.png`: four badge pictures
   of the character, the character and style reference.
3. Paste `prompt.txt` from this folder as it is.
4. Download the image at full size as
   `art/coin/originals/rynke-coin-hero.png` (or `.jpg`/`.jpeg`).
5. Run `pnpm coin-art`. It traces the portrait in the coin palette and writes
   `public/coin/rynke-coin-hero.svg`. The other coin SVGs come out unchanged.

To try another take, replace the original and run the script again.

## Checking the portrait

- Rynke looks like the badges' character: same head, orange fur, light
  muzzle, round black eyes, helmet with three vents, yellow jersey.
- Head and shoulders only, on plain white: no ring, circle, chain or
  background. The white around him is removed, so the coin's cream face shows.
- The head and ears stay inside the gold chain; only the shoulders run over it
  at the bottom, where the face's edge crops them.
- Still friendly at 96 px (the smallest hero, on small phones): big eyes, few
  large shapes, no thin lines.

## How it fits the coin

The prompt keeps the portrait inside a 1800 px circle centred on the 2048 px
canvas, the head inside 1560 px. The script maps that 1800 px circle onto the
coin's face (radius 31 of 100) and clips it there; 1560 px lands just inside
the chain (radius 29).
