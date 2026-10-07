---
description: "Task list for ride names and links to Strava in the ride list"
---

# Tasks: Ride Names and Links to Strava in the Ride List

**Input**: Design documents from `/specs/008-strava-ride-names/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: REQUIRED (constitution Principle V, spec FR-014). Write each test task
first, run it and confirm it fails, then implement. Riders, rides and names are
synthetic; Strava is mocked.

**Organization**: one phase per user story, in the spec's order. US1 (the link)
needs only the stored activity ID and ships on its own. US2 stores and shows the
name. US3 fills the names of rides stored before, and needs US2's column and
mapping.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 (open a ride on Strava), US2 (recognise a ride by its name),
  US3 (names for rides imported before)

## Phase 1: Setup

- [X] T001 In the worktree, run `pnpm install`, then `pnpm lint`, `pnpm typecheck`
  and `pnpm test`. All pass before any change, so later failures are this
  feature's.

---

## Phase 2: Foundational

None. US1 needs no new data, and US2 owns the column and mapping that US3 reuses.

---

## Phase 3: User Story 1 - Open a ride on Strava from the list (Priority: P1) 🎯 MVP

**Goal**: every ride in the table, on every page, has a "View on Strava" link to
`https://www.strava.com/activities/<id>` ([contracts/rider-page.md](contracts/rider-page.md)).

**Independent test**: T002–T004 and T008 pass.

### Tests for User Story 1

- [X] T002 [P] [US1] In `test/unit/catalogs.test.ts` (failing): add
  `"brand.viewOnStrava"` to `CONTRACT_IDS` after `"brand.poweredByStrava.alt"`,
  and add a case asserting that every catalog in `catalogs` has
  `"brand.viewOnStrava"` equal to exactly `"View on Strava"` (FR-009, FR-012).
- [X] T003 [P] [US1] In `test/unit/rider-sections.test.ts` (failing):
  - Turn the inline row in `rendered()` into a `line(overrides: Partial<RideLine>)`
    helper, so cases can vary the status and ID.
  - New `describe("renderRides link to Strava")`, for each status
    `"being-evaluated"`, `"counts"` and `"does-not-count"` with `activityId:
    8000001`: the output contains
    `<tr class="ride-details"><td colspan="5"><p class="ride-strava"><a class="tap strava-activity" href="https://www.strava.com/activities/8000001">View on Strava</a></p>`.
  - The `a.strava-activity` tag has no `target` and no `rel` attribute.
  - With `createI18n("de", CATALOGS)` the link text is also `View on Strava`.
- [X] T004 [P] [US1] In `test/integration/me-rynke.test.ts`, `describe("GET /me
  paging (US5)")` (failing): after `seedRides(ATHLETE_A, 45, "2026-10-06")`, for
  `/me?page=1` and `/me?page=3`, collect the `href`s of every
  `a.strava-activity`. There is exactly one per `tr.ride-details`, each is
  `https://www.strava.com/activities/<id>` of a ride seeded for that page, and no
  ID repeats. Fetch page 1 once more with `acceptLanguage: "en"`: the link text
  is `View on Strava` in both (SC-001, FR-011).
  - A separate case: `seedRide(ATHLETE_A, { id: 8_900_201, is_private: 1 })`, and
    `/me` has an `a.strava-activity` with
    `href="https://www.strava.com/activities/8900201"` (FR-011, Story 1
    scenario 3).

### Implementation for User Story 1

- [X] T005 [P] [US1] Add `"brand.viewOnStrava": "View on Strava"` after
  `"brand.poweredByStrava.alt"` in `src/i18n/messages/de.ts` and
  `src/i18n/messages/en.ts`. In `de.ts`, a one-line comment: Strava's Brand
  Guidelines §3 fix this text in every language (008 FR-009). T002 passes.
- [X] T006 [US1] In `src/http/rider-sections.ts`, `rideRows()`: import
  `STRAVA_ORIGIN` from `../strava/result`, and start the detail cell with
  `html\`<p class="ride-strava"><a class="tap strava-activity" href="${STRAVA_ORIGIN}/activities/${ride.activityId}">${i18n.t("brand.viewOnStrava")}</a></p>\``,
  before the sport. No `target`, no `rel` (research R4). T003 and T004 pass.
