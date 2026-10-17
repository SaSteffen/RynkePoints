# Research: Riders Report Team-Event Participation

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-10-17

Each section records the decision, why it was taken, and what else was considered.
"003", "004", "011", "013", "014", "016" are earlier features whose code or specs
this one reads and extends.

## R1. One table for reports; intent or request follows from the date (FR-020)

**Decision**:

- A new table `participation_reports (event_id, athlete_id, reported_at)` with
  the primary key `(event_id, athlete_id)`, both columns foreign keys with
  `ON DELETE CASCADE` like `attendances` (migration `0017`,
  [data-model.md](data-model.md)).
- No `kind` column. A report is an **intent** while its event is in the future
  and a **request** from the event's date on (R2), worked out at read time.
- No decision column. Confirming records the attendance and deletes the report
  (R3); denying deletes it (FR-023).

**Rationale**:

- An intent turns into a request on its own when the event day comes (spec
  Story 2 scenario 4), and moving an event's date moves its reports with it
  (spec edge cases), without a job or a second write.
- Nothing about a decision is kept, which is what FR-023 and the minimisation in
  constitution Principle I ask for.

**Alternatives considered**:

- *A `status` column (intent, request, denied)*: needs a nightly flip from intent
  to request and keeps denials the spec says to forget. Rejected.
