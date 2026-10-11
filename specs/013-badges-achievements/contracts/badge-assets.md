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
               [--step <s>] [--pause <s>] [--max <n>] [--timeout <seconds>]
```

- Sequential: one badge at a time, one tab, never two chats at once.
- Pacing (seconds, fixed or a random range): `--step` between the steps of a
  badge (default `3-8`), `--pause` between badges (default `90-180`, doubled
  after a failure), `--max` badges per run (default 10; the rest is left for
  the next run). A malformed value exits 2 before the browser opens.

- No ids: every badge without an original. Unknown id: exit 2, nothing done.
- Writes `art/badges/originals/<id>.<ext>` (raw download).
- `--print`: prints each chosen badge's reference path and prompt; no browser.
- Exit 0 when every chosen badge got an image, 1 otherwise (failures listed;
  screenshots in `<tmp>/rynkepoints-badge-art/`).

## `pnpm badge-build` (new)

```text
pnpm badge-build [id ...]
```

Without ids it builds every badge. With ids, steps 3 and 4 only handle those
badges (the slow part); everything else still runs in full.

1. Validates `badges.json` and `prompt.txt`, always in full (exit 2 on any
   error, nothing written). An unknown id is an error too (exit 2).
2. Writes `public/badges/placeholder-{personal,team}.svg` (the reference
   images in `art/badges/reference/` are hand-made and not touched).
3. Snaps every original in `art/badges/originals/` (with ids: only theirs) to
   the palette, in place (research R7); an original whose id isn't in
   `badges.json` is an error. A named id without an original is skipped with a
   note.
4. Traces each of those originals and writes `public/badges/<id>.svg`. Only a
   run without ids removes finished SVGs whose original is gone, so a filtered
   run never deletes another badge.
5. Writes `src/badges/pictures.ts` from every finished SVG in `public/badges/`,
   so the list stays complete after a filtered run.
6. Prints one line per badge it built with its size; warns above 60 KB.

Needs ImageMagick and potrace, like `pnpm illustrations`. Running it twice without changes changes no file.

## Pure modules (tested in Vitest)

- `scripts/badge-prompts.mjs`
  - `validateBadges(data) → string[]`: problems, empty when valid (data model rules).
  - `buildPrompt(template, snippets, badge) → string`.
- `scripts/badge-frame.mjs`
  - `WINDOW = { cx: 50, cy: 50, r }`, `PICTURE_TRANSFORM` (research R4).
  - `RYNKE`: the coin's Rynke markup.
  - `frameSvg(kind, pictureMarkup, title) → string`: the finished badge SVG.
