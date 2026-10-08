---
description: "Task list for the mobile app shell with sections and a Material look"
---

# Tasks: Mobile App Shell with Sections and a Material Look

**Input**: Design documents from `/specs/011-mobile-app-shell/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: REQUIRED (constitution Principle V). Write each test task first, run it
and confirm it fails, then implement. Riders are synthetic and nothing contacts
Strava. Layout is tested through markup and style contracts, not pixels
(research R15). `public/app.js` has no unit tests; its markup hooks are tested on
the server. Device checks happen on the live site after release, so there are no
tasks for them ([quickstart.md](quickstart.md) §3).

**Organization**: one phase per user story, in the spec's priority order. All
stories ship in one release (spec Assumptions); the phases give the build order.
US1 creates all four routes with today's markup moved into them. US2 turns the
ride table into cards and makes every page fit a phone. US3 adds the tokens, dark
mode and the public look. US4 builds the Settings groups. US5 pins down the Team
placeholder.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 (sections), US2 (phones), US3 (Material look, light and dark),
  US4 (Settings), US5 (Team placeholder)

## Phase 1: Setup

- [X] T001 Run `pnpm install`, then `pnpm lint`, `pnpm typecheck` and `pnpm test`.
  All pass before any change, so later failures are this feature's.

---

## Phase 2: Foundational (blocks every story)

**Purpose**: the catalog keys, icons, the style module and the `next` allow-list
every section and form uses.

- [X] T002 [P] Tests first (failing), `test/unit/catalogs.test.ts`: every key in
  the "New catalog keys" table of [contracts/pages.md](contracts/pages.md),
  including `brand.connectWithStrava.srcDark`, exists in both `de` and `en`.
  `brand.*.srcDark` values are the same in both catalogs (Strava ships English
  assets only).
- [X] T003 [P] Tests first (failing), `test/integration/lang-switcher.test.ts`:
  `safeNext()` (via `POST /lang`) accepts `/me/rides`, `/me/rides?page=1` and
  `?page=9999`, `/me/settings` and `/team`; still accepts `/me?page=N`; rejects
  `/me/rides?page=0`, `/me/rides?page=10000`, `/me/rides?page=x`,
  `/me/settings/x` and `//team` → `/` (contracts/http-routes.md `POST /lang`).
- [X] T004 Add the new keys to `src/i18n/messages/en.ts` and
  `src/i18n/messages/de.ts` (en texts from [contracts/pages.md](contracts/pages.md);
  German written now, reviewed in the PR). Keep the obsolete keys until the
  stories that stop using them (T034, T053).
- [X] T005 [P] Extend `NEXT_PATHS` and the page regex in `safeNext()` in
  `src/http/lang.ts` so T003 passes: `/me/rides`, `/me/settings`, `/team`, and
  `/me/rides?page=N` with the same `[1-9][0-9]{0,3}` rule as `/me?page=N`. None
  of them may contain `:` (data-model.md "OAuth state cookie").
- [X] T006 [P] Create `src/http/icons.ts`: five inline 24 px stroke SVGs as
  `SafeHtml` constants (`GAUGE`, `BIKE`, `PEOPLE`, `SLIDERS`, `REFRESH`), each
  `aria-hidden="true" focusable="false"`, using `currentColor`, shapes from the
  mock-up (research R3). No text inside.
- [X] T007 [P] Move the `STYLE` string unchanged from `src/http/html.ts` into a
  new `src/http/style.ts` (`export const STYLE`), and import it in `html.ts`.
  `pnpm test` still passes.

**Checkpoint**: keys, icons and allow-list ready; pages unchanged.

---

## Phase 3: User Story 1 - Rider switches between sections (Priority: P1) 🎯 MVP

**Goal**: `/me`, `/me/rides`, `/team` and `/me/settings` are separate pages with
one navigation bar, the consent gate on each, and the rider returned to the
section they asked for after agreeing.

