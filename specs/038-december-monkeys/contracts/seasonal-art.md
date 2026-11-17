# Contract: The eight December pictures

Made like every quote monkey (`art/quotes/README.md`): an entry in `monkeys.json` with
`"seasonal": true` and `{{kit}}`, `pnpm badge-art <id>` from the shared `prompt.txt`,
`pnpm badge-build <id>` into `public/quotes/<id>.svg`, which adds the id to `SEASONAL_MONKEYS` and
its version to `src/http/art-versions.ts`. Lossless, existing palette (research R7).

| id | Shows (spec FR-001) |
|---|---|
| `christmas-market` | open paper cone with the roasted almonds showing and a plain gingerbread heart, scarf, a red bobble hat with a cream band of reindeer heads over the helmet; no fairy lights or other background |
| `mulled-wine` | steaming mug held in both hands, scarf; a mug only, no bottle |
| `christmas-biscuits` | apron over the kit, baking tray of cut-out biscuits, a cutter, a little flour on the face |
| `advent-wreath-1` … `-4` | fir wreath with four candles held in front, exactly 1 / 2 / 3 / 4 lit |
| `between-the-years` | round and chubby, riding Rynke's bike outside through falling snow, scarf, a half-eaten biscuit |

Each one, checked by eye on top of README › Checking a picture and the seasonal checks there:

- Rynke as on the badges and coin, full body, talking, turned a little to the right; nothing
  cropped; no bubble, ground or background (the bike rides on nothing; falling snow is the one exception).
- No religious symbol; the wreaths' candles are the one exception (FR-002): no star, angel,
  church or nativity anywhere. No year, digits or letters, also not on mug, bag, gingerbread,
  apron or bike.
- No place, landmark, team name or team art (FR-003): both teams show it.
- Wreaths: four candles, the lit count right and countable in the Team page's 120 px picture;
  all four candles always fully visible; Rynke more joyful each Sunday (walking, skipping,
  hopping, jumping), so only the lit count and the pose differ.
- Between the years: the bike is Rynke's; round snow dots, no star-shaped flakes; the
  scene still reads as Rynke talking, cheerful, not straining.
