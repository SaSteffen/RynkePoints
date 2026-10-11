# Art: illustration originals

`illustrations/` holds the raster originals of the app's illustrations, as they
come out of the image generator. `pnpm illustrations` traces every file in it,
whatever its name or extension (ImageMagick goes by the content), into a flat
SVG with the same base name in `public/illustrations/` (`rynke-push.jpeg` →
`public/illustrations/rynke-push.svg`), overwriting an SVG of that name. Only
images belong in that folder; dotfiles are skipped. Commit the original and the
SVG together; to change an illustration, replace the original and run the
script again.

The script (`scripts/illustrations.mjs`) needs ImageMagick (`magick` or
`convert`) and potrace on the `PATH`; neither is a project dependency.

## What the script expects

- Flat colours on a plain white background, bold black outlines around every
  shape, no gradients, shading or drop shadows.
- Only the coin's colours (`--rp-coin-*` in `src/http/style.ts`): cream
  `#fffdf5`, yellow `#fbe122`, gold `#c99a2e`, fur `#c8641e`, muzzle `#f0a868`,
  blue `#8cc4f0`, ink `#1c1b13`. Every pixel is snapped to the nearest of these.
- White paper touching the image's edge is removed; cream inside an outline
  stays.
- Square, ideally 2048 × 2048 px (larger is scaled down). The SVG keeps the full
  canvas, 100 units wide, so illustrations generated on the same canvas keep
  the same scale relative to each other.

## Rider states (issue #93)

One image per `RiderStatus` in `src/rynke/pace.ts` (`push`, `on_track`, `in`).
Generated with Gemini, each prompt with `reference/rynke-coin-front.png` (the
front of `src/http/coin.ts`, rendered at 1024 px) attached as the character
reference.

### `push`

```text
Using the attached character as the exact reference (same head shape, orange fur, light muzzle, round black eyes, two-dot nose, yellow cycling helmet with three vents, yellow jersey), draw this character riding a road bike.

The bike: road bike with a yellow frame and fork (#FBE122), black handlebar tape, black saddle. Both wheels identical and WITHOUT spokes: a thick black tyre, a yellow rim ring inside it, a solid cream (#FFFDF5) inner disc and a small black hub dot in the center. No spokes, no spoke lines, no lacing.

Scene: grinding up a comically steep climb. Side view, bike tilted uphill about 20 degrees, rider standing out of the saddle, leaning far over the handlebars, legs mid-stomp. Funny over-the-top effort: cheeks puffed, eyes squeezed into determined arcs, tongue poking out of the corner of the mouth, one big sweat drop flying off the helmet. Cheeky and fighting, never sad. A banana sticks out of the back jersey pocket, peel flapping.

Mood: playful, cheeky cartoon with lots of personality, like a sticker you'd want to collect.

Style: flat vector-style illustration, identical to the reference. Bold uniform black outlines (#1C1B13) about 56 px thick on every shape, including around the yellow frame so it stays separate from the yellow jersey. Solid flat fills only, no gradients, no shading, no texture, no highlights, no drop shadow, no ground shadow. Use only these colors: yellow #FBE122, orange fur #C8641E, muzzle #F0A868, black #1C1B13, cream #FFFDF5, gold #C99A2E, light blue #8CC4F0 (sweat drop only).

Proportions: chibi, head about 40% of the figure height so the face reads at icon size. Few, large shapes.

Canvas: square 1:1, 2048 x 2048 px, plain pure white background. The whole rider and bike fit inside a centered circle of 1640 px diameter with even margins. No text, no border, no circle, no ground line, no background scenery.
```

### `on_track`

```text
Using the attached character as the exact reference (same head shape, orange fur, light muzzle, round black eyes, two-dot nose, yellow cycling helmet with three vents, yellow jersey), draw this character riding a road bike.

The bike: road bike with a yellow frame and fork (#FBE122), black handlebar tape, black saddle. Both wheels identical and WITHOUT spokes: a thick black tyre, a yellow rim ring inside it, a solid cream (#FFFDF5) inner disc and a small black hub dot in the center. No spokes, no spoke lines, no lacing.

Scene: cruising happily on a flat road. Side view, bike level, seated upright, hands on the brake hoods, steady pedalling. Eyes closed in happy upturned arcs, lips pursed, whistling a tune: one small black music note floating behind the head. Head tilted a little, bobbing to the beat. Three short horizontal motion lines behind the rear wheel, black. No sweat, no banana.

Mood: playful, cheeky cartoon with lots of personality, like a sticker you'd want to collect. Carefree, everything under control.

Style: flat vector-style illustration, identical to the reference. Bold uniform black outlines (#1C1B13) about 56 px thick on every shape, including around the yellow frame so it stays separate from the yellow jersey. Solid flat fills only, no gradients, no shading, no texture, no highlights, no drop shadow, no ground shadow. Use only these colors: yellow #FBE122, orange fur #C8641E, muzzle #F0A868, black #1C1B13, cream #FFFDF5, gold #C99A2E.

Proportions: chibi, head about 40% of the figure height so the face reads at icon size. Few, large shapes.

Canvas: square 1:1, 2048 x 2048 px, plain pure white background. The whole rider and bike fit inside a centered circle of 1640 px diameter with even margins. No text, no border, no circle, no ground line, no background scenery.
```

### `in`

```text
Using the attached character as the exact reference (same head shape, orange fur, light muzzle, round black eyes, two-dot nose, yellow cycling helmet with three vents, yellow jersey), draw this character riding a road bike.

The bike: road bike with a yellow frame and fork (#FBE122), black handlebar tape, black saddle. Both wheels identical and WITHOUT spokes: a thick black tyre, a yellow rim ring inside it, a solid cream (#FFFDF5) inner disc and a small black hub dot in the center. No spokes, no spoke lines, no lacing.

Scene: flat-out victory sprint. Side view, rider low in the drops with hands on the black handlebar tape, bike leaning forward, front wheel just lifting off in a tiny wheelie. Huge open-mouthed grin, eyes wide and sparkling with joy, fur tufts on the cheeks blown back by the wind. Four long horizontal speed lines behind the bike, black, and three small gold (#C99A2E) five-pointed stars bursting around the rider.

Mood: playful, cheeky cartoon with lots of personality, like a sticker you'd want to collect. Pure triumph, "I did it!".

Style: flat vector-style illustration, identical to the reference. Bold uniform black outlines (#1C1B13) about 56 px thick on every shape, including around the yellow frame so it stays separate from the yellow jersey. Solid flat fills only, no gradients, no shading, no texture, no highlights, no drop shadow, no ground shadow. Use only these colors: yellow #FBE122, orange fur #C8641E, muzzle #F0A868, black #1C1B13, cream #FFFDF5, gold #C99A2E.

Proportions: chibi, head about 40% of the figure height so the face reads at icon size. Few, large shapes.

Canvas: square 1:1, 2048 x 2048 px, plain pure white background. The whole rider and bike fit inside a centered circle of 1640 px diameter with even margins. No text, no border, no circle, no ground line, no background scenery.
```
