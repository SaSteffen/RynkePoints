---
description: "Task list for roles and rider consent (User Stories 1–4)"
---

# Tasks: Roles and Rider Consent (User Stories 1–4)

**Input**: Design documents from `/specs/004-roles-and-consent/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: REQUIRED (constitution Principle V). Write each test task first, run it
and confirm it fails, then implement. Every rider and athlete ID is synthetic
(constitution Principle I, research R8); no test reads Strava.

**Organization**: one phase per user story, in the spec's order, as one delivery
(plan "Delivery", one PR into `develop`, research R17). Every signature is built
in its final US4 shape from the start (`consentForm(i18n, version)`,
`maySee(…, subjectVersion)`, `consentVersionOf`), so nothing is built twice.
- Phase 2 holds what every story needs: the organiser flag and the consent-version
  registry in `Ctx`.
- US1 builds the consent gate in its `missing` state.
- US2 builds `Viewer` with the accepted version.
- US3 builds the visibility rule with per-item since-versions.
- US4 adds the `older` state, `POST /me/consent` and `requireConsent`.

**Out of scope**: **User Story 5** (maintainer applies to Strava for more riders)
is **deferred** until the organiser overview and the team leaderboard exist. It
has no automated tests and no code; no tasks here.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 (consent at connect), US2 (organisers from the flag),
  US3 (visibility rule), US4 (consent versions and re-consent)

## Phase 1: Setup

- [ ] T001 On branch `004-roles-and-consent`, run `pnpm install`, then
  `pnpm lint`, `pnpm typecheck` and `pnpm test`. All pass before any change, so
  later failures are this feature's.

---

## Phase 2: Foundational (blocks every story)

**Purpose**:
- the organiser flag on the rider row and its test support (plan "Delivery"
  step 1; research R2, R3, R9; [contracts/organiser-flag.md](contracts/organiser-flag.md));
- the consent-version registry passed in through `Ctx` (step 8; research R11).

- [ ] T002 [P] Tests first (failing):
  - `test/integration/schema-minimisation.test.ts`: `organiser` joins the
    `riders` columns.
  - `test/integration/db.test.ts`: `getRider` returns `organiser: false` for a
    new rider and `true` after `UPDATE riders SET organiser = 1`;
    `updateRiderOnReconnect` keeps `organiser = 1`; deleting the rider and
    inserting them again gives `organiser = 0` (US2 scenario 3, FR-003, FR-004).
- [ ] T003 [P] Tests first (failing):
  - new `test/unit/consent-versions.test.ts`, registry part:
    - `CONSENT_VERSIONS` is non-empty, starts at 1, and is ordered and
      consecutive;
    - version 1 is `{ version: 1, published: "2026-10-06", requiredScopes:
      ["read", "activity:read"], changes: [] }`;
    - every key in any entry's `changes` exists in every catalog;
    - `CONSENT_VERSION` equals the last entry's `version`.
  - `test/integration/connect.test.ts`: with `makeCtx({ consentVersions })` and
    a synthetic version 2 (`published: "2026-11-01"`, same `requiredScopes`,
    `changes` reusing existing keys such as `consent.team`), `POST /connect`
    with `consent=2` redirects to Strava and `consent=1` is refused like a
    missing tick.
- [ ] T004 Create `migrations/0009_organiser_flag.sql`: add only
  `ALTER TABLE riders ADD COLUMN organiser INTEGER NOT NULL DEFAULT 0 CHECK
  (organiser IN (0, 1))`, with a header comment naming feature 004 FR-002 and
  that the app never writes it (FR-004). No rename, no drop (CLAUDE.md).
- [ ] T005 In `src/db/riders.ts`, add `organiser: boolean` to `Rider` and map it
  in `getRider` (and every other place a `Rider` is built from a row). Leave
  `insertRider` and `updateRiderOnReconnect` without the column, so the app
  never writes it (research R2).
- [ ] T006 [P] In `test/support/ctx.ts`:
  - add `organiser?: boolean` (default `false`) to `SeedRiderOptions`;
    `seedRider` sets `riders.organiser = 1` with an `UPDATE` after inserting
    when it is `true`;
  - add `consentVersions?: ConsentVersions` to `makeCtx`'s options, defaulting
    to `CONSENT_VERSIONS`, the same way as `catalogs`.
- [ ] T007 [P] In `specs/001-strava-connect-webhook/data-model.md`, add
  `organiser` to the `riders` table: `INTEGER NOT NULL DEFAULT 0`,
  `CHECK (organiser IN (0, 1))`, set by the maintainer only (feature 004 FR-002),
  deleted with the row.
- [ ] T008 In `src/consent.ts`, replace the bare constant with the registry
  (research R11, [data-model.md](data-model.md) "Consent Version"):
  - `interface ConsentVersion { version: number; published: string;
    requiredScopes: readonly string[]; changes: readonly MessageId[] }` with doc
    comments: `published` is `"YYYY-MM-DD"`, the team's calendar day;
    `changes` is what grew compared with the version before, empty for
    version 1;
  - `type ConsentVersions = readonly [ConsentVersion, ...ConsentVersion[]]`
    (non-empty; the last entry is the current version);
  - `CONSENT_VERSIONS` with version 1 as in T003;
  - `currentVersion(versions): ConsentVersion` returning the last entry;
  - `CONSENT_VERSION = currentVersion(CONSENT_VERSIONS).version`, commented as
    "for code that has no `Ctx`".
- [ ] T009 Add `consentVersions: ConsentVersions` to `Ctx` in `src/ctx.ts`.
  Pass `CONSENT_VERSIONS` where `Ctx` is built: `src/index.ts`,
  `dev/worker.ts`, and every test that builds a `Ctx` by hand (today
  `test/integration/evaluate-rider.test.ts` and
  `test/integration/run-daily.test.ts`; `pnpm typecheck` finds any other).
- [ ] T010 Read the current version from `ctx.consentVersions` instead of
  `CONSENT_VERSION` on every request path:
  - `src/http/auth.ts`: `handleConnectForm`'s check and `authorizeRedirect`
    call, and the callback's new-rider check, consent record and
    existing-rider `recordConsent` (the lines using `CONSENT_VERSION` today);
  - `dev/worker.ts`: the `/_dev/connect` body.

  `dev/fake-strava/seed.ts`, `test/support/callback.ts` and
  `test/support/ctx.ts` keep `CONSENT_VERSION` (no `Ctx` there, or the
  default).
- [ ] T011 Run `pnpm test`: T002 and T003 pass; `callback`, `connect`,
  `reconnect-scope` and `dev-fake-strava` tests still pass.

**Checkpoint**: the flag exists and is read; nobody is an organiser (FR-006).
The registry holds version 1 only, so no rider sees a difference.

---

## Phase 3: User Story 1 - Rider agrees to what taking part needs when connecting (Priority: P1)

**Goal**: the consent step built by 001 stays as it is. A rider connected before it
sees the consent gate on `/me` (state `missing`): the consent texts and the
landing page's form, and nothing else of `/me` until they agree (research R1 as
superseded by R14; [contracts/rider-pages.md](contracts/rider-pages.md),
[contracts/re-consent.md](contracts/re-consent.md) "`GET /me`, the gate").

**Independent Test**: [quickstart.md](quickstart.md) §1, User Story 1: the
existing tests per scenario pass, and `/me` of a rider without a consent record
shows only the gate, with a form posting the current version to `/connect`.

- [ ] T012 [P] [US1] Tests first (failing), `test/integration/me-status.test.ts`:
  - a rider without a consent record sees:
    - the `<h1>` `me.consent.renew.heading`, then `me.consent.none`;
    - `consent.heading`, `landing.dataRead`, `landing.private`,
      `landing.purpose`, `landing.leave`, `consent.organisers`,
      `consent.team`, `consent.required`, `consent.write`;
    - a form with `method="post" action="/connect"` and a required checkbox
      `name="consent" value="1"`;
    - `me.consent.renew.leave` with a link to `/me/disconnect`;
    - the sign-out form;
  - the same rider sees none of: the status, permissions, import progress,
    Rynke, rides, the install hint, the notification switch;
  - with `makeCtx({ consentVersions })` publishing a synthetic version 2, the
    form's checkbox has `value="2"`;
  - a rider with a record sees the version and date as today and no consent
    form.
- [ ] T013 [P] [US1] `test/integration/landing.test.ts`: assert the landing form
  markup (action, required checkbox with the current version, Connect with
  Strava button image and alt) so the move in T014 is checked to change nothing.
- [ ] T014 [US1] Create `src/http/consent-form.ts` with
  `consentForm(i18n: I18n, version: number): SafeHtml`, rendering exactly the
  form now inline in `src/http/landing.ts`, with `version` as the checkbox value
  ([contracts/rider-pages.md](contracts/rider-pages.md) "The consent form,
  shared"). Replace the inline form in `src/http/landing.ts` with
  `consentForm(i18n, currentVersion(ctx.consentVersions).version)`; drop the
  then-unused `CONSENT_VERSION` import there.
- [ ] T015 [US1] Create `src/http/consent-gate.ts` with a function rendering the
  gate page (`layout`, title `me.title`, `<h1>` `me.consent.renew.heading`).
  Follow the order of [contracts/re-consent.md](contracts/re-consent.md)
  "`GET /me`, the gate": intro, current consent texts, form, leave text and
  link, sign-out form.
  - For now it takes the `missing` state only: intro `me.consent.none`, form
    `consentForm(i18n, current)`.
  - Shape its parameters so US4 can add the `older` state and the
    `/me/consent` form (T040).
- [ ] T016 [US1] In `src/http/me.ts` `handleMe`: when the rider has no consent
  record (`getCurrentConsent` returns none), answer with the gate from T015
  instead of the page; otherwise the page is unchanged. Remove the now-unused
  "no record" branch of `consent()`.
- [ ] T017 [P] [US1] In `src/i18n/messages/de.ts` and `src/i18n/messages/en.ts`:
  - reword `me.consent.none` to the texts in
    [contracts/rider-pages.md](contracts/rider-pages.md) "Messages";
  - add `me.consent.renew.heading` and `me.consent.renew.leave` with the texts in
    [contracts/re-consent.md](contracts/re-consent.md) "Messages" (FR-040).
- [ ] T018 [US1] Run `pnpm test`: T012 and T013 pass, and the 001 tests listed in
  [quickstart.md](quickstart.md) §1 for US1 scenarios 1–6 still pass
  (plan "Delivery" step 7).

**Checkpoint**: US1 complete; a rider without a record can agree from `/me`.

---

## Phase 4: User Story 2 - Organisers are recognised from the organiser flag (Priority: P1)

**Goal**: one `readViewer` decides visitor, rider or organiser from the rider row
on every request, and carries the rider's accepted consent version (research R4,
R10, R15; [contracts/viewer-and-visibility.md](contracts/viewer-and-visibility.md)).

**Independent Test**: seed riders with and without `organiser`, call
`readViewer` with their session cookies, clear the flag between two requests, and
check the role each time (US2 scenarios 1, 2, 4, 5; SC-006).

- [ ] T019 [P] [US2] Tests first (failing), new
  `test/integration/viewer.test.ts`:
  - no cookie or an invalid cookie → `{ kind: "visitor" }`;
  - a session whose rider row was deleted → visitor;
  - a flagged rider → `kind: "rider"`, `rider.organiser === true`; unflagged →
    `false` (US2 scenarios 1, 2);
  - flag cleared with `UPDATE` between two calls → the second is
    `organiser === false` (US2 scenario 4, FR-003, SC-006);
  - a `needs_reconnect` rider with the flag is still a rider and organiser;
  - `consentVersion` is `null` without a record, `1` with version 1, `2` with
    records for 1 and 2;
  - no rider flagged → `/me` still works for a rider (US2 scenario 5, FR-006);
  - `requireRider(visitor)` is a `302` to `/`; `requireRider(rider)` is `null`
    (US3 scenario 5).
- [ ] T020 [P] [US2] Test first (failing), `test/integration/dev-fake-strava.test.ts`:
  after seeding, 990004 (Tina TrainingDone) has `organiser = 1` and every other
  sample rider `0`.
- [ ] T021 [US2] In `src/db/consents.ts`, add `consentVersionOf(db, athleteId):
  Promise<number | null>`: the rider's highest accepted version
  (`SELECT MAX(version) …`), `null` without a record (research R13).
- [ ] T022 [US2] Create `src/http/viewer.ts` with:
  - `Viewer` (`{ kind: "visitor" } | { kind: "rider"; rider: Rider;
    consentVersion: number | null }`);
  - `readViewer(request, ctx)`: session via `readSession`, then `getRider`, then
    `consentVersionOf`; no row → visitor;
  - `requireRider(viewer)`: `redirect("/", 302)` for a visitor, else `null`.

  The role is never put in a cookie or cached (research R4).
- [ ] T023 [US2] In `src/http/me.ts`, replace the local `signedInRider` with
  `readViewer` in `handleMe` and `handleDisconnect`, keeping the same-origin
  check and `forbidden` answer. The gate decision from T016 uses
  `viewer.consentVersion === null`. Behaviour unchanged. Remove `signedInRider`.
- [ ] T024 [P] [US2] In `dev/fake-strava/samples.ts`, add `organiser?: true` to
  `SampleRider` and set it on Tina TrainingDone (990004). In
  `dev/fake-strava/seed.ts`, after connecting the club members, run
  `UPDATE riders SET organiser = 1 WHERE athlete_id = ?` for each sample with
  `organiser` (research R10). Confirm the samples' fingerprint changes so an
  existing fake database is seeded again.
- [ ] T025 [US2] Run `pnpm test`: T019 and T020 pass; `me-status`,
  `disconnect` and `session-renewal` tests still pass.

**Checkpoint**: US2 complete; the role follows the flag per request, and nobody
can set it from the app (FR-004).

---

## Phase 5: User Story 3 - Every view shows only what the consent covers (Priority: P1)

**Goal**: the FR-020 table once in a pure module, each item with the first version
that shares it, and one SQL subquery that keeps riders without consent out of
every row and figure (research R5, R6, R13).

**Independent Test**: for a synthetic team (2 organisers, 3 riders, 1 without
consent), every viewer × subject × item answer matches FR-020 and FR-021
(SC-002), and a `SUM`/`COUNT` with `SHARED_RIDER_IDS` leaves the rider without
consent out.

- [ ] T026 [P] [US3] Tests first (failing), new `test/unit/visibility.test.ts`:
  - `VISIBILITY` equals the [data-model.md](data-model.md) table cell by cell
    for `organiser` and `rider`;
  - `SINCE_VERSION` is `SHARING_SINCE_VERSION` (1) for every `RiderData`;
  - `maySee`: `self` → always true; `visitor` → always false;
    `subjectVersion` `null` → false for `organiser` and `rider` (FR-021);
    otherwise the table;
  - nobody but `self` sees `rides` or `consentRecords`;
  - `audienceOf`: visitor → `visitor`; own athlete ID → `self`; flagged rider →
    `organiser`; unflagged → `rider`;
  - the synthetic team, every viewer × subject × `RiderData`: answers match
    FR-020/FR-021, and the subject's own `organiser` flag changes nothing (FR-007).
- [ ] T027 [P] [US3] Tests first (failing), new
  `test/integration/shared-riders.test.ts`:
  - `listSharedRiderIds` returns riders with a record ordered by athlete ID, and
    leaves out a rider without one; `consentVersionOf` gives their version or
    `null` accordingly;
  - `SHARED_RIDER_IDS` used as `athlete_id IN (...)` inside a `COUNT(*)` and a
    `SUM` over `rynke_balances` leaves the rider without consent out of both;
  - after `deleteRider`, the rider is not shared and `consentVersionOf` is
    `null` (FR-015, SC-001).
- [ ] T028 [US3] In `src/consent.ts`, add `SHARING_SINCE_VERSION = 1` with a
  comment: the lowest consent version that includes the FR-020 sharing
  (research R6).
- [ ] T029 [US3] In `src/db/consents.ts`, add:
  - `sharedRiderIdsSince(version: number): string`, the subquery
    `SELECT athlete_id FROM consent_records WHERE version >= <version>`
    (`version` is a number from code, never request input);
  - `SHARED_RIDER_IDS = sharedRiderIdsSince(SHARING_SINCE_VERSION)`;
  - `listSharedRiderIds(db)`: distinct, ordered by athlete ID.

  Doc comment: every team query filters inside SQL with
  `athlete_id IN (${SHARED_RIDER_IDS})`, or
  `sharedRiderIdsSince(SINCE_VERSION[item])` for an item shared later (FR-021,
  FR-013).
- [ ] T030 [US3] Create pure `src/visibility.ts` with:
  - `RiderData`, `Audience`, `VISIBILITY` (the [data-model.md](data-model.md)
    table);
  - `SINCE_VERSION: Readonly<Record<RiderData, number>>`, every item
    `SHARING_SINCE_VERSION`;
  - `audienceOf(viewer, subjectAthleteId)`;
  - `maySee(audience, data, subjectVersion: number | null, since =
    SINCE_VERSION)` with the data model's four rules in order, rule 3 being
    "`subjectVersion` is `null` or below `since[data]` → `false`". The optional
    `since` lets tests check an item with a later since-version (T034); views
    never pass it.

  No D1, clock or text; imports only the `Viewer` type and
  `SHARING_SINCE_VERSION`.
- [ ] T031 [US3] Run `pnpm test`: T026 and T027 pass.

**Checkpoint**: US3 complete; organiser-admin and team-leaderboard can build on
`readViewer`, `maySee` and `SHARED_RIDER_IDS`.

---

## Phase 6: User Story 4 - Rider sees what they agreed to, and is asked again when it changes (Priority: P2)

**Goal**: a rider whose consent is older than the current version meets the gate
on `/me`. The gate shows what changed and lets the rider agree directly, or
through Strava when a new permission is needed. Future views send such riders
to `/me` (research R11–R16; [contracts/re-consent.md](contracts/re-consent.md)).

**Independent Test**: with `makeCtx({ consentVersions })` publishing a synthetic
version 2 ([quickstart.md](quickstart.md) §1, User Story 4), a rider on
version 1 sees the gate with version 2's changes, agrees through
`POST /me/consent`, and then sees `/me` as usual; until then `maySee` treats
them as version 1.

- [ ] T032 [P] [US4] Tests first (failing), `test/unit/consent-versions.test.ts`,
  `consentState(versions, accepted, grantedScopes)` with a synthetic registry of
  versions 1–3:
  - `accepted` `null` → `missing`, `viaStrava: true`;
  - `accepted` 1 under 3 → `older`, `accepted: 1`, `changes` = version 2's then
    version 3's, in order;
  - `accepted` equal to or above current → `current`;
  - `older` with every `requiredScopes` of the current version granted →
    `viaStrava: false`; one missing → `true`.
- [ ] T033 [P] [US4] Tests first (failing), new
  `test/integration/consent-gate.test.ts`, with a synthetic version 2:
  - **scenario 2**: a rider on version 1 sees:
    - `me.consent.renew.heading`;
    - `me.consent.renew.older` with version 1, its date and version 2;
    - one list item per version 2 `changes` key;
    - the consent texts;
    - a form posting `consent=2` to `/me/consent` with
      `me.consent.renew.button`.

    They don't see the status, Rynke, rides or the notification switch.
    `POST /me/consent` with `consent=2` records version 2 and answers `303 /me`;
    `/me` then shows the page as usual;
  - **scenario 4**: version 2 requires a scope the rider's `riders.scopes` lacks.
    The gate shows `me.consent.renew.strava` and `consentForm` posting to
    `/connect`. `POST /me/consent` answers `303 /me` and records nothing;
  - **scenario 5**: the gate links `/me/disconnect`; `GET` and `POST
    /me/disconnect` still work for a rider on version 1. The deletion itself is
    001's `disconnect.test.ts`;
  - **`POST /me/consent` table**:
    - another origin → 403;
    - signed out → `302 /`;
    - without the tick or with `consent=1` → `303 /me` and no record;
    - a rider already current → `303 /me`, nothing written;
    - posted twice → the first `accepted_at` kept.
- [ ] T034 [P] [US4] Tests first (failing), scenarios 1 and 3:
  - `test/integration/me-status.test.ts`, scenario 1: one test checking that
    `/me` of a current rider shows all of these (research R12):
    - the version and date (`me.consent.accepted`);
    - `landing.dataRead`, `consent.organisers` and `consent.team`;
    - the granted permissions (`me.scope.*`);
    - the link to `/me/disconnect`;
  - `test/unit/visibility.test.ts`, scenario 3: with `since` giving an item
    version 2, `maySee` hides it from `organiser` and `rider` for a subject on
    version 1 and shows it for one on version 2; items still at 1 stay visible;
  - `test/integration/shared-riders.test.ts`, scenario 3: a `SUM` over
    `rynke_balances` filtered with `sharedRiderIdsSince(2)` leaves the
    version 1 rider out and keeps the version 2 rider.
- [ ] T035 [P] [US4] Tests first (failing):
  - `test/integration/viewer.test.ts`: `requireConsent` → `302 /me` for a rider
    with no record and for one on version 1 under a synthetic version 2; `null`
    for a current rider and for a visitor (`requireRider` handles visitors);
  - `test/integration/callback.test.ts`, scenario 4, under a synthetic version 2
    that requires an extra scope ([contracts/re-consent.md](contracts/re-consent.md)
    "Through Strava"):
    - an existing rider coming back through `/connect` with `consent=2` gets
      version 2 recorded and their scopes updated;
    - one who leaves out the extra scope is still connected and gets version 2
      recorded, and `/me` still shows the gate with the Strava form.
- [ ] T036 [US4] In `src/consent.ts`, add pure `consentState(versions:
  ConsentVersions, accepted: number | null, grantedScopes: readonly string[])`
  returning `({ kind: "current" } | { kind: "missing" } | { kind: "older";
  accepted: number; changes: readonly MessageId[] }) & { viaStrava: boolean }`.
  Use the rules of [data-model.md](data-model.md) "Consent state":
  - `changes` concatenates the `changes` of every version after `accepted` up to
    the current one;
  - `viaStrava` is true for `missing`, or when a current `requiredScopes`
    entry is not in `grantedScopes`.
- [ ] T037 [P] [US4] Add `me.consent.renew.older`, `me.consent.renew.strava` and
  `me.consent.renew.button` to `src/i18n/messages/de.ts` and
  `src/i18n/messages/en.ts` with the texts in
  [contracts/re-consent.md](contracts/re-consent.md) "Messages"
  (`{accepted}`, `{date}`, `{version}` placeholders; FR-040).
- [ ] T038 [US4] In `src/http/viewer.ts`, add `requireConsent(viewer, ctx):
  Response | null`. It returns `redirect("/me", 302)` for a rider whose
  `consentState(ctx.consentVersions, viewer.consentVersion, <granted scopes>)`
  isn't `current`, else `null`. Get the granted scopes by splitting
  `rider.scopes` with the same pattern as the callback (`/[\s,]+/` in
  `src/http/auth.ts`); share one helper between `viewer.ts`, `me.ts` and
  `consent-gate.ts`.
- [ ] T039 [US4] In `src/http/me.ts` `handleMe`, compute the state from T036 and
  show the gate for any state other than `current`, replacing the
  `consentVersion === null` check from T023. For `older`, pass the accepted
  record's date from `getCurrentConsent`, formatted as `/me` formats
  `me.consent.accepted`.
- [ ] T040 [US4] Extend the gate in `src/http/consent-gate.ts`
  ([contracts/re-consent.md](contracts/re-consent.md) "`GET /me`, the gate"):
  - `older` intro: `me.consent.renew.older` with `{accepted}`, `{date}`,
    `{version}`, then a `<ul>` with one `<li>` per `changes` key;
  - form: when `viaStrava`, `me.consent.renew.strava` (only for `older`), then
    `consentForm(i18n, current)`. Otherwise the contract's `/me/consent` form:
    required checkbox `name="consent" value="{current}"` with `consent.agree`,
    and the `me.consent.renew.button` button.
- [ ] T041 [US4] In `src/http/consent-gate.ts`, add `handleConsent(request,
  ctx)` for `POST /me/consent`, checking in the order of the contract's table:
  1. other origin → `forbidden(i18n, "/me")` (403);
  2. no rider → `302 /`;
  3. `consent` ≠ current version → `303 /me`;
  4. `viaStrava` → `303 /me`;
  5. already `current` → `303 /me` without writing;
  6. otherwise `recordConsent(ctx.env.DB, athleteId, current, ctx.now())`, then
     `303 /me`.

  No Strava request (Principle II).
- [ ] T042 [US4] In `src/http/router.ts`, route `POST /me/consent` to
  `handleConsent`, next to the other `/me` routes.
- [ ] T043 [US4] Run `pnpm test`: T032–T035 pass; the US1 gate tests (T012) and
  the `connect`, `callback`, `disconnect` tests still pass.

**Checkpoint**: US4 complete. With only version 1 in production, nothing changes
for riders with a record. Publishing version 2 is the documented PR
([contracts/re-consent.md](contracts/re-consent.md) "Publishing a new version").

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T044 [P] Check that no athlete ID added in this feature is a real person's:
  tests, fixtures and `dev/` use only synthetic IDs (US2 scenario 6, SC-007,
  research R8).
- [ ] T045 [P] Check the catalog tests (`test/unit/catalogs.test.ts`,
  `test/integration/no-hardcoded-copy.test.ts`) pass with the reworded
  `me.consent.none` and the five `me.consent.renew.*` keys in both languages
  (FR-040, SC-008).
- [ ] T046 [P] In `specs/001-strava-connect-webhook/contracts/http-routes.md`,
  add `POST /me/consent` with a link to this feature's
  [contracts/re-consent.md](contracts/re-consent.md), and note that `/me` shows
  the consent gate when consent is missing or older.
- [ ] T047 Run `pnpm lint`, `pnpm typecheck` and `pnpm test`; all pass.

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002–T011)** → every story.
  - T004 → T005.
  - T008 → T009 → T010.
- **US1 (T012–T018)** needs the registry (T008–T010) for `consentForm`'s version.
- **US2 (T019–T025)** needs Phase 2. T023 changes `src/http/me.ts` after T016
  (US1), so do US1 first.
- **US3 (T026–T031)** needs Phase 2, US2's `Viewer` (T022) for `audienceOf`,
  and `consentVersionOf` (T021). T028 → T029 and T030.
- **US4 (T032–T043)** needs:
  - US1's gate (T015);
  - US2's `Viewer.consentVersion` (T022);
  - US3's `maySee` `since` (T030) and `sharedRiderIdsSince` (T029).

  Within US4:
  - T036 → T038, T039, T040, T041;
  - T040 and T041 touch the same file; do them one after the other;
  - T041 → T042.
- **Polish (T044–T047)** after all stories.

Within each story: tests first and failing, then implementation, then the run.

## Parallel Examples

- Phase 2: T002 and T003 together; T006 and T007 while T004/T005 and T008 are
  written.
- US1: T012, T013 and T017 together (different files).
- US2: T019, T020 and T024 together.
- US3: T026 and T027 together. Once T022 and T028 are done, T029 alongside T030.
- US4: T032, T033, T034 and T035 together, then T037 alongside T036.
- Polish: T044, T045 and T046 together.

## Implementation Strategy

1. **Setup and Foundational**: the migration ships safely alone (defaulted
   column). The registry with version 1 changes nothing visible.
2. **US1**: the gate for riders without a record. It is a usable increment by
   itself.
3. **US2, then US3**: the role and the visibility rule. Nothing rider-visible
   changes, and nobody is an organiser until the maintainer sets a flag
   ([contracts/organiser-flag.md](contracts/organiser-flag.md), "Rollout").
4. **US4**: the `older` state and `POST /me/consent`. It is visible only once a
   version 2 is published, which this feature doesn't do.
5. **Polish**, then one PR into `develop` (plan "Delivery" 1, research R17).
6. **Later**: US5, once the organiser overview and the team leaderboard exist.
