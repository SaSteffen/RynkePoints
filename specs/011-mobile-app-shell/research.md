# Research: Mobile App Shell with Sections and a Material Look

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-10-08

The look comes from the Claude Design mock-up agreed with the maintainer
("RynkePoints App Shell", https://claude.ai/artifact/8G74koSH1DJZUBPzdRH3Xx,
private to the maintainer). It shows the four sections and the landing page on a
360 px phone in light and dark, the navigation bar on its own, and the Overview
on a 1280 px desktop. The spec stays authoritative where they differ. The mock-up's
ride names and reason texts are made up; pages use the catalogs' texts.
[contracts/design-tokens.md](contracts/design-tokens.md) records its values.

## R1. Sections as separate server-rendered routes

**Decision**: four `GET` routes, each a full page from the Worker: `/me`
(Overview), `/me/rides` (Rides), `/team` (Team), `/me/settings` (Settings). They
share one helper, `shellPage()` in `src/http/shell.ts`. It reads the viewer, sends
visitors to `/` and shows the consent gate when the rider hasn't agreed. Otherwise
it wraps the section's body in the shell layout (R3). The old `handleMe` body is
split into `overview.ts`, `rides.ts`, `team.ts` and `settings.ts` under
`src/http/sections/`. The `render*` helpers in `rider-sections.ts` stay where they
are.

**Rationale**: FR-003 asks for ordinary navigation. The router is already a path
switch (001 research R13), and each section only needs the reads it shows:
Overview and Rides both call `readRiderView`, but Team and Settings don't touch
the rides.

**Alternatives considered**: one page with `:target` or JS tabs. That breaks
back/forward and deep links and still renders everything (rejected by FR-003). A
client router: not allowed by the "no heavy framework" decision and Principle IV.

## R2. Old addresses and the language switch

**Decision**:

- `GET /me?page=N` (any `page` parameter) answers `301` to
  `/me/rides?page=N`. The value is passed on as given, and Rides handles a bad one
  as feature 005 does. `/me` without `page` is the Overview.
- The pager links become `/me/rides?page=N`. The `#rides` fragment is dropped,
  because the list now starts at the top.
- `safeNext()` in `lang.ts` accepts `/me/rides`, `/me/rides?page=N`, `/me/settings`
  and `/team`, and still accepts `/me?page=N`, which then redirects.
- The disconnect page's "Cancel" links to `/me/settings` (FR-015).

**Rationale**: FR-006 and FR-016. A `301` makes saved links work again without
two copies of the page.

## R3. Shell layout and navigation bar

**Decision**: `layout()` in `html.ts` gets an optional `nav` option, the current
section's id. With it, the page renders:

- a top app bar: the "Rynke**Points**" wordmark, and on wide screens the four
  tabs inline, plus a refresh link (R8);
- `<nav class="app-nav" aria-label="…">` holding four links in the fixed order
  Overview, Rides, Team, Settings. Each link has an inline SVG icon and a text
  label, and the current one has `aria-current="page"` (FR-002);
- no language form in the header (FR-016).

Without `nav`, which covers every public page, the consent gate and the offline
page, the header keeps the language form and there is no navigation (FR-007,
FR-016).

One `<nav>` element is styled two ways:

- **Below 600 px (Material's compact window class)**: a bottom bar fixed to the
  viewport, 80 px high plus `env(safe-area-inset-bottom)`. Each entry is a column
  with a 64 × 32 px "active indicator" pill around the icon and a 12 px label. The
  `<main>` gets matching bottom padding so the last card isn't hidden (FR-004,
  US2-AS5).
- **600 px and wider**: the same links sit in the top bar as 44 px pill tabs, as in
  the desktop mock-up.

**Rationale**: one set of markup, so tests check it once and links never disagree.
600 px is Material 3's compact/medium boundary (spec Assumptions). A navigation
rail for the medium class was left out: the content column is at most 1040 px, so
a top bar fits.

