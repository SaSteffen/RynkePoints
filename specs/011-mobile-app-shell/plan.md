# Implementation Plan: Mobile App Shell with Sections and a Material Look

**Branch**: `011-mobile-app-shell` | **Date**: 2026-10-08 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/011-mobile-app-shell/spec.md`

## Summary

The single `/me` page becomes four server-rendered sections, Overview, Rides,
Team and Settings, each with its own URL and a shared shell. The whole site gets
a Material 3 look from design tokens. The look follows the Claude Design mock-up
the maintainer approved ([research.md](research.md) intro).

- **Sections (US1)**:
  - One helper, `shellPage()`, does the visitor and consent-gate handling for all
    four sections (R1).
  - `/me?page=N` answers `301` to `/me/rides?page=N` (R2).
  - After agreeing at the gate, the rider returns to the section they asked for.
    That works for the direct form and through Strava; the Strava path carries it
    in the signed OAuth state cookie (R9).
- **Navigation**:
  - One `<nav class="app-nav">` with four icon-and-label links and
    `aria-current="page"`.
  - Below 600 px it is a bottom bar clear of the home indicator
    (`viewport-fit=cover` plus safe-area insets). From 600 px it sits in the top
    bar as pill tabs (R3).
  - Every section has a refresh link. Tapping the current tab reloads it, and
    `app.js` reloads a section after more than a minute in the background (R8).
- **Phones (US2, issue #20)**:
  - The ride table becomes cards on every width.
  - The reasons are in a native `<details>`, which the server opens for rides
    that don't count (R7).
  - Every control is at least 44 px, and long words wrap.
- **Look (US3)**:
  - Tokens for colour, type, spacing, shape and motion are defined once in
    `src/http/style.ts` and inlined as today (R4).
  - The tonal palette comes from Strava orange, light and dark, with feature
    005's gauge colours kept in light and lightened in dark (R5).
  - The scheme follows the system, or a per-device choice in `localStorage`. A
    small inline head script applies it before paint (R6).
  - "Powered by Strava" has both variants (R13).
- **Settings (US4)**:
  - The seven groups in FR-014 order (R10).
  - The language switcher appears only here for signed-in riders.
  - The notifications buttons become one Material switch with 010's states
    unchanged (R11).
- **Team (US5)**: a placeholder that reads no rider data.

There is no D1 migration, Strava request change or new consent version
([data-model.md](data-model.md)).

## Technical Context

**Language/Version**: TypeScript 7 (`tsc --noEmit`) on Cloudflare Workers, as in
features 001–010. `public/app.js` stays plain unbundled JavaScript.

**Primary Dependencies**: none new. The look is hand-written CSS following
Material 3 guidelines. There is no component library, font or icon font (R4,
Principle IV, FR-037).

**Storage**: D1 unchanged. The device's `localStorage` gets `rp-scheme` (R6).

**Testing**: Vitest in workerd (`pnpm test`) with synthetic riders. The layout is
tested through its markup and style contracts. Contrast is computed from the
tokens (R15). The tests per requirement are in [quickstart.md](quickstart.md) §1.

**Target Platform**: Cloudflare Workers. On the client, the last two major
versions of Safari on iOS, Chrome on Android, and desktop Chrome, Firefox, Safari
and Edge (FR-005). Portrait phones from 360 px wide.

**Project Type**: web service with server-rendered pages.

**Performance Goals**: a section opens no slower than `/me` did (SC-007). Each
section reads less than the old page; the inline style grows by about 2.5 KB
gzipped (R4).

**Constraints**:

- no third-party requests (FR-037);
- no client framework;
- all text from the catalogs (FR-040);
- WCAG contrast of 4.5 : 1 and 3 : 1 in both schemes (FR-033);
- a 44 px tap target for every control (FR-022).

**Scale/Scope**:

- 4 sections, about 8 public page types, 2 languages, 2 schemes;
- about 20 new catalog keys;
- one rewritten stylesheet;
- `me.ts` split into 4 section modules.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. Privacy and consent | Shows only what 004/005/010 already show, to the same rider. No new Strava scope or request, nothing newly shown to others, so no new consent version. Team placeholder reads no other rider (FR-013). The scheme choice stays on the device (FR-032a). Strava brand assets unmodified, both attribution variants (R13). | ✅ |
| II. Strava API citizenship | No Strava call added or moved. A refresh is one page load reading D1 only. | ✅ |
| III. Rider-authored content | Not touched. | ✅ |
| IV. Serverless, minimal deps | No new dependency. Material is followed as guidelines in hand-written CSS (R4). The alternatives that add a dependency were rejected. | ✅ |
| V. Test-first | Every FR has a test in [quickstart.md](quickstart.md) §1, written red first. Device checks happen after release on the live site. | ✅ |
| Repo rules | Text only in catalogs; `src/` doesn't import `dev/`; no secrets or real rider data in fixtures. | ✅ |

**Post-design re-check**: still passes. The OAuth state cookie change (R9) only
adds an allow-listed path inside the existing signed value, and it reads the old
format, so a sign-in in flight during a deploy keeps working.

## Project Structure

### Documentation (this feature)

```text
specs/011-mobile-app-shell/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── http-routes.md
│   ├── pages.md
│   ├── design-tokens.md
│   └── client.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/http/
├── router.ts            # + /me/rides, /team, /me/settings; /me?page → 301
├── shell.ts             # new: SECTIONS, shellPage() (visitor, gate, layout with nav)
├── sections/            # new: overview.ts, rides.ts, team.ts, settings.ts
├── me.ts                # keeps disconnect and logout; handleMe moves to sections/
├── html.ts              # layout(): public vs shell header, nav, scheme script, footer variants
├── style.ts             # new: design tokens + all CSS (was STYLE in html.ts)
├── icons.ts             # new: inline SVG icons
├── rider-sections.ts    # ride cards replace the table rows; pager → /me/rides
├── pwa.ts               # notifications switch markup
├── consent-gate.ts      # `next` in both forms; handleConsent redirects to it
├── consent-form.ts      # optional `next`
├── auth.ts, session.ts  # `next` through the OAuth state cookie
├── lang.ts              # safeNext() allows the new paths
└── landing.ts, notice.ts, errors.ts   # public layout look only
src/i18n/messages/{de,en}.ts           # new keys (contracts/pages.md)
public/app.js            # scheme picker, refresh on return, switch
public/manifest.webmanifest            # colours
public/strava/README.md  # + the white "Powered by Strava" logo and Connect button
test/unit/, test/integration/          # per quickstart.md §1
```

**Structure Decision**: the existing single Worker project. The section handlers
get their own folder because `me.ts` would otherwise hold four pages. Shared
rendering stays in `rider-sections.ts`.

## Complexity Tracking

No violations to justify.
