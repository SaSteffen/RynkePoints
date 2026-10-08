# Feature Specification: Badges and Achievements

**Feature Branch**: `012-rynke-fun`

**Created**: 2026-10-08

**Status**: Draft

**Input**: GitHub issue #51 "Make app more fun": "add badges/achievements (new tab)".

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See my badges (Priority: P1)

A rider opens a new "Badges" tab and sees the badges they have earned and the ones
still to earn, each with what it takes and, when earned, the date.

**Why this priority**: The tab is the feature; without it no badge is visible.

**Independent Test**: Open the Badges tab for sample riders (`pnpm dev`) with and
without earned badges.

**Acceptance Scenarios**:

1. **Given** a rider who rode their first 100 km ride, **When** they open Badges,
   **Then** that badge shows as earned with its date.
2. **Given** a badge not yet earned, **When** the rider opens Badges, **Then** it
   shows locked, with what is needed and how far along the rider is.

---

### User Story 2 - Earning a badge (Priority: P2)

When a ride, a team event or an organiser correction earns a badge, the rider learns
about it: on their next visit, and in feature 010's notification if it is on.

**Why this priority**: The surprise of a new badge is what makes it fun.

**Independent Test**: Give a sample rider a ride that crosses a badge's threshold.

**Acceptance Scenarios**:

1. **Given** a ride that earns a badge, **When** it is evaluated, **Then** the
   badge is stored once with the ride's date, also when the ride is evaluated again.
2. **Given** a ride that earned a badge stops counting, **When** it is evaluated
   again, **Then** the badge is taken back if the rider no longer meets it.

### Edge Cases

- Recalculations after a rule change award or take back badges without notifying.
- A rider who leaves loses their badges with their other data (Principle I).
- Badges are the rider's own; other riders never see them (004's visibility rules)
  unless a later feature decides otherwise.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app shell MUST get a fifth section "Badges" in the bottom bar and
  the desktop top bar.
- **FR-002**: The tab MUST list every badge, earned ones first, with name, picture,
  condition, progress and date earned.
- **FR-003**: Badges MUST follow from what feature 003 stores (rides, events,
  corrections) and be recomputed idempotently on every evaluation (Principle II).
- **FR-004**: A first set of badges MUST cover distance (first 100 km ride, 1,000 km
  total), elevation (1,000 m in one ride), team (first team training, every
  training-weekend day) and Rynke (first Rynke, qualified for the tour).
  [NEEDS CLARIFICATION: the final badge list and thresholds, from the organisers]
- **FR-005**: Badge pictures MUST use the Rynke coin style (feature 012) and work in
  light and dark mode.
- **FR-006**: Names and conditions MUST come from the i18n catalogs in every
  language (FR-028).

### Key Entities

- **Badge**: a fixed definition in code: id, condition, picture.
- **Earned badge**: rider, badge, date earned (date of the activity that earned it).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A rider sees a newly earned badge on their next visit after the ride
  is evaluated.
- **SC-002**: Evaluating the same ride twice never awards a badge twice.
- **SC-003**: The Badges tab works at 360 px width in both colour modes.

## Assumptions

- Feature 011's app shell, 010's notifications and 012's coin style exist.
- Badges are personal; a team view of badges is out of scope.
