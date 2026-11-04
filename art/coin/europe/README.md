# Art: the Rynke coin, Team Europe

Team Europe's coin designs. The files mirror Hamburg's in [`art/coin/`](../README.md).

| File | What it is |
| --- | --- |
| `originals/rynke-coin-front.jpeg` | Front, full colour: the orangutan on his bike, "RYNKE-COIN · TEAM RYNKEBY EUROPE" |
| `originals/rynke-coin-back.jpeg` | Back, full colour: "EUROPE · PARIS", mountains and a winding road, flags, the Eiffel Tower |
| `reference/rynke-coin-line-drawing.jpeg` | Line drawing of both sides with the coin's size (Ø 40 mm, 3 mm): design draft V1 |
| `reference/rynke-coin-photo.jpeg` | A rendering of the struck coin, both sides |

`pnpm coin-art` traces these into the SVGs beside them:

- `originals/rynke-coin-front.jpeg` → `rynke-coin-front.svg`
- `originals/rynke-coin-back.jpeg` → `rynke-coin-back.svg`
- `reference/rynke-coin-line-drawing.jpeg` → `rynke-coin-line-front.svg`,
  `rynke-coin-line-back.svg` (its circles are slightly oval; the script makes them round)

The colour SVGs stay here instead of in `public/coin/` until the app can serve art per
team (feature 026): in `public/` they'd ship to Hamburg's site too, and they'd add to
the list of pictures in `src/http/art-versions.ts`.

The front has the same fixes as Hamburg's. The back has its own palette, and the
European flag's stars are drawn in code because they're too small to trace.

The hero portraits show only the character, so they can be shared between teams.

The rendering's back differs from the full-colour original (green mountains, no chain
arch), and the line drawing has no chain arch either. That's accepted for now.
