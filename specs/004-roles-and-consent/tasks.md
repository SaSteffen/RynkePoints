---
description: "Task list for roles and rider consent (User Stories 1–3)"
---

# Tasks: Roles and Rider Consent (User Stories 1–3)

**Input**: Design documents from `/specs/004-roles-and-consent/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: REQUIRED (constitution Principle V). Write each test task first, run it
and confirm it fails, then implement. Every rider and athlete ID is synthetic
(constitution Principle I, research R8); no test reads Strava.

**Organization**: one phase per user story, in the spec's order, as one delivery
(plan "Delivery", one PR into `develop`). US1 needs only the shared consent form.
US2 and US3 build on the organiser flag from Phase 2; US3's `audienceOf` uses
US2's `Viewer`.

**Out of scope**:
- **User Story 4** (rider sees and re-agrees to consent versions; FR-013 new
  versions, FR-014 what changed): not planned yet (plan "Delivery", "later").
  Run `/speckit-plan` for it before adding tasks.
- **User Story 5** (maintainer applies to Strava for more riders): **deferred**
  until the organiser overview and the team leaderboard exist. It has no
  automated tests and no code; no tasks here.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 (consent at connect), US2 (organisers from the flag),
  US3 (visibility rule)

## Phase 1: Setup

- [ ] T001 On branch `004-roles-and-consent`, run `pnpm install`, then
  `pnpm lint`, `pnpm typecheck` and `pnpm test`. All pass before any change, so
  later failures are this feature's.

---

## Phase 2: Foundational (blocks US2 and US3)

**Purpose**: the organiser flag on the rider row and the test support for it
(plan "Delivery" step 1; research R2, R3, R9;
[contracts/organiser-flag.md](contracts/organiser-flag.md)).

- [ ] T002 Tests first (failing):
  - `test/integration/schema-minimisation.test.ts`: `organiser` joins the
    `riders` columns.
  - `test/integration/db.test.ts`: `getRider` returns `organiser: false` for a
    new rider and `true` after `UPDATE riders SET organiser = 1`;
    `updateRiderOnReconnect` keeps `organiser = 1`; deleting the rider and
    inserting them again gives `organiser = 0` (US2 scenario 3, FR-003, FR-004).
- [ ] T003 Create `migrations/0009_organiser_flag.sql`: add only
  `ALTER TABLE riders ADD COLUMN organiser INTEGER NOT NULL DEFAULT 0 CHECK
  (organiser IN (0, 1))`, with a header comment naming feature 004 FR-002 and
  that the app never writes it (FR-004). No rename, no drop (CLAUDE.md).
- [ ] T004 In `src/db/riders.ts`, add `organiser: boolean` to `Rider` and map it
  in `getRider` (and every other place a `Rider` is built from a row). Leave
  `insertRider` and `updateRiderOnReconnect` without the column, so the app
  never writes it (research R2).
- [ ] T005 [P] In `test/support/ctx.ts`, add `organiser?: boolean` (default
  `false`) to `SeedRiderOptions`; `seedRider` sets `riders.organiser = 1` with
  an `UPDATE` after inserting when it is `true`.
- [ ] T006 [P] In `specs/001-strava-connect-webhook/data-model.md`, add
  `organiser` to the `riders` table: `INTEGER NOT NULL DEFAULT 0`,
  `CHECK (organiser IN (0, 1))`, set by the maintainer only (feature 004 FR-002),
  deleted with the row.
- [ ] T007 Run `pnpm test`: T002 now passes.

**Checkpoint**: the flag exists and is read; nobody is an organiser (FR-006).

---

## Phase 3: User Story 1 - Rider agrees to what taking part needs when connecting (Priority: P1)

**Goal**: the consent step built by 001 stays as it is; a rider connected before
it sees the consent texts and the same form on `/me` (research R1,
[contracts/rider-pages.md](contracts/rider-pages.md)).

**Independent Test**: [quickstart.md](quickstart.md) §1, User Story 1: the
existing tests per scenario pass, and `/me` of a rider without a consent record
shows the consent and a form posting `consent=1` to `/connect`.

- [ ] T008 [P] [US1] Tests first (failing), `test/integration/me-status.test.ts`:
  - a rider without a consent record sees the reworded `me.consent.none`, then
    `landing.dataRead`, `landing.private`, `landing.purpose`, `landing.leave`,
    `consent.organisers`, `consent.team`, `consent.required`, `consent.write`,
    and a form with `method="post" action="/connect"` and a required checkbox
    `name="consent" value="1"` (`CONSENT_VERSION`);
  - a rider with a record sees the version and date as today and no consent form.
- [ ] T009 [P] [US1] `test/integration/landing.test.ts`: assert the landing form
  markup (action, required checkbox with `CONSENT_VERSION`, Connect with Strava
  button image and alt) so the move in T010 is checked to change nothing.
- [ ] T010 [US1] Create `src/http/consent-form.ts` with
  `consentForm(i18n: I18n): SafeHtml`, rendering exactly the form now inline in
  `src/http/landing.ts` (contract "The consent form, shared"). Replace the inline
  form in `src/http/landing.ts` with `consentForm(i18n)`; drop the then-unused
  `CONSENT_VERSION` import there.
- [ ] T011 [US1] In `src/http/me.ts` `consent()`, for a rider without a record
  render, in this order: `me.consent.none`; `landing.dataRead`,
  `landing.private`, `landing.purpose`, `landing.leave`; `consent.organisers`,
  `consent.team`, `consent.required`, `consent.write`; `consentForm(i18n)`.
  The rest of `/me` is unchanged and not blocked (research R1).
- [ ] T012 [P] [US1] Reword `me.consent.none` in `src/i18n/messages/de.ts` and
  `src/i18n/messages/en.ts` to the texts in
  [contracts/rider-pages.md](contracts/rider-pages.md) "Messages". No key added
  or removed (FR-040, SC-008).
- [ ] T013 [US1] Run `pnpm test`: T008, T009 pass, and the 001 tests listed in
  [quickstart.md](quickstart.md) §1 for US1 scenarios 1–6 still pass
  (plan "Delivery" step 7).

**Checkpoint**: US1 complete; a rider without a record can agree from `/me`.

---

## Phase 4: User Story 2 - Organisers are recognised from the organiser flag (Priority: P1)

**Goal**: one `readViewer` decides visitor, rider or organiser from the rider row
on every request (research R4, R10;
[contracts/viewer-and-visibility.md](contracts/viewer-and-visibility.md)).

**Independent Test**: seed riders with and without `organiser`, call
`readViewer` with their session cookies, clear the flag between two requests, and
check the role each time (US2 scenarios 1, 2, 4, 5; SC-006).

- [ ] T014 [P] [US2] Tests first (failing), new
  `test/integration/viewer.test.ts`:
  - no cookie or an invalid cookie → `{ kind: "visitor" }`;
  - a session whose rider row was deleted → visitor;
  - a flagged rider → `kind: "rider"`, `rider.organiser === true`; unflagged →
    `false` (US2 scenarios 1, 2);
  - flag cleared with `UPDATE` between two calls → the second is
    `organiser === false` (US2 scenario 4, FR-003, SC-006);
  - a `needs_reconnect` rider with the flag is still a rider and organiser;
  - no rider flagged → `/me` still works for a rider (US2 scenario 5, FR-006);
  - `requireRider(visitor)` is a `302` to `/`; `requireRider(rider)` is `null`
    (US3 scenario 5).
- [ ] T015 [P] [US2] Test first (failing), `test/integration/dev-fake-strava.test.ts`:
  after seeding, 990004 (Tina TrainingDone) has `organiser = 1` and every other
  sample rider `0`.
- [ ] T016 [US2] Create `src/http/viewer.ts` with `Viewer`
  (`{ kind: "visitor" } | { kind: "rider"; rider: Rider }`),
  `readViewer(request, ctx)` (session via `readSession`, then `getRider`; no row
  → visitor) and `requireRider(viewer)` (`redirect("/", 302)` for a visitor,
  else `null`). The role is never put in a cookie or cached (research R4).
- [ ] T017 [US2] In `src/http/me.ts`, replace the local `signedInRider` with
  `readViewer` in `handleMe` and `handleDisconnect` (keeping the same-origin
  check and `forbidden` answer); behaviour unchanged. Remove `signedInRider`.
- [ ] T018 [P] [US2] In `dev/fake-strava/samples.ts`, add `organiser?: true` to
  `SampleRider` and set it on Tina TrainingDone (990004). In
  `dev/fake-strava/seed.ts`, after connecting the club members, run
  `UPDATE riders SET organiser = 1 WHERE athlete_id = ?` for each sample with
  `organiser` (research R10). Confirm the samples' fingerprint changes so an
  existing fake database is seeded again.
- [ ] T019 [US2] Run `pnpm test`: T014 and T015 pass; `me-status`,
  `disconnect` and `session-renewal` tests still pass.

**Checkpoint**: US2 complete; the role follows the flag per request, and nobody
can set it from the app (FR-004).

---

## Phase 5: User Story 3 - Every view shows only what the consent covers (Priority: P1)

**Goal**: the FR-020 table once in a pure module, and one SQL subquery that keeps
riders without consent out of every row and figure (research R5, R6).

**Independent Test**: for a synthetic team (2 organisers, 3 riders, 1 without
consent), every viewer × subject × item answer matches FR-020 and FR-021
(SC-002), and a `SUM`/`COUNT` with `SHARED_RIDER_IDS` leaves the rider without
consent out.

- [ ] T020 [P] [US3] Tests first (failing), new `test/unit/visibility.test.ts`:
  - `VISIBILITY` equals the [data-model.md](data-model.md) table cell by cell
    for `organiser` and `rider`;
  - `maySee`: `self` → always true; `visitor` → always false; subject not
    shared → false for `organiser` and `rider` (FR-021); otherwise the table;
  - nobody but `self` sees `rides` or `consentRecords`;
  - `audienceOf`: visitor → `visitor`; own athlete ID → `self`; flagged rider →
    `organiser`; unflagged → `rider`;
  - the synthetic team, every viewer × subject × `RiderData`: answers match
    FR-020/FR-021, and the subject's own `organiser` flag changes nothing (FR-007).
- [ ] T021 [P] [US3] Tests first (failing), new
  `test/integration/shared-riders.test.ts`:
  - `listSharedRiderIds` returns riders with a record ordered by athlete ID, and
    leaves out a rider without one; `isShared` true/false accordingly;
  - `SHARED_RIDER_IDS` used as `athlete_id IN (...)` inside a `COUNT(*)` and a
    `SUM` over `rynke_balances` leaves the rider without consent out of both;
  - after `deleteRider`, the rider is not shared (FR-015, SC-001).
- [ ] T022 [US3] In `src/consent.ts`, add `SHARING_SINCE_VERSION = 1` next to
  `CONSENT_VERSION`, with a comment: the lowest consent version that includes the
  FR-020 sharing (research R6).
- [ ] T023 [US3] In `src/db/consents.ts`, add `SHARED_RIDER_IDS` (SQL subquery
  `SELECT athlete_id FROM consent_records WHERE version >= ${SHARING_SINCE_VERSION}`),
  `listSharedRiderIds(db)` (distinct, ordered by athlete ID) and
  `isShared(db, athleteId)`. Doc comment: every team query filters inside SQL
  with `athlete_id IN (${SHARED_RIDER_IDS})` (FR-021).
- [ ] T024 [US3] Create pure `src/visibility.ts` with `RiderData`, `Audience`,
  `VISIBILITY` (the [data-model.md](data-model.md) table), `audienceOf(viewer,
  subjectAthleteId)` and `maySee(audience, data, subjectShared)` in the order of
  the data model's four rules. No D1, clock or text; imports only the `Viewer`
  type.
- [ ] T025 [US3] Run `pnpm test`: T020 and T021 pass.

**Checkpoint**: US3 complete; organiser-admin and team-leaderboard can build on
`readViewer`, `maySee` and `SHARED_RIDER_IDS`.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T026 [P] Check that no athlete ID added in this feature is a real person's:
  tests, fixtures and `dev/` use only synthetic IDs (US2 scenario 6, SC-007,
  research R8).
- [ ] T027 [P] Check the catalog tests (`test/unit/catalogs.test.ts`,
  `test/integration/no-hardcoded-copy.test.ts`) pass with the reworded
  `me.consent.none` in both languages (FR-040, SC-008).
- [ ] T028 Run `pnpm lint`, `pnpm typecheck` and `pnpm test`; all pass.

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002–T007)** → US2 and US3.
- **US1 (T008–T013)** depends only on Setup; it can run alongside Phase 2.
- **US2 (T014–T019)** needs Phase 2 (`Rider.organiser`, `seedRider`'s option).
  T017 touches `src/http/me.ts` after T011 (US1), so do US1 first or merge
  carefully.
- **US3 (T020–T025)** needs Phase 2 and US2's `Viewer` type (T016) for
  `audienceOf`. T022 → T023; T016 → T024.
- **Polish (T026–T028)** after all stories.

Within each story: tests first and failing, then implementation, then the run.

## Parallel Examples

- Phase 2: T005 and T006 while T003/T004 are written.
- US1: T008, T009 and T012 together (different files).
- US2: T014, T015 and T018 together.
- US3: T020 and T021 together; T022 → T023 alongside T024 once T016 is done.

## Implementation Strategy

1. Setup and Foundational: the migration ships safely alone (defaulted column).
2. US1: the consent form on `/me`; a usable increment by itself.
3. US2, then US3: the role and the visibility rule; nothing rider-visible
   changes, and nobody is an organiser until the maintainer sets a flag
   ([contracts/organiser-flag.md](contracts/organiser-flag.md), "Rollout").
4. Polish, then one PR into `develop` (plan "Delivery" 1).
5. Later: plan and task US4; US5 once the organiser overview and the team
   leaderboard exist.
