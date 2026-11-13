---
description: "Tasks for the ride edit re-check"
---

# Tasks: Ride Edit Re-check

**Input**: design documents in `specs/036-ride-edit-recheck/`.

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/hourly-run.md,
contracts/queue-message.md, contracts/usage-view.md, contracts/ride-card.md, quickstart.md.

**Tests**: required (constitution Principle V). Write each test first and see it fail.

**Rules**:

- Nothing is built before T001 confirms Strava's list order (plan.md, Delivery).
- A check costs exactly one Strava request and is never retried, re-sent or put in `failed_work`
  (FR-002, FR-017).
- A check that finds no difference writes nothing (FR-007); the comparison comes before
  `applyAndEvaluate`, which writes every record it is given.
- What differs between teams is team data, never a branch in code (feature 026).
- Rider-facing text only in the catalogs, all ten languages, German first.
- Tests never call the real Strava; fixtures are synthetic. `src/` never imports `dev/`.
- One pull request into `develop` carries everything: the card's text and the check ship together.
- The by-hand checks of quickstart.md (fake mode, live site) happen after the release, not as
  tasks here.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: the user story in spec.md.

## Phase 1: Setup

- [ ] T001 Maintainer, by hand: make the one real request of
  `specs/036-ride-edit-recheck/quickstart.md` ("Before building") against their own account and
  note the result in `specs/036-ride-edit-recheck/research.md` under R3 (date, `count`,
  `newest_first`). Expected `newest_first: true` and `count: 200` for an account with at least 200
  activities. Anything else: stop, revisit the plan. Claude never makes this request.

## Phase 2: Foundational (blocks every story)

**Purpose**: the schema, the team's allowance, the message type.

### Tests first

- [ ] T002 [P] Team-data test in `test/teams/recheck-allowance.test.ts`: every team's
  `recheckAllowance` is a positive integer, and the sum over all teams is at most
  `floor(3000 × RECHECK_SHARE)` = 300.
- [ ] T003 [P] Message tests in the existing messages test (find it beside
  `test/integration/consumer.test.ts` or under `test/unit/`): `recheck-rider` parses and
  serializes `{ kind, athleteId, stamp, previous }`; `athleteId` positive integer, `stamp` epoch
  seconds, `previous` epoch seconds or `null`; anything else is refused; `waitsForStrava` is
  `false` for it.

### Implementation

- [ ] T004 Migration `migrations/0028_ride_recheck.sql`, additions only: column
  `riders.rechecked_at` "`INTEGER`, nullable", no index; table `recheck_daily`, `WITHOUT ROWID`,
  with `day` "`TEXT` primary key, `YYYY-MM-DD`" and `sent`, `skipped`, `failed`, `unordered`,
  `over_24h`, `runs_held`, each "`INTEGER NOT NULL DEFAULT 0`" (data-model.md). Update the schema
  the tests apply if it is listed separately.
- [ ] T005 [P] `recheckedAt: number | null` on `Rider` and its row mapping in `src/db/riders.ts`.
- [ ] T006 [P] `RECHECK_SHARE = 0.1` in `src/usage/allowances.ts`; `recheckAllowance` in
  `TeamData` (`src/teams/types.ts`), 150 in `src/teams/hamburg.ts` and `src/teams/europe.ts`
  (makes T002 pass).
- [ ] T007 [P] `scripts/team-check.mjs` refuses a sum of `recheckAllowance` above 300, with a
  message naming the teams and the sum; one line on the field in `docs/add-a-team.md`.
- [ ] T008 `RecheckRiderMessage` with parse and serialize in `src/work/messages.ts`;
  `waitsForStrava` false (makes T003 pass).

**Checkpoint**: `pnpm test -- teams` and the messages test pass; migration applies locally.

---

## Phase 3: User Story 1 - A cropped ride starts counting on its own (P1) 🎯 MVP

**Goal**: a `recheck-rider` message reads the rider's newest 200 activities in one request and
takes over what differs.

**Independent Test**: give the handler a rider whose stored ride differs from the fake Strava's
list; figures, verdict and Rynke follow. Same list again: no row written.

### Tests first

