# Art: the quote monkeys

On the Team page Rynke says the rider's quote in a speech bubble, standing on
the team total (Claude Design "RynkePoints Quote Monkey", option B). There are
eleven pictures of him for that: five poses in cycling kit, one each in swim,
running and bike gear, and three fun ones. The page gives each quote one of
them, the same one every time (`quoteArt()` in `src/http/sections/team.ts`). Until a picture
is built, the quote shows the rider state's illustration instead.

They are made the same way as the badge pictures (`art/badges/README.md`), so
Rynke looks like the badges' character.

## Files

- `monkeys.json`: the eleven monkeys (id, name, pose), the seasonal ones
  (`"seasonal": true`) and the badges page's hint monkeys (`"hint": true`),
  see below. `snippets` are shared
  descriptions that the poses pull in with `{{name}}`.
  `holes` (optional) are [x, y] points in the original's pixels inside
  background the drawing closes in, like the gap between the legs or a
  wheel: the tracer only drops paper it reaches from the edges, so without a
  point such a gap comes out cream instead of see-through.
  `erase` (optional) are [x0, y0, x1, y1] boxes in the original's pixels:
  every shape wholly inside one, like a stray doodle beside Rynke, is dropped.
- `prompt.txt`: the prompt every monkey uses; `{{scene}}` is the monkey's pose.
- The reference attached to every prompt is the hero coin's sheet of four
  badge pictures, `art/coin/reference/rynke-hero-reference.png`.
- `originals/`: one original per monkey, `<id>.png`, snapped to the palette by
  `pnpm badge-build` (a fresh download may be `.png` or `.jpg` until then).

## Making the pictures

They come along with the badges, in the same two commands
(`art/badges/README.md`); monkey ids work like badge ids there:

```bash
pnpm badge-art                  # every badge and monkey without an original
pnpm badge-art wave flex        # only these
pnpm badge-art --force wave     # a new take of one monkey
pnpm badge-art --print wave     # just print the prompt to paste by hand
pnpm badge-build                # trace them into public/quotes/
```

`pnpm badge-art` makes the badges first, then the monkeys, with the same
sign-in, pacing and options; it attaches the hero coin's sheet to the
monkeys' prompts.

`pnpm badge-build` builds the monkeys after the badges: it snaps every
original to the coin palette in place, traces it into `public/quotes/<id>.svg`
(the full canvas, like the illustrations), skips monkeys whose SVG is
committed and unchanged unless named, removes SVGs whose original is gone,
lists the finished ones in `src/http/quote-monkeys.ts` and updates
`src/http/art-versions.ts`. Commit the originals, `public/quotes/`,
`src/http/quote-monkeys.ts` and `src/http/art-versions.ts` together.

## Checking a picture

- Rynke looks like the reference (helmet with three vents, orange fur, light
  muzzle, yellow jersey), full-body, talking, turned a little to the right,
  where the bubble is.
- No speech bubble, ground or background drawn; nothing cropped.
- No cream where the page should show through: a gap the drawing closes in
  gets a point in `holes`.
- No doodles beside Rynke: put a box around them in `erase`.
- Still friendly at 80 px (the smallest, on small phones): clear eyes and
  mouth, few large shapes, no thin lines.
- The feet are near the bottom: the picture's lower part overlaps the team
  total's top edge, so he stands on it.

## Seasonal monkeys

Some monkeys dress Rynke up for a holiday: `advent`, `nikolaus`, `christmas`
and `new-year` (feature 035), `karneval`, `valentine`, `easter`, `midsummer`,
`halloween` and `eu-day` (feature 037). They are entries of `monkeys.json` like the others,
made and built the same way, with `"seasonal": true`. `pnpm badge-build` lists
them apart, in `SEASONAL_MONKEYS`, so they never join the regular rotation.

Which team shows them, and when, is team data: `holidays` in
`src/teams/<id>.ts`. Each holiday names its seasonal `monkey`, a window `from`
and `to` (both days included, German time) and a `kind`:

- A day is a fixed `"MM-DD"`, or `{ anchor: "first-advent" | "easter", offset }`,
  `offset` days after that year's first Advent Sunday or Easter Sunday
  (Karneval runs from Weiberfastnacht `{ anchor: "easter", offset: -52 }` to
  Ash Wednesday `{ anchor: "easter", offset: -46 }`, Easter from Good Friday
  `-2` to Easter Monday `1`).
- A window whose `to` comes before its `from` runs over the year end
  (`"12-31"` to `"01-01"`).
- `short`: every quote shows the monkey. `long`: about half of them do, each
  quote always the same one (bit 16 of the quote's id).
- When windows overlap, the one with the fewest days wins (Nikolaus inside
  Advent).

Until a holiday's picture is built, its window shows the regular monkeys. A new
holiday needs only its entry here, its picture and the team's `holidays`; a
test checks that every holiday names a seasonal entry, and that no two of a
team's windows overlap through 2075 (but Nikolaus in Advent and
Valentine's Day in Karneval). Two teams may list
the same monkey when it shows no place, team name or team art (feature 037
FR-010); a team never lists a monkey that shows another team's place.

Red `#E32636` and dark blue `#003399` are only for what a scene names (the
Nikolaus boot, the Santa hat, the Karneval nose, the Valentine heart, the
Europe Day flag).

`pnpm monkeys:seasonal` serves an overview of every seasonal monkey, with its
pictures and each team's window, and prints its address.

When checking a seasonal picture, also check:

- No religious symbols: no crosses, angels, nativity scenes, churches, or
  candles in a religious setting. Nikolaus brings gifts; he is no saint here.
- No year, digits or letters (the New Year monkey shows every year).
- Europe Day: the European flag right, and no other flag, map or country shape:
  dark blue, exactly twelve five-pointed yellow stars in a circle, upright;
  count them in the Team page's 120 px picture.

## Hint monkeys

The badges page's monkey says a badge hint (feature 034). Its six pictures are
entries of `monkeys.json` like the others, made and built the same way, with
`"hint": true` and ids starting with `hint-`. `pnpm badge-build` lists them
apart, in `HINT_MONKEYS`, so they never show on the Team page. Each kind of
hint always gets the same one (specs/034-badge-hints/spec.md FR-016); the
badges page shows it beside the hint's bubble (`src/badges/hints.ts`,
`hintMonkey`), above the cards:

| Monkey | Pose | Hints |
| --- | --- | --- |
| `hint-down` | points down at the cards | distance, elevation, Rynke, running, swimming, virtual |
| `hint-calendar` | holds up a blank calendar page | winter months (days outside) |
| `hint-tape` | stretches out a tape measure | longest ride, run, swim |
| `hint-psst` | whispers behind a hand | holidays: 24th, Christmas, New Year, Easter, Pi Day |
| `hint-binoculars` | looks through binoculars | early bird, night owl, solstice, Winterschlaf |
| `hint-magnifier` | holds up a magnifying glass | stages, Dreikampf, rest day, Everesting, Festive 500 |

A hint monkey is never seasonal too. When checking one, also check that the
calendar page and the tape measure stay blank: no digits, ticks or letters.
