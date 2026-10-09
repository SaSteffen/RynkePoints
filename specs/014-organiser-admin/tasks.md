---
description: "Task list for organiser administration, Stories 1–3"
---

# Tasks: Organiser Administration (Stories 1–3)

**Input**: Design documents from `/specs/014-organiser-admin/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/http-routes.md](contracts/http-routes.md),
[quickstart.md](quickstart.md)

**Tests**: REQUIRED (constitution Principle V). Write each test task first, run it
and confirm it fails, then implement. Riders and organisers are synthetic and
nothing contacts Strava. The live-site check after release has no tasks
([quickstart.md](quickstart.md) §3).

**Scope**: Stories 1–3 only. Stories 4–6 get their own plan revision and tasks.

**Organization**: one phase per user story, in the spec's priority order. US2
needs US1's event page; US3 is independent of US1 and US2 once the foundation is
in.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 (team events), US2 (attendance), US3 (corrections)

## Phase 1: Setup

- [X] T001 Run `pnpm install`, then `pnpm lint`, `pnpm typecheck` and `pnpm test`.
  All pass before any change, so later failures are this feature's.

---

## Phase 2: Foundational (blocks every story)

**Purpose**: the schema, the access helpers, the shared catalog keys and the
entry link on `/team`.

- [X] T002 [P] Tests first (failing), `test/integration/schema-minimisation.test.ts`:
  `team_events` and `attendances` each gain `changed_by` and `changed_at`; a new
  `corrections` entry lists `correction_id`, `athlete_id`, `training`, `team`,
  `reason`, `correction_date`, `changed_by`, `changed_at`. Add `corrections.reason`
  to `DOCUMENTED` (organiser-written free text, like `team_events.name`).
- [X] T003 Write `migrations/0011_organiser_admin.sql` per
  [data-model.md](data-model.md), adds only:
  - `ALTER TABLE team_events ADD COLUMN changed_by INTEGER REFERENCES riders (athlete_id) ON DELETE SET NULL`
    and `ADD COLUMN changed_at INTEGER`; the same two columns on `attendances`.
  - `CREATE TABLE corrections` with `correction_id INTEGER PRIMARY KEY`,
    `athlete_id INTEGER NOT NULL REFERENCES riders (athlete_id) ON DELETE CASCADE`,
    `training INTEGER NOT NULL CHECK (training BETWEEN -10000 AND 10000)`,
    `team INTEGER NOT NULL CHECK (team BETWEEN -10000 AND 10000)`,
    `reason TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 200)`,
    `correction_date TEXT NOT NULL` with the same GLOB check as
    `team_events.event_date`, `changed_by INTEGER REFERENCES riders (athlete_id) ON DELETE SET NULL`,
    `changed_at INTEGER NOT NULL`, and `CHECK (training <> 0 OR team <> 0)`.
  - `CREATE INDEX corrections_by_rider ON corrections (athlete_id)`.
  T002 passes.
- [X] T004 [P] Tests first (failing), `test/integration/team.test.ts`: `/team`
  shows a link to `/organiser` for a rider with the organiser flag, and no such
  link for a rider without it (FR-002, R2).
- [X] T005 Add the shared keys to `src/i18n/messages/en.ts` and
  `src/i18n/messages/de.ts`: `organiser.title`, `organiser.link` (the `/team`
  card), `organiser.back`, `organiser.formerOrganiser`, `organiser.changedBy`
  (first name and date), every `organiser.error.<code>` and
  `organiser.done.<code>` of [contracts/http-routes.md](contracts/http-routes.md).
  `test/unit/catalogs.test.ts` parity keeps passing.
- [X] T006 Create `src/http/organiser/access.ts` (R1, R3, R9):
  - `organiserPage(request, ctx, i18n, path, render)`: calls `shellPage()` with
    section `team`; inside, a rider without `organiser` gets `forbidden()`.
  - `requireOrganiserPost(request, ctx, i18n)`: `isSameOrigin`, a rider session,
    current consent and `organiser`, all read afresh; returns the organiser's
    `Rider` or a 403 response.
  - `noticeFromQuery(url, i18n)`: renders `?done=` or `?error=` only for codes in
    the contract's allow-lists; anything else renders nothing.
  - `changeRecord(i18n, firstName, changedAt)`: nothing when `changedAt` is NULL,
    "former organiser" when `firstName` is NULL (organiser gone, or no longer
    passing the consent filter), otherwise first name and date.
  - `redirect(path, param, code)`: a `303` with the encoded query.
- [X] T007 Add the organiser card to `src/http/sections/team.ts` for organisers
  only, with its 44 px link style in `src/http/style.ts`. T004 passes.

**Checkpoint**: migration applied in tests; helpers ready; `/team` links organisers.

---

## Phase 3: User Story 1 — Organiser manages the season's team events (P1) 🎯 MVP

**Goal**: list, create, change and delete team events from the phone.

**Independent test**: as a synthetic organiser create, change and delete events
and check the list and the stored rows; as a rider without the flag every route
is refused.

- [X] T008 [P] [US1] Tests first (failing), `test/integration/organiser-access.test.ts`
  (FR-001, SC-002): a visitor's `GET /organiser` gives 302 `/` and a visitor's
  POST to every US1 route gives 403 with nothing changed; an organiser who hasn't
  agreed to the current consent version meets the consent gate on
  `GET /organiser` and gets 403 on every US1 POST; a rider without
  the flag gets 403 on `GET /organiser`, `GET /organiser/events/{id}` and every
  US1 POST, and the stored events don't change; a POST with a foreign `Origin`
  gives 403; an organiser whose flag is cleared between GET and POST gets 403.
  Keep the routes in one table so US2 and US3 add theirs.
- [X] T009 [P] [US1] Tests first (failing), `test/integration/organiser-events.test.ts`
  (FR-010–FR-013, FR-040):
  - create with today's date and no name → 303 `/organiser/events/{id}?done=created`,
    row has `changed_by` = organiser and `changed_at` set;
  - update kind, date and name → `?done=saved`, the list shows the change;
  - delete an event with attendance → `/organiser?done=deleted`, its attendance
    rows are gone and the attendee's `rynke_balances.team_rynke` drops;
  - a date before the season start or after the deadline → `?error=outside_season`,
    nothing written; an unknown kind → `?error=unknown_kind`; a 101-character
    name → `?error=invalid_name`;
  - update or delete of an event deleted meanwhile → 303 `/organiser?error=event_missing`;
  - `GET /organiser` lists newest first with the attendee count, leaves out an
    event dated before the season start and keeps one after the deadline; the
    event page has the delete button inside a `<details>` (FR-013); an unknown event
    id gives 404; `?error=bogus` renders no message;
  - deleting the organiser's rider row leaves the event and shows "former
    organiser"; so does an organiser who no longer passes the consent filter
    (their first name doesn't appear).
- [X] T010 [US1] Add `by?: number` to `create-event` and `update-event` in
  `TeamEventChange` in `src/rynke/apply.ts`; pass `by ?? null` and `now` as epoch
  seconds to `insertTeamEventStatement` and `updateTeamEventStatement` in
  `src/db/team-events.ts`, which now also write `changed_by` and `changed_at`.
  Existing callers without `by` keep working (`team-events-apply.test.ts` passes).
- [X] T011 [P] [US1] Add `listTeamEventsStatement(db, seasonStart)` to
  `src/db/team-events.ts`: events with `event_date >= seasonStart` (FR-010; events
  after the deadline stay listed), with `kind`, `event_date`, `name`,
  `COUNT(attendances)` as `attendees`, `changed_at`, `changed_by` and the
  organiser's `first_name` via `LEFT JOIN riders ON athlete_id = changed_by AND
  athlete_id IN (${SHARED_RIDER_IDS})`, so a name only comes through the consent
  filter (R9); ordered `event_date DESC, event_id DESC`. Extend
  `readTeamEventStatement` with the same change-record fields and join.
  `changeRecord` (T006) shows "former organiser" when `changed_at` is set and the
  joined name is NULL.
- [X] T012 [US1] Add the US1 keys to both catalogs: list headings, empty list,
  form labels (date, name, save, add; the kind labels reuse
  `rynke.source.<kind>`), "Delete event…", the delete warning and confirm button.
- [X] T013 [US1] Create `src/http/organiser/events.ts`:
  - `GET /organiser`: the notice, the event list from
    `listTeamEventsStatement(db, env.SEASON_START_DATE)` (each row links to its page and
    shows the change record), the new-event form (kind select, date defaulting to
    `berlinDate(now)`, optional name) and a link to `/organiser/riders` (rendered
    once US3 exists; until then omit it).
  - `GET /organiser/events/{id}`: the edit form, the change record and the delete
    `<details>` (R4); 404 for an unknown id. Leave a slot for US2's checklist.
  - `POST /organiser/events`, `POST /organiser/events/{id}`,
    `POST /organiser/events/{id}/delete`: `requireOrganiserPost`, trim `name`
    (empty → null), check `inCountingWindow(date, countingWindow(env, CURRENT_RULES))`
    on create and on an update that changes the date (R5), call
    `teamEventChange` with `by`, map `TeamEventRefused` to `?error=<code>`
    (`event_missing` redirects to `/organiser`), and redirect per the contract.
- [X] T014 [US1] Route `/organiser`, `/organiser/events` and
  `/organiser/events/{id}[/delete]` in `src/http/router.ts` to `events.ts`;
  other methods give 405 as elsewhere. T008 and T009 pass.
- [X] T015 [P] [US1] Add the form, list and `<details>` styles to
  `src/http/style.ts`: controls at least 44 px, no horizontal scrolling at 360 px
  (FR-044); extend `test/unit/style.test.ts` if it pins the selector list.

**Checkpoint**: organisers can manage events without touching D1 by hand.

---

## Phase 4: User Story 2 — Organiser records attendance (P2)

**Goal**: one checklist on the event page to tick and untick listed riders.

**Independent test**: tick and untick synthetic riders for a synthetic event and
check the attendance rows and that each balance includes the event once.

- [X] T016 [P] [US2] Tests first (failing), `test/integration/organiser-attendance.test.ts`
  (FR-020–FR-022, SC-003):
  - tick 2 of 3 riders → `?done=attendance`, two rows with `changed_by` set, the
    page shows them ticked;
  - post the same ticks again → still two rows, balance credited once;
  - untick one → its row is gone and its `team_rynke` drops;
  - tick a rider for an event before their `connected_at` → recorded and counted;
  - two riders named "Anna" each get a `https://www.strava.com/athletes/<id>`
    link, a unique name gets none;
  - a rider without current consent isn't listed and a save leaves their
    existing attendance untouched;
  - a future event shows the list without a form, and a forced POST gives
    `?error=future_event` with nothing written;
  - an `attend` or `shown` id that isn't listed → `?error=rider_not_listed`,
    nothing written;
  - organiser B ticks rider X after organiser A loaded the page with X unticked;
    A saves without X → X stays recorded (R6);
  - no listed riders → the page says so.
  Add `POST /organiser/events/{id}/attendance` to the route table in
  `organiser-access.test.ts` (visitor, no consent, no flag).
