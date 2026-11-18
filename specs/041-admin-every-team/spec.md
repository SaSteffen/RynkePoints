# Feature Specification: Administrators on Every Team's Site

**Feature Branch**: `041-admin-every-team`

**Created**: 2026-11-18

**Status**: Draft

**Input**: User description: "i want to enable an admin to look into both sites. the admin logs in
via strava. if the admins club is not the teams club. since there is no ride data to show for the
admin in that other clubs page, it is okay that the page looks a bit empty." Follow-up: "a guest
must be admin in their home team. they get the organiser view and the admin view in the other teams
where they are a guest. the goal is to help a developer get to see how any live team currently
looks and identify issues. therefore actually, a guests rides could also show up in the other team
and that guest could also have personal badges. but: the guest never turns up in any team
statistics or counts towards team badges etc. of the team they are a guest in. also the guest is
not shown in the stats of the orga view." Answers: the guest list is kept by hand; a guest may do
everything the team's organisers and administrators can.

## Context

Each team has its own site and its own data (feature 026). A team's site lets in only people in
that team's Strava club: anyone else is turned away at sign-in ("not a member"). Administrators
(feature 025) and organisers are riders of the team whom a maintainer has flagged by hand. So a
developer who is an administrator at Hamburg can't get into Team Europe's live site to see how it
looks and find problems there.

This feature lets a maintainer name, per team, administrators of other teams who may sign in to
that team's site as guests, through Strava like everyone. A guest is an administrator and an
organiser there. Their own rides, Rynke and badges show on their own pages, so the site looks to
them as it does to a rider, but they never count for the team: no team figure, ranking, team
badge, rider count or organiser statistic includes them.

Strava's grant belongs to the one Strava app all teams share, not to a team (feature 026, edge case
"A rider in both teams' clubs"): revoking it ends the person's access for every team. Today a person
turned away at sign-in has their grant revoked, so an administrator who tries another team's site
loses their connection at their home team. This feature must not do that.

**Terms**:

- **Home team**: the team whose club the person rides in and where they are an administrator.
- **Guest list**: per team, the Strava IDs of administrators of other teams who may sign in to
  that team's site. Kept in that team's own data, changed by a maintainer by hand.
- **Guest**: a person on a team's guest list, signed in to that team's site.
- **Team counts**: everything a team's site shows about the team or its riders as a group, or
  about other riders: team figures and totals, rankings, ride figures, Team Rynke, team badges,
  surprises, rider counts, organiser figures, lists and graphs, rider summaries, the season album
  and the admin view's figures.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A developer looks at another team's live site (Priority: P1)

A developer is an administrator at Hamburg. A maintainer has put their Strava ID on Team Europe's
guest list. They open Team Europe's site, agree to its consent, and sign in through Strava. They
are in, with the Orga and Admin entries. They see Team Europe's pages, organiser view and admin
view exactly as Team Europe's own organisers and administrators do, and can act there like them.

**Why this priority**: This is the request: seeing how any live team looks, to find problems.

**Independent Test**: In fake mode, put a sample Hamburg administrator on Europe's guest list, sign
in to Europe's site as them, and open the team, organiser and admin views.

**Acceptance Scenarios**:

1. **Given** a person on Team Europe's guest list who isn't in Team Europe's club, **When** they
   sign in to Team Europe's site, **Then** they are signed in and can open the organiser and admin
   views.
2. **Given** a person who isn't on the guest list and isn't in the club, **When** they sign in,
   **Then** they are turned away as today.
3. **Given** a guest, **When** they act in the organiser or admin view, **Then** they can do what
   the team's organisers and administrators can.

---

### User Story 2 - The guest's own rides show, but never count for the team (Priority: P1)

The developer's rides show on their own pages at Team Europe, with Rynke and personal badges as
Team Europe's rules give them, so they can see these pages as a rider sees them. Team Europe's
figures, rankings, team badges, rider counts and organiser statistics are the same as if the guest
weren't there.

**Why this priority**: Seeing the rider's pages filled is what makes problems visible; changing the
team's figures would falsify a live team's data.

**Independent Test**: In fake mode, compare every team count of Europe before and after a guest
with rides signs in; they must be identical, while the guest's own pages show their rides.

**Acceptance Scenarios**:

1. **Given** a guest with rides in the season, **When** they open their own Rynke, rides and
   badges, **Then** they see them as a rider of that team would.
2. **Given** a guest with rides, **When** anyone opens a team count (team page, ranking, team
   badges, organiser figures and graphs, admin figures), **Then** the guest and their rides are in
   none of them.
3. **Given** a guest, **When** an organiser opens the organiser view's statistics, **Then** the
   guest isn't listed there.

---

### User Story 3 - Their home team keeps working (Priority: P1)

The developer's rides at Hamburg keep arriving and counting while they are a guest at Team Europe,
and after being turned away there.

**Why this priority**: A developer who loses their home team's connection by looking at another
team's site would have a reason never to do it.

**Independent Test**: In fake mode, sign in to Europe as a guest, disconnect there, and check that
Hamburg still reads the rider's new rides.

**Acceptance Scenarios**:

1. **Given** a Hamburg rider on Team Europe's guest list, **When** they sign in to Team Europe's
   site, disconnect there, or are removed there, **Then** their grant at Strava stays, and Hamburg
   keeps reading their rides.
2. **Given** a Hamburg rider not on Team Europe's guest list, **When** they are turned away at Team
   Europe's sign-in, **Then** their grant at Strava stays as well.

---

### User Story 4 - A maintainer manages the guest list (Priority: P2)

A maintainer adds an administrator's Strava ID to another team's guest list, and later takes it
off, for example when the person is no longer an administrator at home.

**Why this priority**: The list must be changeable for the feature to be safe, but it changes
rarely and by hand.

