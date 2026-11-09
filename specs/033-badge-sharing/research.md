# Research: Share a Badge

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-11-09

The mock-up on the local branch `mock/badge-share` already does most of this. Each decision below
says what the real build keeps from it and what changes.

## R1. Where the pictures are made

- **Decision**: in the browser, in `public/app.js`, on a `<canvas>`. The data comes from the page:
  the badge's large view supplies the picture URL, ribbon, milestone text, name and date. The server
  only adds markup: the share buttons, the share text on the large view's "Teilen" button, and one
  share sheet per page.
- **Rationale**: FR-022 and FR-027 rule out any upload. The page already holds everything the
  picture shows, so nothing new is read from Strava or D1, and there is no new route.
- **Alternatives considered**: a Worker route that renders PNGs (it would need an image library on
  Workers, the rider's photo would have to be uploaded, and every share would cost CPU time), and
  `html2canvas`-style screenshots of the DOM (a library for something one canvas does, and less
  exact).

## R2. Drawing the badge exactly as displayed

- **Decision**: keep the mock-up's drawing:
  - load the badge's picture (the same hashed URL as on the page);
  - draw the cream edge and shadow;
  - draw the ribbon from the same SVG the page uses;
  - set the milestone in the page's typeface after `document.fonts.ready`;
  - draw at the output size, so it stays sharp.

  The colours are always the light theme's. The ribbon text colour (`--rp-ribbon-text`, and
  `--rp-coin-ink` for team badges) is read from a light-theme probe element, not the current
  theme.
- **Rationale**: FR-015 (exactly as displayed) and FR-016 (the same for every team, theme and dark
  mode) only fit together if "as displayed" means "as in the light theme". The badge art itself
  doesn't change by theme.
- **Alternatives considered**:
  - Following the current theme: it breaks FR-016.
  - Rasterising the DOM: no browser API does it without a library.

## R3. Layouts

- **Decision**:
  - **Story** is 1080 × 1920. The badge is centred at about 45 % of the height, with the name below
    it (at most two lines, wrapped at word breaks) and then the date. The app mark sits at the
    bottom, just above the bottom 250 px (FR-017). The background is white, with a radial yellow
    glow at .22 behind the badge.
  - **Bild** is 1080 × 1080 with the same layout, scaled.
  - **Sticker** is 1080 × 1080 and transparent: the badge alone, with its shadow.
  - **Auf Foto** keeps the photo's proportions, scaled down to at most 1920 px on the long side.
    The badge is placed by its centre and its width as fractions of the photo, by default at the
    lower right corner and 38 % of the width. The centre is kept inside the photo, so at least half
    the badge stays on it.
  - **App mark**: the team's own app icon and app name, as in the page's head (feature 026). That
    way Team Europe's pictures carry Team Europe's mark; the design around it is the same for every
    team.
- **Rationale**:
  - These sizes are the common story and feed sizes.
  - Fractions keep the place and size when the rider picks another photo (US2 scenario 6).
- **Alternatives considered**: a 1350 px portrait feed format (it adds a fourth choice and nobody
  asked for one).

## R4. Making the Glitzernd video

- **Decision**:
  - **Encoding**: WebCodecs `VideoEncoder` with H.264 (`avc1.640028`, High profile at level 4.0,
    which covers 1080 × 1920). Frames are drawn one by one from a fixed clock: 30 fps, 150 frames,
    5 s, with two shine sweeps and the stars on a loop that ends where it began (FR-023).
  - **Muxing**: the frames go into an MP4 file through the vendored `mp4-muxer`.
  - **When it is offered**: "Glitzernd" appears only when
    `VideoEncoder.isConfigSupported(...)` says yes for that size and the muxer has loaded (FR-011,
    FR-024).
  - **Odd sizes**: "Auf Foto" sizes are rounded down to even numbers, because H.264 needs them.
- **Rationale**:
  - One code path in every browser, and always MP4, which Instagram, WhatsApp, Strava and Signal
    accept.
  - Encoding from a fixed clock is faster than real time on hardware encoders, so FR-025 and
    SC-002 can be met.
  - The mock-up's `MediaRecorder` records in real time, so it always takes exactly as long as the
    video. In Firefox it can only make WebM.
- **Alternatives considered**:
  - **`MediaRecorder` with MP4**: it can't make MP4 in Firefox, it takes real time, and its frame
    timing is uneven.
  - **WebM in Firefox**: the story apps reject it.
  - **Our own muxer**: about 300 lines of MP4 boxes we'd have to keep right against every app, with
    no way to test that in CI.
  - **`mediabunny`**: the successor of `mp4-muxer`, but its browser bundle is 724 KB minified
    (187 KB gzipped) and we only need muxing. It also uses the MPL-2.0 licence.

## R5. The muxer as a browser dependency (Principle IV)

- **Decision**: vendor `mp4-muxer@5.2.2` (MIT): 74 KB, about 15 KB gzipped, a global `Mp4Muxer`
  build.
  - `scripts/vendor.mjs` copies `build/mp4-muxer.js` and its licence to
    `public/vendor/mp4-muxer-5.2.2.js`, and the lint check runs as for Chart.js.
  - It is a pinned devDependency.
  - `public/app.js` adds the script tag when the share sheet first opens, not on page load.
  - The existing `/vendor/*` immutable caching covers it.
