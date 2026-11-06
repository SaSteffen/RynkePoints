# Feature Specification: Ride Stats Leaderboard

**Feature Branch**: `032-ride-stats-leaderboard`

**Created**: 2026-11-06

**Status**: Draft

**Input**: Wish of Team Rynkeby Europe, the second team (feature
[026-second-team](../026-second-team/spec.md)), in its contact's words: "number of
training sessions, number of kilometers ridden, total elevation gain, with a simple
ranking list." The project owner: a ride counts under the same rules that make it
count for Training Rynke (feature 003), and rides under 10 km don't count at all;
kilometres are full totals, not cut down to full 10 km per ride. Who sees what is to
be drafted. Talking to Strava about the feature happens outside this spec.

## Clarifications

### Session 2026-11-06

- Q: What counts as a training session? → A: Every ride that would count for
  Training Rynke under the team's rules (feature 003), plus a minimum distance of
  10 km: a shorter ride counts for nothing here, not for sessions, kilometres or
  elevation.
- Q: Are kilometres cut down per ride like Training Rynke? → A: No. A counting ride
  adds its full distance.
- Q: Over which periods? → A: The whole season, the current month and the current
  week, each a ranking of its own; days only as team totals (FR-009, FR-010).
- Q: Do other riders see names in the ranking? → A: No, for every team, with no
  setting to change it. The app is a motivational tool for reaching goals together;
  a public comparison by name is not. Only organisers see first names, as for the
  Rynke leaderboard (feature 004 FR-020, FR-022).

## Open points

- **Consent version.** Principle I requires a new consent version when something is
  newly shown to someone other than the rider, and this feature shows ride figures to
  other riders (FR-016). The project owner prefers not to ask riders again for small
  changes and may decide otherwise; that decision would amend Principle I, not just
  this spec. FR-017 drafts what the constitution requires today. A team that switches
  the feature on before its first rider connects (expected for Team Rynkeby Europe)
  needs no second ask: its first consent version already covers the feature.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Rider sees the ranking (Priority: P1)

A rider opens the ride stats view and sees a ranking of every consenting rider of
their team for the season: place, sessions, kilometres and elevation gain, their own
row marked "You". They pick which figure ranks the list (sessions, kilometres or
elevation) and the period (season, month, week). Above the list they see their own
place and figures.

**Why this priority**: It is what the second team asked for; everything else builds
on it.

**Independent Test**: With synthetic riders (`pnpm dev`) and the feature switched on,
sign in as a rider and compare places and figures with sums worked out by hand, for
each figure and period.

**Acceptance Scenarios**:

1. **Given** a rider with a 42.7 km ride and 380 m and a 9.9 km ride with 120 m in the
   season, both otherwise counting, **When** anyone looks at the season, **Then** the
   rider has 1 session, 42.7 km and 380 m.
2. **Given** a 79 km ride, **When** it counts, **Then** it adds 79 km, not the 70 km
   its Training Rynke are worked out from.
3. **Given** a ride that doesn't count for Training Rynke (for example an e-bike ride,
   a manual entry, too long a pause, or the shorter of two overlapping recordings),
   **When** the figures are shown, **Then** it is in none of them.
4. **Given** the ranking by kilometres, **When** the rider switches to sessions,
   **Then** the order and places follow sessions.
5. **Given** the season, **When** the rider switches to the week, **Then** only
   counting rides that started this week, in the rider's time zone, are in the
   figures.
6. **Given** two riders with the same figure of the picked kind, **When** they are
   ranked, **Then** they share the place and the next place is skipped.
7. **Given** the top three places, **When** they are shown, **Then** they carry
   🥇🥈🥉.

---

### User Story 2 - Organisers see the ranking with names (Priority: P1)

An organiser sees the same ranking with every rider's first name, so they can see who
is riding and who has gone quiet.

**Why this priority**: The second team's organisers asked for the list to follow
their riders' training.

