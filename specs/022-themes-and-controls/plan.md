# Implementation Plan: One Set of Controls, Themes in the Header and Fun Page Switches

**Branch**: `022-themes-and-controls` | **Date**: 2026-10-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/022-themes-and-controls/spec.md`

**Mock-up (binding)**: Claude Design "RynkePoints Themes",
https://claude.ai/artifact/8yciDe8Hycvc4Lo9v8gJBN — all six boards were read
with the Artifact tool on 2026-10-22, and their values are written into the
contracts below. Implementation matches the canvas, not just the contracts'
markup; every task that changes the look names its board.

| Board | Contract |
|-------|----------|
| Kopfzeile + Farbschema-Menü (klickbar) | [theme-menu.md](contracts/theme-menu.md) |
| Konfetti (hell) und Disco (dunkel) | [fun-decorations.md](contracts/fun-decorations.md) |
| Ein Satz Bedienelemente | [controls.md](contracts/controls.md) |
| Alle zwölf Themes | [themes.md](contracts/themes.md) |
| Seitenwechsel: Konfetti und Disco (klickbar) | [page-switch-show.md](contracts/page-switch-show.md) |
| Rynke in den Seitenwechseln (Entwurf) | [show-pictures.md](contracts/show-pictures.md) |

## Summary

Three phases, each shippable on its own:

- **Phase 1 – one set of controls (US1)**: two new tokens
  (`--rp-type-control`, `--rp-outline-width`) and `--rp-primary-text`; every
  control rule in `src/http/style.ts` follows the canvas set; the audit's
  deviations (black/beige "selected" on the Team and Badges filters, 40 px
  2 px yes/no buttons, three summary sizes, three chip heights) are fixed. No
  colour value changes (R5).
- **Phase 2 – theme menu and twelve themes (US2, US3)**: a theme list in
  `src/http/themes.ts` drives the stylesheet (`:root[data-theme=<id>]`
  overrides on top of today's light/dark, R1, R4), the head script (`rp-theme`
  with the `rp-scheme` carry-over, `data-theme` + `data-scheme`, theme-color,
  R2, R3), and the server-rendered menu behind a palette button next to the
  refresh link (radio group in a dialog panel, R6). Settings loses its scheme
  choice. Konfetti and Disco get their decorations as CSS (fun-decorations.md).
  Rynke Tag and Rynke Nacht take the canvas's gauge track and fill (owner's
  choice, research R4).
- **Phase 3 – page-switch shows (US4)**: tabs are full page loads, so each
  show plays in two halves: the leaving page plays 0–1.6 s and navigates at
  the peak; a sessionStorage flag lets the arriving page's head script paint a
  peak cover from the first paint, and `app.js` plays 1.6–3.2 s from there
  (R7, R8). Rynke rides the unicorn / dances in Disco once the two generated
  pictures exist: a third art set `art/shows/` in `pnpm badge-art` /
  `pnpm badge-build`, with the rainbow allowed in the unicorn's palette (R11).

No migration, no new dependency, no server state, no Strava request.

## Technical Context

**Language/Version**: TypeScript (`tsc --noEmit`) on Cloudflare Workers;
browser JavaScript in `public/app.js` (plain ES, no build); Node 24 ES modules
for the art scripts.

**Primary Dependencies**: none new. The art pipeline keeps its existing
Playwright/Gemini flow and tracer.

**Storage**: none on the server. Browser: localStorage `rp-theme` (device
choice), sessionStorage `rp-show` (show hand-over).

**Testing**: Vitest in the Workers runtime (tokens, contrast per theme, style
rules, head script, shell/menu markup, settings, catalogs); Playwright e2e
(`e2e/themes.e2e.ts`) for the menu, persistence, carry-over and when shows
play or are skipped. The look is checked by the owner against the canvas on
the live site.

**Target Platform**: the app in current Chromium, Firefox and WebKit (phones
first), installed PWA included.

**Project Type**: web service (server-rendered pages + one client script).

**Performance Goals**: no flash of another theme on any load (SC-004); the
show ≤ 3.5 s and skippable at once (SC-005); 220 transform-only pieces
without visible stutter on the owner's phones (R12).

**Constraints**: tokens only, no literal colours in control rules (FR-006);
contrast 4.5 : 1 / 3 : 1, 7 : 1 in the contrast themes (FR-018); reduced
motion respected everywhere (FR-033, FR-045); the show never on reload,
current tab, back/forward or non-fun themes (FR-044).

**Scale/Scope**: 12 themes, ~20 roles each, 1 menu, ~9 control types across
8 pages, 2 shows, 2 pictures.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|-----------|-------|--------|
| I. Privacy and consent | The theme choice is a device setting in localStorage, never sent to the server, not rider data (FR-014). No new data shown to anyone. | Pass |
| I. Secrets never committed | Nothing secret involved. | Pass |
| II. Strava citizenship | No Strava request. The Strava attribution keeps its light/dark variant per base scheme (FR-020). | Pass |
| III. Rider content wins | Nothing written to Strava or rider data. | Pass |
| IV. Serverless, minimal deps, free tier | No dependency; pure CSS and the existing client script; no extra requests (themes in the one stylesheet). | Pass |
| V. Test-first | Tasks start with failing tests: contrast per theme, control rules, head script, menu markup, settings, then e2e for the menu and the shows. | Pass |
| Browser rule (JS required) | Theme menu and shows rely on `app.js`; the head script sets the theme before paint. No no-script fallback needed. | Pass |
| Language | All menu text in de/en catalogs (contracts/messages.md); code and ids English; theme names German in de. | Pass |

Re-checked after Phase 1 design: still passes; no entry in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/022-themes-and-controls/
├── plan.md              # This file
├── research.md          # R1–R12
├── data-model.md        # Theme, choice, show hand-over, show pictures
├── quickstart.md        # Automated and by-hand checks
├── contracts/
│   ├── themes.md             # 12 themes, canvas roles → tokens, all values
│   ├── controls.md           # the one set of controls, audit fixes
│   ├── theme-menu.md         # palette button, menu, head script, behaviour
│   ├── fun-decorations.md    # Konfetti and Disco decorations, the rainbow
│   ├── page-switch-show.md   # both shows, timings, two-half hand-over
│   ├── show-pictures.md      # art/shows set, prompt, build, use
│   └── messages.md           # new and removed message ids
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/http/
├── themes.ts             # NEW: the twelve themes (ids, group, scheme, fun, tokens, preview)
├── style.ts              # Phase 1 control rules + tokens; Phase 2 theme overrides,
│                         # menu, decorations; Phase 3 show and peak-cover rules
├── html.ts               # THEME_SCRIPT replaces SCHEME_SCRIPT (theme, carry-over, show flag)
├── shell.ts              # palette button before the refresh link; the menu panel
├── icons.ts              # palette icon
├── sections/settings.ts  # Appearance group removed
├── sections/*.ts, organiser/*.ts   # markup tweaks where a control changes type (audit)
├── show-pictures.ts      # NEW, generated by badge-build
└── art-versions.ts       # + /shows/*.svg hashes (generated)
src/i18n/messages/        # de.ts, en.ts: theme.* added, settings.scheme.* removed

public/
├── app.js                # schemePicker() removed; themeMenu(); showOnSwitch();
│                         # charts observe data-theme
└── shows/                # unicorn.svg, disco.svg (generated)

art/shows/                # NEW: README.md, shows.json, prompt.txt, originals/
scripts/
├── badge-art.mjs         # third set art/shows
├── badge-build.mjs       # builds the shows set after the quote monkeys
├── quote-monkeys.mjs     # generalised to build a given set with its palette
└── quote-prompts.mjs     # validateShows

test/unit/                # design-tokens, style, html, themes tests
test/integration/         # shell header/menu, settings, catalogs
e2e/themes.e2e.ts         # NEW
```

**Structure Decision**: The existing single Worker project; themes are code in
`src/http/themes.ts`, rendered into the one stylesheet and the head script; the
client behaviour stays in `public/app.js`.

## Complexity Tracking

No constitution violations.