- **Where it runs**: all on the rider's device. The browser's own `VideoEncoder` encodes the frames,
  and `mp4-muxer` only packs the encoded frames into an MP4 file in memory. Nothing goes to a server
  or a third party. The user agreed on this condition (2026-11-09): if any part of the encoding
  needed a server, the video variants would be dropped instead.
- **Justification**: no platform API puts encoded frames into an MP4 file. The library only writes
  bytes we hand it and never parses outside input, so the attack surface is small. It's pinned, so
  its deprecation ("superseded by Mediabunny") doesn't affect us: MP4 doesn't change, and its
  successor is far bigger for the same job.
- **Offline**: if the muxer can't load, "Glitzernd" isn't offered. Still pictures always work.

## R6. Share, save, copy

- **Decision**:
  - **Teilen …**: `navigator.share({ files: [file], text })`. It's shown only if
    `navigator.canShare({ files: [file] })` is true for the prepared file. The file (a `File` with
    its name and type) is made before the tap, as soon as the preview settles, because iOS drops
    the user gesture across an `await` (FR-013).
  - **Speichern**: a temporary `<a download>` with a blob URL, which is revoked afterwards.
  - **Kopieren**: `navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])`. It's
    shown only for still pictures where `ClipboardItem` exists.
  - **Errors**: `AbortError` from share means the rider cancelled, so nothing happens. A
    `NotAllowedError` or other failure shows `badges.share.failed` and leaves "Speichern" in focus.
- **Rationale**: these are the platform APIs, and they need no library.
- **Alternatives considered**: putting the share text in the file name or on the picture (the spec
  says no).

## R7. File names and the share text

- **Decision**:
  - The file name is `{app}-{badge id}-{format}.{png|mp4}`, where `{app}` is the slug of the team's
    app name, for example `rynkepoints-km-500-story.png`. It never contains the rider's name
    (FR-029).
  - The share text is the catalog's `badges.share.text`, filled in on the server with the badge's
    name and milestone value, and carried on the large view's "Teilen" button as `data-share-text`.
- **Rationale**: the server already knows the language and the badge names, so the browser needs no
  message catalog.

## R8. The share icon per platform

- **Decision**: every share button holds both icons in its markup. CSS shows Apple's icon under
  `@supports (-webkit-touch-callout: none)`, which only iOS and iPadOS WebKit pass, and the three
  linked dots everywhere else, Mac Safari included.
- **Rationale**: it's decided before the first paint, with no script and no user-agent sniffing on
  the server, so there's no flash (FR-007).
- **Alternatives considered**:
  - User-agent sniffing in the Worker: iPadOS reports itself as a Mac, and the pages would vary by
    user agent.
  - A JS swap after load: the icon would flash.

## R9. Showing the share buttons

- **Decision**:
  - The buttons show by default and are hidden only under
    `@media (hover: hover) and (pointer: fine)`, where they appear on `:hover` of the card or
    gallery spot and on `:focus-visible`.
  - The visible circle is 36 px, and a `::before` widens the touch target to 44 × 44 px (FR-003).
  - The button sits at the top right of the card or spot, away from the ribbon.
  - `pointerenter` on a share button closes an open hover preview (FR-005).
  - The large view's "Teilen" is hidden while the popover was opened by hover, and shown once it's
    pinned. The app already tells the two apart.
- **Rationale**: the same media queries already decide hover behaviour elsewhere in the app.

## R10. The share sheet itself

- **Decision**:
  - One server-rendered `<dialog class="share-sheet">` per badges page, opened with `showModal()`.
  - On phones it's a bottom sheet and on wider screens a centred dialog, using the app's dialog
    styles and theme (Material 3).
  - It closes with its close button, Escape (native), and a click on the backdrop.
  - On close, any running encode is aborted with `AbortController`, blob URLs are revoked, and the
    photo `ImageBitmap` is closed and forgotten (FR-022, edge cases).
  - Switching format during an encode aborts that encode and starts a new one.
  - With reduced motion, the preview `<video>` has no `autoplay` and shows its controls.
- **Rationale**: one dialog, filled per badge, means the page stays the size it is with any number
  of badges.

## R11. Reading the rider's photo

- **Decision**:
  - Use `<input type="file" accept="image/*">`.
  - Read the file with `createImageBitmap(file, { imageOrientation: "from-image" })`, so photos
    taken in portrait come out the right way up.
  - Scale it to at most 1920 px on its long side once.
  - If decoding fails (for example HEIC in a browser that can't read it), show
    `badges.share.photoUnreadable` and keep "Foto wählen".
- **Moving the badge**: Pointer Events drag it with one pointer, two pointers pinch it, and the
  mouse wheel scales it. The badge stays between 15 % and 90 % of the photo's width.
- **Rationale**: these are the platform APIs, and nothing is uploaded. SC-005 is checked by an e2e
  test that fails on any request made while a photo is used.
