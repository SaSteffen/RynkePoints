---

description: "Task list for feature 022: one set of controls, themes in the header and fun page switches"
---

# Tasks: One Set of Controls, Themes in the Header and Fun Page Switches

**Input**: Design documents from `/specs/022-themes-and-controls/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Mock-up (binding)**: https://claude.ai/artifact/8yciDe8Hycvc4Lo9v8gJBN. Every
task that changes the look names its board; the implementer opens that board
with the Artifact tool and matches it, not just the contract's markup. Board
names: **Main** = "Kopfzeile + Farbschema-Menü (klickbar)", **Fun** =
"Konfetti (hell) und Disco (dunkel)", **Controls** = "Ein Satz
Bedienelemente", **Gallery** = "Alle zwölf Themes", **Transitions** =
"Seitenwechsel: Konfetti und Disco (klickbar)", **Rynke** = "Rynke in den
Seitenwechseln (Entwurf)".

**Tests**: Test-first (constitution Principle V): each story's tests are
written and fail before its implementation. The look is checked by the owner on
the live site after release; there are no tasks for that.

**Delivery**: three shippable phases (plan.md): US1 (Phase 1 of the spec), US2 +
US3 (Phase 2), US4 (Phase 3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an open task)
- **[Story]**: US1–US4 from spec.md

---

## Phase 1: Setup

- [X] T001 Open all six canvas boards with the Artifact tool and compare them with `specs/022-themes-and-controls/contracts/*.md`; note any drift since 2026-10-22 in the affected contract and ask the owner before implementing a changed look

---

## Phase 2: Foundational (blocks every story)

**Purpose**: the new tokens every control rule and theme reads (research R4, R5).

- [X] T002 Write failing tests in `test/unit/design-tokens.test.ts`: in the light root, `DARK`, `SYSTEM_DARK` and `FIXED_DARK` token sets of `src/http/style.ts`, `--rp-type-control` is `600 14px/20px var(--md-ref-typeface)`, `--rp-type-status` is `600 12px/16px var(--md-ref-typeface)`, `--rp-outline-width` is `1px`, `--rp-primary-text` equals `--md-sys-color-primary`, `--rp-on-hero` equals today's `--rp-coin-face` and `--rp-hero-accent` equals today's `--rp-coin-yellow` (contracts/controls.md "New tokens", contracts/themes.md)
- [X] T003 Add the six tokens to every token block in `src/http/style.ts` so T002 passes; no rule uses them yet, nothing changes on screen

**Checkpoint**: `pnpm test` green; no visible change.

---

## Phase 3: User Story 1 – Controls look and behave the same everywhere (P1) 🎯 MVP

**Goal**: one look per control type and state on every page (FR-001–FR-007), board **Controls**. No colour values change.

**Independent test**: every control rule reads the shared tokens; the audit's deviations are gone in the markup.

### Tests for User Story 1

- [X] T004 [P] [US1] Write failing tests in `test/unit/style.test.ts`: the rules for `.button`, `.button-outlined`, bare `button`, `.button-text`, `.danger`, `.icon-button`, `.segmented`, `.segmented-group label`, `.chip[aria-pressed]`, `.badges-filter label`, `.chip`/`.chip-team`/`.chip-alert`/`.status-chip`, `summary`, `.more>summary` and `.ride-why>summary` use `--rp-type-control` (status chips `--rp-type-status`) and `--rp-outline-width`, contain no hex or `rgb(` literal, have `min-height: 44px` (filter chips 36 px inside a 44 px tap area, status chips 28 px), and every selected state (`aria-current`, `:checked`, `aria-pressed=true`, `.badges-filter label:has(:checked)`) uses `--md-sys-color-primary-container` / `--md-sys-color-on-primary-container` (contracts/controls.md "The set")
- [X] T005 [P] [US1] Write failing markup tests in `test/integration/organiser-requests.test.ts` and `test/integration/organiser-events.test.ts`: the request yes/no buttons are `.button` (yes) and `.button-outlined` (no) with no request-specific button class, the round × is an `.icon-button` with an `aria-label`, and the "Ich war auch dabei" form button keeps `.button-outlined`
- [X] T006 [P] [US1] Write failing markup tests in `test/integration/sections.test.ts`: no card in Team, Du, Badges, Rides, Settings or Orga renders more than one `.button` (FR-005); the Badges filter and the two chips that act as filters (Termine, Fahrten) render as filter chips (`.chip[aria-pressed]` or `.badges-filter label`), display-only chips as status chips

### Implementation for User Story 1

- [X] T007 [US1] Rewrite the control rules in `src/http/style.ts` to the set in contracts/controls.md (filled, outlined, text, danger, icon, segmented, filter chip, status chip, disclosure with the 14 px chevron after the text, switch outline width), keeping hover, press `scale(.96)` and busy states; board **Controls**
- [X] T008 [US1] Fix the selected state of the Team switch (`.segmented[aria-current]`) and the Badges filter (`.badges-filter label:has(:checked)`) in `src/http/style.ts` to `primary-container` / `on-primary-container`, border `primary-container`; board **Controls** ("Heute" vs. proposal)
- [X] T009 [US1] Change the request yes/no buttons in `src/http/organiser/requests.ts` (and wherever 019's request buttons render, `src/http/organiser/events.ts`) to `.button` / `.button-outlined` at 44 px and the round × to an `.icon-button`; delete the 40 px / 2 px / 700 rules from `src/http/style.ts`
- [X] T010 [US1] Make "Anlegen" and "Eintragen" both `.button` (find both in `src/http/organiser/*.ts`) and remove the beige filled variant from `src/http/style.ts`
- [X] T011 [US1] Remove the per-page summary sizes and colours (Orga "Woher die Rynke kommen", Du "Alle Details", Team "Zahlen als Tabelle", Fahrten "Warum?") from `src/http/style.ts` so all use the Disclosure rule; adjust the summary markup in `src/http/organiser/overview.ts`, `src/http/rider-sections.ts`, `src/http/sections/team.ts` and `src/http/sections/rides.ts` only where a class forced the old size
- [X] T012 [US1] Bring the chips in `src/http/sections/events.ts`, `src/http/sections/rides.ts` and `src/http/rider-sections.ts` to status chips (28 px, `--rp-type-status`); turn the two chips that act as filters into filter chips; board **Controls**
- [X] T013 [US1] Give the Settings language choice, the Team switch and the Du range the joined-pill segmented look, and the Badges filter the 8 px filter-chip look, in `src/http/style.ts` (markup in `src/http/sections/settings.ts`, `src/http/sections/team.ts`, `src/http/rider-sections.ts`, `src/http/sections/badges.ts` only where needed); board **Controls**
- [X] T014 [US1] Fix every card that T006 finds with two filled buttons by turning the secondary action into `.button-outlined` or `.button-text` in its section file under `src/http/`
- [X] T015 [US1] Run `pnpm lint`, `pnpm typecheck`, `pnpm test`; fix what fails

**Checkpoint**: US1 ships on its own (spec Phase 1).

---

## Phase 4: User Story 2 – Pick a theme from the header (P1)

**Goal**: palette button next to the refresh link on every page, menu with Automatisch and twelve themes, choice per device without a flash, Settings without the scheme choice (FR-010–FR-021). Boards **Main** and **Gallery**.

**Independent test**: e2e picks Wald, reloads, signs out and in, the theme stays; old `rp-scheme=dark` arrives as Rynke Nacht; Settings has no Darstellung group.

### Tests for User Story 2

- [X] T016 [P] [US2] Write failing tests in a new `test/unit/themes.test.ts` for `src/http/themes.ts`: exactly twelve themes in menu order with the ids `rynke-day`, `baltic`, `paris`, `lilac`, `confetti`, `rynke-night`, `night-ride`, `forest`, `plum`, `disco`, `contrast-light`, `contrast-dark`; group, base `scheme` and `fun` per data-model.md; `rynke-day` and `rynke-night` have empty `tokens`; both contrast themes set `--rp-outline-width: 2px`; every theme has `preview { bg, hero, pc, primary, card, text }`; token values equal contracts/themes.md
- [X] T017 [P] [US2] Extend `test/unit/design-tokens.test.ts` (research R10): for each theme, resolve base scheme + overrides and check every text pair ≥ 4.5 : 1, large text, icons and outlines ≥ 3 : 1, and in `contrast-light`/`contrast-dark` every text pair ≥ 7 : 1; and the base light `--rp-track` is `#e3dcc0`, base `--rp-reached` is `#1c1b13` (light) and `#fbe122` (every dark block) (FR-017)
- [X] T018 [P] [US2] Write failing tests in `test/unit/html.test.ts` replacing the `SCHEME_SCRIPT` ones: run `THEME_SCRIPT` against a stub `localStorage`/`document`: a known `rp-theme` sets `data-theme` and its base `data-scheme` and points both `theme-color` metas (without `media`) at the theme's `bg`; `rp-scheme=light|dark` with no `rp-theme` becomes `rynke-day|rynke-night`, is stored and `rp-scheme` removed; an unknown id or a throwing storage leaves both attributes absent; the script contains no catalog text
- [X] T019 [P] [US2] Write failing tests in `test/unit/style.test.ts`: one `:root[data-theme=<id>]` rule per theme with non-empty tokens, generated from `src/http/themes.ts`; one `[data-theme-preview=<id>]` rule per theme; hero cards read `--rp-on-hero` and `--rp-hero-accent`, links/outlined/text buttons/summaries `--rp-primary-text`; the menu rules use tokens only
- [X] T020 [P] [US2] Write failing tests in `test/integration/sections.test.ts`: on every signed-in section, in de and en, `header.top-bar` holds wordmark, `h1`, `button.icon-button.theme-button[aria-haspopup=dialog][aria-expanded=false][aria-controls=theme-menu]` with the `theme.button` label, then the refresh link; `#theme-menu[role=dialog][hidden]` holds one `fieldset` with a `value=auto` radio first and twelve theme radios under three `h3` groups in order, `.theme-sparkle` on `confetti` and `disco` only, and `.theme-note`
- [X] T021 [P] [US2] Update `test/integration/settings.test.ts`: no `name=scheme` radios and no `settings.appearance` heading (FR-016)
- [X] T022 [P] [US2] Update `test/unit/catalogs.test.ts` for the ids in contracts/messages.md: every `theme.*` id (incl. `theme.name.<id>` for all twelve) in de and en, the five removed `settings.*` ids gone from both
- [X] T023 [P] [US2] Update `test/integration/pwa-pages.test.ts`: every page links the theme script instead of the scheme script
- [X] T024 [P] [US2] Write a new `e2e/themes.e2e.ts` (sign-in via `e2e/sign-in.ts`): open the palette button on Team, pick Wald → `data-theme=forest` without reload, menu stays open with Wald checked; reload and sign out/in → still Wald; Escape and an outside tap close the menu and focus the palette button; with `rp-scheme=dark` pre-seeded the first load is `rynke-night`; Automatisch with `colorScheme: dark` shows Rynke Nacht's background; at 320 px width both header buttons are visible. Remove "picks the dark scheme for this device" from `e2e/smoke.e2e.ts`

### Implementation for User Story 2

- [X] T025 [US2] Create `src/http/themes.ts` with the `Theme` type and the twelve themes (data-model.md), the tokens from contracts/themes.md and the preview colours; board **Gallery**
- [X] T026 [US2] Change the base light `--rp-track` to `#e3dcc0` and `--rp-reached` to `#1c1b13` (light) / `#fbe122` (`DARK`, `SYSTEM_DARK`, `FIXED_DARK`) in `src/http/style.ts`, and the gauge colour key swatch with it; board **Gallery**
- [X] T027 [US2] Point the hero cards' text at `--rp-on-hero`, their accent at `--rp-hero-accent`, and links, outlined/text buttons and summaries at `--rp-primary-text` in `src/http/style.ts`
- [X] T028 [US2] Generate the `:root[data-theme=<id>]` override rules and the `[data-theme-preview=<id>]` custom properties from `src/http/themes.ts` into the stylesheet in `src/http/style.ts`, after the base rules
- [X] T029 [US2] Where T017 fails for a token the canvas doesn't show, pick a value in the theme's hue that passes, put it into `src/http/themes.ts` and record it in `specs/022-themes-and-controls/contracts/themes.md`
- [X] T030 [P] [US2] Add the `theme.*` messages to `src/i18n/messages/de.ts` and `src/i18n/messages/en.ts` and remove `settings.appearance`, `settings.appearance.hint`, `settings.scheme.system`, `settings.scheme.light`, `settings.scheme.dark` (contracts/messages.md)
- [X] T031 [P] [US2] Add the palette icon (the canvas path: palette outline with three dots) to `src/http/icons.ts`, plus a check and a close icon if none exist; board **Main**
- [X] T032 [US2] Render the palette button before the refresh link and the hidden `#theme-menu` panel in `src/http/shell.ts` per contracts/theme-menu.md, all text from the catalogs, the tiles from `src/http/themes.ts`; board **Main**
- [X] T033 [US2] Style the palette button (open state `primary-container`), the panel, head, Automatisch row, group headings, grid, tiles, previews, check, "Glitzer" chip and note in `src/http/style.ts` per the "Look (canvas)" table; title ellipsis at 320 px; board **Main**
- [X] T034 [US2] Replace `SCHEME_SCRIPT` with `THEME_SCRIPT` in `src/http/html.ts` (steps 1, 2 and 4 of contracts/theme-menu.md "Head script"), with the id → [scheme, bg] table generated from `src/http/themes.ts`; update every page that includes it
- [X] T035 [US2] Remove the Appearance group from `src/http/sections/settings.ts`
- [X] T036 [US2] In `public/app.js`: remove `schemePicker()`; add `themeMenu()` run once per page load (not in `enhance()`): check the stored radio, toggle the panel, focus the checked radio on open, close on Escape/outside tap/close button with focus back to the palette button, apply a choice on `change` (store or remove `rp-theme`, set or remove `data-theme`/`data-scheme`, update the `theme-color` metas, keep the panel open), tolerate throwing storage; the charts' `MutationObserver` also watches `data-theme`
- [X] T037 [US2] Run `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm exec playwright test e2e/themes.e2e.ts`; fix what fails

**Checkpoint**: US2 works without the fun decorations.

---

## Phase 5: User Story 3 – The fun themes Konfetti and Disco (P2)

**Goal**: decorations of contracts/fun-decorations.md (FR-030–FR-033). Board **Fun** (palette badges also on **Main**).

**Independent test**: the decoration rules exist only under `data-theme=confetti|disco`, never catch pointer events, and stop under reduced motion; rainbow text passes contrast.

### Tests for User Story 3

- [X] T038 [P] [US3] Write failing tests in `test/unit/style.test.ts`: `--rp-rainbow` and `--rp-rainbow-loop` hold the twelve bands of contracts/fun-decorations.md; every decoration rule is scoped to `:root[data-theme=confetti]` or `:root[data-theme=disco]` and has `pointer-events: none`; inside `prefers-reduced-motion: reduce` they get `animation: none` and the bursts are hidden; only `.gauge-fill` (not the `--rp-part-*` parts) takes the rainbow
- [X] T039 [P] [US3] Add to `test/unit/design-tokens.test.ts`: `#1c1b13` against each of the twelve rainbow bands ≥ 4.5 : 1
- [X] T040 [P] [US3] Add to `test/integration/sections.test.ts`: the palette button holds `span.theme-badge[aria-hidden=true]`; any element added for the sparkles or bursts is `aria-hidden`

### Implementation for User Story 3

- [X] T041 [US3] Add `--rp-rainbow`, `--rp-rainbow-loop` and the keyframes `shimmer`, `twinkle`, `fall`, `glow`, `discobadge` to `src/http/style.ts`; board **Fun**
- [X] T042 [US3] Add the background layer (Konfetti dots and strips; Disco star glitter and pink glow) and the 4 px shimmering strip under the header in `src/http/style.ts`; board **Fun**
- [X] T043 [US3] Hero cards (`.team-total`, `.hero`, `.overview-deadline`, `.qualified`): 6 px rainbow-loop strip, no gold rim, Disco glow; four sparkles round the hero coin; four confetti bursts on the qualified card, in `src/http/style.ts` (pseudo-elements where they suffice, otherwise `aria-hidden` spans in the hero markup in `src/http/rider-sections.ts` / `src/http/sections/team.ts`); board **Fun**
- [X] T044 [US3] Rainbow on `.gauge-fill` and its key swatch, the "Neues Abzeichen" and new-badge chips, the current tab's nav pill (icon `#1c1b13`), and the Disco filled-button glow, in `src/http/style.ts`; board **Fun**
- [X] T045 [US3] Add `span.theme-badge` to the palette button in `src/http/shell.ts` and style the Konfetti rainbow badge and the Disco ball badge with moving facets in `src/http/style.ts`; boards **Main** and **Fun**
- [X] T046 [US3] Add the reduced-motion block for all decorations in `src/http/style.ts`
- [X] T047 [US3] Run `pnpm lint`, `pnpm typecheck`, `pnpm test`; fix what fails

**Checkpoint**: spec Phase 2 (US2 + US3) ships.

---

## Phase 6: User Story 4 – A show when switching pages in the fun themes (P3)

**Goal**: the two-half show of contracts/page-switch-show.md and the two Rynke pictures of contracts/show-pictures.md (FR-040–FR-049). Boards **Transitions** and **Rynke**.

**Independent test**: e2e in Konfetti: a tab click mounts the overlay, the URL changes at ~1.6 s, the overlay is gone by ~3.2 s; a tap skips; reload, current tab, back and Wald play nothing; reduced motion gives a short fade.

### Tests for User Story 4

- [X] T048 [P] [US4] Add to `test/unit/html.test.ts`: `THEME_SCRIPT` with a `rp-show` flag `<theme>:<ms>` under 10 s old, the same theme stored and navigation type `navigate` sets `data-show=<theme>` and removes the flag; a stale flag, another theme, or type `reload`/`back_forward` sets nothing (the flag is still removed)
- [X] T049 [P] [US4] Add to `test/unit/style.test.ts`: `:root[data-show=confetti]::before` and `:root[data-show=disco]::before` paint the peak covers of contracts/page-switch-show.md; while `data-show` is set, `.celebrate-coins .coin-mini`, `.badges-reveal-pictures img` and `.badge-sparkles>span` have `animation-play-state: paused`; `.show` is `position: fixed; inset: 0` above header and nav
- [X] T050 [P] [US4] Add to `test/integration/sections.test.ts`: the page carries the URLs of the built show pictures (from `SHOW_PICTURES` and `art-versions.ts`) and nothing for ids not built (FR-049)
- [X] T051 [P] [US4] Add show tests to `e2e/themes.e2e.ts` per the independent test above, plus: the overlay is `aria-hidden` and never holds focus; with `reducedMotion: "reduce"` the overlay is the surface fade and the page changes after ~250 ms
- [X] T052 [P] [US4] Add `validateShows` tests to `test/unit/quote-prompts.test.ts`: `art/shows/shows.json` has exactly `unicorn` and `disco`, each with `id`, `name`, `scene`; snippets resolve

### Implementation for User Story 4

- [X] T053 [US4] Create `src/http/show-pictures.ts` exporting `SHOW_PICTURES: readonly ("unicorn" | "disco")[] = []` (generated later by `pnpm badge-build`) and add `shows` to `FOLDERS` in `scripts/art-versions.mjs`
- [X] T054 [US4] Render the built show pictures' versioned URLs as data attributes (e.g. `data-show-unicorn`, `data-show-disco`) on the `#theme-menu` panel in `src/http/shell.ts`, only for ids in `SHOW_PICTURES`
- [X] T055 [US4] Extend `THEME_SCRIPT` in `src/http/html.ts` with step 3 (the `rp-show` hand-over)
- [X] T056 [US4] Add the `.show` overlay rules, the peak covers, the paused celebrations and every Konfetti keyframe (rainbow `max(2000px, 220vmax)` circle, coin pop and `rotateY` spin, rain fall/sway/spin and coin flip, unicorn path in viewport units and gallop) to `src/http/style.ts`; board **Transitions**
- [X] T057 [US4] Add the Disco rules (room, wire, ball drop with bounce, facets, shade, glints, beams with conic gradient and ring mask, spots, floor glow, Rynke rise and sway) to `src/http/style.ts`; board **Transitions**
- [X] T058 [US4] In `public/app.js` add `SHOW_MS`, `SWITCH_MS`, `FADE_MS`, `FLAG_MAX_AGE_MS`, the piece counts (110 + 110) and the spot count (34) as constants, and the seeded sequence; build the Konfetti overlay (rainbow, the coin front `/coin/rynke-coin-front.svg` via `art-versions`, 220 pieces alternating confetti and training/team coins, the unicorn `img` when its URL is present) and the Disco overlay (room, wire, ball, beams, 34 spots, the disco `img` when present); `aria-hidden`, nothing focusable
- [X] T059 [US4] In `public/app.js` decide qualifying clicks by reusing `pageLoading()`'s "another page of ours" plus: no modifier, not `data-swap`, not the refresh link, not `aria-current=page`, not the current path and query, theme `confetti`/`disco`
- [X] T060 [US4] In `public/app.js` play the leaving half (prevent default, mount at 0, at `SWITCH_MS` set the flag, start the #108 progress bar and `location.assign`) and the arriving half (on `data-show`, mount with every animation delayed by −`SWITCH_MS`, remove `data-show`, remove the overlay at `SHOW_MS`); `pointerdown`/`keydown` skips (leaving: navigate at once without the flag; arriving: remove the overlay), the overlay swallows the skipping tap
- [X] T061 [US4] In `public/app.js` replace the show with the 500 ms surface fade (switch at 250 ms, same two halves) under `prefers-reduced-motion: reduce`, and preload the theme's show picture on load in a fun theme and when the menu switches to one
- [X] T062 [P] [US4] Create `art/shows/README.md`, `art/shows/shows.json` (the `kit` snippet copied from `art/quotes/monkeys.json`, scenes from contracts/show-pictures.md) and `art/shows/prompt.txt` (the quote prompt without speech bubble and talking pose, joyful open grin, rainbow allowed for the unicorn's mane and tail); board **Rynke**
- [X] T063 [P] [US4] Add `validateShows` to `scripts/quote-prompts.mjs` and its type to `scripts/quote-prompts.d.mts`
- [X] T064 [US4] Add the third set `{ dir: "art/shows", list: "shows.json", key: "shows", check: validateShows }` with the hero coin's reference sheet to `SETS` in `scripts/badge-art.mjs`
- [X] T065 [US4] Generalise `scripts/quote-monkeys.mjs` to build a given set `{ art, out, list, key, palette(id) }` and call it from `scripts/badge-build.mjs` for the shows after the quote monkeys: coin palette, plus the twelve rainbow colours for `unicorn`; write `public/shows/<id>.svg`, `src/http/show-pictures.ts` in `shows.json` order and the `art-versions.ts` hashes; the quote monkeys' output stays byte-identical
- [ ] T066 [US4] Generate the pictures with `pnpm badge-art unicorn disco` (suppress Chrome popups, one run at a time, stop by PID), show them to the owner, then `pnpm badge-build`; commit `art/shows/originals/`, `public/shows/*.svg`, `src/http/show-pictures.ts` and `src/http/art-versions.ts`
- [X] T067 [US4] Run `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm exec playwright test e2e/themes.e2e.ts`; fix what fails

**Checkpoint**: spec Phase 3 ships.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T068 [P] Document the third art set in `art/README.md` next to badges and quote monkeys
- [X] T069 [P] Note in `specs/011-mobile-app-shell/contracts/design-tokens.md` that the scheme choice moved to the header theme menu (022 FR-016) and list the new tokens
- [X] T070 Update `specs/022-themes-and-controls/quickstart.md` and the contracts where the implementation had to depart from them

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002–T003)** → stories.
- **US1** needs only the foundation; it ships alone.
- **US2** needs the foundation; it is independent of US1 in code but lands after it (spec phases). Its control colours come from US1's rules.
- **US3** needs US2 (`data-theme`, the palette button, `themes.ts`).
- **US4** needs US3 (fun themes) and US2's head script. The art tasks T062–T066 can start any time after T053 and in parallel with T056–T061; T066 needs the owner.
- Within each story: tests first and failing, then implementation, then the story's run task.

### Parallel examples

- US1 tests: T004, T005, T006 together.
- US2 tests: T016–T024 together; then T030 and T031 alongside T025.
- US3 tests: T038, T039, T040 together.
- US4: T048–T052 together; T062 and T063 alongside T056–T061.

## Implementation Strategy

1. MVP: T001–T015 (US1), open a PR, ship.
2. T016–T047 (US2 + US3), second PR.
3. T048–T067 (US4), third PR; the shows play without Rynke until T066 has built the pictures (FR-049).
4. Polish with the last PR.
