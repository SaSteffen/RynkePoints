# Feature Specification: Administrators Give and Take Roles

**Feature Branch**: `043-admin-grants-roles`

**Created**: 2026-11-21

**Status**: Draft

**Input**: User description: "i want to spec how we can have a sites's admin grant roles to other
users. currently the only way to grant a role is via a direct database change." Answers: the
organiser and administrator roles can be changed in the app, the guest list stays a by-hand step;
any administrator may give and take both roles, but not take away their own administrator role;
guests can't change roles; the last administrator is protected from removal too.

## Context

A team's site has two roles on top of being a rider: **organiser** (feature 004: the organiser
view with events, attendance, corrections and rider figures) and **administrator** (feature 025:
the usage view, the rider overview and removing riders). A rider may hold either, both or neither.
Today a maintainer gives and takes both by changing the rider's record in the database by hand
(feature 004 FR-004, feature 025 FR-002). That needs database access, which only the maintainers
have, and every change waits for one of them.

This feature lets a team's administrators give and take both roles from the admin view's rider
overview, for the riders listed there. The guest list (feature 041) stays a by-hand step: guests
are administrators of another team, not riders of this one.

An administrator can remove riders, other administrators among them. Today nothing stops a team
from losing its last administrator that way. This feature makes sure the app never takes a team's
last administrator away.

**Terms**:

- **Role**: organiser or administrator.
- **Own administrator**: an administrator of the team who is a rider of that team, not a guest
  (feature 041). Guests are administrators while they are on the guest list, but they don't count
  here.
- **Rider overview**: the admin view's list of the team's connected riders (feature 025 US3).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - An administrator makes a rider an organiser (Priority: P1)

A rider helps plan the team's rides and needs the organiser view. An administrator opens the rider
overview, finds the rider and gives them the organiser role. On the rider's next page the Orga
entry is there. When the rider stops helping, the administrator takes the role away the same way.

**Why this priority**: Organisers change most often, and each change today waits for a
maintainer with database access.

**Independent Test**: In fake mode, sign in as a sample administrator, give a sample rider without
a role the organiser role, then sign in as that rider and open the organiser view; take the role
away and check that the organiser view is refused.

**Acceptance Scenarios**:

1. **Given** an administrator and a listed rider who isn't an organiser, **When** the
   administrator gives them the organiser role, **Then** the overview shows the rider as an
   organiser and the rider can use the organiser view from their next request.
2. **Given** a listed organiser, **When** an administrator takes the role away, **Then** the
   overview no longer shows them as an organiser and the organiser view is refused to them from
   their next request.
3. **Given** an administrator, **When** they give or take the organiser role on their own card,
   **Then** it works as for any other rider.

---

### User Story 2 - An administrator makes another rider an administrator (Priority: P1)

A team needs a second person to look after its site. An administrator opens the rider overview,
gives a trusted rider the administrator role and confirms, since an administrator can remove
riders. The new administrator sees the Admin entry from their next page. Later an administrator
takes the role away again, after confirming.

**Why this priority**: A team that relies on one administrator, or waits for a maintainer to
add another, has nobody to turn to when that person is away.

**Independent Test**: In fake mode, sign in as a sample administrator, give a sample rider the
administrator role, confirm, then sign in as that rider and open the admin view; take the role
away and check that the admin view is refused.

**Acceptance Scenarios**:

1. **Given** an administrator and a listed rider who isn't an administrator, **When** the
   administrator gives them the administrator role, **Then** they are asked to confirm first, and
   after confirming the rider can use the admin view from their next request.
2. **Given** another administrator in the overview, **When** an administrator takes the role away
   and confirms, **Then** that person is refused the admin view from their next request and stays
   a rider, with their organiser role, if they have one, unchanged.
3. **Given** an administrator, **When** they look at their own card, **Then** there is no way to
   take away their own administrator role.
4. **Given** an administrator who cancels the confirmation, **When** they return to the overview,
   **Then** nothing has changed.

---

