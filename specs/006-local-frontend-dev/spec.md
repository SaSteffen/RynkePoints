# Feature Specification: Local Frontend Development with a Fake Strava

**Feature Branch**: `005-rider-view` (specified on the rider-view branch, no branch of
its own)

**Created**: 2026-10-07

**Status**: Draft

**Input**: User description: "I need a spec to be able to debug the frontend locally.
We currently see it on port 8787; use a different port since I run something else
there on my PC: use 8789. I do not want to use up Strava credits, so find a way to fake
that. My main use case is developing the frontend without the need to deploy."

## User Scenarios & Testing *(mandatory)*

The **developer** is whoever works on the app's pages on their own machine (today the
maintainer). The **local app** is the app running on that machine against its own
local database, never against production. The **fake Strava** is a stand-in, running
only locally, that answers everything the app would otherwise ask the real Strava
(sign-in, permissions, rider profile, club membership, activities, token refresh and
revocation) with synthetic data. A **sample rider** is a synthetic rider, with
synthetic rides, that exists only in the local database. Pages are the rider-facing
ones that exist today (landing page, consent, rider page `/me` with the feature 005
sections, disconnect, notices) and any added later.

### User Story 1 - See the pages locally with data, no Strava involved (Priority: P1)

The developer starts the local app with one command and opens it in the browser on
port 8789. They sign in as a sample rider without going to Strava and see the rider
page filled with synthetic rides and Rynke. When they change a page, template, style
or translation and reload the browser, they see the change. Nothing is deployed and
not a single call reaches Strava.

**Why this priority**: This is the whole point: working on the frontend without
deploying and without spending the app's Strava request budget, which production
riders share (constitution Principle II).

**Independent Test**: With no network connection to Strava (or with Strava blocked),
start the local app, open `http://localhost:8789`, sign in as a sample rider, see the
rider page with rides and Rynke, change a visible text in a catalog, reload and see
the new text.

**Acceptance Scenarios**:

1. **Given** a fresh checkout with dependencies installed and the documented local
   settings in place, **When** the developer runs the documented start command,
   **Then** the app answers on port 8789 and nothing on the machine's port 8787 is
   used or disturbed.
2. **Given** the local app is running with the fake Strava, **When** the developer
   goes through "Connect with Strava" on the landing page, **Then** they land on a
   local stand-in for Strava's permission screen instead of strava.com, and
   confirming it brings them back signed in as a sample rider.
3. **Given** a signed-in sample rider with synthetic rides, **When** the developer
   opens the rider page, **Then** it shows the same sections, numbers and wording a
   real rider with the same rides would see.
4. **Given** the local app is running, **When** the developer edits a page or a
   catalog entry and reloads the browser, **Then** the change is visible without
   restarting anything and without deploying.
5. **Given** the local app is running with the fake Strava, **When** the developer
   uses any page or flow, **Then** no request leaves the machine for Strava, and the
   app's recorded Strava request budget is unaffected.

---

### User Story 2 - Switch between riders in different states (Priority: P2)

The developer picks which sample rider to be, so they can see how each page looks
for riders in different situations without arranging those situations by hand: a
rider who just connected (import still running), one with no rides yet, one far from
the thresholds, one who has reached the Training Rynke target, one who has reached
it only thanks to virtual rides (so the share without them is still short), one with
rides that don't count (too slow, overlapping, e-bike), one with more
rides than fit on one page, one who withheld the optional permissions (private
activities, description edits), one who must reconnect, and one who is not a club
member. Riders who are in (that needs Team Rynke, which only team events give),
riders with team events or corrections, and riders whose numbers are being
recalculated join the list once the app can reach those states through its normal
paths (FR-012): when organisers can enter team events and corrections, and when
there is a second rules version.

**Why this priority**: Most frontend work on the rider page is about how it looks in
a particular state (empty, nearly there, done, in progress). Without ready-made
states the developer would have to fake them in the database by hand every time.

