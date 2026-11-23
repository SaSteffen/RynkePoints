# Feature Specification: Administrators Give and Take Roles

**Feature Branch**: `043-admin-grants-roles`

**Created**: 2026-11-21

**Updated**: 2026-11-23, after the design draft (issue #351)

**Status**: Draft

**Input**: User description: "i want to spec how we can have a sites's admin grant roles to other
users. currently the only way to grant a role is via a direct database change." Answers: the
organiser and administrator roles can be changed in the app, the guest list stays a by-hand step;
only administrators change roles, on the admin page; an administrator is always an organiser too;
nobody changes their own role; the last administrator is protected from removal too; guests can't
change roles. From the design draft: a third admin view "Rollen"; one choice per rider between no
role, Orga and Admin; undo; the rider is told on their next visit; no change history; organisers
and administrators see in Settings who is in the Orga.

**Design draft**: Claude Design canvas "RynkePoints Roles"
(https://claude.ai/artifact/BwjhMTn1HpksgarG4DgeQ4). The pages follow it.

## Context

A team's site has two roles on top of being a rider: **organiser** (feature 004: the organiser
view with events, attendance, corrections and rider figures; "Orga" in the app) and
**administrator** (feature 025: the usage view, the rider overview and removing riders; "Admin").
Today a maintainer gives and takes both by changing the rider's record in the database by hand
(feature 004 FR-004, feature 025 FR-002). That needs database access, which only the maintainers
have, and every change waits for one of them.

This feature lets a team's administrators give and take both roles in the app, in a new admin
view. An administrator is always an organiser too, so each rider has exactly one of three roles:
none, Orga or Admin. The guest list (feature 041) stays a by-hand step: guests are administrators
of another team, not riders of this one.

An administrator can remove riders, other administrators among them. Today nothing stops a team
from losing its last administrator that way. This feature makes sure the app never takes a team's
last administrator away.

**Terms**:

- **Role**: none, Orga (organiser) or Admin (administrator, which includes Orga).
- **Own administrator**: an administrator of the team who is a rider of that team, not a guest
  (feature 041). Guests are administrators while they are on the guest list, but they don't count
  here.
- **Listed rider**: a rider the admin view's rider overview lists (feature 025 US3): connected to
  this team, agreed to the current consent, not a guest. These are the riders who share their data
  with the team.
- **Rollen**: the new admin view, a third tab after Nutzung and Rider.
- **Role card**: the card a rider finds on their Du page after their role changed.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - An administrator makes a rider an organiser (Priority: P1)

A rider helps plan the team's rides and needs the organiser view. An administrator opens Admin ›
Rollen, finds the rider with the search, picks Orga and saves. The choice says what an organiser
sees. On the rider's next visit a card on their Du page says they are now in the Orga, who added
them and when, and offers to start the Orga-Rundgang. The Orga entry replaces Termine in their
navigation.

**Why this priority**: Organisers change most often, and each change today waits for a
maintainer with database access.

**Independent Test**: In fake mode, sign in as the sample administrator, give a sample rider
without a role the Orga role, then sign in as that rider: the card is on the Du page, the Orga
entry is in the navigation and the organiser view opens.

**Acceptance Scenarios**:

1. **Given** an administrator on Rollen, **When** they search, **Then** only listed riders appear,
   and those who already hold a role are in the Admins or Orga list instead.
2. **Given** a listed rider without a role, **When** the administrator picks Orga and saves,
   **Then** the rider moves to the Orga list with the date, a notice says what changed, and the
   rider can use the organiser view from their next request.
3. **Given** the choice for a rider, **When** the administrator cancels, **Then** nothing changes.
4. **Given** a rider just made an organiser, **When** they next open the app, **Then** their Du
   page shows the card "Du bist jetzt in der Orga" with who and when, a line that the riders
   agreed to the Orga seeing their data and nothing more, and the buttons "Rundgang starten" and
   "Später".
5. **Given** that card, **When** the rider taps "Rundgang starten", **Then** the Orga-Rundgang
   starts without its former first step ("Du bist jetzt in der Orga …"), which the card replaces,
   and the card is gone.
6. **Given** that card, **When** the rider taps "Später", **Then** the card is gone and the
   Orga-Rundgang stays available in Settings as today.

---

### User Story 2 - An administrator makes a rider an administrator (Priority: P1)

A team needs a second person to look after its site. An administrator gives a listed rider, with
or without the Orga role, the Admin role the same way. The choice says that Admin is everything
the Orga has plus the usage, removing riders and changing roles. On their next visit the rider
finds a card "Du bist jetzt Admin", and Orga and Admin are in their navigation.

**Why this priority**: A team that relies on one administrator, or waits for a maintainer to add
another, has nobody to turn to when that person is away.

**Independent Test**: In fake mode, sign in as the sample administrator, give a sample rider the
Admin role, then sign in as that rider: the card is there and both the organiser view and the
admin view open.

**Acceptance Scenarios**:

1. **Given** a listed rider without a role or with Orga, **When** the administrator picks Admin and
   saves, **Then** the rider moves to the Admins list and can use the admin view and the organiser
   view from their next request.
2. **Given** a rider just made an administrator, **When** they next open the app, **Then** their
   Du page shows "Du bist jetzt Admin" with who and when, what the admin view holds, and that they
   are in the Orga too. If they haven't done the Orga-Rundgang yet, the card offers
   "Orga-Rundgang starten"; otherwise it only has a button to close it.
3. **Given** a new administrator, **When** they open the admin view, **Then** no tour is shown:
   there is no admin tour.

---

### User Story 3 - An administrator takes a role away (Priority: P1)

A rider stops helping. An administrator opens their entry on Rollen, picks a lower role (Orga or
none for an administrator, none for an organiser) and saves. A notice confirms the change with
"Rückgängig", which puts the old role back. On the rider's next visit a card tells them, and the
navigation matches the new role again.

**Why this priority**: Taking a role back is as common as giving one, and leaving an old
organiser with the riders' data is the worse mistake.

**Independent Test**: In fake mode, as the sample administrator, take the Orga role from the
sample organiser, then sign in as them: the card says they are no longer in the Orga, Termine is
back in the navigation and the organiser view is refused. Repeat, tap "Rückgängig" before signing
in as them: no card, the role is unchanged.

**Acceptance Scenarios**:

1. **Given** an organiser, **When** an administrator picks no role and saves, **Then** they leave
   the Orga list, a notice "… ist nicht mehr in der Orga." with "Rückgängig" appears, and the
   organiser view is refused to them from their next request.
2. **Given** that notice, **When** the administrator taps "Rückgängig", **Then** the rider has the
   role they had before, as if nothing happened.
3. **Given** a former organiser, **When** they next open the app, **Then** their Du page shows
   "Du bist nicht mehr in der Orga" with who and when and that their events are under Termine
   again, with a button to close it.
4. **Given** an administrator taken down to Orga, **When** they next open the app, **Then** their
   Du page says they are no longer an admin and still in the Orga; the Admin entry is gone.
5. **Given** a change that was undone before the rider came back, **When** the rider opens the
   app, **Then** no card is shown: the card is about what changed since their last visit.

---

### User Story 4 - Nobody changes their own role, and the last administrator stays (Priority: P2)

An administrator's own entry on Rollen has no "Ändern"; another administrator has to do it. The
only own administrator sees a note that nobody else is an admin. Together with the rule that
guests can't change roles, this means a change on Rollen never leaves the team without an own
administrator. The remaining gap is removal: a guest could remove the team's only own
administrator, and the app refuses that.

**Why this priority**: A team without administrators can only be fixed by a maintainer in the
database again, which is what this feature is meant to make rare. It is rare itself, so it comes
after the stories that change roles.

**Independent Test**: In fake mode, as the only own administrator, check that the own entry has
no "Ändern" and that a change sent for oneself is refused; sign in as a guest and try to remove
the only own administrator: refused, nothing deleted or blocked.

**Acceptance Scenarios**:

1. **Given** an administrator on Rollen, **When** they look at their own entry, **Then** it is
   marked "Du" and has no way to change it, and a change sent anyway is refused.
2. **Given** a team with exactly one own administrator, **When** that administrator opens Rollen,
   **Then** a note under the Admins list says nobody else is an admin and their own role can only
   be changed by another administrator.
3. **Given** a team with exactly one own administrator, **When** anyone tries to remove them,
   **Then** the removal is refused with a message saying why, and nothing is deleted, blocked or
   revoked.
4. **Given** a team with two own administrators, **When** one removes the other, **Then** the
   removal works as today.

---

### User Story 5 - Organisers and administrators see who is in the Orga (Priority: P3)

An organiser wants to know who else is in the Orga. In Settings, under "Rynke und deine Daten",
a row "Wer in der Orga ist" names the team's administrators (marked as such) and organisers.
Opened, it says what they see; for administrators it also has the link "Mitglieder ändern" to
Rollen. Other riders don't get the row.

**Why this priority**: Useful, but the roles work without it.

**Independent Test**: In fake mode, open Settings as the sample organiser (row, no link), as the
sample administrator (row and link to Rollen) and as a rider without a role (no row).

**Acceptance Scenarios**:

1. **Given** an organiser, **When** they open Settings, **Then** the row lists the own
   administrators, marked "(Admin)", and the organisers, and has no link.
2. **Given** an own administrator, **When** they open the row, **Then** it has the link
   "Mitglieder ändern", which opens Rollen.
3. **Given** a rider without a role, **When** they open Settings, **Then** there is no such row.

---

### User Story 6 - A guest sees the roles but can't change them (Priority: P3)

A guest administrator from another team opens Rollen. They see who holds which role, as the
team's own administrators do, but there is nothing to change them with, and a change sent anyway
is refused.

**Why this priority**: Who looks after a team is that team's own decision. Guests are there to
look at the site, not to run it.

**Independent Test**: In fake mode, sign in as the sample guest, open Rollen: the lists are
there, without search, "Ändern" or "Rolle geben"; a change sent directly is refused and nothing
changes.

**Acceptance Scenarios**:

1. **Given** a guest, **When** they open Rollen, **Then** they see the Admins and Orga lists and
   no control to change them.
2. **Given** a guest, **When** they send a role change anyway, **Then** it is refused and nothing
   changes.
3. **Given** a guest, **When** they open Settings, **Then** the row "Wer in der Orga ist" has no
   link.

### Edge Cases

- **The rider is signed in when their role changes**: Roles are read afresh on every request
  (feature 004 FR-003), so the change applies from their next request. A page already open doesn't
  change until they move on, and a change they send from it is refused if they no longer hold the
  role. The card shows on their next Du page.
- **Two administrators change the same rider at the same time**: Each change says what the role
  should become, not "one step up", so sending one twice changes nothing more and the later change
  wins.
- **The rider disappears while the change is being sent**: They left, were removed or their club
  membership ended. The change is refused with a message that the rider is no longer listed, and
  nothing is stored for them.
- **Several changes before the rider comes back**: The card says where they ended up compared
  with what they had on their last visit, by the administrator who made the last change. No
  difference, no card.
- **"Rückgängig" after the rider already saw the card**: It puts the role back like any change;
  the rider gets a card for that change on their next visit.
- **A rider who left comes back**: Their roles and any unseen card went with their data (feature
  004 FR-015), so they come back without a role, as today.
- **A removed administrator**: Removal deletes their roles with their data, as today. It is only
  refused when they are the team's last own administrator (FR-014).
- **The last own administrator leaves by themselves**: Leaving is every rider's right (constitution
  Principle I) and the app doesn't stop it. The same holds when Strava access is revoked or the
  daily check finds they left the club. The team then has no own administrator until a maintainer
  sets one by hand (FR-016).
