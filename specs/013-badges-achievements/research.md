# Research: Badges art pipeline

Scope: the art pipeline of feature 013 (see [plan.md](plan.md)). Each decision
names what was chosen, why, and what else was considered.

## R1 Frame in code, picture from Gemini

- **Decision**: The badge frame (gold scalloped edge, ring, stars, round cream
  window) is drawn exactly in SVG by our code. Gemini draws only the picture for
  the window, on plain white.
- **Rationale**: Gemini's circles and repeated shapes are never exact, and 69
  frames drawn by Gemini would all differ. The rider-state illustrations (PR
  #101) made the same call ("we draw the disc in SVG").
- **Alternatives**: Gemini draws the whole badge, then the window is cut out:
  the window's position and size would differ per image, so cropping would need
  detection and still leave uneven frames.

## R2 One finished SVG per badge, composed at build time

- **Decision**: `pnpm badge-build` composes frame plus traced picture into one
  self-contained SVG per badge (`public/badges/<id>.svg`), with explicit colours.
  The app shows it with a plain `<img>`.
- **Rationale**: The coin colours are the same in light and dark mode
  (`--rp-coin-*` has no dark override in `src/http/style.ts`), and the gold edge
  separates the badge from either background, so CSS variables add nothing. One
  file per badge means one request, lazy loading, and no compositing code in the
  Worker. The page only references badges the rider has earned, which keeps the
  surprise (SC-003).
- **Alternatives**: Frame as an inline sprite (like the coin) plus the picture
  as a separate `<img>` clipped by CSS: two layers to keep aligned and twice the
  requests. Inlining the pictures in the page: page weight grows with every badge.

## R3 Frame source of truth: `scripts/badge-frame.mjs`

- **Decision**: A dependency-free module exports the frame markup for both kinds,
  the window geometry and the coin's Rynke as the placeholder picture. The
  reference PNGs, the placeholders and every finished badge come from it. The
  one-off drawing used for the first references is replaced by it.
- **Rationale**: One definition, so the reference Gemini sees, the placeholder
  and the shipped badges can't drift apart. A test checks that its Rynke matches
  the coin's front in `src/http/coin.ts`, so a change to the coin can't be
  forgotten here.
- **Alternatives**: Importing `coin.ts` from the script: Node can't resolve the
  app's extensionless TypeScript imports without a build step.

## R4 Picture placement in the window

- **Decision**: Gemini's canvas is 2048 px with the scene inside a centred circle
  of 1800 px (`prompt.txt`). Traced over the full canvas into 100 units, that
  circle has radius 1800 / 2048 × 50 = 43.95 at (50, 50). The window has radius
  31 at (50, 50), so the picture is placed with
  `translate(50 50) scale(0.7054) translate(-50 -50)` and clipped to the window.
- **Rationale**: Every picture is generated on the same canvas, so one fixed
  transform fits all, like the illustrations keep a shared scale.
- **Alternatives**: Fitting each picture to its own bounding box: pictures would
  end up at different sizes and lose the "cropped round" composition the prompt
  asks for.

## R5 Tracing: shared tracer from PR #101

- **Decision**: After #101 is merged, its tracing is moved into
  `scripts/trace.mjs` (`traceImage(file) → { viewBox, paths }`), used by both
  `illustrations.mjs` and `badge-build.mjs`. Settings stay the same (palette
  snapping, 5 × 5 majority filter, one potrace layer per colour).
- **Rationale**: One tracer, one palette. The badge prompts ask for the same flat
  style and colours as the illustrations; the thinner outlines (about 32 px, 20
  px for background) and smallest details (about 24 px) are above the filter's
  5 px and potrace's 48 px² speck limit.
- **Alternatives**: A copy of the tracer for badges: two places to fix. Changing
  #101 now: another session is working on that branch.

## R6 Generation: Playwright on the maintainer's Chrome

- **Decision**: `scripts/badge-art.mjs` (exists) drives Google Chrome with its
  own profile outside the repo (or an already running Chrome over CDP): a fresh
  Gemini chat per badge, reference attached, prompt pasted, image downloaded at
  full size. Resumable, skips existing originals, stops on a usage limit,
  screenshots failures. Selectors in one `SELECTORS` table, English and German.
- **Rationale**: The project owner wants the proven manual flow (web Gemini,
  prompt plus reference) without the copy and paste. Playwright is already a dev
  dependency.
- **Alternatives**: The Gemini API with an API key: more robust and testable, but
  a different account setup and billing than the owner uses; can replace the
  browser step later without touching anything after it (originals in the same
  folder).

## R7 Originals stored palette-snapped

- **Decision**: After download, `pnpm badge-build` snaps each original to the
  coin palette (the tracer's first step) and stores it as an indexed PNG of at
  most 2048 px in `art/badges/originals/<id>.png`; the raw download is kept only
  locally.
- **Rationale**: Raw Gemini PNGs are around 1 to 3 MB each; 69 of them would add
  well over 100 MB to a public repo, and again with every retake. A
  palette-snapped image has 7 colours and compresses to roughly 50 to 150 KB,
  and re-tracing it gives the same SVG, since snapping is idempotent.
- **Alternatives**: Committing raw originals as #101 does for three images:
  fine for three, not for 69. Not committing originals at all: retuning the
  tracer would need new Gemini images.

## R8 The picture list for the app

- **Decision**: `pnpm badge-build` writes `src/badges/pictures.ts` with the ids
  of every badge that has a finished SVG (`BADGE_PICTURES: ReadonlySet<string>`).
  The app shows `/badges/<id>.svg` for those and the placeholder of the badge's
  group otherwise.
- **Rationale**: The Worker can't cheaply check whether a static asset exists;
  a generated list is checked by `tsc` and costs nothing at runtime. It makes
  FR-040a hold by construction: adding a picture changes only this list.
- **Alternatives**: Requesting the file and falling back on 404 in the browser:
  a failed request per missing picture and a visible flash.

## R9 Badge ids: `badges.json` now, the app catalog later

- **Decision**: `art/badges/badges.json` holds the ids, groups, categories and
  thresholds of the spec's ladders for the pipeline. When the app's badge
  catalog is built (the other part of this feature), a test asserts both list
  the same ids, groups and thresholds.
- **Rationale**: The art can be made before the evaluation exists, and a
  mismatch is caught the moment both exist.
- **Alternatives**: The app catalog importing `badges.json`: it would mix scene
  prose into the app bundle.
