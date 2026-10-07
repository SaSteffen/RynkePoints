# Feature Specification: Ride Names and Links to Strava in the Ride List

**Feature Branch**: `008-strava-ride-names`

**Created**: 2026-10-07

**Status**: Draft

**Input**: User description: "GitHub issue #28: Show ride names linked to Strava in
the ride lists" ([#28](https://github.com/SaSteffen/RynkePoints/issues/28))

## Clarifications

### Session 2026-10-07

- Q: Does storing the ride name need a new consent version that every connected
  rider must accept again (feature 004, FR-013)? → A: No. The consent text is
  updated to name the ride name, but the consent version stays and riders are not
  asked again: the app already receives the name with every ride it reads, needs no
  new Strava permission or request for it, and shows it to nobody but the rider.
- Q: What does the link to Strava say on the German page? → A: "View on Strava",
  in English, word for word, in every language, as Strava's Brand Guidelines §3
  write it.

## User Scenarios & Testing *(mandatory)*

The **ride list** is the table of the rider's own rides on their rider page (feature
005-rider-view, FR-040 and FR-045): its first page holds the 20 most recent rides,
further pages hold the rest of the season, 20 at a time. Both "lists" in the issue are
pages of this one table, so everything below applies to every page of it.

The **ride name** is the title the rider's ride has on Strava (e.g. "Morning Ride" or
"Rund um den Sorpesee"). Today the app reads it with every ride but throws it away
(feature 001, FR-013, FR-014), so a ride is shown only by its date and figures.

### User Story 1 - Open a ride on Strava from the list (Priority: P1)

A rider looks at a ride that doesn't count and is told to correct it on Strava
(feature 005, FR-044). Next to the ride they follow a "View on Strava" link, and the
ride opens on Strava, where they can fix it.

**Why this priority**: The fix hint asks riders to change something on Strava;
without a link they have to find the ride there by date. The link needs only the
Strava activity ID, which every stored ride already has, so it works for every ride
from day one, with no new data and no Strava requests.

**Independent Test**: With synthetic rides in the local app, open the rider page and
check that each row, on every table page, has a "View on Strava" link to
`https://www.strava.com/activities/<id>` of that ride, in German and in English.

**Acceptance Scenarios**:

1. **Given** a rider with stored rides, **When** they open their rider page, **Then**
   each ride in the table has a link reading "View on Strava" (in English on the
   German page too, FR-009) that opens that ride on Strava.
2. **Given** a rider on page 3 of their ride table, **When** they follow a ride's
   link, **Then** the ride with that row's date and figures opens on Strava.
3. **Given** a private ("Only You") ride in the table, **When** the rider follows its
   link, **Then** it opens like any other ride; Strava itself shows it only to the
   rider.
4. **Given** a ride that is still being evaluated, **When** the rider looks at it,
   **Then** it has the link too.

---

### User Story 2 - Recognise each ride by its Strava name (Priority: P1)

A rider who rode the same 40 km loop three times last week sees each ride's name next
to its date, as they titled it on Strava, and can tell which one didn't count. If they
rename a ride on Strava, the new name shows up in the table.

**Why this priority**: This is the problem the issue describes: rides with similar
figures can't be told apart.

**Independent Test**: In the local app, send a synthetic new ride with a name, then a
rename of it, and check that the table shows the name and then the new one, while the
team, organisers and anyone signed out never see it.

**Acceptance Scenarios**:

1. **Given** a new ride arrives from Strava after this feature is released, **When**
   the rider opens their page, **Then** the ride shows its Strava name.
2. **Given** a rider renames a stored ride on Strava, **When** Strava tells the app
   about the change, **Then** the table shows the new name within the time feature
   001 allows for other changes (its SC-002).
3. **Given** a ride name containing characters such as `<`, `&` or emoji, **When** it
   is shown, **Then** it appears exactly as written on Strava and is never
   interpreted as markup.
4. **Given** a ride whose name is not known yet (FR-005), **When** the rider looks at
   it, **Then** the row shows no name and no placeholder, and the "View on Strava"
   link still works.
