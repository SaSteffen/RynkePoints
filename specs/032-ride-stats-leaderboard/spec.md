# Feature Specification: Ride Stats Leaderboard

**Feature Branch**: `032-ride-stats-leaderboard`

**Created**: 2026-11-06

**Status**: Implemented

**Input**: Wish of Team Rynkeby Europe, the second team (feature
[026-second-team](../026-second-team/spec.md)), in its contact's words: "number of
training sessions, number of kilometers ridden, total elevation gain, with a simple
ranking list." The project owner: a ride counts here exactly when it counts for Rynke
(feature 003), so every figure follows one rule; kilometres are full totals, not cut
down to full 10 km per ride. No separate view: the existing ranking of the Team
section gets a choice of figure, with Rynke the default. Organisers see named figures
only in the organiser area. A "typical ride" (the median ride length) shows whether
sessions come from real training or from short trips. Talking to Strava about the
feature happens outside this spec.

**Visual reference**: the design draft "RynkePoints Ride Stats"
(https://claude.ai/artifact/1FzcR5Qd9UfTdxmX9wCsXW), with today's pages and the new
ones side by side for riders, organisers and a team without Rynke.

## Clarifications

### Session 2026-11-06

- Q: What counts as a training session? → A: Every ride that counts for Rynke under
  the team's rules (feature 003 FR-005 to FR-005g, FR-011), nothing more and nothing
  less. There is no minimum distance: a 6 km ride earns no distance Rynke but counts,
  as its elevation already does for elevation Rynke (feature 003 FR-004a). The few
  short trips this lets in are accepted; the typical ride (FR-009) shows when they
  pile up.
- Q: Are kilometres cut down per ride like Training Rynke? → A: No. A counting ride
  adds its full distance and its full elevation gain.
- Q: A view of its own? → A: No. The ranking of the Training view (feature 016)
  gains a "Rank by" choice: Rynke (the default, today's list), sessions, kilometres,
  elevation. A team with Rynke sees nothing new until a rider picks another figure.
- Q: Over which periods? → A: Season, current month and current week, each a
  ranking of its own, for the ride figures only. Rynke stay a season ranking.
- Q: Do other riders see names in the ranking? → A: No, for every team, with no
  setting to change it. The app is a motivational tool for reaching goals together;
  a public comparison by name is not.
- Q: Do organisers see names in the ranking? → A: No. On the Team section an
  organiser is a rider like any other. Organisers see each rider's ride figures by
  name only in the organiser area, as a column of the riders table and a fourth
  Progress graph (feature 029).
- Q: Typical ride? → A: The median length of a rider's counting rides in the period:
  half of the rides are longer, half are shorter. A few short trips barely move it;
  many short trips pull it down. It is a figure to read, never a figure to rank by.
- Q: When a team switches the feature on after riders have already consented, are
  they asked again? → A: No. The data read from Strava doesn't change; only figures
  made from it are newly shown. That is a minor consent revision (for example 3 →
  3.1): the consent text names the feature, but riders who accepted the version
  before are not asked again. Riders are asked again only on a major change
  (Principle I, constitution 2.4.0; FR-021).
- Q: Which teams get the feature? → A: Both, the founding team as well as Team
  Rynkeby Europe (FR-018). It stays team data.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Rider ranks by a ride figure (Priority: P1)

A rider opens the Training view of the Team section and sees today's Rynke ranking.
Above it, "Rank by" offers Rynke, sessions, kilometres and elevation. They pick
kilometres; a period choice appears (season, month, week). The list, their place card
and the team line follow the pick. No row carries a name; their own row is marked.

**Why this priority**: It is what the second team asked for; everything else builds
on it.

**Independent Test**: With synthetic riders (`pnpm dev`) and the feature switched on,
sign in as a rider and compare places and figures with sums worked out by hand, for
each figure and period.

**Acceptance Scenarios**:

1. **Given** the Training view opens, **When** the rider has picked nothing, **Then**
   it shows the Rynke ranking exactly as today, with "Rank by" on Rynke and no period
   choice.
2. **Given** a rider with a 42.7 km ride and 380 m and a 6.1 km ride with 40 m in the
   season, both counting, **When** anyone looks at the season, **Then** the rider has
   2 sessions, 48.8 km and 420 m.
3. **Given** a 79 km ride, **When** it counts, **Then** it adds 79 km, not the 70 km
   its Training Rynke are worked out from.
4. **Given** a ride that doesn't count for Rynke (for example an e-bike ride, a manual
   entry, too long a pause, or the shorter of two overlapping recordings), **When**
   the figures are shown, **Then** it is in none of them.
5. **Given** the ranking by kilometres, **When** the rider switches to sessions,
   **Then** order, places and the place card follow sessions.
6. **Given** the season, **When** the rider switches to the week, **Then** only
   counting rides that started this week, in the rider's time zone, are in the
   figures.
7. **Given** two riders with the same figure of the picked kind, **When** they are
   ranked, **Then** they share the place and the next place is skipped.
8. **Given** a ride figure is picked, **When** the rider looks at their place card,
   **Then** it shows their place, the gap to the next place, and their typical ride
   for the period with a one-line explanation.

---

### User Story 2 - Organisers follow sessions by name (Priority: P1)

An organiser opens Orga › Riders. The riders table has a "Sessions" column with each
rider's typical ride beneath the count, and the Progress section has a fourth graph,
"Sessions", next to outdoor, virtual and elevation. So they see who is riding, who
has gone quiet, and who collects many short trips.

**Why this priority**: The second team's organisers asked to follow their riders'
training; they must not have to read it from a ranking on the Team section.

**Independent Test**: Sign in as a synthetic organiser and check the column and graph
against hand counts; open the Team section as the same organiser and check no row
carries a name.

**Acceptance Scenarios**:

1. **Given** a rider with 12 counting rides in the season, **When** an organiser
   opens the riders table, **Then** the rider's row shows 12 sessions and their
   typical ride.
2. **Given** a rider with no counting ride, **When** the organiser looks, **Then** the
   row shows 0 sessions and no typical ride.
3. **Given** the Sessions graph, **When** the organiser switches range, Running total
   or Per day, picks riders or team lines, **Then** it behaves exactly as the other
   three graphs (feature 029).
4. **Given** an organiser on the Team section, **When** they look at any ranking,
   **Then** they see it exactly as a rider does, without names.

---

### User Story 3 - The team's figures (Priority: P2)

With a ride figure picked, a line above the rows gives the team's sessions,
kilometres, elevation and typical ride for the period. A team without Rynke shows
kilometres on its team card and a chart of the team's kilometres per week.

**Why this priority**: The team figures add to the list, but the list works without
them.

**Independent Test**: Compare the team line, card and chart with sums of the synthetic
riders' counting rides.

**Acceptance Scenarios**:

1. **Given** consenting riders, **When** anyone looks, **Then** each team total is
   the sum of the rows, and the team's typical ride is the median of all their
   counting rides in the period.
2. **Given** a rider with no current consent (for example one who still has to
   renew after a major change, FR-020), **When** anyone else looks, **Then** their
   rides are in no total, typical ride, bar, row or count.
3. **Given** a team switches the feature on while its riders have accepted the
   previous consent version, **When** they next sign in, **Then** nobody is asked
   again and every one of them is in the ranking at once.

---

### User Story 4 - A team switches the feature on or off (Priority: P1)

A maintainer turns the ride figures on or off for a team as team data.

**Why this priority**: Both teams get the feature, but it stays team data, so a
further team can decide for itself and pages stay unchanged where it is off.

**Independent Test**: Run the app with the feature on and off, and with the Rynke
views on and off, and check pages, menus and texts.

**Acceptance Scenarios**:

1. **Given** the feature off, **When** riders and organisers use the app, **Then** no
   choice, column, graph, text or notification of it appears.
2. **Given** the feature on and the Rynke views on, **When** a rider opens the Team
   section, **Then** it looks as today until they pick a ride figure.
3. **Given** the feature on and both Rynke views off, **When** a rider opens the Team
   section, **Then** they see one view without a switcher: the team card in
   kilometres, the weekly chart, their place card and the ranking, "Rank by" without
   Rynke and kilometres for the season picked.

### Edge Cases

- **A short trip** (say 6 km to the barber) that counts for Rynke counts here as a
  session with its distance and elevation. It earns no distance Rynke all the same.
- **The typical ride with an even number of rides** is the mean of the two middle
  rides; with one ride it is that ride's length.
- **A ride is edited or deleted on Strava**: the figures follow the next time it is
  evaluated (feature 003 FR-003), as Rynke do.
- **Unknown elevation** (feature 003 FR-005f): the ride counts as a session with its
  distance and adds 0 m.
- **A rider leaves**: they disappear from every ranking, total and graph at once.
- **The first days of a month or week**, when nobody has ridden yet: the list shows
  every rider with zeros, ranked equal, and says nobody has ridden yet in that
  period; place cards and the team line show no typical ride.
- **Virtual rides** count like any other here; the one-third limit for qualifying
  (feature 003 FR-013a) is a Rynke rule and doesn't apply.
- **Team events** add nothing here unless the rider recorded the ride on Strava;
  then the ride counts as any ride does.
- **Organiser corrections** of Rynke (feature 003 FR-010) change no ride figure;
  they keep the Rynke ranking a season ranking, as they carry no date.
- **The season end or qualification deadline** (feature 003 FR-011): rides after it
  count for nothing, as for Rynke.

## Requirements *(mandatory)*

### Functional Requirements

**What counts**

- **FR-001**: A ride MUST count for the ride figures exactly when it counts for Rynke
  under the team's rules in effect (feature 003 FR-005 to FR-005g, FR-011). No other
  rule, such as a minimum distance, applies.
- **FR-002**: Each counting ride MUST add one session, its full distance and its full
  elevation gain to its rider's figures. No figure is rounded or cut before summing.
- **FR-003**: A ride belongs to the day, week and month of its start date in the
  rider's time zone, as for Rynke; weeks run as in the rest of the app.
- **FR-004**: The figures MUST be derived from stored ride results only, be
  recomputable at any time (Principle IV) and never trigger a Strava request or an
  evaluation.
- **FR-005**: Kilometres MUST be shown with one decimal, elevation in whole metres,
  sessions as a whole number. The ranking MUST follow the shown value, so riders with
  the same shown figure share a place.

**The ranking on the Team section**

- **FR-006**: The ranking of the Training view (feature 016) MUST gain a "Rank by"
  choice: Rynke, sessions, kilometres, elevation. Rynke MUST be the default and show
  today's ranking unchanged. A team without Rynke views offers no Rynke choice and
  defaults to kilometres. The Team Rynke view stays as it is.
- **FR-007**: With a ride figure picked, a period choice MUST offer season, current
  month and current week, season by default. No period shorter than a week is
  offered per rider. The choices MAY be remembered on the device.
- **FR-008**: With a ride figure picked, the list MUST rank every rider of the team
  with a current consent (FR-020), including riders with zeros, highest
  first, with standard competition places (equal figures share a place, the next is
  skipped) and a stable order among equals that names no one. It keeps today's
  layout: the viewer's neighbourhood by default with a toggle for everyone, the top
  three with 🥇🥈🥉, the viewer's own row marked. Each row shows the picked figure
  emphasised with a bar against the leader, and the other two figures small.
- **FR-009**: The **typical ride** of a set of counting rides MUST be the median of
  their distances (FR-002), in km with one decimal; with an even number of rides the
  mean of the two middle ones. It MUST NOT be offered as a "Rank by" choice and MUST
  NOT appear in other riders' rows.
- **FR-010**: The viewer's place card MUST follow the pick: place out of all ranked
  riders, the picked figure and period, the gap to the next place, and, for a ride
  figure, the viewer's typical ride for the period with a one-line explanation (half
  of the rides are longer, half are shorter). With no ride in the period it shows no
  typical ride.
