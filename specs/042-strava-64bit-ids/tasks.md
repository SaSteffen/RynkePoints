# Tasks: Strava 64-bit IDs

**Input**: Design documents from `specs/042-strava-64bit-ids/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ids.md

**Tests**: required (constitution Principle V): red first for the ID module and every boundary.

The change of the ID type is cross-cutting: the type checker leads it through every file, so it
is foundational and done before the stories, which then add the boundary behaviour and their
large-ID tests.

## Phase 1: Setup

- [ ] T001 Declare `JSON.rawJSON` and the reviver's `context` argument for TypeScript if the
  configured lib lacks them, in `src/json.d.ts` (or the existing ambient declarations file)

## Phase 2: Foundational

- [ ] T002 Write tests for the ID module in `test/unit/strava-id.test.ts`: `isStravaId` accepts
  `^[1-9][0-9]{0,18}$` "and at most 9223372036854775807" and refuses `0`, leading zeros,
  `9223372036854775808`, numbers, fractions; `toStravaId` also accepts a positive safe-integer
  number; `compareIds` orders `"9"` before `"10"` and `"9007199254740992"` before
  `"9007199254740993"`; `parseStravaJson` keeps exact digits for the named keys and prefers a
  valid `id_str`; `idJson` writes exact digits as a JSON number
- [ ] T003 Implement `src/strava/id.ts` (`isStravaId`, `toStravaId`, `compareIds`,
  `parseStravaJson`, `idJson`, `idsJson`) until T002 passes
- [ ] T004 Add the D1 guard to `test/setup.ts`: any result row (from `first`, `all`, `raw`,
  `batch`) with a number in `athlete_id`, `strava_activity_id`, `overlaps_activity_id`,
  `athleteId` or `activityId` fails the test (research R5)
- [ ] T005 Change every activity and athlete ID in `src/` from `number` to `string`: types,
  parameters, rows; IDs bound as text; every `SELECT` returning an ID column uses
  `CAST(col AS TEXT) AS col`; arrays for `json_each` via `idsJson`; ordering via `compareIds`
  (`src/db/**`, `src/rynke/**`, `src/badges/**`, `src/work/**`, `src/http/**`, `src/strava/**`)
- [ ] T006 Same for `album/` (its D1 reads and render) and `dev/` (fake Strava store, API, events,
  seed, samples, worker)
- [ ] T007 Convert test fixtures and tests to string IDs (`test/support/**`, `test/**`) until
  `pnpm typecheck` and `pnpm test` pass with the D1 guard on

## Phase 3: User Story 1 — A rider with a large ID connects (P1)

**Independent test**: token exchange, session and held exchange with athlete ID
`9223372036854775807`.

- [ ] T008 [P] [US1] Test in `test/unit/tokens.test.ts` (or the existing token exchange test): a
  token answer with a large `athlete.id` (with and without `id_str`) yields the exact ID
- [ ] T009 [US1] Read the token answer with `parseStravaJson` in `src/strava/tokens.ts`
- [ ] T010 [P] [US1] Test in the session tests: a cookie with a large athlete ID round-trips;
  a cookie of the previous version stays valid
- [ ] T011 [US1] Session reads the ID as a string in `src/http/session.ts`
- [ ] T012 [P] [US1] Test the `held` exchange with a large ID on both sides (`test/gateway/**`,
  the held endpoint test): sent as a JSON number with exact digits, read exactly
- [ ] T013 [US1] `src/http/held.ts`, `src/strava/withdraw.ts`, `gateway/index.ts` (`askTeams`,
  `askTeam`) read with `parseStravaJson` and write with `idJson`
- [ ] T014 [US1] An integration test connects, imports and deletes a rider with a large ID
  through the fake Strava (`test/integration/**`)

## Phase 4: User Story 2 — A ride with a large ID (P1)

**Independent test**: webhook, gateway, list and detail answers with activity ID
`9223372036854775807`.

- [ ] T015 [P] [US2] Webhook test: an event with large `object_id` and `owner_id` is queued with
  the exact IDs; a fraction, exponent, negative or 20-digit ID is refused
- [ ] T016 [US2] `src/http/webhook.ts` parses with `parseStravaJson`
- [ ] T017 [P] [US2] Gateway test: an event with large IDs is accepted and forwarded unchanged
- [ ] T018 [US2] `gateway/index.ts` `isStravaEvent` uses `parseStravaJson` and `isStravaId`
- [ ] T019 [P] [US2] Client test: list and detail answers with a large `id`, with and without
  `id_str`, give the exact ID; two IDs that differ beyond 2^53 stay apart
- [ ] T020 [US2] `src/strava/client.ts` reads activity answers with `parseStravaJson` (clubs
  unchanged)
- [ ] T021 [P] [US2] Message test: string IDs round-trip; a message with number IDs (previous
  version) is accepted and converted
- [ ] T022 [US2] `src/work/messages.ts` uses `toStravaId`

## Phase 5: User Story 3 — Organisers see the right rider and ride (P2)

- [ ] T023 [US3] Routes and forms that carry an ID (`src/http/rider-view.ts`,
  `src/http/organiser/**`, `src/http/admin/**`) validate with `isStravaId` instead of `Number`;
  a test opens a ride page and an organiser action with a large ID

## Phase 6: User Story 4 — Everything keeps working (P1)

- [ ] T024 [US4] Fake Strava writes Strava's format (`id` exact number, `id_str`, numbers only in
  events) in `dev/fake-strava/api.ts`, `dev/fake-strava/events.ts`, `dev/fake-strava/tokens.ts`
- [ ] T025 [US4] Give some sample riders of every team and one rider's activities large IDs in
  `dev/fake-strava/samples.*.ts` / `seed.ts`; e2e still pass

## Phase 7: Polish

- [ ] T026 Update docs that state IDs are numbers (contracts of earlier features are history and
  stay); README or `docs/` only where they describe the current format
- [ ] T027 `pnpm lint`, `pnpm typecheck`, targeted tests; open the PR (Refs #354)

## Dependencies

T001 → T003 → T005–T007 → stories. Stories are independent of each other after Phase 2. T024
before T025.
