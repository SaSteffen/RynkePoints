# Contract: The Fun Themes' Decorations (Konfetti, Disco)

Source: canvas board "Konfetti (hell) und Disco (dunkel)" (Fun) and the Main
board's palette badges, read 2026-10-22. All decorations are CSS on
`:root[data-theme=confetti]` / `:root[data-theme=disco]`, `aria-hidden`, never
over text or controls (`pointer-events: none`, below content), and still under
`prefers-reduced-motion: reduce` (FR-033).

## The rainbow (FR-031), one everywhere

Strip, bar and pill (90°), twelve bands:

```css
--rp-rainbow: linear-gradient(90deg,#ff4566,#ff7a2e,#ffb31a,#ffe61a,#a6f21f,#2bea7c,#14e6cf,#1fd0ff,#3fa9ff,#8a7dff,#c45cff,#ff4fb4);
/* shimmering strips and bars: the same, twice, ending on the first colour */
--rp-rainbow-loop: linear-gradient(90deg,#ff4566,#ff7a2e,#ffb31a,#ffe61a,#a6f21f,#2bea7c,#14e6cf,#1fd0ff,#3fa9ff,#8a7dff,#c45cff,#ff4fb4,#ff4566,#ff7a2e,#ffb31a,#ffe61a,#a6f21f,#2bea7c,#14e6cf,#1fd0ff,#3fa9ff,#8a7dff,#c45cff,#ff4fb4,#ff4566);
```

Text on the rainbow is `#1c1b13` (checked against every band, research R10).
Disco uses the same rainbow for its bars, strip and nav pill (canvas).

## Decorations

| Piece | Konfetti | Disco |
|-------|----------|-------|
| Background layer (fixed, behind `main`) | per screen 50 confetti dots (2.5–3.5 px) and 20 tilted strips (14 × 2.4 px), seeded, at opacity .75, drifting down one screen height in 60 s, looping (canvas `.fx-confetti`, colours #ff4566 #ffb31a #3fa9ff #c45cff #2bea7c, strips #ff8fab #7bdff2 #ffd166 #b8f2a1) | 45 specks of star glitter 1–2 px per screen, drifting like Konfetti's (#fff, #ffe61a, #7bdff2, #ff8fd1, #b8f2a1) and a pink glow from the top `radial-gradient(ellipse at 50% -10%, rgba(255,92,184,.22), transparent 60%)` (canvas `.fx-disco`) |
| Under the header | 4 px `--rp-rainbow-loop` strip, shimmer | same |
| Hero cards (`.team-total`, `.hero`, `.overview-deadline`, `.qualified`) | 6 px rainbow-loop strip across the top inside; no gold rim (canvas: transparent border) | same strip; glow `0 0 18px rgba(255,92,184,.45)` ↔ `0 0 22px rgba(58,134,255,.5)`, 3 s alternate |
| Coin in the hero | four sparkles (4-point stars 10–16 px: #ffe61a, #fff, #ff8fd1, #7bdff2) around it, twinkle 2.4 s, staggered .6 s | same |
| Qualified card (primary-container) | four confetti bursts 8 × 14 px (#ff4566, #3fa9ff, #2bea7c, #c45cff) falling 150 px, 3.6 s, staggered .9 s | same |
| Gauge fill (`.gauge-fill`) and key swatch | `--rp-rainbow-loop`, shimmer | same |
| "Neues Abzeichen" and the new-badge chips | pill on `--rp-rainbow-loop`, text #1c1b13, 12 px / 700 | same |
| Filled button | as the theme | glow as the hero |
| Nav pill of the current tab | `--rp-rainbow`, icon #1c1b13 | same |
| Palette button badge | 20 px circle at top 3 px / right 1 px, `#eaf6ff`, ring `0 0 0 2px` header colour, six rainbow arcs (#ff4566 #ff7a2e #ffe61a #2bea7c #3fa9ff #c45cff, stroke 1.3) | 20 px disco ball: ring as Konfetti plus `0 0 8px rgba(255,92,184,.7)`; faceted gradient (canvas `.disco-badge`), facets moving 1.2 s linear |

Animations: `shimmer` 4 s linear (`background-size: 200% 100%`, to
`background-position: 200% 0`), `twinkle`, `fall`, `glow`, `discobadge` as on
the canvas. Reduced motion: all `animation: none`; bursts hidden.

The gauges keep their parts and colour key (FR-020): split gauges keep
`--rp-part-*`; only the single "reached" fill becomes the rainbow.

As built: the app has no "Neues Abzeichen" chip, so the pill look goes on the
new-badge notice (`.badges-reveal`); the single fill has no key swatch. The
sparkles and bursts are `aria-hidden` spans from `src/http/fun.ts`, the
palette badge an empty `span.theme-badge`. Their colours are the tokens
`--rp-fun-*`.