- *Reports as attendance rows with a `confirmed` flag*: every reader of
  `attendances` (003's evaluation, 005, 013, 016) would have to filter it, and
  one forgotten filter credits Rynke for a report (FR-008). Rejected.

## R2. "Has taken place" is the event's date in Berlin (spec terms)

**Decision**: an event has taken place when `event_date <= berlinDate(now)`, the
negation of 014's `isFutureEvent`. One helper, `hasTakenPlace`, next to it in
`src/http/organiser/attendance.ts` (moved to `src/rynke/team-events.ts` so both
the rider tab and the organiser pages import it from a pure module).

**Rationale**: one boundary for recording attendance and for reports, so the day
an event becomes recordable is the day its intents become requests.

**Alternatives considered**: *end of the event day*: events have no time, and a
second boundary would leave a day where organisers can record an event riders
still see as upcoming. Rejected.

## R3. Recording attendance deletes the rider's report in the same batch (FR-022)

**Decision**: `applyTeamEventChange`'s `add-attendance` adds
`DELETE FROM participation_reports WHERE event_id = ?1 AND athlete_id IN (…)` to
its writes, for every rider in the change, also those already attending.
Whichever page records attendance (event page, quick confirm, "Ich war auch
dabei"), the report goes in the same D1 batch as the attendance and the
re-evaluation.

**Rationale**: one place enforces "no report next to an attendance", so the
counts (R7) can't show a request for someone already credited.

**Alternatives considered**: *delete in each handler*: three handlers, one to
forget. Rejected. `remove-attendance` recreates nothing (spec edge cases).

## R4. Quick decisions and their undo (FR-031, FR-032, FR-034)

**Decision**:

- `POST /organiser/requests` with `event`, one or more `athlete`, `decision`
  (`confirm` or `deny`) and `back` (the Termine page or the overview, with its
  group). Confirm calls `teamEventChange` `add-attendance` with the organiser as
  `by`; deny deletes the reports. Riders without a report at that event are
  skipped, so a request another organiser settled meanwhile changes nothing and
  the notice says so (spec edge cases).
- The redirect carries a notice ("Katrin eingetragen.", "3 Rider eingetragen.",
  "Meldung von Emil abgelehnt.") with a **Rückgängig** form. Its hidden field is
  a token signed with the session key (`src/crypto/sign.ts`) holding the
  decision, the event, the riders and an expiry of 10 minutes.
  `POST /organiser/requests/undo` checks the token, removes the attendance it
  added (confirm) and puts the reports back (both) with their old `reported_at`.

**Rationale**:

- Organisers are trusted (014 Assumptions), but FR-021 says only riders create
  reports. A signed token means the undo can only recreate a report that existed
  a moment ago, never a new one.
- No client script: forms and a redirect with a notice, like every organiser
  change in 014.

**Alternatives considered**:

- *Client-side undo before sending*: needs script and loses the decision if the
  page is closed. Rejected.
- *A soft-deleted report row for undo*: keeps denials around (FR-023). Rejected.

## R5. Tri-state boxes work without script, script makes them one box (FR-040–FR-044)

**Decision**:

- The event form keeps 014's `attend` checkboxes and `shown` hidden fields for
  riders without a report. For a rider with an open request it renders a
  `fieldset` of three radio buttons named `decide-{athleteId}`: **offen**
  (checked), **dabei**, **nicht dabei**, plus `shown={athleteId}:r`.
- `public/app.js` turns each such fieldset into one checkbox-looking `button`
  with `role="checkbox"` and `aria-checked` `mixed`/`true`/`false`; a tap cycles
  grey → ticked → empty → grey and sets the matching radio, so the form posts
  the same fields with or without script. The tag next to the name ("Meldung
  offen", "wird eingetragen", "wird abgelehnt") is three spans in the markup,
  and the script shows the one that fits; without script the radio labels say it.
- Saving: `dabei` → `add-attendance`; `nicht dabei` → delete the report;
  `offen` → nothing. Combined with 014's diff of ticks and unticks for everyone
  else, so it still only applies this organiser's changes.
- An upcoming event renders reports as disabled grey boxes tagged "zugesagt"
  (no form, as 014 FR-022).

**Rationale**:

- A plain checkbox can't carry three states in a form post, and an unchecked box
  sent by a browser without script would read as "deny" (FR-042). Radios never
  lose the grey state.
- `public/app.js` already enhances server-rendered pages (010, 013, 018
  lazy-rides list); this adds one more enhancement, no dependency.

**Alternatives considered**:

- *`indeterminate` checkbox*: a property, not an attribute; it can't be set by
  markup or posted. Rejected.
- *A `select` per rider*: works, but looks nothing like the mock-up's boxes even
  with script. Rejected.

## R6. "Bin dabei" and "Doch nicht dabei" without script (FR-004)

**Decision**: each event's button is a one-button form:

- no report: `POST /events/{id}/report` with the label "Bin dabei" (or "Ich war
  dabei");
- intent: `POST /events/{id}/report/delete`; the button holds two spans, "Bin
  dabei ✓" and "Doch nicht dabei", and CSS shows the second and turns the button
  red on `:hover` and `:focus-visible`;
- request: no form, a disabled-looking green label with `aria-disabled` (FR-005).

On a touch screen the green button reads "Bin dabei ✓" and a tap withdraws, as
the spec's edge cases say; a second tap is a new "Bin dabei". Each post redirects
back to `/events#event-{id}` so the rider stays at the same event.

**Rationale**: the swap is pure presentation; CSS does it in every browser, and a
form post works without script and keeps the server the only judge of what is
allowed (R2).

**Alternatives considered**: *fetch and update in place*: smoother, but a second
code path for little gain; `app.js`'s existing busy feedback on buttons already
shows the post is on its way. Rejected for now.

## R7. Counting open requests on every organiser page (FR-030, FR-033, FR-034)

**Decision**:

- `src/db/participation.ts` holds the reads. The open-request condition is one
  shared SQL fragment: event dated on or before today, inside the counting
  window, rider in 014's `LISTED_RIDER_IDS`, no attendance at that event.
- `shellPage` adds one `COUNT(*)` with that condition to its existing batch, for
  organisers only, and the navigation renders the count on Orga; the
  organiser switch renders it on Termine.
- The Termine page and the overview read the open requests themselves
  (event, rider, first name) in their existing batch.

**Rationale**: one query per organiser page view on a table of at most riders ×
events (about 30 × 40), cheap on D1's free tier; no stored counter to keep in
sync.

**Alternatives considered**: *a cached counter*: one more write on every report,
decision and attendance change. Rejected.

## R8. The Termine tab is a section for riders who aren't organisers (FR-001)

**Decision**:

- `SECTIONS` in `src/http/shell.ts` gets `{ id: "events", path: "/events",
  label: "nav.events", icon: CALENDAR, riderOnly: true }` after Badges, where
  Orga sits for organisers; the navigation keeps six entries for everyone.
- `GET /events` lists the counting window's events: upcoming ascending, then
  past descending, the five newest past ones with "Alle zeigen" as
  `?past=all`. An organiser asking for `/events` is sent to `/organiser` (302).
- The rider tour (`src/http/tour.ts`) gets a step for Termine; organisers' tour
  is unchanged.

**Rationale**: the spec puts the tab where Orga is; mirroring `organiserOnly`
with `riderOnly` keeps the navigation one list.

**Alternatives considered**: *`/me/events`*: `/me/*` holds the rider's own data;
these are the team's events. Rejected.

## R9. "Ich war auch dabei" for organisers (FR-036)

**Decision**: the Termine list (`/organiser`) gets, for each event that has
taken place without the viewing organiser's attendance, a one-button form
`POST /organiser/events/{id}/self`, which calls `add-attendance` for the
organiser with themselves as `by`. The count text changes from "{count} dabei"
to "{count} Personen" and "{count} Personen, inklusive dir".

**Rationale**: the same path as any attendance (R3), so balances, badges and the
change record follow without new code.

## R10. A confirmed request still sends the usual "Rynke gestiegen" notification

**Decision**: confirming goes through `teamEventChange` like any attendance, so a
rider whose Rynke rose gets 013's ordinary notification, which doesn't mention
the request. Nothing else is sent (FR-009).

**Rationale**: the notification is about Rynke, not about the request, and every
attendance an organiser records today sends it. Suppressing it only for
confirmed requests would treat the same Rynke differently.

**Open point for the owner**: if even this is too much of a hint, `teamEventChange`
can take a `quiet` flag for confirmations. Not planned.

## R11. No new consent version; consent and privacy texts name reports (FR-052)

**Decision**:

- `VISIBILITY` in `src/visibility.ts` gets `participationReports:
  ORGANISER_ONLY`, `SINCE_VERSION` `SHARING_SINCE_VERSION`.
- The consent text (`landing.purpose`) and the privacy page name the reports in
  the sentence that already lists what organisers see. No new consent version.

**Rationale**:

- Constitution Principle I asks for a new version when what the app shows to
  others *grows*. A report is not Strava data and not something the app shows on
  its own: the rider creates it with a tap whose only purpose is to tell the
  organisers, each time, and organisers already see the rider's attendance
  (`attendance: ORGANISER_ONLY`). That is the rider sharing it, not the app.
- Precedent for naming without a version: 008, 010 and 013 (comment in
  `src/consent.ts`).

**Alternatives considered**: *version 2*: every rider would have to agree again
for a feature that only acts when they tap it. Rejected; the plan's Constitution
Check records the reasoning.

## R12. The Team page drops the place card and the peloton (FR-045, FR-046)

**Decision**:

- `src/http/sections/team.ts` stops rendering `renderPlace` and `renderPeloton`
  and puts the leaderboard before the team chart.
- Code only the peloton used goes: the peloton in `src/http/charts.ts`,
  `src/rynke/breakaway.ts` and their tests and styles; catalog keys
  `team.place*` and `team.peloton*`.
- `tour.rider.team` loses "wo du im Peloton fährst".
- `leaderboardRows` keeps the viewer's place: the neighbourhood and the "Du" row
  need it.

**Rationale**: dead code and keys would only mislead; `catalogs.test.ts` already
fails on keys nobody uses.

## R13. Who can report, and edge cases

**Decision**:

- Creating or withdrawing a report checks on the server: signed in, agreed to the
  current consent, listed (004 FR-021), **not** an organiser, event in the
  counting window, no attendance there, and for a withdrawal that the event has
  not taken place. Anything else redirects back with a notice, nothing changes.
- A rider who becomes an organiser keeps their open requests; organisers see
  them like any other and may confirm their own.
- Events moved out of the counting window keep their reports but show and count
  nowhere (spec edge cases), like their attendance.
- A rider who leaves loses their reports through the foreign key; one who is no
  longer listed is filtered out by `LISTED_RIDER_IDS`.

## R14. Sample data and tests

**Decision**:

- `dev/` sample riders get reports so `pnpm dev` shows intents, open requests at
  several events and one rider with three (the mock-up's Nora).
- Unit tests for the pure parts (report state from date and attendance, undo
  token, open-request grouping); integration tests through `handleFetch` for
  every route and page; the e2e smoke test taps "Bin dabei", "Doch nicht dabei"
  and a tri-state box ([quickstart.md](quickstart.md)).
