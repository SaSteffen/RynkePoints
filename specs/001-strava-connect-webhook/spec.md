# Feature Specification: Strava Connection and Webhook Activity Intake

**Feature Branch**: `001-strava-connect-webhook`

**Created**: 2026-10-06

**Status**: Draft

**Input**: User description: "rider connects with Strava and activities arrive via webhook"

## Clarifications

### Session 2026-10-06

- Q: Who may connect? → A: Only members of the Strava club "TRHH Rynke Coins"
  (https://www.strava.com/clubs/2372209). A rider who leaves the club is
  disconnected.
- Q: Should private ("Only You") activities be read? → A: The rider chooses on
  Strava's approval screen; the app works with either level.
- Q: Should past activities be imported on connecting? → A: Yes, back to a season
  start date set by an organiser.
- Q: Which languages should the rider pages ship with, and how is the language
  picked? → A: German and English both ship now, from translation strings; the
  language follows the browser's preferred languages, German by default.
- Q: Can riders pick the language themselves? → A: Yes, via an in-app language
  switcher on every rider-facing page; the choice is remembered in the browser and
  overrides the browser's preferred languages.
- Q: Which language does a browser get that names only languages the app doesn't
  provide (e.g. Danish)? → A: English. German is only chosen when the browser
  explicitly prefers it; German stays the default when the browser names no
  language at all.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Rider connects their Strava account (Priority: P1)

A Team Rynkeby Hamburg rider who is a member of the team's Strava club
"TRHH Rynke Coins" opens the RynkePoints page, sees what the app will do with their
data, and presses "Connect with Strava". Strava asks them to approve read access to
their activities, and lets them choose whether that includes their private ("Only
You") activities. After approving, they land back on RynkePoints and see that their
account is connected, which permissions they granted, that their rides since the
season start are being imported, and that new rides will be picked up automatically
from now on.

**Why this priority**: Nothing else in RynkePoints (points, events, description
updates) can work until a rider has connected and consented. This is the entry point
for every rider and the moment consent is captured.

**Independent Test**: Can be fully tested by a rider completing the connect flow
against a simulated Strava and seeing a "connected" status page; delivers a
registered, consenting rider record even before any activity arrives.

**Acceptance Scenarios**:

1. **Given** a club member who has never connected, **When** they press "Connect
   with Strava" and approve read access to their activities, **Then** they return
   to RynkePoints, see a confirmation that they are connected, and see which
   permissions they granted.
2. **Given** a club member on the Strava approval screen, **When** they approve
   activity access but untick access to private activities, **Then** they are
   connected and their page states that "Only You" activities will not be
   imported.
3. **Given** a rider on the Strava approval screen, **When** they decline or untick
   read access to their activities, **Then** they return to RynkePoints, no rider
   record or credentials are kept, and they see a plain explanation that the app
   cannot work without that permission plus an option to try again.
4. **Given** a rider who is already connected, **When** they go through the connect
   flow again, **Then** their existing connection is updated (not duplicated) and
   the granted permissions shown reflect their latest choice.
5. **Given** the app has reached the number of riders Strava currently allows it to
   connect, **When** another rider tries to connect, **Then** they see a friendly
   message that the team is full for now instead of an error page.
6. **Given** a Strava athlete who is not a member of the team club (including one
   whose request to join is still pending), **When** they complete the Strava
   approval, **Then** RynkePoints revokes the access just granted, keeps no rider
   record or credentials, and shows a message with a link to the club explaining
   that only club members can take part.
7. **Given** a newly connected club member, **When** the connection completes,
   **Then** their cycling activities from the season start date onward are
   imported in the background, and their page shows that the import is in
   progress until it finishes.

---

### User Story 2 - New activities arrive automatically (Priority: P1)

After connecting, the rider simply keeps using Strava as usual. When they upload a
ride, RynkePoints is notified by Strava, fetches the key figures of that ride, and
stores them. When the rider edits the ride on Strava (e.g. changes the sport type),
the stored figures follow; when they delete it on Strava, it disappears from
RynkePoints too. The rider never has to press a "sync" button.

**Why this priority**: This is the data pipeline that every later feature (points,
event participation) is built on. Together with Story 1 it forms the MVP.

**Independent Test**: Can be tested by sending simulated Strava notifications for
create, update and delete of an activity belonging to a connected rider and checking
the stored activity records after each one.

**Acceptance Scenarios**:

1. **Given** a connected rider, **When** Strava reports a new cycling activity for
   them, **Then** RynkePoints stores that activity's key figures (sport type, start
   date and time, distance, moving time, elevation gain) linked to the rider.
2. **Given** a stored activity, **When** Strava reports that the activity was
   updated, **Then** the stored figures are refreshed to match Strava's current
   state.
3. **Given** a stored activity, **When** Strava reports that the activity was
   deleted, **Then** the stored activity is removed.
4. **Given** a stored activity, **When** Strava delivers the same notification a
   second time, **Then** the result is identical to receiving it once (no duplicate
   activity, no changed figures).
5. **Given** a connected rider, **When** Strava reports a non-cycling activity
   (e.g. a run), **Then** nothing is stored for it.
6. **Given** a notification about an athlete who is not a connected rider, **When**
   it arrives, **Then** it is acknowledged and ignored without contacting Strava.

---

### User Story 3 - Rider leaves and their data is removed (Priority: P2)

A rider decides they no longer want to take part. They revoke RynkePoints' access in
their Strava settings, press "Disconnect and delete my data" on their RynkePoints
page, or leave the team's Strava club. In every case everything RynkePoints holds
about them — their credentials, their profile link, and all their activity records —
is deleted.

**Why this priority**: Required by the project constitution and Strava's API
Agreement before any real rider is invited, but not needed to demonstrate the data
pipeline itself.

**Independent Test**: Can be tested by connecting a simulated rider, importing a few
activities, then triggering a deauthorization notification (or the disconnect
button) and verifying no record of that rider remains.

**Acceptance Scenarios**:

1. **Given** a connected rider with stored activities, **When** Strava reports that
   the rider revoked access, **Then** all of that rider's credentials and activity
   records are permanently deleted.
2. **Given** a connected rider on their RynkePoints page, **When** they press
   "Disconnect and delete my data" and confirm, **Then** RynkePoints revokes its
   access at Strava, permanently deletes all their data, and shows them a
   confirmation.
3. **Given** a connected rider with stored activities, **When** they leave the team
   club on Strava, **Then** within 24 hours RynkePoints revokes its access at
   Strava and permanently deletes all their data.
4. **Given** a rider whose data was deleted, **When** they connect again later,
   **Then** they start as a new rider with no leftover data from before.
5. **Given** a rider whose connection needs to be renewed, **When** they have not
   reconnected 7 days later, **Then** RynkePoints permanently deletes all their
   data.

---

### User Story 4 - Rider checks what has been imported (Priority: P3)

A connected rider returns to RynkePoints and sees their connection status and a list
of their most recently imported activities (date, sport type, distance, elevation
gain), so they can confirm that their rides are arriving.

**Why this priority**: Builds rider trust and makes the pipeline observable without
admin tools, but points and leaderboards will eventually be the main view.

**Independent Test**: Can be tested by signing in as a connected rider with some
stored activities and checking that the page shows exactly that rider's activities
and no one else's.

**Acceptance Scenarios**:

1. **Given** a connected rider with stored activities, **When** they open their
   RynkePoints page, **Then** they see their connection status and their most
   recent activities, newest first.
2. **Given** two connected riders, **When** one opens their page, **Then** they see
   only their own activities.
3. **Given** a visitor who is not signed in, **When** they open a rider page,
   **Then** they are asked to sign in with Strava and see no rider data.

---

### Edge Cases

- **Out-of-order notifications**: an update arrives before the create, or a create
  arrives after a delete. The stored state always reflects Strava's current state
  of the activity at processing time; an activity that no longer exists at Strava
  is not stored.
- **Activity becomes inaccessible**: the rider changes an activity's visibility so
  that RynkePoints' granted permission no longer covers it. It is treated like a
  deletion.
- **Rider narrows their permission**: a rider who had granted private-activity
  access reconnects without it. All stored "Only You" activities of that rider are
  removed.
- **Rider widens their permission**: a rider reconnects and now grants
  private-activity access. Their private cycling activities since the season start
  are imported.
- **Membership check cannot be answered**: Strava is unavailable or the rider's
  access is temporarily unusable during a club check. The rider stays connected;
  only a definitive "not a member" answer leads to disconnection. This includes an
  already connected rider signing in again: they are signed in as usual. A new
  rider whose check cannot be answered is not connected and is asked to try again
  later.
- **Season start date changes**: changing the date does not delete or re-import
  anything by itself; it only affects imports started afterwards.
- **Live activity during import**: a new activity reported while the past-season
  import is still running is stored exactly once.
- **Activity changes sport type**: a stored ride changed to a non-cycling type is
  removed; a non-cycling activity changed to a cycling type is stored.
- **Strava rate limit reached**: notifications keep being acknowledged; fetching
  the details is deferred and retried later. No notification is lost.
- **Strava temporarily unavailable**: same as rate limit — deferred and retried
  with increasing delays, never dropped silently.
- **Rider's access expired or revoked without a notification**: the rider's
  connection is marked as needing reconnection, their page tells them so, and their
  pending activity fetches are dropped rather than retried forever. If they
  reconnect, their rides since the season start are imported again, so nothing
  uploaded in between is missed. If they haven't reconnected after 7 days, they are
  disconnected and their data deleted (FR-020).
- **Forged notifications**: notifications that did not come from the app's Strava
  subscription have no effect.
- **Burst of activities** (e.g. a rider bulk-uploads after a tour): all are
  eventually stored without exceeding Strava's limits.
- **Notification for a rider who is mid-deletion**: does not resurrect any data.
- **Browser prefers an unsupported language** (e.g. Danish only): pages are shown
  in English. If it also lists a provided language (e.g. Danish, then German),
  that one is used.
- **Picked language no longer provided** (e.g. a language is removed later): the
  remembered choice is ignored and the language is chosen as in FR-029.
- **Rider uses another browser or device**: the language choice is per browser, so
  it falls back to FR-029 there until the rider picks again.

## Requirements *(mandatory)*

### Functional Requirements

**Connecting and consent**

- **FR-001**: The system MUST let a rider start a connection to their Strava
  account from a public RynkePoints page, using Strava's official "Connect with
  Strava" button and attribution in the variant matching the page language
  (FR-028).
- **FR-002**: Before redirecting to Strava, the system MUST tell the rider in plain
  language which data will be read, what it is used for, how to leave, and how
  long deleted data remains in the hosting platform's backups (FR-022a).
- **FR-003**: The system MUST request only the permission to read the rider's
  activities, at the level defined in FR-005; it MUST NOT request permission to
  edit activities in this feature.
- **FR-004**: Only members of the configured team Strava club (initially
  "TRHH Rynke Coins", https://www.strava.com/clubs/2372209) MUST be able to
  connect. Membership MUST be checked when the rider connects; a non-member's
  newly granted access MUST be revoked at Strava and nothing about them kept. If
  an already connected rider signs in again and is definitively not a member,
  their data MUST be deleted as in FR-022.
- **FR-004a**: The system MUST re-check each connected rider's club membership at
  least once every 24 hours. When Strava definitively reports the rider is no
  longer a member, the system MUST revoke its access at Strava and delete the
  rider's data as in FR-022. Inconclusive checks (Strava unavailable, rate limit)
  MUST NOT disconnect anyone.
- **FR-005**: The system MUST ask for access to the rider's activities including
  private ("Only You") ones, and MUST let the rider decline the private part on
  Strava's approval screen. It MUST then only store activities covered by the
  permission the rider actually granted, and MUST show the rider which level is in
  effect.
- **FR-006**: The system MUST record which permissions the rider actually granted
  and when, and MUST treat a connection without activity-read permission as not
  connected (keeping no credentials). For an already connected rider who signs in
  again without that permission, this means deleting their data as in FR-022.
- **FR-007**: Re-connecting an already connected rider MUST update their existing
  record and granted permissions rather than create a second rider. If the new
  permission no longer covers private activities, stored private activities MUST be
  removed; if it newly covers them, they MUST be imported as in FR-021.
- **FR-008**: The system MUST show a friendly "team is full" message when Strava
  refuses the connection because the app's athlete capacity is reached.
- **FR-009**: Signing in to RynkePoints MUST happen through the same Strava
  approval; the system MUST NOT keep its own passwords.

**Receiving activities**

- **FR-010**: The system MUST receive activity notifications (created, updated,
  deleted) and deauthorization notifications from Strava's push subscription; it
  MUST NOT poll Strava for new activities.
- **FR-011**: The system MUST acknowledge every notification within 2 seconds,
  regardless of how long processing takes, and MUST NOT contact Strava while
  acknowledging.
- **FR-012**: The system MUST ignore notifications that cannot be verified as
  coming from its own Strava subscription, and notifications for athletes who are
  not connected riders.
- **FR-013**: For created and updated activities, the system MUST fetch the
  activity's current state from Strava and store only: Strava activity ID, owning
  rider, sport type, start date and time (with the rider's local time zone),
  distance, moving time and total elevation gain.
- **FR-014**: The system MUST NOT store GPS tracks, route maps/polylines, start or
  end coordinates, photos, heart rate, power, or any other activity data not listed
  in FR-013.
- **FR-015**: The system MUST store only cycling activities (all Strava ride
  sport types, including virtual, e-bike, gravel and mountain-bike rides) and MUST
  discard all other sport types without storing them.
- **FR-016**: For deleted activities, and for activities that are no longer
  accessible or no longer cycling, the system MUST remove the stored record.
- **FR-017**: Processing MUST be idempotent: receiving the same notification any
  number of times, or in any order relative to other notifications for the same
  activity, MUST leave the stored activity matching Strava's current state with
  exactly one record per activity.
- **FR-018**: The system MUST stay within Strava's request limits: when a limit is
  reached it MUST pause fetching and retry later, and MUST NOT drop the pending
  work.
- **FR-019**: Failed fetches MUST be retried with increasing delays; after
  retries are exhausted, the failure MUST be recorded so an organiser can see it,
  and retried at least daily for 7 days from the first failure. Giving up after
  that MUST also be recorded.
- **FR-020**: The system MUST renew a rider's expiring Strava access automatically;
  if renewal is refused, it MUST mark the rider as needing to reconnect and stop
  fetching for them. When the rider reconnects, their activities since the season
  start MUST be imported again as in FR-021. A rider who still needs to reconnect
  7 days after being marked MUST be disconnected and their data deleted as in
  FR-022.
- **FR-021**: On connecting, the system MUST import the rider's cycling activities
  that started on or after the configured season start date, applying the same
  storage rules as FR-013–FR-015. The import MUST be throttled so it never bursts
  past Strava's limits, MUST NOT delay live activity processing beyond SC-002, and
  MUST resume after interruptions without creating duplicates.
- **FR-021a**: Organisers MUST be able to set the season start date and the team
  club as configuration, without code changes.

**Leaving and deletion**

- **FR-022**: On a deauthorization notification from Strava, the system MUST
  permanently delete the rider's credentials, rider record and all their activity
  records (no soft delete, no anonymised remainder).
- **FR-022a**: Deletion removes the data from the live database immediately.
  Copies in the hosting platform's always-on backup history cannot be deleted by
  the app and expire after at most 7 days. The system MUST NOT restore deleted
  riders from that history, and MUST state this retention in the rider-facing
  privacy text (FR-002) and on the deletion confirmation (FR-023).
- **FR-023**: A signed-in rider MUST be able to disconnect and delete their data
  from their RynkePoints page; the system MUST revoke its access at Strava and then
  perform the same deletion as FR-022.
- **FR-024**: Deletion MUST also cancel or neutralise any pending work for that
  rider so that no data is recreated afterwards.

**Rider view**

- **FR-025**: A signed-in rider MUST be able to see their connection status,
  granted permissions (including whether private activities are covered), whether
  the past-season import is still running, and their most recently imported
  activities (at least the last 20), newest first.
- **FR-026**: A rider MUST only ever see their own activities in this feature; no
  other rider's data is shown to anyone.

**Security**

- **FR-027**: Rider Strava credentials MUST be stored encrypted and MUST never be
  shown in pages, logs or error messages.

**Language**

- **FR-028**: All rider-facing text (pages, button labels, status, confirmation
  and error messages, privacy text) MUST come from translation strings, not be
  written directly into pages or logic. German and English MUST both be provided,
  and every rider-facing message MUST exist in both.
- **FR-029**: Unless the visitor has picked a language (FR-029a), the page
  language MUST follow the browser's preferred languages: the provided language the
  browser prefers most; English when the browser names only languages that are not
  provided; German when the browser names no language at all.
- **FR-029a**: Every rider-facing page, including the public page before
  connecting, MUST offer a language switcher listing all provided languages. The
  picked language MUST apply immediately, keep the visitor on the same page, and be
  remembered in that browser for later visits, taking precedence over the browser's
  preferred languages. The choice MUST NOT be stored in the rider record and MUST
  NOT require signing in.
- **FR-030**: Adding a further language MUST only require adding its translation
  strings, not changing page or processing logic.

### Key Entities

- **Rider**: a member of the team Strava club who connected their Strava account.
  Holds the Strava athlete ID, display first name (for greeting only), connection
  status (connected / needs reconnect, and since when it needs reconnecting),
  granted permissions (with or without private activities), connection date,
  past-season import status, and when club membership was last confirmed.
- **Team Settings**: organiser-maintained configuration — the team Strava club and
  the season start date.
- **Strava Credentials**: the access needed to read the rider's activities on their
  behalf, with its expiry. Belongs to exactly one Rider; stored encrypted; deleted
  with the Rider.
- **Activity**: one cycling activity of a Rider, identified by its Strava activity
  ID. Holds sport type, start date/time and time zone, distance, moving time,
  elevation gain, and when it was last refreshed from Strava. Belongs to exactly one
  Rider; deleted with the Rider.
- **Pending Activity Work**: a unit of deferred processing triggered by a Strava
  notification or a past-season import (rider, activity or import position, kind
  of change, attempt count). Exists only until processed or abandoned; never holds
  activity data beyond identifiers.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A rider can go from opening the RynkePoints page to seeing "connected"
  in under 2 minutes, without help from an organiser.
- **SC-002**: Under normal conditions (Strava reachable, within limits), a new
  cycling activity appears on the rider's page within 5 minutes of being uploaded
  to Strava.
- **SC-003**: 100% of Strava notifications are acknowledged within 2 seconds.
- **SC-004**: Replaying any recorded sequence of notifications (including
  duplicates and reordering) produces exactly one stored record per existing
  cycling activity and none for deleted ones.
- **SC-005**: When Strava limits are hit or Strava is temporarily unavailable, no
  activity is lost: every activity uploaded by a connected rider is stored within
  24 hours once Strava is reachable again.
- **SC-006**: After a rider revokes access or disconnects, no data about that rider
  remains in the live data within 1 hour; after a rider leaves the team club, or
  7 days after their connection started needing renewal, none remains within 25
  hours. Backup copies are gone after at most 7 more days.
- **SC-007**: A full audit of stored data finds no GPS tracks, coordinates or
  non-cycling activities.
- **SC-008**: For a newly connected rider with up to 500 cycling activities since
  the season start, all of them are stored within 24 hours of connecting.
- **SC-009**: 100% of connection attempts by non-members of the team club end with
  no data about them kept.
- **SC-010**: Every rider-facing page and message is fully German for a browser
  preferring German or naming no language, and fully English for a browser
  preferring English or naming only unsupported languages; no message is missing in
  either language.
- **SC-011**: A visitor can switch the language from any rider-facing page in one
  action, and the picked language is still in effect on their next visit from the
  same browser.

## Assumptions

- Riders are Team Rynkeby Hamburg members with an existing Strava account who have
  joined the team Strava club; the app serves at most the number of riders Strava
  currently allows it (1 now, 10 after the self-serve upgrade). No Strava Developer
  Program review is assumed.
- Strava has no built-in link between a club and an API application, and sends no
  notification when someone leaves a club. The club is therefore a RynkePoints
  setting, membership is checked from the rider's own list of clubs, and leaving is
  detected by the daily re-check (FR-004a). That check is a few requests per day
  in total and is the only scheduled lookup at Strava; activities themselves are
  never polled.
- Organisers change Team Settings through the app's deployment configuration; an
  organiser admin page is out of scope.
- Strava is both the data source and the only sign-in method; there are no
  RynkePoints passwords.
- Points calculation, event-participation matching, team leaderboards / sharing
  consent, and writing to activity descriptions are out of scope and will be
  separate features. Consequently no activity title or location is stored yet; later
  features that need such data may re-fetch it from Strava.
- Only cycling activities are relevant to Team Rynkeby; other sports can be added
  later by changing the accepted sport types.
- Setting up and maintaining the Strava push subscription and deploying the app are
  manual, one-time organiser steps outside the app's user-facing scope.
- Rider-facing pages are German by default with English as a second language
  (FR-028–FR-030). Strava's own approval screen is shown in whatever language the
  rider set on Strava and is outside the app's control.
- The app runs on the hosting platform's free plan, whose database keeps a 7-day
  restorable history that cannot be switched off. Moving to the paid plan would
  extend this to 30 days, and the privacy text (FR-022a) would have to change with
  it.
- Strava's athlete-capacity, rate-limit and API Agreement terms are as checked on
  2026-10-06 (see REQUIREMENTS.md).
