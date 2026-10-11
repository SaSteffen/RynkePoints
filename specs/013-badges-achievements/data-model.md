# Data Model: Badges art pipeline

Scope: the art pipeline (see [plan.md](plan.md)). Everything here is files in
the repo; nothing is stored in D1.

## Badge art entry (`art/badges/badges.json` → `badges[]`)

| Field | Type | Rules |
|-------|------|-------|
| `id` | string | Unique, `^[a-z0-9]+(-[a-z0-9]+)*$`. File name of the original and the finished SVG. |
| `group` | `"personal"` \| `"team"` | Picks the frame and the reference image. |
| `category` | string | One of the spec's categories (FR-010, FR-011), snake case. |
| `threshold` | number > 0 | The ladder step from the spec's Assumptions; strictly increasing within a category. |
| `scene` | string | Non-empty. May use `{{name}}` for snippets; every name must exist. No `{{scene}}`. |

Validation (`scripts/badge-prompts.mjs`, tested): unique ids, valid id format,
known group, thresholds increasing per category, every category in one group
only, every snippet reference resolves.

## Snippet (`badges.json` → `snippets`)

A named, shared description (`bike`, `runner`, `team`, `coins`) that scenes
pull in with `{{name}}`. Plain text, no placeholders of its own.

## Prompt template (`art/badges/prompt.txt`)

Plain text with exactly one `{{scene}}`. A badge's prompt is the template with
`{{scene}}` replaced by its scene, snippets already filled in. Each prompt is
self-contained (no reference to other prompts).

## Frame (`scripts/badge-frame.mjs`)

| Kind | Edge | Ring | Stars | Window |
|------|------|------|-------|--------|
| personal | 22 sunflower petals per layer: amber `#f0b400` back layer (gold veins), yellow `#fbe122` front layer (amber veins), ink outlines; tips at r 48.3 and 46.4 | ink `#1c1b13`, r 36.6 | 3 yellow, middle of the ring, at −26°, 0°, 26° | cream `#fffdf5`, r 28.7 at (50, 50), ink outline |
| team | same | team blue `#8cc4f0`, ink outline | same | same |

Ribbon (optional, FR-040b): a band at x 13 to 87, y 70 to 84, with notched tails
out to x 3 and 97, in the ring colour with ink outlines, over the bottom 15 % of
the window. No text; the page writes the milestone into the band.

ViewBox `0 0 100 100`. The window clips the picture. Radii measured from
`art/badges/reference/` (T009); the picture transform (research R4) follows the
window radius.

## Picture

The traced Gemini image: layers of flat paths in the coin palette over the full
2048 px canvas, 100 units wide (R4, R5). Placed into the window with the fixed
transform of R4.

## Original (`art/badges/originals/<id>.png`)

States: missing → downloaded (raw, local only) → snapped (committed, indexed PNG,
7 colours, ≤ 2048 px). A retake replaces it.

## Finished badge (`public/badges/<id>.svg`)

Frame plus picture, self-contained, explicit colours, `<title>` with the id
(the app's `alt` text carries the localized name). Exists exactly when the
original exists.

## Placeholder (`public/badges/placeholder-{personal,team}.svg`)

Frame plus the coin's Rynke; identical to the reference images in
`art/badges/reference/`.

## Picture list (`src/badges/pictures.ts`, generated)

`BADGE_PICTURES: ReadonlySet<string>`: the ids with a finished badge, sorted.
Rewritten by every `pnpm badge-build`; committed.
