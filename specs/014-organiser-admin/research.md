# Research: Organiser Administration (Stories 1–3)

The spec has no open questions. These are the design decisions for Stories 1–3.

## R1 — Access check

- **Decision**: GET pages go through `organiserPage(request, ctx, i18n, path,
  render)`, which calls `shellPage()` with section `team`. A visitor goes to `/`
  and a rider without current consent meets the gate, as on every section. The
  render callback first checks `rider.organiser` and otherwise answers
  `forbidden()` (403).

  Every POST goes through `requireOrganiserPost(request, ctx, i18n)`. It requires
  `isSameOrigin`, a rider session, agreement to the current consent version and
  `organiser`, and returns the organiser's `Rider` or a 403. All of these are
  read afresh from D1 (004 FR-003). That covers a flag cleared mid-session.
- **Rationale**: it reuses the shell's visitor and consent handling, and keeps
  one place that decides who is an organiser.
- **Alternatives considered**: a separate admin layout outside the shell was
  rejected, because the spec assumes the app shell and one look (features 011
  and 012).

## R2 — Navigation entry

- **Decision**: there is no fifth tab. The Team section (`/team`) shows an
  "Organiser" card linking to `/organiser`, for organisers only. The organiser
  pages render with the Team tab current and a back link to `/organiser` on the
  sub-pages.
- **Rationale**: the bottom bar stays at four items on a 360 px screen, and the
  pages are about the team. FR-002 only needs an entry that riders without the
  flag don't see.
- **Alternatives considered**: a fifth nav item shown to organisers only would
  make the navigation differ by role and crowd small screens.

## R3 — Forms and feedback

- **Decision**: these are plain `<form method="post">` forms. On success the
  server answers `303` to the page with `?done=<code>`. On a refusal it answers
  `303` to the page with `?error=<code>`, and the page shows the translated
  message from an allow-list of codes; unknown codes are ignored. Form values are
  not echoed back after a refusal.
- **Rationale**: there is no client script, reloading never re-posts, and the
  messages come from the catalogs.
- **Alternatives considered**: re-rendering the form with a 400 and the values
  kept is friendlier, but every POST would then need render code. The forms have
  three or four fields, so that isn't worth it now.

## R4 — Delete confirmation

- **Decision**: "Delete event…" and "Remove…" are a `<details>` element. Its
  `<summary>` reveals a short warning and the real submit button. That is two
  taps and works without script.
- **Alternatives considered**: a separate confirmation page needs one more route
  per action. `confirm()` needs script.

## R5 — Season window and future events

- **Decision**: the organiser handlers check two things before calling feature
  003:
  - The event date must satisfy `inCountingWindow(date, countingWindow(env,
    CURRENT_RULES))`, otherwise the change is refused with `outside_season`
    (FR-012). The check runs on create, and on update only when the date changes.
  - Saving attendance for an event whose date is after `berlinDate(now)` is
    refused with `future_event` (FR-022).

  `applyTeamEventChange` and its contract stay unchanged.
- **Rationale**: these are organiser-page rules. Feature 003 deliberately lets
  future events count (its FR-002), and its tests rely on that.
- **Alternatives considered**: new refusal codes inside `applyTeamEventChange`
  would be a contract change to 003 and would break its tests.

## R6 — Attendance checklist

- **Decision**: the event page has one form. For each listed rider there is a
  checkbox `attend=<id>` and a hidden `shown=<id>:<0|1>` recording the state the
  page showed. On save the server computes:
  - `add` = ticked and shown as 0;
  - `remove` = unticked and shown as 1.

  It then calls `applyTeamEventChange` with `add-attendance` and then
  `remove-attendance` (each skipped if empty), passing `by`.

  Every id must be one of the currently listed riders, otherwise the whole save
  is refused with `rider_not_listed`. Riders not shown (no consent) are never
  touched.
