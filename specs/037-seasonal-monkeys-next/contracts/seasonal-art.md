# Contract: The five seasonal pictures

Made like every quote monkey (`art/quotes/README.md`): an entry in `monkeys.json` with
`"seasonal": true`, `pnpm badge-art <id>` from the shared `prompt.txt`, `pnpm badge-build <id>`
into `public/quotes/<id>.svg`, which adds the id to `SEASONAL_MONKEYS` and its version to
`src/http/art-versions.ts`. Lossless, as every monkey.

| id | Shows (research R5) |
|---|---|
| `karneval` | red clown nose, jester's collar with bells, confetti and streamers |
| `easter` | bunny ears over the helmet, small basket of painted eggs |
| `midsummer` | crown of leaves and flowers over the helmet, bunch of wild flowers |
| `halloween` | carved pumpkin lantern with a friendly face, small cartoon bats and a spider |
| `europe-day` | garland of plain pennants in mixed palette colours |

Each one, checked by eye on top of README › Checking a picture and the seasonal checks there:

- Rynke as on the badges and coin, full body, talking, turned a little to the right; nothing
  cropped; no bubble, ground or background.
- No religious symbol (no cross, angel, church; no maypole), no year, digits or letters.
- No place, landmark, team name or team art (FR-004): both teams show it.
- Halloween: friendly; bats and spider cute cartoons, nothing scary (no fangs, skulls, blood).
- Europe Day (FR-003): no flag, no EU emblem, no stars, no map or country shape, no country
  colours, no yellow-and-blue pair on its own.

The markup and the choice of picture are feature 035's contracts/quote-art.md, unchanged.
