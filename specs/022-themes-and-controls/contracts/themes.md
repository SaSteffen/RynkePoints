# Contract: The Twelve Themes

Source: canvas board "Alle zwölf Themes" (Gallery), read 2026-10-22. Where this
table and the canvas disagree, the canvas wins (spec, "The design draft is
binding").

## Ids, names, base scheme

| Id | de | en | Group | Base scheme | Fun |
|----|----|----|-------|-------------|-----|
| `rynke-day` | Rynke Tag | Rynke Day | light | light | – |
| `baltic` | Ostsee | Baltic | light | light | – |
| `paris` | Paris | Paris | light | light | – |
| `lilac` | Flieder | Lilac | light | light | – |
| `confetti` | Konfetti | Confetti | light | light | yes |
| `rynke-night` | Rynke Nacht | Rynke Night | dark | dark | – |
| `night-ride` | Nachtfahrt | Night Ride | dark | dark | – |
| `forest` | Wald | Forest | dark | dark | – |
| `plum` | Pflaume | Plum | dark | dark | – |
| `disco` | Disco | Disco | dark | dark | yes |
| `contrast-light` | Kontrast hell | High contrast light | contrast | light | – |
| `contrast-dark` | Kontrast dunkel | High contrast dark | contrast | dark | – |

Order in the menu: as listed, groups Hell, Dunkel, Hoher Kontrast. Automatisch
is `rynke-day` or `rynke-night` by the device's mode and is not a theme of its
own.

## Canvas roles → tokens

| Canvas role | Token |
|-------------|-------|
| `bg` | `--md-sys-color-surface` (and the `theme-color` meta) |
| `low` | `--md-sys-color-surface-container-low` |
| `card` | `--md-sys-color-surface-container` |
| `text` | `--md-sys-color-on-surface` |
| `muted` | `--md-sys-color-on-surface-variant` |
| `outline` | `--md-sys-color-outline` |
| `outlineVar` | `--md-sys-color-outline-variant` |
| `primary` | `--md-sys-color-primary` |
| `onPrimary` | `--md-sys-color-on-primary` |
| `primaryText` | `--rp-primary-text` (new) |
| `pc` | `--md-sys-color-primary-container`, `--md-sys-color-secondary-container` |
| `onPc` | `--md-sys-color-on-primary-container`, `--md-sys-color-on-secondary-container` |
| `hero` | `--rp-hero` |
| `heroText` | `--rp-on-hero` (new) |
| `heroLabel` | `--rp-hero-label` |
| `heroAccent` | `--rp-hero-accent` (new) |
| `track` | `--rp-track` |
| `fill` | `--rp-reached` (fun themes: the rainbow, see fun-decorations.md) |
| `high` (menu panel, Main board) | `--md-sys-color-surface-container-high` |

New tokens in Rynke Tag and Rynke Nacht, set to the values used today:
`--rp-on-hero: var(--rp-coin-face)`, `--rp-hero-accent: var(--rp-coin-yellow)`,
`--rp-primary-text: var(--md-sys-color-primary)`. Every rule that today colours
hero text with `--rp-coin-face` / `--rp-coin-yellow`, and every link, outlined
or text button, summary and the open filter with `--md-sys-color-primary` as
text, uses the new tokens instead.

## Values

Rynke Tag and Rynke Nacht are today's light and dark token sets with the
canvas's values where they differ (FR-017, research R4), changed in the base
light and dark rules:

| Token | Rynke Tag (today → canvas) | Rynke Nacht (today → canvas) |
|-------|----------------------------|------------------------------|
| `--rp-track` | #1c1b13 → #e3dcc0 | #3a382c (unchanged) |
| `--rp-reached` (gauge fill) | #7fcb92 → #1c1b13 | #7fcb92 → #fbe122 |

Every other Rynke Tag/Nacht role on the canvas equals today's value.
The other ten themes:

| Role | Ostsee | Paris | Flieder | Konfetti | Nachtfahrt | Wald | Pflaume | Disco | Kontrast hell | Kontrast dunkel |
|------|--------|-------|---------|----------|------------|------|---------|-------|---------------|-----------------|
| bg | #f5fafb | #fff8f7 | #fcf8ff | #fffcf7 | #0e131c | #0f1612 | #140e19 | #120a22 | #ffffff | #000000 |
| low | #eef6f8 | #fcf0ef | #f7f1fd | #fff4fa | #141a25 | #151e19 | #1b1421 | #180f2c | #ffffff | #000000 |
| card | #e3eff3 | #f8e6e6 | #f0e7fa | #f7efff | #19212e | #1a251f | #211928 | #1f1436 | #ffffff | #000000 |
| text | #0e1d24 | #26181a | #1e1528 | #23163a | #e6ecf5 | #e3eee6 | #efe6f5 | #f4ecff | #000000 | #ffffff |
| muted | #3b525c | #5a3f43 | #4d3f5c | #54467a | #b7c3d4 | #b7c9bd | #cdbfd8 | #cdbde8 | #1a1a1a | #f2f2f2 |
| outline | #6b828c | #87696d | #7c6c8c | #7d6fa6 | #7f8ca0 | #82978a | #9a8aa8 | #9a88bf | #000000 | #ffffff |
| outlineVar | #c3d5dc | #e0c4c7 | #d8cbe6 | #ddd1f5 | #364256 | #344238 | #43354f | #3f2d62 | #000000 | #ffffff |
| primary | #0b5874 | #7a1d3b | #5e3a8c | #5a22d6 | #8cc4f0 | #7fcb92 | #d7a6ec | #ff5cb8 | #000000 | #ffe600 |
| onPrimary | #ffffff | #ffffff | #ffffff | #ffffff | #08243a | #0a2614 | #2e0a3d | #2a0018 | #ffffff | #000000 |
| primaryText | #0b5874 | #7a1d3b | #5e3a8c | #5a22d6 | #8cc4f0 | #7fcb92 | #d7a6ec | #ff8fd1 | #000000 | #ffe600 |
| pc | #ffd45c | #ffd9df | #e6d4ff | #ffe61a | #8cc4f0 | #7fcb92 | #d7a6ec | #ff5cb8 | #ffe600 | #ffe600 |
| onPc | #2a1f00 | #3e0018 | #240a45 | #2b1d00 | #08243a | #0a2614 | #2e0a3d | #2a0018 | #000000 | #000000 |
| hero | #0b3a4d | #3a1420 | #2c1a42 | #2b1460 | #1b2a3e | #1d2c22 | #2a1a36 | #24124a | #000000 | #000000 |
| heroText | #f5fafb | #fff8f7 | #fcf8ff | #fffcf7 | #e6ecf5 | #e3eee6 | #efe6f5 | #f4ecff | #ffffff | #ffffff |
| heroLabel | #bfe0ea | #f2c6cf | #dccbf2 | #dccfff | #b7c3d4 | #bfe3c6 | #d8c6e6 | #d8c8f5 | #ffffff | #ffffff |
| heroAccent | #ffd45c | #ffb3c2 | #fbe122 | #ffe61a | #fbe122 | #fbe122 | #fbe122 | #ffe61a | #ffe600 | #ffe600 |
| track | #c3d5dc | #e0c4c7 | #d8cbe6 | #ece4fb | #2a3446 | #2c3a31 | #33283d | #2f2150 | #ffffff | #000000 |
| fill | #0b8fb3 | #b0365c | #7d52b8 | rainbow | #8cc4f0 | #7fcb92 | #d7a6ec | rainbow | #000000 | #ffe600 |

`surface-container-high` (the menu panel) is a step from `card` toward `text`
as in the base schemes; the implementer sets it per theme and lists it here.

## Contrast themes: the rest of the roles

From the canvas board "Ein Satz Bedienelemente" (Kontrast dunkel column) and
the gallery:

| Token | Kontrast hell | Kontrast dunkel |
|-------|---------------|-----------------|
| `--rp-outline-width` | 2px | 2px |
| `--rp-ok-container` / `--rp-on-ok-container` | #ffffff / #0a5c26 | #000000 / #7dff9a |
| `--md-sys-color-error` | #b00000 | #ff8a80 |
| `--md-sys-color-error-container` / on | #ffffff / #b00000 | #000000 / #ff8a80 |
| `--rp-neutral-container` / on | #ffffff / #000000 | #000000 / #ffffff |
| Status chips, tracks, nav pill | 2px solid currentColor edge | same |
| Text buttons | underlined | underlined |

The hell column's ok and error values are not on the canvas (it shows only
Kontrast dunkel); they are chosen to reach 7 : 1 on white and checked by the
contrast test.

## Other tokens

Every token not named above keeps its base scheme's value in each theme,
unless the contrast test (research R10) fails for that theme; the value then
chosen is added to this contract with the change that introduces it.

## Theme colour

`<meta name="theme-color">` gets the theme's `bg` (FR-019); Automatisch keeps
today's two metas with `media`.
