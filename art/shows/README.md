# Art: Rynke in the page-switch shows

In the fun themes a tap on another tab plays a short show (feature 022,
`specs/022-themes-and-controls/contracts/page-switch-show.md`): in Konfetti
Rynke flies through the rainbow on a unicorn, in Disco Rynke dances under the
disco ball. These are the two pictures for that. Until a picture is built, its
show plays without Rynke.

They are made the same way as the quote monkeys (`art/quotes/README.md`), so
Rynke looks like the badges' character.

## Files

- `shows.json`: the two pictures (id, name, scene). `snippets` are shared
  descriptions that the scenes pull in with `{{name}}`; `kit` is the quote
  monkeys' cycling kit. `holes` and `erase` (optional) work as for the quote
  monkeys.
- `prompt.txt`: the prompt both use; `{{scene}}` is the picture's scene. It is
  the quote prompt without the speech bubble, with a joyful grin, and with the
  rainbow allowed for the unicorn's mane and tail.
- The reference attached to every prompt is the hero coin's sheet of four
  badge pictures, `art/coin/reference/rynke-hero-reference.png`.
- `originals/`: one original per picture, `<id>.png`, snapped to the palette
  by `pnpm badge-build` (a fresh download may be `.png` or `.jpg` until then).

## Making the pictures

They come along with the badges and the quote monkeys, in the same two
commands (`art/badges/README.md`); show ids work like badge ids there:

```bash
pnpm badge-art unicorn disco    # only these
pnpm badge-art --force disco    # a new take of one
pnpm badge-art --print unicorn  # just print the prompt to paste by hand
pnpm badge-build                # trace them into public/shows/
```

`pnpm badge-build` builds the shows after the quote monkeys: it snaps every
original to the coin palette (and the unicorn's to the rainbow as well),
traces it into `public/shows/<id>.svg`, lists the finished ones in
`src/http/show-pictures.ts` and updates `src/http/art-versions.ts`. Commit the
originals, `public/shows/`, `src/http/show-pictures.ts` and
`src/http/art-versions.ts` together.

## Checking a picture

- Rynke looks like the reference (helmet with three vents, orange fur, light
  muzzle), androgynous, no jewellery.
- The unicorn flies up to the right; the disco pose points up right and down
  left.
- Nothing cropped; no ground, lights or background drawn.
- No cream where the page should show through: a gap the drawing closes in
  gets a point in `holes`.