- [ ] T009 [P] [US1] `test/unit/recheck-diff.test.ts` for `src/recheck/diff.ts`: a changed figure
  is a difference; an unstored activity is one; an activity that moved between ride, run and swim
  is one; a listed record lacking a figure the stored one has keeps the stored figure and is no
  difference; the refresh time alone is no difference; a stored activity missing from the list is
  not in the result and not marked for deletion; identical lists give an empty result.
- [ ] T010 [P] [US1] Client test for `listNewestActivities` beside the existing client tests:
  the request is `GET /athlete/activities?page=1&per_page=200` with no `after`, priority
  `background`, and its usage headers are recorded as for any read.
- [ ] T011 [P] [US1] `test/integration/recheck-rider.test.ts`, from "Guarantees to test" in
  `contracts/queue-message.md`, the parts without gates: exactly one Strava request per message;
  an unchanged list writes nothing (assert D1 rows written 0); a cropped ride that now counts gets
  the new figures, counts, Rynke, badges and the notification of a reported change (US1
  scenarios 1, 5); a ride that no longer counts loses its verdict (scenario 2); a lost activity of
  this season is stored and evaluated (scenario 4); an activity before the season start, an
  unkept sport type and a private one without the grant are ignored; a stored activity missing
  from the list stays; a list whose `start_date` increases anywhere stores nothing, adds
  `failed + 1` and `unordered + 1` to `recheck_daily` and puts `rechecked_at` back to `previous`
  when it still equals `stamp`; `429`, transient, forbidden and not found give `failed + 1`, the
  stamp back, the message acked and no row in `failed_work` or the Strava work table; a refused
  token gives `refresh-refused` and leaves the stamp; a message for a rider who is gone or needs
  to reconnect is acked with no request; the same message twice converges, no Rynke twice.
- [ ] T012 [P] [US1] In `test/integration/d1-rows.test.ts`: a check with nothing changed writes
  no row.
- [ ] T013 [P] [US1] In `test/integration/fake-strava.test.ts` (or `dev-fake-strava.test.ts`):
  the fake list without `after` is newest first, at most `per_page`; with `after` it is unchanged
  (oldest first); "change without event" alters a sample ride's figures and sends no event.

### Implementation

- [ ] T014 [P] [US1] `listNewestActivities` in `src/strava/client.ts` (research R3).
- [ ] T015 [P] [US1] Extract the list-to-records conversion and the scope rule (season, kept sport
  types, private only with the grant) from `storeActivityPage` in `src/work/activity-page.ts` into
  an exported function both users call; the import's behaviour and tests stay as they are.
- [ ] T016 [P] [US1] `src/recheck/diff.ts`, pure: given listed records and the stored rides, runs
  and swims, return the records that are new or differ, with stored figures filled in where the
  list lacks them (research R7).
- [ ] T017 [US1] `src/db/recheck.ts`: read a rider's stored rides, runs and swims for the
  comparison; `putBackStamp(athleteId, stamp, previous)` (only while `rechecked_at = stamp`);
  `countOutcome(day, { skipped?, failed?, unordered? })` as an upsert that adds. A failed check
  does both in one batch.
- [ ] T018 [US1] `src/work/recheck-rider.ts`: the handler of `contracts/queue-message.md` steps 1,
  3 to 6 and the outcomes table (gates come in US5); differences go to the same
  evaluate-and-notify call as a reported activity; never returns `budget` or `transient`.
- [ ] T019 [US1] Route `recheck-rider` to the handler in `src/work/consumer.ts`, outside the
  Strava work table and outside the retry and `failed_work` paths.
- [ ] T020 [P] [US1] Fake mode: list without `after` newest first in `dev/fake-strava/api.ts`;
  change a sample ride without an event in `dev/fake-strava/store.ts`; the "change without event"
  form on `/_dev/riders/<id>` in `dev/worker.ts` (research R11).

**Checkpoint**: T009 to T013 pass.

---

## Phase 4: User Story 5 - The check never takes what others need (P1)

**Goal**: the check stands back on a short budget or waiting work, and the usage view shows what
it did.