- **Administrators without the organiser flag today**: From the release on they count as
  organisers, since every administrator is in the Orga. They get no card (nobody changed their
  role in the app), and the Orga-Rundgang shows to them as to any organiser who hasn't seen it.
- **A new administrator and the usage alerts**: They get the alerts as every administrator does,
  until they switch them off (feature 025).
- **Guests**: Not on Rollen's lists and not in the search; their roles come from the guest list
  alone (feature 041), and the maintainer takes them off it.
- **A rider without a current consent**: Not listed, so not in the search and not given a role,
  as for removal. A rider with a role who hasn't agreed to a new consent version yet still meets
  the consent gate first (feature 004).
- **Taking the Orga role from an administrator**: Not a separate step: an administrator is always
  in the Orga, so the choices for them are Admin, Orga or none.

## Requirements *(mandatory)*

### Functional Requirements

**Rollen**

- **FR-001**: The admin view MUST get a third view, "Rollen", after Nutzung and Rider, open to
  every administrator, guests included.
- **FR-002**: Rollen MUST show, in this order: a short text on what the Orga sees and that admins
  are always in the Orga and also run the app; the own administrators, each with the date since
  when; the organisers who aren't administrators, each with the date; and, for own
  administrators, a search over the listed riders without a role, each with "Rolle geben", with
  the note that only riders who share their data with the team are found.
