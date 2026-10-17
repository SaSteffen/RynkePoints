---
description: "Task list for riders reporting team-event participation"
---

# Tasks: Riders Report Team-Event Participation

**Input**: Design documents from `/specs/019-event-participation-requests/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Status**: T001–T039 and T041–T043 done; T001 and T043 ran in CI, since this
session couldn't reach the package registry. T040 is left for later (research
R8); T044 is the owner's walk-through.

**Tests**: REQUIRED (constitution Principle V). Write each test task first, run it
and confirm it fails, then implement. Riders and events are synthetic; nothing
contacts Strava.

**Organization**: one phase per user story of the spec, in the spec's order:
US1–US5 are P1, US6 and US7 P2. US1–US3 build the rider's Termine tab, US4–US6
the organiser pages, US7 the Team page; US2–US6 need the foundation (the table
and the report state), US7 needs nothing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 (Termine tab), US2 (Bin dabei), US3 (Ich war dabei), US4
  (organiser signals and quick decisions), US5 (tri-state boxes), US6 ("Ich war
  auch dabei"), US7 (leaner Team page)

## Phase 1: Setup

- [x] T001 Run `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck` and
  `pnpm test` on the branch before any change (or, where the package registry
  can't be reached, confirm the branch's CI checks are green). Later failures are
  then this feature's.

---

## Phase 2: Foundational (blocks US2–US6)

**Purpose**: the table, the pure report state, the reads and writes, and the rule
that recording attendance clears a report.

### Tests (write first, confirm they fail)

- [x] T002 [P] `test/unit/participation.test.ts` for `src/rynke/participation.ts`
  (data-model.md "Derived state"): `hasTakenPlace(date, today)` is true on and
  after the date; `reportState({ date, today, attended, reported })` returns
  `join` (upcoming, no report), `intent` (upcoming, report), `report` (taken
  place, no report, no attendance), `request` (taken place, report, no
  attendance) and `attended` (attendance, with or without report); an event
  moved from past to future turns `request` into `intent`.
- [x] T003 [P] `test/integration/participation-store.test.ts`: migration `0017`
  creates `participation_reports` with primary key `(event_id, athlete_id)`;
  `insertReportStatement` twice keeps one row ("insert or ignore");
  deleting the event or the rider deletes its reports (`ON DELETE CASCADE`);
  `openRequestCountStatement` counts only reports at events dated on or before
  today inside the counting window, of listed riders (004 FR-021), without
  attendance; `listOpenRequestsStatement` returns event, kind, date, rider id,
  first name and `reported_at`, newest event first, then by first name;
  `countIntentsStatement` counts reports at events after today per event;
  `listRiderEventsStatement` returns the counting window's events with the
  viewer's `attended` and `reported` flags.
- [x] T004 [P] Extend `test/integration/team-events-apply.test.ts`:
  `add-attendance` deletes the reports of every rider in the change at that event
  in the same batch, also of a rider already attending; `remove-attendance`
  recreates none; deleting the event deletes its reports.
- [x] T005 [P] Extend the visibility unit test (`test/unit/visibility.test.ts`):
  `participationReports` is seen by `self` and `organiser` only.

### Implementation

- [x] T006 `migrations/0017_participation_reports.sql` exactly as data-model.md:
  `event_id INTEGER NOT NULL REFERENCES team_events (event_id) ON DELETE CASCADE`,
  `athlete_id INTEGER NOT NULL REFERENCES riders (athlete_id) ON DELETE CASCADE`,
  `reported_at INTEGER NOT NULL`, `PRIMARY KEY (event_id, athlete_id)`, index
  `participation_reports_by_rider`; header comment says it only adds a table.
  Add the table to `test/integration/schema-minimisation.test.ts` if it lists
  tables.
- [x] T007 [P] `src/rynke/participation.ts`: `ReportState`, `reportState`, and
  `hasTakenPlace` in `src/rynke/team-events.ts`; `isFutureEvent` in
  `src/http/organiser/attendance.ts` becomes `!hasTakenPlace` (research R2).
- [x] T008 `src/db/participation.ts`: the shared open-request SQL fragment
  (research R7) and the statements of data-model.md "Reads" and "Writes"
  (`insertReportStatement` with `INSERT OR IGNORE` and an explicit
  `reported_at`, `deleteReportStatement`, `deleteReportsStatement`), each
  filtered by 014's `LISTED_RIDER_IDS` and the counting window.
- [x] T009 `src/rynke/apply.ts`: `add-attendance` pushes
  `deleteReportsStatement(db, eventId, change.athleteIds)` into its writes,
  whether or not anyone was newly added (research R3).
- [x] T010 [P] `src/visibility.ts`: `participationReports: ORGANISER_ONLY`,
  `SINCE_VERSION` `SHARING_SINCE_VERSION` (research R11).

**Checkpoint**: T002–T005 pass.

---

## Phase 3: User Story 1 - Rider sees the season's team events (Priority: P1)

**Goal**: riders who aren't organisers get a Termine tab listing the counting
window's events with their amounts and the Spond/Strava note.

**Independent Test**: as a synthetic rider, open `/events`; as an organiser, see
Orga and no Termine ([quickstart.md](quickstart.md) §2.1–2).

- [x] T011 [P] [US1] `test/integration/rider-events.test.ts` (GET part): a rider
  sees the note (`events.note.title`, `events.note.body`), "Demnächst" with the
  "Bin dabei" hint only when upcoming events exist, else
  `events.upcoming.none`; upcoming events soonest first and past newest first,
  each with kind, name, `+n Team` and `+n Training` (003 FR-007); five past
  events and "Alle zeigen", all with `?past=all`; events outside the counting
  window absent; no Rynke sums; an organiser gets `302 /organiser`; a visitor
  `302 /`; the page shows nothing of other riders (FR-010).
- [x] T012 [P] [US1] Extend `test/integration/sections.test.ts`: a rider's
  navigation has Team, Du, Fahrten, Abzeichen, Termine, Einstellungen; an
  organiser's has Orga in Termine's place.
- [x] T013 [US1] `src/http/shell.ts`: section `events` (`/events`, `nav.events`,
  `CALENDAR`, `riderOnly: true`) after Badges; links filter `riderOnly` for
  organisers like `organiserOnly` for riders (research R8).
- [x] T014 [US1] `src/http/sections/events.ts`: `handleEvents` rendering
  contracts/pages.md "`/events`" from `listRiderEventsStatement` and
  `reportState`, cards with `id="event-{id}"`; route `GET /events` in
  `src/http/router.ts`.
- [x] T015 [P] [US1] Catalog keys of contracts/messages.md "Navigation and
  tour" (`nav.events`) and "Termine tab" in `src/i18n/messages/de.ts` and
  `en.ts`.
- [x] T016 [P] [US1] `src/http/style.ts`: event cards (date block, chips with
  mini coins, note), at 360 px without sideways scrolling, light and dark.

**Checkpoint**: T011–T012 pass.

---

## Phase 4: User Story 2 - "Bin dabei" and "Doch nicht dabei" (Priority: P1)

**Goal**: riders mark and withdraw an intent for an upcoming event.

**Independent Test**: [quickstart.md](quickstart.md) §2.2.

- [x] T017 [P] [US2] `test/integration/rider-events.test.ts` (POST part, rows of
  contracts/http-routes.md): `POST /events/{id}/report` stores a report and
  redirects to `/events#event-{id}`; twice keeps one; an
  organiser gets `403`; an unknown or out-of-window event `?error=event_missing`;
  a rider with attendance `?error=already_attending`;
  `POST /events/{id}/report/delete` before the event deletes it
  (no notice), after it refuses (`?error=event_over`); a cross-origin
  post is refused; the page then shows the green button with both labels
  (`events.joined`, `events.leave`) and `aria-pressed="true"`; balances, badges
  and the leaderboard are unchanged (FR-008, SC-003).
