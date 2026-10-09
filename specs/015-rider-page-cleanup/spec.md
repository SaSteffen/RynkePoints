# Feature Specification: Rider Page Cleanup

**Feature Branch**: `015-rider-page-cleanup`

**Created**: 2026-10-09

**Status**: Draft

**Input**: GitHub issue #58 "Clean up the rider page after the UI rework": a new
rider's Overview shows, top to bottom, a status box ("Deine Rynke werden gerade
berechnet …" and "Deine Fahrten seit dem … werden noch importiert …"), the greeting
card ("Hallo …!") and a box with "Als App installieren" and "Ausblenden". The
greeting belongs on top; the install button belongs in Settings only, with a
one-time prompt to install and then to turn on notifications; the import status
goes, replaced by a waiting state with the coin logo while there is no data at all,
which turns into the real page once the first data arrives.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Waiting for the first data (Priority: P1)

A rider who has just connected opens the app before any of their rides have been
worked out. Instead of status texts about calculating and importing, they see the
Rynke coin turning like a spinner with a short German message to come back a little
later. When their first data arrives while the page is open, the page switches to
their real Overview by itself. From then on the app never talks about importing:
whatever has arrived is shown, and later rides simply add to it.

**Why this priority**: It is the first thing every new rider sees, and today it is
two technical status lines that say nothing useful. It also covers the whole team
right after launch, when everyone connects at once.

**Independent Test**: Connect a new synthetic rider whose import has not run yet,
open the Overview and the Rides section, see the waiting state; let the import's
first page be worked out and see the open page switch to the real figures without
a manual reload.

**Acceptance Scenarios**:

1. **Given** a signed-in rider with no Rynke worked out yet, **When** they open the
   Overview, **Then** they see the greeting, the coin as a waiting animation and a
   message to come back later, and no figures, gauges, notices about calculating or
   importing, or "Import abgeschlossen" line.
2. **Given** the same rider, **When** they open Rides, **Then** they see the same
   waiting state instead of "Noch keine Fahrten importiert".
3. **Given** a rider looking at the waiting state, **When** their first data is
   worked out, **Then** the page shows their real Overview (or Rides) within a
   minute, without the rider reloading.
4. **Given** a rider whose import is still running but whose first rides are worked
   out, **When** they open the Overview, **Then** they see their figures as they
   are, with no message that more rides are still being imported.
5. **Given** a rider whose import found no rides in the season, **When** they open
   the Overview, **Then** they see their real Overview with zero Rynke, not the
   waiting state.
6. **Given** a rider who has just connected for the first time, **When** the
   connection is complete, **Then** fetching their rides is already under way, so
   the waiting state lasts only as long as Strava's request budget and the queue
   need for the first page.

---

### User Story 2 - Greeting on top (Priority: P2)

The greeting card with the coin ("Hallo Ida! 🦧" and the rider's totals) is the
first thing on the Overview. Anything else that needs the rider's attention, such
as renewing the Strava connection or a rule change still being applied, comes
below it.

**Why this priority**: A small change, but it is the visible first impression of
the reworked UI.

**Independent Test**: Open the Overview as a synthetic rider in each state (waiting,
ready, needs reconnect, rules updating) and check the greeting card is the first
element of the section's content.

**Acceptance Scenarios**:

1. **Given** any signed-in rider, **When** they open the Overview, **Then** the
   greeting card is the first block of the page content.
2. **Given** a rider whose Strava connection needs renewing, **When** they open the
   Overview, **Then** the reconnect notice appears directly below the greeting.

---

### User Story 3 - Install the app once, then notifications (Priority: P3)

The "Als App installieren" button and its "Ausblenden" button no longer sit on the
Overview or the landing page. Installing lives in Settings. Instead, on a device
where installing is possible, a signed-in rider sees one prompt that invites them
to install the app; it stays until they act on it or close it. Once the app is
installed, the rider is offered to turn on notifications right away. Each prompt
appears only once per device; afterwards both are only in Settings.

**Why this priority**: The current inline box is clutter, but the app works without
it; installing and notifications are still reachable from Settings meanwhile.

**Independent Test**: On a device that can install the app, sign in, see the
install prompt, close it, reload and confirm it doesn't come back; on a fresh
device, install from the prompt and get the notifications offer; confirm Settings
still offers installing where possible.

**Acceptance Scenarios**:

1. **Given** a signed-in rider on a device that can install the app and has never
   seen the prompt, **When** they open any section, **Then** a prompt invites them
   to install the app, without moving the page content.
2. **Given** the install prompt is shown, **When** the rider closes it, **Then** it
   disappears and doesn't come back on that device.
3. **Given** the install prompt is shown, **When** the rider taps install and
   completes the device's install step, **Then** the prompt disappears and the
   rider is offered to turn on notifications.
4. **Given** the notifications offer is shown, **When** the rider accepts, **Then**
   notifications are turned on exactly as with the Settings switch; **When** they
   decline or close it, **Then** it disappears and doesn't come back on that device.
5. **Given** an iPhone rider in Safari, **When** they see the prompt, **Then** it
   explains how to add the app to the home screen, and the notifications offer
   appears the first time they open the app from the home screen.
6. **Given** the app is already installed or the device can't install it, **When**
   the rider opens a section, **Then** no install prompt appears.
7. **Given** any rider, **When** they open the Overview or the landing page,
   **Then** there is no inline install box and no "Ausblenden" button.
8. **Given** a rider in Settings on a device where installing is possible, **When**
   they open the App group, **Then** they can install the app from there, without
   a hide button.

### Edge Cases

- The Strava request budget is used up when a new rider connects: the waiting state
  stays until the import can run; nothing tells the rider about budgets.
- The rider leaves the waiting page open in the background: when they come back,
  the page shows the current data (as feature 011 already reloads after a minute).
- A rule change is being applied while the rider has data: the existing "rules have
  changed" notice still appears, below the greeting; it is not an import notice.
- A rider reconnects and an import starts again (e.g. after granting private
  activities): they keep seeing their current data, with no import notice.
- A rider dismisses the install prompt, then installs later from Settings: the
  notifications offer still appears once after that install.
- The rider has turned on notifications from Settings before installing: no
  notifications offer appears after the install.
- The device has blocked notifications for the app: no notifications offer appears;
  Settings explains the block as today.
- Signing out and in again, or another rider signing in on the same device, doesn't
  bring back a prompt already shown on that device.

## Requirements *(mandatory)*

### Functional Requirements

**Waiting state and import status**

- **FR-001**: The Overview and Rides sections MUST show a waiting state while the
  rider has no Rynke worked out yet: the Rynke coin as a looping animation and a
  short message telling the rider their rides are on the way and to come back a
  little later.
- **FR-002**: The waiting state MUST replace the "Deine Rynke werden gerade
  berechnet" and "Deine Fahrten seit dem … werden noch importiert" notices, the
  "Import abgeschlossen" line and the "Noch keine Fahrten importiert" message; none
  of these appear anywhere for a rider any more.
- **FR-003**: Once a rider has Rynke worked out, the sections MUST show them as they
  are, whether or not more rides are still being fetched; no rider-facing text
  refers to an import in progress or finished.
- **FR-004**: A section showing the waiting state MUST switch to the rider's real
  content within one minute after their first data is worked out, without the rider
  reloading, while the page is open and visible.
- **FR-005**: Fetching a new rider's rides MUST start as part of their first
  connection, so the first page of rides is worked out as soon as Strava's request
  budget and the queue allow, ahead of any regular scheduled work for that rider.
- **FR-006**: Checking whether the first data has arrived MUST NOT make any Strava
  request and MUST stop once the real content is shown.
- **FR-007**: The waiting animation MUST respect the device's reduced-motion
  setting by showing the coin still.

**Greeting**

- **FR-008**: The greeting card MUST be the first block of the Overview's content,
  in every state of the page.
- **FR-009**: Notices that need the rider's attention (renewing the Strava
  connection, a rule change being applied) MUST appear below the greeting card.

