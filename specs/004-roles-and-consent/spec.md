# Feature Specification: Roles and Rider Consent

**Feature Branch**: `004-roles-and-consent`

**Created**: 2026-10-06

**Status**: Draft

**Input**: User description: "Specify roles and rider consent for RynkePoints, before
the app has users." Prompt in full: `specs/backlog/roles-and-consent.md` (removed
with this spec). Two roles: rider and organiser, organisers listed by Strava athlete
ID in deployment configuration stored as a secret, no in-app promotion. Inventory
what each planned feature shows to whom, decide the consent levels, whether points
derived from Strava data count as Strava data, and what a non-consenting rider looks
like in each view. Consent is asked in the connect flow, can be changed or withdrawn
at any time, takes effect immediately, is recorded with its date, and withdrawing
only hides points. Check Strava's API Agreement and API Policy for leaderboards,
clubs and derived data, and whether the app needs Strava's review or a higher
athlete capacity; say plainly if the leaderboard is not allowed.

## Clarifications

### Session 2026-10-06

- Q: Can a rider take part without sharing, or without granting a permission? →
  A: No. Every permission and consent is a condition of taking part, except access
  to private ("Only You") activities, which stays the rider's choice (feature 001,
  FR-005). Connecting means: reading activities, letting the app write its Rynke
  block into activity descriptions, and sharing their Rynke with organisers and the
  team as in FR-020. There are no sharing levels. This replaces "withdrawing only
  hides points" from the prompt: a rider withdraws by leaving, and leaving deletes
  their data (feature 001, FR-022).
- Q: Must the rollout wait until Strava has confirmed that keeping activity figures
  and Rynke for the season is allowed under the seven-day cache rule? → A: No; asking
  would be a showstopper. The project handles the seven-day cache rule (API Policy
  §6.2, §5.5) and the analytics rule (§5.4) the way other Strava apps do, as
  reported in Strava's developer community: the data a rider brings into
  RynkePoints is kept as their own data for the season's purpose (§6.4), not as a
  cache, and computing a rider's Rynke is the app's purpose for that rider, not
  analytics. The project owner accepts the risk (F-6).
- Q: Constitution Principle I made every capability separately opt-in and Principle
  III required description edits to be switchable off per rider; amend it or keep a
  switch? → A: All of the consent is needed; the app doesn't work without the
  individual parts. The constitution is amended to 2.0.0 (one required consent at
  connect, private activities optional, no switch for description edits), and there
  is no per-rider switch for writing the Rynke block (FR-016).

## Summary of the Strava check

The team leaderboard **is allowed**. Strava's terms forbid showing a rider's data
to anyone else without that rider's prior express consent; they say nothing against
leaderboards, rankings or clubs as such (F-1). Every rider gives that consent when
connecting (FR-010).

- **Capacity** (F-5): without Strava's review the app can connect at most 10
  athletes, fewer than the team has. The review is discretionary and has no time
  limit.
- **Seven-day cache and analytics rules** (F-6): read literally, they would forbid
  what features 001 and 003 do. The project does not apply them (see
  Clarifications) and accepts that Strava could object.

## User Scenarios & Testing *(mandatory)*

Terms: a **rider** is a connected club member (feature 001). An **organiser** is a
rider whose Strava athlete ID is on the organiser list. The **consent** is what a
rider agrees to when connecting: reading their activities, the app writing its Rynke
block into their activity descriptions, and sharing their Rynke with organisers and
the team as in FR-020. The **planned views** are the organiser pages
(organiser-admin), the organiser overview and the team leaderboard
(team-leaderboard) from [specs/backlog/](../backlog/README.md); this feature builds
none of them, it defines what they may show.

### User Story 1 - Rider agrees to everything taking part needs when connecting (Priority: P1)

A club member opens RynkePoints and, before going to Strava, reads in plain words
what taking part means: the app reads their rides, writes a short Rynke block into
their ride descriptions on Strava once that feature ships, and shows their name
and Rynke to the organisers and to the team. The page shows the name others will see. They agree and go on to Strava,
which asks for read and write access to their activities; they may leave out their
private ("Only You") activities. Back on RynkePoints they are connected, and the
date and the version of what they agreed to are recorded.

