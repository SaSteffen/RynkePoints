---
description: "Task list for the rider page cleanup"
---

# Tasks: Rider Page Cleanup

**Input**: Design documents from `/specs/015-rider-page-cleanup/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: REQUIRED (constitution Principle V). Write each test task first, run it
and confirm it fails, then implement. Riders are synthetic and nothing contacts
Strava. `public/app.js` has no test harness (R12); its behaviour is checked in the
local walk-through ([quickstart.md](quickstart.md) §2). The live-site check after
release has no tasks (§3).

**Organization**: one phase per user story, in the spec's priority order. The
stories touch different parts of the Overview and can be done in any order once
the foundation is in; doing them in order avoids conflicts in `overview.ts`,
`style.ts`, `app.js` and the catalogs.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 (waiting state), US2 (greeting on top), US3 (install, then notifications)

## Phase 1: Setup

- [ ] T001 Run `pnpm install --frozen-lockfile`, then `pnpm lint`, `pnpm typecheck`
  and `pnpm test`. All pass before any change, so later failures are this
  feature's.

---

## Phase 2: Foundational (blocks every story)

**Purpose**: the poll interval setting, which US1's markup and the client need.

- [ ] T002 [P] Tests first (failing), `test/unit/config.test.ts`:
  `readyPollSeconds({ READY_POLL_SECONDS: "10" })` returns `10`; `"1"` and `"60"`
  are accepted; `"0"`, `"61"`, `"x"`, `""` and `"1.5"` throw (R5).
- [ ] T003 Add `"READY_POLL_SECONDS": "10"` to `vars` in `wrangler.jsonc` with a
  one-line comment ("seconds between the waiting page's checks for the first
  data, 1–60; 015 research R5"), the same var to the test bindings in
  `vitest.config.ts`, and run `pnpm types` to regenerate
  `worker-configuration.d.ts`.
- [ ] T004 Add `readyPollSeconds(env)` to `src/config.ts`, using the existing
  `integer()` helper plus a 1–60 range check that throws
  `"READY_POLL_SECONDS must be between 1 and 60"`. Add `READY_POLL_SECONDS` to the
  `Settings` pick. T002 passes.

**Checkpoint**: the setting is typed and validated.

---

## Phase 3: User Story 1 — Waiting for the first data (Priority: P1) 🎯 MVP

**Goal**: a rider without a balance sees the spinning coin and the one-time
message on Overview and Rides, the open page switches by itself once the first
balance exists, and no page mentions the import any more.

**Independent Test**: connect a new synthetic rider whose import hasn't run, see
the waiting state on `/me` and `/me/rides`, let the first import page run, and
see the open page switch to the figures without a reload ([quickstart.md](quickstart.md) §2 steps 1–4).

### Tests for User Story 1 (write first, confirm they fail)

- [ ] T005 [P] [US1] `test/unit/rider-view.test.ts`: no balance gives exactly
  `{ state: "waiting" }`; a balance with no rides gives `state: "ready"` with
  empty `rides.rows`; neither state nor `ViewContext` has `importing`. Replace
  the existing `"not-worked-out"` and `importing` cases (R1, R2, data-model.md).
- [ ] T006 [P] [US1] `test/unit/rider-sections.test.ts`: `renderWaiting(i18n,
  seasonStart, pollSeconds)` renders
  `section.waiting[role=status][data-waiting][data-poll-seconds="<n>"]` with
  `svg.coin.coin-large` using `#coin-front`, an `h2` with `waiting.heading` and a
  `p` with `waiting.body` and the formatted season start; `renderNotice` renders
  only the rule-change notice (`rynke.notice.updating`) and nothing for a view
  without `updating` ([contracts/pages.md](contracts/pages.md)).
- [ ] T007 [P] [US1] `test/unit/style.test.ts`: the stylesheet has
  `@keyframes coin-spin`, `.waiting .coin` uses it, and the
  `prefers-reduced-motion: reduce` block sets `.waiting .coin{animation:none}`
  (FR-007, R4).
- [ ] T008 [P] [US1] `test/integration/me-ready.test.ts` (new), through
  `handleFetch`: no session → `401` with an empty body; a session whose rider was
  deleted → `401`; a rider with no balance → `200` `{"ready":false}`; a rider with
  a balance (also zero) → `{"ready":true}`; `Content-Type: application/json`,
  `Cache-Control: no-store`, no `Set-Cookie`; `HEAD` gives the same status with no
  body; a `vi.spyOn(globalThis, "fetch")` sees no call
  ([contracts/http-routes.md](contracts/http-routes.md), FR-004, FR-006, SC-005).
