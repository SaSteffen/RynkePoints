# Feature Specification: Onboarding Tour That Explains the Rules

**Feature Branch**: `020-onboarding-tour`

**Created**: 2026-10-17

**Status**: Draft

**Input**: Issue #157 "extend onboarding": "i dont want to force people into
reading the rules document, which is way too technical. we have everything in
place that shows the effects of the rules. point out the elevation counter.
point out/explain how getting team rynke works. give a single example on
non-qualified rides (too short) and by this explain the 10km rule. explain (via
the extra progress bar) that a certain amount of outside kilometers must be
done." Plus the owner's notes on the issue from feature 019: a Termine step for
riders who aren't organisers, steps chosen per viewer, example data instead of
empty pages, and hints that point at one element each.

## Context

The onboarding tours (issue #90, `src/http/tour.ts`) show one hint per page on
the real page, pointing at the page's navigation item: Team, Du, Fahrten,
Abzeichen and Einstellungen for every rider, then Rider and Termine on Orga for
organisers. No spec describes them; this feature is their first.

The tour tells a new rider *where* things are, not *how Rynke work*. That is in
the rules PDF, which is written for completeness, not for a first look. The
pages already show every rule's effect (the elevation gauge, the Team gauge, the
"draußen" gauge, each ride's figures and reasons), but a new rider has no rides
yet, so those elements are empty or not there at all. Feature 019 added the
Termine tab for riders who aren't organisers, and left its tour step for later
(019 research R8, task T040) because the tour was one fixed list for everyone.

**On "too short"**: the rules have no minimum ride length. Every *full* 10 km of
a ride earn one Training Rynke; a ride under 10 km counts, but earns no distance
Rynke, and its elevation still counts towards the elevation total. The tour
explains exactly that, on a short example ride that shows "zählt 🪙" with 0
Training Rynke.

## Clarifications

### Session 2026-10-17

- Q: Example data always during the tour, or only for riders without rides? →
  A: Always during the rider tour's steps on Du and Fahrten, so every rider sees
  the same, complete picture the hints talk about, clearly marked as an example.
  (Agreed in the issue: "The tour should therefore render the pages with fake
  example data.")
- Q: The issue asks for a "non-qualified" short ride; the rules count it? → A:
  Follow the rules: the example short ride counts with 0 Training Rynke, and the
  hint explains the 10 km steps. A ride that doesn't count is already explained
  on its card ("Warum?").

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Learn the rules from the pages (Priority: P1)

A new rider takes the tour. On Du it shows an example rider's progress and
points, one after another, at the elevation gauge (how Höhenmeter turn into
Rynke), the Team gauge (Team Rynke only come from team events) and the
"Trainingsrynke draußen" gauge (most Training Rynke must be ridden outside). On
Fahrten it points at a short example ride and explains the 10 km steps. The
rider never has to open the rules PDF to understand what counts.

**Why this priority**: It is the issue.

**Independent Test**: Sign in as a synthetic rider with no rides past the first
import, take the tour from Team to the end, and check that each of the four
explanations appears on its page, next to the element it explains, with example
figures, and that the rider's own pages show their own (empty) data again
afterwards.

**Acceptance Scenarios**:

1. **Given** a rider on the tour's Du step, **When** the page shows, **Then** it
   shows the example rider's Rynke, gauges and breakdown, under a note that these
   are example data, and nothing of the rider's own Rynke.
2. **Given** the next step, **When** it shows, **Then** the hint explains that
   every 1,000 Höhenmeter bring 5 Training Rynke and that the gauge shows how
   many metres are still missing, and the elevation gauge is highlighted and
   scrolled into view.
3. **Given** the next step, **When** it shows, **Then** the hint explains that
   Team Rynke only come from team events (with what each kind brings) and how
   many are needed, and the Team gauge is highlighted.
4. **Given** the next step, **When** it shows, **Then** the hint explains that at
   most a third of the Training Rynke may come from virtual rides, so a number of
   them must be ridden outside, and the "Trainingsrynke draußen" gauge is
   highlighted.
5. **Given** the tour's Fahrten steps, **When** they show, **Then** the list
   shows the example rides, one of them under 10 km with 0 Training Rynke, and a
   hint explains that every full 10 km earn one Training Rynke, a shorter ride
   earns none for its distance, and its Höhenmeter still count; that ride's
   figures are highlighted.
6. **Given** the rule values change (a new rules version), **When** the tour
   shows, **Then** its numbers are those of the rules in effect.

---

### User Story 2 - A tour that fits the viewer (Priority: P2)

A rider who isn't an organiser gets a Termine step after Abzeichen, explaining
that they say there whether they come to a team event and report afterwards
that they were there. An organiser, who has Orga instead of Termine, takes the
same rider tour without that step and then the Orga tour as today.

**Why this priority**: The Termine tab exists since feature 019 and is how a
rider gets Team Rynke; a tour that skips it leaves the Team Rynke hint without
a place to act.

**Independent Test**: Take the rider tour as a rider and as an organiser and
compare the steps and the "n von m" counts.

**Acceptance Scenarios**:

1. **Given** a rider who isn't an organiser, **When** they take the tour,
   **Then** it has a Termine step after Abzeichen that points at the Termine tab,
   and the count includes it.
2. **Given** an organiser, **When** they take the rider tour, **Then** it has no
   Termine step, its count is one lower, and no step leads to `/events`.
3. **Given** either, **When** they finish the rider tour, **Then** the organiser
   tour follows for organisers as today.

---

### User Story 3 - The rider's own data stays the rider's (Priority: P1)

The example data exists only on the tour's pages. It is never stored, never
mixed with the rider's own rides or Rynke, never shown to anyone else, never
links to anything on Strava and never triggers a celebration or a notification.

**Why this priority**: Constitution Principle I; showing invented numbers as if
they were the rider's would also mislead.

**Independent Test**: With a rider who has rides, open the tour's Du and Fahrten
steps, then the pages without the tour, and check the database and the pages.

**Acceptance Scenarios**:

1. **Given** a rider with their own rides, **When** they open Du or Fahrten on a
   tour step, **Then** only the example data shows, marked as such, and the
   example rides have no "Auf Strava ansehen" link.
2. **Given** the same rider, **When** they open Du or Fahrten without `?tour`,
   **Then** their own data shows, as before.
3. **Given** a tour step on Du, **When** it shows, **Then** no "seen Rynke" is
   written and no celebration shows.

### Edge Cases

- **Old tour links** (`/me?tour=rider` without a step, e.g. from a bookmark or
  the previous release): the page's first step of that tour shows, as today.
- **A step number that doesn't belong to the page** (`/team?tour=rider&step=5`):
  the page's first step of that tour shows instead.
- **An organiser asks for a rider's Termine step**: there is none; `/events`
  sends organisers to `/organiser` as before.
- **First import still running** (issue #119): no tour, as today, so no example
  data either.
- **Tour started again from Einstellungen**: the example data shows again on
  its steps.
- **Short season window** (today close to the season start, or after the
  deadline): the example rides are dated inside the counting window, never after
  today unless the window ended, never before the season start, so they all
  count by the window rule.
- **Screen readers**: the hint and the example note are text; the highlighted
  element is reached by the step's link scrolling to it.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The rider tour MUST be: Team; Du; Du – Höhenmeter; Du – Teamrynke;
  Du – draußen; Fahrten; Fahrten – kurze Fahrt; Abzeichen; Termine (only riders
  who aren't organisers); Einstellungen.
- **FR-002**: The steps MUST be chosen for the viewer; the step count ("n von
  m") and every "Weiter" link MUST follow the viewer's steps.
- **FR-003**: A step MAY point at an element of its page instead of the
  navigation item; then that element MUST be highlighted and the step's link
  MUST bring it into view. A step without an element points at its navigation
  item, as today.
- **FR-004**: A page MAY have several steps; the address names the step
  (`?tour=rider&step=N`). Without a valid step for the page, the page's first
  step of the named tour shows.
- **FR-005**: On the rider tour's steps on Du and Fahrten, those pages MUST show
  example data instead of the rider's own Rynke and rides, under a visible note
  that they are an example.
- **FR-006**: The example data MUST be computed by the same rules functions as
  real Rynke, with the rules in effect, from synthetic rides and team events
  that live in `src/` (not `dev/`). It MUST include a ride under 10 km, a virtual
  ride, elevation short of the next elevation step, and attended team events
  with Team Rynke short of the threshold.
- **FR-007**: The example data MUST NOT be stored, MUST NOT write "seen Rynke",
  MUST NOT show a celebration and MUST NOT link to Strava.
- **FR-008**: The hints' numbers (elevation step and its Rynke, the team-event
  amounts and threshold, the virtual share and the Training Rynke needed
  outside, the distance step) MUST come from the rules in effect.
- **FR-009**: All new texts MUST be in the catalogs, in German and English, and
  address the rider as "du".
- **FR-010**: Finishing, skipping, the invitation on other pages, the wait for
  the first import and starting again from Einstellungen MUST work as today.

### Key Entities

- **Tour step**: page, navigation item, text, optionally the element it points
  at, and whether the page shows example data.
- **Example rider view**: what Du and Fahrten read for a rider, built from
  synthetic rides and attendance instead of D1.

## Success Criteria *(mandatory)*

- **SC-001**: A new rider who takes the tour sees each of the four rule
  explanations next to the element it explains, without opening the rules PDF.
- **SC-002**: Riders who aren't organisers see a Termine step; organisers never
  get a step that leads off their navigation.
- **SC-003**: No example figure is ever stored or shown outside a tour step.

## Assumptions

- The tour stays server-rendered with no new page script; scrolling to the
  element uses the address's fragment.
- No migration, no new stored data, no Strava request, no consent change.
