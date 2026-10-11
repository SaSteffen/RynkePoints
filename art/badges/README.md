# Art: badge pictures (feature 013)

A badge is two parts:

- **The frame**, drawn exactly in SVG like the coin, never by the image
  generator (its circles are never round): an edge of yellow sunflower petals,
  a ring with three yellow stars at the top and a round cream window. Personal
  badges have a black ring, team badges a light blue one. With the coin's Rynke
  in the window, the frame is the placeholder for every badge without a picture
  of its own.
- **The picture** inside the window, one per badge, generated with Gemini and
  traced into a flat SVG.

## Files

- `badges.json`: every badge (id, group, category, threshold) with its scene,
  the ladders of the spec (`specs/013-badges-achievements/spec.md`,
  Assumptions). `snippets` are shared descriptions (bike, runner outfit, team,
  coins) that scenes pull in with `{{name}}`.
- `prompt.txt`: the prompt every badge uses; `{{scene}}` is the badge's scene.
  Each prompt is self-contained, so any one badge can be made again on its own.
- `reference/badge-*.png`: the badge design with the coin's Rynke, 1024 px,
  attached to every prompt as the character and style reference (`personal` or
  `team` by the badge's group). Made by hand (Gemini, then edited); the frame in
  code follows this design.
- `originals/`: the generator's raster originals, `<id>.png` (or `.jpg`).

## Making the pictures

```bash
pnpm badge-art                      # every badge without an original
pnpm badge-art distance-100 running-10
pnpm badge-art --force distance-100 # a new take of one badge
pnpm badge-art --print distance-100 # just print the prompt to paste by hand
```

For each badge the script opens a fresh Gemini chat in Chrome, attaches the
reference, pastes the prompt, waits for the image (up to 5 minutes), downloads
it at full size into `originals/` and moves on after a pause. It skips badges
that already have an original, so an interrupted run just continues. Look at
each picture; to retry one, delete it or use `--force`.

- **Sign-in**: the first run opens Chrome with its own profile
  (`~/.cache/rynkepoints/gemini-profile`, outside the repo) and waits up to 10
  minutes for you to sign in to Google; later runs stay signed in. It needs
  Google Chrome installed (`--browser chromium` uses Playwright's Chromium,
  where Google may refuse the sign-in).
- **If Google refuses the sign-in** in the automated window, start Chrome
  yourself with a separate profile, sign in there once, and attach to it:

  ```bash
  google-chrome --remote-debugging-port=9222 \
    --user-data-dir="$HOME/.cache/rynkepoints/gemini-chrome"
  pnpm badge-art --cdp http://127.0.0.1:9222
  ```

- **If Gemini's page changed** and a step fails, the script saves a screenshot
  to the temp folder (`/tmp/rynkepoints-badge-art/<id>.png`) and continues with
  the next badge. The page selectors are in `SELECTORS` at the top of
  `scripts/badge-art.mjs`.
- **Usage limit**: when Gemini says the image limit is reached, the run stops;
  run it again later and it picks up where it stopped.
- When the full-size download fails, the script keeps the preview image instead
  and says so; it is smaller but usually still traces well.

## Tracing

The originals go through the same tracer as the rider-state illustrations
(`scripts/illustrations.mjs`, PR #101): white paper removed, colours snapped to
the coin palette, one potrace layer per colour. The removed paper lets the
window's cream show through. The tracer currently reads `art/illustrations/`
only; pointing it at `art/badges/originals/` with `public/badges/` as output is
part of implementing this feature, after #101 is merged.

## Checking a picture

- Rynke looks like the reference (helmet with three vents, orange fur, light
  muzzle); team pictures show several copies of him.
- No frame, ring or circle drawn around the scene; nothing important near the
  edge, as the window crops it round.
- Detailed enough to enjoy at full size (the badge opens large), with the main
  subject still clear; no text or numbers.
