# Contract: The Two Rynke Pictures for the Shows

Source: canvas board "Rynke in den Seitenwechseln (Entwurf)", read 2026-10-22.
The board's drawings are stand-ins and never ship (FR-049).

## Files

```text
art/shows/
├── README.md        # how to make and check them (like art/quotes/README.md)
├── shows.json       # { "snippets": { "kit": … }, "shows": [ {id, name, scene, holes?, erase?} ] }
├── prompt.txt       # {{scene}} template
└── originals/       # unicorn.png, disco.png (snapped in place by badge-build)
public/shows/
├── unicorn.svg      # traced, 100 units wide, transparent background
└── disco.svg
src/http/show-pictures.ts   # generated: export const SHOW_PICTURES: readonly string[]
```

## `shows.json`

| id | name | scene (start from the canvas text) |
|----|------|------------------------------------|
| `unicorn` | Auf dem Einhorn | In its cycling kit ({{kit}}). Riding a cheerful unicorn, seen from the side, flying through the air, galloping upward to the viewer's right: cream (#FFFDF5) body, black hooves, a short gold (#C99A2E) and yellow (#FBE122) spiralled horn, a flowing mane and tail in rainbow stripes. The character sits on its back, one hand holding the mane, the other arm waving high. No saddle, no reins, no ground, no rainbow in the background. |
| `disco` | Disco | Disco outfit instead of the cycling kit, but the yellow helmet with its three black vents stays on: a cream (#FFFDF5) three-piece suit with wide lapels and wide flared trousers, a yellow (#FBE122) shirt with a huge pointed collar laid over the lapels, black shoes. The classic disco pose: one arm stretched up diagonally to the upper right, index finger pointing at the sky, the other arm stretched down diagonally to the lower left, hip pushed out, one leg straight, the other knee bent outward. Dancing with a big grin. No disco ball, no floor, no lights. |

`kit` is the quote monkeys' snippet, copied.

## `prompt.txt`

The quote prompt (`art/quotes/prompt.txt`) with the same reference,
androgyny, mood, style, proportions and canvas paragraphs, except:

- no speech bubble and no "turns toward the right to speak";
- expression: a joyful open grin, as in the quote prompt's mouth rules;
- colours: the quote palette, plus for the unicorn's mane and tail only the
  bright rainbow #FF4566 #FF7A2E #FFB31A #FFE61A #A6F21F #2BEA7C #14E6CF
  #1FD0FF #3FA9FF #8A7DFF #C45CFF #FF4FB4 (FR-048).

## Commands

- `pnpm badge-art unicorn disco` (and `--force`, `--print`) as for monkeys:
  `scripts/badge-art.mjs` gets a third set
  `{ dir: "art/shows", list: "shows.json", key: "shows", check: validateShows }`
  with the hero coin's reference sheet.
- `pnpm badge-build` builds the set after the quote monkeys with the same
  code, taking `{ art, out, list, key, palette(id) }`: the coin palette, plus
  the rainbow for `unicorn`; writes `public/shows/<id>.svg`,
  `src/http/show-pictures.ts` (built ids in `shows.json` order) and the
  `art-versions.ts` hashes.

## Use

The show overlay (page-switch-show.md) includes `<img src="/shows/<id>.svg?v=…"
alt="" class="show-rynke">` only for ids in `SHOW_PICTURES`; the URL comes
from `art-versions.ts` like every picture. The server doesn't know the
device's theme, so `app.js` preloads the theme's picture when a page loads in
a fun theme or the menu switches to one; the first show then doesn't wait for
it.

## Checking (owner, by eye)

Rynke looks like the reference (helmet with vents, orange fur, light muzzle),
androgynous, no jewellery; the unicorn flies up to the right; the disco pose
points up right and down left; nothing cropped; transparent where the page
should show through.
