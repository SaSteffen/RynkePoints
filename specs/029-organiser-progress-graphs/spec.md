# Feature Specification: Organiser Progress Graphs

**Feature Branch**: `029-organiser-progress-graphs`

**Created**: 2026-11-04

**Status**: Draft

**Input**: User description: "As an organiser I want to see individual progress in graphs and freely
select a time range over the season: ridden kilometres split into outdoor and virtual, and elevation
in metres, as daily aggregates. No Rynke graphs. Rider lines and team lines in the same graph,
toggleable. The feature can be turned on and off, and is tied to a consent version."

## Context

Team Rynkeby Europe asked to follow each rider's progress over time, and Hamburg wants the same. The
organiser's Riders view shows where each rider stands today but not how they got there. Live teams
have 30 or more riders, so the view has to work with many names, also on a phone.

The graphs are an addition. Everything the Riders view shows today stays.

**Visual reference**: the Claude Design canvas
[RynkePoints Organiser Graphs](https://claude.ai/artifact/CS7cXRCBrwevDxRBJudfH2), with one board for
desktop and one for the phone. Its look, order and helper texts apply. Its riders are made up.

**Terms**: A **rider line** is one rider's values in a graph. **Team lines** are the team average and
the team total. A **group** is one of the existing tiles on the Riders view, such as "Need a push" or
"Everyone". **Agreed** means the rider accepted consent version 3 or higher.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See how riders progress (Priority: P1)

An organiser opens the Riders view and finds a Progress section with three graphs: outdoor kilometres,
virtual kilometres and elevation in metres. They see each chosen rider's line next to the team
average, and can tell who has been riding, who has stopped, and how much of it happened indoors.

**Why this priority**: This is what was asked for. Without it nothing else in this feature matters.

**Independent Test**: With riders who agreed and have rides on several days, open the Riders view as
an organiser and compare each graph's values with those riders' rides.

**Acceptance Scenarios**:

1. **Given** a rider with two counting outdoor rides on one day, **When** the organiser reads that day
   in Per day view, **Then** the outdoor graph shows the sum of both rides as one point.
2. **Given** a rider with outdoor and virtual rides, **When** the organiser reads the graphs, **Then**
   outdoor rides appear only in the outdoor graph and virtual rides only in the virtual graph, and the
   elevation graph shows metres from both.
3. **Given** Running total is selected, **When** the organiser reads a line, **Then** it starts from
   zero on the first day of the chosen range and adds up day by day.
4. **Given** the graphs are showing, **When** the organiser looks for Rynke, **Then** no graph shows
   Rynke, and the overall Rynke figures are where they are today.
5. **Given** any graph, **When** the organiser hovers over it or taps it, **Then** they see daily
   values only, and nothing names or lists a ride or shows a start time, speed, duration or route.

---

### User Story 2 - Riders agree first (Priority: P1)

A rider returning to the app is told that organisers will now also see their daily kilometres and
elevation, and agrees through the consent flow they already know. From then on they have a line.
Until then they have no line, are in no team line, and still appear in the rider table as before.

**Why this priority**: Constitution Principle I requires it. Showing this data to organisers without
it isn't allowed, so the graphs can't ship without this story.

**Independent Test**: With one rider on version 2 and one on version 3, open the Riders view as an
organiser. Only the second has a line. Agree as the first rider and reload.

**Acceptance Scenarios**:

1. **Given** a rider who accepted version 2, **When** they next use the app, **Then** they are asked to
   agree again and told what changed.
2. **Given** a rider who accepted version 2, **When** an organiser opens the Riders view, **Then** the
   rider is in the table with their usual figures, has no line, adds nothing to the team lines, and
   none of their daily values reach the organiser's browser.
3. **Given** that rider agrees to version 3, **When** the organiser reloads, **Then** the rider has a
   line covering the whole season so far and counts towards the team lines.
4. **Given** a rider joins after version 3 is published, **When** they connect, **Then** they accept
   version 3 and have a line without being asked again.
5. **Given** a rider leaves or is removed, **When** an organiser next opens the Riders view, **Then**
   their line is gone and the team lines no longer include them.

---

### User Story 3 - Choose the time range (Priority: P1)

An organiser wants to look at a particular stretch, such as the last month or the weeks around a team
event. They pick a preset, type dates, or drag across a graph, and all three graphs follow.

**Why this priority**: A freely chosen range was asked for explicitly. A fixed season view can't show
what happened in a given stretch.

**Independent Test**: Choose a range in each of the three ways and check that the date boxes and all
three graphs agree.

**Acceptance Scenarios**:

1. **Given** the Progress section, **When** the organiser chooses Season, 3 months or 4 weeks, **Then**
   the date boxes and all graphs show that range, ending today.
2. **Given** the date boxes, **When** the organiser enters a From or To date, **Then** all graphs show
   that range and no preset is marked.
3. **Given** any graph and a mouse, **When** the organiser drags across it, **Then** the chosen stretch
   is marked while dragging, and on release the date boxes hold its dates and all graphs show it.
4. **Given** a range chosen by dragging, **When** the organiser chooses Season, **Then** everything
   shows again.
5. **Given** the From date is moved past the To date, or the reverse, **When** the change is applied,
   **Then** the other date follows, so the range is never empty.
6. **Given** a touch screen, **When** the organiser uses a graph, **Then** it works like the rider's
   progress charts: a swipe up or down scrolls the page, a pinch zooms, a sideways drag moves the period
   and a tap selects a day. The date boxes follow the zoom and the move.

---

### User Story 4 - Choose the lines with 30+ riders (Priority: P2)

An organiser picks a group tile and the graphs show that group. To change it, they open a compact
dropdown, search for a name and tick it. With many lines selected, the graphs stay readable.

**Why this priority**: The graphs work without it for a few riders, but a live team has 30 or more.

**Independent Test**: With 40 sample riders, select "Everyone", then highlight one rider. Then find a
rider by name in the dropdown and add them to a smaller group.

**Acceptance Scenarios**:

1. **Given** the Progress section, **When** the organiser picks a group tile, **Then** the graphs show
   the agreed riders of that group, replacing the previous rider selection, and the team lines stay as
   they were.
2. **Given** the dropdown "Shown in the graphs" is closed, **When** the organiser reads it, **Then** a
   summary says what is shown, such as "12 riders, team average".
3. **Given** the dropdown is open, **When** the organiser types in "Find a rider", **Then** the list
   narrows to matching names, and ticking one shows or hides that line straight away.
4. **Given** the dropdown is open, **When** the organiser chooses "Done" or clicks outside it, **Then**
   it closes and the selection stays. "Clear all" removes every line, including the team lines.
5. **Given** more than 8 riders are selected, **When** the graphs draw, **Then** rider lines are thin
   and grey, the team lines stay prominent, and the legend lists team lines first and then riders
   ranked by value, in a scrolling box.
6. **Given** more than 8 riders are selected, **When** the organiser hovers over a legend entry or
   taps it, **Then** that rider's line stands out in its own colour and the others fade.
7. **Given** a group with riders who haven't agreed, **When** it is picked, **Then** a short note says
   how many riders have no line, and the dropdown lists all such riders by name at the bottom, without
   a checkbox.

---

### User Story 5 - Use it on a phone without endless scrolling (Priority: P2)

An organiser on a phone checks the team between other things. Open reports come first, then they
switch between graphs and riders instead of scrolling past one to reach the other, and they can find
one rider among 30 by name.

**Why this priority**: Organisers use phones, and with 30+ riders the current cards become a long
scroll. It builds on stories 1 to 4, though the riders part is useful on its own.

**Independent Test**: On a phone-sized screen with 40 sample riders, go through both views, find a
rider by name, and handle an open report.

**Acceptance Scenarios**:

1. **Given** a phone, **When** the organiser opens the Riders view, **Then** the order is: switch,
   heading, deadline hero, tiles, open reports box, then a Graphs / Riders (N) switch with Graphs
   selected.
2. **Given** more than 3 open reports, **When** the box shows, **Then** it lists 3 and offers "Show all
   N", which opens the requests group in the Riders view.
3. **Given** the Graphs view, **When** the organiser reads it, **Then** one graph shows at a time,
   chosen through Outdoor, Virtual and Elevation tabs, and the date boxes appear only after choosing
   the "Custom" pill.
4. **Given** the Riders view, **When** the organiser types in "Find a rider", **Then** riders from the
   whole team match regardless of the selected group, and choosing a tile clears the search.
5. **Given** the Riders view, **When** more than 5 riders are shown, **Then** each is one line that
   expands on tap; with 5 or fewer they are all expanded.

---

### User Story 6 - Keep the desktop page in order (Priority: P2)

On a desktop the rider table stays first and doesn't push the graphs out of reach.

**Why this priority**: With 30+ riders, a full-length table would put the graphs a long way down.

**Independent Test**: On a wide screen with 40 sample riders, scroll the table and reach the graphs
below it.

**Acceptance Scenarios**:

1. **Given** a wide screen, **When** the organiser opens the Riders view, **Then** the order is: switch,
   heading, deadline hero, tiles, pace hint, rider table, Progress, "Training goal reached".
2. **Given** the table has more riders than fit, **When** the organiser scrolls inside it, **Then** its
   header stays visible and the page around it doesn't move.
3. **Given** open reports, **When** the organiser looks for them, **Then** they show as they do today:
   the red tile, the first table rows under "Everyone", and the Report column with Add and Decline.
   Wide screens have no separate reports box and no search above the table.

---

### User Story 7 - Turn it on or off per deployment (Priority: P2)

A team decides whether its organisers get the graphs. The maintainer changes one setting.

**Why this priority**: Teams may decide differently, and it must be possible to withdraw the feature
without a code change.

**Independent Test**: Run with the setting on and off, and compare the organiser's page and the data
it receives.

**Acceptance Scenarios**:

1. **Given** the setting is off, **When** an organiser opens the Riders view, **Then** there is no
   Progress section, no Graphs / Riders switch, and no daily values reach the browser.
2. **Given** the setting is off, **When** a rider uses the app, **Then** the consent versions and what
   the rider is asked are the same as with the setting on.
3. **Given** the setting holds anything but "on" or "off", **When** the app reads it, **Then** it fails
   with a clear message, as `TRAINING_LEADERBOARD` does.

---

### User Story 8 - Try it with a realistic team (Priority: P3)

A developer or maintainer runs the app in fake mode and sees a team the size of a live one.

**Why this priority**: The current 18 sample riders are mostly edge cases, so crowded graphs and long
lists can't be judged locally. It supports the other stories without adding anything for riders.

**Independent Test**: Start fake mode and open the Riders view as an organiser.

**Acceptance Scenarios**:

1. **Given** fake mode, **When** an organiser opens the Riders view, **Then** about 40 riders show,
   with ordinary riding patterns across the season, and the edge-case riders are still there.
2. **Given** fake mode, **When** the organiser opens the dropdown, **Then** some riders are listed as
   not having agreed yet.

### Edge Cases

- **A day without rides**: 0 in Per day view; a running total stays level.
- **A rider with no rides in the range**: they keep their line, flat at zero, and are ranked last.
- **Nobody selected**: the graphs stay in place without lines, and the dropdown remains the way back.
- **Nobody has agreed yet**, as on the day version 3 is published: the section shows, with no rider
  lines, no team values and a note saying riders are still being asked. No average is taken over zero
  riders.
- **A group where nobody agreed**: only the team lines show, with the note from story 4.
- **A ride edited or deleted on Strava, or reprocessed**: the next page load follows the stored result.
- **A ride that doesn't count**, such as flagged, manual or an overlapping recording: it isn't in any
  graph.
- **A ride across midnight**: it belongs to the day it started, in the rider's local time.
- **A range of a single day**: the graphs still draw that day's values readably.
- **Season not started yet, or just started**: the graphs show what exists, without an error.
- **More selected lines than colours**: colours may repeat. The legend and highlighting still tell
  riders apart.
- **Same first name twice**: both are told apart the way the table does it today.

## Requirements *(mandatory)*

### Functional Requirements

**The graphs**

- **FR-001**: The Riders view MUST gain a Progress section with exactly three graphs: outdoor
  kilometres, virtual kilometres and elevation in metres. Everything the view shows today stays.
- **FR-002**: Graphs MUST NOT show Rynke. The overall Rynke figures stay where they are.
- **FR-003**: Every value MUST be a per-rider sum for one day, or a sum of such days. A point is that
  day's sum however many rides it holds. The feature MUST NOT name, list or link a single ride, or show
  start times, speed, duration or routes.
- **FR-004**: A day MUST be the rider's local calendar date at the start of the ride.
- **FR-005**: Only counting rides within the season MUST enter the values, so the graphs show the rides
  behind the rider's Rynke. Kilometres MUST come from the recorded distance and metres from the recorded
  elevation, not from Rynke. Corrections, which are Rynke, MUST NOT enter.
- **FR-006**: A ride MUST go to the virtual graph if the app already treats it as virtual, otherwise
  to the outdoor graph. Its elevation MUST enter the elevation graph either way.
- **FR-007**: Organisers MUST be able to switch between Running total and Per day. Running total MUST
  start from zero on the first day of the chosen range.
- **FR-008**: Each graph MUST have a legend. It MUST show each line's sum over the chosen range, and
  while a day is hovered or tapped, the value of that day in the current view.
- **FR-009**: Each graph's values MUST also be available as text to screen readers.

**Team lines**

- **FR-010**: Team average and team total MUST be lines in the same graphs and can be toggled like
  rider lines. Team average MUST be on by default and team total off.
- **FR-011**: Team lines MUST be calculated from all riders who agreed, whichever riders or group are
  selected. The average MUST divide by the number of those riders, including those with no ride that
  day.

**Time range**

- **FR-012**: Organisers MUST be able to choose any range within the season, from its first day to
  today, or to the qualification deadline once that has passed, through From and To date boxes, through the presets Season, 3 months and 4 weeks, and with
  the gestures of the rider's progress charts on any graph: dragging with a mouse, pinching and moving
  on a touch screen.
- **FR-013**: The date boxes, presets, graphs and marked stretch MUST stay in sync, whichever way the
  range was chosen. The range applies to all graphs together. The default is Season.

**Choosing lines**

- **FR-014**: Picking a group tile MUST preselect that group's agreed riders. The default group is the
  one the view already opens with: "Everyone" on a wide screen, "Need a push" on a phone.
- **FR-015**: Lines MUST be chosen in a dropdown labelled "Shown in the graphs", with a summary as its
  label. Its panel MUST offer "Find a rider", team lines first, a checkbox per agreed rider, the names
  of riders who haven't agreed at the bottom without a checkbox, "Clear all" and "Done". A click outside
  MUST close it.
- **FR-016**: With more than 8 riders selected, rider lines MUST be thin and grey, team lines
  prominent, and the legend ranked as in story 4. Hover on desktop and tap on a phone MUST highlight
  one line.
- **FR-017**: A short note MUST state how many riders of the current group have no line because they
  haven't agreed yet.

**Layout**

- **FR-018**: Wide screens MUST follow the order in story 6, with the rider table in a scrolling box
  with a sticky header, no search above it and no separate reports box.
- **FR-019**: Phones MUST follow the order and behaviour in story 5.
- **FR-020**: The look, helper texts and interactions MUST follow the visual reference. All text MUST
  be in the message catalogs, in every language.
- **FR-021**: The layout changes in FR-018, and on phones the reports box, one-line rows and rider
  search, MUST apply whether or not the graphs are on, because they follow from team size. Without
  graphs, the phone shows the Riders content directly, with no Graphs / Riders switch.

**Consent**

- **FR-022**: A new consent version 3 MUST be added. It MUST state that organisers see, with the
  rider's first name, the rider's daily kilometres outdoors and virtually and daily elevation across
  the season. The consent text and the privacy page MUST say so in every language. The privacy page's
  "but no individual activities" MUST be reworded to match: organisers see daily totals, and no list or
  details of single rides. Reading no new data and requiring no new Strava scope, it needs no trip
  through Strava.
- **FR-023**: Riders who accepted an older version MUST be asked again through the existing flow.
- **FR-024**: A rider's daily values MUST be used for a rider line or a team line only when their
  accepted version is 3 or higher. This MUST be enforced where the data is read, so that no daily value
  of any other rider reaches the browser.
- **FR-025**: Riders who haven't agreed to version 3 MUST stay in the table with everything their
  earlier consent covers.
- **FR-026**: When a rider leaves or is removed, their values MUST disappear from all lines with the
  rest of their data, including the stored summary in FR-031. Nothing may outlive the rider's data.

**On and off**

- **FR-027**: A deployment setting `ORGANISER_PROGRESS_GRAPH`, "on" or "off", MUST control the graphs,
  in the style of `TRAINING_LEADERBOARD`. Off MUST mean no Progress section and no daily values sent.
- **FR-028**: The setting MUST NOT affect the consent versions, the consent text or who is asked. The
  tie runs one way: the graphs depend on the consent version, never the reverse.
- **FR-029**: Graphs MUST show only when `ORGANISER_FIGURES` is "full" as well. "percent" promises
  organisers see no amounts, and kilometres and metres are amounts.

**Access and data**

- **FR-030**: The Progress section and its data MUST be available only to those who can open the
  organiser overview today.
- **FR-031**: The feature MUST NOT make any new request to Strava or read any new field from it. It MAY
  store one summary per rider, derived only from that rider's stored rides and results, and kept up to
  date whenever they are evaluated, so that viewing doesn't add up rides on every page load.
- **FR-033**: Adding what the graphs need to the stored summaries MUST NOT make other pages add up the team's
  rides again, including on the day of the release.
- **FR-034**: The Badges page MUST show the rider's own progress from their stored summary rather than reading
  their rides, with the same figures. Earned badges are still worked out from the rides.

**Test data**

- **FR-032**: Fake mode's sample data MUST gain about 25 ordinary synthetic riders, for about 40 in
  total, with varied riding across the season, including outdoor and virtual rides. Some of them MUST
  not have agreed to version 3. Existing edge-case riders stay. No real rider data.

### Key Entities

- **Daily rider figures**: one rider and one day, with outdoor kilometres, virtual kilometres and
  elevation in metres. Derived from stored rides and their results, and kept in one summary per rider.
- **Team lines**: per day, the sum and the average over all riders who agreed. Derived the same way.
- **Consent version 3**: the existing consent record, at a new version, marks who is agreed.
- **Graph selection**: range, view, chosen rider lines and team lines. It belongs to the open page and
  isn't saved.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An organiser can read a chosen rider's kilometres and elevation for any stretch of the
  season in under 30 seconds, starting from the opened Riders view.
- **SC-002**: With 40 riders, the Riders view with graphs opens as promptly as without them, with no
  visible delay of more than a second on a current phone.
- **SC-003**: With 40 riders selected, an organiser can pick out any one rider's line in two actions or
  fewer: find them in the legend and hover or tap.
- **SC-004**: In 100% of checks, a rider who hasn't agreed appears in no line, no team value and no data
  sent to the browser.
- **SC-005**: In 100% of checks, each rider's sums over the whole season match the sum of their counting
  rides, for outdoor kilometres, virtual kilometres and elevation.
- **SC-006**: On a phone with 40 riders, an organiser reaches any one rider in at most two actions:
  switch to Riders, type a name.
- **SC-007**: With the setting off, an organiser's page and data contain nothing of this feature's
  graphs, and riders see no difference from the setting being on.
- **SC-008**: With 40 riders at the end of a season, the graphs add fewer than 1,000 database rows read
  per page load.
- **SC-009**: With 40 riders and a stored summary, a Badges page view reads at most 500 rows, and twice the rides
  add no more than a few rows.
- **SC-010**: From the release until the daily job has run, the Team page, the app's start and the organiser's
  table read as many rows as with fully updated summaries, within 10%.

## Assumptions

- **Counting rides only**: the graphs show what counts towards the rider's Rynke. Rides that don't
  count, such as flagged or manual ones, aren't shown.
- **Private rides**: a private ride the rider lets the app read counts, so it enters the daily totals.
  The consent text says so.
- **Kilometres and Rynke differ**: the table shows distance and elevation in Rynke and the graphs in
  kilometres and metres, so dividing a graph's value by the Rynke rate may not exactly match the table.
- **Season range**: the range starts on the season's first day and ends today, or at the qualification
  deadline once that has passed, because later rides don't count.
- **Phone layout**: "phone" means below the width where the table takes over from the cards today
  (1100 px), so tablets get the phone layout.
- **Whole season once agreed**: agreeing to version 3 covers the rider's data for the season so far,
  and the consent text says "across the season".
- **Percent mode**: the graphs need `ORGANISER_FIGURES` to be "full" (FR-029).
- **Who is asked**: version 3 asks every rider on every deployment, even one with the setting off,
  because the versions are the same everywhere (FR-028).
- **No separate refusal**: as with earlier versions, a rider who doesn't want to agree can leave.
  "Hasn't agreed" means they haven't come back yet.
- **Same audience, same data**: team lines go only to organisers, who can see agreed riders' lines
  anyway, so a small number of agreed riders exposes nothing further. Riders see none of it.
- **Not saved**: the chosen range and lines reset when the page is reloaded.
- **Chart library**: the Chart.js and zoom plugin copies already in the repository are enough, so no new
  library is needed. The plan confirms this.

### Out of Scope

- Rynke graphs for organisers.
- Showing single rides.
- Riders seeing each other's graphs, or these graphs on rider-facing pages.
- Data export.
- Permissions per team.