5. **Given** any page other than the rider's own rider page (another rider's view,
   organiser pages, the leaderboard, signed-out pages), **When** it is shown, **Then**
   no ride name appears on it.

---

### User Story 3 - Names for rides imported before (Priority: P2)

A rider who connected before this feature sees names for their older rides too,
without reconnecting and without the import using up the team's Strava requests.

**Why this priority**: Until then the table mixes named and unnamed rides; the link
from Story 1 already lets riders reach those rides, so this can follow.

**Independent Test**: In the local app with riders stored before the change, run the
daily job and check that their rides get names, using one list request per 200 rides
per rider and no request per ride.

**Acceptance Scenarios**:

1. **Given** rides stored before this feature, **When** the one-time re-read has run
   for their rider, **Then** they show their names.
2. **Given** the re-read reaches Strava's request limit, **When** it stops, **Then**
   it continues later from where it stopped, and live rides keep being processed in
   between (feature 001, FR-018, FR-021).
3. **Given** a rider whose rides are being re-read, **When** they open their page,
   **Then** rides already re-read show names and the others show none (FR-005); their
   Rynke don't change because of the re-read.

### Edge Cases

- **Name the rider left empty or blank**: shown as no name, like an unknown one
  (FR-005).
- **Very long name**: wraps within its cell instead of widening the table; on a phone
  the table still doesn't scroll sideways (FR-010).
- **Ride deleted on Strava**: the ride and its name are removed with it (feature 001,
  FR-016); no link to a deleted ride is left behind.
- **Private ride, or rider who withdrew private access**: the name is stored only for
  rides the app stores at all (feature 001, FR-007); private rides are dropped with
  the access, names included.
- **Ride renamed while the re-read runs**: whichever reading arrives last wins; both
  are Strava's current name at their time, and the next update notification settles
  it (feature 001, FR-017).
- **Strava sends only a title change**: today the app ignores it because nothing it
  stores changes; from now on the name is stored, so the ride is fetched again
  (FR-004). Its Rynke don't change.
- **Link opened by someone other than the rider** (e.g. a shared screenshot): Strava
  decides what they see according to the rider's own privacy settings; the app shows
  no more than the link.

## Requirements *(mandatory)*

### Functional Requirements

**Storing the name**

- **FR-001**: For every ride it stores, the system MUST also store the ride's name as
  Strava has it. This extends feature 001's list of stored data (its FR-013); the
  name is the only addition, and the rest of feature 001 FR-014 stays as it is.
- **FR-002**: The name MUST be stored for one purpose only: so the rider can recognise
  their own rides in their ride table. It is stored rather than fetched when the page
  is shown because the rider page never calls Strava (feature 005, FR-003) and a
  request per view would use the request budget all riders share (Principle II).
- **FR-003**: The name MUST be deleted together with the ride: when the ride is
  deleted on Strava, drops out of what the rider allowed, or the rider leaves
  (feature 001, FR-016, FR-022, FR-023; feature 004, FR-015). No copy of it may be
  kept elsewhere.
- **FR-004**: A notification from Strava that only the ride's title changed MUST lead
  to fetching the ride and storing its new name, like any other update (feature 001,
  FR-013, FR-017). It MUST NOT change the ride's result or Rynke.
- **FR-005**: A name not stored yet, empty or blank MUST be treated as unknown: the
  ride shows no name. The system MUST NOT invent one (e.g. from date or sport type).
- **FR-006**: Rides stored before this feature MUST get their names through the
  existing one-time re-read of every connected rider's season rides (feature 001,
  edge case "Activities stored before a figure was added"): by reading the riders'
  activity lists, never one request per ride, within Strava's limits, resumable and
  without delaying live rides (feature 001, FR-018, FR-021). The re-read MUST NOT
  change any ride's result unless a figure it reads has changed on Strava.

**Consent and visibility**

- **FR-007**: The explanation shown before connecting (feature 001, FR-002) MUST list
  the ride name among the data read and say that only the rider sees it. The consent
  version MUST NOT be raised for this and connected riders MUST NOT be asked again
  (feature 004, FR-013): the name already arrives with every ride the app reads, needs
  no new Strava permission or request, and is shown to nobody but the rider. A rider
  can read the updated text on their rider page (feature 004, FR-014).
