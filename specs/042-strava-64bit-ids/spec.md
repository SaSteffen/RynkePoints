# Feature Specification: Strava 64-bit IDs

**Feature Branch**: `042-strava-64bit-ids`

**Created**: 2026-11-21

**Status**: Draft

**Input**: User description: "Strava 64-bit activity and athlete IDs (GitHub issue #354): after
June 1, 2027 Strava issues activity and athlete IDs above 2^53; the app must handle them end to
end without rounding, using id_str where Strava provides it and the exact webhook text for
object_id/owner_id."

## Context

Strava told developers in November 2026 that after June 1, 2027 the IDs of activities and athletes
may use the full 64-bit range. The app's language represents whole numbers exactly only up to
2^53 − 1 (9,007,199,254,740,991). Above that, a number read from Strava is silently rounded to a
neighbouring value, or refused where the app checks it.

Today that would mean, for a new rider or a new ride with such an ID:

- a webhook event about it is refused as invalid, by the gateway and by the team's site, and lost;
- a ride read from Strava is stored under a wrong, rounded ID, so later events, edits, deletions and
  links to Strava miss it;
- a rider connecting is stored under a wrong ID, so their sign-in, their rides and their deletion
  don't match up.

Strava now also sends `id_str`, the same ID as text, on activities and athletes, and recommends
using it. Webhook events have no such field: their `object_id` and `owner_id` are numbers only,
and the schema's examples don't carry `id_str` everywhere either. The app therefore reads every ID
from the exact digits of the number, in one way for responses and events alike, and ignores
`id_str`. JSON itself puts no limit on a number's size; only the usual way of reading it rounds.
The database already stores whole numbers of the full 64-bit range exactly; only the way values
cross into and out of the app rounds them.

Nothing has broken yet. Existing IDs are far below the limit (activities around 10^10, athletes
around 10^8).

## Clarifications

### Session 2026-11-21

- Q: Read `id_str` where Strava sends it, or the 64-bit number everywhere? → A: The 64-bit number
  everywhere, from its exact digits; `id_str` is ignored. Webhook events have no `id_str`, so the
  exact reading is needed anyway, and one way for every ID leaves no gap where `id_str` is missing.

**Terms**:

- **Large ID**: an activity or athlete ID above 2^53 − 1.
- **Exact**: an ID the app holds, stores, compares, sends and shows has the same digits Strava
  sent.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A rider with a large ID connects and uses the app (Priority: P1)

A new club member whose Strava athlete ID is a large ID connects. They are signed in, consent,
their season is imported and they see their rides, Rynke and badges like any other rider. When
they disconnect or are removed, everything of theirs is deleted and, where it applies, they stay
on the block list under their exact ID.

**Why this priority**: Without it a new rider after June 2027 can't use the app at all, or ends up
with someone else's ID.

**Independent Test**: In fake mode, connect a sample rider whose athlete ID is a large ID, and see
the import, the rider's page, signing out and in again, and deletion work.

**Acceptance Scenarios**:

1. **Given** a person with a large athlete ID, **When** they connect, **Then** the app stores
   exactly that ID and they stay signed in across visits.
2. **Given** such a rider connected, **When** their season is imported, **Then** their rides,
   Rynke and badges are what a rider with a small ID and the same rides gets.
3. **Given** such a rider, **When** they disconnect, are removed by an administrator, or withdraw
   access on Strava, **Then** exactly their data is deleted, nobody else's, and a block list entry
   holds their exact ID.
4. **Given** such a rider, **When** another team asks whether the person is held (the gateway's
   question before a grant is withdrawn), **Then** the answer is about exactly that person.

---

### User Story 2 - A ride with a large ID is stored and kept up to date (Priority: P1)

A rider records a ride whose activity ID is a large ID. Strava's event about it reaches the
team's site through the gateway, the ride is read and stored under its exact ID, and later edits,
the ride edit re-check and a deletion on Strava all find it.

**Why this priority**: Every ride after June 2027 may have a large ID. Without this the app stops
counting new rides.