**Install and notifications**

- **FR-010**: The inline install box with its "Ausblenden" button MUST be removed
  from the Overview and the landing page.
- **FR-011**: Settings MUST keep offering to install the app (including the iPhone
  home-screen explanation) where the device allows it, without a hide button, and
  hide the App group where installing isn't possible or the app is installed.
- **FR-012**: On a device that can install the app and isn't running it installed,
  a signed-in rider MUST be shown a one-time install prompt that floats over the
  page without moving its content, stays until the rider installs or closes it,
  and can be closed with one tap.
- **FR-013**: Once the rider has acted on or closed the install prompt, it MUST NOT
  appear again on that device.
- **FR-014**: After the app has been installed on a device, the rider MUST be
  offered once to turn on notifications, in the same floating style, the first time
  the installed app is opened or right after installing where the device allows.
  Accepting MUST turn notifications on exactly as the Settings switch does.
- **FR-015**: The notifications offer MUST NOT appear when notifications are
  already on for that device, are blocked, or aren't supported; once shown and
  answered or closed, it MUST NOT appear again on that device.
- **FR-016**: Both prompts MUST be reachable by keyboard and screen reader and MUST
  NOT trap focus.

**Text**

- **FR-017**: Every new or changed rider-facing text (waiting message, prompts and
  their buttons) MUST be in all message catalogs, German as the source; removed
  texts MUST be removed from all catalogs.

### Key Entities

- **Prompt state (per device)**: whether this device's install prompt and
  notifications offer have been shown and answered. Kept on the device only; not
  rider data and never sent to the server.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new rider never sees a text about calculating, importing or a
  finished import; their first screen shows the greeting and either their figures
  or the waiting state.
- **SC-002**: With Strava's budget available, a newly connected rider who keeps the
  Overview open sees their real figures within 2 minutes of connecting, without
  reloading.
- **SC-003**: Each device shows the install prompt at most once and the
  notifications offer at most once.
- **SC-004**: The Overview's first block is the greeting card in 100% of its states.
- **SC-005**: Waiting for the first data costs no Strava requests beyond the import
  itself.

## Assumptions

- "No data at all" means the rider has no Rynke balance yet. Every finished import
  page gives the rider a balance, even an empty one, so a rider with no rides in
  the season leaves the waiting state with zero Rynke.
- The coin logo is the one on the app's start screen; the waiting state reuses the
  existing coin artwork, animated, rather than a new image.
- The season import already starts at the first connection (feature 001); FR-005
  keeps that and makes sure the first page isn't queued behind regular work. No new
  kind of Strava request is added, so no new consent version is needed.
- Getting the first data to the open page by checking the app's own server
  periodically is acceptable; a push notification is not used for this, since a new
  rider has not turned notifications on yet.
- Prompt state is per device and per browser, like the existing install dismissal
  and scheme choice; a second device shows each prompt once more.
- Devices that cannot install the app (e.g. some desktop browsers) get neither
  prompt; their riders turn notifications on in Settings.
- The "rules have changed" notice (feature 005) is not part of the import status
  and stays.
- Signed-out visitors on the landing page get no install prompt; it is for riders.
