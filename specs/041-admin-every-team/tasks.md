# Tasks: Administrators on Every Team's Site

**Input**: Design documents from `/specs/041-admin-every-team/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/guest-list.md,
contracts/sign-in-and-removal.md, quickstart.md

**Tests**: Included. The constitution requires test-first (Principle V); each test is written and
seen failing before its implementation task. Run only the touched test files; CI runs everything.

**Organization**: by user story. US2's counting part comes first (plan, order of work): it is safe
on its own, since nobody is a guest until the sign-in exists. The reading part waits for the manual
Strava check (research R1, quickstart §1); Phase 7 holds what outcome B adds.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1–US4 from spec.md

---

## Phase 1: Setup

- [X] T001 Rebase `041-admin-every-team` onto `origin/develop` (Team Europe live, #362); no code change

---

## Phase 2: Foundational (blocks every story)

**Purpose**: the guest list, the guest mark and the `Rider` fields everything else reads.

- [X] T002 Write `migrations/0030_guests.sql`, add only: `CREATE TABLE guests (athlete_id INTEGER PRIMARY KEY)` with no foreign key (an ID is listed before the person signs in), and `ALTER TABLE riders ADD COLUMN guest INTEGER NOT NULL DEFAULT 0 CHECK (guest IN (0, 1))`; a header comment says the maintainer writes `guests` by hand and the app sets `riders.guest` at sign-in (data-model.md)
- [X] T003 Create `src/db/guests.ts`: `isOnGuestList(db, athleteId): Promise<boolean>` and `listRemovedGuestIds(db): Promise<number[]>` (rows with `guest = 1` whose ID isn't in `guests`, ordered); and a test helper `listGuest(ctx, athleteId)` plus `guest` / `onGuestList` options on `seedRider` in `test/support/ctx.ts` (fixtures.ts holds no database code); `resetDb` empties `guests`
- [X] T004 In `src/db/riders.ts`: `RiderRow` gains `guest: number` and `on_guest_list: number`; `Rider` gains `guest: boolean` (doc: "set by the app at sign-in from the guest list; never counted for the team (041 FR-007)") and `onGuestList: boolean`; `riderStatement` selects `r.*, EXISTS (SELECT 1 FROM guests g WHERE g.athlete_id = r.athlete_id) AS on_guest_list FROM riders r`; `toRider` sets `organiser: row.organiser === 1 || guest` and `administrator: row.administrator === 1 || guest` (R4). Fix every other `RiderRow`/`Rider` literal `pnpm typecheck` names (test fixtures included)

**Checkpoint**: the schema exists; nobody is a guest yet, every existing test passes unchanged.

---

## Phase 3: User Story 2 – the guest's rides never count for the team (P1, counting part)

**Goal**: a row with `guest = 1` is in no team count (FR-007, SC-002).

**Independent test**: every team-facing output is byte-identical with and without a guest who has rides.

- [X] T005 [P] [US2] Write failing unit tests in `test/unit/shared-filter-guests.test.ts`: on a D1 with two consented riders, one with `guest = 1`, `listSharedRiderIds` returns only the other; a query using `sharedRiderExists("r", 1)` over `riders r` returns only the other
- [X] T006 [US2] In `src/db/consents.ts`, `sharedRiderIdsSince(v)` gains `AND athlete_id NOT IN (SELECT athlete_id FROM riders WHERE guest = 1)` and `sharedRiderExists(alias, v)` gains `AND ${alias}.guest = 0`; update both doc comments ("a guest's data is never shared with the team, 041 R3") until T005 passes
- [X] T007 [US2] *Built as*: the sample guest of T029 joins each team's sample season, so Hamburg's committed `pages-snapshot` (Orga pages, album) and `season-snapshot` (every rider's `/me`, rides, badges and `/team`) prove the figures byte-identical with a guest there (only the guest's own section is added to `season-snapshot.txt`); `test/teams/guest-invariant.test.ts` checks for every team that no Team, Orga or Admin page names the guest, that the connected and active rider counts leave them out, and that `/admin/riders` shows them only as a guest. *Originally planned* (R9): seed Hamburg's pinned app with two ordinary riders (one an organiser and administrator, the viewer) with rides, events, Rynke and badges, plus a guest (`guest = 1`, on the list, consent, rides in the window, a team event report, a correction by them). Render as the viewer, at one fixed `ctx.now()`, every Team view, every Orga page and graph data endpoint, every Admin page except `/admin/riders`, and the season album's data (`album/load.ts`); then delete the guest's rider row and render again. Every output must be byte-identical. Also assert `connectedCountStatement` and the admin overview's `unlisted` count are equal before and after
- [X] T008 [US2] In `src/db/riders.ts`, `connectedCountStatement` counts `status = 'connected' AND guest = 0` (R3: the guest counts at home already) until T007's capacity assertion passes
- [X] T009 [US2] Run T007; for any output that still differs, find the count that bypasses the shared filter and give it the filter (not a guest check of its own), then re-run `test/teams/pages-snapshot.test.ts` and the season snapshot test untouched

- [X] T009a [US2] `ELIGIBLE` in `src/db/recheck.ts` gains `r.guest = 0`: the admin view's active riders are a team count, and a guest uses none of the team's re-check allowance

**Checkpoint**: guests are invisible to every team count, before anyone can become one.

---

## Phase 4: User Story 3 – their home team keeps working (P1)

**Goal**: nothing a guest site does, and no refusal at any sign-in, revokes a grant (FR-009).

**Independent test**: the fake Strava sees no `/oauth/revoke` for a guest or any sign-in refusal.

- [X] T010 [P] [US3] Write failing tests in `test/integration/guest-no-revoke.test.ts` using the fake Strava's recorded requests (`test/support/fake-strava.ts`): no `/oauth/revoke` for a sign-in refused as blocked, missing scopes, consent missing, not a member (new and existing rider) or inconclusive club check; none for a guest's `POST /me/disconnect`, `POST /admin/riders/<id>/remove` or `delete-rider` with `revoke: true`; and still one for an ordinary rider's disconnect
- [X] T011 [US3] In `src/http/auth.ts` `handleCallback`, drop every `revokeToken(ctx, token.accessToken)` (blocked, inside `refuse`, consent-required, strava-busy) and the `revokeToken` import if unused; the comments say the exchanged token is simply never stored (R5)
- [X] T012 [US3] In `src/strava/tokens.ts`, `revokeStoredToken` reads the row's `guest` mark first and, for `guest = 1`, sends nothing and answers `{ kind: "ok", value: null }` with a comment naming 041 FR-009, until T010 passes
- [X] T013 [US3] Update the existing expectations that a refusal revokes in `test/integration/callback.test.ts` (and any other file `pnpm test` names) to expect no revoke

**Checkpoint**: trying another team's site never ends a rider's connection at home.

---

## Phase 5: User Story 1 – a developer looks at another team's live site (P1)

**Goal**: a listed person signs in without the club and is an organiser and administrator (FR-003, FR-004, FR-008).

**Independent test**: a listed non-member signs in and opens `/orga` and `/admin`; unlisted is turned away.

- [X] T014 [P] [US1] Write failing tests in `test/integration/guest-sign-in.test.ts` with `test/support/callback.ts`: a listed non-member is signed in with no `/athlete/clubs` request to the fake Strava and the row has `guest = 1`; Orga and Admin are in the navigation and `/orga` and `/admin` answer 200; a listed person in the other team's club gets no "one team" notice; a listed person also in the club stays `guest = 1` (edge case); a blocked listed person gets `/notice/blocked`; an unlisted non-member gets `not-member`; a former guest (`guest = 1`, off the list) who is now a club member signs in with `guest = 0`, one who isn't is turned away as `not-member-deleted`; a new listed person without consent gets `consent-required`
- [X] T015 [US1] In `src/db/riders.ts`, `insertRider` takes `guest: boolean` on the rider and writes it; `updateRiderOnReconnect` takes `guest` in its grant and sets `guest = ?` (R8)
- [X] T016 [US1] In `src/http/auth.ts` `handleCallback`, after the block, scope and consent checks, read `isOnGuestList`; when listed, skip `clubMembership`, `setMembershipChecked` and the "one team" notice, and store with `guest = true`; when not listed, today's flow with `guest = false` (contracts/sign-in-and-removal.md), until T014 passes
- [X] T017 [P] [US1] Write failing tests in `test/integration/guest-roles.test.ts`: a signed-in guest on the list is a rider with `organiser` and `administrator` true while both stored flags are 0; after `DELETE FROM guests`, their next request to `/me` redirects to `/` like a visitor's and the row is still there; `listAlertRecipients` includes a guest with `admin_alerts = 1`, and the usage alert banner (`currentAlertStatement`) shows for them
- [X] T018 [US1] In `src/http/viewer.ts` `readViewer`, return `{ kind: "visitor" }` for a row with `guest = 1` and `on_guest_list = 0` (R4; nothing deleted on the request)
- [X] T019 [US1] `listAlertRecipients` in `src/db/riders.ts` and `currentAlertStatement` in `src/db/usage.ts` read `(administrator = 1 OR guest = 1)`, until T017 passes
- [X] T020 [P] [US2] Write failing tests in `test/integration/guest-own-pages.test.ts`: a signed-in guest with rides in the window sees their own rides, Rynke and personal badges on `/me` and its sections as a rider of the team would (US2 scenario 1); they earn no team badge

**Checkpoint**: a developer on the list reaches the team's organiser and admin views in one sign-in.

---

## Phase 6: User Story 4 – a maintainer manages the guest list (P2)

**Goal**: the list is changed by hand; leaving it ends access and the data (FR-001, FR-004, FR-006, FR-008).

**Independent test**: add and remove an ID locally and sign in before and after; the daily run deletes the row.

- [X] T021 [P] [US4] Write failing tests in `test/integration/guest-daily.test.ts`: `fanOutMembershipChecks` sends no `check-membership` for a guest (FR-006); a guest whose ID left the list gets a `delete-rider` with reason `guest-removed` and `revoke: false`, a listed guest doesn't; the consumer deletes the row and the fake Strava sees no revoke
- [X] T022 [US4] In `src/work/messages.ts`, `DELETE_REASONS` gains `"guest-removed"`; in `src/db/riders.ts`, add `listClubRiderIds(db)` (connected riders with `guest = 0`) and use it in `fanOutMembershipChecks` in `src/work/scheduled.ts`, leaving `listConnectedRiderIds` for its other caller
- [X] T023 [US4] In `src/work/scheduled.ts`, add `sweepRemovedGuests(ctx)` to the daily steps: one `delete-rider` per `listRemovedGuestIds` ID with reason `guest-removed` and `revoke: false`, until T021 passes
- [X] T024 [P] [US4] Write failing tests in `test/integration/admin-riders.test.ts`: the guest appears only in a guest group below the team's riders, marked as a guest, with a remove link; the "others" count leaves guests out; `/admin/riders/<guest id>/remove` deletes and blocks the guest without a revoke; no page names the guest's home team
- [X] T025 [US4] In `src/db/riders.ts`, `readRiderOverview` returns `guests: OverviewRider[]` (same fields, `guest = 1`, ordered by first name) and its `unlisted` count adds `AND guest = 0`; `listedRiderName` also accepts a guest row (R7)
- [X] T026 [US4] In `src/http/admin/riders.ts`, render the guest group with its heading and a guest mark per row (no club-check date); add the keys `admin.riders.guests.heading` and `admin.riders.guest` to all ten catalogs in `src/i18n/messages/`, German first, saying "guest" and never a team, until T024 passes. Also: `admin.remove.explain.guest` and `disconnect.explain.guest` (the grant stays), and `notice.blocked.body` no longer says the access was revoked (R5), in all ten

**Checkpoint**: the whole feature works in outcome A of research R1.

---

## Phase 7: Only if the Strava check gives outcome B (research R1, R10) — skipped: the check gave outcome A

**Gate**: the maintainer runs quickstart §1 and writes the outcome into research R1. Outcome A: skip
this phase. Outcome C: stop and take the spec back to the user.

- [-] T027 [US3] Write failing tests in `test/integration/guest-no-reading.test.ts`: a guest's sign-in stores no credentials and sends no `import-page`; an activity webhook event for a guest is acknowledged and dropped; the re-check never picks a guest; the guest's own pages show the "no rides yet" states
- [-] T028 [US3] In `src/http/auth.ts`, skip `saveCredentials` and the import for a guest; in the consumer, drop work for a rider without credentials; (the re-check already leaves guests out, done in Phase 3 since the admin view's active-rider count is a team count), until T027 passes; then mark T020 as not applicable in this file

---

## Phase 8: Fake mode, documentation and polish

- [X] T029 [P] Add one sample guest to each team's set (`dev/fake-strava/samples.hamburg.ts`, `samples.europe.ts`): not a club member, a fixed synthetic ID, a first name, a few rides in the window; `SampleRider` in `dev/fake-strava/samples.ts` gains `guest?: true`. In `dev/fake-strava/seed.ts`, empty `guests` with the other tables, insert every `guest` sample's ID, and connect guests through the app like members (R13); team figure tests over the sample sets must stay unchanged
- [X] T030 [P] In `docs/how-it-runs.md`, next to "Being an administrator", add the guest list commands from contracts/guest-list.md (add, remove, list, who signed in) and the FR-002 rule: clearing someone's administrator flag at home means removing them from every other team's guest list in the same sitting; a real athlete ID goes only into those commands
- [X] T031 Run the touched test files (quickstart §3) and `pnpm typecheck`; tick each task

---

## Phase 9: Withdrawing a grant unless another team holds the person (FR-009, FR-012, research R14)

**Goal**: no grant left that no team controls, and none withdrawn while another team holds the
person. Contract: [contracts/withdrawal.md](contracts/withdrawal.md).

- [X] T032 Add `migrations/0031_pending_revocations.sql`: `pending_revocations (athlete_id INTEGER PRIMARY KEY, refresh_token_enc TEXT NOT NULL, since INTEGER NOT NULL)`, add only; `resetDb` in `test/support/ctx.ts` empties it
- [X] T033 [P] Fake gateway in `test/support/fake-strava.ts`: answers `POST https://gateway.example.test/teams/<id>/held` from a `held` map (default `none`), can be set down, records the calls; a `withGateway(ctx)` helper points `STRAVA_RETURN_VIA` at it
- [X] T034 Write failing tests in `test/integration/withdrawal.test.ts` (replacing `guest-no-revoke.test.ts`): every refusal at sign-in revokes when nobody holds the person and doesn't when another team holds them (`connected`); `reconnect` and no answer keep a pending row; the daily run settles it once the answer is `none`; a guest's disconnect, removal and `guest-removed` deletion keep the grant while held and withdraw it when not; a rider of the team withdraws on disconnect; without a gateway the answer is `none`
- [X] T035 Write failing tests for `POST /strava/held/<token>` in `test/integration/held.test.ts` (wrong token 404, bad body 400, `connected` / `reconnect` / `none` from the rider row, guests alike) and for the gateway's `POST /teams/<id>/held` in `test/gateway/held.test.ts` (wrong token or unknown team 403, the asking team never asked, strongest answer wins, any team failing 503, no other team `none`)
- [X] T036 `src/db/pending-revocations.ts` (keep a stored or a fresh token, list, drop) and `src/strava/withdraw.ts` (`withdrawGrant`, `withdrawStoredGrant`, `settleWithdrawal`, `settleWithdrawals`, the gateway question); remove `revokeStoredToken`
- [X] T037 Team endpoint `src/http/held.ts`, routed in `src/http/router.ts`
- [X] T038 Gateway endpoint in `gateway/index.ts`
- [X] T039 Callers: every refusal in `src/http/auth.ts` withdraws the exchanged token (in `waitUntil`); `src/http/me.ts`, `src/http/admin/remove.ts` and `src/work/delete-rider.ts` withdraw the stored one; the guest sweep in `src/work/scheduled.ts` sends `revoke: true`, and the daily run settles every pending row
- [X] T040 Update the tests that expected no revoke or the old revoke paths (callback, disconnect, admin-remove, delete-rider, guest-daily) and `docs/how-it-runs.md` (sign-in note, `delete-rider` row, daily step); run the touched files and `pnpm typecheck`

---

## Dependencies

- Phase 2 blocks everything. Phase 3 (counting) before Phase 5 (sign-in), so no guest can ever be
  counted. Phase 4 is independent of Phase 3 and may run beside it.
- US1 (Phase 5) needs Phases 3 and 4. US4 (Phase 6) needs Phase 5's `guest = 1` rows.
- Phase 7 depends only on the outcome of the manual check; Phase 8 after Phase 6.

## Parallel examples

- T005, T010 (different test files) together after Phase 2.
- T014, T017, T020 (three test files) together at the start of Phase 5.
- T021 and T024 together at the start of Phase 6; T029 and T030 together at the end.

## Implementation strategy

MVP: Phases 2–5, which let a listed administrator into another team's site safely. Phase 6 makes
the list's removal and the admin view complete. Before a maintainer puts a real ID on a live guest
list, the manual Strava check (quickstart §1) must say A, or Phase 7 must be in.