- [x] T018 [US2] `src/http/sections/events.ts`: `handleReport` and
  `handleWithdraw` with the checks of research R13 (same origin, signed in,
  current consent, listed, not an organiser, in the counting window, no
  attendance; withdraw only before the event); routes in `src/http/router.ts`;
  notices `events.done.*` and `events.error.*`.
- [x] T019 [P] [US2] `src/http/style.ts`: the yellow, green and red button
  states; `.leave` shown and the button red on `:hover` and `:focus-visible`
  only (research R6); 44 px tall.

**Checkpoint**: T017 passes.

---

## Phase 5: User Story 3 - "Ich war dabei" (Priority: P1)

**Goal**: riders report attendance at a past event; it stays until an organiser
decides.

**Independent Test**: [quickstart.md](quickstart.md) §2.3 and §2.8.

- [x] T020 [P] [US3] `test/integration/rider-events.test.ts`: a past event
  without report shows "Ich war dabei" as a form; after the post it shows the
  green locked label (`aria-disabled="true"`, no form); an intent from before
  the event shows the same after the date; after a confirmation "Du warst
  dabei" and no button; after a denial the default button again; the page never
  says pending, confirmed or denied (FR-009).
- [x] T021 [US3] `src/http/sections/events.ts`: the past cards' three states
  (contracts/pages.md "`/events`" item 5).

