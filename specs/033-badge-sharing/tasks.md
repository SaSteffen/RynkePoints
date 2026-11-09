---
description: "Tasks for sharing a badge"
---

# Tasks: Share a Badge

**Input**: design documents in `specs/033-badge-sharing/`.

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/pages.md, contracts/files.md,
contracts/messages.md, quickstart.md.

**Tests**: required (constitution Principle V, quickstart.md). Write each test first and see it fail.

**Starting point**: the mock-up branch `mock/badge-share` (worktree `../RynkePoints-badge-share`, commits
95595c3, 2582da2, d73851d and 18bb958). Bring its code into the feature worktree, test-first. Its look,
order and placement apply (`drafts/`); where it differs from this plan, follow the plan. In particular:

- `MediaRecorder` is replaced by WebCodecs and `mp4-muxer` (R4).
- The edge cases it skipped are added.

**Rules**:

- Every word goes in all 10 catalogs (contracts/messages.md): German source, English reference, the
  others proper translations.
- No rider name on any picture, in any file name or in the markup the script reads (FR-018, FR-029).
- No request may leave the device while a picture is made (FR-022, FR-027).
- Fixtures are synthetic: the test photo is drawn in the test.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: the user story in spec.md.

## Phase 1: Setup

**Purpose**: the vendored muxer (research R5).

- [x] T001 Add `mp4-muxer` pinned at exactly `5.2.2` to `devDependencies` in `package.json` (next to `chart.js`) and run `pnpm install`
- [x] T002 Add an `mp4-muxer` entry to `PACKAGES` in `scripts/vendor.mjs`: `file: "build/mp4-muxer.js"`, `as: (v) => \`mp4-muxer-${v}.js\``, `licence: (v) => \`mp4-muxer-${v}.LICENSE.txt\``, reading `LICENSE` (not `LICENSE.md`) for this package; update the header comment, which today names only the chart library; run `pnpm vendor` and commit `public/vendor/mp4-muxer-5.2.2.js` and its licence; check that `node scripts/vendor.mjs --check` passes

**Checkpoint**: `pnpm lint` passes. Nothing loads the muxer yet.

---

## Phase 2: Foundational

**Purpose**: the texts, the icon and the share sheet markup that every story uses.

