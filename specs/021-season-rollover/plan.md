# Implementation Plan: Season Rollover – Tour de Paris Badges and the Season Album

**Branch**: `021-season-rollover` | **Date**: 2026-10-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/021-season-rollover/spec.md`

## Summary

Two parts, shippable separately:

- **Tour de Paris (US1, US2)**: a fourth team-event kind `tour_de_paris`
  (migration `0018` adds the kind row). It earns no Rynke: the Rynke-earning
  kinds stay `TEAM_EVENT_KINDS`, a new `EVENT_KINDS` adds the tour (R9). Tour
  days are limited by the season start and the season's end, not by the
  qualification deadline, through one helper every event filter uses (R10).
  The team badge catalog gets the category `tour_de_paris` with the ladder
  1–8, stand-in names and the team placeholder picture, worked out on read like
  every team badge from each listed rider's count of tour days (R11). Tour days
  also count for the team-event badges (FR-005).
- **Season album (US3–US5)**: a separate, never-deployed Worker under `album/`
  renders each rider's album as one HTML page with A4 print CSS, reusing the
  app's own readers, badge evaluation, catalog, i18n and pictures. `pnpm
  season:album` starts it with `wrangler dev` on the maintainer's computer, its
  `DB` binding pointed at production with a read-only guard (R12), prints every
  album with Playwright's Chromium to `season-albums/` (git-ignored), and checks
  every PDF for print readiness (R14). The page layout, pagination and sticker
  placement are computed in millimetres in pure TypeScript, so they are
  deterministic and unit-tested (R13).

One migration, one new dev dependency (`pdf-lib`, for the print check), one font
file, no production route, no Strava request.

## Technical Context

**Language/Version**: TypeScript (`tsc --noEmit`) on Cloudflare Workers for the
app and the album Worker; Node 24 (`.nvmrc`) ES modules for the command
(`scripts/season-album.mjs`), like `scripts/strava-review.mjs`.

**Primary Dependencies**: none new at runtime. Dev: Playwright (already there,
`@playwright/test`'s Chromium) to print, Wrangler (already there) to run the
album Worker with a remote D1 binding, `pdf-lib` (new dev dependency, pure JS, no
native build) to read the written PDFs for the print check (R14).

**Storage**: D1. Migration `0018_tour_de_paris.sql` inserts `tour_de_paris` into
`team_event_kinds`; no table changes. Albums are files in `season-albums/`, never
in D1 or anywhere in Cloudflare (spec FR-020, owner: never in Cloudflare).

**Testing**: Vitest in the Workers runtime (`pnpm test`): catalog, tour badge
evaluation, event windows, the read-only guard, album layout geometry and
pagination, album rendering against seeded synthetic data compared with the
app's own pages (SC-003). The command itself is run by hand against `pnpm dev`'s
sample season (quickstart).

**Target Platform**: the app as today; the album Worker runs only locally under
`wrangler dev` (workerd); the command on the maintainer's Linux/macOS computer.

**Project Type**: web service (Worker) plus a maintainer command.

**Performance Goals**: 60 albums in under 15 minutes (FR-027); measured about
3–6 s per album in research R1.

**Constraints**: A4 210 × 297 mm, mirrored margins 12 / 12 / 12 mm and a 20 mm
gutter, no bleed, even page count, vector only (FR-050–FR-057); read-only access
to production; nothing of `album/` in the production bundle.

**Scale/Scope**: about 60 riders, 129 badges (121 today plus 8 tour days), about
40 team events per season, about 16 pages per album.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|-----------|-------|--------|
| I. Privacy and consent | Albums hold only what the app shows the rider plus team sums (FR-033, FR-041); no new consent version. Data leaves Cloudflare only as the PDFs, on the maintainer's computer, into a git-ignored folder the maintainer deletes; the privacy page says so (FR-040). No D1 export or local copy of the database: the album Worker reads production through the binding (R12). | Pass |
| I. Secrets never committed | `season-albums/` in `.gitignore`, guarded by a test; no new secret (Wrangler's own login). | Pass |
| II. Strava citizenship | No Strava request anywhere in this feature. | Pass |
| III. Rider content wins | Nothing written to Strava or to rider data. | Pass |
| IV. Serverless, minimal deps, free tier | No new runtime dependency. `pdf-lib` is dev only, justified in R14. Generation never runs in Cloudflare; D1 reads for 60 albums are a few thousand rows, far inside the free tier. Badges stay pure functions of stored data (R11). | Pass |
| V. Test-first | Tasks start with failing tests for kind, window, tour badges, guard, layout and rendering. | Pass |
| Manual production steps | Running the command against production is a manual maintainer step like `strava:review --remote`; it only reads. | Pass |
| Language | Album text from the i18n catalogs, German default, English too; badge names German (FR-039). | Pass |

Re-checked after Phase 1 design: still passes; no entry in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/021-season-rollover/
├── plan.md              # This file
├── research.md          # R1–R8 feasibility and tooling, R9–R16 design
├── data-model.md        # Kinds, catalog, tour badge inputs, album model
├── quickstart.md        # How to check the feature end to end
├── contracts/
│   ├── season-album-command.md   # pnpm season:album: options, output, exit codes
│   ├── album-worker.md           # the local album Worker's routes and guard
│   ├── album-layout.md           # page geometry, slots, stickers, pagination
│   └── messages.md               # new message ids (de/en) and badge names
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
migrations/
└── 0018_tour_de_paris.sql          # INSERT INTO team_event_kinds ('tour_de_paris')

src/
├── rynke/
│   ├── team-events.ts              # EVENT_KINDS (adds tour_de_paris); TEAM_EVENT_KINDS
│   │                               # stays the Rynke-earning kinds; isEventKind
│   └── rules.ts                    # seasonEnd(), eventInWindow(kind, date, window)
├── badges/
│   ├── catalog.ts                  # category tour_de_paris, ladder 1..8, version 6
│   ├── team.ts                     # tour series from per-rider tour-day counts;
│   │                               # events filtered with eventInWindow
│   ├── evaluate.ts                 # personal team_events count tour days (eventInWindow)
│   └── view.ts                     # progress "Noch n Tage" for the tour category
├── db/
│   ├── team.ts                     # team badge sums: + tour attendance per listed rider
│   └── team-events.ts              # kind typed as EventKind
├── http/
│   ├── organiser/events.ts         # kind select offers Tour de Paris; window by kind
│   ├── sections/events.ts          # Termine: tour days listed after the deadline,
│   │                               # no Rynke amount (FR-004)
│   └── privacy.ts                  # the album paragraph (FR-040), via messages
└── i18n/messages/                  # de.ts, en.ts, badges.de.ts (stand-in names)

art/badges/badges.json              # + 8 tour badges (kept equal to catalog.ts)

album/                              # never deployed; not imported by src/
├── wrangler.jsonc                  # name rynke-album, main worker.ts, DB remote: true,
│                                   # assets ../public, no routes, workers_dev false
├── worker.ts                       # GET /riders, GET /album/:athleteId, /album.css,
│                                   # fonts; read-only DB guard; local hosts only
├── guard.ts                        # read-only D1 wrapper (SELECT/WITH only)
├── load.ts                         # one rider's album data via src/db readers
├── layout.ts                       # pure: pages, safe areas, slots, sticker poses (mm)
├── render.ts                       # pure: album HTML from data + layout + i18n
├── album.css                       # @page 210mm 297mm, print rules, no filters
└── fonts/                          # one OFL font (woff2) + OFL.txt

scripts/
└── season-album.mjs                # pnpm season:album: start album Worker, print
                                    # with Playwright, check PDFs, report

test/unit/
├── event-kinds.test.ts             # kinds, Rynke-earning kinds, windows by kind
├── badge-tour.test.ts              # tour ladder, dates, take-back, cap at 8
├── album-guard.test.ts             # writes rejected, reads pass
├── album-layout.test.ts            # A4 geometry, mirrored margins, even pages,
│                                   # no sticker outside its slot, determinism
└── album-ignore.test.ts            # .gitignore lists season-albums/
test/integration/
├── tour-events.test.ts             # create tour day after deadline, attend, no Rynke,
│                                   # Termine lists it, team badges follow
└── album-render.test.ts            # seeded synthetic season: summary figures equal
                                    # the app's pages; no other rider's name
```

**Structure Decision**: The tour kind and badges go into the existing `src/`
modules. The album lives in a new top-level `album/` folder, next to `dev/`: a
Worker entry of its own that imports from `src/` (allowed) while `src/` never
imports it (guarded like `dev/`, R12), so the production bundle never contains a
route that makes albums (FR-020). `tsconfig.json` includes `album`;
`.gitignore` gets `season-albums/`; `package.json` gets `season:album`.

## Complexity Tracking

No constitution violations to justify.
