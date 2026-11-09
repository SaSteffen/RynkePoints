# Feature Specification: Share a Badge

**Feature Branch**: `033-badge-sharing`

**Created**: 2026-11-09

**Status**: Draft

**Input**: User description: "Riders can share an earned badge (personal or team) from the badges
page: as a story picture with some text, as a plain picture (for Strava and the like), and as an
overlay on their own photo. Mostly for phones; desktop needs an answer too. No rider name on the
picture and no option to add one; personal numbers are fine. Badges are exported exactly as they are
displayed. A sparkling, animated version that looks like a new badge, ideally for the photo overlay.
A small share button on each badge on the badges page, shown on hover on desktop and always on
phones. Apple's share icon on Apple devices, the three-dot icon elsewhere."

## Context

Badges (feature 013, Badges and Achievements) are the app's most visual reward, and riders already
post screenshots of them. A screenshot catches the page around the badge, crops badly and loses the
shine. Sharing gives them a clean picture made for the place they post it: a story, a chat, a
Strava activity, or their own photo from the ride.

**Visual reference**: [`drafts/`](drafts/) holds screenshots of a working mock-up built into the
real badges page in local fake mode, at phone width (390 px) and desktop width (1280 px), and the
files it made (`out-*.png`, `out-story-sparkling.mp4`). Their look, order and placement apply. The
photo is a generated drawing, and the rider and figures are synthetic. The mock-up is the local
branch `mock/badge-share` and is not merged.

**Terms**:

- **Large view**: a badge's enlarged view with its name, why it was earned and the date (feature
  013). On desktop it opens as a preview on hover and stays open after a click.
- **Share sheet**: the app's own panel for making a picture of one badge. Not the phone's system
  share sheet, which this spec calls the **system share**.
