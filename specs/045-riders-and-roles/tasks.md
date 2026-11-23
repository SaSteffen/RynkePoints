# Tasks: Riders and Roles in One Admin Tab

**Input**: Design documents from `/specs/045-riders-and-roles/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Required (constitution Principle V): each story starts with a failing test.

**Format**: `[ID] [P?] [Story] Description`. Texts are German first, then the nine other catalogs
(contracts/pages.md has the German wording). The Rollen page and the Rider tab's page are
rewritten as one: the old Rollen page code moves into `src/http/admin/riders.ts` (research R1,
R11).

## Phase 1: Setup

No new dependency, migration or file layout.

- [ ] T001 Run the files this feature rewrites on the untouched branch, to see them green first: `pnpm test -- test/integration/admin-riders test/integration/admin-roles test/integration/admin-remove test/integration/admin-access test/integration/settings-orga test/integration/role-card test/unit/catalogs`

## Phase 2: Foundational (texts)

**Purpose**: every story's pages and tests read the new keys, so they exist first. Add and change
only; the keys that go away are removed in T040, when no code names them any more. Typecheck fails
between T002 and T011 (the other catalogs lack the keys): commit them together.

- [ ] T002 In `src/i18n/messages/de.ts` change the text of `admin.switch.riders` ("Rider und Rollen"), `admin.roles.hint`, `admin.roles.orgaNote` and `admin.roles.choice.orga.text`; add `admin.roles.hint.events`, `admin.roles.choice.orga.text.events`, `admin.roles.without.heading`, `admin.roles.without.note` (placeholders `{listed}`, `{waiting}`, `{blocked}`), `admin.roles.without.empty`, `admin.roles.sheet.role`, `admin.riders.attention.import`, `admin.riders.guest.since` (`{date}`) and `admin.riders.guests.note`, with the German texts of the table in contracts/pages.md; keep every old key for now
- [ ] T003 [P] The same changes and additions in `src/i18n/messages/da.ts`, same meaning in the language's own words
- [ ] T004 [P] The same in `src/i18n/messages/en.ts`
- [ ] T005 [P] The same in `src/i18n/messages/fi.ts`
- [ ] T006 [P] The same in `src/i18n/messages/fr.ts`
- [ ] T007 [P] The same in `src/i18n/messages/is.ts`
- [ ] T008 [P] The same in `src/i18n/messages/lt.ts`
- [ ] T009 [P] The same in `src/i18n/messages/nb.ts`
- [ ] T010 [P] The same in `src/i18n/messages/nl.ts`
- [ ] T011 [P] The same in `src/i18n/messages/sv.ts`
- [ ] T012 Add the new keys (the added ones of T002) to the key lists in `test/unit/catalogs.test.ts` under a "Feature 045" comment, next to feature 043's; run `pnpm test -- test/unit/catalogs` and `pnpm typecheck`

**Checkpoint**: ten catalogs carry the new keys; nothing visible has changed yet.

## Phase 3: User Story 1 - One tab for riders and their roles (Priority: P1) 🎯 MVP

**Goal**: Admin has two tabs; Rider und Rollen lists every listed rider and guest once, with the
red line, the counts and one search; the old Rollen address leads there.

**Independent Test**: quickstart §1.

- [ ] T013 [US1] Rewrite `test/integration/admin-riders.test.ts` as failing tests of the merged page, porting what still holds from the Rider tab's tests (its guest tests are ported in T030): the switch has the two segments Nutzung and "Rider und Rollen" (`href="/admin/riders"`, `aria-current`, no `/admin/roles` segment); each listed rider is on the page once, in Admins, Orga or Ohne Rolle by role; unlisted riders only counted; a rider on an older consent version is listed and one without any is not; the red line (`settings-sub warn`) for `needs_reconnect`, for `pending`/`running` import and for both joined with " · ", in every section, and none for a fine rider; the note under Ohne Rolle with `{listed}`, `{waiting}`, `{blocked}`; "Admins haben ebenfalls Orga-Rechte." under Orga; the search field and the hidden "Niemand gefunden."; "Noch niemand hat zugestimmt." when nobody is listed; no rides, Rynke or tokens, and athlete IDs only inside `data-` attributes and the removal address, never as text (FR-019 of feature 025)
- [ ] T014 [P] [US1] In `test/integration/admin-roles.test.ts`: failing tests that `GET /admin/roles` answers 301 to `/admin/riders` with the query kept, `error=self` becoming `roleSelf` and `error=unknown` becoming `roleUnknown`, `done`, `athlete` and `from` passed on; that `POST /admin/roles` answers 303 to `/admin/riders?done=<role>&athlete=<id>&from=<old>` or `?error=roleSelf` / `?error=roleUnknown`; that `/admin/riders` shows the undo notice for `done=…` and Rollen's two error texts for the new codes; the tests of the role writes (flags, 400, 403, same role twice, undo) stay and read their Locations from the new address
- [ ] T015 [P] [US1] In `test/integration/admin-access.test.ts`: `/admin/roles` redirects a visitor and a rider as it does an administrator, the target then applies its checks (visitor → `/`, rider → 403); an old Rider-tab link `?done=removed` and `?error=lastAdmin` show their notice on `/admin/riders`
- [ ] T016 [US1] In `src/db/riders.ts` add the one reader of data-model.md: a batch of four statements (listed riders with role flags, `role_since`, the four facts; guests with the same facts; the count of non-guest riders not listed; `blockedCountStatement`), returning `admins`, `orga`, `none`, `guests`, `unlisted`, `blocked`, sorted by first name `COLLATE NOCASE` then ID; select only the columns in data-model.md; keep `readRoles` and `readRiderOverview` until T038
- [ ] T017 [US1] In `src/http/admin/access.ts` make `AdminView` `"usage" | "riders"` and `adminSwitch` two segments: Nutzung (gauge, `/admin`) and `admin.switch.riders` (people, `/admin/riders`)
- [ ] T018 [US1] Rewrite `src/http/admin/riders.ts` as the merged page per contracts/pages.md: `adminPage` at `/admin/riders${search}`; the notice (the undo notice and role errors moved from `roles.ts` with the new codes `roleSelf`/`roleUnknown` mapped to the `admin.roles.error.*` keys, the removal notice and its errors as `riders.ts` has them, an `error` winning over a `done`); `div.settings-page.roles` with the first column (notice, `p.roles-hint`, the search with its hidden "Niemand gefunden.", Admins with its notices, Orga with "Admins haben ebenfalls Orga-Rechte." and its empty text) and the second column (Ohne Rolle with the counts note and the two empty texts); rows by the "A row" rules, without the Ändern button and sheet yet; the red line from the facts (research R9: "Muss sich neu verbinden" and `admin.riders.attention.import`, joined with " · ")
- [ ] T019 [US1] In `src/http/admin/roles.ts` drop the page, its builders and the old reader import; `handleSetRole` sends `back()` to `/admin/riders` and uses the codes `roleSelf` and `roleUnknown`; export the path constant the page's forms need; add `handleOldRolesAddress(request)` answering 301 to `/admin/riders` with the query kept and the two codes renamed (research R2); in `src/http/router.ts` route `GET /admin/roles` to it and `GET /admin/riders` to the rewritten page
- [ ] T020 [P] [US1] Point Settings' "Mitglieder ändern" at `/admin/riders` in `src/http/sections/settings.ts` and the `link` constant in `test/integration/settings-orga.test.ts`
- [ ] T021 [P] [US1] In `src/http/style.ts` add `.settings-sub.warn` (error colour, weight 600, inside `.roles`), and check that `.roles` shows the two columns from 840 px and one below, the search at every width, and `li[hidden]` hidden
- [ ] T022 [P] [US1] In `public/app.js` change the search in `adminRoles` to filter every `li[data-name]` on the page (all four sections) instead of the rows beside the field, showing `[data-role-search-none]` when no row is left; the function must not require the dialog for the search to work

**Checkpoint**: US1 works in fake mode (quickstart §1); run the files of T013 to T015.

## Phase 4: User Story 2 - Ändern shows the facts, the role and Entfernen (Priority: P1)

**Goal**: one sheet per row with the rider's facts, the role choice and "Entfernen"; saving a role
behaves as before.

**Independent Test**: quickstart §2 steps 1–2.

- [ ] T023 [US2] Failing tests in `test/integration/admin-riders.test.ts`: every row but the viewer's own has "Ändern" (`data-role-open`) with `data-athlete`, `data-title` (the first name), `data-note`, `data-remove` (`/admin/riders/{id}/remove`) and `data-role` equal to the rider's role; the viewer's own row has the chip "Du" and no button; Ohne Rolle's buttons read "Ändern", never "Rolle geben"; each button's row has a `<template data-facts>` with the four facts in order, the `dd` of a fact that needs attention with `class="warn"` and in words; the dialog has `h2#role-sheet-title`, `[data-facts]`, the role part with the heading "Rolle", the three radios, the line `[data-role-note]`, "Entfernen" (`a.sheet-remove`), "Abbrechen" and "Speichern"; the title carries no "Rolle für"
- [ ] T024 [US2] In `src/http/admin/riders.ts` add the button, the facts template and the dialog (the Rollen page's `chooser`, `choice` and `sheet` builders, moved and extended as contracts/pages.md "The sheet"): facts as a `dl.rider-facts`, title the first name, the heading `admin.roles.sheet.role`, "Entfernen" with `admin.riders.remove`, the dialog form posting to `/admin/roles`
- [ ] T025 [P] [US2] In `public/app.js` extend `adminRoles`: on click copy the row's `template[data-facts]` into `[data-facts]` (replace what was there), set the title from `data-title`, the line from `data-note`, the athlete field and the checked radio from `data-role`, the `href` of `a[data-role-remove]` from `data-remove`, then `showModal()`; "Abbrechen" and a click on the backdrop close it as today
- [ ] T026 [P] [US2] In `src/http/style.ts` add `.rider-facts` (a grouped panel of label and value per line, values right-aligned, `dd.warn` red and bold), the `h3` "Rolle" in `.role-sheet`, and `.role-sheet .actions .sheet-remove` (pushed left with `margin-right:auto`, error colour); keep the sheet a bottom sheet below 700 px
- [ ] T027 [P] [US2] Rewrite `e2e/admin-roles.e2e.ts` for the merged tab at `/admin/riders`: search a rider's name, "Ändern" on the one visible row, the sheet shows the name as heading, the facts, Keine checked; pick Orga, "Speichern", see the notice, "Rückgängig"; "Abbrechen" on Olga's row changes nothing; the sheet's "Entfernen" link points at the rider's confirmation page (do not follow it, the browsers share one fake team)

**Checkpoint**: US2 works in fake mode (quickstart §2 steps 1–2); the role writes' tests still pass.

## Phase 5: User Story 3 - Removing a rider from the merged tab (Priority: P1)

**Goal**: the existing confirmation, with the merged tab current, back to the tab with the notice.

**Independent Test**: quickstart §2 step 3.

- [ ] T028 [US3] Tests in `test/integration/admin-remove.test.ts`: the confirmation page marks "Rider und Rollen" as the current tab (`aria-current`) and its cancel link is `/admin/riders`; after a removal `/admin/riders?done=removed` shows "Entfernt und gesperrt." and no longer lists the rider; the refusals (own entry, unknown rider, only own administrator) end on `/admin/riders` with today's messages; the sheet's `data-remove` address of a rider is the address the confirmation page answers on. Most pass at once because the removal flow is unchanged (research R1); fix `src/http/admin/remove.ts` only where one doesn't
- [ ] T029 [P] [US3] In `e2e/smoke.e2e.ts` replace the removal step that used the Rider tab's card list (`.admin-rider`, `a.danger`) with the merged tab: the rider's row, "Ändern", the sheet's "Entfernen", the confirmation's `form button.danger`, then the URL `/admin/riders?done=removed` and the row gone; keep the "already gone when CI retries" guard

**Checkpoint**: US1 to US3 work together; removal checked end to end.

## Phase 6: User Story 4 - Guests in the merged tab (Priority: P2)

**Independent Test**: quickstart §3 step 1.

- [ ] T030 [US4] Failing tests in `test/integration/admin-riders.test.ts`: the guests are under a "Gäste" section after Orga in the first column, each marked "Gast" with "Verbunden am {date}", in no other section, not counted in the Ohne Rolle note's numbers; no Gäste section without guests; the note "Gäste bekommen hier keine Rolle; …"; a guest's button has no `data-role`, its facts have no "Mitgliedschaft zuletzt geprüft", and the dialog of an administrator still offers the role part (hidden by the script for a guest); the guest is found by the search (`data-name`); a guest with a needed reconnect shows the red line
- [ ] T031 [US4] In `src/http/admin/riders.ts` add the Gäste section (rows with the chip `admin.riders.guest`, the sub-line `admin.riders.guest.since`, facts without the membership line, no `data-role`) after Orga in the first column, with `admin.riders.guests.note`
- [ ] T032 [P] [US4] In `public/app.js` hide `[data-role-part]` and `[data-role-save]` and disable the radios when the clicked button has no `data-role`; show them again for the next row
- [ ] T033 [P] [US4] Update `test/teams/guest-invariant.test.ts` (it fails from T018, which drops the Rider tab's cards, until the Gäste section exists): the guest is listed on `/admin/riders` only under "Gäste" (the heading is now `<h2>Gäste</h2>` / the English catalog's text inside a `settings-section`, the name in a row, not in `<h3>`)

**Checkpoint**: quickstart §3 step 1.

## Phase 7: User Story 5 - A guest viewer (Priority: P2)

**Independent Test**: quickstart §3 step 2.

- [ ] T034 [US5] Failing tests in `test/integration/admin-riders.test.ts` and `test/integration/admin-roles.test.ts`: as a guest viewer every row but their own has "Ändern" and the search is shown; the page has no role part and no "Speichern" in the dialog, only the facts, "Entfernen" and "Abbrechen"; the undo notice has no "Rückgängig" form for a guest; `POST /admin/roles` as a guest answers 403 and changes nothing; removing the team's only own administrator as a guest ends on `/admin/riders?error=lastAdmin`
- [ ] T035 [US5] In `src/http/admin/riders.ts` leave the role part, the athlete field and "Speichern" out of the dialog when the viewer is a guest, and the "Rückgängig" form out of the notice (as `canChange` did in Rollen); give every non-own row its button for every viewer; check the guest viewer's own row (in Gäste) shows "Gast" and "Du" and no button

**Checkpoint**: quickstart §3 step 2.

## Phase 8: User Story 6 - The Orga in plain words (Priority: P3)

**Independent Test**: quickstart §4.

- [ ] T036 [US6] Failing tests in a new `test/integration/admin-riders-orga-text.test.ts`: with Hamburg's team data (events) the text at the top is `admin.roles.hint.events` and the dialog's Orga choice `admin.roles.choice.orga.text.events`; with Europe's team data (no events; `makeCtx({ team })` as the no-events tests do) they are `admin.roles.hint` and `admin.roles.choice.orga.text`, and the whole page contains no "Termine" (SC-005); in German
- [ ] T037 [US6] In `src/http/admin/riders.ts` pick the two texts with `hasEvents(ctx.team)` from `src/teams` (research R6)

**Checkpoint**: quickstart §4.

## Phase 9: Polish and cross-cutting

- [ ] T038 Remove what the merge leaves unused: `readRoles`, `readRiderOverview` and the `OverviewRider` type from `src/db/riders.ts` (check the organiser overview's own `OverviewRider` in `src/http/organiser/overview.ts` is a different type and stays), the `KEY` icon in `src/http/icons.ts`, the `.admin-rider` rules and `.admin-riders` in `src/http/style.ts` (the shared `.usage-figures,.admin-riders` rule keeps `.usage-figures`)
- [ ] T039 [P] In `docs/how-it-runs.md` change "Admin › Rollen" to "Admin › Rider und Rollen" and say the tab also lists each rider's connection and removes riders
- [ ] T040 Remove the keys nothing names any more from all ten catalogs `src/i18n/messages/*.ts` and from the lists in `test/unit/catalogs.test.ts`: `admin.switch.roles`, `admin.roles.give.heading`, `admin.roles.give.button`, `admin.roles.give.note`, `admin.roles.give.none`, `admin.roles.sheet.title`, `admin.riders.counts`; `grep` that no source or test still names them (FR-018)
- [ ] T041 Run Hamburg's pages snapshot, `pnpm test -- test/teams/pages-snapshot`; admin pages aren't in it, so it should pass unchanged; if it fails, update it by running the whole file with `-u` and read the `.snap` diff
- [ ] T042 Run the changed and new test files (quickstart §5), `pnpm lint` and `pnpm typecheck`; then `pnpm test:e2e -- admin-roles smoke` in Chromium
- [ ] T043 Walk through quickstart.md in fake mode at 390 px and 1280 px (Hamburg, and Europe for §4) and compare the tab, the sheet and the confirmation with the design draft, rows 8–10

## Dependencies & Execution Order

- Phase 1, then Phase 2 (texts; T002 before T003 to T011, T012 after them), then US1 (MVP).
- US2 builds on US1's page; US3 only checks the removal flow once US2's "Entfernen" exists; US4
  adds a section and a script rule to the page; US5 changes who gets the role part; US6 only
  chooses two texts. US4 to US6 can follow in any order after US2.
- Polish last: T038 and T040 only after every story, because they remove what the stories stop
  using.
- [P] tasks touch different files: T003 to T011 together; T014 and T015 with T013; T020 to T022
  with T018 and T019; T025 to T027 with T024.

### Parallel example (US1)

```text
T013 tests of the merged page   |  T014 redirect and POST tests  |  T015 access tests
T018 the page                   |  T020 Settings link            |  T021 styles  |  T022 search script
```

## Implementation Strategy

1. MVP: Phases 1 to 3 (the merged lists with red lines, search and the old address). Check in
   fake mode.
2. Add US2 (the sheet), then US3 (removal checked), so nothing from the old tabs is lost.
3. Add US4 to US6, then polish: remove the old code and keys, e2e, docs, snapshot.
4. Ship as one release's pull request: the Rider and Rollen tabs must not exist side by side
   with the merged one.