- [X] T017 [P] [US2] Create `src/db/organiser.ts` with `listListedRidersStatement(db)`:
  `athlete_id, first_name` of connected riders
  `WHERE athlete_id IN (${SHARED_RIDER_IDS})`, ordered by first name (R10), and
  a pure `withProfileLinks(rows)` setting `profileLink` when another row has the
  same first name, case-insensitive.
- [X] T018 [US2] Add `by?: number` to `add-attendance` in `src/rynke/apply.ts` and
  write `changed_by`/`changed_at` in `insertAttendancesStatement` in
  `src/db/team-events.ts`; `ON CONFLICT DO NOTHING` keeps the first recorder.
- [X] T019 [US2] Add the US2 keys to both catalogs: checklist heading, "Save
  attendance", "View on Strava", the future-event note and the no-riders note.
- [X] T020 [US2] Create `src/http/organiser/attendance.ts`:
  - `attendanceSection(...)` for the event page: one form, per listed rider a
    44 px checkbox `attend=<id>` and a hidden `shown=<id>:<0|1>`, the profile
    link where needed; for an event after `berlinDate(now)` only the list and the
    note.
  - `POST /organiser/events/{id}/attendance`: `requireOrganiserPost`; refuse
    `future_event`; refuse `rider_not_listed` if any id isn't listed; compute
    add = ticked and shown 0, remove = unticked and shown 1; call
    `teamEventChange` with `add-attendance` (with `by`) then `remove-attendance`,
    each skipped when empty; map refusals; redirect `?done=attendance`.
  Render the section from the event page in `src/http/organiser/events.ts` and
  route the POST in `src/http/router.ts`. T016 passes.

