# Art: the Rynke coin

The team's own coin designs, and the SVGs the app traces from them.

| File | What it is |
| --- | --- |
| `originals/rynke-coin-front.jpeg` | Front, full colour: Training Rynke, the orangutan on his bike, "RYNKE-COIN · TEAM RYNKEBY HAMBURG" |
| `originals/rynke-coin-back.jpeg` | Back, full colour: Hamburg to Paris, Elbphilharmonie and cranes, the Elbe, the climb, the Eiffel Tower |
| `reference/rynke-coin-line-drawing.jpeg` | Line drawing of both sides with the coin's size (Ø 40 mm, 3 mm): design draft V1 |
| `reference/rynke-coin-photo.jpeg` | A rendering of the struck coin, both sides: how it looks in enamel and gold |
| `rynke-coin-line-front.svg`, `rynke-coin-line-back.svg` | The line drawing traced, ink only on transparent paper: for print and the coin maker |

`pnpm coin-art` (`scripts/coin-art.mjs`) traces them:

- `originals/rynke-coin-front.jpeg` → `public/coin/rynke-coin-front.svg`
- `originals/rynke-coin-back.jpeg` → `public/coin/rynke-coin-back.svg`
- `reference/rynke-coin-line-drawing.jpeg` → the two line SVGs here

Commit the originals and the SVGs together; to change the coin, replace an
original and run the script again. Like `pnpm illustrations` it needs
ImageMagick and potrace on the `PATH`, and uses the same tracer
(`scripts/trace.mjs`).

## Colours and fixes

The front snaps to the coin palette (`--rp-coin-*` in `src/http/style.ts`):
cream, yellow, gold, fur, muzzle, ink. The back has its own: the coin's sky,
glass, Elbe water and brick, a quay grey, yellow, gold and ink.

The generated front got two things wrong, fixed after snapping (`FIXES` in the
script, each a box in the original's pixels): the banana is yellow, not a
white peel, and the handlebar is black, tape and hoods included, so it stands
apart from the yellow frame.

## Where the app shows it

The traced coin is the picture where the coin is shown large: the organiser
overview's deadline card (the back) and the waiting state before a rider's
first data (both sides, turning over). Below about 64 px its detail doesn't
read; the simplified sprite in `src/http/coin.ts` stays for the wordmark, the
mini coins and the chart marks.

The mock-up is the "Coin artwork" artboard of the Claude Design canvas
"RynkePoints Coin Explorations"
(https://claude.ai/artifact/7bMwZ6tzBtFY4FTur3eRxP).
