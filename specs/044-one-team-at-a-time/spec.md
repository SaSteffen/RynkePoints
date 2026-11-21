# Feature Specification: One Team at a Time

**Feature Branch**: `044-one-team-at-a-time`

**Created**: 2026-11-21

**Status**: Draft

**Input**: User description: "wasn't this a feature we built? no one except guests may be in both
clubs?" Follow-up: "yes, draft the spec for one team at a time". Answers: a person who rides for one
team and connects to another chooses on the spot (stay, or switch here); the spec names no team,
since more teams will follow. Found in production on 2026-11-21: a rider connected to two teams, ten
days apart, passing both teams' daily club checks, with her rides counting for both. The maintainer
removed her from the team she joined first the same day, by hand; no other double rider was left.

## Context

All teams share one Strava app (feature 026). Each team's site lets in the members of its own
Strava clubs, and nothing stops a person who is in two teams' clubs from connecting to both. Feature
026 assumed two connections for one person would break each other, so it only warned: a rider who
is also in another team's club is told at connect that "you can take part in one team at a time"
(feature 026 FR-012, feature 039).

Three things have since turned out differently:

- **The connections don't break each other.** Feature 041 tested it on 2026-11-18 (research R1,
  outcome A): each team's connection keeps working while the other renews its own. The warning's
  claim that connecting to a second team ends the first connection is wrong, and nothing technical
  keeps a rider at one team.
- **The warning misses riders.** Each team lists only the other teams' main clubs. A team may let
  in further clubs, and a rider who is in a team only through one of those gets no warning.
- **A warning isn't a rule.** A rider who saw it, or skipped it, could connect anyway, and her rides
  then counted for both teams' figures, rankings, team badges and organiser statistics.

Guests (feature 041) are the one intended exception: administrators of one team whom another team
lists by hand. They never count for the team that hosts them.

This feature turns the warning into a rule: a person rides for one team at a time. A rider who
connects to a second team chooses there and then: stay with the team they ride for, or switch to
this one. Being a guest elsewhere doesn't count.

**Terms**:

- **Rider of a team**: a person a team holds as a rider, connected or waiting to reconnect, not as
  a guest.
- **Their team**: the one team that holds a person as a rider.
- **New team**: a team a person connects to that doesn't hold them yet.
- **The team question**: the question a team already asks, through the gateway, whether another
  team holds a person (feature 041 FR-009). This feature also asks whether that team holds them as
  a rider.
- **Switching**: a rider of one team becoming a rider of the new team. Their team lets them go.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A rider of one team chooses at another (Priority: P1)

A rider of one team is also in a second team's club and connects on the second team's site. That
team asks whether another team holds them as a rider. One does, so it stores nothing yet and asks
the person to choose. They can stay with their team, and then nothing changes. Or they can switch
to this team, and then their team deletes their data there, and this team lets them in.

The page says plainly what switching costs: their rides, Rynke and badges at their team are deleted
there, and this team counts their season's rides anew, under its own rules.

**Why this priority**: This is the rule, and it covers the request: no person counts for two teams,
and the rider decides which one.

**Independent Test**: In fake mode, with two teams behind the local gateway, connect a sample
rider to the first team, then connect the same person on the second team's site and try both
choices.

**Acceptance Scenarios**:

1. **Given** a person who rides for another team, **When** they connect to a new team whose club
   they ride in, **Then** the new team keeps nothing about them yet and shows the choice.
2. **Given** the choice, **When** they stay, **Then** the new team keeps nothing about them, their
   grant at Strava stays, and their team keeps reading their rides as before.
3. **Given** the choice, **When** they switch, **Then** their team deletes their data there without
   blocking them, the new team lets them in and imports their rides since the season start, and
   their grant at Strava stays throughout.
4. **Given** a person no other team holds as a rider, **When** they connect, **Then** they see no
   choice and are let in as today.
5. **Given** a person another team holds only as a guest, **When** they connect to a team whose
   club they ride in, **Then** they see no choice and are let in as today.

---

### User Story 2 - Nothing is lost when a step can't be finished (Priority: P1)

The rider chooses to switch, but their team can't be reached right now. Nothing happens: they stay
a rider of their team with everything they had, and the new team tells them to try again later. The
same holds when the team question can't be answered at all.

**Why this priority**: A half-finished switch would leave the person in two teams, or in none with
their season deleted.

**Independent Test**: In fake mode, make the first team unreachable through the gateway and try to
connect and to switch at the second.

**Acceptance Scenarios**:

1. **Given** a new person connecting, **When** the team question gets no answer, **Then** they are
   turned away with the existing "Strava is busy, try again later" page, and their grant at Strava
   stays.
2. **Given** a rider who chose to switch, **When** their team doesn't confirm that it let them go,
   **Then** the new team doesn't let them in, their team keeps them as before, and they see the
   "try again later" page.
3. **Given** a rider who chose to switch, **When** their team has let them go but the new team then
   fails to store them, **Then** they can connect at the new team again and are let in without a
   choice, since no team holds them any more, and their grant at Strava stays meanwhile.

---

### Edge Cases

- **A rider in two teams' clubs connects to the first**: Nothing has changed: they are let in. The
  choice appears only when they connect to a second team.
- **A rider only waiting to reconnect at their team** (their connection there broke): They still
  ride for that team and see the choice. Switching works as for any rider.
- **An organiser or administrator who switches**: They lose those roles at their team with the rest
  of their data there, as with a disconnect. The new team gives them none.