**Independent Test**: Sign in as a synthetic organiser and check every row carries the
rider's first name and the same figures riders see; sign in as a rider and check no
other row carries a name.

**Acceptance Scenarios**:

1. **Given** an organiser, **When** they open the ranking, **Then** every row shows
   the rider's first name.
2. **Given** two riders named Jonas, **When** the organiser looks, **Then** each
   carries a "View on Strava" link, as on the organiser overview.
3. **Given** a rider with no counting ride in the period, **When** the organiser
   looks, **Then** the rider is listed with zeros at the end.

---

### User Story 3 - The team's figures (Priority: P2)

Above the ranking, everyone sees the team's combined sessions, kilometres and
elevation for the picked period, and a chart of the team's kilometres per day of the
current month or per week of the season.

**Why this priority**: The team figures add to the list, but the list works without
them.

**Independent Test**: Compare the team totals and the chart with sums of the
synthetic riders' counting rides.

**Acceptance Scenarios**:

1. **Given** consenting riders, **When** anyone looks, **Then** each team total is
   the sum of the rows.
2. **Given** a rider without a consent covering the feature (FR-017), **When** anyone
   looks, **Then** their rides are in no total, bar, row or count.

---

### User Story 4 - A team switches the feature on or off (Priority: P1)

A maintainer turns the ride stats leaderboard on or off for a team as team data.

**Why this priority**: The second team wants it; the founding team must see nothing
change until it decides to have it (feature 026 FR-020).

**Independent Test**: Run the app with the feature on and off and check pages, menus
and texts.

**Acceptance Scenarios**:

1. **Given** the feature off, **When** riders and organisers use the app, **Then** no
   page, menu entry, text or notification of it appears.
2. **Given** the feature on, **When** a rider opens the Team section, **Then** the
   ride stats view is one of its views.
3. **Given** the feature on and both Rynke views off for a team, **When** a rider
   opens the Team section, **Then** it shows the ride stats view without a switcher.

### Edge Cases

- **A ride of exactly 10 km** counts; 9.99 km doesn't.
- **A ride is edited or deleted on Strava**: the figures follow the next time it is
  evaluated (feature 003 FR-003), as Training Rynke do.
- **Unknown elevation** (feature 003 FR-005f): the ride counts as a session with its
  distance and adds 0 m.
- **A rider leaves**: they disappear from every ranking and total at once.
- **The first days of a month or week**, when nobody has ridden yet: the list shows
  every rider with zeros, ranked equal, and says nobody has ridden yet in that
  period.
- **Virtual rides** count like any other here; the one-third limit for qualifying
  (feature 003 FR-013a) is a Rynke rule and doesn't apply.
- **Team events** add nothing here unless the rider recorded the ride on Strava;
  then the ride counts as any ride does.
- **Organiser corrections** of Rynke (feature 003 FR-010) change no ride figure.
- **The season end or qualification deadline** (feature 003 FR-011): rides after it
  count for nothing, as for Rynke.

## Requirements *(mandatory)*

### Functional Requirements

**What counts**

- **FR-001**: A ride MUST count for the ride stats exactly when it counts for Training
  Rynke under the team's rules in effect (feature 003 FR-005 to FR-005g, FR-011), and
  its distance is at least the team's minimum distance for ride stats (10 km for
  Team Rynkeby Europe).
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

**The ranking**

- **FR-006**: The ranking MUST list every rider of the team with a consent covering
  the feature (FR-017), including riders with zeros, ordered by the picked figure,
  highest first, with standard competition places (equal figures share a place, the
  next is skipped). Riders with equal figures appear in a stable order that names no
  one (for example by connection date).
- **FR-007**: The viewer MUST be able to pick the figure (sessions, kilometres,
  elevation) and the period (season, current month, current week). The default is
  kilometres for the season. The choice MAY be remembered on the device.
