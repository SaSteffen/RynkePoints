# Art: the Rynke coin

Each team's coin designs, and the SVGs the app traces from them, are in its team
folder: Hamburg's in [`teams/hamburg/art/coin/`](../../teams/hamburg/art/coin/README.md),
Team Europe's in [`teams/europe/art/coin/`](../../teams/europe/art/coin/README.md).
This folder holds what every team shares: Rynke's portraits for the hero coin.

| File | What it is |
| --- | --- |
| `originals/rynke-coin-hero-<n>.png` | Rynke's portraits for the Du page's hero coin ([`hero/`](hero/README.md)) |
| `reference/rynke-hero-reference.png` | Four badge pictures of the character: the reference for those portraits |
| `hero/prompt.txt` | The prompt the portraits were made with |

`pnpm coin-art` (`scripts/coin-art.mjs`) traces every team's coin and the
portraits:

- each team's `originals/rynke-coin-front.jpeg` and `rynke-coin-back.jpeg` → the
  coin the app shows (Hamburg's in `public/coin/`, every other team's in
  `public/teams/<id>/coin/`)
- each team's `reference/rynke-coin-line-drawing.jpeg` → the two line SVGs beside it
- `originals/rynke-coin-hero-<n>.png` → `public/coin/rynke-coin-hero-<n>.svg`
  (each portrait in a coin frame drawn in code)

Commit the originals and the SVGs together; to change a coin, replace an
original and run the script again. Like `pnpm illustrations` it needs
ImageMagick and potrace on the `PATH`, and uses the same tracer
(`scripts/trace.mjs`).

## Colours and fixes

The front snaps to the coin palette (`--rp-coin-*` in `src/http/style.ts`):
cream, yellow, gold, fur, muzzle, ink. Each team's back has its own palette;
Hamburg's: the coin's sky, glass, Elbe water and brick, a quay grey, yellow,
gold and ink.

The generated front is corrected after snapping (`FIXES` in the script, each a
box, and if needed a ring, in the original's pixels): "TEAM RYNKEBY HAMBURG"
is gold like "RYNKE-COIN" on top, the banana is yellow, not a white peel, and
the handlebar is black, tape and hoods included, so it stands apart from the
yellow frame.

## Where the app shows it

The traced coin is the picture where the coin is shown large: the empty ride
list (front), the team totals (front or back), the organiser overview's
deadline card (back) and the waiting state before a rider's first data (both
sides, turning over). The installed app's icons and launch screen show the
front too (`pnpm icons`, `scripts/icons.mjs`): run that as well after changing
it. The Du page's hero shows one of the hero portraits at
random, the landing page's hero always portrait 2. The simplified sprite in
`src/http/coin.ts` stays for the small marks (wordmark, mini coins, chart
marks), where the artwork's detail doesn't read.

The mock-up is the "Coin artwork" artboard of the Claude Design canvas
"RynkePoints Coin Explorations"
(https://claude.ai/artifact/7bMwZ6tzBtFY4FTur3eRxP).