**Independent Test**: recorded usage above half of the day's reads: handler makes no request.
Lower: it does. The usage view lists the day.

### Tests first

- [ ] T021 [P] [US5] In `test/unit/rate-limit.test.ts`: `halfDayUsed(state, now)` is true only
  above half of the day's read limit, false at exactly half, false with no state or a state from
  an earlier UTC day.
- [ ] T022 [P] [US5] In `test/integration/recheck-rider.test.ts`, one case per gate (rider not
  `connected` or import not `done`; more than half of the day's reads used; the `background`
  budget decision says no; any Strava work waiting): no Strava request, `skipped + 1`, stamp back
  to `previous`, message acked, nothing queued (US5 scenarios 1, 2, 4).
- [ ] T023 [P] [US5] `test/integration/admin-usage-recheck.test.ts` from
  `contracts/usage-view.md`: the allowance line with the active riders; the last 14 days that
  have a row, newest first; "Checks made" = `sent − skipped − failed`; "n runs held" only when
  `runs_held > 0`; "list order" named when `unordered > 0`; a day marked like a warning figure
  when `over_24h > 0` or `unordered > 0`; one line when there is no day; no rider named, no rider
  identifier; same access rule as the view.
- [ ] T024 [P] [US5] In the test that covers the daily prune of usage history: `recheck_daily`
  rows older than 13 months go, newer ones stay.

### Implementation

- [ ] T025 [P] [US5] `halfDayUsed` in `src/strava/rate-limit.ts`.
- [ ] T026 [US5] Step 2 of the handler in `src/work/recheck-rider.ts`: the four gates, outcome
  `skipped` (research R8).
- [ ] T027 [US5] In `src/db/recheck.ts`: read the last 14 days of `recheck_daily`; count the
  team's active riders (shares the condition of T034); prune older than 13 months.
- [ ] T028 [US5] The "Ride re-check" section in `src/http/admin/usage.ts`, labels by that view's
  convention (`contracts/usage-view.md`).
- [ ] T029 [US5] Daily cron in `src/work/scheduled.ts` prunes `recheck_daily` with the usage
  history.

**Checkpoint**: T021 to T024 pass.

---

## Phase 5: User Story 4 - The pace follows the number of riders (P2, needed for the MVP)

**Goal**: the hourly run chooses how many and which active riders to check, stamps them and sends
their messages spread over the hour. Without this phase nothing sends a check in production.

**Independent Test**: simulated days with 5, 12, 50, 100, 140, 300 and 999 active riders give the
checks of the worked examples in `contracts/hourly-run.md`.

### Tests first

