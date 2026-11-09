# Quickstart: Share a Badge

How to check the feature end to end. Each item points to the requirement it proves; the expected
files are described in [contracts/files.md](contracts/files.md).

## Setup

```bash
pnpm install
pnpm vendor            # copies mp4-muxer into public/vendor/
pnpm dev:hamburg       # fake mode on http://localhost:8789, sample riders with badges
```

Sign in as a sample rider and open `/me/badges`.

## Automated

```bash
pnpm test -- badges-section      # markup: buttons only on earned badges, labels, one sheet, share text
pnpm test -- catalogs messages   # every new key in every catalog
pnpm exec playwright test e2e/badge-share.e2e.ts   # the flows below in Chromium, Firefox, WebKit
pnpm lint                        # includes the vendor check for the muxer copy
```

`e2e/badge-share.e2e.ts` covers:

| Check | How | Proves |
| --- | --- | --- |
| Buttons visible on touch, hidden until hover with a mouse | a phone context (`hasTouch`, 390 px) vs the desktop default, `toBeVisible` before and after `hover` | FR-002, US4-1 |
| Hover on a share button closes the hover preview | hover badge, then button; preview not open, button clickable | FR-005, US4-2 |
| Accessible name | `getByRole("button", { name: "„… “ teilen" })` | FR-006 |
| Sheet opens on Story with a preview | click; `dialog[open]`, `story` checked, canvas 1080 × 1920 | FR-008, FR-009 |
| Bild and sticker | canvas 1080 × 1080; corner pixel alpha 0 with "Ohne Hintergrund"; "Glitzernd" hidden then | FR-010, FR-011 |
| Photo stays local | synthetic PNG made in the test via `setInputFiles` buffer; no request recorded from picking to saving | FR-022, SC-005 |
| Photo result | downloaded PNG has the photo's proportions | FR-021 |
| File name | `download.suggestedFilename()` matches `{app}-{id}-{format}.png` and no sample rider's name | FR-029 |
| Glitzernd | where `VideoEncoder.isConfigSupported` says yes: "Wird gerendert …" shows, then the downloaded file starts with an `ftyp` box and contains `avc1`; where it says no: no switch | FR-011, FR-024, FR-025 |
| Close during render | close the sheet while rendering; no error in the console, no file kept | edge case |

## By hand on real devices

After the release, on the live site (no tasks for this; see the project's habit of checking UI on
the live site):

1. iPhone (Safari): the share buttons show Apple's icon. Share a Story to Instagram Stories and a
   Glitzernd Story to WhatsApp. Both arrive and the video plays (SC-004, FR-007).
2. Android (Chrome): three-dots icon; the same two shares, plus Glitzernd to Strava (SC-004).
3. Desktop (Firefox and Chrome): buttons appear on hover; save a Bild; copy a Story and paste it into
   a chat (US4). In Firefox, Glitzernd is offered if its H.264 encoder is there, otherwise not.
4. Mac Safari: three-dots icon (US5-2).
5. Compare 10 shared badges, personal and team, side by side with their large view (SC-003).
