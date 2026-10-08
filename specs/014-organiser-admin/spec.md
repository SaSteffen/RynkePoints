# Feature Specification: Organiser Administration

**Feature Branch**: `014-organiser-admin`

**Created**: 2026-10-08

**Status**: Draft

**Input**: Backlog prompt `specs/backlog/organiser-admin.md` (removed with this spec): the
organiser pages for the inputs of feature 003 — team events, attendance and
corrections now; rules, recalculation and Team Settings as separate stories much
later. Basic functionality is needed soon, so the first three stories stay lean.

## User Scenarios & Testing *(mandatory)*

Terms as in feature 003 ([spec](../003-rynke-evaluation/spec.md)): **team
event**, **attendance**, **correction**, **Training Rynke**, **Team Rynke**. An
**organiser** is a rider the maintainer has marked as organiser (feature 004,
FR-001–FR-003). The **organiser pages** are the pages of this feature. A
**listed rider** is a connected rider whose current consent lets organisers see
them (feature 004, FR-020, FR-021).

### User Story 1 - Organiser manages the season's team events (Priority: P1)

An organiser opens the organiser pages on their phone and sees the season's team
events, newest first. They add the team training that took place tonight (kind,
date, optional name), fix a wrong date, or delete an event entered by mistake. A
training weekend is entered as one event per day.

**Why this priority**: Attendance needs events to attach to, and without
attendance no rider can earn Team Rynke. Today events can only be entered by the
maintainer directly in the stored data.

**Independent Test**: Sign in as a synthetic organiser, create, change and delete
events, and check the event list and the stored events; sign in as a synthetic
rider without the flag and check every organiser page and change is refused.

**Acceptance Scenarios**:

1. **Given** a signed-in organiser, **When** they create a team training dated
   today without a name, **Then** it appears in the season's event list with its
   kind and date.
2. **Given** an existing event, **When** an organiser changes its kind, date or
   name, **Then** the list shows the change and the riders' balances follow
   (feature 003, FR-003).
3. **Given** an event with recorded attendance, **When** an organiser deletes it
   and confirms, **Then** the event and its attendance are gone and the riders'
   balances follow.
4. **Given** an organiser entering an event, **When** the date is before the
   season start or after the qualification deadline, **Then** it is refused with
   a message saying why.
5. **Given** a signed-in rider who is not an organiser, **When** they open an
   organiser page or send an organiser change, **Then** they get "not allowed" and
   nothing changes.
6. **Given** a visitor who is not signed in, **When** they open an organiser page,
   **Then** they are asked to sign in with Strava and see no data.

---

### User Story 2 - Organiser records attendance (Priority: P2)

After a team event an organiser opens it and sees the listed riders by first
name. They tick everyone who was there and untick someone ticked by mistake. They
can do the same for an event weeks ago, e.g. for a rider who connected after it.

**Why this priority**: Attendance is the only source of Team Rynke (feature 003,
FR-009); it is the main reason organisers need these pages.

**Independent Test**: Create a synthetic event and riders, tick and untick riders
as an organiser, and check the stored attendance and that each rider's balance
shows the event's fixed amount exactly once.

**Acceptance Scenarios**:

1. **Given** an event and three listed riders, **When** an organiser ticks two of
   them, **Then** those two are recorded as attending and the page shows them
   ticked.
2. **Given** a rider already recorded for an event, **When** an organiser (or a
   second organiser at the same time) ticks them again, **Then** nothing changes;
   they are credited once.
3. **Given** a recorded rider, **When** an organiser unticks them, **Then** the
   attendance is removed and their balance follows.
4. **Given** an event before a rider connected, **When** an organiser ticks that
   rider, **Then** the attendance is recorded and counts.
5. **Given** two listed riders with the same first name, **When** an organiser
   opens the event, **Then** each has a "View on Strava" link to tell them apart
   (feature 004, FR-022).
6. **Given** a connected rider without current consent, **When** an organiser
   opens an event, **Then** that rider is not listed (feature 004, FR-021).
7. **Given** an event dated in the future, **When** an organiser opens it,
   **Then** attendance cannot be recorded yet.

---

### User Story 3 - Organiser corrects a rider's balance (Priority: P3)

An organiser picks a listed rider, sees the corrections already recorded for
them, and adds one: a signed amount of Training Rynke and/or Team Rynke with a
reason and a date, e.g. +10 Training Rynke for a ride lost to a broken bike
computer. They can remove a correction added by mistake.

**Why this priority**: Covers what the rules can't (feature 003, Story 6), but
riders can qualify without it.