**Why this priority**: Every shared view and the description feature depend on this
consent. Asking for all of it from day one avoids re-asking every rider once those
features ship (F-4).

**Independent Test**: Connect simulated riders against a simulated Strava, once
granting everything, once without write access and once declining on the
RynkePoints page, and check that only the first is connected and that its consent is
recorded with date and version.

**Acceptance Scenarios**:

1. **Given** a club member on the public page, **When** they start connecting,
   **Then** they see what is read, what is written and what is shared with whom,
   the name others will see, how to leave and that leaving deletes their data,
   before anything is sent to Strava.
2. **Given** a club member who agrees and grants read and write access on Strava,
   **When** they return, **Then** they are connected and the consent version and
   its date and time are recorded.
3. **Given** a club member who grants read and write access but leaves out private
   activities, **When** they return, **Then** they are connected as in feature 001,
   FR-005.
4. **Given** a club member who unticks write access on Strava, **When** they return,
   **Then** no rider record or credentials are kept, and they see a plain
   explanation that the app needs that permission plus an option to try again.
5. **Given** a club member who does not agree on the RynkePoints page, **When** they
   decline, **Then** they are not sent to Strava and nothing about them is kept.
6. **Given** a connected rider who signs in again, **When** the consent version they
   accepted is the current one, **Then** they are not asked again.

---

### User Story 2 - Organisers are recognised from the organiser list (Priority: P1)

The maintainer lists the Strava athlete IDs of the team's organisers in the app's
deployment configuration, kept secret. An organiser signs in through Strava like
every rider and is recognised as an organiser; nobody can become one from inside the
app. Taking an ID off the list removes the organiser's rights on their next request.

**Why this priority**: The organiser pages (feature 003's inputs: team events,
attendance, corrections, rules, recalculation) need a way to tell organisers from
riders, and the organiser overview needs it to decide who may see more.

**Independent Test**: Configure a synthetic organiser list, sign in simulated riders
on and off the list, and check the recognised role of each, including after the list
changes.

**Acceptance Scenarios**:

1. **Given** a connected rider whose athlete ID is on the organiser list, **When**
   they sign in, **Then** they are recognised as organiser and as rider.
2. **Given** a connected rider not on the list, **When** they sign in, **Then** they
   are recognised as rider only.
3. **Given** an athlete ID on the list whose owner is not a connected rider, **When**
   anyone uses the app, **Then** that ID grants nothing.
4. **Given** a signed-in organiser, **When** their ID is removed from the list,
   **Then** their next request is handled as a rider's.
5. **Given** an empty or missing organiser list, **When** riders use the app,
   **Then** nobody is an organiser and everything riders can do still works.
6. **Given** the repository, logs and pages, **When** they are inspected, **Then**
   no organiser athlete ID appears in them.

---

### User Story 3 - Every view shows only what the consent covers (Priority: P1)

Whenever a planned view shows data about a rider to someone else, it follows one
table (FR-020): every signed-in rider sees each other rider's name, Rynke totals,
progress and whether they qualify; organisers also see the breakdown, the amounts
still missing, attendance and corrections. Individual rides are never shown to
anyone but their rider. A rider who has not accepted the current consent is left
out.

**Why this priority**: This is the rule all three planned views build on. Defining
it once, here, keeps them from each interpreting the consent differently.

**Independent Test**: For a synthetic team with organisers and riders, some with an
older or no recorded consent, ask what each viewer may see about each rider and
compare with FR-020 and FR-021.

**Acceptance Scenarios**:

1. **Given** a signed-in rider who is not an organiser, **When** they ask what they
   may see about another rider with current consent, **Then** the answer is the
   name, totals, progress and qualification, and nothing else.
2. **Given** a signed-in organiser, **When** they ask what they may see about a
   rider with current consent, **Then** the answer also includes the breakdown, the
   amounts still missing, attendance and corrections.
3. **Given** any viewer other than the rider, **When** they ask for the rider's
   individual rides or ride results, **Then** the answer is no.
4. **Given** a rider without a recorded consent, **When** anyone else asks what they
   may see about that rider, **Then** the answer is nothing, and the rider is left
   out of every list, count and figure.
5. **Given** a visitor who is not signed in, **When** they open a planned view,
   **Then** they are asked to sign in with Strava and see no rider data.

