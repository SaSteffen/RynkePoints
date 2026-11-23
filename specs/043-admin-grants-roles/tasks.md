# Tasks: Administrators Give and Take Roles

**Input**: Design documents from `/specs/043-admin-grants-roles/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Required (constitution Principle V): each story starts with a failing test.

**Format**: `[ID] [P?] [Story] Description`. Texts are German first, then the nine other catalogs
(contracts/pages.md has the German wording).

## Phase 1: Setup

- [ ] T001 Add migration `migrations/0036_roles.sql` with `ALTER TABLE riders ADD COLUMN role_since INTEGER;`, `role_seen INTEGER`, `role_changed_by TEXT`, `role_changed_at INTEGER` (all nullable, add only), with a header comment as in data-model.md
- [ ] T002 [P] Add a `KEY` icon (circle at 8,15 r4; path `M11 12l9-9M17 6l3 3M14.5 8.5l2 2`) to `src/http/icons.ts`

## Phase 2: Foundational

- [ ] T003 Write failing tests in `test/integration/admin-roles-model.test.ts`: a rider with `administrator = 1, organiser = 0` reads as an organiser (`toRider`) and may open `/organiser/riders`; `roleOf` gives none/orga/admin for the flag pairs in data-model.md
- [ ] T004 In `src/db/riders.ts`: `toRider` sets `organiser = row.organiser === 1 || row.administrator === 1 || guest`; add the four new columns to `RiderRow`/`Rider` (`roleSince`, `roleSeen`, `roleChangedBy`, `roleChangedAt`); add `type Role = "none" | "orga" | "admin"`, `roleOf(rider)` and the codes none 0, Orga 1, Admin 2; update the comments that say the app never writes the flags
- [ ] T005 Update the tests that assume an administrator without the organiser flag has no Orga, in `test/integration/admin-access.test.ts` (and any other failing after T004), to: an administrator always has Orga (research R10)

**Checkpoint**: an administrator is always in the Orga; nothing else changed.

## Phase 3: User Story 1 - An administrator makes a rider an organiser (P1) 🎯 MVP

**Goal**: Admin › Rollen lists the roles; an own administrator gives the Orga role; the rider sees the card and can start the Orga-Rundgang from it.

**Independent Test**: quickstart §1 steps 1–3.

- [ ] T006 [US1] Write failing tests in `test/integration/admin-roles.test.ts`: `GET /admin/roles` as an administrator lists own administrators (viewer with "Du", no "Ändern"), organisers who aren't administrators (with "Ändern"), and listed riders without a role under "Rolle geben"; guests and unlisted riders are in no list; `POST /admin/roles` `role=orga` for a listed rider without a role sets `(organiser, administrator) = (1, 0)`, `role_since = now`, `role_seen = 0`, `role_changed_by` = the sender's first name, `role_changed_at = now`, and answers 303 to `/admin/roles?done=orga&athlete=<id>&from=none`; the same POST again writes nothing more; the rider may open `/organiser/riders` on their next request
- [ ] T007 [US1] Add to `src/db/riders.ts`: `readRoles(db)` (own administrators, organisers who aren't administrators, listed riders without a role; first name, ID, `role_since`; guests left out; sorted by first name, `COLLATE NOCASE`) and `setRole(db, target, role, by: Rider, now)` as the single UPDATE in data-model.md (`role_seen = COALESCE(role_seen, :old)`; restricted to `guest = 0` and the listed riders; no write when the role is unchanged; returns `"changed" | "same" | "unknown"`)
- [ ] T008 [US1] Add `"roles"` to `AdminView` and the third segment (KEY icon, `admin.switch.roles` "Rollen", `/admin/roles`) in `src/http/admin/access.ts`
- [ ] T009 [US1] Create `src/http/admin/roles.ts`: `handleAdminRoles` (GET via `adminPage`, page per contracts/pages.md "Admin › Rollen", notice from `?done=&athlete=&from=` with a "Rückgängig" form posting `role=<from>`) and `handleSetRole` (POST via `requireAdminPost`, 403 for guests, 400 for a `role` outside `none|orga|admin`, `error=self` for the sender's own ID, `error=unknown` from `setRole`, 303 as in contracts/http-routes.md); route both in `src/http/router.ts`
- [ ] T010 [US1] Add the choice dialog to Rollen (`dialog.role-sheet`, three radio rows, the line about the next visit, "Abbrechen"/"Speichern", per contracts/pages.md); each "Ändern"/"Rolle geben" is a `button` with `data-athlete`, `data-name`, `data-role`
- [ ] T011 [US1] In `public/app.js`: on Rollen, fill the dialog from the clicked button (title with the name, the checked radio, hidden `athlete`) and `showModal()`; "Abbrechen" closes it; the search field filters the "Rolle geben" rows by name and shows "Niemand gefunden." when none is left
- [ ] T012 [P] [US1] Styles in `src/http/style.ts`: `.roles` layout (two columns at desktop width via the existing `settings-page`), avatar, row buttons, `.role-sheet` (bottom sheet below 700 px, centred dialog above, backdrop), radio rows, and `.roles .rider-search` shown at every width (research R8)
- [ ] T013 [US1] Write failing tests in `test/integration/role-card.test.ts`: after a change to Orga, the rider's `/me` shows the "Du bist jetzt in der Orga" card with the administrator's first name and date and "Rundgang starten"/"Später", and no organiser tour invitation on other pages; `POST /me/role-card` `action=tour` clears the three columns and redirects to the Orga-Rundgang's first step; `action=close` clears them and marks the Orga-Rundgang done; cross-origin POST is 403
- [ ] T014 [US1] Add to `src/db/riders.ts`: `clearRoleCard(db, athleteId)` (sets `role_seen`, `role_changed_by`, `role_changed_at` to NULL)
- [ ] T015 [US1] Render the card in `src/http/sections/overview.ts` as the first item of `.overview-grid` (`section.notice.role-notice`, per contracts/pages.md and data-model.md "Role card"); when `role_seen` equals the current role, clear it without a card
- [ ] T016 [US1] Create `src/http/role-card.ts` with `handleRoleCard` (`POST /me/role-card`, same-origin, signed-in rider; `action` `close` | `tour` per contracts/http-routes.md) and route it in `src/http/router.ts`
- [ ] T017 [US1] In `src/http/tour.ts`: no organiser invitation while the rider has an unseen change to Orga or Admin (research R6)
- [ ] T018 [P] [US1] Styles for `.role-notice` (primary border, full grid width) in `src/http/style.ts`
- [ ] T019 [US1] German texts for Rollen, the dialog, the notices, the errors and the joined card in `src/i18n/messages/de.ts`

**Checkpoint**: US1 works end to end in fake mode (quickstart §1 steps 1–3).

## Phase 4: User Story 2 - An administrator makes a rider an administrator (P1)

**Independent Test**: quickstart §1 step 4.

- [ ] T020 [US2] Add failing tests to `test/integration/admin-roles.test.ts` and `test/integration/role-card.test.ts`: `role=admin` writes `(1, 1)` and the rider opens `/admin` and `/organiser/riders`; the card "Du bist jetzt Admin" offers "Orga-Rundgang starten"/"Später" while the Orga-Rundgang isn't done and only "Verstanden" when it is; no admin tour anywhere
- [ ] T021 [US2] Implement the admin card variants in `src/http/sections/overview.ts` and their German texts in `src/i18n/messages/de.ts`

## Phase 5: User Story 3 - An administrator takes a role away (P1)

**Independent Test**: quickstart §2.

- [ ] T022 [US3] Add failing tests: `role=none` for an organiser writes `(0, 0)` and clears `organiser_onboarded_at` (trigger); `role=orga` for an administrator writes `(1, 0)`; the notice texts per contracts/pages.md; "Rückgängig" restores the old role and leaves no card (`role_seen` equals the role → cleared on `/me`); cards "Du bist nicht mehr in der Orga" (without the Termine sentence on a team without events) and "Du bist kein Admin mehr" with "Verstanden"; the organiser view is refused from the next request — in `test/integration/admin-roles.test.ts` and `test/integration/role-card.test.ts`
- [ ] T023 [US3] Implement the remaining notice and card variants in `src/http/admin/roles.ts`, `src/http/sections/overview.ts`, German texts in `src/i18n/messages/de.ts`

## Phase 6: User Story 4 - Nobody changes their own role, and the last administrator stays (P2)

**Independent Test**: quickstart §3.

- [ ] T024 [US4] Add failing tests: own-ID POST → `error=self`, nothing changed; the note under Admins for a sole own administrator; removing the only own administrator (as a guest) → `/admin/riders?error=lastAdmin` from both the confirm page and the POST, nothing deleted, blocked or revoked; with two own administrators removal works — in `test/integration/admin-roles.test.ts` and `test/integration/admin-remove.test.ts`
- [ ] T025 [US4] Add `ownAdministratorCount(db)` (`administrator = 1 AND guest = 0`) to `src/db/riders.ts`; refuse in `handleRemoveConfirm` and `handleRemoveRider` in `src/http/admin/remove.ts`; show the `lastAdmin` error on Admin › Rider (`src/http/admin/riders.ts`); German text in `src/i18n/messages/de.ts`

## Phase 7: User Story 5 - Organisers and administrators see who is in the Orga (P3)

**Independent Test**: quickstart §4.

- [ ] T026 [US5] Write failing tests in `test/integration/settings-orga.test.ts`: the row lists own administrators "(Admin)" then organisers for an organiser (no link), with "Mitglieder ändern" → `/admin/roles` for an own administrator, without a link for a guest, and no row for a rider without a role
- [ ] T027 [US5] Add `orgaNames(db)` to `src/db/riders.ts` and the row `li#settings-orga` after the consent row in `src/http/sections/settings.ts`; German texts in `src/i18n/messages/de.ts`

