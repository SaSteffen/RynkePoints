# Feature Specification: Administrators on Every Team's Site

**Feature Branch**: `041-admin-every-team`

**Created**: 2026-11-18

**Status**: Draft

**Input**: User description: "i want to enable an admin to look into both sites. the admin logs in
via strava. if the admins club is not the teams club. since there is no ride data to show for the
admin in that other clubs page, it is okay that the page looks a bit empty."

## Context

Each team has its own site and its own data (feature 026). A team's site lets in only people in
that team's Strava club: anyone else is turned away at sign-in ("not a member"). Administrators
(feature 025) are riders of the team whom a maintainer has flagged by hand. So the administrator of
one team, say Hamburg, can't get into another team's site, say Team Europe's, and can't look at its
admin view.

This feature lets a maintainer name, per team, people who may sign in to that team's site as an
administrator although they aren't in its club. They sign in through Strava as everyone does. They
take no part in that team: none of their activities is read there, and they appear nowhere the
team's riders appear. Their own pages on that site are therefore mostly empty, which is fine.

Strava's grant belongs to the one Strava app all teams share, not to a team (feature 026, edge case
"A rider in both teams' clubs"): revoking it ends the person's access for every team. Today a person
turned away at sign-in has their grant revoked, so an administrator who tries another team's site
loses their connection at their own team. This feature must not do that.

**Terms**:

- **Guest administrator**: a person a team's maintainer has put on that team's guest list, signed
  in to that team's site. They are an administrator there, but not a rider of the team.
- **Guest list**: per team, the Strava IDs of the people who may sign in to that team's site as
  guest administrators. Kept in that team's own data, changed by a maintainer by hand.
- **Own team**: the team whose rider the person is, if any.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - An administrator signs in to another team's site (Priority: P1)

Hamburg's administrator wants to see how Team Europe's site is doing. A maintainer has put their
Strava ID on Team Europe's guest list. They open Team Europe's site, agree to its consent, and sign
in through Strava. They're in, and the Admin entry is there. The admin view shows Team Europe's
usage and riders, exactly as Team Europe's own administrators see it. Their own pages there show no
rides, no Rynke and no badges.

**Why this priority**: This is the request. Without it an administrator can look only at the site of
the team whose club they are in.

**Independent Test**: In fake mode, put a sample rider of Hamburg on Europe's guest list, sign in to
Europe's site as that rider, and open the admin view.

**Acceptance Scenarios**:

1. **Given** a person on Team Europe's guest list who isn't in Team Europe's club, **When** they
   sign in to Team Europe's site, **Then** they are signed in as an administrator and can open the
   admin view.
2. **Given** a person who isn't on the guest list and isn't in the club, **When** they sign in,
   **Then** they are turned away as today.
3. **Given** a guest administrator, **When** they open their own Rynke, badges or rides, **Then**
   the pages show the empty state a rider without rides sees, without waiting for an import.
4. **Given** a guest administrator, **When** they open the team's pages (Team, rankings, figures),
   **Then** they see what every rider of the team sees, and they don't appear in it.

---

### User Story 2 - Their own team keeps working (Priority: P1)

The same administrator is a rider at Hamburg. After signing in to Team Europe's site, or after being
turned away there, their rides at Hamburg keep arriving and counting, without reconnecting.

**Why this priority**: An administrator who loses their own team's connection by looking at another
team's site would have a reason never to do it.

**Independent Test**: In fake mode, sign in to Europe as a guest administrator who is a Hamburg
rider, disconnect there, and check that Hamburg still reads the rider's new rides.

**Acceptance Scenarios**:

1. **Given** a Hamburg rider on Team Europe's guest list, **When** they sign in to Team Europe's
   site, disconnect there, or are removed there, **Then** their grant at Strava stays, and Hamburg
   keeps reading their rides.
2. **Given** a Hamburg rider not on Team Europe's guest list, **When** they are turned away at Team
   Europe's sign-in, **Then** their grant at Strava stays as well.

---

### User Story 3 - A maintainer manages the guest list (Priority: P2)

A maintainer adds a person's Strava ID to a team's guest list, and later takes it off. Once taken
off, the person can't open the site any more, and what the team kept about them is deleted.

**Why this priority**: The list must be changeable for the feature to be safe, but it changes
rarely and by hand.

**Independent Test**: Add and remove an ID on the local database, and sign in before and after.

**Acceptance Scenarios**:

1. **Given** a signed-in guest administrator, **When** a maintainer takes them off the guest list,
   **Then** their next request is treated as from someone who isn't signed in, and their data at
   that team is deleted by the next daily run at the latest.
2. **Given** a guest list, **When** a maintainer looks at the admin view's riders, **Then** guest
   administrators are listed as such, apart from the team's riders.

---

### Edge Cases

- **A guest administrator is also in the team's club**: The guest list wins. They remain a guest
  administrator, and none of their activities is read there, so the two teams can't break each
  other's connection. To ride for the team they ask to be taken off the list and connect again.