**Independent Test**: In fake mode, let the fake Strava send an event for a new ride with a large
ID, through the gateway and directly, then edit and delete it, and see the stored ride follow.

**Acceptance Scenarios**:

1. **Given** a webhook event whose activity ID or owner ID is a large ID, **When** it reaches the
   gateway or a team's site, **Then** it is accepted and the work it starts names exactly those
   IDs.
2. **Given** a new ride with a large ID, **When** it is read from Strava (event, import or
   re-check), **Then** it is stored under exactly that ID.
3. **Given** such a stored ride, **When** Strava reports an update or a deletion for it, or the
   re-check finds it changed or gone, **Then** exactly that ride is updated or removed.
4. **Given** two rides whose IDs differ only beyond the 2^53 limit, **When** both are stored,
   **Then** they are two rides, each with its own figures.

---

### User Story 3 - Organisers and administrators see the right rider and ride (Priority: P2)

An organiser opens the overview, the attendance list, the requests or the corrections. Every row
of a rider or ride with a large ID links to the right Strava profile or activity, and every action
taken on it (a correction, a request answered, an attendance mark, a removal) applies to exactly
that rider or ride. The season album shows them too.

**Why this priority**: Wrong links and actions on the wrong rider are confusing and, for removals,
harmful, but they only matter once riders with large IDs exist.

**Independent Test**: In fake mode with sample riders and rides with large IDs, follow the links
on the organiser and administrator pages, take each action once and check what changed.

**Acceptance Scenarios**:

1. **Given** a rider and a ride with large IDs, **When** an organiser opens a page that links to
   Strava, **Then** the links carry the exact IDs.
2. **Given** such a rider, **When** an organiser or administrator acts on them, **Then** the
   action applies to exactly that rider.
3. **Given** riders with small and large IDs, **When** a list is ordered by ID anywhere (as a tie
   break, for example), **Then** the order is the numeric order of the IDs.

---

### User Story 4 - Everything that works today keeps working (Priority: P1)

The release changes nothing a rider or organiser sees. Riders who are connected keep their IDs,
rides, Rynke, badges, sessions and push subscriptions. Work queued by the version before the
release is done by the new one, and the version before keeps working with the data the new one
writes until the new one is live.

**Why this priority**: The existing riders are the whole app today.

**Independent Test**: Run the full test suite and the end-to-end tests with existing (small) IDs,
and process queue messages and session cookies written by the version before.

**Acceptance Scenarios**:

1. **Given** a rider signed in before the release, **When** they visit after it, **Then** they are
   still signed in as themselves.
2. **Given** work queued or parked before the release, **When** the new version takes it, **Then**
   it is done as the old version would have done it.
3. **Given** the database migrations of this release, **When** they are applied before the new code
   is published, **Then** the previous version keeps working.

---

### Edge Cases

- An ID in a webhook event that isn't a positive whole number (a fraction, an exponent, a
  negative, text, more than 64 bits): the event is refused as today.
- Strava sends `id_str`, or leaves it out: no difference, the app reads `id` only.
- An `id` in a response from Strava that isn't a positive whole number of at most 64 bits: the
  response is treated as malformed, as a response missing its `id` is today.
- An ID in a web address or form (an organiser's link, a ride's page) that isn't a valid ID: the
  page answers as for an unknown rider or ride today.
- A large ID shown in a page or link: shown with every digit, never in an exponent form or
  rounded.
- The fake Strava and the sample riders: some of them have large IDs, so the large case is part
  of every local run and every test run.
- A rider who had a small ID keeps it: Strava's notice reads as if only newly issued IDs grow (see
  Assumptions). If a connected rider's ID ever changed, they would be a new rider to the app, as
  today.
- Club IDs and other Strava IDs the app reads (subscription, uploads) are not part of Strava's
  notice and stay as they are.

## Requirements *(mandatory)*

### Functional Requirements

**Reading IDs from Strava**