**Independent Test**: Reset the local data, sign in as each listed sample rider in
turn and check that the rider page shows the state the sample rider is named for.

**Acceptance Scenarios**:

1. **Given** the local app is running with sample data, **When** the developer
   starts the sign-in, **Then** the stand-in permission screen lets them choose which
   sample rider to sign in as and which optional permissions to grant.
2. **Given** a sample rider chosen on the stand-in screen, **When** the developer
   withholds a required permission, **Then** the app reacts exactly as it does when
   a real rider withholds it on Strava.
3. **Given** the developer is signed in as one sample rider, **When** they sign out
   and sign in as another, **Then** the pages show the second rider's data only.
4. **Given** the developer changed or broke the local data while working, **When**
   they run the documented reset, **Then** the local database is back to the
   documented sample riders and rides.

---

### User Story 3 - Let new rides arrive locally (Priority: P3)

The developer makes something happen that would normally come from Strava, such as
a new ride, an edited ride, a deleted ride or a rider revoking access, and watches
the pages react: the ride appears with its result, the tally changes, the rider is
signed out and their data removed.

**Why this priority**: Useful for checking how pages behave while work is in
progress or after it finishes, but the pages can be developed against static sample
data first.

**Independent Test**: Signed in as a sample rider, trigger a "new ride" event for
that rider through the documented local means, reload the rider page and see the new
ride and the changed tally.

**Acceptance Scenarios**:

1. **Given** a signed-in sample rider, **When** the developer triggers a new
   synthetic ride for them, **Then** the app processes it the same way as a real
   Strava event (acknowledge, queue, fetch from the fake Strava, evaluate) and the
   ride appears on the rider page.
2. **Given** a sample rider, **When** the developer triggers an access-revoked event
   for them, **Then** the app deletes that rider's local data as it would in
   production.
3. **Given** the developer triggers the same event twice, **When** both are
   processed, **Then** the outcome is the same as triggering it once (Principle II).

---

### Edge Cases

- Port 8789 is already taken on the machine: the start fails with a message naming
  the port; the app does not silently move to another port.
- The developer has real Strava app credentials in their local settings: with the
  fake Strava switched on they are not even read; the fake Strava is chosen by the
  start command the developer runs, not by guessing from the credentials.
- The fake Strava setting ends up in production by mistake: the production app
  refuses to use it (it keeps talking to the real Strava or fails loudly), it never
  serves the stand-in permission screen, and no sample data is ever written to the
  production database.
- The local database has no tables yet: the documented first-run steps create the
  schema and load the sample data; the app doesn't start against a half-made
  database without saying so.
