# Contract: Design Tokens

**Feature**: [../spec.md](../spec.md) | **Research**: R4, R5, R6, R14

Every value the pages draw from, as CSS custom properties defined once in
`src/http/style.ts` (FR-031). Rules outside the token block use only `var(--…)`.
`test/unit/design-tokens.test.ts` checks:

- both schemes define the same set of names;
- the contrast pairs at the end hold.

Source: the Claude Design mock-up "RynkePoints App Shell" (research intro), in
Team Rynkeby's colours since issue #51: yellow `#fbe122`, black and green
`#0f4f25`. On light ground yellow is a fill, never text; the links, buttons and
headings are black there, yellow in the dark scheme.

## Colour roles

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--md-sys-color-surface` | `#fffdf5` | `#12110c` | page background |
| `--md-sys-color-surface-container-low` | `#fcf9ec` | `#1a1913` | breakdown, outlined cards |
| `--md-sys-color-surface-container` | `#f6f2e0` | `#201f18` | cards, top bar, nav bar |
| `--md-sys-color-surface-container-high` | `#efead3` | `#2b2a21` | pressed and hover states |
| `--md-sys-color-on-surface` | `#1c1b13` | `#eeebdd` | body text |
| `--md-sys-color-on-surface-variant` | `#4a4633` | `#cec9b3` | secondary text, inactive tabs |
| `--md-sys-color-outline` | `#7a755c` | `#979279` | outlined buttons, switch off |
| `--md-sys-color-outline-variant` | `#d3cdb2` | `#4a4633` | dividers |
| `--md-sys-color-primary` | `#1c1b13` | `#fbe122` | links, wordmark "Points", switch on |
| `--md-sys-color-on-primary` | `#fbe122` | `#1c1b13` | text on primary, switch thumb |
| `--md-sys-color-primary-container` | `#fbe122` | `#fbe122` | verdict card |
| `--md-sys-color-on-primary-container` | `#1c1b13` | `#1c1b13` | verdict text, "missing" chips |
| `--md-sys-color-secondary-container` | `#fbe122` | `#fbe122` | nav active pill, selected segment |
| `--md-sys-color-on-secondary-container` | `#1c1b13` | `#1c1b13` | text on it |
| `--md-sys-color-error` | `#ba1a1a` | `#ffb4ab` | "Disconnect and delete my data" |
| `--md-sys-color-error-container` | `#ffdad6` | `#93000a` | reconnect notice, "doesn't count" chip |
| `--md-sys-color-on-error-container` | `#410002` | `#ffdad6` | text on it |
| `--rp-ok-container` | `#e7eee8` | `#173a22` | "counts" chip |
| `--rp-on-ok-container` | `#0f4f25` | `#bfe3c6` | text on it |
| `--rp-neutral-container` | `#efead3` | `#2e2c22` | "being evaluated" chip |
| `--rp-on-neutral-container` | `#4a4633` | `#cec9b3` | text on it |
| `--rp-brand` | `#fc5200` | `#fc5200` | Strava orange where Strava's own colour is meant |

## Gauge colours (feature 005's key, FR-035)

| Token | Light | Dark | Part |
|---|---|---|---|
| `--rp-part-1` | `#fbe122` | `#fbe122` | distance (Rynkeby yellow) |
| `--rp-part-2` | `#8cc4f0` | `#8cc4f0` | elevation |
| `--rp-part-3` | `#ff9a4d` | `#ff9a4d` | team training |
| `--rp-part-4` | `#6fd1c2` | `#6fd1c2` | training-weekend day |
| `--rp-part-5` | `#d7a6ec` | `#d7a6ec` | technique training |
| `--rp-part-6` | `#a8a6a0` | `#a8a6a0` | corrections (feature 003 Story 6) |
| `--rp-reached` | `#7fcb92` | `#7fcb92` | reached gauge |
| `--rp-track` | `#1c1b13` | `#3a382c` | gauge track |

Parts are separated by a 2 px border in `--md-sys-color-surface-container`, the
card colour behind the gauge. The light track is black like the coin's ring.

## Coin colours (feature 012)