**Independent Test**: Add and remove an ID on the local database, and sign in before and after.

**Acceptance Scenarios**:

1. **Given** a signed-in guest, **When** a maintainer takes them off the guest list, **Then** their
   next request is treated as from someone who isn't signed in, and their data at that team is
   deleted by the next daily run at the latest.
2. **Given** guests, **When** an administrator looks at the admin view's riders, **Then** guests
   are listed as such, apart from the team's riders.

---

### Edge Cases

- **A guest is also in the team's club**: The guest list wins; they stay a guest and count for
  nothing there.
- **A blocked person on the guest list**: The block wins; they are turned away as today.
- **A guest stops being an administrator at home**: Teams don't see each other's data, so nothing
  happens on its own. The maintainer who clears the home flag takes them off the guest lists too
  (FR-002).
- **An administrator removes a guest from the admin view**: As for any rider (feature 025): their
  data there is deleted and they are blocked at that team. Their grant at Strava stays (FR-009).
- **A guest disconnects themselves**: Their data at that team is deleted; their grant at Strava
  stays.
- **A guest disconnects at home**: That revokes the grant, which ends the guest's connection too;
  the guest site handles it as it handles any rider whose grant is gone.
- **A guest's own Rynke and badges**: They follow the guest team's rules and season, from the
  guest's own rides. Badges for the team (team badges, team events) aren't earned through them.
- **A guest as organiser**: Everything the organiser view lists or counts leaves the guest out, so
  there are no corrections, attendance or requests of theirs to handle.
- **Teams named on the site**: A guest sees only the team whose site they are on. No page tells
  anyone which team they come from (feature 026 FR-023).

## Requirements *(mandatory)*

### Functional Requirements

**Who gets in**

- **FR-001**: Each team MUST have its own guest list of Strava IDs, kept in that team's own data. A
  maintainer MUST be able to add and remove IDs by hand. No team's list or flag may open another
  team's site on its own.
- **FR-002**: Only administrators of their home team belong on a guest list. Since teams don't see
  each other's data, keeping it so is the maintainer's task: putting someone on a list, and taking
  them off every list when their home flag is cleared. The maintainer documentation MUST say so.
- **FR-003**: A person on a team's guest list MUST be let in at sign-in to that team's site whether
  or not they are in the team's club, after agreeing to the team's current consent like everyone
  else. The block list (feature 025) MUST still turn them away.
- **FR-004**: A guest MUST be an administrator and an organiser on that team, with the same views,
  changes and alerts as the team's own, for as long as they are on the list. Taking them off the
  list MUST end their access from their next request, and their data at that team MUST be deleted
  by the next daily run at the latest. They are not blocked.

**Their own rides**

- **FR-005**: The team MUST read a guest's activities as it does a rider's, and show the guest
  their own rides, Rynke and personal badges under the team's rules.
- **FR-006**: The team MUST NOT check a guest's club membership after sign-in; the daily club check
  MUST NOT remove them.

**Never counted for the team**

- **FR-007**: A guest and their rides MUST NOT appear in, or change, any team count (see Terms):
  for every viewer, every team count MUST be the same as if the guest weren't connected.
- **FR-008**: The admin view's list of riders MUST show guests apart from the team's riders, marked
  as guests. It is the only list of people on the site that shows them. The "you're in another
  team's club too" notice (feature 026 FR-012) MUST NOT be shown to them.

**Their home team's connection**

- **FR-009**: The team MUST NOT revoke a guest's grant at Strava: not when they disconnect, not
  when they are removed or taken off the list. The same MUST hold for a person turned away at
  sign-in because they aren't in the team's club, so trying another team's site never ends a
  rider's connection at their home team.
- **FR-010**: Reading a guest's rides MUST NOT break their home team's connection. If Strava allows
  only one working token per person for the shared app (see Assumptions), the guest team MUST NOT
  read their activities: the guest's own pages then stay empty, and everything else in this
  feature holds.

**What stays**

- **FR-011**: For the team's riders nothing changes in what they agreed to: the consent text names
  administrators as people who run the app for the team and organisers by role, not as club
  members, and neither sees more than before. No new consent version or revision is needed.
- **FR-012**: No rider data crosses teams: a guest sees, on a team's site, only that team's data,
  and the team learns nothing about them from their home team.
- **FR-013**: All rider-facing text this feature adds MUST be in the catalogs, in all ten
  languages.

### Key Entities

- **Guest list entry**: per team; a Strava ID, put there by a maintainer. Nothing else.
- **Guest**: per team; a person on the guest list who has signed in. Kept like a rider (Strava ID,
  first name, consent record, credentials, activities, own Rynke and badges), marked as a guest so
  that no team count includes them.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An administrator on a team's guest list reaches that team's organiser and admin views
  in one Strava sign-in, without being in the team's club.
- **SC-002**: Every team count of a team is identical with and without a guest who has rides in
  the season.
- **SC-003**: Signing in to, disconnecting from or being turned away at another team's site leaves
  the person's rides at their home team arriving as before, in 100% of cases.
- **SC-004**: A guest sees their own rides at the guest team within the time a new rider waits for
  their import.

## Assumptions

- Guests are a handful of developers and administrators, so a list kept by hand, like today's
  administrator and organiser flags, is enough. No page manages it.
- Feature 026 assumes that two teams holding tokens for the same person break each other (a new
  refresh token invalidating the old one). Whether Strava does that MUST be confirmed during
  planning with a real account, since the fake Strava can't show it. FR-010 says what holds if it
  does.
- Treating guests as administrators and organisers needs no new consent version, because the
  consent and privacy texts describe both by role. Planning checks this against the constitution's
  consent rules.
- Showing several teams' figures in one admin view is out of scope: the guest looks at each team's
  site separately.
