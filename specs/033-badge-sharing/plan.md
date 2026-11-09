# Implementation Plan: Share a Badge

**Branch**: `033-badge-sharing` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/033-badge-sharing/spec.md`

## Summary

Riders share an earned badge from `/me/badges` as a story, a square picture or sticker, or on their
own photo, and as a still picture or a sparkling video. Everything is made in the browser from what
the page already shows. The server only adds markup and text; there is no new route, no storage and
no Strava request.

- **Markup**: `src/http/sections/badges.ts` adds three things, laid out in
  [contracts/pages.md](contracts/pages.md):
  - a share button on every earned badge, holding both the Apple icon and the three-dots icon, with
    CSS choosing between them;
  - "Teilen" in the large view, carrying the share text;
  - one share sheet `<dialog>` per page.
- **Pictures**: `public/app.js` draws on a canvas, building on the mock-up's drawing.
  - The badge is drawn as in the light theme: the same art, ribbon, milestone, edge and shadow.
  - The background is the same white with a yellow glow for every team.
  - There are fixed layouts for Story and Bild, and photo placement uses fractions of the photo
    (research R2, R3).
- **Glitzernd**: WebCodecs H.264 frames go into MP4 through the vendored `mp4-muxer` (MIT, about
  15 KB gzipped). It is loaded when the sheet first opens and offered only where the encoder
  supports the size. This replaces the mock-up's `MediaRecorder`, so Firefox gets MP4 too, or no
  "Glitzernd" (research R4, R5).
- **Actions**: the system share gets the file prepared in advance plus the share text. Save uses a
  blob download and Copy uses `ClipboardItem`. A cancelled share stays quiet; a refused one
  suggests saving (research R6).
- **Text**: 23 keys in every catalog ([contracts/messages.md](contracts/messages.md)).

## Technical Context

**Language/Version**: TypeScript on Cloudflare Workers (markup); plain JavaScript in `public/app.js`
(drawing, encoding, sheet)

**Primary Dependencies**: one new browser library, `mp4-muxer@5.2.2`, vendored to `public/vendor/`
like Chart.js and justified in research R5. Everything else uses platform APIs: Canvas 2D, WebCodecs
`VideoEncoder`, Web Share Level 2, Async Clipboard, `createImageBitmap` and Pointer Events.

**Storage**: none. No migration and no D1 change. The photo and files live in memory while the sheet
is open.

**Testing**: Vitest in the Workers runtime for the markup and catalogs, and Playwright in fake mode
(Chromium, Firefox, WebKit) for the sheet, the files and the "no request" check. Video playback in
the real share targets is checked by hand on the live site.

**Target Platform**: Cloudflare Workers (Free plan) and current browsers. Glitzernd needs WebCodecs
H.264: Chrome and Edge, Safari 16.4 and later (also on iOS), and Firefox where its H.264 encoder is
present.

**Project Type**: server-rendered web app

**Performance Goals**:

- A still picture is ready within 1 s of the sheet opening.
- A 5 s story video is ready in 6 s or less on a mid-range phone (SC-002). This is reached by
  encoding from a fixed clock, which is faster than real time.
- The badges page adds no request on load; the muxer (about 15 KB gzipped) loads when the sheet
  first opens.

**Constraints**:

- Nothing leaves the device (FR-022, FR-027, SC-005).
- No rider name on any picture or in any file name (FR-018, FR-029).
- No Strava mark (FR-030).
- All words in the catalogs.
- No code branches on a team's name; the app mark and name come from the team's data.

**Scale/Scope**: 1 page, about 30 earned badges at most per rider, 3 formats × 2 options, and 10
catalogs.

## Constitution Check

*GATE: must pass before Phase 0 research. Re-checked after Phase 1 design: all pass.*

| Principle | Status | How |
| --- | --- | --- |
| I. Rider privacy and consent | Pass | Nothing new is read, stored or shown to anyone else through the app. A rider sharing their own badge chooses to show their own result, outside the app (spec Assumptions). The photo stays in memory on the device and is released when the sheet closes. There are no rider names on pictures or in file names. Fixtures are synthetic: the test photo is drawn in the test. The privacy notice and the consent are unchanged. |
| II. Strava citizenship | Pass | No Strava request. No Strava data beyond what the badges page already shows (the milestone). No Strava mark, since a badge is the app's own achievement (FR-030). |
| III. Rider-authored content | Pass | Nothing a rider wrote is touched. No activity description is edited. |
| IV. Serverless, minimal dependencies | Pass with justification | One small browser library, `mp4-muxer`, for MP4 muxing, which no platform API does. It is pinned, vendored, loaded on demand and has a small attack surface (research R5). Rejected: our own muxer and `mediabunny` (see Complexity Tracking). No server work, so no Workers CPU. |
| V. Test-first | Pass | Each slice starts with a failing integration or e2e test; see [quickstart.md](quickstart.md). |

## Project Structure

### Documentation (this feature)

```text
specs/033-badge-sharing/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── pages.md        # badges page markup, share sheet, vendored file
│   ├── files.md        # what each format produces
│   └── messages.md     # catalog keys
├── drafts/             # mock-up screenshots and outputs (from /speckit-specify)
└── tasks.md            # /speckit-tasks
```

### Source Code

```text
src/
├── http/sections/badges.ts     # share buttons, "Teilen" in the large view, the share sheet
├── http/icons.ts               # SHARE: Apple and three-dots icons
├── http/style.ts               # buttons (hover, 44 px target, icon choice), sheet, preview
└── i18n/messages/*.ts          # contracts/messages.md, all 10 catalogs
public/
├── app.js                      # share sheet: drawing, photo placement, encode, share/save/copy
└── vendor/mp4-muxer-5.2.2.js   # + LICENSE (pnpm vendor)
scripts/vendor.mjs              # mp4-muxer entry
package.json                    # mp4-muxer 5.2.2 devDependency (pinned, like chart.js)

test/integration/badges-section.test.ts   # markup, labels, one sheet, share text, no rider name
e2e/badge-share.e2e.ts                    # flows, files, no-request check, Glitzernd where supported
```

**Structure Decision**: the existing single Worker. The share code is one block in `public/app.js`,
as the mock-up has it, and the browser code has no build step. The mock-up branch
`mock/badge-share` is the starting point for the implementation, but its `MediaRecorder` recording
gets replaced (R4), and the edge cases it skipped get added: unreadable photo, refused share, abort
on close, reduced motion.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| New browser library `mp4-muxer` | MP4 in every browser that can encode H.264 (FR-024). Story apps reject WebM, and no platform API writes MP4 boxes. | `MediaRecorder` can't make MP4 in Firefox and runs in real time. Our own muxer would be about 300 lines of container code that CI can't check against Instagram or WhatsApp. `mediabunny` is 12 times the size for the same job. Leaving out Glitzernd in Firefox remains the fallback if the encoder is missing. |