- **Format**: what the picture is made for: **Story** (portrait, 9:16), **Bild** (square), **Auf
  Foto** (the badge on the rider's own photo).
- **Sticker**: the badge alone on a transparent background ("Ohne Hintergrund").
- **Glitzernd**: the animated version: a short video of the badge shining and twinkling the way a
  newly earned badge does.

## Clarifications

### Session 2026-11-09

- Q: Share text with the picture? → A: Keep "Neues Abzeichen: {name} ({value}) 🐒".
- Q: A first-person "why" sentence on the picture? → A: No, name and date only.
- Q: Does a shared picture need a Strava mark? → A: No, the app's own mark is enough.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Share a badge as a story or a picture from a phone (Priority: P1)

A rider earns a badge, taps the small share button on it (or "Teilen" in its large view), sees a
story picture of the badge with its name and date, taps "Teilen …" and posts it to their story or a
chat through the phone's own share menu.

**Why this priority**: It's the main reason for the feature: getting a badge out of the app in two
taps, looking right.

**Independent Test**: On a phone, open the badges page, share a personal badge as a story to a chat,
and compare the received picture with the badge on the page.

**Acceptance Scenarios**:

1. **Given** a rider with an earned badge on a phone, **When** they open the badges page, **Then**
   every earned badge (in "Neueste" and in "Alle") shows a small share button, without hovering.
2. **Given** the share button on a badge, **When** the rider taps it, **Then** the share sheet opens
   for that badge with Story selected and a preview of the picture.
3. **Given** the share sheet, **When** the rider taps "Teilen …", **Then** the system share opens
   at once with the picture and the share text, and the picture arrives in the chosen app.
4. **Given** the Story picture, **When** the rider looks at it, **Then** it shows the badge exactly
   as on the page (picture, ribbon, milestone, cream edge, shadow), the badge's name, "erreicht am
   {date}" and the small app mark, on a white background with a soft yellow glow, and no rider name.
5. **Given** Bild, **When** the rider looks at the preview, **Then** it shows the same content in a
   square.
6. **Given** Bild with "Ohne Hintergrund" on, **When** the rider shares it, **Then** the picture is
   the badge alone on a transparent background, without name, date or app mark.
7. **Given** a team badge, **When** the rider shares it, **Then** it looks as the team badge does
   on the page, with the team ribbon colour.

---

### User Story 2 - Put a badge on my own ride photo (Priority: P1)

A rider picks a photo from the ride, places the badge on it with a finger, makes it bigger or
smaller with two, and shares the photo with the badge on it.

**Why this priority**: A photo with the badge on it is what people post on Strava and in stories.
It was asked for explicitly.

**Independent Test**: Pick a synthetic photo, move and resize the badge, share it, and check the
result has the photo's proportions and the badge where it was placed.

**Acceptance Scenarios**:

1. **Given** Auf Foto with no photo yet, **When** the rider looks at the sheet, **Then** they see a
   button to pick a photo and a line saying the photo stays on their device.
2. **Given** a picked photo, **When** it appears, **Then** the badge sits in the lower right corner
   at about 38 % of the photo's width.
3. **Given** the photo on a phone, **When** the rider drags the badge with one finger, **Then** it
   follows the finger; **When** they pinch with two, **Then** it grows or shrinks.
4. **Given** the photo on desktop, **When** the rider drags the badge with the mouse, **Then** it
   moves; **When** they scroll over the preview, **Then** it grows or shrinks.
5. **Given** a placed badge, **When** the rider shares, saves or copies, **Then** the result is the
   whole photo in its own proportions with the badge exactly where the preview showed it.
6. **Given** a photo was picked, **When** the rider taps "Anderes Foto", **Then** they can pick a
   different one and the badge keeps its relative place and size.
7. **Given** any photo, **When** it is used, **Then** it never leaves the device: it is not uploaded,
   stored or sent anywhere by the app.

---

### User Story 3 - Share the sparkling version (Priority: P2)

A rider switches on "Glitzernd" and gets a short video of the badge shining and twinkling like a
freshly earned one, as a story, a square or on their photo.

**Why this priority**: It's what makes sharing feel special and was asked for, but a still picture
already does the job.

**Independent Test**: Switch on "Glitzernd" for a story, save the video, and play it next to the
badge's large view.

**Acceptance Scenarios**:

1. **Given** the share sheet, **When** the rider switches on "Glitzernd", **Then** the preview
   shows "Wird gerendert …" until the video is ready, then plays it in a loop.
2. **Given** the video, **When** it plays, **Then** the shine sweeps over the badge and the four
   stars twinkle as in the large view of a new badge, and it ends where it can loop smoothly.
3. **Given** a still picture (Glitzernd off), **When** it is made, **Then** it has no twinkling
   stars, only the badge.
4. **Given** "Ohne Hintergrund" on, **When** the rider looks at the options, **Then** "Glitzernd"
   is not offered, because a video can't be transparent.
5. **Given** the video, **When** the rider shares it to the common story and chat apps (Instagram,
   WhatsApp, Strava, Signal), **Then** they accept it.
6. **Given** a browser that can't make such a video, **When** the rider opens the share sheet,
   **Then** "Glitzernd" is not offered, and still pictures work as usual.

---

### User Story 4 - Save or copy on desktop (Priority: P2)

A rider on a laptop hovers over a badge, clicks its share button, and saves the picture to upload
it elsewhere or copies it to paste into a chat.

**Why this priority**: Desktop has no system share on many browsers; saving and copying cover it.

**Independent Test**: On a desktop browser, save a Bild and paste a copied Story into a chat app.

**Acceptance Scenarios**:

1. **Given** a desktop with a mouse, **When** the rider looks at the badges page, **Then** the share
   buttons are hidden until the pointer is over the badge's card or gallery spot, or the button has
   keyboard focus.
2. **Given** the pointer on a badge, **When** its hover preview opens and the rider moves to the
   share button, **Then** the preview closes and the button is visible and clickable.
3. **Given** the hover preview of the large view, **When** it shows, **Then** it has no "Teilen"
   button; **When** the rider clicks the badge and the large view stays open, **Then** "Teilen"
   appears.
4. **Given** the share sheet on desktop, **When** it opens, **Then** it is a centred dialog with
   "Speichern" and "Kopieren", and "Teilen …" only where the browser offers the system share.
5. **Given** "Speichern", **When** clicked, **Then** the file is saved with a name made of the app
   and the badge, never the rider's name.
6. **Given** "Kopieren", **When** clicked, **Then** a still picture is on the clipboard and the
   sheet says "Kopiert". With Glitzernd on, "Kopieren" is not offered.

---

### User Story 5 - The share icon riders know (Priority: P3)

A rider sees the share symbol their device uses: Apple's box with an arrow on an iPhone or iPad,
three linked dots on Android and on desktop.

**Why this priority**: It avoids confusion, but sharing works either way.

**Independent Test**: Open the badges page on an iPhone, an Android phone and a desktop browser and
compare the icon.

**Acceptance Scenarios**:

1. **Given** an iPhone or iPad, **When** the rider sees a share button, **Then** it shows Apple's
   share icon.
2. **Given** Android or a desktop, including a Mac, **When** the rider sees a share button, **Then**
   it shows the three linked dots.
3. **Given** any device, **When** the page loads, **Then** the icon doesn't change after it first
   appears.

---

### Edge Cases

- **No earned badge**: no share buttons and no share sheet on the page.
- **Long badge names**: the name wraps onto at most two lines on the picture and is never cut off
  mid-word; it never overlaps the badge or the date.
- **Long milestone text** (for example a long team milestone): it stays on the ribbon as on the
  page.
- **Very large or very wide photo**: the result keeps the photo's proportions and is at most 1920 px
  on its long side; a portrait, landscape or square photo all work.
- **Photo in a format the browser can't read** (for example some HEIC files): the sheet says the
  photo can't be used and offers to pick another.
- **Rider drags the badge partly off the photo**: it stays at least half inside the photo.
- **Rider closes the sheet while the video renders**: the rendering stops; nothing is kept.
- **Rider switches format while the video renders**: the old rendering stops and a new one starts.
- **System share cancelled by the rider**: nothing happens and no error is shown.
- **System share or clipboard refused by the browser**: the sheet says so and offers "Speichern".
- **Offline**: the sheet still works for badges whose picture the page has already loaded.
- **Theme or dark mode**: the share sheet follows the app's theme; the picture itself is always the
  same light design.
- **Language**: the date line and the share text are in the rider's language; the badge name is as
  shown on the page.
- **Reduced motion**: the preview of "Glitzernd" doesn't play by itself; the video file is unchanged.
- **Screen readers**: every share button says which badge it shares ("„{name}“ teilen"), the format
  choice is a labelled group, and the switches are announced with their state.

## Requirements *(mandatory)*

### Functional Requirements

**Entry points**

- **FR-001**: Every earned badge on the badges page, personal and team, in "Neueste" and in "Alle",
  MUST have a small round share button at its top right corner.
- **FR-002**: On touch devices the share button MUST always be visible. With a mouse it MUST appear
  only while the pointer is over the badge's card or gallery spot, or while it has keyboard focus.
- **FR-003**: The share button's touch target MUST be at least 44 × 44 px, even if the visible
  circle is smaller, and it MUST NOT cover the badge's milestone ribbon.
- **FR-004**: The badge's large view MUST have a "Teilen" button below the date when it stays open,
  and MUST NOT show it in the desktop hover preview.
- **FR-005**: Moving the pointer onto a share button MUST close any hover preview of the large view,
  so nothing covers the button.
- **FR-006**: Each share button MUST have the accessible name "„{badge name}“ teilen" (in the rider's
  language).
- **FR-007**: Share buttons MUST show Apple's share icon on iPhone and iPad and the three linked
  dots everywhere else, including Mac. The icon MUST be decided before the page first shows.

**The share sheet**

- **FR-008**: A share button MUST open the share sheet for its badge: a bottom sheet on phones, a
  centred dialog on wider screens. It MUST close on its close button, on Escape and on a tap or click
  beside it.
- **FR-009**: The sheet MUST offer the formats Story, Bild and Auf Foto, with Story selected first,
  and MUST show a live preview of the result.
- **FR-010**: Bild MUST offer "Ohne Hintergrund", which gives the badge alone on a transparent
  background.
- **FR-011**: The sheet MUST offer "Glitzernd" for every format, except with "Ohne Hintergrund" on,
  and except where the browser can't make the video (FR-024).
- **FR-012**: The sheet MUST offer "Teilen …" where the device's system share accepts the file,
  "Speichern" always, and "Kopieren" for still pictures where the browser can copy pictures.
- **FR-013**: The file MUST be ready before the rider taps "Teilen …", so the system share opens
  straight away; while it isn't ready, the actions MUST be disabled and the preview MUST say so.
- **FR-014**: The system share MUST carry the picture and the share text "Neues Abzeichen: {name}
  ({value}) 🐒" (in the rider's language). Apps that ignore shared text get the picture alone.

**The picture**

- **FR-015**: The badge MUST look exactly as it does in the large view: the same picture, ribbon and
  ribbon colour, milestone text and font, cream edge and shadow, sharp at the output size.
- **FR-016**: Story (1080 × 1920 px) and Bild (1080 × 1080 px) MUST show the badge, its name, the
  line "erreicht am {date}" and the app's mark and name, on a white background with a soft yellow
  glow behind the badge. The design MUST be the same for every team, theme and dark mode.
- **FR-017**: Story MUST keep the badge, name and date out of the top and bottom areas that story
  apps cover with their own controls (about 250 px each).
- **FR-018**: No picture or video MUST contain the rider's name, photo from Strava, or any other
  rider detail, and the sheet MUST NOT offer to add one. The badge's own milestone (for example "500
  km") is shown as on the page.
- **FR-019**: The picture MUST NOT include the sentence on why the badge was earned; the large
  view's "Du hast …" reads wrongly to whoever sees the picture, and there is no first-person
  version.
- **FR-020**: Still pictures MUST NOT show the twinkling stars.
- **FR-021**: Auf Foto MUST use the rider's photo at its own proportions, at most 1920 px on the long
  side, with the badge where the rider placed it. Its default place is the lower right corner at
  about 38 % of the photo's width.
- **FR-022**: The rider's photo MUST be used only on the device: never uploaded, stored on the
  server, logged or kept after the sheet closes.

**Glitzernd**

- **FR-023**: The video MUST show the large view's shine sweep twice and the four stars twinkling
  for its whole length, about 5 seconds, and MUST loop without a jump.
- **FR-024**: The video MUST be MP4 (H.264) in every browser that offers "Glitzernd", so the common
  story and chat apps accept it. A browser that can't make MP4 MUST NOT offer "Glitzernd".
- **FR-025**: While the video is made, the preview MUST show "Wird gerendert …", and the actions MUST
  wait for it. Making a story video MUST take no longer than the video is long on a mid-range phone.
- **FR-026**: With reduced motion asked for, the sheet MUST NOT play the video by itself; the rider
  can still make and share it.

**General**

- **FR-027**: Everything MUST be made on the rider's device from what the badges page already
  shows. Sharing MUST NOT read anything new from Strava, store anything on the server, or tell the
  server which badge was shared.
- **FR-028**: All rider-facing text of this feature MUST be in the catalogs in every shipped
  language (German source, English reference, the others translated).
- **FR-029**: File names MUST be made of the app's name and the badge's name or id, never the
  rider's name.
- **FR-030**: Shared pictures and videos MUST carry only the app's own mark (Story and Bild) or
  none (sticker, Auf Foto); no Strava mark. The badge is the app's own achievement, not a display of
  Strava activity data.

### Key Entities

- **Share request**: one badge (from the page), a format, the two options (Glitzernd, Ohne
  Hintergrund), and for Auf Foto the photo and the badge's place and size. It lives only while the
  sheet is open and is never stored.
- **Share file**: the still picture (PNG) or video (MP4) made from a share request, with its file
  name and the share text.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a phone, a rider gets from the badges page to the system share with a story picture
  in at most 2 taps.
- **SC-002**: The still picture is ready within 1 second of opening the sheet, and the story video
  within 6 seconds, on a mid-range phone.
- **SC-003**: Side by side with the large view, a reviewer finds no difference in the badge itself
  (picture, ribbon, milestone, edge) in 10 of 10 shared badges, personal and team.
- **SC-004**: A shared video is accepted by Instagram Stories, WhatsApp and Strava on both iPhone and
  Android.
- **SC-005**: No request leaves the device while a rider makes and shares a picture with their own
  photo.
- **SC-006**: In a first round with team members, at least half of the riders who earn a badge in a
  week try sharing it, and no one asks where the share button is.

## Assumptions

- Badges, their pictures and the large view come from feature 013 and don't change here.
- Riders mostly share from phones; the system share exists on iPhone and Android browsers; many
  desktop browsers lack it, and "Speichern" and "Kopieren" cover them.
- The share sheet follows the app's theme like any other dialog (Material 3 and Rynkeby colours,
  feature 011 and 012); only the picture has its own fixed light design.
- A rider sharing their own badge with its milestone is their own choice about their own result, so
  it needs no change to the consent (constitution Principle I): nothing is shown to other riders or
  organisers through the app.
- Team badges can be shared by every rider who sees them; they carry no names.
- Making the video in every browser may need a small encoding library; the plan justifies it
  (constitution Principle IV) or chooses stills only in browsers that can't make MP4.
- The mock-up's wording is a draft for German and English; the other languages get translations.
- Out of scope: sharing a link to a public badge page, sharing several badges at once, sharing
  progress toward a badge, sharing Rynke or rankings, posting straight to Strava through its API,
  and the "new badge" banner (it can follow later).