- **FR-008**: Each row MUST show place, sessions, kilometres and elevation, the picked
  figure emphasised; the top three places carry 🥇🥈🥉. The viewer's own row MUST be
  marked as theirs, and their place and figures MUST also be shown above the list.
- **FR-009**: The ranking MUST NOT offer a period shorter than a week per rider.
- **FR-010**: Above the ranking, the team's totals of sessions, kilometres and
  elevation for the picked period MUST be shown, with a chart of the team's
  kilometres per day (month) or per week (season); the week shows per-day bars.
- **FR-011**: The ranking is a list, not a game: it MUST NOT add badges, quotes,
  notifications or nudges of its own. Whether those of other features appear is up to
  their own switches (feature 026 FR-018).

**Team data**

- **FR-012**: Whether the feature is on and its minimum distance MUST be team data
  (feature 026 FR-016 to FR-018). Code MUST NOT branch on a team's name.
- **FR-013**: For the founding team the feature MUST be off until its organisers ask
  for it, so its pages stay as they are (feature 026 FR-020).
- **FR-014**: The Team section MUST offer the ride stats view next to the Rynke views
  the team has on; with only one view, it MUST show no switcher.

**Who sees what**

- **FR-015**: The visibility table of feature 004 FR-020 MUST gain this row:

  | Data about a rider | The rider | Organisers | Other riders |
  |---|---|---|---|
  | Sessions, kilometres and elevation gain per season, month and week, in a ranking row | yes | yes, with first name | yes, without a name |

  A row shown to other riders MUST NOT carry a name, athlete ID, profile link, picture
  or anything else that names the rider, and no team setting may change that. Rides,
  ride dates and any figure per day of a single rider stay visible to that rider
  only. Visitors who are not signed in MUST see nothing.
- **FR-016**: A rider without a consent covering the feature MUST be left out of every
  figure shown to anyone else (feature 004 FR-021); they MUST still see their own
  figures and place-free totals.

**Consent** (see Open points)

- **FR-017**: The consent text MUST name the ride stats ranking and who sees it.
  A team that switches the feature on after riders connected MUST raise its consent
  version and ask riders again at their next sign-in (feature 004 FR-013); until a
  rider accepts, FR-016 applies to them. A team whose first consent version names the
  feature asks nobody again.
- **FR-018**: The privacy notice (feature 017) MUST describe the ranking for every
  team with the feature on.

**Text**

- **FR-019**: All text of this feature MUST be in the catalogs in every language the
  team offers (FR-028 of the app); Team Rynkeby Europe's default is English.

### Key Entities

- **Ride stats figures**: per rider and period (season, month, week, and per day for
  team totals), the number of counting rides, their summed distance and elevation
  gain. Derived from ride results, never edited by hand.
- **Team settings for ride stats**: on or off, and the minimum distance.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a synthetic season, every rider's sessions, kilometres and elevation
  match a hand count of their counting rides of 10 km and more, for every period.
- **SC-002**: A rider finds their place for any figure and period in at most two taps
  from the Team section.
- **SC-003**: With the feature off, the founding team's pages are unchanged
  (screenshots and tests before and after match).
- **SC-004**: No figure of a rider without a covering consent appears in any view for
  anyone else, checked with a synthetic rider who hasn't accepted.
- **SC-005**: The ranking for 200 riders loads as fast as today's Rynke leaderboard.

## Assumptions

- The figures are what the second team needs; Rynke, badges and quotes for that team
  are decided in feature 026 and are independent of this feature.
- "Training session" means a counting ride; attendance at a team event without a
  recorded ride is not a session.
- The minimum distance applies only to ride stats; Training Rynke keep their own rule
  (a ride under 10 km already earns no distance Rynke, but its elevation still counts
  for the founding team).
- The data the figures need (distance, elevation, start date, eligibility) is already
  stored for Training Rynke; nothing new is read from Strava.
- Talking to Strava about showing these figures is handled outside this feature.
- The look follows the existing Team section (features 012, 016, 022); a design draft
  may follow before planning.