- **A blocked person on the guest list**: The block wins; they are turned away as today.
- **The guest withholds the activity permissions on Strava's approval page**: They are let in
  anyway, since nothing of theirs is read (FR-006).
- **Strava sends an event for a guest administrator's activity** (events reach every team): the
  team ignores it.
- **An administrator removes a guest administrator from the admin view**: As for any rider
  (feature 025): their data is deleted and they are blocked at that team. Their grant at Strava
  stays (FR-008).
- **A guest administrator disconnects themselves**: Their data at that team is deleted; their grant
  at Strava stays.
- **The only person on the list has no own team**: Nothing changes; the list doesn't require one.
- **Teams named on the site**: A guest administrator sees only the team whose site they are on. No
  page tells them, or anyone, which team they come from (feature 026 FR-023).

## Requirements *(mandatory)*

### Functional Requirements

**Who gets in**

- **FR-001**: Each team MUST have its own guest list of Strava IDs, kept in that team's own data. A
  maintainer MUST be able to add and remove IDs by hand. No team's list or administrator flag may
  open another team's site.
- **FR-002**: A person on a team's guest list MUST be let in at sign-in to that team's site whether
  or not they are in the team's club, after agreeing to the team's current consent like everyone
  else. The block list (feature 025) MUST still turn them away.
- **FR-003**: A person on the guest list MUST be a guest administrator on that team, even if they
  are in its club too. A guest administrator MUST be an administrator there in every respect of
  feature 025: the admin view, its changes, and the usage alerts with their own switch.
- **FR-004**: Taking a person off the guest list MUST end their access from their next request, and
  their data at that team MUST be deleted by the next daily run at the latest. They are not
  blocked.

**What the team reads and keeps**

- **FR-005**: The team MUST read none of a guest administrator's activities from Strava, start no
  import for them, and ignore Strava's events about them. It MUST NOT check their club membership
  after sign-in; the daily club check MUST NOT remove them.
- **FR-006**: A guest administrator MUST NOT be required to grant the activity permissions; the basic
  permission that identifies them is enough.
- **FR-007**: The team MUST keep no more about a guest administrator than it needs to let them in
  and show them as an administrator: their Strava ID, first name, consent record and the dates
  feature 025 shows for administrators. It MUST NOT keep their Strava tokens.
- **FR-008**: The team MUST NOT revoke a guest administrator's grant at Strava: not at sign-in, not
  when they disconnect, not when they are removed. The same MUST hold for a person turned away at
  sign-in because they aren't in the team's club, so trying another team's site never ends a
  rider's connection at their own team.

**Where they appear**

- **FR-009**: A guest administrator MUST NOT appear anywhere the team's riders appear or are
  counted: team figures and totals, rankings, ride figures, Team Rynke, organiser views and
  graphs, rider summaries, the season album, the counts of connected riders, and the shared
  capacity shown in the admin view.
- **FR-010**: The admin view's list of riders MUST show guest administrators apart from the team's
  riders, marked as guest administrators.
- **FR-011**: A guest administrator's own pages MUST show the empty state of a rider without rides
  and MUST NOT wait for or announce an import. The "you're in another team's club too" notice
  (feature 026 FR-012) MUST NOT be shown to them.
- **FR-012**: All rider-facing text this feature adds MUST be in the catalogs, in all ten
  languages.

**What stays**

- **FR-013**: For the team's riders nothing changes: the consent text already names administrators
  as people who run the app for the team, and they see what they saw before. No new consent version
  or revision is needed.
- **FR-014**: No rider data crosses teams: a guest administrator sees, on a team's site, only that
  team's data, and the team learns nothing about them from their own team.

### Key Entities

- **Guest list entry**: per team; a Strava ID, put there by a maintainer. Nothing else.
- **Guest administrator**: per team; a person on the guest list who has signed in. Strava ID,
  first name, consent record, connection date; no tokens, no activities.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An administrator on a team's guest list reaches that team's admin view in one Strava
  sign-in, without being in the team's club.
- **SC-002**: Signing in to, disconnecting from or being turned away at another team's site leaves
  the person's rides at their own team arriving as before, in 100% of cases.
- **SC-003**: No team figure, ranking, organiser view or rider count changes when a guest
  administrator signs in.
- **SC-004**: The team makes no request to Strava for a guest administrator after the sign-in.

## Assumptions

- Guest administrators are rare (a handful of maintainers and administrators), so a list kept by
  hand, like today's administrator flag, is enough. No page manages it.
- Strava's code exchange at sign-in leaves the token the own team keeps valid. If Strava instead
  replaces it, signing in to another team's site would still break the own team's connection; this
  must be confirmed during planning, since the fake Strava can't show it.
- A guest administrator is never an organiser of the team they visit. Organiser rights are out of
  scope.
- Showing both teams' figures in one admin view (deferred by feature 025 to 026) is out of scope:
  the administrator looks at each team's site separately.