- [X] T007 [P] [US1] In `src/http/html.ts`, after the
  `tr.ride-details ul,tr.ride-details p{…}` rule, add
  `tr.ride-details p.ride-strava{margin:0}` and
  `a.strava-activity{font-weight:700;text-decoration:underline}` (research R5).
  The selector needs `tr.ride-details` to beat the existing
  `tr.ride-details p` margin; change the first CSS line in
  `specs/008-strava-ride-names/contracts/rider-page.md` to match.
- [X] T008 [US1] In `test/integration/dev-fake-strava.test.ts`, new
  `describe("links to Strava (008 research R9)")` (failing): connect a sample
  rider and drain the queue, then `get("/me", <session>)`:
  - the HTML contains no `https://www.strava.com/activities/`;
  - every `a.strava-activity` has `href="/_dev/strava/activities/<id>"` with an
    ID of that rider's fake rides;
  - `get("/_dev/strava/activities/<id>")` answers 200 and shows that fake ride's
    `name`, and an unknown ID answers 404.
- [X] T009 [US1] Implement the dev rewrite (research R9), in `dev/` only:
  - `dev/fake-strava/pages.ts`: `activityPage(activity: FakeActivity)` via the
    file's `page()`. It lists the name, sport type, local start, distance,
    elevation gain, moving and elapsed time, private and manual, with a link
    back to `/me`, and a heading saying it stands in for the Strava page.
  - `dev/worker.ts`: constants
    `ACTIVITY_URL = \`${STRAVA_ORIGIN}/activities/\`` and
    `ACTIVITY_STAND_IN = "/_dev/strava/activities/"`. A
    `rewriteActivityLinks(response)` that passes non-HTML responses through and
    otherwise runs `new HTMLRewriter().on("a.strava-activity", …)`, replacing
    the `ACTIVITY_URL` prefix of `href` with `ACTIVITY_STAND_IN`. `devFetch`
    returns `rewriteActivityLinks(rewriteAuthorize(await handleFetch(…)))`.
  - `devRoute`: before the `switch`, `GET` paths matching
    `^/_dev/strava/activities/(\d+)$` answer `activityPage` for the store's
    `getActivity(ctx.env.DB, id)`, passing the stored row's `body` (the
    `FakeActivity`), or `text("Not Found", 404)` when it returns `null`.
  - `test/unit/dev-guard.test.ts` stays green. T008 passes.

**Checkpoint**: every ride links to Strava, and `pnpm dev` links to the stand-in
page. US1 alone is releasable.

---

## Phase 4: User Story 2 - Recognise each ride by its Strava name (Priority: P1)

**Goal**: the name is stored with every ride read, renamed on a title-only update,
shown only in the rider's own detail row, and named in the consent text
([data-model.md](data-model.md), [contracts/](contracts/)).

**Independent test**: T010–T019 pass; `ride-name-visibility.test.ts` finds the
name on no page but the owner's `/me`.

### Tests for User Story 2

- [X] T010 [P] [US2] In `test/unit/activity.test.ts` (failing): `toActivityRecord`
  keeps `name: " Rund um den Sorpesee <3 🚴 "` exactly, untrimmed. A missing
  `name`, `""`, `"   "` and `"\t\n"` all give `name: null` (FR-001, FR-005).
- [X] T011 [P] [US2] In `test/integration/db.test.ts` (failing): `upsertActivity`
  with `name: "Synthetic loop"` stores it; a second upsert of the same ID with
  `name: "Synthetic loop renamed"` replaces it; a third with `name: null` clears
  it. Read back with `SELECT name FROM activities WHERE strava_activity_id = ?`.
- [X] T012 [P] [US2] In `test/integration/schema-minimisation.test.ts`
  (failing): add `"name"` to `COLUMNS.activities`. Replace the `first_name` skip
  with a `DOCUMENTED = new Set(["riders.first_name", "activities.name"])`
  checked as `${table}.${column}`, and update the comment: `activities.name` is
  008's documented exception (research R1).
