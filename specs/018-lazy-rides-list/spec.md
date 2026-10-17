# Feature Specification: Lazy-Loading Rides List

**Feature Branch**: `018-lazy-rides-list`

**Created**: 2026-10-17

**Status**: Draft

**Input**: User description: "i want to make the rides list a lazy loading list".
Agreed before specifying: the next rides load automatically as the rider scrolls
(no "load more" button), and the existing pager stays as the fallback where the
page script doesn't run.

## Context

Rides (`/me/rides`, feature 011 FR-012) shows the rider's rides of the season as
cards, 20 a page, with "« Neueste", "‹ Neuere", "Ältere ›" and "Älteste »" links
and a line "Fahrten 21–40 von 87" (feature 005 US5). Each page is a full round
trip, the rider lands at the top of the new page and loses their place in the
list. Over a season a rider collects well over a hundred rides, so looking back
means many taps and many page loads.

This feature turns Rides into one continuous list: it opens with the newest rides,
and older rides are added below as the rider scrolls towards the end, until the
season's first ride is shown.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Scroll through all rides (Priority: P1)

A rider opens Rides and sees their newest rides, as today. When they scroll
towards the end of the list, the next older rides appear below without a tap and
without the page jumping, so they can keep scrolling back through the season in
one go. When the season's first ride is shown, the list simply ends.

**Why this priority**: It is the feature. Everything else only keeps it from
breaking what works today.

**Independent Test**: Sign in as a synthetic rider with 87 rides in the season,
open Rides, scroll to the end repeatedly and check that all 87 rides appear once
each, newest first, without a page load and without using the pager.

**Acceptance Scenarios**:

1. **Given** a rider with 87 rides in the season, **When** they open Rides,
   **Then** they see their 20 newest rides, newest first, exactly as today's
   first page shows them.
2. **Given** the same rider, **When** they scroll so the end of the list comes
   near, **Then** the next 20 older rides appear below the last one without a tap,
   and the rides already shown stay where they are on screen.
3. **Given** the rider keeps scrolling, **When** rides 81–87 have been added,
   **Then** no further rides are requested and the list ends with the season's
   first ride.
4. **Given** rides are being added, **When** the rider looks at the end of the
   list, **Then** they see that more rides are loading until they appear.
5. **Given** an added ride, **When** the rider looks at its card, **Then** it shows
   everything a card shows today (feature 011 US2 scenario 2), and its reasons
   start closed or open by the same rule and open and close with a tap.
6. **Given** a rider with 20 or fewer rides, **When** they open Rides, **Then**
   all their rides are shown and nothing more is ever loaded.
7. **Given** the page script runs, **When** Rides is shown, **Then** the pager
   links are not shown; the position line counts the rides shown so far
   ("Fahrten 1–40 von 87") and grows as rides are added.

---

### User Story 2 - Keep my place (Priority: P2)

A rider who has scrolled far back taps "Auf Strava ansehen" on an old ride, or
switches to another app, and comes back. They find the list as they left it: the
same rides loaded and the same ride in view, not the newest 20 at the top.

**Why this priority**: Without it, a continuous list is worse than pages for
exactly the riders who use it most: every trip to Strava and back, or every
reload after a minute in the background (feature 011 FR-009), throws them back to
the top.

**Independent Test**: Scroll Rides down to ride 65, follow "Auf Strava ansehen",
go back; then scroll to ride 65 again, put the app in the background for over a
minute and return. Both times ride 65 is in view.

**Acceptance Scenarios**:

1. **Given** a rider who scrolled until ride 65 is in view, **When** they leave
   Rides for another page or app and come back with the back button, **Then**
   ride 65 is in view again, with the rides above it shown.
2. **Given** the same rider, **When** Rides reloads after more than a minute in
   the background (feature 011 FR-009), **Then** the figures are current and ride
   65 is in view again.
3. **Given** a rider who reached ride 65, **When** they open Rides from the
   navigation bar, **Then** Rides opens at the top with the newest rides, as a
   fresh visit.
4. **Given** a rider on Rides, **When** they reload the page themselves, **Then**
   they stay at the same ride, as with any other page.

---

### User Story 3 - Works without the page script (Priority: P3)

Where the page script doesn't run (blocked, failed, a very old browser), Rides
works exactly as today: 20 rides a page with the pager links. Addresses with a
page (`/me/rides?page=3`, and `/me?page=3` from feature 005) keep opening that
page of rides.

**Why this priority**: It's what the site already does; the requirement is only
not to lose it, and to keep old and shared addresses working.

**Independent Test**: Open Rides with scripts turned off and page through all
rides with the pager; open `/me/rides?page=3` with and without scripts.

**Acceptance Scenarios**:

1. **Given** the page script doesn't run, **When** the rider opens Rides, **Then**
   they see the first 20 rides, the position line and the pager, as today.
2. **Given** a rider opens `/me/rides?page=3`, **When** the page script runs,
   **Then** they see rides 41–60, a link to the newest rides above them, and
   older rides load as they scroll down.
3. **Given** `/me?page=3`, **When** it is opened, **Then** it leads to
   `/me/rides?page=3` as today (feature 011 FR-006).

---

### Edge Cases

- **A ride arrives or is removed while the rider scrolls**: a new ride worked out,
  a ride deleted on Strava or a rider's correction between two loads MUST NOT make
  a ride appear twice or be skipped in the list. A ride that newly arrived shows up
  the next time Rides is opened or reloaded; it is not slipped into the open list.
- **A ride's figures change while the list is open** (re-evaluation, organiser
  correction): the list shows each ride as it was when it was loaded; reloading
  shows the current figures, as today.