- **Rationale**: one submit for 15 riders meets SC-001. Applying only the
  organiser's own changes means a rider ticked by a second organiser in the
  meantime isn't unticked. Ticking twice is a no-op through `ON CONFLICT DO
  NOTHING` (SC-003).
- **Alternatives considered**:
  - One POST per rider costs 15 page loads.
  - Saving the full set as the truth would let two organisers overwrite each
    other.
  - A client script with fetch per tap was ruled out (no client JS).

## R7 — Corrections in the evaluation (feature 003 Story 6)

- **Decision**:
  - `RiderState` gains `corrections: { training, team }[]`, and `readRiders`
    adds one statement, `listCorrectionsOfRidersStatement`, filtered with
    `json_each`.
  - `evaluateState` builds extras as attendance plus the sums of the
    corrections, through a new `extrasFrom(attendance, corrections)` in
    `tally.ts`.
  - `tally` already clamps Training and Team Rynke at 0, so story 3 scenario 4
    holds as it is.
  - Corrections count whatever their date. The date is for the organisers'
    record only, and 003 FR-011's window names activities and events.
  - The balance gets no breakdown columns now. The rider view showing
    corrections is a later rider-view change.
- **Rationale**: this is the smallest change that makes 003 FR-010 hold in every
  evaluation, including full re-evaluations.
- **Alternatives considered**: storing the correction sums on `rynke_balances`
  (003 data-model.md mentions additive columns) waits until a page shows them.

## R8 — Applying a correction change

- **Decision**: `applyCorrectionChange(db, change, rules, window, now)` takes one
  of these changes:
  - `{ kind: "add-correction", athleteId, correction, by }`;
  - `{ kind: "remove-correction", correctionId }`.

  It validates the correction, reads the rider (and for a removal, the
  correction's owner), and writes the insert or delete plus the rider's changed
  rows and any rise in one batch, as `applyTeamEventChange` does. It refuses
  with `CorrectionRefused`, using these codes:
  - `invalid_amount`: not an integer, both 0, or `|n| > 10000`;
  - `invalid_reason`: 1–200 characters after trimming;
  - `invalid_date`: not a calendar date;
  - `correction_missing`;
  - `rider_not_connected`.

  `correctionChange(ctx, change)` wraps it like `teamEventChange`: it sends one
  `evaluate-rider` and notifies on a rise.
- **Rationale**: it mirrors the existing pattern, so a reader never sees a
  correction without its balance (003 R21).
- **Note**: the ±10000 bound is a guard against typos that the spec doesn't
  state; it is far above any season's totals.

## R9 — Change record and departed organisers

- **Decision**: each input row carries `changed_by INTEGER REFERENCES riders
  (athlete_id) ON DELETE SET NULL` and `changed_at INTEGER` (epoch seconds).
  - Creating or updating an event sets both.
  - Recording attendance sets both for the new row. A row that already exists
    keeps its first recorder.
  - A correction sets both on insert.
  - Deleting an input deletes its record with it, so nothing is kept after the
    input is gone (Key Entities "Change Record").
  - Display:
    - `changed_at` NULL: rows from before this feature; nothing is shown.
    - `changed_by` NULL with `changed_at` set: "former organiser".
    - `changed_by` set but the organiser no longer passes `SHARED_RIDER_IDS`:
      "former organiser" too, so a name is only ever shown through the consent
      filter (004 FR-021).
    - Otherwise: the organiser's first name and the date.
- **Rationale**: no name or ID of a departed rider survives (Principle I), and
  the schema does the clearing, so there's no clean-up code.
- **Alternatives considered**: a separate audit log table would outlive the
  inputs, which the spec rules out, and would need its own deletion.
- **Note**: FR-040 lists deletions among the changes. Under "kept as long as the
  input exists" a deletion leaves no record, so this plan stores none.

## R10 — Listed riders

- **Decision**: `listListedRiders(db)` returns `athlete_id, first_name` of
  connected riders `WHERE athlete_id IN (${SHARED_RIDER_IDS})`, ordered by first
  name. That includes the organiser themselves.
  - Clashing first names (case-insensitive) get a "View on Strava" link to
    `https://www.strava.com/athletes/<id>` (004 FR-022).
  - The event list shows the season's events: `event_date >= SEASON_START_DATE`
    (FR-010). Events after the deadline stay listed (spec edge cases).
  - The event list's attendee count is a plain `COUNT(*)` over attendances. It
    is a number, not riders, and FR-010 asks for it.
- **Rationale**: the consent filter sits inside SQL as 004 requires.
- **Alternatives considered**: none; this is how 004 says to list riders.