**Checkpoint**: an event plus 15 ticks takes two form submits (SC-001).

---

## Phase 5: User Story 3 — Organiser corrects a rider's balance (P3)

**Goal**: add and remove signed Training and Team Rynke corrections that every
evaluation keeps (feature 003 Story 6).

**Independent test**: add and remove corrections for a synthetic rider and check
the stored rows and that the balance includes each exactly once.

- [X] T021 [P] [US3] Tests first (failing), `test/unit/tally.test.ts`:
  `extrasFrom(attendance, corrections)` adds the correction sums to attendance's
  Training and Team Rynke and leaves `teamEvents` unchanged; with no corrections
  it equals `extrasFromAttendance`; `tally` with a −20 Team correction on 5 Team
  Rynke gives 0.
- [X] T022 [P] [US3] Tests first (failing), `test/integration/organiser-corrections.test.ts`
  (FR-030, FR-031, 003 FR-010):
  - add +10 Training, reason "Ride lost, broken device", today →
    `?done=added`, the row has `changed_by` and `changed_at`, and
    `rynke_balances.training_rynke` rose by 10;
  - both amounts 0, `1.5`, `abc` or 10001 → `?error=invalid_amount`; empty or
    whitespace reason, or 201 characters → `?error=invalid_reason`; a bad date →
    `?error=invalid_date`; nothing written;
  - remove it → `/organiser/riders/{id}?done=removed`, the balance follows;
    removing it again → `?error=correction_missing`;
  - −20 Team for a rider with 5 → recorded, `team_rynke` is 0;
  - an `evaluate-rider` run afterwards keeps the correction in the balance;
  - each correction's remove button sits inside a `<details>` (FR-031);
  - `/organiser/riders` lists listed riders only (no rider without consent), a
    rider not listed gives 404 on their page, and no balances appear (FR-042);
  - deleting the rider deletes their corrections; deleting the organiser shows
    "former organiser".
  Add `GET /organiser/riders`, `GET /organiser/riders/{id}` and both US3 POSTs to
  the route table in `organiser-access.test.ts` (visitor, no consent, no flag).
