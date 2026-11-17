# Contract: The eight December pictures

Made like every quote monkey (`art/quotes/README.md`): an entry in `monkeys.json` with
`"seasonal": true` and `{{kit}}`, `pnpm badge-art <id>` from the shared `prompt.txt`,
`pnpm badge-build <id>` into `public/quotes/<id>.svg`, which adds the id to `SEASONAL_MONKEYS` and
its version to `src/http/art-versions.ts`. Lossless, existing palette (research R7).

| id | Shows (spec FR-001) |
|---|---|
| `christmas-market` | paper bag of roasted almonds or a plain gingerbread heart, scarf and bobble hat over the helmet, a hint of fairy lights |
| `mulled-wine` | steaming mug held in both hands, scarf; a mug only, no bottle |
| `christmas-biscuits` | apron over the kit, baking tray of cut-out biscuits, a cutter, a little flour on the face |
| `advent-wreath-1` … `-4` | fir wreath with four candles held in front, exactly 1 / 2 / 3 / 4 lit |
| `between-the-years` | pedalling on an indoor trainer, a plate of leftover biscuits beside it, towel over the shoulder |

Each one, checked by eye on top of README › Checking a picture and the seasonal checks there:

- Rynke as on the badges and coin, full body, talking, turned a little to the right; nothing
  cropped; no bubble, ground or background (the trainer and plate stand on nothing).
- No religious symbol; the wreaths' candles are the one exception (FR-002): no star, angel,
  church or nativity anywhere. No year, digits or letters, also not on mug, bag, gingerbread,
  apron or trainer.
- No place, landmark, team name or team art (FR-003): both teams show it.
- Wreaths: four candles, the lit count right and countable in the Team page's 120 px picture;
  the four pictures alike apart from the flames.
- Between the years: the bike is Rynke's, the trainer plain; the scene still reads as Rynke
  talking, not straining.