---

### User Story 4 - Rider sees what they agreed to and is asked again when it changes (Priority: P2)

A connected rider opens their page and sees what they agreed to and when, which
Strava permissions they granted, who sees what about them, and how to leave. When
the team later changes what is shared or which data is read, every rider is shown
the new consent on their next visit and agrees again before going on, or leaves.

**Why this priority**: Strava's terms require telling riders how to withdraw and
asking again when the data collected changes (F-4); riders should be able to look
up what they agreed to. Not needed to show the first shared view.

**Independent Test**: Sign in a simulated rider, check their page shows the consent
and its date; publish a new consent version and check the rider is asked again and
is shown to others only as the version they accepted allows until they agree.

**Acceptance Scenarios**:

1. **Given** a connected rider, **When** they open their page, **Then** they see
   what they agreed to, the version and date, their granted Strava permissions, who
   sees what about them, and the "Disconnect and delete my data" action of feature
   001.
2. **Given** a new consent version that shares more or reads more, **When** a rider
   who accepted an older version visits, **Then** they are shown what changed and
   asked to agree before using the app further.
3. **Given** a rider who has not yet accepted a newer consent version, **When**
   others use the planned views, **Then** the rider is shown only as far as the
   version they accepted allows.
4. **Given** a new consent version that needs a Strava permission the rider has not
   granted, **When** they agree, **Then** they go through Strava's approval again.
5. **Given** a rider who does not want to agree to a new version, **When** they
   choose to leave, **Then** their data is deleted as in feature 001, FR-023.

---

### User Story 5 - The maintainer applies to Strava for more riders (Priority: P2)

Once the app needs more than 10 connected athletes, the maintainer applies through
Strava's review form, with screenshots of every place Strava data appears (F-5).

**Why this priority**: The team has more than 10 riders, so the whole team can only
take part after Strava raises the capacity. Not needed to build roles and consent.

**Independent Test**: Not covered by automated tests. A reviewer checks that the
application was submitted once the shared views exist, and records the outcome
here.

**Acceptance Scenarios**:

1. **Given** the app has 10 connected athletes, **When** more riders want to
   connect, **Then** they see feature 001's "team is full" message until Strava
   raises the capacity.
2. **Given** the organiser overview and the team leaderboard exist, at least with
   synthetic data, **When** the maintainer applies, **Then** the screenshots cover
   every page showing Strava data, including those views.

---

### Edge Cases

- **Rider connected before this feature**: they have no recorded consent, so others
  see nothing of them (FR-021). They are asked to agree on their next visit, and to
  grant write access on Strava. At the time of writing the app has no riders
  besides the maintainer.
- **Rider no longer wants the Rynke block in their descriptions** (once the
  description feature exists): there is no switch (FR-016); they leave (FR-015).
- **Rider revokes access on Strava**: Strava revokes read and write together; the
  rider is deleted as in feature 001, FR-022.
- **Rider reconnects without write access**: treated like reconnecting without read
  access in feature 001, FR-006: their data is deleted and they are told why.
- **Organiser list names a rider who later disconnects**: the ID grants nothing
  until that athlete connects again.
- **Organiser removed from the list mid-session**: their next request is a rider's;
  a page already open shows nothing new and accepts no organiser change.
- **Two riders with the same shown name**: both are shown with their full last name
  (FR-022).
- **Rider changes their name on Strava**: the shown name follows the next time they
  sign in.
- **Ride deleted on Strava**: shared views show balances, not rides, so a deleted
  ride only changes the balance (feature 003, FR-003), well within Strava's 48-hour
  limit (F-7).
- **A planned view wants to show more** (e.g. rides on the leaderboard): not covered
  by the current consent; it needs a new consent version (FR-013).
- **Rider writes into the app's Rynke block on Strava**: handled by the description
  feature (constitution Principle III), not here.

## Requirements *(mandatory)*

### Functional Requirements

**Roles**

- **FR-001**: The system MUST know two roles: **rider**, every connected club member
  (feature 001), and **organiser**, a rider whose Strava athlete ID is on the
  organiser list. An organiser is always also a rider and signs in through Strava
  like everyone else; the system MUST NOT keep passwords (feature 001, FR-009).
