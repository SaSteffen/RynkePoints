# Data Model: Themes and Controls

No database change, no migration, nothing on the server. Everything below
lives in code or in the browser of one device.

## Theme (code: `src/http/themes.ts`)

| Field | Type | Notes |
|-------|------|-------|
| `id` | `ThemeId` | one of the twelve ids in contracts/themes.md |
| `group` | `"light" \| "dark" \| "contrast"` | menu group |
| `scheme` | `"light" \| "dark"` | base scheme: sets `data-scheme`, Strava image variant, `color-scheme` |
| `fun` | `"confetti" \| "disco" \| null` | decorations and page-switch show |
| `tokens` | `Record<string, string>` | overrides of the base scheme's tokens; empty for `rynke-day` and `rynke-night` |
| `preview` | `{ bg, hero, pc, primary, card, text }` | menu tile colours |

Rules: exactly twelve; `rynke-day`/`rynke-night` have no overrides (FR-017);
the contrast themes set `--rp-outline-width: 2px`. The stylesheet, the head
script's id → [scheme, bg] table, the menu and the contrast test all read this
list.

## Theme choice (browser, per device)

| Key | Store | Values |
|-----|-------|--------|
| `rp-theme` | localStorage | a `ThemeId`; absent = Automatisch |
| `rp-scheme` | localStorage | legacy (011): `light`/`dark`; read once, mapped to `rynke-day`/`rynke-night`, removed |

State on `<html>`: `data-theme` (absent for Automatisch), `data-scheme`
(absent for Automatisch), `data-show` (only between the arriving page's first
paint and `app.js` taking the show over).

Transitions:

```text
(none) ──pick theme──▶ rp-theme=<id>
rp-theme=<id> ──pick Automatisch──▶ (none)
rp-scheme=light|dark (no rp-theme) ──any page load──▶ rp-theme=rynke-day|rynke-night
unknown id / storage blocked ──▶ treated as (none)
```

## Show hand-over (browser, per tab)

| Key | Store | Value | Life |
|-----|-------|-------|------|
| `rp-show` | sessionStorage | `<confetti\|disco>:<epoch ms>` | written at the switch moment, removed by the next page's head script; ignored after 10 s |

## Show pictures (code, generated)

`SHOW_PICTURES: readonly ("unicorn" | "disco")[]` in
`src/http/show-pictures.ts`, the ids with a built `public/shows/<id>.svg`.