**Independent Test**: as a synthetic rider, `/me` shows only the Overview, each
nav link opens its section with `aria-current="page"` on it, `/me?page=2` lands on
`/me/rides?page=2`, and a rider without consent gets the gate and comes back to
the same section.

### Tests for User Story 1

- [X] T008 [P] [US1] New `test/integration/sections.test.ts` (FR-001–FR-003,
  FR-007, FR-016, US1-AS1/2/6/7/8): for each of `/me`, `/me/rides`, `/team`,
  `/me/settings`:
  - no session, or a deleted rider → `302 /`;
  - rider without the current consent → `200`, the gate, no `nav.app-nav`, and
    both gate forms carry `<input type="hidden" name="next">` with that path (for
    `/me/rides?page=2` the full path with query);
  - agreed rider → `200`, `body.shell`, exactly one `nav.app-nav` with
    `aria-label` from `nav.label`, four links `/me`, `/me/rides`, `/team`,
    `/me/settings` in that order with icon and label, exactly one
    `aria-current="page"` on the right link (on Rides also for
    `/me/rides?page=2`), the refresh link `a.icon-button.refresh` with
    `href` = the requested path and `aria-label` from `shell.refresh`, the nav
    after the footer, and no `form[action="/lang"]` outside Settings;
  - `HEAD` behaves like `GET`, and a 10-day-old session cookie is renewed on each
    (as `test/integration/session-renewal.test.ts` does for `/me`).
- [X] T009 [P] [US1] New `test/integration/overview.test.ts` (FR-010, US1-AS1):
  `main` children in order reconnect notice (only for a `needs_reconnect` rider)
  → 005 notices → `p.greeting` → verdict → gauges → breakdown → rules with the
  handout link; no `ol.ride-list`, no `table.rides`, no `#notifications`, no
  consent text, no `/me/disconnect` link, no logout form.
- [X] T010 [P] [US1] New `test/integration/rides-redirect.test.ts` (FR-006):
  `/me?page=3` → `301 Location: /me/rides?page=3`; `/me?page=x` →
  `301 /me/rides?page=x`; without a session still `301` (no D1 read); `/me`
  without `page` is the Overview.
- [X] T011 [P] [US1] Update `test/integration/me-rynke.test.ts`,
  `test/integration/me-activities.test.ts` and
  `test/unit/rider-sections.test.ts` so everything about the ride list and the
  pager requests `/me/rides` (and `/me/rides?page=N`); pager links are
  `/me/rides?page=N` without `#rides` (research R2). Gauge, summary, breakdown
  and rules assertions stay on `/me`.
- [X] T012 [P] [US1] Update `test/integration/me-status.test.ts`: connection
  status, scopes, consent record, reconnect, disconnect link and sign-out are
  asserted on `/me/settings`, and asserted absent from `/me`.
- [X] T013 [P] [US1] Update `test/integration/consent-gate.test.ts` (R9):
  `POST /me/consent` with `next=/me/settings` → `303 /me/settings`; with
  `next=/me/rides?page=2` → there; with `next=https://evil.example/` or missing →
  `303 /me`.
- [X] T014 [P] [US1] Update `test/integration/connect.test.ts`,
  `test/integration/callback.test.ts` and `test/unit/session.test.ts` (R9,
  data-model.md): `POST /connect` with `next=/team` stores
  `<state>:<consentVersion>:/team` in the signed state cookie; a bad `next`
  stores `/me`; the callback's success answers `302 /team`; an old two-part
  cookie `<state>:<consentVersion>` still finishes and lands on `/me`; every error
  outcome is unchanged.
- [X] T015 [P] [US1] Update `test/support/pages.ts` `RIDER_PAGES`: add
  `/me/rides`, `/team` and `/me/settings` for rider A; shell pages other than
  `/me/settings` have no language switcher, so give `RiderPage` a way to say so
  (e.g. `next: null`) and update the language guards that read it
  (`test/integration/language-rendering.test.ts`,
  `test/integration/no-hardcoded-copy.test.ts`,
  `test/integration/ride-name-visibility.test.ts`; rider A's names appear only on
  `/me/rides`).

