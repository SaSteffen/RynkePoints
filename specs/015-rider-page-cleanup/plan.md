# Implementation Plan: Rider Page Cleanup

**Branch**: `015-rider-page-cleanup` | **Date**: 2026-10-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/015-rider-page-cleanup/spec.md`

## Summary

The rider's pages stop talking about the import. They put the greeting first,
and they move "install the app" from inline boxes into one floating prompt that
shows once per device and is followed by a one-time notifications offer.

- **Waiting state (US1)**:
  - A rider with no balance yet sees the Rynke coin spinning and a one-time "come
    back in about 5 minutes" message on Overview and Rides (R1, R4).
  - The page polls a new `GET /me/ready` every 15 s while visible. It's one D1
    read with no Strava call. The page reloads once the first balance exists (R5).
  - `importing`, the two import and calculating notices, "Import abgeschlossen"
    and "Noch keine Fahrten importiert" all go (R2, R3).
  - The import already starts at the first connection (feature 001). It stays as
    it is and gets a test (R6).
- **Greeting on top (US2)**: the hero comes first on the Overview, followed by the
  reconnect and rule-change notices (R7).
- **Install, then notifications (US3)**:
  - `shellPage` renders one hidden `aside#app-prompt` with an install panel and a
    notify panel (R8).
  - `public/app.js` shows each panel once per device, tracked by two
    `localStorage` keys (R9), and shares the subscribe step with the Settings
    switch (R10).
  - The inline hint and its "Ausblenden" button leave the Overview and the
    landing page. Settings keeps installing, without the hide button (R11).

There is no migration, no new Strava request, no scope and no consent version.

## Technical Context

**Language/Version**: TypeScript (`tsc --noEmit`) on Cloudflare Workers, plus
plain browser JavaScript in `public/app.js`, as in features 010 and 011.

**Primary Dependencies**: none new.

**Storage**: D1 unchanged. `riders.import_status` stays for the workers
([data-model.md](data-model.md)). There are two new `localStorage` keys on the
device.

**Testing**: Vitest in workerd (`pnpm test`). Integration tests go through
`handleFetch`, and unit tests cover the view model. `app.js` behaviour is checked
in the walk-through ([quickstart.md](quickstart.md)).

**Target Platform**: Cloudflare Workers. Phone browsers are 360 px wide, and
installs happen on Android/Chromium and iOS Safari.

**Project Type**: web service with server-rendered pages and one small page
script.

**Performance Goals**:
- SC-002: the first figures within 5 minutes. The poll's 15 s adds at most 15 s
  after the balance is written.
- FR-004: within one minute.

**Constraints**:
- the poll makes no Strava request (FR-006);
- the reduced-motion setting is respected (FR-007);
- the prompt never moves content and doesn't trap focus (FR-012, FR-016);
- all text comes from the catalogs in German and English (FR-017);
- controls are at least 44 px tall (011).

**Scale/Scope**:
- about 50 riders, which means one D1 read every 15 s per open waiting page,
  and only for the few minutes before the first data arrives;
- 1 new route;
- changes to about 10 server modules plus `app.js`;
- 8 keys added and 5 removed.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. Privacy and consent | Nothing new is read from Strava, stored or shown to anyone else. `/me/ready` tells the signed-in rider only whether their own balance exists. The prompt state stays on the device and is never sent. | ✅ |
| II. Strava API citizenship | No new Strava call. The import keeps its single-consumer queue and budget deferral (R6). Polling hits our own D1 only. | ✅ |
| II. Capacity | The ~50-rider figure in the spec is about timing, and the code assumes no capacity. Connecting more than 10 riders still needs the Developer Program review (#31), independent of this feature. | ✅ |
| III. Rider-authored content | Not touched. | ✅ |
| IV. Serverless, minimal deps | No dependency and no migration. The waiting animation is CSS, and polling is a plain `fetch` with no SSE, WebSocket or Durable Object (R5). | ✅ |
| V. Test-first | Every server-side FR gets a failing test first ([quickstart.md](quickstart.md) §1). The client script's behaviour has no harness today, so it gets a scripted walk-through instead (R12). | ✅ |
| Language | German source keys and English copies. Removed keys are removed from both catalogs ([contracts/catalog.md](contracts/catalog.md)). | ✅ |
| Repo rules | Text only in catalogs; `src/` doesn't import `dev/`; synthetic fixtures. | ✅ |

**Post-design re-check**: still passes. The design adds one read-only route and
one client element and removes texts. It keeps the old dismissal key as
"install prompt done" (R9), so riders who already hid the hint aren't asked
again.

## Project Structure

### Documentation (this feature)

```text
specs/015-rider-page-cleanup/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── http-routes.md   # GET /me/ready; callback enqueue asserted
│   ├── pages.md         # waiting state, Overview order, app prompt markup
│   ├── client.md        # app.js: poll, prompt, subscribe, Settings install
│   └── catalog.md       # keys added and removed
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── http/
│   ├── router.ts              # + GET/HEAD /me/ready, before the page dispatcher
│   ├── ready.ts               # new: handleReady (session → balance exists?)
│   ├── rider-view.ts          # "not-worked-out" → "waiting"; drop importing
│   ├── rider-sections.ts      # + renderWaiting; renderNotice keeps only "updating";
│   │                          #   empty rides → me.recent.none
│   ├── sections/overview.ts   # hero first; waiting or content; no install hint,
│   │                          #   no import line
│   ├── sections/rides.ts      # waiting, or notice + rides
│   ├── sections/settings.ts   # install group without dismiss
│   ├── landing.ts             # no install hint
│   ├── pwa.ts                 # renderInstallHint without dismiss; + renderAppPrompt
│   ├── shell.ts               # + app prompt in every section
│   └── style.ts               # + .waiting, coin-spin, .app-prompt, reduced motion
├── db/rider-view.ts           # + hasBalance read for /me/ready
└── i18n/messages/{de,en}.ts   # + waiting.*, prompt.*, me.recent.none; − 5 keys

public/app.js                  # + waitForFirstData, appPrompt, subscribePush;
                               #   installHint → installSettings

test/
├── unit/                      # rider-view, rider-sections, style
└── integration/
    ├── me-ready.test.ts       # new
    └── …                      # overview, me-status, me-rynke, me-activities,
                               #   pwa-pages, callback
```

**Structure Decision**: same single Worker. `/me/ready` gets its own small
module next to `pwa.ts`, which also serves JSON to the page script.

## Complexity Tracking

No constitution violations.
