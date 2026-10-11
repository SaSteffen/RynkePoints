# Quickstart: validating the badges art pipeline

Scope: the art pipeline (see [plan.md](plan.md)). Details of files and commands
are in [contracts/badge-assets.md](contracts/badge-assets.md).

## Prerequisites

- `pnpm install`; Google Chrome; a Google account with Gemini image generation.
- ImageMagick and potrace on the `PATH` (`pacman -S imagemagick potrace`).

## 1. Pure parts

```bash
pnpm test badge
```

Expected: `badge-prompts` and `badge-frame` tests pass (validation, prompt
assembly, coin Rynke match, composition).

## 2. Frames and placeholders

```bash
pnpm badge-build
```

Expected: `public/badges/placeholder-*.svg` written;
with no originals, `src/badges/pictures.ts` lists nothing. Open both
placeholders next to `art/badges/reference/`: same design (petals, ring, three
stars), Rynke centred in the window, personal black ring, team light blue ring. Run it again: `git status` shows no
change.

## 3. One picture end to end

```bash
pnpm badge-art distance-100
```

Expected: Chrome opens; on the first run, sign in to Google and the script
continues by itself. A new Gemini chat gets the personal reference and the
prompt; the image lands in `art/badges/originals/distance-100.png`. Then:

```bash
pnpm badge-build
```

Expected: the original is snapped in place (a few hundred KB at most),
`public/badges/distance-100.svg` exists (under 60 KB) and
`src/badges/pictures.ts` lists `distance-100`. Open the SVG at 64, 128 and 280 px
in a browser: picture inside the window, nothing cut off that matters, no white
halo, outlines crisp; it looks the same on a light and a dark background.

## 4. Resume and limits

- Interrupt `pnpm badge-art` (Ctrl+C) during a run and start it again: badges
  already saved are skipped.
- `pnpm badge-art --print team-running-500`: prints the prompt and the team
  reference path, opens no browser.
- `pnpm badge-art nope`: exits with code 2.

## 5. A retake

Delete `art/badges/originals/distance-100.png` (or `pnpm badge-art --force
distance-100`), generate again, `pnpm badge-build`: the SVG changes, the list
stays the same.