- [x] T003 Add the 23 `badges.share.*` keys from contracts/messages.md to `src/i18n/messages/de.ts` and `en.ts` with the given wording, and proper translations to `da.ts`, `fi.ts`, `fr.ts`, `is.ts`, `lt.ts`, `nb.ts`, `nl.ts` and `sv.ts` (Europe is a distributed team: write the English fresh, don't phrase it around group rides); check `pnpm test -- catalogs messages` is green
- [x] T004 [P] Add `SHARE` to `src/http/icons.ts`, as in the mock-up: Apple's box with an arrow (`class="share-icon-apple"`) and the three linked dots (`class="share-icon-dots"`), both `aria-hidden="true"`, in one `SafeHtml`
- [x] T005 Write failing tests in `test/integration/badges-section.test.ts`, in a new `describe("sharing a badge (033)")`:
  - the page has exactly one `dialog.share-sheet`, with the format radios `story` (checked), `image` and `photo`, the two `role="switch"` buttons, the file input and the three actions (contracts/pages.md);
  - its `data-app` is the team's app name, and `data-saved`, `data-copied` and `data-failed` hold the catalog texts;
  - nothing in it contains the sample rider's name
- [x] T006 Add `shareSheet(i18n)` to `src/http/sections/badges.ts` and render it once after the large views. Follow contracts/pages.md and the mock-up, plus what the mock-up lacks:
  - `data-failed`;
  - the hidden `.share-photo-unreadable` line;
  - a `role="status"` busy label and status line.

  Make T005 green.
- [x] T007 [P] Style the sheet in `src/http/style.ts` from the mock-up: a bottom sheet below 600 px and a centred dialog above, the app's dialog surface and theme, the preview area, the switches, and the actions in a row. The sheet follows dark mode; the picture inside doesn't

**Checkpoint**: the badges page renders the hidden sheet; `pnpm test -- badges-section` is green.

---

## Phase 3: User Story 1 - Share a badge as a story or a picture from a phone (Priority: P1) 🎯 MVP

**Goal**: from a phone, a share button on every earned badge opens the sheet. Story and Bild (and the
sticker) come out as PNGs and go to the system share with the share text.

**Independent test**: in a phone context (390 px, touch), share a personal badge as a Story and check
that the file is 1080 × 1920, then as a sticker and check that a corner pixel is transparent.

### Tests for User Story 1

- [x] T008 [US1] Write failing tests in `test/integration/badges-section.test.ts`:
  - every earned badge in "Neueste" (`li.badge-card`) and in "Alle" (`.badge-gallery li`) has one `button.badge-share-mini` with `data-badge="{id}"` and the accessible name `„{name}“ teilen`;
  - unearned spots and outlines have none, and the page without badges has none;
  - each large view has `button.badge-share` with `data-group` and `data-share-text` equal to `badges.share.text` filled with the badge's name and value;
  - a team badge has `data-group="team"`
- [x] T009 [P] [US1] Create `e2e/badge-share.e2e.ts` (sign in as in `e2e/sign-in.ts`), with failing tests in a phone context (`hasTouch`, 390 × 844):
  - the share buttons are visible without hover;
  - tapping one opens `dialog.share-sheet[open]` with `story` checked and a canvas of 1080 × 1920;
  - Bild gives 1080 × 1080;
  - with "Ohne Hintergrund", the pixel at (4, 4) has alpha 0 and "Glitzernd" is hidden;
  - "Speichern" downloads a file whose `suggestedFilename()` matches `^[a-z0-9-]+-{id}-(story|image|sticker)\.png$` and doesn't contain the sample rider's name;
  - "Teilen …" calls `navigator.share` (stubbed in `addInitScript`) with one `File` of type `image/png` and the share text

### Implementation for User Story 1

- [x] T010 [US1] In `src/http/sections/badges.ts`, add `shareMini(i18n, names, earned)` after `badgeButton` in `card()` and in the gallery `li`, and the "Teilen" button below the date in `popover()`, as contracts/pages.md and the mock-up have them (T008 green)
- [x] T011 [P] [US1] Style the share buttons in `src/http/style.ts`:
  - a 36 px circle at the top right of the card or spot, clear of the ribbon, with the `h4` padded so it doesn't run under the button;
  - a `::before` that widens the touch target to 44 × 44 px (FR-003);
  - visible by default.
- [x] T012 [US1] In `public/app.js`, bring over the mock-up's share block as a `badgeShare()` setup:
  - opening from `.badge-share-mini` (via `#badge-{id}`) and from `.badge-large .badge-share`;
  - reading the share source from the large view (data-model.md "Share source");
  - `showModal()`;
  - closing on the close button, Escape and a backdrop click.

  Keep `hidePopover` only when the view `:popover-open`
- [x] T013 [US1] In `public/app.js`, draw the badge exactly as the light theme shows it (research R2):
  - the art, cream edge, shadow, the ribbon SVG and the milestone in the page typeface after `document.fonts.ready`;
  - the ribbon text colour read from a light-theme probe (`--rp-ribbon-text`, or `--rp-coin-ink` for team), never the current theme;
  - drawn at the output size;
  - in still pictures, no stars (FR-020).
- [x] T014 [US1] In `public/app.js`, lay out Story (1080 × 1920) and Bild (1080 × 1080) as research R3 describes:
  - a white background with a yellow radial glow at .22 behind the badge;
  - the name wrapped at word breaks onto at most two lines, then the localised date line;
  - the team's app icon and app name (`data-app`) at the bottom;
  - in Story, nothing but the background outside 250…1670 px (FR-017).

  The sticker is the badge alone on a transparent 1080 × 1080 with no text or mark. "Ohne Hintergrund" shows only with Bild.
- [x] T015 [US1] In `public/app.js`, prepare the file as soon as the preview settles (FR-013):
  - a `File` named `{slug(data-app)}-{id}-{story|image|sticker}.png` (FR-029);
  - the actions disabled until it's ready, and made again after any change of format or option.
- [x] T016 [US1] In `public/app.js`, add the actions (research R6):
  - **"Teilen …"**: shown only if `navigator.canShare({ files: [file] })`; calls `navigator.share({ files: [file], text })`. An `AbortError` is ignored. Any other error shows `data-failed` in the status line and focuses "Speichern".
  - **"Speichern"**: a temporary `<a download>` with a blob URL, revoked afterwards, then `data-saved`.
  - **"Kopieren"**: shown for still pictures where `ClipboardItem` exists; writes `image/png` and shows `data-copied`, or `data-failed` on error.

  (T009 green)

**Checkpoint**: on a phone, Story, Bild and the sticker can be shared, saved and copied. The MVP is shippable.

---

## Phase 4: User Story 2 - Put a badge on my own ride photo (Priority: P1)

**Goal**: the rider picks a photo, places and resizes the badge on it, and gets the photo with the
badge. The photo never leaves the device.

**Independent test**: pick a synthetic photo of 1600 × 1200, drag the badge, save it, and check the PNG is
1600 × 1200 and that no request left the page.

### Tests for User Story 2

- [x] T017 [US2] Add failing tests to `e2e/badge-share.e2e.ts`:
  - **Picking a photo**: "Auf Foto" shows "Foto wählen" and the privacy line. Make a 1600 × 1200 synthetic PNG in the page (`canvas.toDataURL`) and pass it to `setInputFiles` as a buffer. The canvas is then 1600 × 1200.
  - **No request**: record `page.on("request")` from picking to saving, and expect none.
  - **The result**: the saved PNG is 1600 × 1200.
  - **Too large**: a 4000 × 1000 photo gives 1920 × 480.
  - **Unreadable**: a file of bytes that aren't an image shows the unreadable line and keeps "Foto wählen".
  - **Placement**: dragging the badge with the mouse moves it (sample the pixel colour at the old and new places); wheel scrolling makes it bigger.

### Implementation for User Story 2

- [x] T018 [US2] In `public/app.js`, read the photo with `createImageBitmap(file, { imageOrientation: "from-image" })` and scale it once to at most 1920 px on the long side. On a decode error, show `.share-photo-unreadable` and keep the picker. "Anderes Foto" picks again (research R11)
- [x] T019 [US2] In `public/app.js`, place the badge by `place = { x, y, w }` as fractions of the photo:
  - the default is `{ x: .78, y: .78, w: .38 }`;
  - clamp `x` and `y` to 0…1 and `w` to .15….90 (data-model.md);
  - one pointer drags, two pointers pinch, and the mouse wheel scales;
  - redraw on every move and make the file again on pointer up;
  - keep `place` when the photo changes (US2 scenario 6).
- [x] T020 [US2] In `public/app.js`, make the photo file:
  - the photo at its size with the badge, no text and no mark;
  - named `{slug}-{id}-photo.png`;
  - show the touch or mouse hint by `(hover: hover) and (pointer: fine)`.
- [x] T021 [US2] In `public/app.js`, on close, `close()` the photo `ImageBitmap`, drop it and `place`, clear the file input and revoke every blob URL (FR-022) (T017 green)

**Checkpoint**: "Auf Foto" works on a phone and on desktop; nothing leaves the page.

---

## Phase 5: User Story 3 - Share the sparkling version (Priority: P2)

**Goal**: "Glitzernd" makes a 5 s looping MP4 (H.264) of the shining, twinkling badge, on the device,
wherever the browser can encode it.

**Independent test**: in Chromium, switch on "Glitzernd" for Story, wait for "Wird gerendert …" to go,
save it, and check the file starts with an `ftyp` box and contains `avc1`.

### Tests for User Story 3

- [x] T022 [US3] Add failing tests to `e2e/badge-share.e2e.ts`:
  - **When the encoder can**: in the page, evaluate `VideoEncoder.isConfigSupported({ codec: "avc1.640028", width: 1080, height: 1920 })`. If it's supported:
    - switching on "Glitzernd" shows the `role="status"` "Wird gerendert …";
    - the actions are disabled until it's done;
    - then "Speichern" gives `{slug}-{id}-story.mp4`, whose bytes 4–7 are `ftyp` and which contains `avc1`;
    - "Kopieren" is hidden.
  - **When it can't**: the "Glitzernd" switch is hidden.
  - **Changes during rendering**: closing the sheet logs no console error; switching to Bild restarts with "Wird gerendert …".
  - **Reduced motion**: with `reducedMotion: "reduce"`, the preview `<video>` is paused.

### Implementation for User Story 3

- [x] T023 [US3] In `public/app.js`, when the sheet first opens, add `<script src="/vendor/mp4-muxer-5.2.2.js">` once. Offer "Glitzernd" only if the script loaded, `window.VideoEncoder` exists, and `isConfigSupported` is true for the current size (even width and height). Never offer it with "Ohne Hintergrund" (FR-011, FR-024; research R4, R5)
- [x] T024 [US3] In `public/app.js`, replace the mock-up's `MediaRecorder` code with encoding from a fixed clock:
  - 150 frames at 30 fps; frame `i` is drawn at `t = i / 30` with the shine sweeping twice and the four stars on a 5 s loop that ends where it starts (FR-023);
  - encoded by `VideoEncoder` with `{ codec: "avc1.640028", width, height, bitrate: 8_000_000, framerate: 30 }`, a key frame every 30 frames;
  - put into an `Mp4Muxer.Muxer` with an `ArrayBufferTarget`, `fastStart: "in-memory"`;
  - the result is a `File` of type `video/mp4`.

  Photo sizes are rounded down to even numbers. Keep all of it in the browser.
- [x] T025 [US3] In `public/app.js`:
  - show `.share-busy` ("Wird gerendert …") and disable the actions while encoding (FR-025);
  - abort with an `AbortController` on close, a format change or an option change, and close the encoder; start again for the new settings;
  - play the result in the looping `<video>`, without `autoplay` and with `controls` under `prefers-reduced-motion: reduce` (FR-026);
  - hide "Kopieren" while "Glitzernd" is on.

  (T022 green)

**Checkpoint**: Story, Bild and Auf Foto each have a working "Glitzernd" where the encoder exists, and none where it doesn't.

---

## Phase 6: User Story 4 - Save or copy on desktop (Priority: P2)

**Goal**: with a mouse, the share buttons appear on hover or focus, never sit under a hover preview,
and the sheet is a centred dialog with Speichern and Kopieren.

**Independent test**: at 1280 px with a mouse, hover a card, click its share button and save a Bild.

### Tests for User Story 4

- [x] T026 [US4] Add failing tests to `e2e/badge-share.e2e.ts` at the desktop default (1280 px, no touch):
  - **Showing the buttons**: the share button is hidden; it shows on `hover` of its card, and on keyboard focus (Tab).
  - **Hover preview**: hovering the badge opens its preview; moving to the share button closes the preview, and the button can be clicked.
  - **"Teilen" in the large view**: it's hidden in the hover preview and visible after clicking the badge.
  - **Placement**: the sheet is centred (its box doesn't touch the bottom edge).
  - **Copying**: with the clipboard permission granted in Chromium, "Kopieren" shows "Kopiert: zum Einfügen bereit."

### Implementation for User Story 4

- [x] T027 [US4] In `src/http/style.ts`, under `@media (hover: hover) and (pointer: fine)`, hide `.badge-share-mini` until `:hover` of `.badge-card` or `.badge-gallery li`, or `:focus-visible` (research R9)
- [x] T028 [US4] In `public/app.js`, on `pointerenter` of `.badge-share-mini`, hide any large view the hover opened (FR-005). Hide `.badge-share` while the large view has `badge-large-hover`, and show it once the view is pinned (FR-004) (T026 green)

**Checkpoint**: desktop works with mouse and keyboard.

---

## Phase 7: User Story 5 - The share icon riders know (Priority: P3)

**Goal**: Apple's icon on iPhone and iPad, three linked dots everywhere else, decided before the first
paint.

**Independent test**: in WebKit with `-webkit-touch-callout` unsupported (desktop) and Chromium, the
three-dots icon shows and the Apple icon doesn't.

- [ ] T029 [US5] Add a failing test to `e2e/badge-share.e2e.ts`: on the desktop projects (Chromium, Firefox, WebKit), `.share-icon-dots` is visible in a share button and `.share-icon-apple` is not; both exist in the markup
- [x] T030 [US5] In `src/http/style.ts`, show `.share-icon-dots` and hide `.share-icon-apple` by default, and swap them under `@supports (-webkit-touch-callout: none)` (research R8), with no script (T029 green)

**Checkpoint**: the right icon shows everywhere; the real iPhone and iPad check happens on the live site.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T031 [P] Check the screen-reader labels in `src/http/sections/badges.ts`: the format fieldset has its legend, the switches have `aria-checked` updated by `public/app.js`, and the status lines are `role="status"` (spec edge case "Screen readers")
- [ ] T032 [P] Long names and milestones: in `e2e/badge-share.e2e.ts`, share the sample badge with the longest name and check, by sampling canvas pixels, that the name block ends above the date line and the text isn't cut at the edges
- [ ] T033 Fix existing tests that pin the badges page markup (for example `test/integration/badges-section.test.ts` snapshots or counts of buttons in `e2e/smoke.e2e.ts`), only where this feature is the cause
- [ ] T034 Run `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm exec playwright test e2e/badge-share.e2e.ts`; leave the full `pnpm test:e2e` to CI

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none. Only US3 needs it, but it is cheap and done first.
- **Foundational (Phase 2)**: blocks every story: texts, icon and the sheet.
- **US1 (Phase 3)**: needs Foundational. It holds the drawing, the file preparation and the actions every other story uses.
- **US2 (Phase 4)**: needs US1 (drawing, actions).
- **US3 (Phase 5)**: needs Setup and US1; for "Auf Foto" Glitzernd also US2.
- **US4 (Phase 6)**: needs US1 only; can run beside US2 and US3.
- **US5 (Phase 7)**: needs T004 and T011 only; can run any time after them.
- **Polish (Phase 8)**: needs the stories it touches.

### Within Each Story

- The failing test first, then the markup, then the script, then the styles.
- Tasks on `public/app.js` (T012–T016, T018–T021, T023–T025, T028) run one after another.
- Tasks on `src/http/style.ts` (T007, T011, T027, T030) run one after another.
- T003 touches all 10 catalogs; nothing else edits them.

### Parallel Opportunities

- T004 beside T003; T007 beside T005 and T006.
- T009 beside T008; T011 beside T010.
- US4's style task T027 and US5's T030 beside US2's script work, since the files differ.
- T031 beside T032.

## Parallel Example: User Story 1

```text
Task: "Failing markup tests in test/integration/badges-section.test.ts (T008)"
Task: "Failing phone flows in e2e/badge-share.e2e.ts (T009)"
```

## Implementation Strategy

### MVP First

1. Setup and Foundational.
2. US1: Story, Bild and the sticker from a phone. Stop and check it in fake mode at both widths.

### Incremental Delivery

1. US1, then US2 (photo), then US3 (Glitzernd), then US4 (desktop hover) and US5 (icon).
2. Each step leaves the badges page working as before for everything else.

## Notes

- The checks on real devices (Instagram, WhatsApp, Strava, Signal; the iPhone icon) happen on the live site after the release, not as tasks here (quickstart.md "By hand").
- Commit after each task or logical group, Conventional Commits.
- Work in a worktree from `develop` (`../RynkePoints-033-badge-sharing`, `--no-track`). The mock-up worktree stays as reference.
- Fixtures are synthetic only.
