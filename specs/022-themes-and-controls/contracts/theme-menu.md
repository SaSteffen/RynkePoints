# Contract: Palette Button, Theme Menu and the Theme Choice

Source: canvas board "Kopfzeile + Farbschema-Menü (klickbar)" (Main) and the
Fun board's header, read 2026-10-22.

## Header (every signed-in page, every width)

Order in `header.top-bar`: wordmark, section title (`h1`, flex 1), palette
button, refresh link. Both buttons are 44 × 44 px round icon buttons, icons
24 px, colour `on-surface-variant`. Header height and padding as today.

```html
<button type="button" class="icon-button theme-button"
        aria-haspopup="dialog" aria-expanded="false" aria-controls="theme-menu"
        aria-label="{theme.button}">
  <svg …palette icon (canvas path)…></svg>
  <!-- Konfetti / Disco only, see fun-decorations.md -->
  <span class="theme-badge" aria-hidden="true"></span>
</button>
<a class="icon-button refresh" …>…</a>
```

- Open: the button gets `primary-container` / `on-primary-container`
  (canvas `paletteBg`/`paletteFg`) and `aria-expanded="true"`.
- The palette icon: the canvas path (palette outline with three dots).
- Narrow screens (320 px): the title truncates with an ellipsis; both buttons
  stay.

## The menu panel

```html
<div id="theme-menu" class="theme-menu" role="dialog" aria-labelledby="theme-menu-title" hidden>
  <div class="theme-menu-head">
    <h2 id="theme-menu-title">{theme.menu.title}</h2>
    <button type="button" class="icon-button" data-action="close" aria-label="{theme.menu.close}">×-icon</button>
  </div>
  <fieldset class="theme-choices">
    <legend class="visually-hidden">{theme.menu.title}</legend>
    <label class="theme-auto"><input type="radio" name="theme" value="auto">
      <span class="theme-auto-swatch" aria-hidden="true"></span>
      <span><span class="theme-auto-name">{theme.auto}</span><span class="theme-auto-hint">{theme.auto.hint}</span></span>
      <svg class="theme-check" aria-hidden="true">✓</svg></label>
    <h3 class="theme-group">{theme.group.light}</h3>
    <div class="theme-grid">
      <label class="theme-tile" data-theme-preview="baltic"><input type="radio" name="theme" value="baltic">
        <span class="theme-preview" aria-hidden="true"><span></span><span></span><span><span></span><span></span></span></span>
        <span class="theme-name">{theme.name.baltic}<svg class="theme-check" aria-hidden="true">✓</svg></span>
        <!-- fun themes only --><span class="theme-sparkle" aria-hidden="true">{theme.sparkle}</span>
      </label>
      …
    </div>
    … groups dark and contrast …
  </fieldset>
  <p class="theme-note">{theme.menu.note}</p>
</div>
```

The panel is rendered by the server with every label from the catalogs
(FR-021) and is hidden until opened. The radio for the stored choice is
checked by `app.js` on load (the server doesn't know the device's choice).

### Look (canvas)

| Part | Value |
|------|-------|
| Panel | absolute under the header, `top: 60px; right: 8px`, width 330 px (max `100vw - 16px`), max-height `min(760px, 100dvh - 76px)`, scrolls; padding 16 px; radius 16 px; background `surface-container-high`; text `on-surface`; border 1 px `outline-variant` (2 px `on-surface` in the contrast themes); shadow `0 8px 28px rgba(0,0,0,.28)`; above the header (z-index 10) |
| Head | title 16 px / 600; close button 44 px round, icon 20 px, `on-surface-variant`, margin −10 px to sit in the corner; 8 px below |
| Automatisch | full width, min-height 56 px, padding 8 × 12 px, radius 12 px, gap 12 px; swatch 36 px circle split cream `#fffdf5` / dark `#12110c` with 1 px `outline`; name 15 px / 600; hint 13 px; checked: `primary-container` / `on-primary-container` and a 20 px check |
| Group heading | 12 px / 16 px, 600, letter-spacing .06em, uppercase, `on-surface-variant`, margin 16 px 0 8 px |
| Grid | 2 columns, gap 8 px |
| Tile | padding 6 px, radius 14 px, gap 6 px; checked: `box-shadow: 0 0 0 3px var(--rp-primary-text)` and an 18 px check after the name |
| Preview | 64 px high, radius 10 px, padding 6 px, gap 4 px, the theme's own `bg` (fun themes: with their glitter dots); three rows: a 12 px bar 70 % in the theme's `hero`, a 12 px bar 90 % in its `pc`, two 14 px pills 40 % `primary` and 30 % `card`; contrast themes: 2 px `text` border |
| Name | 14 px / 600, min-height 22 px |
| "Glitzer" chip | top right of the tile (2 px), padding 1 × 6 px, pill, the rainbow, text `#1c1b13`, 11 px / 700 |
| Note | 13 px, `on-surface-variant`, 16 px above |

Each tile's preview colours are fixed per theme (they show that theme, not the
current one); they come from the same table as the theme tokens, as custom
properties on `[data-theme-preview=<id>]`.

## Behaviour (`app.js`)

- Palette button toggles the panel. On open: focus the checked radio. Escape,
  a tap outside the panel, or the close button closes it and returns focus to
  the palette button (US2 scenario 6).
- `change` on a radio applies the theme at once (no reload): store it
  (`rp-theme`; `auto` removes the key), set `data-theme` and `data-scheme` on
  `<html>` (removed for `auto`), update the `theme-color` metas as the head
  script does, and leave the panel open with the new check (canvas). Charts
  recolour (they observe `data-theme` and `data-scheme`).
- Content swapped in place (`swapPage`) leaves the header and the menu alone;
  the menu wiring runs once per page load, not in `enhance()`.
- Storage that throws: the theme still applies for this page; nothing is
  remembered (edge case).

## Head script (`THEME_SCRIPT`, replaces `SCHEME_SCRIPT`)

1. `t = localStorage["rp-theme"]`; if absent and `rp-scheme` is `light`/`dark`,
   `t = rynke-day / rynke-night`, store it, remove `rp-scheme` (FR-015).
2. If `t` is a known id: `data-theme = t`, `data-scheme = base(t)`; both
   `theme-color` metas lose `media` and get `bg(t)`. Unknown or absent:
   nothing (Automatisch).
3. The show hand-over (page-switch-show.md): a fresh `rp-show` flag sets
   `data-show`.
4. All in `try{}catch{}`; no text.

The id → base scheme and `bg` table inside it is generated from the theme list
in `src/http/themes.ts`, so script, stylesheet and menu read one source.

## Settings

The Appearance group (System / Hell / Dunkel) and `schemePicker()` are removed
(FR-016); the `settings.scheme.*` messages go with them.
