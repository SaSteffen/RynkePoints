# Feature Specification: Season and Qualification Window

**Feature Branch**: `040-season-window-split`

**Created**: 2026-11-18

**Status**: Draft

**Input**: User description: "Split season and qualification window. Every team's season runs
1 Sep – 31 Aug (Rynkeby rule); each team has its own qualification window inside the season
(Hamburg: 1 Sep 2026 – 30 Jun 2027, Europe: 1 Jan 2027 – 30 Jun 2027). Today the code has one date
per team that is both season start and window start, so Europe's season wrongly runs 1 Jan –
31 Dec. With the split: rides before the window opens are season rides, not qualifying rides.
Badges that are about rides (e.g. November/December badges) come back for Europe because the season
has those days. Pre-window rides are shown in the ride list but marked as not counting towards
qualification (orange text, not red, because the window hasn't started yet). Riders are told before
the window starts that their rides don't count towards qualification yet but they can already earn
badges. Pre-window rides are not shown in any graph. Everything Rynke/qualification related (Rynke
points, pace, progress, deadline countdown) uses the window; season-based things (badges,
rollover, season end) use the season. The pre-window state gets more thought later; this is the
minimum."

## Overview

Every Rynkeby season, for every team, runs from **1 September to 31 August** (maintainer,
2026-11-18). Inside it, each team has its own **qualification window**: the days whose rides earn
Rynke towards Paris. Hamburg's window is the whole training period from 1 September 2026 to
30 June 2027. Team Europe's starts later, on 1 January 2027, and also ends on 30 June 2027.

Today the app knows one start date per team and uses it for both. For Hamburg that is right. For
Europe, the season wrongly starts on 1 January and ends on 31 December 2027: rides from autumn are
never fetched, and feature 039 had to leave out every badge for November and December.

This feature gives each team both: the season from 1 September and its own window start. Rynke and
qualification follow the window. Badges and the season follow the season. Before Europe's window
opens, its riders' rides show up with a note that they don't count for qualification yet, and they
can already earn badges with them.

The pre-window state is kept to a minimum on purpose; it may get more thought later.

Terms:

- **Season**: 1 September to 31 August, the same for every team.
- **Qualification window**: from the team's window start to its qualification deadline, inside the
  season.
- **Counting ride**: a ride whose result counts for Rynke, as in feature 003.
- **Pre-window ride**: a ride in the season, before the window start, that meets every other rule.
  It would count if the window were open.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Hamburg stays exactly as it is (Priority: P1)

A Hamburg rider, organiser or maintainer sees no change after the release. Hamburg's window starts
on the season start, so Hamburg has no pre-window days: the same rides, Rynke, badges, graphs,
texts and season end.

**Why this priority**: Hamburg uses the app every day; its Rynke decide who rides to Paris.

**Independent Test**: Run Hamburg in fake mode before and after the change on the same day of the
season; compare every rider and organiser page and the stored results; run every existing Hamburg
test unchanged.

**Acceptance Scenarios**:

1. **Given** Hamburg's settings after the change, **Then** its season runs 1 September 2026 to
   31 August 2027 and its window 1 September 2026 to 30 June 2027, as today.
2. **Given** any Hamburg page in fake mode on the same day, **Then** it is identical before and
   after the change.

---

### User Story 2 - Europe's season starts on 1 September (Priority: P1)

A Team Europe rider who connects in November finds their rides since 1 September in the app, and
Europe's season ends on 31 August 2027 like every team's.

**Why this priority**: Everything else builds on the season being right: which rides are fetched,
when the season ends, which badges exist.

**Independent Test**: In fake mode, connect a Europe rider on a day in November 2026 and check that
their rides from September on are listed, and that the season end shown anywhere is 31 August 2027.

**Acceptance Scenarios**:

1. **Given** a Europe rider connecting on 18 November 2026, **When** their rides are fetched,
   **Then** every ride from 1 September 2026 on is fetched, and none from before.
2. **Given** Europe's settings, **Then** its season runs 1 September 2026 to 31 August 2027 and its
   window 1 January 2027 to 30 June 2027.
3. **Given** anything that happens at the season end (the change to the next season, the season
   album), **Then** for Europe it happens after 31 August 2027, as for Hamburg.
4. **Given** a day before 1 September 2026, **Then** Europe shows the same "before the season"
   state as Hamburg.

---

### User Story 3 - Pre-window rides are listed, marked as not counting yet (Priority: P1)

Before 1 January, a Europe rider opens their rides and sees every ride. Each ride that would count
carries an orange "doesn't count yet" mark instead of the red "doesn't count", with the reason that
qualification starts on 1 January 2027. These rides add no Rynke and appear in no graph.

**Why this priority**: Listing the rides without marking them would suggest they count; leaving
them out would hide rides the rider can see on Strava.

**Independent Test**: In fake mode before 1 January, open a Europe rider's rides and the You page,
and an organiser's view of the same rider; check the marks, the reason, the Rynke and every graph.

**Acceptance Scenarios**:

1. **Given** a Europe ride on 15 November 2026 that meets every rule, **When** the rider opens their
   rides, **Then** it shows a "doesn't count yet" mark in orange and the reason "before
   qualification starts on 01.01.2027" (wording to be written), and 0 Rynke.
2. **Given** a Europe ride on 15 November 2026 that is also shorter than 25 km, **Then** it shows
   the red "doesn't count" mark, with the length reason and the pre-window reason.
3. **Given** a rider with pre-window rides only, **Then** their Rynke, gauges, rankings, pace,
   progress chart and ride figures are the same as for a rider with no rides at all.
4. **Given** pre-window rides of several riders, **Then** no rider, team or organiser graph shows
   them, and no team total or ranking counts them.
5. **Given** an organiser opening a Europe rider's rides, **Then** the pre-window rides show with
   the same orange mark and reason as the rider sees.
6. **Given** a ride on the window start day, 1 January 2027, that meets every rule, **Then** it
   counts.

---

### User Story 4 - Badges count from the season start (Priority: P2)

A Europe rider out on 24 December earns the Christmas Eve badge, and November's winter rides count
towards the November winter badge. Every badge that is about rides, runs or swims counts the
season's activities, including pre-window ones; badges about Training Rynke only count Rynke.

**Why this priority**: Badges are what a rider can get from riding before the window opens; they
are the reason to connect early.

**Independent Test**: In fake mode before 1 January, give a Europe rider rides in November and on
24 December and check their badges page; check Europe's badge list against Hamburg's.

**Acceptance Scenarios**:

1. **Given** Europe's badges page, **Then** it lists every badge Hamburg lists except the
   event-only ones (feature 039 FR-014): the November and December winter badges, Christmas Eve,
   Christmas, Festive 500, Sonnenwende, Winterschlaf beendet, New Year's Eve sparkler and Festive
   gang are back.
2. **Given** a Europe rider with pre-window rides that meet every rule, **Then** they count towards
   personal and team badges about distance, elevation, ride length, virtual rides, winter months,
   surprise days and team totals, as counting rides do.
3. **Given** the same rider, **Then** their Training Rynke badge and the team's Training Rynke
   badge don't move, because pre-window rides earn no Rynke.
4. **Given** a pre-window ride that fails another rule (too short, too slow), **Then** it counts for
   no badge, as today for a ride that doesn't count.
5. **Given** a Europe rider earning a badge with a pre-window ride, **Then** they get the same badge
   news as for any badge.

---

### User Story 5 - Riders are told before the window opens (Priority: P2)

Before 1 January, the status box on a Europe rider's You page says when qualification starts, that
their rides don't count for it until then, and that they can already earn badges.

**Why this priority**: Without it, orange marks and 0 Rynke next to badges look like a fault.

**Independent Test**: Open a Europe rider's You page in fake mode before and after 1 January.

**Acceptance Scenarios**:

1. **Given** a Europe rider on 18 November 2026, **When** they open the You page, **Then** the
   status box says qualification starts on 01.01.2027, that their rides don't count towards it
   until then, and that they can already earn badges, with no countdown and no plan sentence.
2. **Given** the same rider on 1 January 2027, **Then** the status box shows the countdown to the
   deadline and the plan sentence, as for Hamburg.
3. **Given** a Hamburg rider on any day of the season, **Then** the pre-window text never shows.

### Edge Cases

- **Ride on the window start day**: counts (User Story 3, scenario 6). A ride on the day before is
  a pre-window ride.
- **Ride before 1 September**: belongs to the previous season, isn't fetched, as today.
- **Rides after the deadline**: unchanged. They show as not counting (red) with the deadline
  reason, and earn no badges, as today.
- **A rider connecting after the window opens**: their pre-window rides are fetched and listed with
  the orange mark, and the badges they earn are awarded at once, as on any first fetch.
- **A ride edited on Strava from pre-window to inside the window** (start date changed): it is
  checked again and counts, as any re-checked ride (feature 036).
- **Organiser corrections and events before the window opens**: unchanged; Europe has neither
  events nor Team Rynke, and Hamburg has no pre-window days.
- **A window that doesn't fit the season** (start before 1 September, deadline after 31 August,
  or start after the deadline): refused when the team settings are checked, before a deploy.