**Checkpoint**: T020 passes; US1–US3 are the rider's whole side.

---

## Phase 6: User Story 4 - Organisers notice and settle requests (Priority: P1)

**Goal**: counts on Orga and Termine, the grouped open requests with quick
decisions and undo, chips on the event list, and the overview's tile and lines.

**Independent Test**: [quickstart.md](quickstart.md) §2.4 and §2.7.

- [x] T022 [P] [US4] `test/unit/request-undo.test.ts`: the undo token of
  data-model.md round-trips decision, event, riders and `reported_at`; fails
  after 10 minutes, with another context, or tampered.
- [x] T023 [P] [US4] `test/integration/organiser-requests.test.ts`:
  - counts: an organiser's navigation shows the open-request count on Orga
    (`9+` above 9) and its accessible name; nothing at 0; intents don't count; a
    rider's navigation shows none;
  - `/organiser`: the open-request block grouped by event, newest first, first
    names, "Auf Strava ansehen" on clashing names, "Alle n eintragen" only with
    several; past events with `⏳ n offen`, upcoming ones with `n zugesagt`;
  - `POST /organiser/requests` confirm: attendance recorded with the organiser
    as `by`, the report gone, balance follows, redirect to `back` with
    `done=confirmed&undo=…` naming the riders; deny: the report gone, nothing
    recorded; a settled request: `?error=request_settled`; an upcoming event:
    `?error=future_event`; a rider: `403`;
  - `POST /organiser/requests/undo`: restores reports with their old
    `reported_at` and removes the attendance a confirm added; an expired token
    `?error=undo_expired`;
  - `back` other than `/organiser` or `/organiser/riders?group=…` falls back to
    `/organiser`.
- [x] T024 [P] [US4] Extend `test/integration/organiser-overview.test.ts`: the
  tile "Rider mit offener Meldung" counts riders and links to `?group=requests`;
  that group shows only them; with all riders shown they come first; a rider
  with three open requests shows three lines, each with its own forms.
- [x] T025 [US4] `src/http/organiser/requests.ts`: undo token
  (`signValue`/`verifySignedValue`, context `request-undo`, 10 minutes, key as
  the session's), `handleDecideRequests`, `handleUndoRequests`, the
  open-request block for `/organiser`, the per-rider lines for the overview;
  routes in `src/http/router.ts`; new codes in `src/http/organiser/access.ts`,
  whose notice renders names and the undo form for `confirmed`/`denied`.
- [x] T026 [US4] `src/http/shell.ts`: for organisers add
  `openRequestCountStatement` to the shell's read and render the count on Orga;
  `organiserSwitch` in `src/http/organiser/access.ts` takes the count for Termine.
- [x] T027 [US4] `src/http/organiser/events.ts`: the open-request block above
  the list; `n offen` and `n zugesagt` chips.
- [x] T028 [US4] `src/http/organiser/overview.ts`: group `requests` in
  `GROUPS`/`parseGroup`, its tile first with the alert style while above 0,
  requested riders first, a "Meldung" column in the table and a block in each
  card.
- [x] T029 [P] [US4] Catalog keys of contracts/messages.md "Orga › Termine" and
  "Overview"; styles for the block, chips, tile and count badge in
  `src/http/style.ts`.

**Checkpoint**: T022–T024 pass.

---

## Phase 7: User Story 5 - Tri-state boxes (Priority: P1)

**Goal**: the event page shows reports as grey boxes with a legend; saving
confirms, denies or leaves them open.

**Independent Test**: [quickstart.md](quickstart.md) §2.6.

- [x] T030 [P] [US5] Extend `test/integration/organiser-attendance.test.ts`: a
  past event lists requested riders first, each with `shown={id}:r` and the
  three `decide-{id}` radios (`open` checked), the legend and the hint; posting
  `yes`, `no`, `open` for three riders records one attendance, deletes one
  report, keeps one, and the notice says 1, 1, 1; a `decide-*` for a rider whose
  report is gone changes nothing; ticks and unticks of others still work as in
  014; an upcoming event shows reports as disabled grey boxes tagged
  "zugesagt" and no form.
- [x] T031 [US5] `src/http/organiser/attendance.ts`: read the event's reports,
  render rows as contracts/pages.md, extend `attendanceDiff` with
  `shown={id}:r` and `decide-{id}`, apply `yes` through `add-attendance` and
  `no` through `deleteReportsStatement`; `organiser.done.attendance` with the
  counts.
- [x] T032 [US5] `public/app.js`: turn each `.tri-state` fieldset into one
  `role="checkbox"` button with `aria-checked` `mixed`/`true`/`false`, cycling
  grey → ticked → empty → grey, setting the radio, showing the matching tag and
  updating the summary line; "Alle n Meldungen eintragen" sets every open one to
  `yes` (research R5). No text in the script.
- [x] T033 [P] [US5] Styles for the box's three states (dashed grey border and
  light tick for grey), the legend and the tags in `src/http/style.ts`; catalog
  keys of contracts/messages.md "Event page".

