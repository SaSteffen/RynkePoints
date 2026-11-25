# Feature Specification: Dismiss Day Warnings

**Feature Branch**: `050-dismiss-day-warnings`

**Created**: 2026-11-25

**Status**: Draft

**Input**: User description: "Dismiss day warnings in the admin usage view's "Needs your attention" list. An administrator can dismiss a warning for a past day (Strava calls that don't add up, ride re-check warnings, gateway routing warnings: would-be miss, possible miss, too many events sent to every team) once they've looked at it and nothing needs doing. Dismissing is per administrator: it hides the entry only for the admin who dismissed it; other admins still see it. A dismissed entry leaves the list and no longer counts in the warning counts shown on the Admin tab and on Usage for that admin. The day's Warning mark in its table stays, so the table still shows what happened. Usage level warnings (allowances) and CPU warnings can't be dismissed: they stay until the figure itself drops, so a real limit can't be hidden. If a dismissed day gets a new reason later (e.g. a routing day dismissed for a possible miss later also gets a would-be miss), it shows again. Dismissals need only last as long as the list shows the day (today and yesterday); kept counts only, no rider data. All text in the ten languages. Background: feature 048 (usage tab redesign) added the list; feature 046 gateway routing; feature 047 Strava call counts."

## Context and terms

Admin › Nutzung starts with "Das braucht deinen Blick" (feature 048): every mark
that needs a look, counted in the list's head and in the red number on the Admin
tab. Besides the figures and CPU values, it lists **day warnings**: a day of
today or yesterday that a day table marks.

- **Strava calls** (feature 047): Strava's count doesn't add up with the teams'
  counted calls, or a call was counted under unassigned.
- **Ride re-check** (feature 036): riders waited over 24 hours, or the list was
  in the wrong order.
- **Gateway routing** (feature 046): a would-be miss, a possible miss, or too
  many events sent to every team.

A day warning is about something that already happened. Once an administrator
has looked at it and found nothing to do (on 24 and 25 November 2026 both
warnings were left over from the release that started counting), it keeps the
list and the red number busy until the day leaves the list two days later. The
number then can't tell the administrator whether anything new needs a look.

- **Reason**: why a day warning is there, as its list row names it (for routing
  one or more of would-be miss, possible miss, too many events to every team; for
  the re-check one or both of its two; for Strava calls one).
- **Dismiss**: an administrator's "seen, nothing to do" on one day warning.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Dismiss a day warning I've checked (Priority: P1)

An administrator opens Nutzung, sees "Gateway-Routing: 25.11.2026 – Möglicher
Fehlgriff", follows it to the routing table, finds the cause harmless and
dismisses the warning. The row leaves their list, and the list's head and the
red number on the Admin tab count one less.

**Why this priority**: It is the whole point: the list and the number only help
when they show what still needs a look.

**Independent Test**: In fake mode, give yesterday a routing warning, open
Nutzung as an administrator, dismiss the row, and check list, head count and
Admin tab number.

**Acceptance Scenarios**:

1. **Given** a day warning in the list, **When** the administrator dismisses it,
   **Then** the row leaves the list, and the head count and the Admin tab's
   number drop by one, without leaving the page.
2. **Given** the only mark in the list was that day warning, **When** it is
   dismissed, **Then** the page shows "Alles im Rahmen" as it does with no mark,
   and the Admin tab shows no number.
3. **Given** a dismissed day warning, **When** the administrator opens its day
   table, **Then** the day still carries its Warnung mark.
4. **Given** a dismissed day warning, **When** the administrator reloads the page
   or opens it on another device, **Then** it stays dismissed.

---

### User Story 2 - Other administrators still see it (Priority: P2)

Two maintainers look after a team. One dismisses a day warning; the other still
sees it until they have looked at it themselves.

**Why this priority**: Each maintainer decides for themselves what they have
looked at; one can't hide a warning from the other.

**Independent Test**: With two administrators in fake mode, dismiss as one and
open Nutzung as the other.

**Acceptance Scenarios**:

1. **Given** administrator A dismissed a day warning, **When** administrator B
   opens Nutzung, **Then** B's list, head count and Admin tab number still
   include it.
2. **Given** both administrators dismissed it, **When** either opens Nutzung,
   **Then** neither sees it.

---

### User Story 3 - A new reason brings it back (Priority: P2)

An administrator dismissed a routing day for a possible miss. Later that day the
same day also gets a would-be miss. The day shows in the list again, with both
reasons.

**Why this priority**: A dismissal covers what the administrator looked at, not
whatever comes later.

**Independent Test**: Dismiss a routing day with one reason, add a second reason
to the same day in fake mode, reload.

**Acceptance Scenarios**:

1. **Given** a day warning dismissed with some reasons, **When** the day gets a
   reason it didn't have, **Then** it shows again with all its reasons and
   counts again.