- [X] T013 [P] [US2] In `test/integration/activity-event.test.ts` (failing):
  replace "ignores a title-only update without calling Strava" with "refetches a
  title-only update and stores the new name (FR-004)". A stored, evaluated ride
  and a mocked `GET /activities/{id}` that returns the same figures with
  `name: "Synthetic renamed"`. After `deliver(msg(A, "update", ["title"]))`:
  exactly one Strava request; `activities.name` is the new name; the ride's
  `ride_results` `counts`, `reasons`, `distance_rynke` and `elevation_dm`, and
  the balance's `distance_rynke`, `elevation_rynke`, `training_rynke` and
  `team_rynke`, equal their values before (SC-004).
- [X] T014 [P] [US2] In `test/unit/rider-view.test.ts` (failing): a `RideRow`
  with `name: "Synthetic loop"` gives a `RideLine` with that name, and
  `name: null` gives `null`.
- [X] T015 [P] [US2] In `test/unit/rider-sections.test.ts` (failing), using T003's
  `line()`:
  - `name: "Loop <b> & 🚴"` renders
    `<p class="ride-strava"><span class="ride-name">Loop &lt;b&gt; &amp; 🚴</span> <a class="tap strava-activity"`.
    The raw `<b>` appears nowhere (FR-010).
  - `name: null` renders no `ride-name` at all and no placeholder: the paragraph
    starts with the `<a` (FR-005).
- [X] T016 [P] [US2] In `test/integration/landing.test.ts` (failing):
  - "names the ride name among the data read (FR-007)": the German landing page
    contains `nur Namen, Sportart` and `Deine einzelnen Fahrten und ihre Namen`,
    and the English one contains `only read name, sport type` and
    `your individual rides or their names` (wording in
    [contracts/messages.md](contracts/messages.md)).
  - `CONSENT_VERSION` is still `1`.
  - A connected rider's `/me` shows the German `landing.dataRead` text inside the
    consent section, before `consent.organisers` (research R6).
- [X] T017 [P] [US2] In `test/integration/rynke-deletion.test.ts` "delete-rider
  removes every result and the balance" and in `test/integration/delete-rider.test.ts`
  "deletes every row of the rider without calling Strava" (failing until
  T020–T022): seed the rides with names and assert
  `SELECT count(*) FROM activities WHERE name IS NOT NULL` is 0 afterwards
  (FR-003, SC-006).
- [X] T018 [US2] Synthetic names in the shared page fixtures, plus the copy guard:
  - `test/support/rynke.ts` `activityRecord()`: default `name: null`.
  - `test/support/pages.ts` `seedPageRiders`: give each `seedRide(ATHLETE_A, …)`
    a name, one of them `"Synthetic <loop> & 🚴"`, and ATHLETE_C's ride
    `"Synthetic ride of C"`.
  - `test/integration/no-hardcoded-copy.test.ts` `unmarkedText`: drop
    `<span class="ride-name">…</span>` like `<style>`, with a comment: ride names
    are rider data, not copy (research R8).
- [X] T019 [US2] New `test/integration/ride-name-visibility.test.ts` (failing until
  T024): after `resetDb()` and `seedPageRiders(ctx)`, fetch every entry of
  `RIDER_PAGES` except the two riders' own pages, plus `POST /admin/run-daily`
  with the test bearer token. None contains ATHLETE_A's names or ATHLETE_C's.
  The owners' pages:
  - `"/me connected"` (ATHLETE_A) contains A's names and not C's;
  - `"/me not worked out"` (ATHLETE_C, whose ride table is shown before the
    Rynke are worked out) contains C's name and none of A's.
  (FR-008, SC-005.)

### Implementation for User Story 2

- [X] T020 [US2] Add `migrations/0007_activity_name.sql`, word for word as in
  [data-model.md](data-model.md) (`ALTER TABLE activities ADD COLUMN name TEXT;`,
  nullable, no default, with its header comment).