- The developer switches the fake Strava off locally on purpose: the app behaves as
  today (talks to the real Strava with the developer's own local credentials); that
  remains possible but is not the documented default for frontend work.
- A sample rider's token "expires": the fake Strava refreshes it like Strava would,
  so token refresh is exercised without a real Strava call.
- The fake Strava is asked for something it has no answer for: it answers like
  Strava answers an unknown resource (not found), so the app's existing handling
  shows, and the developer sees in the local log which request was unanswered.

## Requirements *(mandatory)*

### Functional Requirements

**Running locally**

- **FR-001**: The local app MUST answer on port 8789 when started with the
  documented start command, without the developer passing a port each time.
- **FR-002**: The local app MUST use only local storage, queue and scheduling
  stand-ins; it MUST NOT read or write production data or resources.
- **FR-003**: Changes to pages, styles and translations MUST be visible after a
  browser reload while the local app keeps running.
- **FR-004**: The steps to get from a fresh checkout to a signed-in sample rider
  (settings to create, schema, sample data, start command, URL) MUST be documented
  in the repository, in one place, in no more than a handful of steps.

**Fake Strava**

- **FR-005**: The app MUST be able to run against a fake Strava, chosen explicitly
  by the start command, that stands in for every Strava interaction the app has:
  the permission screen, code exchange, token refresh, token revocation, rider
  profile, club membership, activity list and single activity.
- **FR-006**: With the fake Strava switched on, the app MUST NOT send any request to
  Strava, and MUST NOT count the fake's answers against its recorded Strava request
  budget in a way that blocks local work.
- **FR-007**: The fake Strava's answers MUST have the same shape as Strava's, so the
  app runs its normal code paths (consent, connect, import, evaluation, pages)
  rather than special local ones; the only part that differs is where requests go.
- **FR-008**: The stand-in permission screen MUST let the developer choose the
  sample rider and which permissions to grant (required and optional), and MUST
  support cancelling, so every sign-in outcome the app handles can be reached.
- **FR-009**: The fake Strava MUST be impossible to activate in production: the
  production configuration MUST NOT contain the setting, and the app MUST refuse to
  use the fake Strava when it isn't running locally. This guard MUST be covered by
  an automated test.
- **FR-010**: The fake Strava MUST log each request it answers to the local console
  so the developer can see what the app asked for.

**Sample data**

- **FR-011**: The repository MUST contain a set of sample riders and rides covering
  at least the states listed in User Story 2. All of it MUST be synthetic: invented
  names and IDs, no real rider data, no GPS data (constitution Principle I).
- **FR-012**: Sample rides MUST be served by the fake Strava and imported through
  the app's normal import, or loaded so that the result is identical to such an
  import; either way the rider page MUST show what the app's own rules compute, not
  hand-written numbers.
- **FR-013**: A documented single command MUST reset the local database to the
  sample data.
- **FR-014**: The developer MUST be able to trigger, for a sample rider, the Strava
  events the app reacts to (new, updated and deleted activity, access revoked)
  without Strava sending them.

### Key Entities

- **Fake Strava**: A local-only stand-in for Strava's sign-in and API, holding the
  sample riders and their rides; never deployed in an active state.
- **Sample rider**: A synthetic rider with a fixed state (see User Story 2), a
  display name that makes the state obvious, club membership and granted
  permissions.
- **Sample ride**: A synthetic activity of a sample rider with the fields the app
  stores (date, sport type, distance, elevation gain, moving time, visibility), no
  GPS.
- **Fake mode**: The way of starting the local app that uses the fake Strava. Its
  settings are synthetic and part of the repository, and the developer's own local
  settings (with any real Strava credentials) are not read in this mode.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From a fresh checkout, a developer following the documentation sees a
  sample rider's filled rider page on port 8789 within 10 minutes.
- **SC-002**: A full local session (sign-in, every page, switching riders, triggering
  events) makes zero requests to Strava and leaves the production Strava request
  budget untouched.
- **SC-003**: A change to a page or translation is visible in the browser within
  5 seconds of saving, without a deploy or restart.
- **SC-004**: Every rider state listed in User Story 2 can be reached in under 1
  minute (choose sample rider, sign in, open the page).
- **SC-005**: Activating the fake Strava in production is impossible; the guard's
  automated test fails if it is removed.

## Assumptions

- The developer works on Linux or macOS with the project's usual tooling (`pnpm`)
  installed; Windows is not considered.
- Port 8789 is fixed for local runs of this project; other ports the local tooling
  opens alongside (e.g. a debugger) only need to avoid 8787, not be configurable.
- "Debugging the frontend" means seeing and changing pages in a browser, with the
  browser's own developer tools; stepping through the app's server-side code in a
  debugger is welcome if the local tooling gives it for free but is not a
  requirement.
- The fake Strava is for local development only. Automated tests keep mocking Strava
  as they do today (Principle V); they may reuse the sample data where that helps
  but this feature does not change how they work.
- The fake Strava lives in the repository (it is project code, reviewed like any
  other), not in a separately hosted service.
- Organiser pages don't exist yet; when they do, they use the same sample data and
  fake Strava, and sample organisers are added then.
- This feature is specified on the `005-rider-view` branch at the maintainer's
  request because it serves the rider-view frontend work; it doesn't change any
  rider-facing behaviour.