### Implementation for User Story 1

- [X] T016 [US1] `src/http/html.ts`: `LayoutOptions` gets an optional
  `section?: SectionId`. Without it the page is `body.public` with
  `header.top-bar` holding the wordmark
  `<span class="wordmark">Rynke<span>Points</span></span>` and today's language
  form (buttons get class `segmented`). With it the page is `body.shell`: the top
  bar has the wordmark, `h1.section-title` with `nav.<id>`, and the refresh link;
  no language form; `nav.app-nav` after the footer
  ([contracts/pages.md](contracts/pages.md) "Layout").
- [X] T017 [US1] New `src/http/shell.ts`: `SECTIONS` (id, path, label key, icon
  from T006, in the order of data-model.md) and
  `shellPage(request, ctx, i18n, section, path, render)`: reads the viewer;
  visitor → `302 /`; no current consent → `consentGate()` with `next = path`;
  otherwise `htmlResponse` of `layout(…, { section })` around `render(viewer)`.
- [X] T018 [US1] `src/http/consent-gate.ts` and `src/http/consent-form.ts`: both
  forms take an optional `next` and render the hidden input when given;
  `handleConsent` redirects to `safeNext(next)` and falls back to `/me` when
  `safeNext` answers `/` (so T013 passes).
- [X] T019 [US1] `src/http/session.ts` and `src/http/auth.ts`:
  `createOAuthStateCookie` takes `next`; `readOAuthState` parses three parts and
  reads two parts as `next = "/me"`; `handleConnectForm` reads `next` through
  `safeNext()` (`/` becomes `/me`); `handleCallback`'s success redirects to it.
  `handleReconnect` (`GET /connect`) keeps `/me`.
- [X] T020 [P] [US1] New `src/http/sections/overview.ts` (`handleOverview`):
  moves the Overview parts of `handleMe` from `src/http/me.ts` in the order of
  FR-010, with `renderInstallHint` after the rules (FR-017), through
  `shellPage(…, "overview", "/me", …)`.
- [X] T021 [P] [US1] New `src/http/sections/rides.ts` (`handleRides`): the
  `page` parameter, `readRiderView` and `renderRides` as on `/me` today, plus
  `p.rides-position` and the "updating"/"importing" notices; `path` is
  `/me/rides` or `/me/rides?page=N`.
- [X] T022 [P] [US1] New `src/http/sections/team.ts` (`handleTeam`): the
  `section.placeholder` of [contracts/pages.md](contracts/pages.md) "Team" with
  the `PEOPLE` icon, reading nothing but the viewer.
- [X] T023 [P] [US1] New `src/http/sections/settings.ts` (`handleSettings`):
  moves from `handleMe` the status, scopes, reconnect, change-permissions link,
  `renderNotifications`, consent record, disconnect link and logout form, in
  their current markup for now (US4 groups them).
- [X] T024 [US1] `src/http/rider-sections.ts`: pager links
  `/me/rides?page=N` without `#rides`. `src/http/me.ts`: remove `handleMe` and
  its helpers that moved; keep disconnect page, disconnect and logout.
- [X] T025 [US1] `src/http/router.ts`: `GET /me` with a `page` query → `301`
  to `/me/rides?page=<as given>` before any session read (T010); otherwise
  `/me` → `handleOverview`, `/me/rides` → `handleRides`, `/team` →
  `handleTeam`, `/me/settings` → `handleSettings`. Session renewal applies to
  all four.