- [X] T021 [US2] In `src/strava/activity.ts`:
  - Header comment: the allow-list now includes the ride's name (008 FR-001);
    drop "titles" from what never reaches storage.
  - `StravaActivity`: `name?: string`.
  - `ActivityRecord`: `name: string | null`, doc comment
    `` `null` = unknown: not read yet, or empty or blank on Strava (008 FR-005). ``
  - `toActivityRecord`: `name: rideName(activity.name)`. Next to `flag()`, add
    `rideName(value: string | undefined): string | null`, returning `null` when
    `value` is `undefined` or `value.trim() === ""`, otherwise `value`
    unchanged, with a comment that nothing is trimmed (research R1).
  - Export `type ActivityRow = Omit<ActivityRecord, "name">`, documented as what
    every reader except the rider's own ride table gets (research R7).
  T010 passes.
- [X] T022 [US2] In `src/db/activities.ts`:
  - `upsertActivityStatement`: add `name` to the column list as `?16`, to the
    `DO UPDATE SET` as `name = ?16`, and bind `a.name` last.
  - `COLUMNS` stays without `name`, with a one-line comment why (research R7).
  - `listRecentActivities` returns `ActivityRow[]`. In `src/rynke/apply.ts`, the
    map of rows read via `COLUMNS` and its cast use `ActivityRow`, and
    `rideFromRow` in `src/rynke/rides.ts` takes `ActivityRow`.
  - Fix any other `ActivityRecord` literal `pnpm typecheck` flags in `test/`
    with `name: null`.
  T011, T012 and T017 pass.
- [X] T023 [US2] In `src/work/activity-event.ts`, remove the title-only early
  return and its comment, so a title-only update takes the normal fetch path
  (research R2). T013 passes.
- [X] T024 [US2] Read and render the name:
  - `src/db/rider-view.ts`: `RIDE_PAGE_SQL` selects `a.name` after
    `a.elevation_gain_m`; `RidePageRow` and `RideRow` get `name: string | null`
    (doc comment as in T021); `toRideRow` copies it.
  - `src/http/rider-view.ts`: `RideLine.name: string | null` after
    `activityId`; `rideLine()` copies `ride.name`.
  - `src/http/rider-sections.ts`, `rideRows()`: inside `p.ride-strava`, before
    the link, `${ride.name === null ? null : html\`<span class="ride-name">${ride.name}</span> \`}`.
  - `src/http/html.ts`: `.ride-name{overflow-wrap:anywhere;color:#333}` next to
    T007's rules (SC-007).
  - Add `name: null` to every `RideRow` or `RideLine` literal in
    `test/unit/rider-view.test.ts` and `test/unit/rider-sections.test.ts` that
    `pnpm typecheck` flags.
  T014, T015, T018 and T019 pass.
- [X] T025 [US2] Consent text (FR-007, [contracts/messages.md](contracts/messages.md)):
  - `src/i18n/messages/de.ts` and `en.ts`: change `landing.dataRead` and
    `landing.purpose` to the contract's wording, word for word.
  - `src/consent.ts`: add one sentence to the comment: 008 named the ride name
    without raising the version, because it was already in every response
    read, needs no new scope and is shown only to the rider (008 FR-007,
    clarification Q1).
  - `src/http/me.ts`, `consent()`: after the `me.consent.accepted` paragraph,
    add `<p>${i18n.t("landing.dataRead")}</p>`, before `consent.organisers`.
  T016 passes.
