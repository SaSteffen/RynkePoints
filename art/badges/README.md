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
- `originals/`: one original per badge, `<id>.png`, snapped to the palette by
  `pnpm badge-build` (a fresh download may be `.png` or `.jpg` until then).
- `scripts/badge-prompts.mjs` checks `badges.json` and assembles the prompts;
  `pnpm badge-art` and `pnpm badge-build` refuse to run when it finds a
  problem. `scripts/badge-frame.mjs` draws the frame.

## Making the pictures

```bash
pnpm badge-art                      # every badge without an original
pnpm badge-art distance-100 running-10
pnpm badge-art --force distance-100 # a new take of one badge
pnpm badge-art --print distance-100 # just print the prompt to paste by hand
```

For each badge the script opens a fresh Gemini chat in Chrome, attaches the
reference, pastes the prompt, waits for the image (up to 5 minutes) and
downloads it at full size into `originals/`. It skips badges that already have
an original, so an interrupted run just continues.

To go easy on Gemini it works strictly one badge at a time, in one tab:

- 3 to 8 seconds between the steps of a badge (open, attach, paste, send,
  download): `--step 3-8`;
- 90 to 180 seconds between badges, twice that after a failure: `--pause 90-180`;
- at most 10 badges per run, then it stops; run it again later: `--max 10`.

Each wait is a random point in its range. A full set of 121 badges takes 13 runs
of about half an hour each. Look at
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
- **Busy**: when Gemini asks to be asked again later ("more images than
  usual"), the script rests 2 to 5 minutes and asks again in the same chat, up
  to 3 times (`--busy 120-300`, `--retries 3`); then that badge counts as
  failed and the run goes on.
- When the full-size download fails, the script keeps the preview image instead
  and says so; it is smaller but usually still traces well.

## Tracing

`pnpm badge-build` builds every badge; `pnpm badge-build distance-100` only
rebuilds the named ones (quick for a retake). Both keep the picture list
complete.

It writes the two placeholders (`public/badges/placeholder-{personal,team}.svg`),
then for each original:

1. snaps it to the coin palette in place, as `originals/<id>.png` (about 50 KB
   instead of 1 to 2 MB; snapping again changes nothing). The raw download stays
   on your machine in `~/.cache/rynkepoints/badge-art/raw/`;
2. traces it with the same tracer as the rider-state illustrations
   (`scripts/trace.mjs`): white paper removed, one potrace layer per colour; the
   removed paper lets the window's cream show through;
3. puts the picture into the frame (`scripts/badge-frame.mjs`) as
   `public/badges/<id>.svg`, without the milestone ribbon: the page draws the
   ribbon over the picture and writes the milestone onto it;
4. lists every badge with a picture in `src/badges/pictures.ts`, which the app
   reads to pick the picture or the placeholder.

A run without ids also removes badge SVGs whose original is gone. It needs
ImageMagick and potrace, like `pnpm illustrations`, and a second run without
changes changes no file. Commit the originals, `public/badges/` and
`src/badges/pictures.ts` together.

## Checking a picture

- Rynke looks like the reference (helmet with three vents, orange fur, light
  muzzle); team pictures show several copies of him.
- No frame, ring or circle drawn around the scene; nothing important near the
  edge, as the window crops it round, and nothing at all in the bottom 15 %
  of the circle, where the milestone ribbon goes (spec FR-040b): the prompt
  asks for the bottom fifth of the canvas to stay empty, for some margin.
- Detailed enough to enjoy at full size (the badge opens large), with the main
  subject still clear; no text or numbers.
