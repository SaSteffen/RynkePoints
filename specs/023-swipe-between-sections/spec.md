# Feature Specification: Swipe Between Sections

**Feature Branch**: `feat/swipe-sections`

**Created**: 2026-10-22

**Status**: Implemented

**Input**: User description: "I want to be able to switch between the pages with
swipe gestures, only the ones from the screenshot [Team, Du, Fahrten, Abzeichen,
Orga]: we rotate circularly, so users can swipe infinitely in either direction and
rotate through the pages."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Swipe to the next section (Priority: P1)

On a phone, a rider swipes sideways across the page to reach the neighbouring
section of the navigation bar, without reaching for the bar. The sections form a
ring: past the last one comes the first again, in both directions.

**Independent Test**: Signed in on a touch screen, on Team, swipe left: Du shows.
Swipe right twice: Team, then the last section of the ring.

**Acceptance Scenarios**:

1. **Given** a rider on Team, **When** they swipe to the left, **Then** Du shows.
2. **Given** a rider on Du, **When** they swipe to the right, **Then** Team shows.
3. **Given** a rider on the ring's last section (Orga for an organiser, Termine
   for everyone else), **When** they swipe to the left, **Then** Team shows.
4. **Given** a rider on Team, **When** they swipe to the right, **Then** the
   ring's last section shows.
5. **Given** a rider on Settings, **When** they swipe, **Then** nothing changes.
6. **Given** a rider scrolling a page up or down, **When** the finger drifts a
   little sideways, **Then** the section stays.

### Edge Cases

- A swipe on something that scrolls sideways on its own, a form field or a
  chart is that element's, not a section switch.
- A swipe that starts at the screen's very edge is left to the system's own
  back and forward gestures.
- Zoomed in, with two fingers, while text is being selected, or while the theme
  menu, a dialog, a page-switch show or a tour's step is up, nothing switches.

## Requirements *(mandatory)*

- **FR-001**: A one-finger, quick, mostly horizontal swipe across a signed-in
  section MUST switch to the neighbouring section: a swipe to the left to the
  next one in the navigation's order, to the right to the one before.
- **FR-002**: The ring MUST be the navigation's sections the rider sees, in its
  order, without Settings: Team, Du, Fahrten, Abzeichen and Orga for organisers,
  Termine instead of Orga for everyone else. It wraps round in both directions.
- **FR-003**: A swipe MUST switch the section exactly as a tap on its item in
  the navigation bar does (loading, history entry, a fun theme's show).
- **FR-004**: A swipe MUST NOT switch on Settings or a page outside the
  navigation's sections, from the screen's edges, zoomed in, on form fields,
  charts or content that scrolls sideways, with two fingers, while selecting
  text, or while the theme menu, a dialog, a show or a tour's step is up.
- **FR-005**: Swiping MUST NOT change how the page scrolls vertically or how
  taps work; it adds no visible control and no rider-facing text.

## Success Criteria *(mandatory)*

- **SC-001**: From any section of the ring, the rider reaches every other one
  by swiping in either direction, without the navigation bar.
- **SC-002**: Scrolling a page up and down never switches the section.

## Assumptions

- Without a touch screen (mouse, keyboard) there is no swipe; the navigation
  bar stays the way to switch.
- Thresholds: at least 64 px sideways, at least twice as far sideways as up or
  down, within 0.8 s, starting more than 24 px from the screen's edges.