- **FR-011**: With a ride figure picked, a line above the rows MUST show the team's
  sessions, kilometres, elevation and typical ride for the period, over every ranked
  rider.
- **FR-012**: A team without Rynke views MUST show one view without a switcher: a
  team card with the team's season kilometres, sessions and elevation and this
  week's gain, a chart of the team's kilometres per week with the running total, the
  place card and the ranking. Peloton and Rynke cards do not appear.
- **FR-013**: The ranking is a list, not a game: this feature adds no badges, quotes,
  notifications or nudges of its own. Whether those of other features appear is up
  to their own switches (feature 026 FR-018).

**The organiser area**

- **FR-014**: The riders table of Orga › Riders MUST gain a "Sessions" column before
  Distance, with each rider's typical ride in small type beneath the count, for the
  same riders and period as the table's other figures.
- **FR-015**: The Progress section (feature 029) MUST gain a fourth graph,
  "Sessions": counting rides per rider and day, with the same range, Running total
  and Per day, rider and team lines, legend and screen-reader text as the other
  three. This amends feature 029 FR-001's "exactly three graphs".
- **FR-016**: Organisers MUST see named ride figures only in the organiser area. On
  the Team section they see every ranking as a rider does.

**Team data**

- **FR-017**: Whether the feature is on MUST be team data (feature 026 FR-016 to
  FR-018). Code MUST NOT branch on a team's name.
