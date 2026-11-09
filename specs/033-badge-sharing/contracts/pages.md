# Contract: Badges page markup

The badges page `/me/badges` (feature 013, `src/http/sections/badges.ts`) gains the markup below. It
renders as today for a rider with no earned badge, apart from the one share sheet (FR-001; edge case
"no earned badge": no share buttons).

## Share button on each earned badge (FR-001 to FR-003, FR-006, FR-007)

In each "Neueste" card (`li.badge-card`) and each earned "Alle" spot (`.badge-gallery li`), right
after the badge's button:

```html
<button type="button" class="icon-button badge-share-mini" data-badge="{id}"
        aria-label="„{name}“ teilen">{SHARE}</button>
```

- Unearned spots and the "next badge" outlines get none.
- `{SHARE}` is both icons: `<svg class="share-icon-apple">` and `<svg class="share-icon-dots">`,
  `aria-hidden`. CSS shows exactly one (research R8).
- CSS: the button is visible by default. Under `(hover: hover) and (pointer: fine)` it's hidden
  until `:hover` of the card or spot, or `:focus-visible`. The visible circle is 36 px and the touch
  target 44 × 44 px. It sits at the top right and never over the ribbon (research R9).

## "Teilen" in the large view (FR-004, FR-014)

Below the date in each `div.badge-large[popover]`:

```html
<button type="button" class="button-outlined badge-share" data-group="{personal|team}"
        data-share-text="Neues Abzeichen: {name} ({value}) 🐒">{SHARE}Teilen</button>
```

Hidden while the large view is a hover preview, and shown once it's pinned.

## The share sheet (FR-008 to FR-013)

Once per badges page, after the large views: `dialog.share-sheet` holds the following.

- Data attributes for the texts the script sets: `data-saved`, `data-copied`, `data-failed`,
  `data-app` (the team's app name, `TeamData.shortName`) and `data-icon` (the team's 192 px app
  icon), so the app mark comes from the team's data (research R3).
- A heading `#share-sheet-title` with a close button.
- `fieldset.share-formats`, a segmented group with radio buttons `story` (checked), `image` and
  `photo`, and a visually hidden legend.
- `.share-preview`: `<canvas>`, `<video muted playsinline loop hidden>`, the empty-photo prompt
  ("Foto wählen" with the privacy line), the unreadable-photo line, and the busy label "Wird
  gerendert …" (`role="status"`).
- The hint lines for touch and mouse, shown only for `photo`.
- Two switches (`role="switch"`, `aria-checked`), "Glitzernd" and "Ohne Hintergrund", plus "Anderes
  Foto". All are hidden until the script decides they apply.
- `<input type="file" accept="image/*" hidden>`.
- The actions "Teilen …", "Speichern" and "Kopieren", and a status line (`role="status"`) for
  saved, copied and failed.

No `name` attribute, form or URL carries anything about the rider, and nothing in the sheet is ever
submitted. No new route, header or response on the server.

## Static files

| Path | What | Caching |
| --- | --- | --- |
| `public/vendor/mp4-muxer-5.2.2.js` | vendored muxer (research R5), loaded on first sheet open | `/vendor/*` immutable, as today |
| `public/vendor/mp4-muxer-5.2.2.LICENSE.txt` | its MIT licence | as above |