- [X] T023 [US3] Create `src/db/corrections.ts`: `listRiderCorrectionsStatement`
  (newest first, with the organiser's first name joined through
  `SHARED_RIDER_IDS` as in T011), `listCorrectionsOfRidersStatement`
  (`training, team, athlete_id` filtered with `json_each`),
  `readCorrectionStatement`, `insertCorrectionStatement` and
  `deleteCorrectionStatement`.
- [X] T024 [US3] In `src/rynke/tally.ts` add `extrasFrom(attendance, corrections)`;
  in `src/rynke/apply.ts` add `corrections` to `RiderState`, read it in
  `readRiders` with `listCorrectionsOfRidersStatement`, and use `extrasFrom` in
  `evaluateState`. T021 passes and the 003 tests still pass.
- [X] T025 [US3] In `src/rynke/apply.ts` add `CorrectionChange`
  (`add-correction` with `athleteId`, `correction: { training, team, reason, date }`
  and `by`; `remove-correction` with `correctionId`), `CorrectionRefused` with the
  codes of R8, `applyCorrectionChange(db, change, rules, window, now)` (validate,
  read the rider or the correction's owner, then write the change, the rider's
  changed rows and any rise in one batch, as `applyTeamEventChange` does) and the
  `correctionChange(ctx, change)` wrapper that sends `evaluate-rider` and
  notifies on a rise.
- [X] T026 [US3] Add the US3 keys to both catalogs: riders heading, no-riders
  note, corrections heading, empty list, form labels (Training Rynke, Team Rynke,
  reason, date, add), "Remove…", the remove warning and confirm button.
- [X] T027 [US3] Create `src/http/organiser/corrections.ts`:
  - `GET /organiser/riders`: the listed riders with profile links where needed,
    each linking to `/organiser/riders/{id}`.
  - `GET /organiser/riders/{id}`: 404 unless listed; the notice, the corrections
    (amounts, reason, date, change record, a `<details>` remove each) and the add
    form (date defaulting to `berlinDate(now)`, amounts empty meaning 0).
  - `POST /organiser/riders/{id}/corrections` and
    `POST /organiser/corrections/{id}/delete`: `requireOrganiserPost`, parse with
    `Number.isInteger` (empty → 0), trim the reason, call `correctionChange`, map
    `CorrectionRefused` to `?error=<code>`, redirect per the contract.
  Route them in `src/http/router.ts` and add the riders link on `GET /organiser`.
  T022 passes.

**Checkpoint**: all three stories work; corrections survive every re-evaluation.

---

## Phase 6: Polish

- [ ] T028 [P] Add two sample events with attendance for the sample riders to
  `dev/fake-strava/seed.ts`, recorded by "Tina TrainingDone", so `pnpm dev` shows
  data (synthetic only; `src/` still doesn't import `dev/`).
- [ ] T029 Run `pnpm lint`, `pnpm typecheck` and `pnpm test`; confirm
  `no-hardcoded-copy`, catalog parity and `dev-guard` pass.

---

## Dependencies and order

- Setup → Foundational (T002–T007) → US1 → US2. US3 needs only Foundational and
  can run beside US1/US2, but shares `apply.ts`, `router.ts` and the catalogs, so
  doing it after US2 avoids conflicts.
- Within a story: tests first, then db, then apply, then catalogs, then pages
  and routes.

## Parallel examples

- Foundational: T002 and T004 together; T005 beside T003.
- US1: T008, T009 and T011 together; T015 beside T013.
- US2: T016 and T017 together.
- US3: T021 and T022 together.

## Implementation strategy

MVP is US1: organisers can enter events without the maintainer. US2 makes Team
Rynke earnable and is the real goal; ship US1+US2 together if time is short and
add US3 in a follow-up release.
