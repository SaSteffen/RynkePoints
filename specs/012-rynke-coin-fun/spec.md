# Feature Specification: Rynke Coin Look and Fun Graphics

**Feature Branch**: `012-rynke-fun`

**Created**: 2026-10-08

**Status**: Draft

**Input**: GitHub issue #51 "Make app more fun": "Find places to include fun graphics
(see attachments, inspiration) revolving around the Rynke Coin. Generally: the Rynke
coin thing should feature more prominently." The attachments show the Rynke-Coin
(orangutan in a yellow jersey on a yellow bike, a chain ring, "RYNKE-COIN · TEAM
RYNKEBY HAMBURG" on a black ring with a gold rim) and its reverse ("HAMBURG · PARIS",
Elbphilharmonie, harbour cranes, Elbe, riders climbing to the Eiffel Tower, three
icons for distance, elevation and team riding).

The Team Rynkeby colours themselves (issue #51's first point) are not part of this
spec: they are a change of the colour values of feature 011's design tokens, agreed
in the Claude Design mock-up "RynkePoints App Shell".

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Rynke shown as coins (Priority: P1)

A rider opens the Overview and sees their Rynke as coins rather than plain numbers:
the Training Rynke and Team Rynke totals carry the coin mark, and earned Rynke
read as collected coins towards the target.

**Why this priority**: The coin is the team's symbol for a Rynke; showing it where
the totals are makes the app feel like the team's own and is the most visible change.

**Independent Test**: Open the Overview with sample riders (`pnpm dev`) and check the
totals show the coin mark in light and dark mode on a phone and a desktop.

**Acceptance Scenarios**:

1. **Given** a rider with 17 of 20 Training Rynke, **When** they open the Overview,
   **Then** the total is shown with the coin mark and the gauge still shows 85%.
2. **Given** a screen reader, **When** it reads the total, **Then** it reads the
   number and target, not the decoration.

---

### User Story 2 - A moment of joy for new Rynke (Priority: P2)

When a rider has earned Rynke since their last visit, the Overview greets them with
a short coin celebration (for example a coin dropping onto their total) and how many
they earned.

**Why this priority**: Rewards the training; builds on feature 010's "new Rynke"
notification, which already leads the rider here.

**Independent Test**: Give a sample rider a new counting ride and open the Overview.

**Acceptance Scenarios**:

1. **Given** new Rynke since the rider's last visit, **When** they open the
   Overview, **Then** a celebration shows once, with the amount.
2. **Given** the device asks for reduced motion, **When** the celebration would
   play, **Then** it shows without movement.
3. **Given** no new Rynke, **When** the rider opens the Overview, **Then** nothing
   plays.

---

### User Story 3 - Coin graphics in empty and waiting places (Priority: P3)

Places that are now plain text get a coin-themed illustration: the landing page,
a rider with no rides yet, the Team placeholder, a ride being evaluated, a rider
who has qualified (the coin's reverse, Hamburg to Paris).

**Why this priority**: Adds character without changing what the pages say.

**Independent Test**: Visit each listed state with sample riders and check the
illustration in both colour modes and at phone width.

**Acceptance Scenarios**:

1. **Given** a rider without rides, **When** they open Rides, **Then** a coin
   illustration sits above the existing "no rides yet" text.
2. **Given** a rider who has qualified, **When** they open the Overview, **Then**
   the qualified card shows the Hamburg–Paris motif.

### Edge Cases

- Dark mode: graphics stay readable on the dark surface (no white boxes around them).
- Slow connections: graphics are small and never delay the page's figures.
- Rider-facing words in the graphics (e.g. "RYNKE-COIN") stay as they are on the
  coin; any other text belongs in the i18n catalogs (FR-028).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Overview MUST show the Rynke coin mark with the Training Rynke and
  Team Rynke totals.
- **FR-002**: The Overview MUST celebrate new Rynke once per change, honouring
  reduced motion.
- **FR-003**: The landing page, empty Rides list, Team placeholder, a ride being
  evaluated and the qualified state MUST show a coin-themed graphic.
- **FR-004**: Graphics MUST be decorative to assistive technology; every figure
  stays available as text.
- **FR-005**: Graphics MUST be served by the app itself (no other origins, feature
  011 FR-037) and work in light and dark mode.
- **FR-006**: The coin artwork MUST be one the team may publish in this public repo.
  [NEEDS CLARIFICATION: use the attached coin images as they are, or a simplified
  line/flat version drawn for the app?]

### Key Entities

- **Last seen totals**: per rider and device, the totals the rider last saw, so the
  celebration plays once.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every listed page shows its graphic in both colour modes at 360 px
  width without horizontal scrolling.
- **SC-002**: The Overview's figures appear no later than before this feature.
- **SC-003**: Riders asked after a month say the app feels like Team Rynkeby's
  own (owner's judgement).

## Assumptions

- Feature 011's app shell and the Team Rynkeby colours are in place.
- The look is agreed in the Claude Design mock-up before it is built.
- Badges and achievements are a separate feature (013).
