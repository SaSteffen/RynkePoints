# Tasks: One Team at a Time

**Input**: Design documents from `/specs/044-one-team-at-a-time/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/one-team.md](contracts/one-team.md), [quickstart.md](quickstart.md)

**Tests**: test-first (constitution Principle V): each story's tests are written and fail before
its implementation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: the user story the task belongs to (US1, US2)

## Phase 1: Setup

No setup: no dependency, no migration, no binding.

## Phase 2: Foundational (the team question knows riders from guests)

**Purpose**: the `rider` field every later step reads (research R2), and the stand-in gateway the
tests talk to.

- [X] T001 [P] Extend the stand-in gateway in `test/support/fake-strava.ts`: a `rider` set of athlete IDs answered as `"rider": true` next to `held` on `POST /teams/<id>/held`; a `POST /teams/<id>/let-go` route that records each `athleteId` in `fake.letGo` and answers `200 {"letGo": true}`, or `503` while `fake.letGoFails` is true
- [X] T002 [P] Gateway tests in `test/gateway/held.test.ts`: the answer carries `rider: true` when any other team answered it, `false` otherwise, and an answer without `rider` (or with a non-boolean) counts as `false`
- [X] T003 [P] Team endpoint tests in `test/integration/held.test.ts`: `rider` is true for a rider row with `guest = 0`, false for a guest row and for no row; `held` unchanged
- [X] T004 `riderHold` in `src/db/riders.ts` returns `{ held, rider }` (rider: a row exists with `guest = 0`); `src/http/held.ts` answers `{"held": …, "rider": …}`
- [X] T005 `gateway/index.ts` `askTeams`/`askTeam`: read each team's `rider` (missing or non-boolean → `false`), answer `rider: true` when any other team said so
- [X] T006 `src/strava/withdraw.ts`: `heldElsewhere` becomes exported `askOtherTeams(ctx, athleteId)` returning `{ held, rider } | null` (`rider` missing or non-boolean → `false`; no gateway → `{ held: "none", rider: false }`); `settleWithdrawal` uses `.held` as before

**Checkpoint**: T002, T003 pass; `test/integration/withdrawal.test.ts` passes unchanged.

## Phase 3: User Story 1 — A rider of one team chooses at another (Priority: P1) 🎯 MVP

**Goal**: a new person who rides for another team sees the choice; staying keeps nothing; switching
lets them go there and stores them here.

**Independent Test**: `test/integration/one-team.test.ts` with `withGateway` and the stand-in's
`rider` set (quickstart §1).

### Tests for User Story 1

- [X] T007 [P] [US1] Rewrite `test/integration/one-team.test.ts` for the rule: a new person in `fake.rider` signing in without the switch flag gets `303 /switch-team?next=…`, no `riders` row, no session cookie, no revoke request; with the switch flag the stand-in records a let-go for them, they get a row, a session and an `import-page` message; a person only `held` (not in `rider`) and a person on the guest list are let in without a choice; a person the team already holds is never asked (no `held` request recorded); without a gateway nobody sees the choice
- [X] T008 [P] [US1] Team let-go tests in `test/integration/let-go.test.ts`: `POST /strava/let-go/<token>` deletes a rider row and its activities, keeps a guest row, does nothing without a row, answers `200 {"letGo": true}` each time, adds nothing to `blocked_athletes` or `pending_revocations`, sends no queue message; a wrong token is `404`, a bad body `400`, a GET `405`
- [X] T009 [P] [US1] Gateway let-go tests in `test/gateway/let-go.test.ts` (three teams, as in `held.test.ts`): `200 {"letGo": true}` when every other team answered `200`, `503` when one didn't, the asking team itself is never asked, `403` for an unknown team or wrong bearer, `400` for a bad body, `200` with no other team; logs `let-go team=<id> status=<code>` and never the athlete ID
- [X] T010 [P] [US1] Choice page and connect tests in `test/integration/one-team.test.ts` (and `/switch-team` in `test/support/pages.ts`): `GET /switch-team` shows both buttons; the form posts `consent` (current version) and `switch=1` to `/connect`, no `next`; the page names no team (as `test/teams/no-other-team.test.ts` checks pages); `POST /connect` with `switch=1` redirects to Strava with `approval_prompt=auto` and a state cookie whose switch part is `1`, without it `approval_prompt=force` and `0`
- [X] T011 [P] [US1] State cookie tests in `test/unit/session.test.ts` (or the file that already tests `readOAuthState`): `<state>:<version>:<switch>:<next>` round-trips; the old form `<state>:<version>:<next>` reads as `switch: false`

### Implementation for User Story 1

- [X] T012 [US1] `src/http/session.ts`: `OAuthState` gains `switchTeam: boolean`; `createOAuthStateCookie` writes `<state>:<consentVersion>:switch:<next>` for a switch and the old form otherwise; `readOAuthState` reads the old form as `switchTeam: false`
- [X] T013 [US1] `src/http/auth.ts` `authorizeRedirect` takes `switchTeam`, sets `approval_prompt` to `auto` for it and `force` otherwise, and passes it to the cookie; `handleConnectForm` reads `switch=1` from the form
- [X] T014 [US1] `src/db/riders.ts`: `letGoRider(db, athleteId)` deletes the row only `WHERE athlete_id = ? AND guest = 0`
- [X] T015 [US1] `src/http/held.ts`: `handleLetGo(request, secret, ctx)` as in contracts/one-team.md (token check as `handleHeld`, 405 for non-POST, body as `handleHeld`, calls `letGoRider`, logs nothing about the person); route `POST /strava/let-go/<token>` in `src/http/router.ts` next to `/strava/held/`
- [X] T016 [US1] `gateway/index.ts`: `POST /teams/<teamId>/let-go`, authenticated and validated as `askTeams`, fanned out to every other team's `/strava/let-go/<token>` as `askTeam` does, `200 {"letGo": true}` only when all answered `200`, else `503`; log `let-go team=<id> status=<code>`
- [X] T017 [US1] `src/strava/withdraw.ts`: `letGoElsewhere(ctx, athleteId): Promise<boolean>` posting to `<STRAVA_RETURN_VIA>/teams/<TEAM_ID>/let-go` with the bearer token, 10 s timeout, `true` only for `200` with `letGo: true`; no gateway → `true`
- [X] T018 [US1] `src/http/switch-team.ts` (new): `GET /switch-team` page per contracts/one-team.md, using `layout`, `pageLook`, catalog keys `switchTeam.title`, `switchTeam.body`, `switchTeam.cost`, `switchTeam.switch`, `switchTeam.stay`; route in `src/http/router.ts`
- [X] T019 [US1] `src/http/auth.ts` `handleCallback`: for `!existing && !guest` after the club check, call `askOtherTeams`; `null` → `withdraw()` and `notice("strava-busy")`; `rider` and not `expected.switchTeam` → `withdraw()` and `303` to `/switch-team` clearing the state cookie; `rider` and `expected.switchTeam` → `letGoElsewhere`, `false` → `withdraw()` and `notice("strava-busy")`; otherwise store as today
- [X] T020 [P] [US1] Catalog keys `switchTeam.title`, `switchTeam.body`, `switchTeam.cost`, `switchTeam.switch`, `switchTeam.stay` in all ten `src/i18n/messages/*.ts`, German first; no team name, place or art; "another team on RynkePoints"

**Checkpoint**: T007–T011 pass.

## Phase 4: User Story 2 — Nothing is lost when a step can't be finished (Priority: P1)

**Goal**: every unanswered step leaves the person where they were (research R6); a kept token for a
person the team now holds is never revoked (R5).

**Independent Test**: the stand-in gateway failing `held` or `let-go` (quickstart §1).

### Tests for User Story 2

- [X] T021 [P] [US2] In `test/integration/one-team.test.ts`: team question unanswered (stand-in `503`) → `/notice/strava-busy`, no row, no revoke; let-go failing (`fake.letGoFails`) with the switch flag → `/notice/strava-busy`, no row, no revoke, no session; after a successful let-go, a second sign-in with `fake.rider` emptied is let in without a choice
- [X] T022 [P] [US2] In `test/integration/one-team.test.ts`: a token kept from the first pass (their team holds them only as `reconnect`) is gone once the switch stored them, and nothing is revoked

### Implementation for User Story 2

- [X] T023 [US2] `src/http/auth.ts`: after `insertRider` for a new rider, `forgetPendingRevocation` (new in `src/db/pending-revocations.ts`) drops a kept token of theirs (R5; not in `settleWithdrawal`, which a disconnect calls before deleting the rider)
- [X] T024 [US2] Check `handleCallback`'s branches from T019 against R6's table; no branch stores a row before the let-go is confirmed

**Checkpoint**: T021, T022 pass.

## Phase 5: The old notice goes (FR-010, research R7)

- [X] T025 Remove the `one-team` notice from `src/http/notice.ts` and its redirect from `src/http/auth.ts`; remove `notice.oneTeam.title` and `notice.oneTeam.body` from all ten catalogs
- [X] T026 `src/strava/client.ts`: `clubMembership` loses `otherClubIds` and `other`; callers use `isClubMember` (or the simplified function) in `src/http/auth.ts`
- [X] T027 Remove `otherClubIds` from `src/teams/types.ts`, `src/teams/hamburg.ts`, `src/teams/europe.ts` and its rule from `scripts/team-check.mjs` (field list and the check at the "Every other team's club" comment)
- [X] T028 Remove the `otherClubMember` sample option and the fake other club from `dev/fake-strava/samples.ts`, `samples.europe.ts`, `api.ts`, `seed.ts`
- [X] T029 Update the tests that read what went: `test/integration/guest-sign-in.test.ts`, `test/integration/admin-usage-teams.test.ts`, `test/integration/fake-strava.test.ts`, `test/teams/completeness.test.ts`, `test/unit/catalogs.test.ts`, `test/support/fixtures.ts` (`OTHER_CLUB` if unused)

## Phase 6: Polish & Cross-Cutting

- [X] T030 [P] Privacy notice (R8): one paragraph under "Data needed to run the app" in `src/http/privacy.ts` with key `privacy.technical.oneTeam` in all ten catalogs (a team checks at connect whether the person already rides for another team on RynkePoints; switching deletes their data at the team they leave); `PRIVACY_UPDATED` to the release date; update `test/integration/privacy.test.ts` if it lists the paragraphs
- [X] T031 [P] `docs/how-it-runs.md`: the rule, the choice and the switch in the sign-in diagram and the gateway's endpoints; the let-go endpoint in the endpoint table; a maintainer section on finding a person held by two teams (a read-only `SELECT athlete_id, guest FROM riders` on each team's database, compared by hand) and settling it (ask the person, they disconnect at the team they leave) (R10)
- [X] T032 [P] `docs/add-a-team.md`: remove the `otherClubIds` steps and the one-team notice check; say that the rule needs no team data
- [X] T033 Run the targeted tests from quickstart §1, `node scripts/team-check.mjs`, and the pages snapshot file whole with `-u` if `/switch-team` or the removed notice changes it

## Dependencies & Execution Order

- Phase 2 before everything: T004–T006 change the answer every later task reads.
- US1 (Phase 3) before US2 (Phase 4): US2's tests exercise US1's branches.
- Phase 5 after US1 (T019 replaces the notice's branch); independent of US2.
- Phase 6 after Phase 5.

## Parallel Opportunities

- T001–T003 together; T007–T011 together; T020 alongside T012–T019; T021–T022 together;
  T030–T032 together.

## Implementation Strategy

US1 is the MVP: the rule and the switch. US2 hardens the failure paths and the kept-token case.
Phase 5 removes the old notice; Phase 6 brings the privacy notice and the docs in line. Everything
ships in one release.