- **The status box on the window start day**: counts down from then on.

## Requirements *(mandatory)*

### Functional Requirements

**Season and window**

- **FR-001**: Every team's season MUST run from 1 September to 31 August.
- **FR-002**: Every team MUST have its own qualification window start, besides its qualification
  deadline: Hamburg 1 September 2026, Europe 1 January 2027, and the same for their sandboxes.
- **FR-003**: The team settings check MUST refuse a window that starts before its season start,
  ends after its season end, or starts after its deadline.
- **FR-004**: What differs between teams MUST stay team data, never a branch in code (feature 026).

**What follows the season**

- **FR-005**: The app MUST fetch a rider's rides, runs and swims from the season start, on the first
  fetch and in every catch-up.
- **FR-006**: The season end, the change to the next season and the season album MUST follow the
  season, ending on 31 August.
- **FR-007**: The "before the season" state MUST follow the season start.
- **FR-008**: Badges MUST follow the season (FR-014 to FR-016); which badges a team lists MUST
  follow the days from its season start to its deadline (feature 039 FR-022).

**What follows the window**

- **FR-009**: A ride MUST count for Rynke only inside the qualification window. Rynke, gauges,
  rankings, pace, the plan, progress charts, ride figures, the deadline countdown and every
  organiser figure MUST follow the window.
