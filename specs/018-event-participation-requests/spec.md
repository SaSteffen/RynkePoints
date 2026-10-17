# Feature Specification: Riders Report Team-Event Participation

**Feature Branch**: `018-event-participation-requests`

**Created**: 2026-10-17

**Status**: Draft

**Mock-up**: Claude Design "RynkePoints Teamtermine melden",
https://claude.ai/artifact/68rCYVhqbt4QyHFqAXQvMC

**Input**: User description: "Let riders request to be added as participant of a
team training. On the team page we add a section for upcoming and past dates and
show how many Team Rynke can be earned by participating. On any of these events add
an 'Ich war dabei' or 'Bin dabei' (for future events) button if the rider is not yet
registered as having taken part. Organisers then see on the riders table a badge
that says the rider requests to be registered at event xyz. Rynke and participation
can only be awarded after the event has ended: 'Bin dabei' only registers intent and
can be withdrawn — the green button turns red on hover and reads 'Doch nicht dabei';
a click unregisters. Unregistering is not possible after the event has ended. The
attendance checkboxes on the event page become tri-state: a greyed-out state shows a
participation request or intent that is not confirmed, with three small example
boxes explaining the states. Organisers need a signal that there are unconfirmed
requests (past events only), a quick way to see for which events, and an easy way
to confirm or deny. Emptying a grey box denies the request. Riders are not told
about pending, confirmed or denied requests; they may request again." Refined the
same day: the events go on a new "Termine" tab shown only to riders who are not
organisers; organisers get an "Ich war auch dabei" button for past events on the
Orga Termine page; the Team page loses the place card and the peloton, and the
Rangliste moves up to where the peloton was.