- **FR-003**: Every entry except the viewer's own MUST have "Ändern" for own administrators. The
  viewer's own entry MUST be marked "Du" and have no control.
- **FR-004**: "Ändern" and "Rolle geben" MUST open one choice between "Keine", "Orga" and "Admin",
  each saying what it sees and may do, with the rider's current role selected, a line that the
  rider is told on their next visit, and "Abbrechen" and "Speichern". On a phone it is a sheet
  from the bottom, on wider screens a dialog. Cancelling MUST change nothing.
- **FR-005**: After a change, Rollen MUST show the result at once with a notice of what changed
  and "Rückgängig", which sets the rider's previous role again.
- **FR-006**: Roles MUST NOT rely on colour alone to be told apart.

**Roles**

- **FR-007**: Each rider MUST hold exactly one of: no role, Orga, Admin. An administrator MUST
  count as an organiser everywhere the app checks for one.
- **FR-008**: A change MUST state the role the rider should have. Sending the same change again
  MUST change nothing more.
- **FR-009**: A change MUST apply from the affected rider's next request, as roles are read today.
- **FR-010**: Changing a role MUST NOT change anything else about the rider: their rides, Rynke,
  badges, consent and connection stay as they are. A rider made organiser again after losing the
  role MUST see the Orga-Rundgang again, as today.