- **Loading fails** (offline, server error, session expired): the rides shown
  stay; at the end of the list the rider sees that the older rides couldn't be
  loaded, with a way to try again. Loading is tried again by itself when the
  connection returns or the rider scrolls to the end again. An expired session
  leads to sign-in as any other Rides request does.
- **Fast scrolling or flinging to the end**: never more than one load at a time;
  rides arrive in order.
- **The rider is no longer allowed to see Rides** (left, deauthorised, consent
  gate): further loads return no rides of that rider and the open page leads to
  where Rides would lead now.
- **Waiting state** (feature 015 US1) and **no rides in the season**: unchanged;
  nothing is lazy-loaded.
- **A rules update is still being applied** (the notice above the list, feature
  005): unchanged; it stays above the list.
- **Keyboard and screen reader users**: moving focus to the end of the list loads
  more just like scrolling; added rides are announced as added without moving
  focus; the "loading" and "couldn't load" states are announced.
- **Very long lists**: a rider with a few hundred rides can scroll to the first
  one without the page becoming noticeably slower to scroll on a mid-range phone.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Rides MUST open with the 20 newest rides of the season, newest
  first, as today's first page.
- **FR-002**: When the end of the shown rides comes within about one screen
  height of the visible area, the next 20 older rides MUST be added below the
  last shown ride, without a tap and without a page load.
- **FR-003**: Adding rides MUST NOT move the rides already shown on screen.
- **FR-004**: Loading MUST stop once the season's first ride is shown; no request
  for more rides is made after that.
- **FR-005**: While rides are loading, the end of the list MUST show that more
  rides are coming.
- **FR-006**: An added ride MUST be rendered exactly as a ride on the first page
  (all facts, the "Auf Strava ansehen" link, reasons and their open/closed rule).
- **FR-007**: Each ride of the season MUST appear exactly once in the list, in
  order, even when rides are worked out, changed or removed between two loads.
- **FR-008**: Only one load MUST be in progress at a time.
- **FR-009**: When a load fails, the rides shown MUST stay, the end of the list
  MUST say that older rides couldn't be loaded and offer to try again, and loading
  MUST resume by itself when the connection returns or the rider scrolls to the
  end again.
- **FR-010**: Loading more rides MUST only ever return the signed-in rider's own
  rides, under the same sign-in and consent checks as Rides itself; without them
  it MUST return no rides.
- **FR-011**: Loading more rides MUST NOT cause any request to Strava.
- **FR-012**: When the page script runs, the pager links MUST NOT be shown, and
  the position line MUST count the rides shown so far against the season's total
  and update as rides are added.
- **FR-013**: Coming back to Rides with the back button, or Rides reloading after
  time in the background or by the rider's own reload, MUST show the rides loaded
  before and bring the same ride into view. Opening Rides from the navigation bar
  MUST start at the top.
- **FR-014**: Opening `/me/rides?page=N` with N > 1 MUST show that page's rides,
  a link to the newest rides above them, and add older rides on scrolling as in
  FR-002.
- **FR-015**: Where the page script doesn't run, Rides MUST behave as before this
  feature: 20 rides a page, position line and pager links (feature 005 US5,
  feature 011 FR-012).
- **FR-016**: `/me?page=N` and `/me/rides?page=N` MUST keep their current meaning
  (feature 005 contracts, feature 011 FR-006).
- **FR-017**: Keyboard focus reaching the end of the list MUST load more like
  scrolling does; added rides, the loading state and a failed load MUST be
  announced to assistive technology without moving focus.
- **FR-018**: Every new text (loading, couldn't load, try again, link to newest
  rides) MUST come from the message catalogs in every language, addressing the
  rider as "du" (FR-028 of earlier features, constitution "Language").
- **FR-019**: The waiting state, the empty-season text and the notices above the
  list MUST stay as they are.

### Key Entities

- **Ride batch**: up to 20 consecutive rides of the signed-in rider's season, in
  the list's order, and whether older rides follow. Nothing new is stored; it is a
  view of the rides Rides already shows.
- **List position**: how far a rider has loaded and scrolled in Rides, kept only
  in that rider's browser for the current visit, so they can come back to it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A rider with 150 rides reaches their season's first ride by
  scrolling alone, with no tap and no full page load.
- **SC-002**: On a typical mobile connection, scrolling at reading speed never
  reaches the end of the shown rides before the next ones are there.
- **SC-003**: In a test that works out, changes and removes rides between loads,
  every ride of the season appears exactly once, in order.
- **SC-004**: After going to Strava and back, or returning after more than a
  minute in the background, the ride the rider last looked at is in view in 100%
  of the test runs.
- **SC-005**: With the page script turned off, every acceptance scenario of
  feature 005 US5 for Rides still passes unchanged.
- **SC-006**: Scrolling stays smooth on a mid-range phone with 300 rides loaded.

## Assumptions

- Batches stay at 20 rides, the same size as today's pages, so a no-script page
  and a batch show the same rides.
- "Coming back to my place" only covers the same browser tab in the same visit;
  nothing about a rider's position is stored on the server or across devices.
- A newly worked-out ride doesn't appear in an open list; it appears on the next
  open or reload. This matches how the rest of the app shows new data.
- The list never unloads rides above the view to save memory; one season is at
  most a few hundred rides.
- Organiser pages and the Overview are unchanged; this feature only changes
  Rides.
- No new data is stored and nothing new is shown to anyone but the rider, so the
  consent text and version are unchanged (constitution Principle I).