- [ ] T030 [P] [US4] `test/unit/recheck-pace.test.ts` for `src/recheck/pace.ts`:
  `baseChecks(hour, 150)` is 6 or 7 and sums to 150 over 24 hours, to `A` for any allowance;
  `runSize` = `min(n, 55, max(base(h), min(overdue, ceil(n / 20))))`, 0 for no riders;
  `chooseRiders` takes longest ago first, never checked before everyone, nobody stamped in the
  last 30 minutes, nobody twice; `spreadDelay(i, n)` = `floor(i × 3300 / n)`, at least 60 apart
  for `n ≤ 55`; simulated days reproduce every row of the worked examples (each rider's interval,
  the day's total, never above 150 up to 140 riders, every rider within 24 hours at 300 and 999);
  a run after skipped runs is no larger than `ceil(n / 20)` beyond its base.
- [ ] T031 [P] [US4] `test/integration/recheck-run.test.ts` from `contracts/hourly-run.md`, with
  D1 and the queue: more than half of the day's reads used → `runs_held + 1`, `over_24h` updated,
  nothing sent, nobody stamped; otherwise the chosen riders have `rechecked_at = now`,
  `recheck_daily.sent` grows by their number, `over_24h = max(over_24h, found)`, and one message
  each carries `stamp`, `previous` and the delay of its place; eligible means `status =
  'connected'`, `import_status = 'done'` and a stored ride, run or swim that started within the
  last 30 days: a rider with only a run in that time is taken, one whose newest activity is 31
  days old is not and doesn't count for the size; `over_24h` counts a rider only when one of
  their activities started between 24 hours and 30 days ago; a second run in the same hour sends
  nothing; no eligible riders: no message, no Strava request; the hourly cron still records usage
  when the run throws and the run still happens when recording throws, and the invocation fails
  either way; a newly connected rider with a finished import and an activity is taken by the next
  run (US4 scenario 4).
- [ ] T032 [P] [US4] In `test/integration/d1-rows.test.ts`: a run of `n` checks in which nothing
  changed writes `n + 1` rows (FR-019).

### Implementation

- [ ] T033 [P] [US4] `src/recheck/pace.ts`, pure: `baseChecks`, `runSize`, `chooseRiders`
  (without the fast lane yet: 20 hours or more first, then the rest), `spreadDelay`.
- [ ] T034 [US4] In `src/db/recheck.ts`: the candidates query (one query: eligible riders with
  `rechecked_at` and whether an activity started between 24 hours and 30 days ago, using the
  indexes `activities_by_rider`, `runs_by_rider`, `swims_by_rider`); the statements that stamp
  the chosen riders and add to `recheck_daily`, for one batch.
- [ ] T035 [US4] `src/work/recheck-run.ts`: steps 1 to 6 of `contracts/hourly-run.md`; allowance
  from team data; stamp and count in one `db.batch()` before sending.
- [ ] T036 [US4] Hourly cron in `src/work/scheduled.ts`: record usage, then the run, each
  shielded from the other's failure, the invocation failing if either did.
- [ ] T037 [US4] `POST /_dev/recheck` and its "run re-check" button on `/_dev/` in
  `dev/worker.ts`: steps 2 to 6 without the hold and without delays; available in the sandboxes
  the way the other scheduled work is triggered there (FR-024).

**Checkpoint**: T030 to T032 pass; in fake mode a changed ride follows after "run re-check".

---

## Phase 6: User Story 3 - Riders who are waiting are checked first (P2)

**Goal**: riders with a recent ride a crop could rescue go ahead of the regular order.

**Independent Test**: two riders, one with a ride from yesterday that is too slow, a run of one
check: the first is checked at every run.

### Tests first

- [ ] T038 [P] [US3] `test/unit/fixable-reasons.test.ts`: every reason code of
  `src/rynke/rides.ts` is either in `FIXABLE_REASONS` or in an explicit not-fixable list in the
  test, so a new code must be sorted; fixable are exactly `pause`, `too_slow`, `too_fast`,
  `climbing_rate`, `overlap`.
- [ ] T039 [P] [US3] In `test/unit/recheck-pace.test.ts`: order is 20 hours or more, then fast
  lane, then the rest; the fast lane takes at most `ceil(size / 2)`, longest ago first, and places
  it doesn't use go to the others (US3 scenario 4); the example of 3 fast-lane riders among 100
  from `contracts/hourly-run.md`.
- [ ] T040 [P] [US3] In `test/integration/recheck-run.test.ts`: the fast-lane flag is set for a
  ride with `counts = 0`, started within 7 days, with at least one fixable reason, also beside a
  reason that isn't fixable; not set when the reasons are only not fixable ones, when the ride is
  8 days old, when it counts or is deleted (US3 scenarios 1 to 3).

### Implementation

- [ ] T041 [P] [US3] `FIXABLE_REASONS` beside the reason codes in `src/rynke/rides.ts`.
- [ ] T042 [US3] The fast-lane flag in the candidates query in `src/db/recheck.ts`, from
  `ride_results` and `FIXABLE_REASONS` (research R6); still one query.
- [ ] T043 [US3] The fast-lane group in `chooseRiders` in `src/recheck/pace.ts`.

**Checkpoint**: T038 to T040 pass.

---

## Phase 7: User Story 2 - The ride card says "just wait" (P1, ships with the check)

**Goal**: "So geht's" tells the rider to crop and wait, at the latest 24 hours, and nothing about
the title.

**Independent Test**: the card of a ride with a fixable reason, in every language.

### Tests first

- [ ] T044 [P] [US2] In `test/unit/catalogs.test.ts`: `rynke.ride.fix.wait_recheck` is required,
  `rynke.ride.fix.rename` is gone from the list and from every catalog.
- [ ] T045 [P] [US2] In `test/integration/all-locales.test.ts` and the ride card's own test: for
  a ride with a fixable reason the steps are `rynke.ride.fix.crop`, then
  `rynke.ride.fix.wait_recheck`; for a manual entry alone they are `rynke.ride.fix.manual`, then
  `rynke.ride.fix.wait`, as today; for both, crop, manual, then `wait_recheck`; in none of the ten
  languages does any `rynke.ride.fix.*` or `rynke.ride.fixHint` entry mention the title (SC-008).

### Implementation

- [ ] T046 [US2] `rynke.ride.fix.wait_recheck` in `src/i18n/messages/de.ts` with the German line
  of `contracts/ride-card.md`; remove `rynke.ride.fix.rename`. `rynke.ride.fix.wait` ("ein paar
  Minuten") stays for manual entries, whose upload and deletion Strava does report.
- [ ] T047 [P] [US2] The same key in `da`, `en`, `fi`, `fr`, `is`, `lt`, `nb`, `nl`, `sv` under
  `src/i18n/messages/`, `rename` removed; English written fresh for a distributed team, with the
  catalog's own word for the organisers.
- [ ] T048 [US2] `fixSteps` in `src/http/rider-sections.ts` (around line 590): the steps of T045.

**Checkpoint**: T044 and T045 pass.

---

## Phase 8: Polish

- [ ] T049 [P] `docs/architecture-and-collaboration.md`: where it describes how the app hears
  from Strava and what shares the limits, name the re-check (hourly, 300 reads a day for all
  teams, stands back above half of the day's reads).
- [ ] T050 [P] `specs/001-strava-connect-webhook/contracts/queue-messages.md`: one line pointing
  to `recheck-rider` in this feature's contract.
- [ ] T051 `pnpm test -- recheck`, `pnpm test -- all-locales`, `pnpm test -- teams`,
  `node scripts/team-check.mjs`, `pnpm lint`, `pnpm typecheck`; the full suites are CI's.
- [ ] T052 Check `test/unit/dev-guard.test.ts` still passes: nothing under `src/` imports the
  fake-mode additions.

---

## Dependencies & Execution Order

- **T001** gates everything.
- **Phase 2** blocks every story. T004 before anything touching D1; T008 before T018, T035.
- **US1** (Phase 3) first: the handler everything else feeds.
- **US5** (Phase 4) needs US1's handler and `src/db/recheck.ts`.
- **US4** (Phase 5) needs Phase 2 and T025; its messages need US1's handler to do anything.
- **US3** (Phase 6) needs US4 (`chooseRiders`, the candidates query).
- **US2** (Phase 7) is independent in code and can be done at any time after T001, but merges
  only together with US1, US4 and US5.
- `src/db/recheck.ts` is touched by T017, T027, T034, T042 and `src/work/recheck-rider.ts` by
  T018, T026: in that order, not in parallel.
- `test/integration/recheck-rider.test.ts` (T011, T022), `recheck-run.test.ts` (T031, T040),
  `recheck-pace.test.ts` (T030, T039) and `d1-rows.test.ts` (T012, T032) grow phase by phase.

### Parallel examples

```text
Phase 2:  T002, T003 together; then T005, T006, T007 together
US1:      T009, T010, T011, T012, T013 together; then T014, T015, T016, T020 together
US5:      T021, T022, T023, T024 together
US4:      T030, T031, T032 together
US2:      T044, T045 together; T047 beside T048
```

## Implementation Strategy

- **MVP = what the one pull request needs**: Phases 1 to 5 and Phase 7. US1 alone is testable but
  sends nothing in production without the run (US4), must not ship without its gates (US5), and
  the card's promise (US2) may only ship with the check.
- **US3** (fast lane) is the only part that could follow in a second pull request; the plan ships
  it in the same one.
- Order of work: T001 → Phase 2 → US1 → US5 → US4 → US3 → US2 → Polish. Each phase's tests are
  red before its implementation and green at its checkpoint.
- After the release: the live checks of quickstart.md, by the maintainer.