- **FR-002**: The organiser list MUST be part of the deployment configuration,
  stored as a secret and never in the repository, pages or logs. Changing it MUST
  NOT need a code change; it is a manual maintainer step (constitution, Development
  Workflow).
- **FR-003**: The system MUST decide a signed-in person's role on every request from
  the current organiser list. An athlete ID on the list grants nothing unless its
  owner is a connected rider.
- **FR-004**: There MUST be no way to grant or remove the organiser role from inside
  the app.
- **FR-005**: All organisers MUST have the same rights: every organiser may do
  everything the planned organiser views allow (team events, attendance,
  corrections, rule values, starting a recalculation, the organiser overview).
  Finer rights are not needed: the organisers are a handful of trusted volunteers,
  rule changes are rare and announced, and the organiser-admin feature records who
  made each change.
- **FR-006**: An empty or missing organiser list MUST leave the app working for
  riders, with no organisers.
- **FR-007**: Organisers MUST be shown to others exactly like every other rider;
  their role grants them more to see (FR-020), not less visibility of their own
  data.

**Consent**

- **FR-010**: Taking part MUST require the rider's consent to all of the following;
  a rider who does not give all of it MUST NOT be connected, and nothing about them
  MUST be kept:
  1. reading their cycling activities (feature 001);
  2. the app writing its own delimited Rynke block into their activity
     descriptions, once the description feature exists (constitution Principle
     III);
  3. sharing their data with organisers and the team as in FR-020.
  Access to private ("Only You") activities MUST stay optional (feature 001,
  FR-005).
- **FR-011**: Before redirecting to Strava, the connect flow MUST explain in plain
  words what is read, what is written (and that it is not optional),
  what is shared with whom (FR-020) with the name others will see (FR-022), how to
  leave, that leaving deletes all their data and that they get a confirmation once
  it is deleted (F-4), and MUST ask the rider to agree. Strava's own approval screen
  MUST NOT be altered (F-4).
- **FR-012**: The system MUST request permission to read and to write the rider's
  activities, including private ones, at Strava. A connection without read or
  without write permission MUST be treated as not connected, as feature 001 FR-006
  does for read permission; for an already connected rider this means deleting
  their data as in feature 001, FR-022.
- **FR-013**: The consent MUST carry a version. Every acceptance MUST be recorded
  with the version and its date and time, kept while the rider is connected and
  deleted with the rider. When a new version reads more data, shares more, or
  shares with more people (Strava API Policy §7.2), every rider MUST be shown what
  changed and asked to agree on their next visit before using the app further;
  until they agree, others MUST see them only as far as the version they accepted
  allows. A new version that needs a Strava permission the rider has not granted
  MUST send them through Strava's approval again.
- **FR-014**: A rider MUST be able to see on their page what they agreed to, the
  version and date, their granted Strava permissions and who sees what about them.
- **FR-015**: A rider withdraws consent by leaving: revoking access on Strava,
  pressing "Disconnect and delete my data" (feature 001, FR-023), or leaving the
  club. In every case their data, including Rynke, attendance, corrections and the
  consent records, MUST be deleted as in feature 001, FR-022. There is no way to
  stay connected and stop sharing.
- **FR-016**: There MUST be no per-rider setting that stops the app writing its
  Rynke block while staying connected (constitution Principle III as amended in
  2.0.0); the description feature MUST NOT add one without a new consent version.

**Visibility**

- **FR-020**: What anyone other than the rider may see about a rider with a current
  consent MUST follow this table:

  | Data about a rider | The rider | Organisers | Other riders |
  |---|---|---|---|
  | Shown name (FR-022) and that they take part | yes | yes | yes |
  | Training and Team Rynke totals, progress to both thresholds, whether they qualify | yes | yes | yes |
  | Breakdown by source, amounts still missing, virtual-ride share (feature 003 FR-014a) | yes | yes | no |
  | Attendance and corrections recorded for them | yes | yes | no |
  | Individual rides, ride results and activity figures | yes | no | no |
  | Consent records | yes | no | no |

  Data not in this table MUST be shown to nobody but the rider. Visitors who are
  not signed in MUST see no rider data.
- **FR-021**: A rider without a recorded consent MUST be left out of every view
  shown to anyone else: no row, no placeholder, no count, and none of their data in
  any total, average, ranking or other figure.
