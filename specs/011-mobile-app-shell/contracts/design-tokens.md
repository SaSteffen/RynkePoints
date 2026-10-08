# Contract: Design Tokens

**Feature**: [../spec.md](../spec.md) | **Research**: R4, R5, R6, R14

Every value the pages draw from, as CSS custom properties defined once in
`src/http/style.ts` (FR-031). Rules outside the token block use only `var(--…)`.
`test/unit/design-tokens.test.ts` checks:

- both schemes define the same set of names;
- the contrast pairs at the end hold.

Source: the Claude Design mock-up "RynkePoints App Shell" (research intro).

## Colour roles

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--md-sys-color-surface` | `#fff8f6` | `#1a110e` | page background |
| `--md-sys-color-surface-container-low` | `#fff1ec` | `#231917` | breakdown, outlined cards |
| `--md-sys-color-surface-container` | `#fceae5` | `#271d1a` | cards, top bar, nav bar |
| `--md-sys-color-surface-container-high` | `#f6e5df` | `#322824` | pressed and hover states |
| `--md-sys-color-on-surface` | `#231917` | `#f1dfd9` | body text |
| `--md-sys-color-on-surface-variant` | `#53433e` | `#d8c2bb` | secondary text, inactive tabs |
| `--md-sys-color-outline` | `#85736d` | `#a08d86` | outlined buttons, switch off |
| `--md-sys-color-outline-variant` | `#d8c2bb` | `#53433e` | dividers |
| `--md-sys-color-primary` | `#a63b00` | `#ffb59b` | links, wordmark "Points", switch on |
| `--md-sys-color-on-primary` | `#ffffff` | `#5b1a00` | text on primary, switch thumb |
| `--md-sys-color-primary-container` | `#ffdbcf` | `#812900` | verdict card |
| `--md-sys-color-on-primary-container` | `#380d00` | `#ffdbcf` | verdict text, "missing" chips |
| `--md-sys-color-secondary-container` | `#f7d6c9` | `#5d4035` | nav active pill, selected segment |
| `--md-sys-color-on-secondary-container` | `#2c160d` | `#ffdbcf` | text on it |
| `--md-sys-color-error` | `#ba1a1a` | `#ffb4ab` | "Disconnect and delete my data" |
| `--md-sys-color-error-container` | `#ffdad6` | `#93000a` | reconnect notice, "doesn't count" chip |
| `--md-sys-color-on-error-container` | `#410002` | `#ffdad6` | text on it |
| `--rp-ok-container` | `#c8f0c4` | `#1e4d22` | "counts" chip |
| `--rp-on-ok-container` | `#0b3912` | `#b9f0b8` | text on it |
| `--rp-neutral-container` | `#f0dfd9` | `#3d322e` | "being evaluated" chip |
| `--rp-on-neutral-container` | `#53433e` | `#d8c2bb` | text on it |
| `--rp-brand` | `#fc5200` | `#fc5200` | Strava orange where Strava's own colour is meant |

## Gauge colours (feature 005's key, FR-035)

| Token | Light | Dark | Part |
|---|---|---|---|
| `--rp-part-1` | `#fc5200` | `#ff8f63` | distance |
| `--rp-part-2` | `#1f6fb2` | `#8cc4f0` | elevation |
| `--rp-part-3` | `#2a9d8f` | `#6fd1c2` | team training |
| `--rp-part-4` | `#8e44ad` | `#d7a6ec` | training-weekend day |
| `--rp-part-5` | `#c9a227` | `#e6c65a` | technique training |
| `--rp-part-6` | `#6b6b6b` | `#a8a8a8` | corrections (feature 003 Story 6) |
| `--rp-reached` | `#2e7d32` | `#81c784` | reached gauge |
| `--rp-track` | `#f0dfd9` | `#3d322e` | gauge track |

Parts are separated by a 2 px border in `--md-sys-color-surface-container`, the
card colour behind the gauge.

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
| `--rp-topbar-height` | 64 px (< 600 px), 72 px (≥ 600 px), plus `env(safe-area-inset-top)` |
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