**Independent Test**: Add and remove corrections for a synthetic rider as an
organiser and check the stored corrections and that the rider's balance includes
each correction exactly once.

**Acceptance Scenarios**:

1. **Given** a listed rider, **When** an organiser adds +10 Training Rynke with
   reason "Ride lost, broken device" and today's date, **Then** the correction is
   shown in the rider's list and their balance includes it.
2. **Given** an organiser entering a correction, **When** both amounts are 0, an
   amount is not a whole number, or the reason is empty, **Then** it is refused
   with a message saying why.
3. **Given** a recorded correction, **When** an organiser removes it and confirms,
   **Then** it is gone and the balance follows.
4. **Given** a correction of −20 Team Rynke for a rider with 5, **When** it is
   added, **Then** it is recorded and their Team Rynke total stays at 0 (feature
   003 edge cases).

---

### User Story 4 - Organiser changes the rules (Priority: P4, much later)

An organiser views the rule values of feature 003 FR-012, including the
qualification deadline and the excluded sport types, and changes one. The change
creates a new rules version and every balance is recalculated (feature 003,
FR-021, FR-023). A change that needs data the app doesn't store is refused
(FR-025).

**Why this priority**: Rule changes are rare and the maintainer can make them
directly until then. Independent of Stories 1–3; specified in detail when it is
taken up.

**Independent Test**: Change a rule value as a synthetic organiser and check a new
rules version exists and the balances were recalculated with it.

**Acceptance Scenarios**:

1. **Given** the current rules, **When** an organiser changes a value and saves,
   **Then** a new rules version takes effect and balances are recalculated.
2. **Given** a change that needs data the app doesn't store (e.g. moving the
   season start earlier), **When** an organiser saves it, **Then** it is refused
   with a message saying why.

---

### User Story 5 - Organiser starts a recalculation (Priority: P5, much later)

An organiser starts a full recalculation of all riders (feature 003, FR-024) and
sees whether one is running.

**Why this priority**: The nightly run and the maintainer's manual run cover it
until then. Independent of the other stories.

**Independent Test**: Start a recalculation as a synthetic organiser and check it
runs, is shown as running, and gives the same balances as before.

**Acceptance Scenarios**:

1. **Given** no recalculation running, **When** an organiser starts one, **Then**
   it runs and the page shows it as running until it is done.
2. **Given** a recalculation running, **When** an organiser starts another,
   **Then** no second one runs alongside it.

---

### User Story 6 - Organiser edits Team Settings (Priority: P6, much later, optional)

An organiser changes feature 001's Team Settings (season start, club) in the app
instead of in the deployment configuration.

**Why this priority**: Set once per season; deployment configuration works.
Optional; may be dropped.

**Independent Test**: Change a Team Setting as a synthetic organiser and check the
app uses the new value.

**Acceptance Scenarios**:

1. **Given** the current Team Settings, **When** an organiser changes the club,
   **Then** the app uses the new club from then on.

---

### Edge Cases

- **Organiser flag cleared mid-session**: the next request is a rider's; a change
  sent from a page already open is refused (feature 004 edge cases).
- **Two organisers at once**: ticking the same rider twice records one attendance;
  a change to an event another organiser deleted meanwhile is refused with a
  message, not silently applied.
- **Rider leaves**: their attendance and corrections are deleted with them
  (feature 003 Key Entities); events stay.
- **Organiser leaves**: the inputs they made stay; their record of who made the
  change then shows "former organiser", since no name of a departed rider is kept
  (constitution Principle I).
- **Event moved out of the counting window by a rules change** (Story 4): it stays
  listed and earns nothing (feature 003, FR-011).
- **No listed riders**: the attendance and correction pages say so instead of
  showing an empty list.
- **Accidental tap**: ticking and unticking are single taps and undone the same
  way; deleting an event or a correction asks for confirmation.

## Requirements *(mandatory)*

### Functional Requirements

**Access**

- **FR-001**: Only organisers (feature 004, FR-001, FR-003) MUST reach the organiser
  pages and make their changes. A signed-in rider who is not an organiser MUST get
  "not allowed"; a visitor who is not signed in MUST be asked to sign in and see no
  data. The role MUST be checked on every request, including every change.
- **FR-002**: Organisers MUST find the organiser pages from the app's navigation;
  riders who are not organisers MUST NOT see the entry.

**Team events (Story 1)**

- **FR-010**: Organisers MUST be able to list the season's team events (kind,
  date, name, number of attendees), newest first.
