# Implementation Plan: Badges and Achievements (art pipeline)

**Branch**: `013-badges-achievements` | **Date**: 2026-10-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/013-badges-achievements/spec.md`

**Scope of this plan**: the art pipeline only, at the project owner's request:
everything from the badge frames and the Gemini prompts to the finished badge
files the app will show (FR-040, FR-040a and the art assumptions). Badge
evaluation, runs, storage, the Badges section and its sizes (FR-001 to FR-032,
FR-041, FR-042) get their own plan later; this one only fixes the interface they
will use: one finished SVG per badge and a list of the badges that have one.

## Summary

A badge is a frame drawn exactly in code (an edge of sunflower petals, a ring
with three stars, a round cream window; the ring black for personal badges and
light blue for team badges) with a picture in its window. The design comes from
the hand-made reference images in `art/badges/reference/`. The pictures are
generated with Gemini in the browser, one fresh chat per badge, from a shared
prompt, a per-badge scene and that reference image
(`pnpm badge-art`), then traced into flat SVG with the tracer of PR #101 and
composed with the frame into one self-contained SVG per badge in
`public/badges/`. Until a badge has a picture, the app shows the frame with the
coin's Rynke (FR-040a). A generated module lists which badges have a picture, so
the app never asks for a file that doesn't exist.

## Technical Context

**Language/Version**: JavaScript (Node 22, ES modules) for the scripts in
`scripts/`; one generated TypeScript module for the app.

**Primary Dependencies**: Playwright (`@playwright/test`, already a dev
dependency) driving the user's Google Chrome; ImageMagick and potrace as
external tools, like `pnpm icons` and
`pnpm illustrations`. No new runtime or dev dependency.

**Storage**: files in the repo: `art/badges/` (inputs and palette-snapped
originals), `public/badges/` (served SVGs), `src/badges/pictures.ts` (generated
list).

**Testing**: Vitest (existing setup, Workers runtime) for the pure modules:
prompt assembly and badge-list validation, frame geometry and composition. The
browser automation and the tracer are checked by the quickstart, not in CI.

**Target Platform**: the maintainer's machine (Arch Linux) with Chrome and a
Google account; outputs are static assets served by the Worker.

**Project Type**: build-time tooling for the existing Cloudflare Worker web app.

**Performance Goals**: a full run of 69 badges unattended, within Gemini's usage
limits (resumable); each finished badge SVG at most about 100 KB (traced
illustrations measure 47 to 74 KB, the frame 5 KB) so a page with a dozen
badges stays light.

**Constraints**: no rider data anywhere in the pipeline; Gemini's page is not an
API, so selectors live in one place; the repo is public and must not grow by
hundreds of MB of raster originals.

**Scale/Scope**: 69 badges (35 personal, 34 team), 2 frames, 2 placeholders.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|-----------|-------|--------|
| I. Privacy and consent | Gemini gets only the prompt and the frame-with-Rynke reference; no rider data, names or figures are in any input or output. The Gemini session uses the maintainer's own Google account in a separate browser profile outside the repo. | Pass |
| II. Strava citizenship | No Strava calls. | N/A |
| III. Rider-authored content | Nothing written to Strava. | N/A |
| IV. Serverless, minimal deps | No new dependency: Playwright is already a dev dependency; external tools as for `pnpm icons`. Outputs are static assets within the free tier. | Pass |
| V. Test-first | The pure modules (prompt assembly, badge-list validation, frame geometry, composition) are written test-first in Vitest. The Gemini automation and the tracer depend on a live website and external binaries and are validated by `quickstart.md` instead, like `pnpm icons` today (Complexity Tracking). | Pass with a justified exception |
| Language | Prompts and art files are not rider-facing; badge names and texts come from the i18n catalogs in the app's own plan (FR-041). Pictures contain no text. | Pass |

Post-design re-check (after Phase 1): unchanged. Composition at build time keeps
the app side to static files and one generated list; no new route, binding or
data.

## Project Structure

### Documentation (this feature)

```text
specs/013-badges-achievements/
├── plan.md              # This file (art pipeline scope)
├── research.md          # Decisions R1–R9
├── data-model.md        # Art entities: badge art entry, snippet, frame, picture list
├── quickstart.md        # Validating the pipeline end to end
├── contracts/
│   └── badge-assets.md  # Files, SVG format, window geometry, commands, picture list
└── tasks.md             # /speckit-tasks output (art pipeline only)
```

### Source Code (repository root)

```text
art/badges/
├── README.md            # How to make and check badge pictures
├── badges.json          # Every badge: id, group, category, threshold, scene; snippets
├── prompt.txt           # Shared prompt template ({{scene}})
├── reference/           # badge-{personal,team}.png: the design with Rynke (hand-made)
└── originals/           # <id>.png: palette-snapped originals (committed)

scripts/
├── badge-art.mjs        # pnpm badge-art: generate pictures with Gemini (exists)
├── badge-prompts.mjs    # pure: load/validate badges.json, assemble prompts (new, tested)
├── badge-frame.mjs      # pure: frame markup, window geometry, compose (new, tested)
├── badge-build.mjs      # pnpm badge-build: references, trace, compose, picture list (new)
├── trace.mjs            # shared tracer, extracted from illustrations.mjs (after #101)
└── illustrations.mjs    # uses trace.mjs (after #101)

public/badges/
├── <id>.svg             # finished badge: frame + traced picture
└── placeholder-{personal,team}.svg

src/badges/
└── pictures.ts          # generated: ids of badges with a picture

test/unit/
├── badge-prompts.test.ts
└── badge-frame.test.ts
```

**Structure Decision**: The pipeline stays in `scripts/` and `art/`, next to
`icons.mjs` and `illustrations.mjs`. Pure logic goes into dependency-free
modules that Vitest can load in the Workers runtime; the scripts that need the
file system, external tools or a browser stay thin around them. The app gets
static files and one generated module, nothing else.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Gemini automation and tracer not covered by CI tests (Principle V) | They need a signed-in browser on a live third-party site and external binaries (ImageMagick, potrace) | Mocking Gemini's page would test our mock, not Gemini, and break silently when Google changes the page; the quickstart's manual run is the real check. The pure parts they call are tested. |
