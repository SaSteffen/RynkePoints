# Data Model: Share a Badge

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

Nothing is stored: there is no migration, no D1 table and no new column. Everything below lives in
the browser only while the share sheet is open (FR-022, FR-027).

## Share source (read from the page)

What the browser reads from the badge's large view (`#badge-{id}`, feature 013) and its "Teilen"
button. The server renders it; see [contracts/pages.md](contracts/pages.md).

| Field | Where from | Notes |
| --- | --- | --- |
| `id` | the large view's `id` (`badge-{id}`) | used in the file name |
| `group` | `data-group` on "Teilen" | `personal` or `team`: the ribbon colour |
| `name` | the large view's `h4` | in the rider's language |
| `earnedLine` | the large view's date paragraph | already "erreicht am {date}", localised |
| `art` | the badge picture's URL in the large view | the same hashed URL as on the page |
| `milestone` | the ribbon text in the large view | for example "500 km" |
| `shareText` | `data-share-text` on "Teilen" | "Neues Abzeichen: {name} ({value}) 🐒" |

The large view never contains the rider's name, so nothing read here can carry it (FR-018).

## Share request (state of the sheet)

| Field | Type | Rules |
| --- | --- | --- |
| `source` | Share source | set when the sheet opens |
| `format` | `story` · `image` · `photo` | `story` when opened (FR-009) |
| `sparkling` | boolean | off when opened. It can only be on if video is supported (R4), and never together with `plain` |
| `plain` | boolean | only for `image`. Turning it on turns `sparkling` off and hides it (FR-011) |
| `photo` | `ImageBitmap` or none | only for `photo`, at most 1920 px on the long side. It is closed when the sheet closes |
| `place` | `{ x, y, w }`, fractions of the photo | default `{ x: .78, y: .78, w: .38 }`. `x` and `y` are clamped to 0…1 (the centre stays on the photo), `w` to .15….90 |

**State changes**:

```text
closed ──open(badge)──▶ preparing ──file ready──▶ ready ──share/save/copy──▶ ready
                           ▲   │                    │
                           │   └──abort (format/option change, close)
                           └────────────────────────┘ any change of format, option or place
ready/preparing ──close──▶ closed   (encode aborted, blob URLs revoked, photo released)
```

- While `preparing`, the actions are disabled. With `sparkling`, the preview shows "Wird gerendert …"
  (FR-013, FR-025).
- Moving the badge on a still photo redraws right away. The file is made again once the pointer is
  released.

## Share file

| Field | Value |
| --- | --- |
| `blob` | PNG (`image/png`) or MP4 (`video/mp4`, H.264, 30 fps, 150 frames) |
| `name` | `{app slug}-{badge id}-{format}.{png\|mp4}`, for example `rynkepoints-km-500-image.png` (FR-029) |
| `width × height` | story 1080 × 1920; image and sticker 1080 × 1080; photo is the photo's size (at most 1920 on the long side, even numbers for video) |
| `text` | `shareText`, sent only with the system share (FR-014) |