- **FR-011**: Organisers MUST be able to create, change (kind, date, optional
  name) and delete team events as defined in feature 003 FR-006 and FR-006a. A
  training weekend is entered as one event per day.
- **FR-012**: An event date MUST lie between the season start and the
  qualification deadline (if set); otherwise the input is refused with a reason.
  A name is optional and at most 100 characters.
- **FR-013**: Deleting an event MUST ask for confirmation and MUST delete its
  attendance (feature 003, FR-006a).

**Attendance (Story 2)**

- **FR-020**: For an event, organisers MUST see the listed riders by Strava first
  name, with a "View on Strava" link where first names clash (feature 004,
  FR-022), each marked as attending or not. Riders without current consent MUST
  NOT appear (feature 004, FR-021).
- **FR-021**: Organisers MUST be able to record and remove a rider's attendance
  at an event, also for events before the rider connected. Recording an existing
  attendance MUST change nothing (feature 003, FR-007).
- **FR-022**: Attendance MUST NOT be recordable for an event dated after today.

**Corrections (Story 3)**

- **FR-030**: For a listed rider, organisers MUST see the rider's corrections
  (amounts, reason, date).
- **FR-031**: Organisers MUST be able to add a correction (feature 003, FR-010):
  a whole, signed amount of Training Rynke and one of Team Rynke, at least one of
  them not 0, a reason of 1–200 characters and a date (default today). They MUST
  be able to remove a correction after confirming. Corrections are not edited;
  a wrong one is removed and added again.

**All changes**

- **FR-040**: Every stored input (event created or changed; attendance
  recorded; correction added) MUST record which organiser made the change and
  when. That record MUST be kept as long as the input it belongs to exists; it
  MUST NOT keep the organiser's name after the organiser has left. Deleting an
  event or removing attendance or a correction leaves no record, since the record
  goes with its input.
- **FR-041**: Changes MUST take effect through feature 003 (FR-003): this feature
  stores inputs and computes no Rynke itself.
- **FR-042**: Organiser pages MUST NOT show riders' balances, qualification or
  rides; those belong to the team-leaderboard feature (organiser overview) and
  the rider view.
- **FR-043**: All text on the organiser pages MUST come from the i18n catalogs in
  German and English (feature 001, FR-028).
- **FR-044**: Organiser pages MUST be usable on a phone: every task of Stories 1–3
  works on a 360 px wide screen without horizontal scrolling.

**Later stories (4–6)**

- **FR-050**: (Story 4) Organisers MUST be able to view and change the rule
  values of feature 003 FR-012; a change creates a new rules version and triggers
  recalculation (FR-021, FR-023), and changes needing data the app doesn't store
  are refused (FR-025).
- **FR-051**: (Story 5) Organisers MUST be able to start a full recalculation
  (feature 003, FR-024) and see whether one is running.
- **FR-052**: (Story 6, optional) Organisers MAY edit feature 001's Team Settings
  (season start, club) in the app.

### Key Entities

- **Team Event**, **Attendance**, **Correction**: as in feature 003 Key Entities;
  this feature adds no new inputs, only the pages to change them (corrections
  were defined in feature 003 but never stored; their store is built here).
- **Change Record**: who (which organiser) made a change to an input and when;
  kept with that input, gone when the input is gone. Shows "former organiser"
  once the organiser has left.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An organiser can create a team event and tick 15 attendees on a
  phone in under 2 minutes.
- **SC-002**: 100% of organiser pages and changes are refused for riders who are
  not organisers and for visitors who are not signed in.
- **SC-003**: Recording the same attendance any number of times credits the rider
  exactly once.
- **SC-004**: A change made on the organiser pages is reflected in the affected
  riders' balances within 5 minutes.
- **SC-005**: Every stored team event, attendance and correction made through the
  app has a record of who made it and when.

## Assumptions

- Builds on feature 003 (team events, attendance and their effect already exist;
  corrections are defined there) and feature 004 (organiser flag, who organisers
  may see). Until this feature ships, the maintainer keeps entering inputs
  directly in the stored data.
- All organisers have the same rights (feature 004, FR-005); there is no approval
  step or undo history beyond the change record.
- Organisers are a handful of trusted volunteers; no limit on how many changes
  they make is needed.
- The organiser pages use the app shell and look of features 011 and 012; no
  separate admin design.
- Stories 4–6 are specified only to the level above; each is refined (via
  `/speckit-clarify`) when it is taken up.
- Seeing balances or who qualified is the team-leaderboard feature, not this one.