**Who may change roles**

- **FR-011**: Changes MUST be refused to anyone who isn't an own administrator of the team, in the
  way other admin changes are refused (feature 025 FR-003): visitors, riders, organisers and
  guests. A refused change MUST change nothing.
- **FR-012**: A change of the sender's own role MUST be refused.
- **FR-013**: A change for a rider who isn't listed (not connected, gone, a guest, of another team,
  or unknown) MUST be refused with a message, and nothing MUST be stored for them.

**The last administrator**

- **FR-014**: Removing a rider (feature 025 FR-021) MUST be refused when they are the team's only
  own administrator, with a message saying why. Nothing MUST be deleted, blocked or revoked.
- **FR-015**: No change in the app MUST leave the team without an own administrator. With FR-011,
  FR-012 and FR-014 this holds for every change an administrator or guest can make.
- **FR-016**: A maintainer MUST still be able to give and take both roles by hand, as today, for
  example to set a new team's first administrator or when the last one left by themselves. The
  guest list MUST stay a by-hand step.

**Telling the rider**

- **FR-017**: When a rider's role on their next visit differs from the role they had on their last
  one because an administrator changed it, their Du page MUST show a role card at the top, saying
  the new role, who changed it and on which day: "Du bist jetzt in der Orga", "Du bist jetzt
  Admin", "Du bist kein Admin mehr" (still in the Orga) or "Du bist nicht mehr in der Orga".
- **FR-018**: The card for a new organiser MUST replace the first step of the Orga-Rundgang and
  offer "Rundgang starten" and "Später". The card for a new administrator MUST offer
  "Orga-Rundgang starten" only if the rider hasn't done the Orga-Rundgang. The other cards MUST
  have one button to close them.
- **FR-019**: Each card MUST show once: closing it or starting the tour from it MUST remove it for
  good.
- **FR-020**: There MUST be no admin tour, no email and no push message for role changes, and no
  history of changes beyond the card.

**Settings**

- **FR-021**: Settings MUST show organisers and administrators, guests included, a row "Wer in der
  Orga ist" under "Rynke und deine Daten", after the consent row: the team's own administrators,
  marked "(Admin)", and its organisers; opened, a line on what they see. Riders without a role
  MUST NOT get the row.
- **FR-022**: For own administrators the opened row MUST have the link "Mitglieder ändern" to
  Rollen.

**Text and teams**

- **FR-023**: All new text MUST be in the catalogs, in all ten languages, German first.
- **FR-024**: Roles MUST be per team. A change on one team's site MUST NOT change anything on
  another team's site, also for a person who rides in both clubs.

### Key Entities

- **Rider's role**: no role, Orga or Admin, per team, as today's two flags hold it with Admin
  implying Orga. It goes with the rider's data when the rider leaves or is removed.
- **Unseen role change**: for a rider, the role they had on their last visit, who made the latest
  change and when. It exists only between a change and the rider's next visit, is replaced by a
  later change, and goes with the rider's data.
- **Guest list**: unchanged (feature 041). It is what makes a guest an administrator and an
  organiser, and the app still only reads it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An administrator gives or takes a role in under a minute from opening Rollen,
  without help from a maintainer.
- **SC-002**: After a change, the affected rider has the new rights on their very next request,
  in every test.
- **SC-003**: In tests, every role change sent by a visitor, rider, organiser or guest, and every
  change of one's own role, is refused and leaves every rider's role unchanged.
- **SC-004**: In tests, no sequence of changes and removals made through the app leaves a team
  without an own administrator.
- **SC-005**: Every rider whose role was changed sees exactly one card about it on their next
  visit, and none when the change was undone before then.
- **SC-006**: After the release, maintainers change roles in the database only to set a team's
  first administrator or when a team has lost its last one.

## Assumptions

- **Superseded requirements**: This feature replaces feature 004 FR-004 ("no way to grant or
  remove the organiser role from inside the app") and the by-hand part of feature 025 FR-002. The
  by-hand way stays available to maintainers (FR-016). Feature 025's separation of the two roles
  ("being an organiser opens nothing here") stays one way only: an organiser still gets nothing in
  Admin, but an administrator is now always in the Orga.
- **Consent**: No consent revision. The consent texts say what the Orga sees and what the admins
  see as admins; an administrator in the Orga sees what the Orga sees, as before. Roles are the
  team's own data, not data read from Strava.
- **Same rights for every own administrator**: There is no "owner" or higher administrator. Any
  own administrator can change any other's role, which is acceptable for teams that trust their
  administrators.
- **No change history**: Role changes aren't recorded beyond the current role and the unseen card.
  Removals are recorded (feature 025 FR-023) because they can't be undone; a role change can be.
- **Fake mode**: The sample riders' roles from the seed can be changed in the app like real ones.