- **FR-008**: The ride name MUST be shown only on the rider's own rider page, to that
  rider. It MUST NOT appear on any page, export or text other people can see: not to
  other riders, organisers or the team, not on the leaderboard, and not in the Rynke
  block written into Strava descriptions.

**Showing it**

- **FR-009**: Every ride in the ride table, on every page of it, MUST show the ride's
  name (when known) and a link to the ride on Strava
  (`https://www.strava.com/activities/<id>`). Following Strava's Brand Guidelines §3
  (feature 004, F-8), the link text MUST be "View on Strava", in English, word for
  word, in every language; the name itself MUST NOT be the link. The link MUST be
  recognisable as a link by bold weight, underline or Strava orange (#FC5200), and
  MUST NOT be larger than the surrounding text.
- **FR-010**: The name MUST be shown as plain text exactly as on Strava, never
  interpreted as markup or as a link.
- **FR-011**: The link MUST be shown for every stored ride, including private rides,
  rides still being evaluated and rides whose name is unknown.
- **FR-012**: The link label and any other new text MUST come from the message
  catalogs, in every language (feature 001, FR-028); the German catalog holds the
  English "View on Strava" (FR-009), like the English Strava images of feature 001
  FR-001. The ride name itself is never translated.

**Phones**

- **FR-013**: On a phone 360 pixels wide the table MUST stay readable without zooming
  and without scrolling sideways (feature 005, FR-070). The name and the link MAY move
  below the columns feature 005 FR-071 keeps in view, but MUST stay on the page, and
  the link MUST be easy to tap (about 44 × 44 pixels, feature 005 FR-072).

**Tests**

- **FR-014**: Storing, renaming, re-reading and deleting the name, the link target,
  escaping, the German and English text, and that no other page shows the name MUST
  be covered by automated tests with synthetic rides (constitution Principles I, V).

### Key Entities *(include if feature involves data)*

- **Ride** (feature 001's stored activity): gains its **name**, Strava's title of the
  ride, or unknown. Belongs to one rider, is deleted with the ride or the rider, and
  is shown only to that rider.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every ride in the ride table, on every page, has a "View on Strava" link
  that opens that ride on Strava, in all cases tested.
- **SC-002**: After the one-time re-read has finished, every stored ride since the
  season start whose name on Strava is not blank shows that name. An older stored
  ride gets its name with its next update.
- **SC-003**: The re-read uses at most one Strava request per 200 stored rides per
  rider (plus one per rider for the final, partial page) and no request per ride.
- **SC-004**: A ride renamed on Strava shows its new name within the time feature 001
  allows for processing updates (its SC-002).
- **SC-005**: The ride name appears on 0 pages other than the owning rider's rider
  page, in all cases tested.
- **SC-006**: After a rider leaves, 0 ride names of theirs remain in the live
  database.
- **SC-007**: On a 360-pixel-wide screen the ride table, with names of 100
  characters, needs no sideways scrolling, in German and in English.

## Assumptions

- Strava sends the name with every activity the app already reads, from the activity
  list as well as a single activity, so no new Strava permission and no new kind of
  request is needed.
- Strava allows linking to an activity page without asking; the guideline only rules
  how the link reads (Brand Guidelines, revised 2025-09-29, §3). The guidelines don't
  mention linking the name itself; since the link text must be "View on Strava", the
  name stays plain text next to it.
- The link opens Strava in the same way as the app's other links to Strava; whether
  it opens a new tab is left to planning.
- Showing the name to the rider is allowed under Strava's API Policy §2.3: it is the
  rider's own data, shown only to them (feature 004, F-1). Keeping it for the season
  follows the same accepted risk as the other stored figures (feature 004, F-6).
- The local development setup (feature 006) gives its synthetic sample rides
  invented names; no real ride names reach fixtures or sample data.
- This feature supersedes feature 005's note that rides are not linked to Strava, and
  the note in feature 001 that no activity title is stored.
- Naming the other ride in the overlap reason (feature 005, FR-042) and showing names
  anywhere else are out of scope.