- **FR-010**: No graph a rider, team or organiser sees MUST show pre-window rides, and no total or
  ranking based on Rynke or counting rides MUST count them.

**Pre-window rides**

- **FR-011**: A pre-window ride MUST be listed wherever rides are listed (the rides page, the You
  page's recent rides, the organiser's rides of a rider) with its own mark, "doesn't count yet"
  (wording to be written), in orange, never the red of a ride that doesn't count.
- **FR-012**: A pre-window ride MUST give the reason that qualification starts on the window start
  date, replacing today's "before the season start" reason for these rides.
- **FR-013**: A ride before the window start that fails another rule MUST show as not counting
  (red), with its reasons and the pre-window reason.

**Badges**

- **FR-014**: Badges about rides, runs or swims, personal and team, MUST count the season's
  activities that meet every rule but the window, from the season start up to the deadline, as
  today's counting rides up to the deadline.
- **FR-015**: The Training Rynke badge and the team Training Rynke badge MUST count Rynke only, so
  pre-window rides don't move them.
- **FR-016**: Europe MUST list every badge Hamburg lists except the event-only ones.

**Telling riders**

- **FR-017**: Before its window opens, a team's You page status box MUST say when qualification
  starts, that rides don't count towards it until then, and that badges can already be earned. It
  replaces today's pre-window text (feature "deadline countdown", pull request #359). From the
  window start, the countdown and plan sentence show as today.
- **FR-018**: Every new or changed rider-facing text MUST be in all ten languages, German first.

**Checking**

- **FR-019**: Hamburg's pages, results and stored data MUST be identical before and after the
  change on the same day of the season.
- **FR-020**: Europe's sample riders in fake mode MUST have rides in the pre-window months,
  November and December included, replacing feature 039 FR-016's "no rides dated in a November or
  December". Seeded before the window opens, every sample rider has rides, possibly badges, and
  0 Rynke.
- **FR-021**: A maintainer MUST be able to see the pre-window state for Europe and the in-window
  state for both teams side by side in local fake mode.

### Key Entities

- **Season**: 1 September to 31 August; the same for every team.
- **Qualification window**: a team's window start and qualification deadline, inside the season.
- **Ride result**: gains the pre-window state, besides counting and not counting.
- **Team data**: gains the window start; the season start is always 1 September.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After the release and one daily run, 0 Hamburg results have changed, 0 Hamburg riders
  have been re-evaluated or notified because of it, and Hamburg's pages in fake mode are identical
  to before on the same day of the season.
- **SC-002**: A Europe rider connecting in November sees 100% of their Strava rides since
  1 September, each one that meets every rule with the orange mark, and 0 Rynke.
- **SC-003**: A walk through every Europe rider and organiser graph before 1 January finds 0
  pre-window rides.
- **SC-004**: Europe's badges page lists every badge Hamburg lists except the event-only ones, and
  a Europe rider out on 24 December 2026 earns the Christmas Eve badge.
- **SC-005**: Everywhere a season end shows for Europe, it is 31 August 2027.
- **SC-006**: A Europe rider opening the You page before 1 January reads, in their language, when
  qualification starts and that they can already earn badges.

## Assumptions

- Badges keep ending at the deadline, as today. Earning badges after the deadline until 31 August
  is out of scope; it would change Hamburg.
- Europe has no production riders or stored results yet, so nothing needs migrating; Europe's
  sandbox is reseeded after the release.
- Hamburg's window start equals its season start, so Hamburg has no pre-window days and nothing
  changes for it.
- "Orange" is a warning colour already in the app's themes, readable in light and dark; the exact
  shade is decided in the design.
- Fetching four more months of rides per Europe rider stays within the app's Strava request
  budget; Europe has few riders.
- The You page's status box with the deadline countdown (pull request #359) is merged before this
  feature is built; its pre-window text is the one this feature extends.
- The pre-window state gets more thought later (maintainer, 2026-11-18); this feature is the
  minimum: the ride marks, the status box text and the badges.