- **FR-001**: The system MUST take an activity's or athlete's ID from Strava exactly as sent, from
  the exact digits of `id`. It MUST NOT round an ID or accept a rounded one, and it MUST NOT depend
  on `id_str`.
- **FR-002**: The system MUST take a webhook event's `object_id` and `owner_id` from the exact
  digits of the event as sent, both in the gateway and in a team's site. An event whose IDs are not
  positive whole numbers of at most 64 bits MUST be refused as today.
- **FR-003**: The athlete ID Strava returns when a person connects MUST be taken exactly (FR-001).

**Holding, storing and sending IDs**

- **FR-004**: Every ID of an activity or athlete MUST stay exact wherever the app holds it: in the
  database, in queued and parked work, in the session, in web addresses, forms and links, in the
  gateway's question to other teams, in the season album, and in the fake Strava.
- **FR-005**: Wherever the app compares or orders such IDs, it MUST do so by their numeric value.
- **FR-006**: Work queued or parked by the previous version, with IDs written as numbers, MUST be
  accepted and done as before. Sessions signed by the previous version MUST stay valid.
- **FR-007**: The database changes, if any, MUST be additive: the previously deployed version MUST
  keep working after they are applied. Existing rows MUST keep their IDs.

**Testing**

- **FR-008**: The fake Strava MUST send IDs as Strava does, as JSON numbers (`id`, `object_id`,
  `owner_id`), and MUST send large IDs with their exact digits. It sends no `id_str`, so nothing
  can come to depend on it.
- **FR-009**: Some sample riders and some of their activities in every team's fake mode, and the
  test fixtures, MUST have large IDs, so that local runs, tests and end-to-end tests cover the
  large case alongside small IDs.

**Rules of the project**

- **FR-010**: The feature reads nothing new from Strava: the same fields, read without rounding.
  The consent text and its version stay as they are (constitution Principle I).
- **FR-011**: Nothing a rider or organiser sees changes, except where a large ID was wrong before.
- **FR-012**: The behaviour is the same for every team; nothing in it is team data.

### Key Entities

- **Athlete ID**: Strava's ID of a person; the key of a rider, a consent, a block list entry, a
  guest, a session and every rider's rows.
- **Activity ID**: Strava's ID of an activity; the key of a stored ride, run or swim, of its Rynke
  result and of the rides its overlap names.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A rider with an athlete ID of up to 2^63 − 1 can connect, be imported, see their
  page, be signed in again and be deleted, in fake mode, with no difference to a rider with a small
  ID.
- **SC-002**: A ride with an activity ID of up to 2^63 − 1 is stored, updated and removed through
  events, the import and the re-check, in fake mode, under its exact ID.
- **SC-003**: Two IDs that differ only in their last digit beyond 2^53 are never confused anywhere
  in the app.
- **SC-004**: Every existing test passes with the fixture IDs that stay small, and the same tests
  pass for fixtures with large IDs.
- **SC-005**: Queue messages and session cookies written by the previous version are handled
  without any rider noticing the release.
- **SC-006**: Done and released before June 1, 2027.

## Assumptions

- **Request format**: Strava's published API schema (checked 2026-11-21) gives every activity
  (summary and detail) and every athlete (including the athlete in the token answer and the one
  nested in an activity) an `id` (64-bit integer) and an `id_str` (text). Webhook events document
  `object_id` and `owner_id` as "long integer" with no text variant. The examples in the schema
  don't all show `id_str` yet (the athlete nested in an activity, for example). The app reads `id`
  only (FR-001, Clarifications), which every response and event has today, so no live request is
  needed.
- **Existing IDs**: Strava's notice speaks of how IDs are generated, so existing riders and
  activities keep their IDs. The app doesn't rely on it: an existing ID is handled exactly either
  way.
- **Range**: IDs stay positive and fit in a signed 64-bit number, which is what the database stores
  exactly.
- **Other IDs**: club IDs, the webhook subscription ID and upload IDs are not named in Strava's
  notice and are out of scope. Strava's move to a new API host is a separate issue (#420).