- [ ] T009 [P] [US1] `test/integration/overview.test.ts` and
  `test/integration/me-status.test.ts`: a rider without a balance sees
  `section.waiting[data-waiting]` with the coin, `waiting.heading`, `waiting.body`
  with the season start and `data-poll-seconds="10"`, and no summary, gauges,
  celebration or notice. For every `import_status` (`pending`, `running`,
  `done`), no rider page contains "Import abgeschlossen", "werden noch
  importiert", "werden gerade berechnet" or "Noch keine Fahrten importiert".
  Update the existing assertions that expect those texts (FR-001, FR-001a,
  FR-002, FR-003, US1 #1, #4).
- [ ] T010 [P] [US1] `test/integration/me-activities.test.ts` and
  `test/integration/me-rynke.test.ts`: a rider without a balance on `/me/rides`
  sees `section.waiting` and no `section#rides`; a rider with a zero balance and
  no rides sees the real Overview with zero Rynke and `me.recent.none` on Rides
  (US1 #2, #5, R3). Update the existing assertions on `me.recent.empty` and the
  import notices.
- [ ] T011 [P] [US1] `test/integration/callback.test.ts`: a new rider's callback
  sends one `import-page` message with page 1 and `after` = the season start to
  `WORK_QUEUE` before the redirect (FR-005, US1 #6, R6). It should pass at once;
  it pins existing behaviour.
- [ ] T012 [P] [US1] `test/integration/dev-fake-strava.test.ts`: update any
  assertion on the removed import texts so it checks the waiting state or the
  figures instead.

### Implementation for User Story 1

- [ ] T013 [US1] Add `hasBalance(db, athleteId): Promise<boolean>` to
  `src/db/rider-view.ts`: one `SELECT 1` on the rider's balance row.
- [ ] T014 [US1] In `src/http/rider-view.ts`, rename the `"not-worked-out"` state
  to `"waiting"` with no other fields, and remove `importing` from `ViewContext`,
  `RiderView` and every caller that sets it (`src/http/sections/overview.ts`,
  `src/http/sections/rides.ts`). `"waiting"` ⇔ `read.balance === null`. T005
  passes.
- [ ] T015 [US1] Add to both `src/i18n/messages/de.ts` and `src/i18n/messages/en.ts`
  the keys `waiting.heading`, `waiting.body` (`{date}` placeholder) and
  `me.recent.none` with the German of [contracts/catalog.md](contracts/catalog.md)
  and an English copy. Remove `me.import.done`, `me.recent.empty`,
  `rynke.notice.notWorkedOut` and `rynke.notice.importing` from both catalogs and
  from the key list in `test/unit/catalogs.test.ts`.
- [ ] T016 [US1] In `src/http/rider-sections.ts`, add
  `renderWaiting(i18n, seasonStart, pollSeconds)` per
  [contracts/pages.md](contracts/pages.md); reduce `renderNotice` to the
  rule-change notice; make the empty ride list render `coin-large` and
  `me.recent.none`. T006 passes.
- [ ] T017 [US1] In `src/http/style.ts`, add the `.waiting` layout (centred,
  coin above heading and text), `@keyframes coin-spin` (`rotateY` 0→360deg,
  2.4 s linear infinite) on `.waiting .coin`, and `.waiting .coin{animation:none}`
  inside the existing reduced-motion block. T007 passes.
- [ ] T018 [US1] In `src/http/sections/overview.ts`, render `renderWaiting(…,
  readyPollSeconds(env))` instead of the Rynke content when the view is
  `"waiting"`, and drop the `me.import.done` line. In
  `src/http/sections/rides.ts`, render only the waiting section when waiting,
  otherwise the rule-change notice and `section#rides`. T009 and T010 pass.
- [ ] T019 [US1] Create `src/http/ready.ts` with `handleReady(request, env)`: read
  the session without renewing it (as the `/me/notification-text` handler does),
  `401` with an empty body when there is none or the rider is gone, otherwise
  `hasBalance` → `{"ready":boolean}` with `Content-Type: application/json` and
  `Cache-Control: no-store`; `HEAD` drops the body. Route `GET`/`HEAD` `/me/ready`
  to it in `src/http/router.ts` next to `/me/notification-text`, before the page
  dispatcher. T008 passes.
- [ ] T020 [US1] In `public/app.js`, add `waitForFirstData()` per
  [contracts/client.md](contracts/client.md): on a page with `[data-waiting]`,
  read `data-poll-seconds` (10 when missing or not a positive integer), and on
  each tick while `document.visibilityState === "visible"` fetch `/me/ready`
  with `credentials: "same-origin"` and `cache: "no-store"`; on `{"ready":true}`
  stop and `location.reload()` once; on 401, a network error or `false`, wait for
  the next tick. Call it from the script's start-up next to `refreshOnReturn()`.
  No text in the script.

**Checkpoint**: US1 works on its own: `pnpm test` passes and the walk-through
steps 1–4 of [quickstart.md](quickstart.md) §2 hold.

---

## Phase 4: User Story 2 — Greeting on top (Priority: P2)

**Goal**: the hero is the first block of the Overview in every state, with the
reconnect and rule-change notices below it.

**Independent Test**: open `/me` as a synthetic rider who is waiting, ready,
`needs_reconnect` and rules-updating; the first child of `.overview-grid` is
`section.hero` each time ([quickstart.md](quickstart.md) §1 "Order").

### Tests for User Story 2 (write first, confirm they fail)

- [ ] T021 [P] [US2] `test/integration/overview.test.ts`: for the four states,
  the first element child of `div.overview-grid` is `section.hero`; for
  `needs_reconnect` the reconnect `aside.notice.notice-error` comes after it, and
  for rules-updating the `rynke.notice.updating` section comes after it and before
  the summary. The hero shows totals only when ready (FR-008, FR-009, SC-004).

### Implementation for User Story 2

- [ ] T022 [US2] In `src/http/sections/overview.ts`, render in this order: hero,
  reconnect notice, rule-change notice, then the waiting section or the
  celebration, summary, gauges, breakdown and rules
  ([contracts/pages.md](contracts/pages.md) "Overview"). Check the two-column
  grid in `src/http/style.ts` still places the hero first on wide screens. T021
  passes.

**Checkpoint**: US1 and US2 both hold.

---

## Phase 5: User Story 3 — Install the app once, then notifications (Priority: P3)

**Goal**: no inline install box on the Overview or landing page; one floating
prompt per device to install, then one offer to turn on notifications; Settings
keeps installing without a hide button.

**Independent Test**: [quickstart.md](quickstart.md) §1 "Install" and "Style"
rows, and §2 steps 5–6.

### Tests for User Story 3 (write first, confirm they fail)

- [ ] T023 [P] [US3] `test/integration/pwa-pages.test.ts`: `/` and `/me` have no
  `aside#install` and no `data-install="dismiss"`; `/me/settings` has
  `section#settings-app aside#install` with `data-install="prompt"` and
  `data-install="ios"` and no dismiss; `/me`, `/me/rides`, `/team` and
  `/me/settings` each have exactly one `aside#app-prompt.app-prompt[hidden]` with
  `aria-labelledby="app-prompt-title"`, a non-empty `data-push-key`, a hidden
  `[data-panel=install]` with both `data-install` paragraphs, a hidden
  `[data-panel=notify]` with `data-action="accept"` and `data-action="decline"`
  buttons, and a `data-action="close"` button with `aria-label` = `prompt.close`;
  `/` has no `#app-prompt` (FR-010–FR-012, FR-016). Update the existing
  assertions on the inline hint and its dismiss button.
- [ ] T024 [P] [US3] `test/unit/style.test.ts`: `.app-prompt` is
  `position:fixed` and its `bottom` uses `--rp-nav-height` and
  `env(safe-area-inset-bottom)`; its buttons keep the 44 px minimum (FR-012, R8).

### Implementation for User Story 3

- [ ] T025 [US3] Add to both catalogs `prompt.install.text`, `prompt.notify.text`,
  `prompt.notify.accept`, `prompt.notify.decline` and `prompt.close` with the
  German of [contracts/catalog.md](contracts/catalog.md) and an English copy;
  remove `install.dismiss` from both catalogs and from the key list in
  `test/unit/catalogs.test.ts`.
- [ ] T026 [US3] In `src/http/pwa.ts`, drop the dismiss button from
  `renderInstallHint`, and add `renderAppPrompt(i18n, pushKey)` with the markup
  of [contracts/pages.md](contracts/pages.md) "App prompt".
- [ ] T027 [US3] In `src/http/shell.ts`, render `renderAppPrompt` once in every
  signed-in section, after the content and before `nav.app-nav`, with the VAPID
  public key the Settings section already uses for `data-push-key`.
- [ ] T028 [US3] Remove the install hint from `src/http/sections/overview.ts` and
  `src/http/landing.ts`; keep it in `src/http/sections/settings.ts`. T023 passes.
- [ ] T029 [US3] In `src/http/style.ts`, add `.app-prompt`: `position:fixed`,
  `bottom: calc(var(--rp-nav-height) + env(safe-area-inset-bottom) + <space>)`,
  as wide as the content column, surface colour, elevation and radius from the
  design tokens, the close button in the corner, and no layout effect on the
  content (FR-012). T024 passes.
- [ ] T030 [US3] In `public/app.js`, extract `subscribePush(pushKey)` from
  `notifications()` per [contracts/client.md](contracts/client.md) (permission
  inside the tap, `pushManager.subscribe`, `POST /me/notifications action=on`,
  the sign-out endpoint field; resolves `"on" | "off" | "blocked"`, throws on
  failure), and make the Settings switch use it with unchanged behaviour (R10).
- [ ] T031 [US3] In `public/app.js`, rename `installHint()` to
  `installSettings()` and limit it to `#settings-app #install`: show on
  `beforeinstallprompt` (the `prompt` paragraph) or iOS Safari (the `ios`
  paragraph), hide when standalone or on `appinstalled`, no dismiss, and ignore
  both prompt keys (R11). Keep the `beforeinstallprompt` event in one shared
  listener so `installSettings()` and `appPrompt()` can both call `prompt()`.
- [ ] T032 [US3] In `public/app.js`, add `appPrompt()` per the table in
  [contracts/client.md](contracts/client.md) and [data-model.md](data-model.md)
  "Prompt panel transitions":
  - if `localStorage` throws, do nothing; remove `rp-install-dismissed` without
    treating it as an answer (R9);
  - install panel when not standalone, `rp-install-prompt` unset, and
    `beforeinstallprompt` fired or `navigator.standalone === false`; install tap
    calls `prompt()`; install, close or `appinstalled` sets
    `rp-install-prompt = "done"`;
  - notify panel when `appinstalled` fired or the display is standalone,
    `rp-notify-offer` unset, push supported, `Notification.permission ===
    "default"` and no `pushManager` subscription; accept runs
    `subscribePush(pushKey)` and refreshes `#notifications` if present; accept,
    decline and close set `rp-notify-offer = "done"`;
  - one panel at a time, the aside hidden when none shows, Escape acts as close,
    `app-prompt-title` moves to the visible panel's first paragraph, nothing
    moves focus.

**Checkpoint**: all three stories hold.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T033 [P] `test/integration/no-hardcoded-copy.test.ts` and
  `test/unit/catalogs.test.ts` pass with the added and removed keys; `grep -rn` over `src/` and `public/` finds none of the removed keys and no
  `rp-install-dismissed` write.
- [ ] T034 Run `pnpm lint`, `pnpm typecheck` and `pnpm test`; all pass.
- [ ] T035 Walk through [quickstart.md](quickstart.md) §2 with `pnpm dev`,
  including the poll interval: set `READY_POLL_SECONDS` to `"5"` in
  `wrangler.jsonc`, confirm the network panel shows `/me/ready` every 5 s, and
  set it back to `"10"`.

---

## Dependencies and order

- Setup → Foundational (T002–T004) → US1 → US2 → US3 → Polish.
- US2 and US3 don't need US1's behaviour, only Foundational, but all three edit
  `overview.ts`, `style.ts` and the catalogs, and US1 and US3 both edit `app.js`,
  so doing them in order avoids conflicts.
- Within a story: tests first, then db, view model, catalogs, rendering, routes,
  then the client script.

## Parallel examples

- Foundational: T002 beside T003.
- US1: T005–T012 together; T013 beside T015.
- US2: T021 alone, then T022.
- US3: T023 and T024 together; T025 beside T026.

## Implementation strategy

MVP is US1: new riders see a clear one-time waiting state instead of the import
notices, which matters most right after launch when the team connects. US2 is a
small follow-on for the first impression. US3 can ship in a later release if
time is short; Settings still offers installing and notifications meanwhile.