- [X] T026 [US1] `src/http/style.ts`: the navigation bar (research R3): below
  600 px `nav.app-nav` fixed at the bottom, 80 px plus
  `env(safe-area-inset-bottom)`, four equal columns with a 64 × 32 px indicator
  pill around the icon of `[aria-current=page]` and a 12 px label; `main` gets
  matching bottom padding in `body.shell`. From 600 px the nav sits in the top
  bar as 44 px pill tabs and `h1.section-title` is hidden.
- [X] T027 [US1] `public/app.js`: on `visibilitychange` remember `hiddenAt`;
  when visible again, if `document.querySelector("nav.app-nav")` and more than
  60000 ms passed, `location.reload()` ([contracts/client.md](contracts/client.md),
  FR-009).

**Checkpoint**: four working sections with navigation; Rides is still the table.

---

## Phase 4: User Story 2 - Every page works on a phone (Priority: P1)

**Goal**: ride cards with the reasons in `<details>`, 44 px controls, the safe
area, and nothing wider than 360 px on any page.

**Independent Test**: `/me/rides` renders `ol.ride-list` cards with `open` only on
rides that don't count, and the style and layout tests prove 44 px targets,
`viewport-fit=cover` and no fixed width above 360 px.

### Tests for User Story 2

- [X] T028 [P] [US2] Update `test/integration/me-rynke.test.ts` and
  `test/integration/me-activities.test.ts` to the card markup in
  [contracts/pages.md](contracts/pages.md) "Rides" (FR-012, FR-021,
  clarification Q5): `ol.ride-list` replaces `table.rides`; each `li.ride-card`
  has the status class, date, chip, the three `dl.ride-figures` entries, the
  name and "View on Strava" link, the meta line; `details.ride-why` is `open`
  only on `ride-not-counting`, closed on `ride-counting` and `ride-pending`, and
  absent when there is nothing to explain; 20 per page; a bad `page` as in 005.
  Rewrite the `rows()` helpers to read cards.
- [X] T029 [P] [US2] Update `test/unit/rider-sections.test.ts` (008 link and
  name tests) to the card: the link sits in `p.ride-strava` after the escaped
  name, for every status.
- [X] T030 [P] [US2] Update `test/integration/pwa-pages.test.ts`: the viewport
  meta is `width=device-width, initial-scale=1, viewport-fit=cover` on every page
  (it asserted the opposite for 010).
- [X] T031 [P] [US2] New `test/integration/layout.test.ts` (FR-020, FR-016): for
  every entry of `RIDER_PAGES`, no inline `width` or `min-width` above 360 px in
  the markup; every public page has `body.public`, the header language form and
  no `nav.app-nav`.
- [X] T032 [P] [US2] New `test/unit/style.test.ts` (FR-022, FR-023): parse
  `STYLE` from `src/http/style.ts`; every selector in the "Control size" list of
  [contracts/pages.md](contracts/pages.md) has `min-height: var(--rp-tap)` and
  `--rp-tap` is `44px`; `main` has `overflow-wrap: anywhere`; no rule sets a
  `width` or `min-width` above 360 px outside a `min-width: 600px` media query;
  `body.shell main` bottom padding includes `env(safe-area-inset-bottom)`.

### Implementation for User Story 2

- [X] T033 [US2] `src/http/rider-sections.ts`: rewrite `renderRides` and
  `rideRows` into the card markup of [contracts/pages.md](contracts/pages.md)
  "Rides", reusing `explanation()` inside `details.ride-why` with
  `summary` = `rynke.ride.why` and `open` only for "doesn't count"; pager links
  get class `tap`.
- [X] T034 [US2] Remove `me.recent.col.date` and `rynke.rides.col.status` from
  `src/i18n/messages/en.ts` and `de.ts` once nothing uses them.
- [X] T035 [US2] `src/http/html.ts`: viewport meta with `viewport-fit=cover`;
  `header.top-bar` pads `env(safe-area-inset-top)`.