### User Story 3 - A team never loses its last administrator through the app (Priority: P2)

Removing riders and taking roles away can't leave a team without one of its own administrators.
The administrator who acts is always one of the team's own, since guests can't change roles, and
nobody can take away their own administrator role. So the gap left is removal: a guest could
remove the team's only own administrator.

**Why this priority**: A team without administrators can only be fixed by a maintainer in the
database again, which is what this feature is meant to make rare. It is rare itself, so it comes
after the two stories that change roles.

**Independent Test**: In fake mode, with exactly one own administrator, sign in as a guest and try
to remove them; check that the removal is refused and nothing was deleted or blocked.

**Acceptance Scenarios**:

1. **Given** a team with exactly one own administrator, **When** anyone tries to remove them,
   **Then** the removal is refused with a message saying why, and nothing is deleted, blocked or
   revoked.
2. **Given** a team with two own administrators, **When** one removes the other, **Then** the
   removal works as today.

---

### User Story 4 - A guest sees the roles but can't change them (Priority: P3)

A guest administrator from another team opens the rider overview. They see who holds which role,
as the team's own administrators do, but there is nothing to change them with, and a change sent
anyway is refused. Guests' own cards show no role controls for anyone.

**Why this priority**: Who looks after a team is that team's own decision. Guests are there to
look at the site, not to run it.

**Independent Test**: In fake mode, sign in to Europe's site as a sample guest, open the rider
overview, check that no role control is shown, and send a role change directly: it is refused and
nothing changes.

**Acceptance Scenarios**:

1. **Given** a guest, **When** they open the rider overview, **Then** they see every listed
   rider's roles and no control to change them.
2. **Given** a guest, **When** they send a role change anyway, **Then** it is refused and nothing
   changes.
3. **Given** an own administrator, **When** they look at a guest's card, **Then** it shows no role
   controls: a guest's roles come from the guest list alone.

### Edge Cases

- **The rider is signed in when their role changes**: The roles are read afresh on every request
  (feature 004 FR-003), so the change applies from their next request. A page already open
  doesn't change until they move on, and a change they send from it is refused if they no longer
  hold the role.
- **Two administrators change the same rider at the same time**: Each change says what the role
  should become, not "switch it", so sending one twice changes nothing more and the later change
  wins.
- **The rider disappears while the change is being sent**: They left, were removed or their club
  membership ended. The change is refused with a message that the rider is no longer listed, and
  nothing is created for them.
- **A rider who left comes back**: Their roles went with their data (feature 004 FR-015), so they
  come back without one, as today.
- **A removed administrator**: Removal deletes their roles with their data, as today. It is only
  refused when they are the team's last own administrator (FR-011).
- **The last own administrator leaves by themselves**: Leaving is every rider's right (constitution
  Principle I) and the app doesn't stop it. The same holds when Strava access is revoked or the
  daily check finds they left the club. The team then has no own administrator until a maintainer
  sets one by hand (FR-013).
- **A new administrator and the usage alerts**: They get the alerts as every administrator does,
  until they switch them off (feature 025).
- **Taking away the administrator role from a guest**: Not possible in the app; the maintainer
  takes them off the guest list (feature 041).
- **A rider is both organiser and administrator**: The two roles are given and taken
  independently.
- **A rider without a current consent**: Only riders the overview lists can be given a role, as
  for removal. A rider who hasn't agreed to the current consent yet still meets the consent gate
  first, role or not (feature 004).

## Requirements *(mandatory)*

### Functional Requirements

**Giving and taking roles**

- **FR-001**: An own administrator MUST be able to give and take the organiser role for every
  rider the rider overview lists, themselves included.
- **FR-002**: An own administrator MUST be able to give and take the administrator role for every
  rider the rider overview lists, except taking it from themselves.
- **FR-003**: Giving or taking the administrator role MUST ask for confirmation first, saying what
  the role allows (among other things removing riders). Cancelling MUST change nothing. Changing
  the organiser role MUST NOT need a confirmation; it is undone the same way.