**Safe area**: `env(safe-area-inset-bottom)` is 0 on iOS unless the viewport opts
in. The viewport meta becomes `width=device-width, initial-scale=1,
viewport-fit=cover`. Feature 010's `pwa-pages.test.ts` currently asserts its
absence and changes with this feature. With `cover`, the top bar also pads
`env(safe-area-inset-top)` so the installed app's status bar never covers it.

**Icons**: four 24 px stroke icons from the mock-up (gauge, bike, people, sliders)
plus refresh. They are inline `<svg aria-hidden="true">` in `src/http/icons.ts`,
about 1.5 KB in all. Nothing is loaded from a third party (FR-037), and there is
no icon font.

## R4. Design tokens as CSS custom properties

**Decision**: the one `STYLE` string in `html.ts` moves to `src/http/style.ts` and
is rewritten around custom properties on `:root`:

- colour roles (`--md-sys-color-*`, Material's own role names);
- the gauge part colours (`--rp-part-1…6`, `--rp-reached`, `--rp-track`);
- type scale (`--md-type-*`);
- spacing (`--rp-space-1…6`, 4 px steps);
- shapes (`--md-shape-*`).

The values are in [contracts/design-tokens.md](contracts/design-tokens.md). Every
other rule uses only `var(--…)`, so changing a token changes every page (FR-031).
It is still inlined in each page's `<style>`, as today.

**Rationale**: inlining costs no extra request and no caching question. The style
grows from about 2.7 KB to about 9 KB uncompressed, roughly 2.5 KB with gzip,
which is well within SC-007 next to the pages that no longer render everything.

**Alternatives considered**:

- A static `/style.css` asset: one more request on a cold phone and a cache
  question on every deploy. That may be worth it later, but not now.
- Material Web components (`@material/web`): a runtime UI dependency (Principle
  IV) plus custom elements that need JS to render.
- A CSS framework: same objection.

## R5. Colour scheme from Strava orange, light and dark

**Decision**: a Material 3 tonal palette seeded from `#fc5200` (the mock-up's
values, [contracts/design-tokens.md](contracts/design-tokens.md)).

- **Primary**: light `#a63b00`, dark `#ffb59b`. Plain `#fc5200` has too little
  contrast as text on the light surface (about 3.0 : 1, FR-033).
- **`#fc5200` itself** stays on the gauge's distance part and is the colour of
  Strava's own "Connect with Strava" button image.
- **Gauge parts** keep feature 005's colours in light mode. Dark mode uses lighter
  tints of the same hues (`#ff8f63`, `#8cc4f0`, `#6fd1c2`, `#d7a6ec`, and for
  parts 5 and 6 `#e6c65a`, `#a8a8a8`). The track is `#f0dfd9` in light and
  `#3d322e` in dark. "Reached" is `#2e7d32` in light and `#81c784` in dark
  (FR-035).

The ride status chips are:

| Chip | Light | Dark |
|---|---|---|
| "Counts" | `#c8f0c4` on `#0b3912` | `#1e4d22` on `#b9f0b8` |
| "Doesn't count" | error container | error container |
| "Being evaluated" | surface variant | surface variant |

**Rationale**: these are the mock-up the maintainer approved. Material's
generator uses the same tones, with primary at tone 40 in light and tone 80 in
dark.

**Contrast check**: `test/unit/design-tokens.test.ts` parses `style.ts` and
computes WCAG contrast for the pairs the pages use:

- each `on-*` colour on its container, at least 4.5 : 1;
- the outline on the surface, at least 3 : 1.

It checks both schemes, so SC-006 is a test and not a manual check.

## R6. Scheme choice without a flash (FR-032a)

**Decision**:

- **Storage**: the choice lives in `localStorage["rp-scheme"]` (`light`, `dark`,
  or absent for System). It is never sent to the server, and signing out doesn't
  touch it.
- **Applying it before paint**: a tiny inline script in `<head>` before `<style>`
  reads the key and sets `document.documentElement.dataset.scheme`. It is about
  200 bytes and has no text. It also updates `<meta name="theme-color">` to the
  surface colour of the scheme in use.
- **CSS**: light tokens on `:root`, dark tokens under
  `@media (prefers-color-scheme: dark) { :root:not([data-scheme=light]) { … } }`
  and again under `:root[data-scheme=dark]`. `color-scheme` is set the same way,
  so form controls and scrollbars follow.
- **Settings control**: three radio inputs (`name="scheme"`) styled as a Material
  segmented button. `app.js` checks the stored one and saves it on `change`. Its
  hint says it applies to this device only.

**Rationale**: a cookie would reach the server and make the choice look like rider
data, which FR-032a rules out. An inline head script is the only way to set the
scheme before first paint. The site has no Content-Security-Policy today. If one
is added later, it must allow this script by hash.

**Alternatives considered**: `<meta name="color-scheme">` alone covers System
only.

## R7. Ride cards with native disclosure

**Decision**: Rides renders an `<ol class="ride-list">` of cards on every width.
The table is dropped; FR-021 allows a table on wide screens, and this choice
doesn't use it.

The card's first part always shows the date, the status chip, the distance, the
Training Rynke and the metres. The ride name, sport type, elevation gain,
"virtual" and "View on Strava" sit below it, always in view.

The reasons, unknown figures and fix hint sit in a `<details class="ride-why">`.
The server renders `open` for "doesn't count" rides and leaves it closed for the
other two states (clarification Q5). Its `<summary>` takes its label from the
catalogs, is at least 44 px high and turns its chevron with
`details[open] > summary`. On wide screens the list is a two-column grid.

**Rationale**:

- `<details>` needs no JS, is keyboard and screen-reader accessible, and its open
  state comes from the server.
- One layout for all widths means one set of markup and tests.
- A table with 5 columns plus details is what doesn't fit 360 px today (issue
  #20).

**Contract change**: feature 005's `tr.ride`/`tr.ride-details` markup in
`contracts/rider-page.md` is replaced by
[contracts/pages.md](contracts/pages.md)'s card markup. The class names for the
status (`ride-counting`, `ride-not-counting`, `ride-pending`) stay, so tests
checking them keep working.

## R8. Refresh and returning to the app (FR-009)

**Decision**:

- **Refresh control**: a link (`<a class="icon-button" href="{current path}">`)
  with an `aria-label` from the catalogs. Following it is a fresh `GET`, and it
  keeps the rides page in `?page=N`.
- **Tapping the current tab**: the tab is an ordinary link to the current path, so
  tapping it reloads. No code is needed.
- **Coming back after a minute**: `app.js` remembers `Date.now()` on
  `visibilitychange` to hidden. On visible, if more than 60 s passed and the page
  is a section (`<nav class="app-nav">` present), it calls `location.reload()`.

Pull-to-refresh is not built: browsers already do it in a tab, and an installed
iOS app doesn't.

**Rationale**: no client-side data fetching, so a reload is the whole refresh.

## R9. Consent gate on every section, and returning to the section

**Decision**:

- `shellPage()` renders the existing `consentGate()` in place on whichever
  section URL was asked for (FR-007).
- The gate's direct form (`POST /me/consent`) gets a hidden `next` input set to
  that path. `handleConsent` redirects to `safeNext(next)` from `lang.ts`, so the
  same allow-list applies.
- The Strava form (`POST /connect`) also carries `next`. The OAuth state cookie,
  today `<state>:<consentVersion>`, becomes `<state>:<consentVersion>:<next>`, and
  the callback redirects there. A cookie in the old format still reads, with
  `next` = `/me`, so a sign-in in flight during the deploy still works.
- The landing page's form sends no `next`, which means `/me`.

**Rationale**: US1-AS7 asks to "reach the section asked for after agreeing". The
`next` value is allow-listed (R2) and signed inside the OAuth cookie, so it can't
become an open redirect.

## R10. Settings page composition

**Decision**: groups in the order of FR-014. Each is a `<section>` with an
`<h2>`:

1. **Language**: the `/lang` form with `next=/me/settings`, as a segmented button
   of `languageName`s.
2. **Appearance**: the scheme radios (R6).
3. **Notifications**: feature 010's `renderNotifications()`, restyled as a card
   with a Material switch (R11).
4. **App**: `renderInstallHint()`. It is still hidden until `app.js` shows it, and
   the whole group is hidden with it.
5. **Strava connection**: status, the two scope lines, "Change permissions", and
   "Reconnect" when `needs_reconnect`.
6. **Consent**: today's `consent()` block plus a link to the consent text on `/`.
7. **Account**: sign out as an outlined button, and "Disconnect and delete my
   data" as a text link in the error colour that leads to `/me/disconnect`.

The install hint also stays on `/` and on the Overview as today's dismissible
notice, below the totals (FR-017).

## R11. Notifications control as a switch

**Decision**: feature 010's two buttons (`data-action="on"` / `"off"`) become one
`<button type="button" role="switch" data-action="toggle" aria-checked="false">`.
Its label comes from the catalogs (`notifications.switch`, new). `show(state,
action)` in `app.js` becomes `show(state, checked)`:

- it sets `aria-checked`;
- it hides the switch in the states that have no action: blocked,
  needs-home-screen, unsupported.

Clicking the switch runs the old "on" or "off" handler depending on
`aria-checked`. The state paragraphs stay as they are, and so do the
`POST /me/notifications` contract and the sign-out endpoint handling.

**Rationale**: the mock-up uses a Material switch, and a switch with one
accessible name reads better than two alternating buttons. The behaviour and every
010 state stay. Only the markup contract in 010's `contracts/client.md` changes,
and [contracts/client.md](contracts/client.md) restates it.

## R12. Installed app colours (FR-039)

**Decision**:

- `<meta name="theme-color">` appears twice, with
  `media="(prefers-color-scheme: light)"` → `#fff8f6` and `dark` → `#1a110e`. The
  head script (R6) replaces both with one when a fixed scheme is picked.
- `manifest.webmanifest` gets `theme_color` `#fff8f6` and `background_color`
  `#fff8f6`, since a static manifest can't follow the scheme. Browsers use the
  meta tag once a page has loaded, so only the splash screen stays light.

`test/unit/manifest.test.ts` changes to the new colours.

## R13. Powered by Strava in both schemes (FR-034)

**Decision**: add a catalog key `brand.poweredByStrava.srcDark` for Strava's
white "Powered by Strava" logo. It points at
`/strava/en/powered-by-strava-white.svg`, which the maintainer adds from the same
zip as the existing logo; `public/strava/README.md` is updated to say so.

The footer renders both images, `class="pbs pbs-light"` and `pbs pbs-dark`, and
the scheme CSS hides one. `<picture>` isn't used, because a `media` source
follows only the system setting and not a fixed choice.

The "Connect with Strava" button image is Strava's orange button and works on
both surfaces. "View on Strava" links keep 008's bold underlined style in the
primary colour.

## R14. Tabular figures, reduced motion, and long words

**Decision**:

- `font-variant-numeric: tabular-nums` on `body`, so every figure lines up
  (FR-036).
- Transitions are limited to the nav pill, the switch thumb and the details
  chevron, 150–200 ms. All are disabled under
  `@media (prefers-reduced-motion: reduce)` (FR-038).
- `main { overflow-wrap: anywhere }` and `min-width: 0` on grid and flex children
  cover FR-023.
- The system font stack stands in for Roboto (spec Assumptions, FR-037).

## R15. Testing the layout without a browser

**Decision**: the tests can't measure pixels in workerd, so they check the
contracts that produce the layout:

- the viewport meta;
- that no page has a fixed `width` above 360 px;
- the nav markup and `aria-current`;
- the 44 px `min-height`/`min-width` declared for each control class in
  `style.ts`, checked against a list of classes;
- the `open` attribute on the right ride cards;
- the token contrast.

Real-device checks (SC-001, SC-003, SC-007) are done by the maintainer on the live
site after the release, so tasks won't include them.
