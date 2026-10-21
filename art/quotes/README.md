# Art: the quote monkeys

On the Team page Rynke says the rider's quote in a speech bubble, standing on
the team total (Claude Design "RynkePoints Quote Monkey", option B). There are
five pictures of him for that; the page gives each quote one of them, the same
one every time (`quoteArt()` in `src/http/sections/team.ts`). Until a picture
is built, the quote shows the rider state's illustration instead.

They are made the same way as the badge pictures (`art/badges/README.md`), so
Rynke looks like the badges' character.

## Files

- `monkeys.json`: the five monkeys (id, name, pose). `snippets` are shared
  descriptions that the poses pull in with `{{name}}`.
- `prompt.txt`: the prompt every monkey uses; `{{scene}}` is the monkey's pose.
- The reference attached to every prompt is the hero coin's sheet of four
  badge pictures, `art/coin/reference/rynke-hero-reference.png`.
- `originals/`: one original per monkey, `<id>.png`, snapped to the palette by
  `pnpm quote-build` (a fresh download may be `.png` or `.jpg` until then).

## Making the pictures

```bash
pnpm quote-art                  # every monkey without an original
pnpm quote-art wave flex
pnpm quote-art --force wave     # a new take of one monkey
pnpm quote-art --print wave     # just print the prompt to paste by hand
pnpm quote-build                # trace them into public/quotes/
```

`pnpm quote-art` is `pnpm badge-art --set quotes`: the same Gemini run in
Chrome, with the same sign-in, pacing and options (`art/badges/README.md`).
The raw downloads stay in `~/.cache/rynkepoints/quote-art/raw/`.

`pnpm quote-build` snaps every original to the coin palette in place, traces
it into `public/quotes/<id>.svg` (the full canvas, like the illustrations),
removes SVGs whose original is gone, lists the finished ones in
`src/http/quote-monkeys.ts` and updates `src/http/art-versions.ts`. It needs
ImageMagick and potrace. Commit the originals, `public/quotes/`,
`src/http/quote-monkeys.ts` and `src/http/art-versions.ts` together.

## Checking a picture

- Rynke looks like the reference (helmet with three vents, orange fur, light
  muzzle, yellow jersey), full-body, talking, turned a little to the right,
  where the bubble is.
- No speech bubble, ground or background drawn; nothing cropped.
- Still friendly at 80 px (the smallest, on small phones): clear eyes and
  mouth, few large shapes, no thin lines.
- The feet are near the bottom: the picture's lower part overlaps the team
  total's top edge, so he stands on it.