- **FR-018**: The feature MUST be on for both teams, the founding team and Team
  Rynkeby Europe. For the founding team, whose riders have already consented,
  switching it on is a minor consent revision (FR-021): nobody is asked again. A
  further team defaults to off. Switching it on is the one change to the founding
  team's pages that feature 026 FR-020 allows here.

**Who sees what**

- **FR-019**: The visibility table of feature 004 FR-020 MUST gain these rows:

  | Data about a rider | The rider | Organisers | Other riders |
  |---|---|---|---|
  | Sessions, kilometres and elevation gain per season, month and week, in a ranking row | yes | yes, as a rider: without a name | yes, without a name |
  | Typical ride per season, month and week | yes | yes, with name, in the organiser area | no |
  | Sessions per day | yes | yes, with name, in the organiser area | no |

  A row shown on the Team section MUST NOT carry a name, athlete ID, profile link,
  picture or anything else that names the rider, and no team setting may change
  that. Rides and ride dates stay visible to that rider only. Visitors who are not
  signed in MUST see nothing.
- **FR-020**: A rider without a current consent (one who still has to renew after a
  major change, feature 004 FR-021) MUST be left out of every figure shown to anyone
  else; they MUST still see their own figures and typical ride, without a place.

**Consent**

- **FR-021**: The consent text MUST name the ride figures in the ranking and in the
  organiser area and who sees them. A team that switches the feature on after riders
  connected MUST publish this as a **minor** consent revision (for example 3 → 3.1):
  new riders accept the revised text, riders who accepted the version before are
  not asked again and count as having a current consent. Only a major change asks
  riders again (feature 004 FR-013), and this feature is none (Principle I,
  constitution 2.4.0).