- **A guest at a team who rides for another**: Not affected. They stay a guest there and a rider at
  their own team (feature 041). The guest list wins over the rule, as it wins over the club.
- **The new team is full, the person is blocked there, isn't in its club, or hasn't agreed to its
  consent**: They are turned away as today, before any choice. Switching is never offered where
  they couldn't get in.
- **A person who connects to two teams within seconds**: Both teams may answer the team question
  before either has stored them, and they end up in both. Accepted as very unlikely. The maintainer
  documentation says how to find such a person by hand.
- **A rider their team removed** (an administrator's removal, feature 025): No team holds them any
  more, so a new team lets them in without a choice. The block applies only at the team that
  removed them.
- **A single team, tests, local development and sandboxes**: There's no other team to ask, so
  nobody sees the choice (feature 041 research R14).
- **Teams named on the site**: The choice page names no other team, place or art (feature 026
  FR-023). It says "another team on RynkePoints" and names only the team whose site it is.

## Requirements *(mandatory)*

### Functional Requirements

**The rule**

- **FR-001**: A person MUST be a rider of at most one team at a time. Guests (feature 041) are not
  riders: being a guest at one or more teams doesn't count, and the guest list lets a person in
  whichever team they ride for.
- **FR-002**: When a person connects to a team that doesn't hold them, the team MUST ask the team
  question after every check that could turn them away today (block list, club, team full,
  consent) and before storing anything about them. A person another team holds only as a guest, or
  no team holds, MUST be let in as today.
- **FR-003**: If another team holds them as a rider, the new team MUST store nothing and show a
  choice: stay with their team, or switch to this one. The page MUST say that switching deletes
  their rides, Rynke and badges at their team, and that this team counts their season's rides anew
  under its rules. It MUST NOT name the other team.

**Staying**

- **FR-004**: Choosing to stay, or leaving the page, MUST keep nothing at the new team and MUST
  follow the existing withdrawal (feature 041 FR-009), so the grant at Strava stays.

**Switching**

- **FR-005**: Choosing to switch MUST make their team let them go through the gateway, before the
  new team lets them in. Their team MUST delete their data as for a disconnect, MUST NOT block them
  and MUST NOT withdraw their grant at Strava.
- **FR-006**: The new team MUST let them in only once their team has confirmed that it let them go.
  Without that confirmation, nothing changes for the person, and they see the "try again later"
  page.
- **FR-007**: A team MUST let a rider go for a switch only when another team asks through the
  gateway, authenticated as for the team question, for a person who has just signed in at the
  asking team and chosen to switch there. No page and no other request can make a team let someone
  go.
- **FR-008**: After a switch, the new team MUST import their rides as for any new rider. Their
  consent at the new team is the one they agreed to on the way in.

**When there's no answer**

- **FR-009**: If the team question gets no answer, a new person MUST be turned away with the
  existing "Strava is busy" page. A person the team already holds is never turned away for this.

**What goes**

- **FR-010**: The "you're in another team's club too" notice (feature 026 FR-012, feature 039) MUST
  go: the choice in FR-003 replaces it, and rests on the teams a person actually rides for, not on
  club lists. Each team's list of other teams' clubs MUST go with it, unless something else still
  needs it.

**Privacy and text**

- **FR-011**: No rider data crosses teams beyond the team question and the request to let a person
  go. A team learns only whether another team holds the person as a rider, only as a guest, or not
  at all, never which team. The team that lets a rider go learns only that they switched to another
  team. Neither answer is stored or shown to anyone but the person themselves.
- **FR-012**: The privacy notice MUST say that a team checks, at connect, whether the person already
  rides for another team on RynkePoints, and that switching deletes their data at the team they
  leave.
- **FR-013**: All rider-facing text this feature adds MUST be in the catalogs, in all ten
  languages.

### Key Entities

- **Rider of a team**: unchanged; a person a team holds, not marked as a guest.
- **Team question answer**: extended from feature 041 to tell a rider apart from a guest. Not
  stored.
- **Let-go request**: one team asking another, through the gateway, to let a person go because they
  switched. Carries only the person's Strava ID. Not stored.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: No person is a rider of more than one team, checked across all production teams, from
  the day the feature is live.
- **SC-002**: A rider of one team who connects to another sees the choice in 100% of cases where
  the team question is answered.
- **SC-003**: A rider switches teams in one sign-in and one choice, and sees their season's rides at
  the new team within the time any new rider waits for their import.
- **SC-004**: In every failed step of a switch, the rider ends up at exactly one team or, at worst,
  at none with their grant kept, and never at two.
- **SC-005**: Every team count of a team is identical with and without a person who chose to stay
  elsewhere, as if they had never tried.

## Assumptions

- Feature 041's finding holds: two teams' connections for one person don't break each other. So the
  rule is the teams' choice, not a technical limit, and no page claims otherwise.
- The rule is about riders, not clubs: a person may stay in several teams' Strava clubs. Only the
  team they ride for reads and counts their rides.
- Teams trust each other through the gateway, as for the team question: a team asking another to
  let someone go is believed. The person's own sign-in and choice at the asking team are what make
  the request legitimate.
- Whether FR-012's sentences in the privacy notice are a minor consent revision or need none is
  checked against the constitution's consent rule during planning. The feature reads no new Strava
  data.
- No double rider is left in production (checked 2026-11-21), so the feature needs no step to
  resolve old ones.