**Checkpoint**: T030 passes.

---

## Phase 8: User Story 6 - "Ich war auch dabei" (Priority: P2)

**Goal**: organisers record their own attendance from the Termine list.

**Independent Test**: [quickstart.md](quickstart.md) §2.5.

- [x] T034 [P] [US6] Extend `test/integration/organiser-events.test.ts`: past
  events without the viewer's attendance show the form, those with it read "n
  Personen, inklusive dir", others "n Personen"; upcoming events have no form;
  `POST /organiser/events/{id}/self` records the organiser with themselves as
  `by` and redirects with `done=attendance`; for an upcoming event
  `?error=future_event`.
- [x] T035 [US6] `src/http/organiser/events.ts`: `handleSelfAttendance`, the
  form and the count texts; route in `src/http/router.ts`; keys
  `organiser.events.attendees*`, `organiser.events.self`.

**Checkpoint**: T034 passes.

---

## Phase 9: User Story 7 - A leaner Team page (Priority: P2)

**Goal**: no place card, no peloton; the Rangliste above the team chart.

**Independent Test**: [quickstart.md](quickstart.md) §2.1.

- [x] T036 [P] [US7] Update `test/integration/team-leaderboard.test.ts`: the
  sections come in the order total, switch, quote, leaderboard, chart; no
  `my-place` and no peloton; the viewer's row and the neighbourhood stay.
- [x] T037 [US7] `src/http/sections/team.ts`: drop `renderPlace` and
  `renderPeloton`, leaderboard before chart; remove the peloton from
  `src/http/charts.ts`, `src/rynke/breakaway.ts`, `test/unit/breakaway.test.ts`
  and the peloton cases of `test/unit/charts.test.ts`, their styles in
  `src/http/style.ts` (and `test/unit/style.test.ts`), and the keys
  `team.place*`, `team.peloton*`; `tour.rider.team` without the peloton.
- [x] T038 [P] [US7] Amend `specs/016-team-leaderboard/contracts/pages.md` with a
  note that 019 removed the place card and peloton.

**Checkpoint**: T036 passes.

---

## Phase 10: Polish & Cross-Cutting

- [x] T039 [P] Consent and privacy texts name reports (FR-052, research R11):
  `landing.purpose`, the privacy page's sentence, in de and en; extend
  `test/integration/privacy.test.ts`.
- [ ] T040 [P] `src/http/tour.ts`: a rider step for Termine (`tour.rider.events`),
  riders who aren't organisers only; extend `test/integration/tour.test.ts`.
  *Not done*: organisers take the same rider tour, so this needs per-rider
  steps (research R8).
- [x] T041 [P] `dev/` sample data: intents at upcoming events, open requests at
  three past events, one rider with three and one with two (research R14).
- [x] T042 [P] `e2e/smoke.e2e.ts`: a rider taps "Bin dabei", hovers it for
  "Doch nicht dabei", withdraws; an organiser cycles a grey box and saves.
- [x] T043 Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`;
  `test/unit/catalogs.test.ts` and `test/integration/no-hardcoded-copy.test.ts`
  pass with the new and removed keys and pages.
- [ ] T044 Walk through [quickstart.md](quickstart.md) §2 with `pnpm dev`, at
  360 px in light and dark mode.

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → US1 → US2 → US3 (all build `/events`).
- US4, US5 and US6 need Phase 2; US5 and US6 can follow US4 in either order
  (both touch `src/http/organiser/events.ts` or `attendance.ts`, so not in
  parallel with US4's T027).
- US7 depends on nothing and can run any time.
- Polish last; T041 helps every manual check and may come early.

## Parallel Examples

- Phase 2 tests: T002, T003, T004, T005 together.
- US1: T011, T012, T015, T016 together, then T013 → T014.
- US4: T022, T023, T024 together, then T025 → T026 → T027 → T028.

## Implementation Strategy

1. **MVP**: Phase 2 + US1–US3: riders can say they come and report they were
   there; organisers still see it on the event page through US5 or by the data.
2. US4 and US5 make it usable for organisers; ship them with the MVP.
3. US6 and US7 are independent improvements; US7 can ship alone.