- **FR-022**: The name shown to others MUST be the rider's Strava first name and the
  initial of their Strava last name (e.g. "Anna K."). When two riders would get the
  same shown name, both MUST be shown with their full last name. The name MUST
  follow the rider's Strava profile as of their latest sign-in.
- **FR-023**: The rider-facing privacy text (feature 001, FR-002) MUST cover the
  consent of FR-010 with everything FR-011 lists.

**Strava capacity**

- **FR-030**: The system MUST NOT assume more connected athletes than Strava's
  current capacity for the app; beyond it, feature 001's "team is full" message
  applies (feature 001, FR-008; constitution Principle II).

**Language**

- **FR-040**: All rider-facing text of this feature (the consent explanation and
  question, the refusal when a permission is missing, the consent shown on the
  rider's page, the re-consent question, privacy text) MUST come from translation
  strings in German and English, following feature 001 FR-028–FR-030.

### Key Entities

- **Organiser List**: deployment configuration, kept secret — the Strava athlete IDs
  of the organisers. Not stored in the app's data; read on every request.
- **Role**: not stored; derived on each request from whether the signed-in person is
  a connected rider and whether their athlete ID is on the Organiser List.
- **Consent Version**: a numbered version of what riders agree to (FR-010) and the
  date it was published; part of the app, not rider data.
- **Consent Record**: one acceptance by a Rider — consent version and date and
  time. The latest one is the Rider's current consent. Kept while the Rider is
  connected; deleted with the Rider.
- **Rider** (feature 001): additionally holds the Strava last name, used only for
  the shown name (FR-022) and refreshed at each sign-in. Its granted permissions now
  include write access.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of connected riders have granted read and write access and have
  a recorded consent, or are left out of every shared view.
- **SC-002**: For a synthetic team of organisers and riders, 100% of answers to
  "what may this viewer see about this rider" match FR-020 and FR-021.
- **SC-003**: 100% of connection attempts without write access, or without agreeing
  on the RynkePoints page, end with no data about the athlete kept.
- **SC-004**: A club member can read the consent, agree and be connected in under
  3 minutes, without help from an organiser.
- **SC-005**: After a new consent version that shares more is published, 0 riders
  are shown to others beyond the version they accepted.
- **SC-006**: A change to the organiser list applies to the next request of every
  affected person, without a code change.
- **SC-007**: No organiser athlete ID is found in the repository, logs or any page.
- **SC-008**: Every rider-facing text of this feature exists in German and English.

## Assumptions

- The team has more than 10 riders, so connecting the whole team needs Strava's
  review (F-5). The review form asks for screenshots of every place Strava data
  appears, so the organiser overview and the leaderboard need to exist, at least
  with synthetic data, before applying.
- The maintainer holds a Strava subscription, which Strava requires to create an API
  application (F-5). Riders need none as far as Strava publishes today.
- The organisers are a handful of trusted volunteers known to the riders. Organisers
  are riders: they connect, consent and are shown like everyone else.
- Sharing within the team is the point of taking part (riders train for the team and
  the team checks who qualifies), so it is a condition of taking part rather than a
  separate choice. This spec is not legal advice; the privacy text is reviewed
  before riders are invited.
- The pages that use roles and consent (organiser pages, rider view, organiser
  overview, team leaderboard) and the description feature are separate features;
  this feature defines the roles, the consent, the visibility rule and the consent
  step of the connect flow.
- This feature changes feature 001: the connect flow gains the consent step
  (FR-011); write access is requested and required (FR-012), replacing feature 001
  FR-003, which requests read access only; the rider's page shows the consent
  (FR-014); the privacy text grows (FR-023); and the rider record keeps the Strava
  last name (FR-022), which Strava provides with the access the app already
  requests.
- The constitution is amended to 2.0.0 with this feature: Principle I asks for one
  required consent at connect instead of separately opt-in capabilities, and
  Principle III no longer requires description edits to be switchable off.
- Feature 003 already stores balances per rider (its FR-015); nothing there changes.
- What the description feature writes is visible to whoever may see the activity on
  Strava, according to the rider's own Strava settings; the consent text says so.
- Strava's terms are as checked on 2026-10-06 (findings below). Strava may change
  them; the findings are re-checked before applying for review.

## Strava Terms Findings (checked 2026-10-06)

Sources: [API Agreement](https://www.strava.com/legal/api) (effective 2026-06-01),
[API Policy](https://www.strava.com/legal/api_policy) (effective 2026-06-01, part of
the Agreement), [Brand Guidelines](https://developers.strava.com/guidelines/) (last
revised 2025-09-29), [Getting Started](https://developers.strava.com/docs/getting-started/),
[Rate Limits](https://developers.strava.com/docs/rate-limits/).

- **F-1 Showing a rider's data to others needs their prior express consent.** Policy
  §2.3 limits display of a user's Strava data to that user. Policy §5.13 forbids
  letting anyone other than the developer or the user see the user's data unless
  the user expressly consented beforehand, and the Agreement's summary says the
  same. Neither document mentions leaderboards, rankings, competitions or clubs.
  So a leaderboard of riders who consented is allowed. Policy §6.1 is oddly worded:
  its opening seems to exempt apps with an athlete capacity of up to 9,999 from the
  display limit; this spec does not rely on it and follows §2.3.
- **F-2 Derived data.** Policy §5.3, §5.4, §5.5 and §7.4 extend their rules to data
  derived from Strava data. For showing data to others this makes no difference
  here, since every rider consents to the sharing (FR-010). For deletion it does:
  Rynke are deleted with the rider (feature 001, FR-022; feature 003, FR-015).
- **F-3 Aggregated use.** Policy §5.4 forbids processing Strava data, also
  aggregated or anonymised, for analytics. Shared views show riders who consented,
  by name, for the app's purpose; riders without a current consent are not counted
  or included in any figure (FR-021).
- **F-4 What consent must cover, and why to ask on day one.** Policy §2.1 requires
  consent to disclose the data types, how they are collected, how to withdraw
  consent, how to request deletion, and that deletion is confirmed; §2.5 requires a
  written confirmation of deletion. Policy §7.2 requires telling users and getting
  their consent again whenever the type of data collected changes, and respecting
  Strava's granular permissions; §5.13 forbids altering Strava's own consent
  screens. The app does not alter Strava's screen: a rider who unticks a required
  permission is told why and not connected, as feature 001 already does for read
  access (FR-011, FR-012, FR-013).
- **F-5 Capacity and review.** New apps connect only the developer; a self-serve
  upgrade gives 10 athletes. More needs Strava's review via its form, with
  screenshots of every place Strava data appears; Strava raises limits only for
  apps nearing capacity, at its discretion and without a time limit (Policy §3.6).
  Policy §3.3 puts apps of up to 10 and up to 9,999 users in a Standard Tier with
  subscription requirements for the developer or for end users Strava names;
  Getting Started requires a Strava subscription to create an app.
- **F-6 Seven-day cache and analytics rules: not applied, risk accepted.** Policy
  §6.2 forbids keeping Strava data in a cache "longer than seven (7) days", and
  apart from that limited caching Strava data may not be stored. Policy §5.5 forbids
  storing Strava data or data derived from it in any storage set up for later
  retrieval, except that seven-day cache, and §5.4 forbids processing it for
  analytics. Read literally, this rules out keeping activity figures (feature 001)
  and Rynke (feature 003) for the season. The project handles these rules the way
  other Strava apps do, as reported in Strava's developer community: the data is
  kept as the rider's own data, for as long as the season's purpose requires (Policy
  §6.4), and deleted when the rider leaves; computing a rider's Rynke is the app's
  purpose, not analytics. Strava is not asked in advance. Strava can restrict or
  end the app's access if it objects (Agreement §2.2, §4.2); the project owner
  accepts that risk.
- **F-7 Deletions.** Data a rider deletes on Strava must disappear from the app
  within 48 hours (Policy §6.3); data must be deleted within 30 days of a request or
  revocation, including personal data derived from it (Policy §7.4). Feature 001
  already deletes faster than that.
- **F-8 Branding.** No Strava marks in the app's name or icon, no implied
  endorsement (Policy §4.1, §4.3); links to Strava read "View on Strava" (Brand
  Guidelines §3). Feature 001 already follows the "Connect with Strava" rules.