- [X] T036 [US2] `src/http/style.ts`: ride cards (head row, chip,
  `dl.ride-figures` as three columns, `details` with a turning chevron, two
  columns from 600 px), `--rp-tap: 44px` and the 44 px rule for every control
  class in the list, `main { overflow-wrap: anywhere }`, `min-width: 0` on grid
  and flex children, and the safe-area padding (research R3, R7, R14).

**Checkpoint**: every page fits a 360 px phone by its contracts.

---

## Phase 5: User Story 3 - One Material look, light and dark (Priority: P2)

**Goal**: the design tokens, dark mode by system or device choice without a flash,
both Strava image variants, tabular figures and reduced motion on every page.

**Independent Test**: `design-tokens.test.ts` proves both schemes have the same
tokens and pass contrast; every page has the head script before `<style>`, both
theme-color metas and both variants of each Strava image.

### Tests for User Story 3

- [ ] T037 [P] [US3] New `test/unit/design-tokens.test.ts` (FR-031–FR-033,
  FR-035, SC-006): parse the light `:root` block and the dark blocks in
  `STYLE`; both define the same token names; the contrast pairs of
  [contracts/design-tokens.md](contracts/design-tokens.md) reach 4.5 : 1 (text)
  and 3 : 1 (outline on surface) in both schemes; gauge parts differ from each
  other and from `--rp-track` (no 3 : 1 check for them); the colours in the head
  script equal `--md-sys-color-surface` light and dark; every rule outside the
  token blocks uses colours only through `var(--…)`.
- [ ] T038 [P] [US3] Extend `test/unit/style.test.ts` (FR-036–FR-038):
  `body` has `font-variant-numeric: tabular-nums`; a
  `@media (prefers-reduced-motion: reduce)` block sets the transitions to none;
  no `url(` to another origin and no `@import`; `.pbs-dark` and `.cws-dark` are
  hidden in light and shown in dark, and the reverse for `-light`, under both
  the media query and `[data-scheme]`.