`--rp-coin-rim` `#c99a2e`, `--rp-coin-ink` `#1c1b13`, `--rp-coin-face` `#fffdf5`,
`--rp-coin-yellow` `#fbe122`, `--rp-coin-fur` `#c8641e`, `--rp-coin-muzzle`
`#f0a868`, `--rp-coin-sky` `#a9d6f2`, `--rp-coin-glass` `#e8f3fb`,
`--rp-coin-brick` `#b5562f`, `--rp-coin-water` `#3a8fd0`, `--rp-coin-team`
`#8cc4f0`: the same in both schemes, so the coin looks like the coin. The hero card
uses rim, ink, face and yellow too.

## Scheme selection

- `:root` holds the light values, with `color-scheme: light dark`.
- The dark values go under
  `@media (prefers-color-scheme: dark) { :root:not([data-scheme=light]) }` and
  under `:root[data-scheme=dark]`.
- `[data-scheme]` is set before paint by the head script
  ([client.md](client.md)).

## Type scale (system font stack, FR-037)

`--md-ref-typeface: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.
`body` sets `font-variant-numeric: tabular-nums` (FR-036).

| Token | Size / line height | Weight | Used for |
|---|---|---|---|
| `--md-type-display` | 36 / 44 px | 600 | Overview totals (40 px at ≥ 600 px) |
| `--md-type-headline` | 28 / 34 px | 600 | Page `h1` on public pages |
| `--md-type-title-large` | 22 / 28 px | 600 | Section `h1` in the shell |
| `--md-type-title` | 16 / 24 px | 600 | Card headings (`h2`) |
| `--md-type-body-large` | 16 / 24 px | 400 | Body text |
| `--md-type-body` | 14 / 20 px | 400 | Secondary text, lists |
| `--md-type-label` | 14 / 20 px | 500 | Buttons, chips, tabs (wide) |
| `--md-type-label-small` | 12 / 16 px | 500 | Nav labels (bottom bar), ride status chip |
| `--md-type-caption` | 13 / 18 px | 400 | Gauge legend, figure notes |

## Spacing and layout

| Token | Value |
|---|---|
| `--rp-space-1` … `--rp-space-6` | 4, 8, 12, 16, 24, 32 px |
| `--rp-page-padding` | 16 px (< 600 px), 32 px (≥ 600 px) |
| `--rp-content-max` | 1040 px; the Overview uses 2 columns at ≥ 600 px, the other sections 1 column at max 640 px |
| `--rp-tap` | 44 px, the minimum height and width of every control (FR-022) |
| `--rp-nav-height` | 80 px, plus `env(safe-area-inset-bottom)` (< 600 px) |
| `--rp-topbar-height` | 64 px at every width (Material 3 small top app bar; pinned since #62), plus `env(safe-area-inset-top)` |
| Breakpoint | 600 px (`@media (min-width: 600px)`) |

## Shapes

| Token | Value | Used for |
|---|---|---|
| `--md-shape-xs` | 4 px | gauge-step bar |
| `--md-shape-sm` | 8 px | chips, gauge bar ends |
| `--md-shape-md` | 12 px | — |
| `--md-shape-lg` | 16 px | cards, notices |
| `--md-shape-full` | 9999 px | buttons, segmented buttons, nav pill, switch |

## Motion (FR-038)

`--rp-motion: 150ms ease-out`, used only for the nav pill, the switch thumb and
the details chevron. `@media (prefers-reduced-motion: reduce)` sets
`transition: none` on them.

## Contrast pairs checked by the test (FR-033, SC-006)

The test checks these in both schemes.

At least 4.5 : 1:

- `on-surface` / `surface`
- `on-surface-variant` / `surface`, `surface-container`
- `primary` / `surface`, `surface-container`
- `on-primary-container` / `primary-container`
- `on-secondary-container` / `secondary-container`
- `on-error-container` / `error-container`
- `error` / `surface`
- `on-primary` / `primary`
- `rp-on-ok-container` / `rp-ok-container`
- `rp-on-neutral-container` / `rp-neutral-container`

At least 3 : 1:

- `outline` / `surface`

Gauge parts are not in the list: FR-033 covers text, icons and control outlines,
and each part's value is also given as text in the legend. `#fc5200` on the light
card is about 2.9 : 1. The test only checks that the parts differ from each other
and from `rp-track` (FR-035).
