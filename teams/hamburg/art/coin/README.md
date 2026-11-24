# Art: the Rynke coin, Team Rynkeby Hamburg

Hamburg's coin designs. How they're traced, and the portraits every team shares,
are in [`art/coin/`](../../../../art/coin/README.md).

| File | What it is |
| --- | --- |
| `originals/rynke-coin-front.jpeg` | Front, full colour: Training Rynke, the orangutan on his bike, "RYNKE-COIN · TEAM RYNKEBY HAMBURG" |
| `originals/rynke-coin-back.jpeg` | Back, full colour: Hamburg to Paris, Elbphilharmonie and cranes, the Elbe, the climb, the Eiffel Tower |
| `reference/rynke-coin-line-drawing.jpeg` | Line drawing of both sides with the coin's size (Ø 40 mm, 3 mm): design draft V1 |
| `reference/rynke-coin-photo.jpeg` | A rendering of the struck coin, both sides: how it looks in enamel and gold |
| `rynke-coin-line-front.svg`, `rynke-coin-line-back.svg` | The line drawing traced, ink only on transparent paper: for print and the coin maker |

`pnpm coin-art` traces them:

- `originals/rynke-coin-front.jpeg` → `public/coin/rynke-coin-front.svg`
- `originals/rynke-coin-back.jpeg` → `public/coin/rynke-coin-back.svg`
- `reference/rynke-coin-line-drawing.jpeg` → the two line SVGs here