## Phase 8: User Story 6 - A guest sees the roles but can't change them (P3)

**Independent Test**: quickstart §3 step 2.

- [ ] T028 [US6] Add failing tests in `test/integration/admin-roles.test.ts`: as the sample guest, Rollen shows the lists without "Ändern", search or "Rolle geben"; a POST is 403 and changes nothing
- [ ] T029 [US6] Make Rollen read-only for guests in `src/http/admin/roles.ts` (if T009 didn't already)

## Phase 9: Polish

- [ ] T030 [P] Translate every new key into the nine other catalogs in `src/i18n/messages/*.ts` (fresh, neutral wording; Europe's English without group-ride assumptions)
- [ ] T031 [P] Playwright test `e2e/admin-roles.e2e.ts`: as Alex Admin, open Rollen, search "Fi", open the dialog, pick Orga, save, see the notice; then "Rückgängig"
- [ ] T032 [P] Update `docs/how-it-runs.md`: roles are given in Admin › Rollen; by hand only for a team's first administrator or after the last one left
- [ ] T033 Update Hamburg's pages snapshot by running `test/teams/pages-snapshot.test.ts` whole with `-u`, and read the `.snap` diff
- [ ] T034 Run the new and changed test files, `pnpm lint` and `pnpm typecheck`; walk through quickstart.md in fake mode at phone and desktop width against the design draft

## Dependencies & Execution Order

- Phase 1 → Phase 2 → US1 (MVP). US2 and US3 build on US1's route and card; US4–US6 need only
  US1's Rollen page. Polish last.
- [P] tasks touch different files: T002 with T001; T012 and T018 with the handlers; T030–T032
  together.

### Parallel example (US1)

```text
T012 styles for Rollen   |  T009 handlers
T018 card styles         |  T015 card rendering
```

## Implementation Strategy

1. MVP: Phases 1–3 (give the Orga role, the card). Check in fake mode.
2. Add US2 and US3, then US4 (safety), then US5 and US6.
3. Polish: catalogs, e2e, docs, snapshot.