The look follows feature 012's "full fun" style and is agreed in the Claude Design
mock-up "RynkePoints Teamtermine melden"
(https://claude.ai/artifact/68rCYVhqbt4QyHFqAXQvMC): the rider's new Termine tab
on a phone in light and dark mode, the slimmed Team page, the organiser's Termine
page with open requests and "Ich war auch dabei", the event page with tri-state
boxes for a past and an upcoming event, and the organiser's rider table on a desktop
(including riders with several open requests), all for the sample season on
Thursday 25 March 2027.

## Clarifications

### Session 2026-10-17

- Q: Does "Bin dabei" earn anything? → A: No. It only tells the organisers a rider
  plans to come. Rynke and attendance come only from an organiser recording
  attendance after the event (feature 003 FR-007, feature 014 FR-022).
- Q: Can a rider take it back? → A: Yes, until the event has taken place: the green
  "Bin dabei" button shows "Doch nicht dabei" in red on hover, and a click withdraws
  it. Once the event has taken place the rider can no longer withdraw.
- Q: Are riders told what the organisers decided? → A: No. No message, notification
  or status about pending, confirmed or denied requests. A rider whose request was
  denied sees the "Ich war dabei" button again and may report again.
- Q: How does an organiser deny? → A: By emptying a grey box on the event page and
  saving, or with the quick "Ablehnen" action. A denial leaves no trace.
- Q: Where do riders find the events? → A: On a new "Termine" tab in the app
  navigation, only for riders who are not organisers, in the place organisers have
  "Orga". Organisers manage participation on the Orga page instead.
- Q: How do organisers record their own attendance? → A: With an "Ich war auch
  dabei" button on each past event of the Orga Termine page where they are not
  recorded. A tap records their attendance directly and the button disappears; the
  event then reads "8 Personen, inklusive dir". There is no intent for organisers:
  nothing for upcoming events.
- Q: What happens to the Team page? → A: The place card ("Position 6 von 14") and
  the peloton go; they are not useful. The team total, the quote, the Rangliste and
  the team chart stay, and the Rangliste moves to where the peloton was, above the
  team chart. This amends feature 016.

## User Scenarios & Testing *(mandatory)*

Terms as in features 003 and 014: **team event**, **attendance**, **listed rider**,
**organiser**. New terms:

- A **participation report** is a rider's own statement about a team event: before
  the event it is an **intent** ("Bin dabei"); once the event has taken place it is
  a **request** to have attendance recorded ("Ich war dabei"). It is one stored
  record per rider and event; whether it counts as intent or request follows from
  the event's date.
- An event **has taken place** from its date on (Europe/Berlin), the same boundary
  as feature 014 FR-022 uses for recording attendance.
- An **open request** is a request at an event that has taken place, for a rider
  who is listed and has no attendance there yet.

### User Story 1 - Rider sees the season's team events and what they are worth (Priority: P1)

A rider who is not an organiser opens the "Termine" tab: a note saying the app
can't take their participation from Spond or Strava yet, so they report it here
themselves ("Melde dich hier selbst an"), then the upcoming events ("Demnächst") and the past events of the season ("Vorbei").
Each event shows its date, kind, name and the Team and Training Rynke attendance
earns, with the coin.

**Why this priority**: Riders today learn about team events only outside the app;
seeing the Team Rynke each event earns motivates them to come, and the list is
where the buttons of Stories 2 and 3 live.

**Independent Test**: With synthetic events (`pnpm dev`), sign in as a rider,
check the Termine tab is there (and absent for an organiser), and compare the listed events and their amounts with the stored events and feature
003 FR-007's fixed amounts.

**Acceptance Scenarios**:

1. **Given** four events after today up to the qualification deadline, **When** a
   rider opens Termine, **Then** the note about Spond and Strava comes first and
   "Demnächst" lists the four, soonest first, each with its amounts.
2. **Given** past events of the season, **When** a rider opens Termine, **Then**
   "Vorbei" lists them, newest first, each with its amounts.
3. **Given** a past event where the rider's attendance is recorded, **When** it is
   shown, **Then** it says "Du warst dabei" and has no button.
4. **Given** no upcoming events, **When** a rider opens Termine, **Then**
   "Demnächst" says no team events are planned yet.
5. **Given** an organiser, **When** they look at the navigation, **Then** they see
   "Orga" and no "Termine" tab.

---

### User Story 2 - Rider says they will come, and can change their mind (Priority: P1)

Under an upcoming event the rider taps "Bin dabei". The button turns green with a
tick. Hovering it (or focusing it) turns it red and reads "Doch nicht dabei"; a click
withdraws the intent and the button is back to its default. Nothing is credited.

**Why this priority**: Organisers learn who plans to come; riders commit a little
without anything being credited too early.

**Independent Test**: As a synthetic rider, mark an upcoming event, reload, check
the green state and the stored intent; withdraw it and check it is gone; check no
balance changed.

**Acceptance Scenarios**:

1. **Given** an upcoming event without an intent, **When** the rider taps "Bin
   dabei", **Then** the intent is stored, the button is green with a tick, and the
   rider's balance does not change.
2. **Given** the green button, **When** the pointer is over it or it has keyboard
   focus, **Then** it is red and reads "Doch nicht dabei".
3. **Given** the green button, **When** the rider clicks or taps it, **Then** the
   intent is deleted and the button shows its default "Bin dabei".
4. **Given** an intent at an event that has now taken place, **When** the rider
   opens Termine, **Then** the event is under "Vorbei" with a green "Ich war dabei"
   that cannot be withdrawn, and organisers see an open request.

---

### User Story 3 - Rider reports they were there (Priority: P1)

Under a past event the rider was not recorded for, they tap "Ich war dabei". The
button turns green with a tick and stays so; there is nothing more to do. When an
organiser confirms, the event shows "Du warst dabei" and the rider's balance follows.
If an organiser denies it, the button is back to its default and the rider may
report again.

**Why this priority**: Riders forgotten on the attendance list today have to chase
an organiser; this puts the request where organisers already work.

**Independent Test**: As a synthetic rider, report a past event; check the stored
request and the green state; confirm or deny as an organiser and check the rider's
page and balance in each case.

**Acceptance Scenarios**:

1. **Given** a past event without the rider's attendance or request, **When** they
   tap "Ich war dabei", **Then** the request is stored and the button is green and
   cannot be withdrawn.
2. **Given** an open request, **When** an organiser confirms it, **Then** the
   rider's attendance is recorded and counts as in feature 003 FR-007, and the event
   shows "Du warst dabei".
3. **Given** an open request, **When** an organiser denies it, **Then** the request
   is gone, nothing is recorded, and the rider sees the default "Ich war dabei"
   again and may tap it again.
4. **Given** any decision, **When** it is made, **Then** the rider gets no message,
   notification or text about it.

---

### User Story 4 - Organisers notice open requests and settle them quickly (Priority: P1)

An organiser sees a red count on the Orga entry of the navigation and on the
"Termine" switch. The Termine page starts with "5 offene Meldungen", grouped by
event, each with "Eintragen" and "Ablehnen" (✕) and "Alle n eintragen" per event,
and a "Rückgängig" for the last action. Past events with open requests carry an
"n offen" chip in the list; upcoming events show "n zugesagt". The rider table of
the organiser overview gets a "Rider mit offener Meldung ⏳" tile that filters to riders with
open requests, and each such rider shows one line per open request ("Will eingetragen werden:
Techniktraining · Sa 13.3.", "… Teamtraining · Sa 6.3.") with the same two quick
actions on each line.

**Why this priority**: Requests are only useful if organisers see them without
searching and settle them in a tap.

**Independent Test**: Create synthetic open requests at two past events and intents
at an upcoming one; check every count, chip, tile and row as an organiser; confirm,
deny and undo from the Termine page and from the rider table and check the stored
attendance and requests.

**Acceptance Scenarios**:

1. **Given** 5 open requests at 2 past events, **When** an organiser opens any
   page, **Then** the Orga navigation entry shows 5; **when** they open Orga,
   **Then** the Termine switch shows 5 and the open requests are grouped under the
   two events.
2. **Given** only intents at upcoming events, **When** an organiser looks, **Then**
   no count or alert is shown; the upcoming events show "n zugesagt".
3. **Given** an open request, **When** an organiser taps "Eintragen", **Then** the
   attendance is recorded with the organiser's change record (feature 014 FR-040)
   and the request is gone; "Rückgängig" removes that attendance and restores the
   request.
4. **Given** an event with three open requests, **When** an organiser taps "Alle 3
   eintragen", **Then** all three are recorded at once.
5. **Given** the desktop rider table, **When** an organiser picks "Rider mit
   offener Meldung", **Then** only riders with open requests are shown, each naming
   the event of every open request.
6. **Given** Nora with open requests at three events, **When** an organiser confirms
   one on her row, **Then** only that one is recorded and the other two stay open.
7. **Given** a rider who is not an organiser, **When** they look at any page,
   **Then** they see no count, chip, intent or request of other riders.

---

### User Story 5 - Tri-state boxes on the event page (Priority: P1)

On the event page every listed rider has a box in one of three states, explained by
three small example boxes above the list: empty ("nicht dabei"), grey ("Meldung,
noch offen", or "zugesagt" for an upcoming event) and ticked ("dabei, gibt Rynke").
Riders with a request are listed first and tagged "Meldung offen". Tapping a grey box
ticks it ("wird eingetragen"), tapping again empties it ("wird abgelehnt"), tapping
again makes it grey again. "Teilnahme speichern" applies the changes and says how
many were confirmed, denied and left open. For an upcoming event the boxes cannot be
changed (feature 014 FR-022); grey boxes show who said they will come.

**Why this priority**: The event page is where organisers record attendance today;
the grey state shows requests and intents in place without a separate list.

**Independent Test**: Open a synthetic past event with requests, change boxes in
each direction, save, and check the stored attendance and requests; open an
upcoming event and check the boxes cannot be changed.

**Acceptance Scenarios**:

1. **Given** a past event with requests from Katrin, Emil and Nora, **When** an
   organiser opens it, **Then** the three are listed first with grey boxes tagged
   "Meldung offen", above the three example boxes' explanation.
2. **Given** Katrin's grey box, **When** the organiser ticks it and saves, **Then**
   her attendance is recorded and her request is gone.
3. **Given** Emil's grey box, **When** the organiser empties it and saves, **Then**
   his request is gone and nothing is recorded (denied).
4. **Given** Nora's box left grey, **When** the organiser saves, **Then** her
   request stays open.
5. **Given** a rider without a request, **When** the organiser taps their box,
   **Then** it switches between empty and ticked only, as today.
6. **Given** an upcoming event with six intents, **When** an organiser opens it,
   **Then** the six boxes are grey, tagged "zugesagt", and no box can be changed.
7. **Given** a screen reader, **When** it reaches a grey box, **Then** it is
   announced as partly checked ("mixed") with its tag.

---

### User Story 6 - Organiser adds themselves to a past event (Priority: P2)

On the Orga Termine page, each past event where the viewing organiser is not
recorded carries "Ich war auch dabei". A tap records their attendance at once; the
button disappears and the event reads "8 Personen, inklusive dir". Upcoming events
have no such button.

**Why this priority**: Organisers ride along too and today tick themselves on the
event page; one tap in the list is quicker. They need no request, since they may
record attendance anyway.

**Independent Test**: As a synthetic organiser, tap the button on a past event and
check the stored attendance, its change record, the count and that the button is
gone; check no button appears on upcoming events.

**Acceptance Scenarios**:

1. **Given** a past event with 7 attendees, not including the organiser, **When**
   they tap "Ich war auch dabei", **Then** their attendance is recorded with their
   change record, the button disappears and the event reads "8 Personen, inklusive
   dir".
2. **Given** a past event where the organiser is recorded, **When** the list is
   shown, **Then** it reads "n Personen, inklusive dir" and has no button.
3. **Given** an upcoming event, **When** the list is shown, **Then** it has no
   button for the organiser.

---

### User Story 7 - A leaner Team page (Priority: P2)

The Team page shows the team total, the Training/Team switch, the quote, the
Rangliste and the team chart, in that order. The place card ("Position 6 von 14",
"Noch n Rynke bis zum nächsten Platz") and the peloton are gone.

**Why this priority**: The place card and the peloton add little next to the
Rangliste, and the Team page gets shorter.

**Independent Test**: Open Team as a synthetic rider and check the order of the
sections and that neither the place card nor the peloton is shown.

**Acceptance Scenarios**:

1. **Given** any signed-in rider, **When** they open Team, **Then** they see the
   team total, the switch, the quote, the Rangliste and the team chart, in that
   order, and no place card or peloton.
2. **Given** the Rangliste, **When** it is shown, **Then** it still marks the
   viewer's row and shows the rows around them by default (feature 016 FR-013,
   FR-014).

### Edge Cases

- **Event moved to another date**: the stored report keeps; it counts as intent or
  request by the new date. Moving a past event into the future turns its open
  requests back into intents the riders can withdraw.
- **Event deleted**: its reports are deleted with it (like its attendance, feature
  014 FR-013).
- **Attendance recorded without a request** (ticked on the event page): any intent
  or request of that rider at the event is deleted at the same time; the rider sees
  "Du warst dabei".
- **Attendance removed later** by an organiser: the rider sees the default "Ich war
  dabei" again (no report is recreated).
- **Two organisers at once**: confirming or denying a request another organiser
  settled meanwhile changes nothing and says so; recording attendance twice still
  credits once (feature 014 FR-021).
- **Rider taps "Ich war dabei" by mistake**: they cannot withdraw it; an organiser
  denies it.
- **Rider without a current consent or who must reconnect**: not listed (feature 004
  FR-021); their reports are not shown or counted anywhere and cannot be confirmed
  until they are listed again. Reports of a rider who leaves are deleted with them.
- **Event outside the counting window** (feature 003 FR-011): not shown on Termine and
  takes no reports.
- **Touch screens without hover**: the green "Bin dabei" button reads "Bin dabei"
  with a tick; a tap withdraws it, and a tap brings it back.
- **The event day itself**: the event has taken place from its date on; "Bin dabei"
  becomes "Ich war dabei" that morning and can no longer be withdrawn.
- **Many past events**: "Vorbei" shows the five newest and a button for all.

## Requirements *(mandatory)*

### Functional Requirements

**Rider: the Termine tab**

- **FR-001**: Every signed-in rider who is not an organiser MUST find a "Termine"
  tab in the app navigation (feature 011), in the place where organisers have "Orga"
  (feature 016 FR-002); organisers MUST NOT see it. It MUST show the season's team
  events inside the counting window
  (feature 003 FR-011): "Demnächst" (not yet taken place, soonest first) and
  "Vorbei" (taken place, newest first; the five newest, then a control for all).
- **FR-002**: Each event MUST show its date, kind, name (if any) and the Team and
  Training Rynke its attendance earns (feature 003 FR-007), with the coin (feature
  012).
- **FR-003**: The Termine tab MUST start with a note that the app can't take
  participation from Spond or Strava yet and that riders report it here themselves.
  It MUST NOT show sums of the Rynke the upcoming events hold.
- **FR-004**: For an event that has not taken place the rider MUST get a "Bin dabei"
  button that stores their intent. With an intent the button MUST be green with a
  tick; while hovered or focused it MUST be red and read "Doch nicht dabei"; a click
  or tap MUST delete the intent and show the default button again.
- **FR-005**: For an event that has taken place and where the rider has no
  attendance, the rider MUST get an "Ich war dabei" button that stores a request.
  With a request (or an intent made before the event) the button MUST be green with
  a tick and MUST NOT withdraw anything.
- **FR-006**: For an event where the rider's attendance is recorded, the event MUST
  read "Du warst dabei" and show no button.
- **FR-007**: The section MUST say that "Bin dabei" only tells the organisers and
  that Rynke come once the event has taken place and an organiser has recorded the
  attendance.
- **FR-008**: A report MUST NOT earn Rynke, count as attendance, or change any
  balance, badge, leaderboard or overview figure (features 003, 013, 016).
- **FR-009**: Riders MUST NOT be told about decisions: no message, notification,
  push (feature 010) or status about a request being open, confirmed or denied.
- **FR-010**: Other riders' intents and requests MUST NOT be shown to a rider in any
  form, counts included (feature 004 FR-020).

**Reports**

- **FR-020**: There MUST be at most one report per rider and event. Whether it is an
  intent or a request MUST follow from the event's date: from its date on (Europe/
  Berlin) it is a request.
- **FR-021**: Only the rider themselves MUST be able to create a report, only if
  they are not an organiser, and only for an event in the counting window where they
  have no attendance. Only they MUST
  be able to delete an intent; nobody can delete their own request.
- **FR-022**: Recording a rider's attendance at an event (by any means) MUST delete
  their report there. Deleting an event MUST delete its reports. A rider who leaves
  MUST have their reports deleted with their other data (feature 001 FR-022).
- **FR-023**: Denying a request MUST delete it and leave no record; the rider MAY
  report again.

**Organisers: signals and quick decisions**

- **FR-030**: Organisers MUST see the number of open requests (past events, listed
  riders, no attendance yet) on the Orga navigation entry and on the Orga page's
  "Termine" switch, on every page; nothing when it is 0. Intents MUST NOT add to it.
- **FR-031**: The Termine page MUST start with the open requests grouped by event
  (kind and date, newest event first), each rider by first name with a "View on
  Strava" link where first names clash (feature 004 FR-022), with "Eintragen" and
  "Ablehnen" actions, "Alle n eintragen" per event with more than one, and a link to
  the event page.
- **FR-032**: After each quick action the page MUST offer "Rückgängig", which
  restores the previous state (attendance removed and request restored, or request
  restored).
- **FR-033**: The event list MUST mark past events with open requests ("n offen")
  and upcoming events with intents ("n zugesagt").
- **FR-034**: The organiser overview's rider list (feature 016 FR-032) MUST get a
  "Rider mit offener Meldung" tile counting riders with open requests that filters to them, and
  MUST show each open request on the rider's row or card, naming the event, with the
  same quick actions. A rider with several open requests MUST show each one with its
  own actions; the tile counts riders, the navigation count (FR-030) requests. Riders
  with open requests MUST come first when all riders are shown.
- **FR-035**: Confirming MUST record attendance exactly as feature 014 FR-021 does,
  with its change record (FR-040), and take effect through feature 003 (FR-003).
- **FR-036**: Each event on the Termine page that has taken place and where the
  viewing organiser has no attendance MUST offer "Ich war auch dabei", which records
  their attendance as in FR-035 and then disappears. Events that have not taken
  place MUST NOT offer it. Each past event MUST read "n Personen", with ", inklusive
  dir" when the viewing organiser is recorded.

**Organisers: tri-state boxes**

- **FR-040**: On the event page each listed rider's box MUST be in one of three
  states: empty (no attendance), grey (an intent or request, no attendance) or
  ticked (attendance). Three example boxes with short labels MUST explain them above
  the list.
- **FR-041**: For a past event, riders with an open request MUST be listed first
  and tagged; tapping such a
  rider's box MUST cycle grey → ticked → empty → grey; tapping any other
  box MUST switch between empty and ticked. Each changed request MUST be tagged
  "wird eingetragen" or "wird abgelehnt" until saved.
- **FR-042**: Saving MUST record attendance for ticked boxes, deny requests whose
  box was emptied, leave grey boxes open, and say how many were confirmed, denied and
  left open. It MUST keep feature 014's rule of applying only this organiser's
  changes.
- **FR-043**: For an event that has not taken place the boxes MUST NOT be
  changeable (feature 014 FR-022); intents MUST show as grey boxes tagged "zugesagt"
  with their count.
- **FR-044**: Grey MUST be told apart from empty and ticked by more than colour (a
  dashed border and a light tick, plus the tag) and MUST be exposed to assistive
  technology as a partly checked ("mixed") checkbox.

**Team page (amends feature 016)**

- **FR-045**: The Team page MUST NOT show the place card (feature 016 FR-016) or the
  peloton with its breakaway (feature 016 FR-017's peloton, FR-018).
- **FR-046**: The Team page MUST show, in this order: the team total, the
  Training/Team switch, the quote, the Rangliste (feature 016 FR-012–FR-015) and
  the team chart.

**General**

- **FR-050**: All text MUST come from the i18n catalogs in German and English
  (feature 001 FR-028), addressing the rider as "du".
- **FR-051**: Every page of this feature MUST work at 360 px width in light and dark
  mode without horizontal scrolling, with touch targets of at least 44 px.
- **FR-052**: The privacy page (feature 017) and the consent text (feature 004) MUST
  say that organisers see a rider's intents and requests by first name.

### Key Entities

- **Participation report**: rider, team event, when it was made. An intent before
  the event's date, a request from it on (FR-020). Gone when the attendance is
  recorded, the request denied, the intent withdrawn, the event deleted or the rider
  leaves. Holds no decision.
- **Team Event**, **Attendance**, **Change Record**: as in features 003 and 014.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A rider can report an event in one tap from Termine, and withdraw an
  intent in one more.
- **SC-002**: An organiser can see which events have open requests within 5 seconds
  of opening the app, and settle five requests at two events on a phone in under a
  minute.
- **SC-003**: No report ever changes a balance, badge or leaderboard figure; only
  recorded attendance does (synthetic tests).
- **SC-004**: No page shown to a rider who is not an organiser contains another
  rider's intent or request, or a count of them.
- **SC-005**: After a month, organisers say fewer riders ask them in person to be
  added to an event (owner's judgement).

## Assumptions

- Features 003, 004, 011, 012, 014 and 016 are in place; the Team page and the
  organiser overview are those of feature 016, the event page that of feature 014.
- An event has no time of day, so "taken place" is by date, as for recording
  attendance today (feature 014 FR-022).
- Organisers get no push notification about requests; the counts in the app are
  enough. Riders get none either (FR-009).
- How many riders said "Bin dabei" is shown only to organisers.
- The mock-up's figures are a synthetic sample season.