- [ ] T039 [P] [US3] Update `test/unit/html.test.ts` and
  `test/integration/pwa-pages.test.ts` (FR-034, FR-039, R6, R12): two
  `meta[name=theme-color]` with the light and dark media and `#fff8f6` /
  `#1a110e`; the one inline script (the scheme script) comes after them and
  before `<style>`, and contains `rp-scheme` and no catalog text; besides it only
  `/app.js` (replaces 010's "ships no script but /app.js"); the footer has
  `img.pbs.pbs-light` from `brand.poweredByStrava.src` and `img.pbs.pbs-dark`
  from `brand.poweredByStrava.srcDark`.
- [ ] T040 [P] [US3] Update `test/integration/landing.test.ts` and
  `test/integration/consent-gate.test.ts`: the Connect button holds
  `img.cws.cws-light` from `brand.connectWithStrava.src` and `img.cws.cws-dark`
  from `brand.connectWithStrava.srcDark`, both with the same alt text.
- [ ] T041 [P] [US3] Update `test/unit/manifest.test.ts`: `theme_color` and
  `background_color` are `#fff8f6`.

### Implementation for User Story 3

- [ ] T042 [US3] Rewrite `src/http/style.ts` around the tokens of
  [contracts/design-tokens.md](contracts/design-tokens.md) (research R4, R5):
  light tokens on `:root`; dark under
  `@media (prefers-color-scheme: dark) { :root:not([data-scheme=light]) {…} }`
  and `:root[data-scheme=dark]`; `color-scheme` the same way; type scale,
  spacing, shapes, motion; then every component rule (top bar, nav, cards,
  `card-outlined`, chips, `button`, `button-outlined`, `segmented`,
  `icon-button`, notices, gauges with `--rp-part-*`, `--rp-reached`,
  `--rp-track`, pager, `danger`, footer) using only `var(--…)`; Overview
  `.overview-grid` two columns from 600 px with notices, greeting and verdict
  spanning both; the light/dark image rules; `tabular-nums`; reduced motion;
  system font stack.
- [ ] T043 [US3] `src/http/html.ts`: the two theme-color metas and the inline
  scheme script of [contracts/client.md](contracts/client.md) after them and
  before `<style>`; the footer's two Powered-by-Strava images.
- [ ] T044 [P] [US3] `src/http/consent-form.ts`: the Connect button holds both
  images (`cws cws-light` / `cws cws-dark`).
- [ ] T045 [P] [US3] Give the public pages the Material look through their
  markup hooks only: `src/http/landing.ts`, `src/http/notice.ts`,
  `src/http/errors.ts`, `src/http/consent-gate.ts`, the disconnect page in
  `src/http/me.ts` and `handleOffline` in `src/http/pwa.ts` use `card`,
  `button`/`button-outlined` and `danger` where [contracts/pages.md](contracts/pages.md)
  names them; no new text.
- [ ] T046 [P] [US3] The Overview's verdict in
  `src/http/sections/overview.ts` and `renderSummary` in
  `src/http/rider-sections.ts`: `section.verdict.card`, each missing amount as
  `span.chip`, each gauge in its own `section.card`, breakdown and rules in
  `section.card.card-outlined`, inside `.overview-grid` (contracts/pages.md
  "Overview").
- [ ] T047 [P] [US3] `public/manifest.webmanifest`: `theme_color` and
  `background_color` `#fff8f6`.
- [ ] T048 [P] [US3] `public/strava/README.md`: list the two white variants
  (`connect-with-strava-white.svg`, `powered-by-strava-white.svg`), their
  `brand.*.srcDark` keys, and that both variants of each image are rendered and
  the scheme CSS shows one.

**Checkpoint**: the whole site in the new look, light and dark.

---

## Phase 6: User Story 4 - Every setting in one place (Priority: P2)

**Goal**: Settings in the seven groups of FR-014 with the language form, the
appearance picker and the notifications switch.

**Independent Test**: `/me/settings` shows the groups in order with their
controls, switching the language returns to Settings, and "Cancel" on the
disconnect page returns there.

### Tests for User Story 4

- [ ] T049 [P] [US4] New `test/integration/settings.test.ts` (FR-014, US4-AS1/5):
  `section.settings-group` ids in order `settings-language`,
  `settings-appearance`, `notifications`, `settings-app`, `settings-strava`,
  `settings-consent`, `settings-account`, each with its `h2`; the language form
  posts to `/lang` with `next=/me/settings` and marks the current language
  `aria-current="true"`; three radios `name="scheme"` with `system`, `light`,
  `dark` and the hint; `#notifications` starts `hidden` and has one
  `button[role=switch][data-action=toggle][aria-checked=false]` with
  `aria-label` from `notifications.switch` and no `data-action="on"`/`"off"`;
  `section#settings-app` is `hidden` and holds `aside#install`; "Reconnect" only
  for a `needs_reconnect` rider; the logout form has the hidden `push_endpoint`;
  the disconnect link is `a.danger[href="/me/disconnect"]`.
- [ ] T050 [P] [US4] Update `test/integration/lang-switcher.test.ts`
  (FR-016, US4-AS2): switching from Settings answers `303 /me/settings`; the
  Overview, Rides and Team have no switcher.
- [ ] T051 [P] [US4] Update `test/integration/disconnect.test.ts` (FR-015,
  US4-AS4): "Cancel" links to `/me/settings`.

### Implementation for User Story 4

- [ ] T052 [US4] `src/http/sections/settings.ts`: the seven groups and their
  contents per [contracts/pages.md](contracts/pages.md) "Settings"; extract the
  language buttons from `layout()` in `src/http/html.ts` into a shared
  `languageForm(i18n, next)` used by both.
- [ ] T053 [US4] `src/http/pwa.ts` `renderNotifications`: replace the two
  buttons with the switch; remove `notifications.turnOn` and
  `notifications.turnOff` from `src/i18n/messages/en.ts` and `de.ts`.
- [ ] T054 [US4] `public/app.js` ([contracts/client.md](contracts/client.md)):
  `show(state, checked)` with the switch table; the toggle runs 010's "on" flow
  when `aria-checked` is `false`, else the "off" flow; the scheme picker checks
  the stored radio, stores on `change` (`system` removes `rp-scheme`) and applies
  `dataset.scheme` and theme-color as the head script does; the install hint
  unhides and hides a parent `section#settings-app`.
- [ ] T055 [US4] `src/http/me.ts` disconnect page: "Cancel" links to
  `/me/settings`.
- [ ] T056 [US4] `src/http/style.ts`: settings groups, `segmented-group` with
  44 px labels, the Material switch (`[role=switch]`, thumb transition covered by
  reduced motion), `danger` link in the error colour.

**Checkpoint**: all of `/me`'s former actions are reachable from Settings.

---

## Phase 7: User Story 5 - Team placeholder (Priority: P3)

**Goal**: `/team` shows the placeholder to riders and organisers and no rider data.

**Independent Test**: `/team` for a rider and an organiser shows only the
placeholder, even with synthetic team data in D1.

- [ ] T057 [US5] New `test/integration/team.test.ts` (FR-013, US5-AS1–3): for a
  rider and for an organiser (flag set), `/team` shows `section.placeholder` with
  `team.placeholder.heading` and `.body` and Team marked current; with
  `seedPageRiders` data present, the page contains none of `RIDE_NAMES`, no other
  rider's name and no Rynke figure. It passes against T022; fix
  `src/http/sections/team.ts` if it doesn't.
- [ ] T058 [US5] `src/http/style.ts`: the centred `section.placeholder` with a
  large tinted icon.

---

## Phase 8: Polish & Cross-Cutting

- [ ] T059 [P] Run `test/unit/dev-guard.test.ts` and
  `test/integration/no-hardcoded-copy.test.ts` against the new
  `src/http/sections/`, `shell.ts`, `icons.ts` and `style.ts`: no `dev/` import,
  no inline rider text (the wordmark is the one allowed brand name; add it to the
  test's allow-list if needed).
- [ ] T060 [P] Update the comments in `src/http/me.ts`, `consent-gate.ts`,
  `rider-sections.ts` and `rider-view.ts` that say "`/me`" where they now mean a
  section, and the route comment in `src/http/router.ts`.
- [ ] T061 Run the asset check in `public/strava/README.md` (every `brand.*.src`
  and `srcDark` path exists under `public/`).
- [ ] T062 Run `pnpm lint`, `pnpm typecheck` and `pnpm test`; all pass.

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002–T007)** → user stories.
- **US1** first: it creates the routes, the shell layout and the section modules
  the other stories change.
- **US2** after US1 (it rewrites the Rides markup US1 moved).
- **US3** after US1; it can run alongside US2 except for `src/http/style.ts`
  (T036 and T042 both edit it: do T036 first, then T042 rewrites around tokens).
- **US4** after US1 and T042 (the switch and segmented styles use tokens).
- **US5** after US1.
- **Polish** last.

Within each story, tests first and failing, then implementation. Tasks touching
`src/http/style.ts`, `src/http/html.ts` or the catalogs are never parallel with
each other.

## Parallel Example: User Story 1

```text
T008 sections.test.ts   T009 overview.test.ts   T010 rides-redirect.test.ts
T011–T015 test updates (different files)
then T020 overview.ts   T021 rides.ts   T022 team.ts   T023 settings.ts
```

## Implementation Strategy

1. Phases 1–2, then US1: the sections work with today's styling. Run the suite.
2. US2: cards and phone contracts.
3. US3: tokens and dark mode across the site.
4. US4 and US5: Settings groups and the Team placeholder.
5. Polish. One PR for the whole feature; its description says `Closes #20`.
