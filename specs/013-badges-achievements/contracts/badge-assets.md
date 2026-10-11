# Contract: Badge assets and commands

Scope: the art pipeline (see [../plan.md](../plan.md)). This is the interface
between the pipeline and the app's Badges section, and the command-line
interface of the scripts.

## Files the app uses

| Path | Content |
|------|---------|
| `public/badges/<id>.svg` | Finished badge for a badge with a picture. |
| `public/badges/placeholder-personal.svg` | Personal frame with the coin's Rynke. |
| `public/badges/placeholder-team.svg` | Team frame with the coin's Rynke. |
| `src/badges/pictures.ts` | `export const BADGE_PICTURES: ReadonlySet<string>`, generated. |

The app picks `/badges/<id>.svg` when `BADGE_PICTURES.has(id)`, else the
placeholder of the badge's group. It only ever references badges the rider sees
as earned (FR-003, SC-003).

## Finished badge SVG

- Root: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">`, square,
  no `width`/`height` (the page sizes it: 64, 128 or 280 px, FR-002a/b).
- First child `<title>`: the badge id. Then a comment naming the original and the
  command that made it.
- Self-contained: explicit hex fills from the coin palette only, no CSS
  variables, no external references, no scripts, no `<image>`.
- Layers in order: frame edge, ring, window, picture group
  (`clip-path` = window circle, `transform` per research R4), stars.
- At most 60 KB.

## `pnpm badge-art` (exists)

```text
pnpm badge-art [id ...] [--force] [--print] [--cdp <url>]
               [--profile <dir>] [--browser chrome|chromium]
               [--pause <seconds>] [--timeout <seconds>]
```

- No ids: every badge without an original. Unknown id: exit 2, nothing done.
- Writes `art/badges/originals/<id>.<ext>` (raw download).
- `--print`: prints each chosen badge's reference path and prompt; no browser.
- Exit 0 when every chosen badge got an image, 1 otherwise (failures listed;
  screenshots in `<tmp>/rynkepoints-badge-art/`).

## `pnpm badge-build` (new)

```text
pnpm badge-build
```

1. Validates `badges.json` and `prompt.txt` (exit 2 on any error, nothing
   written).
2. Writes `art/badges/reference/badge-{personal,team}.{svg,png}` (PNG 1024 px
   via `rsvg-convert`) and `public/badges/placeholder-{personal,team}.svg`.
3. Snaps every original in `art/badges/originals/` to the palette, in place
   (research R7); an original whose id isn't in `badges.json` is an error.
4. Traces each original and writes `public/badges/<id>.svg`; removes finished
   SVGs whose original is gone.
5. Writes `src/badges/pictures.ts`.
6. Prints one line per badge with its size; warns above 60 KB.

Needs `rsvg-convert`, ImageMagick and potrace, like `pnpm icons` and
`pnpm illustrations`. Running it twice without changes changes no file.

## Pure modules (tested in Vitest)

- `scripts/badge-prompts.mjs`
  - `validateBadges(data) → string[]`: problems, empty when valid (data model rules).
  - `buildPrompt(template, snippets, badge) → string`.
- `scripts/badge-frame.mjs`
  - `WINDOW = { cx: 50, cy: 50, r: 31 }`, `PICTURE_TRANSFORM` (research R4).
  - `RYNKE`: the coin's Rynke markup.
  - `frameSvg(kind, pictureMarkup, title) → string`: the finished badge SVG.