2. **Given** a day warning dismissed for a reason, **When** that same reason only
   grows (two possible misses instead of one), **Then** it stays dismissed.

---

### User Story 4 - Limits can't be dismissed (Priority: P3)

Figures (Hinweis, Warnung, Kritisch), CPU marks and the state hints ("didn't
answer", no device gets alerts) have no dismiss. They leave the list when the
cause goes away.

**Why this priority**: A figure near its limit is a live state; hiding it could
hide a real limit.

**Independent Test**: Open Nutzung with a figure at Warnung and a CPU mark in fake
mode: no row other than day warnings offers dismissing.

**Acceptance Scenarios**:

1. **Given** a figure, CPU or state-hint row in the list, **When** the
   administrator looks at it, **Then** it offers no dismiss.

### Edge Cases

- **Today's day warning**: A day the list shows for today (a routing day can be
  marked while it runs) can be dismissed like yesterday's; a new reason later
  that day brings it back.
- **The day leaves the list**: After yesterday, the day leaves the list for
  everyone anyway (feature 048); its dismissals are no longer needed and go.
- **An administrator loses the Admin role or leaves**: Their dismissals go with
  them; nobody else's list changes.
- **Dismissing fails** (no connection, server error): The row stays, the counts
  stay, and the administrator sees that it didn't work, so they can try again.
- **Dismissing twice** (double tap, two tabs): The result is the same as once.
- **A day warning that went away**: If a day stops being marked (counts
  corrected), it leaves the list as today; a dismissal for it changes nothing.
- **Teams**: A dismissal is for one team's view only; another team's
  administrators, even the same person there, are unaffected.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each day warning row in "Das braucht deinen Blick" (Strava calls,
  ride re-check, gateway routing; today's and yesterday's) MUST offer a way to
  dismiss it.
- **FR-002**: Figure rows, CPU rows and state hints MUST NOT offer it.
- **FR-003**: A dismissed day warning MUST leave the administrator's list and
  MUST NOT count in their list head or in their Admin tab number (feature 048
  FR-004, FR-020). The list's head and the Admin tab number MUST stay equal
  (feature 048 SC-005).
- **FR-004**: Dismissing MUST apply to the administrator who dismissed only, and
  only within their team. It MUST last across reloads and devices.
- **FR-005**: The day's mark in its day table MUST stay, dismissed or not.
- **FR-006**: A dismissal MUST cover the reasons the day had when it was
  dismissed. A reason the day gets later MUST bring the row back, showing every
  reason; a reason that only grows MUST NOT.
- **FR-007**: Dismissing MUST work without leaving the page, and the page MUST
  show the new state at once. A dismissal that didn't go through MUST leave the
  row and say so.
- **FR-008**: Only those who can open the usage view today MUST be able to
  dismiss, and only their own team's day warnings (feature 047 FR-014).
- **FR-009**: Dismissals MUST be deleted once their day has left the list, and
  with the administrator when the team deletes them as a rider. They MUST hold
  no more than who dismissed which kind of day warning, which day and which
  reasons: no Strava data, no counts, nothing about other riders.
- **FR-010**: The dismiss control MUST be reachable and named for screen readers
  and keyboards like the list's other controls, at phone and desktop width.
- **FR-011**: All new text MUST be in the catalogs in all ten languages, German
  as the key source (FR-028 of the project).
- **FR-012**: Nothing about dismissals MUST cross teams or show another team's
  name (feature 026 FR-023).

### Key Entities

- **Dismissal**: one administrator, one team, one kind of day warning (Strava
  calls, ride re-check, gateway routing), one UTC day, the reasons it had when
  dismissed. Kept while the day can show in the list.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An administrator clears a checked day warning from their list in one
  action, without leaving the page.
- **SC-002**: After dismissing, the Admin tab number always equals the count in
  their list's head.
- **SC-003**: A dismissal by one administrator never changes another
  administrator's list or number.
- **SC-004**: A day that gets a new reason after it was dismissed shows again on
  the next page load, in every case.
- **SC-005**: No figure, CPU or state-hint row can be dismissed.

## Assumptions

- The control reads "Gesehen" in German (English "Got it"); the plan or a design
  draft may settle the exact word and its place in the row.
- No undo: a dismissed warning stays visible in its day table, and the table
  shows the day as before.
- Day warnings send no notifications today (feature 048), so dismissing changes
  no notification.
- A dismissal is the administrator's own record of using the admin view, kept at
  most about two days; it reads nothing new from Strava, so it needs no new
  consent. The plan checks whether the privacy notice's list of what the app
  keeps needs a line for it.
- Feature 046's fix that a team's first full list counts no corrections stays the
  way to keep the routing warning from appearing after routing starts; this
  feature is for every other harmless day warning.
