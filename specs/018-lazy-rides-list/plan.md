# Implementation Plan: Lazy-Loading Rides List

**Branch**: `018-lazy-rides-list` | **Date**: 2026-10-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/018-lazy-rides-list/spec.md`

## Summary

Rides stays a server-rendered page of 20 rides with the pager (feature 005 US5).
`public/app.js` turns it into one continuous list where it runs:

- **More rides (US1)**: a new `GET /me/rides/more?after=<key>` returns the next
  20 rides as an HTML fragment, rendered by the same card code as the page
  (R2). `after` is the sort key of the last shown ride, not a page number, so
  rides arriving or leaving between loads never repeat or skip a ride (R1).
  The page script watches the end of the list and asks for the next batch about
  a screen before the rider gets there (R4). It shows "loading", "couldn't
  load" with a retry, and announces added rides to screen readers (R6, R8).
- **Line above the list (clarification Q2)**: with the script, the pager and
  "Fahrten 1–20 von 87" hide and "87 Fahrten in dieser Saison" shows. Both
  lines and every new text are in the markup, hidden until the script shows
  them, as app.js holds no text (R6).
- **Keep my place (US2, clarification Q1)**: on leaving the page the script
  keeps, in session storage, how many rides were loaded and which ride was at
  the top. On a reload or a return by the back button it loads that many in one
  request (`limit`) and scrolls that ride back into place (R5).
- **Without the script (US3)**: the page is unchanged; `?page=N` still shows
  that page, now with a hidden "Zu den neuesten Fahrten" link that the script
  shows, and lazy loading continues below that page (R7).

There is no migration, no new stored data, no Strava request, no scope and no
consent version.

## Technical Context

**Language/Version**: TypeScript (`tsc --noEmit`) on Cloudflare Workers, plus
plain browser JavaScript in `public/app.js`, as in features 010, 011 and 015.

**Primary Dependencies**: none new. `IntersectionObserver`, `DOMParser`,
`fetch`, `sessionStorage` and `performance.getEntriesByType("navigation")` in the
browser; without `IntersectionObserver` the page keeps its pager (R4).

**Storage**: D1 unchanged; the batch reads `activities`, `ride_results` and
the overlapped ride like `RIDE_PAGE_SQL`, using the existing
`activities_by_rider (athlete_id, start_date DESC)` index (R9). One
session-storage key, `rp-rides-place`, in the rider's browser tab (R5).

**Testing**: Vitest in workerd (`pnpm test`): unit tests for the key and the
markup, integration tests through `handleFetch` for the new route. Playwright
smoke tests (`pnpm test:e2e`) drive the script with the fake mode's sample
rider "Paula Paging" (45 rides) in Chromium, Firefox and WebKit.

**Target Platform**: Cloudflare Workers; phone browsers 320–360 px wide and
desktop.

**Project Type**: web service with server-rendered pages and one small page
script.

**Performance Goals**: a batch is one D1 batch of two reads on the rider's
index; the next batch is requested about one screen height before the end
(SC-002). 300 cards stay smooth: they are plain markup without per-card script
(SC-006).

**Constraints**: free tier; no Strava request (FR-011); app.js holds no text
(feature 010 contracts/client.md); every new text in `de` and `en` catalogs.

**Scale/Scope**: up to ~60 riders, a few hundred rides each per season.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|---|---|---|
| I. Privacy and consent | The batch only returns the signed-in rider's own rides, behind the same session and consent checks as Rides (FR-010, R3). Nothing new is stored on the server; the browser keeps two numbers per tab. Nothing new is shown to anyone else. | Pass |
| II. Strava citizenship | No Strava request; D1 reads only (FR-011). | Pass |
| III. Rider content wins | Untouched: no description edits. | Pass |
| IV. Serverless, minimal deps | No dependency; platform APIs in the browser. | Pass |
| V. Test-first | Tests for the key, the route, the markup and the script's smoke behaviour come before the code in tasks.md. | Pass |
| Language | New rider texts in `de` (source) and `en`; code and docs in English. | Pass |

Re-checked after Phase 1: unchanged, no violations.

## Project Structure

### Documentation (this feature)

```text
specs/018-lazy-rides-list/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── http-routes.md
│   ├── pages.md
│   ├── client.md
│   └── catalog.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── db/rider-view.ts            # start_date in RideRow; readRideBatch (keyset)
├── http/
│   ├── rider-view.ts           # RideKey encode/parse, RideTable.more, rideLines
│   ├── rider-sections.ts       # renderRides lazy markup, renderRideBatch
│   ├── sections/rides.ts       # handleMoreRides
│   ├── router.ts               # GET /me/rides/more
│   └── style.ts                # .rides-more, .rides-newest
└── i18n/messages/{de,en}.ts    # rynke.rides.total/newest/loading/failed/retry/added
public/app.js                   # lazyRides()
test/
├── unit/rider-view.test.ts     # key round trip, RideTable.more
├── unit/rider-sections.test.ts # lazy markup
└── integration/rides-more.test.ts
e2e/smoke.e2e.ts                # scroll, keep place, no script
```

**Structure Decision**: the existing single Workers project; the route sits next
to `handleRides`, the batch read next to `readRiderView`.

## Complexity Tracking

None.