- [X] T026 [US2] Renames in the fake Strava, test first in
  `test/integration/dev-fake-strava.test.ts` (failing): a `POST /_dev/events`
  with `action=update`, a sample ride's `activityId` and only `name=Synthetic
  renamed` sends a webhook whose `updates` is exactly `{ "title": "Synthetic
  renamed" }`. After `drain()`, the rider's `/me` shows the new name. Then:
  - `dev/fake-strava/pages.ts`, "Change a ride" form: add
    `<label>Name <input name="name" size="20"></label>` before the date.
  - `dev/fake-strava/events.ts`: in `updated()`, a non-empty `field(form,
    "name")` sets `next.name`. In `updatesFor()`, a changed `name` sets
    `updates.title`.

**Checkpoint**: new and renamed rides show their names only on the owner's `/me`;
older rides show the link without a name.

---

## Phase 5: User Story 3 - Names for rides imported before (Priority: P2)

**Goal**: the daily cron's one-time re-read gives stored rides their names, with
list requests only ([contracts/activity-processing.md](contracts/activity-processing.md)).

**Independent test**: T027–T029 pass.

### Tests for User Story 3

- [X] T027 [P] [US3] In `test/unit/activity.test.ts` (failing): change
  `expect(ACTIVITY_FIGURES_VERSION).toBe(2)` to `toBe(3)`.
- [X] T028 [P] [US3] In `test/integration/reread-page.test.ts` (failing), next to
  "fills Strava's flag on rows stored before 0003":
  - "fills the names of rows stored before 0007 from the list (FR-006)": evaluated
    rows with every figure and `name: null`, and a rider at `figures_version` 2.
    The list mock returns the same rides with names. After the re-read, each row
    has its name, no `GET /activities/{id}` was requested, and the rider's
    `ride_results` and balance Rynke are unchanged (SC-003, Story 3 scenario 3).
  - "never refetches a ride for its name": a listed ride with all figures and
    `name: "   "` stays `NULL` and gets no `GET /activities/{id}`.
- [X] T029 [P] [US3] In `test/integration/scheduled-reread.test.ts` (failing):
  "re-reads a rider at version 2 for ride names, once", mirroring "re-reads a
  rider at version 1 for Strava's flag".

### Implementation for User Story 3

- [X] T030 [US3] In `src/strava/activity.ts`: `ACTIVITY_FIGURES_VERSION = 3`. The
  doc comment says "field set" for "figure" and adds "version 3 the ride's name
  (feature 008)". In `src/db/activities.ts`, add a comment on
  `listActivityIdsMissingFigures`: the name is not a figure, so a missing one
  never costs a request (008 research R3). T027–T029 pass.

**Checkpoint**: riders stored before the release get their season's names at the
next daily run.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T031 [P] `README.md`, list of stored data: add the ride name (only the rider
  sees it) and drop "titles" from what is not stored (research R10).
- [X] T032 [P] `specs/001-strava-connect-webhook/data-model.md`: add the `name`
  row to `activities`, pointing to `specs/008-strava-ride-names/data-model.md`.
  `specs/005-rider-view/contracts/rider-page.md`, `section#rides`: one line that
  008's [contracts/rider-page.md](contracts/rider-page.md) adds the name and the
  link to the detail row.
- [X] T033 Run `pnpm lint`, `pnpm typecheck` and `pnpm test`. All pass.

---

## Dependencies & Execution Order

- T001 → US1 (T002–T009) → US2 (T010–T026) → US3 (T027–T030) → T031–T033.
- Within US1: T002–T004 → T005–T007; T008 → T009 (T009 needs T006's link).
- Within US2: T010–T019 are written first. T020 → T021 → T022 → T023, T024 →
  T025; T026 after T024.
- US3 needs T020–T022 (the column, mapping and upsert). T030 is a single
  constant and comment change.
- T031 and T032 can be done at any time.

## Parallel Example

```text
US1 tests:    T002, T003, T004 together; then T005 and T007 alongside T006.
US2 tests:    T010–T017 together (different files); T018 and T019 after them.
US3 tests:    T027, T028, T029 together.
Docs:         T031, T032 alongside any phase.
```

## Implementation Strategy

There is one PR (plan "Delivery"), built in story order. After Phase 3 the link
alone is releasable. After Phase 4 new and renamed rides are named. Phase 5 fills
the rest at the next daily run. The SC-002 check covers season rides: a ride
stored before the season start gets its name with its next update, not through
an extra request (research R3).

The `pnpm dev` walk-through in [quickstart.md](quickstart.md) §2 and the checks
on the live site after release are manual and get no task.