- **FR-022**: The privacy notice (feature 017) MUST describe the ride figures for
  every team with the feature on.

**Look and text**

- **FR-023**: The look MUST follow the visual reference and the existing Team section
  and organiser area (features 012, 016, 022, 029).
- **FR-024**: All text of this feature MUST be in the catalogs in every language the
  team offers (FR-028 of the app); Team Rynkeby Europe's default is English. The
  German label for the typical ride is "Typische Fahrt", not "Median".

### Key Entities

- **Ride figures**: per rider and period (season, month, week, and per day for the
  organiser graph), the number of counting rides, their summed distance and
  elevation gain, and the median distance. Derived from ride results, never edited
  by hand.
- **Team setting for ride figures**: on or off.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a synthetic season, every rider's sessions, kilometres, elevation
  and typical ride match a hand count of their counting rides, for every period, on
  the Team section and in the organiser area.
- **SC-002**: A rider finds their place for any figure and period in at most two taps
  from the Training view.
- **SC-003**: With the feature off, a team's pages are unchanged; with it
  on, the Training view is unchanged until a ride figure is picked (screenshots and
  tests before and after match).
- **SC-004**: No figure of a rider without a current consent appears in any view for
  anyone else, checked with a synthetic rider who hasn't accepted; switching the
  feature on asks no consented rider again.
- **SC-005**: No page outside the organiser area shows another rider's name next to a
  ride figure, checked as a rider and as an organiser.
- **SC-006**: The ranking for 200 riders loads as fast as today's Rynke leaderboard.

## Assumptions

- The figures are what the second team needs; Rynke, badges and quotes for that team
  are decided in feature 026 and are independent of this feature.
- "Training session" means a counting ride; attendance at a team event without a
  recorded ride is not a session.
- The Rynke rules stay as they are; this feature adds no rule of its own about which
  rides count.
- The data the figures need (distance, elevation, start date, eligibility) is already
  stored for Rynke and for the organiser graphs; nothing new is read from Strava.
- Talking to Strava about showing these figures is handled outside this feature.
- Consent versions today are whole numbers (feature 004 FR-013); telling major from
  minor revisions is part of this feature's plan.