- **FR-004**: The rider overview MUST show each listed rider's roles, to every administrator,
  guests included, in a way that doesn't rely on colour alone.
- **FR-005**: A change MUST state the role and whether it is given or taken. Sending the same
  change again MUST change nothing more.
- **FR-006**: A change MUST apply from the affected rider's next request, as roles are read today,
  and the administrator MUST see the result on the overview at once, with a notice of what
  changed.
- **FR-007**: Changing a role MUST NOT change anything else about the rider: their rides, Rynke,
  badges, consent, connection and the other role stay as they are.

**Who may change roles**

- **FR-008**: Changes MUST be refused to anyone who isn't an own administrator of the team, in the
  way other admin changes are refused (feature 025 FR-003): visitors, riders, organisers and
  guests. A refused change MUST change nothing.
- **FR-009**: Guests MUST NOT see any role control. Their own cards MUST NOT have role controls
  for anyone either: their roles come only from the guest list (feature 041 FR-004).
- **FR-010**: A change for a rider the overview doesn't list (not connected, gone, a guest, of
  another team, or unknown) MUST be refused with a message, and nothing MUST be stored for them.

**The last administrator**

- **FR-011**: Removing a rider (feature 025 FR-021) MUST be refused when they are the team's only
  own administrator, with a message saying why. Nothing MUST be deleted, blocked or revoked.
- **FR-012**: No change in the app MUST leave the team without an own administrator. With FR-002,
  FR-008 and FR-011 this holds for every change an administrator or guest can make.
- **FR-013**: A maintainer MUST still be able to give and take both roles by hand, as today, for
  example to set a new team's first administrator or when the last one left by themselves. The
  guest list MUST stay a by-hand step.

**Text and teams**

- **FR-014**: All new text MUST be in the catalogs, in all ten languages, German first.
- **FR-015**: Roles MUST be per team. A change on one team's site MUST NOT change anything on
  another team's site, also for a person who rides in both clubs.

### Key Entities

- **Rider's roles**: whether the rider is an organiser and whether they are an administrator of
  the team, as today. They go with the rider's data when the rider leaves or is removed. This
  feature adds no new stored data.
- **Guest list**: unchanged (feature 041). It is what makes a guest an administrator and an
  organiser, and the app still only reads it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An administrator gives or takes a role in under a minute from opening the rider
  overview, without help from a maintainer.
- **SC-002**: After a change, the affected rider has the new rights on their very next request, in
  every test.
- **SC-003**: In tests, every role change sent by a visitor, rider, organiser or guest is refused
  and leaves every rider's roles unchanged.
- **SC-004**: In tests, no sequence of changes and removals made through the app leaves a team
  without an own administrator.
- **SC-005**: After the release, maintainers change roles in the database only to set a team's
  first administrator or when a team has lost its last one.

## Assumptions

- **Superseded requirements**: This feature replaces feature 004 FR-004 ("no way to grant or
  remove the organiser role from inside the app") and the by-hand part of feature 025 FR-002. The
  by-hand way stays available to maintainers (FR-013).
- **Consent**: Roles are the team's own data, not data read from Strava, and administrators
  already see every listed rider's first name and connection state. Showing roles to
  administrators shows nothing new from Strava, so no consent revision is needed. Being given a
  role changes what the rider may see, not what others see about them.
- **No notification**: The rider isn't told by email or notice. They find the new entry in the
  navigation. The team agrees on roles in person, as today.
- **No change history**: Role changes aren't recorded beyond the current state. Removals are
  recorded (feature 025 FR-023) because they can't be undone; a role change can be undone the
  same way it was made.
- **Same rights for every own administrator**: There is no "owner" or higher administrator. Any
  own administrator can take the role from any other, which is acceptable for teams that trust
  their administrators.
- **Where it lives**: The controls are on the rider overview's cards, since that is the list of
  riders an administrator may act on, next to removal.
- **Fake mode**: The sample riders' roles from the seed can be changed in the app like real ones.
