# Feature Specification: Badges and Achievements

**Feature Branch**: `013-badges-achievements`

**Created**: 2026-10-08

**Status**: Draft

**Input**: GitHub issue #51 "Make app more fun": "add badges/achievements (new tab)".
Reworked by the project owner on 2026-10-11: "Badges are a section on the personal
page. There could also be team badges (more than x riders on a training, more than
x Rynke). I also want badges for running activities on Strava. They don't count
towards Rynke, they just give badges. Count every full kilometre of running per
activity. Show progress until the next badge. Badges shall be a surprise: don't
show what the other badges of a category are, just show the progress until the
next one."

## Clarifications

### Session 2026-10-11

- Q: A new tab, or part of an existing page? → A: A section on the rider's own
  page ("Du"), not a fifth tab. Supersedes the draft's FR-001.
- Q: Are badges only personal? → A: No. Besides the rider's own badges there are
  team badges the whole team earns together, such as a team training with many
  riders or the team reaching a number of Rynke.
- Q: Do runs count? → A: Runs give badges of their own and never Rynke. Each run
  counts its full kilometres, rounded down per run (a 7.8 km run counts 7 km).
- Q: Does the rider see the badges still to earn? → A: No, they are a surprise.
  Per category the rider sees only how far they are from the next badge, never its
  name, picture or the badges after it. Supersedes the draft's "earned and locked"
  list (old FR-002).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See my badges on my page (Priority: P1)

A rider opens their own page and finds a "Badges" section. It shows the badges they
have earned, each with its picture, name, what it was for and the date they earned
it. Below them, every category shows a progress bar towards its next badge ("noch
12 km"), without naming the badge or showing its picture.

**Why this priority**: The section is the feature; without it no badge is visible,
and the progress towards the next surprise is what brings riders back.

**Independent Test**: Open the rider page for sample riders (`pnpm dev`) with no
badges, a few badges and every badge of a category.

**Acceptance Scenarios**:

1. **Given** a rider whose rides add up to their first 100 km, **When** they open
   their page, **Then** the Badges section shows that badge as earned, with the
   date of the ride that reached 100 km.
2. **Given** a rider with 412 km in the distance category whose next badge is at
   500 km, **When** they open their page, **Then** the distance category shows
   progress 412 of 500 km and "noch 88 km", and nothing about what the badge is
   or which badges follow.
3. **Given** a rider who has earned the last badge of a category, **When** they open
   their page, **Then** that category shows no further progress bar and no hint that
   it was the last.
4. **Given** a rider with no badge yet, **When** they open their page, **Then** the
   section shows an encouraging empty state and the progress of every category.
5. **Given** a rider still in feature 015's waiting state, **When** they open their
   page, **Then** no Badges section is shown until their first data arrives.

---

### User Story 2 - Earning a badge (Priority: P1)

When a ride, a run, a team event or an organiser correction earns a badge, the
rider learns about it: a short celebration on their next visit, and in feature
010's notification if notifications are on.

**Why this priority**: The surprise of a new badge is what makes it fun, and badges
that are awarded twice or never taken back would make them meaningless.

**Independent Test**: Give a sample rider a ride that crosses a badge threshold,
evaluate it twice, then make it stop counting.

**Acceptance Scenarios**:

1. **Given** a ride that earns a badge, **When** it is evaluated, **Then** the badge
   is stored once with the ride's date, also when the ride is evaluated again.
2. **Given** a newly earned badge, **When** the rider next opens their page, **Then**
   the badge is revealed once with a celebration (honouring reduced motion, as in
   feature 012), and not again on later visits.
3. **Given** a rider with notifications on, **When** an evaluation earns them a
   badge, **Then** the notification they get for that evaluation names the new badge.
4. **Given** a ride that earned a badge stops counting (deleted, made private
   without read-all consent, or excluded by a rule), **When** it is evaluated again,
   **Then** the badge is taken back if the rider no longer meets it, without a
   notification.

---

### User Story 3 - Running badges (Priority: P2)

A rider who also runs gets running badges for the full kilometres of their runs.
Runs never appear among their rides and never change their Rynke.

**Why this priority**: Many riders run in the off-season; badges reward that
without bending the Rynke rules.

**Independent Test**: Give a sample rider runs of 7.8 km and 4.6 km and a ride;
check the running category shows 11 km and the Rynke and ride list are unchanged.

**Acceptance Scenarios**:

1. **Given** runs of 7.8 km and 4.6 km, **When** they are evaluated, **Then** the
   running category counts 11 km (7 + 4).
2. **Given** a run, **When** it is evaluated, **Then** the rider's Training Rynke,
   Team Rynke, ride list and team leaderboard are exactly as without it.
3. **Given** a rider who connected before this feature, **When** it is released,
   **Then** their runs since the season start are picked up without the rider doing
   anything.
4. **Given** a run entered manually on Strava, **When** it is evaluated, **Then** it
   counts no kilometres.

---

### User Story 4 - Team badges (Priority: P2)

Every rider also sees the team's badges, earned by the team together: for example a
team training attended by at least 10 riders, or the team's Rynke reaching 5,000.
Like personal badges, team badges are a surprise; the team categories show only the
progress towards the next one.

**Why this priority**: Team Rynkeby is a team; shared goals make riders pull others
along. It builds on the personal badges.

**Independent Test**: Record attendance of 10 sample riders at one team training and
check every rider's page shows the team badge with the training's date.

**Acceptance Scenarios**:

1. **Given** an organiser records the 10th rider at a team training, **When** the
   attendance is evaluated, **Then** the team badge "10 riders at one training" is
   earned with that training's date and every rider sees it in the team group of
   their Badges section.
2. **Given** the team's combined Training Rynke is 4,210 and the next team badge is
   at 5,000, **When** a rider opens their page, **Then** the team category shows
   "noch 790" and nothing about the badge itself.
3. **Given** riders without a current consent, **When** team badges are worked out,
   **Then** those riders count towards nothing (feature 004 FR-021).
4. **Given** a team badge earned before a rider connected, **When** that rider opens
   their page, **Then** they see it as the team's badge with its original date, and
   it is not celebrated as if they had just earned it.

### Edge Cases

- Recalculations after a rule change (feature 003) award or take back badges
  without notifying and without a celebration.
- A badge taken back and earned again is celebrated again only if it is earned on
  a later date than before.
- A rider who leaves loses their badges with their other data (Principle I); team
  badges are worked out again without them and may be taken back.
- One activity crossing two thresholds of a category (a first run of 22 km passes
  both 5 and 21 km) earns both badges, with the same date.
- The past-season import and feature 008's re-read award badges silently: a new
  rider's first visit shows their earned badges without one celebration per badge,
  only a single reveal of all of them.
- A run and a ride overlapping in time do not affect each other: runs are not part
  of feature 003's overlap rule (FR-005d).
- Activities of other sports (swim, walk, hike, e-bike rides) give no badges.
- Personal badges are the rider's own; other riders never see them (feature 004's
  visibility rules), unless a later feature decides otherwise.

## Requirements *(mandatory)*

### Functional Requirements

**Section and display**

- **FR-001**: The rider's own page ("Du") MUST get a "Badges" section below the
  Rynke figures. The app shell keeps its tabs; there is no Badges tab.
- **FR-002**: The section MUST show two groups, "Meine Badges" and "Team-Badges".
  Each lists its earned badges, newest first, with picture, name, what it was for
  and the date earned.
- **FR-003**: For each category not yet complete (except Tour, FR-010), the group
  MUST show the progress towards the next badge only: current value, the value
  needed and what is still missing, in that category's unit. It MUST NOT show the next badge's name or
  picture, nor any badge after it, nor how many badges a category has.
- **FR-004**: A category whose last badge is earned MUST show no progress and no
  sign that it is complete.
- **FR-005**: The section MUST NOT show while feature 015's waiting state is shown.

**Categories (first set)**

- **FR-010**: Personal categories MUST be:
  - Distance: the season total of kilometres of rides that count for Training Rynke
    (feature 003).
  - Longest ride: the longest single counting ride of the season.
  - Elevation: the season total of elevation gain of counting rides.
  - Team events: the number of team events of any kind the rider attended.
  - Training Rynke: the rider's Training Rynke total.
  - Tour: a single badge for qualifying for the tour (feature 003 FR-013). It shows
    no progress bar of its own; the Overview already shows both targets.
  - Running: the season total of full kilometres of runs (FR-020).
- **FR-011**: Team categories MUST be:
  - Big training: the most riders at a single team event the season.
  - Team Rynke: the combined Training Rynke of all consenting riders.
- **FR-012**: Each category MUST be a ladder of thresholds; the first set is in
  Assumptions. Changing the ladders is a release, after which badges are worked out
  again under FR-031's silent rules.
- **FR-013**: A badge's date earned MUST be the date of the activity, team event or
  correction that first made the value reach its threshold.

**Runs**

- **FR-020**: Runs (Strava sport types Run, TrailRun and VirtualRun) from the
  season start MUST be kept with the minimum needed for badges: date, distance and
  whether they were entered manually. Each run counts its distance in full
  kilometres, rounded down per run; manual runs count 0.
- **FR-021**: Runs MUST NOT earn Rynke, appear in the ride list, take part in
  feature 003's ride rules (overlap, pause, speed) or show up anywhere other riders
  can see.
- **FR-022**: Runs since the season start of riders who connected before this
  feature MUST be picked up once after release, within the Strava request budget
  (Principle II), like feature 008's one-time re-read.
- **FR-023**: The consent text MUST name that runs are read and kept for the rider's
  own badges. As this keeps data the app already receives and shows it only to the
  rider, it needs no new consent version (constitution Principle I).

**Evaluation**

- **FR-030**: Badges MUST be a pure function of what features 001 and 003 store
  (rides, runs, team events, attendance, corrections) and be worked out again on
  every evaluation; evaluating the same data twice MUST NOT change anything
  (Principle II).
- **FR-031**: Newly earned personal badges MUST be revealed once per rider with a
  celebration, and named in feature 010's notification for that evaluation. Badges
  earned through an import, the one-time re-read or a rule recalculation MUST NOT
  notify and MUST be revealed together in one reveal.
- **FR-032**: Team badges MUST be worked out from consenting riders only and MUST
  NOT reveal which riders contributed. A team badge earned after a rider connected
  MUST be revealed once to that rider; it MUST NOT send notifications.

**Look and language**

- **FR-040**: Badge pictures MUST use the Rynke coin style (feature 012) and work in
  light and dark mode; the progress bars use feature 011's design tokens.
- **FR-041**: Names, what each badge was for, units and the empty state MUST come
  from the i18n catalogs in every language (FR-028).
- **FR-042**: The section MUST work at 360 px width and be readable with a screen
  reader: progress bars carry their values as text.

### Key Entities

- **Badge category**: a fixed definition: id, group (personal or team), unit, how
  its value is worked out, and its ladder of thresholds.
- **Badge**: one level of a category: category, threshold, name, picture.
- **Earned badge**: rider (or the team), badge, date earned, and whether it has been
  revealed to the rider.
- **Run**: rider, Strava activity, date, distance, manual or not. Never linked to
  Rynke.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A rider sees a newly earned badge on their next visit after the
  activity is evaluated.
- **SC-002**: Evaluating the same activity twice never awards or celebrates a badge
  twice.
- **SC-003**: No badge that is still to be earned can be identified from the page:
  its name and picture appear nowhere in what the rider page sends to the browser.
- **SC-004**: Adding any number of runs leaves every rider's Rynke, ride list and
  team leaderboard unchanged.
- **SC-005**: The Badges section works at 360 px width in both colour modes.

## Assumptions

- Features 003 (rides, team events, corrections), 004 (consent and visibility),
  010 (notifications), 011 (app shell), 012 (coin style and celebration) and 015
  (waiting state) exist.
- First ladders, to be confirmed with the organisers before release (thresholds
  only; names and pictures are written during planning):

  | Category        | Unit   | Thresholds                          |
  |-----------------|--------|-------------------------------------|
  | Distance        | km     | 100, 500, 1,000, 2,500, 5,000       |
  | Longest ride    | km     | 50, 100, 150, 200                   |
  | Elevation       | m      | 1,000, 5,000, 10,000, 25,000        |
  | Team events     | events | 1, 5, 10, 20                        |
  | Training Rynke  | Rynke  | 1, 100, 250                         |
  | Tour            | –      | qualified (feature 003 FR-013)      |
  | Running         | km     | 5, 21, 42, 100, 250                 |
  | Big training    | riders | 5, 10, 15, 20                       |
  | Team Rynke      | Rynke  | 1,000, 2,500, 5,000, 10,000         |

- The team category "Team Rynke" counts Training Rynke only, the kind on which the team leaderboard
  opens; Team Rynke from events is already covered by the team-events category.
- Badges belong to one season, like Rynke; a new season starts every category at
  zero.
- The team group lives on each rider's own page next to their personal badges; the
  Team tab stays as feature 016 defines it.
- Distance-type progress is shown in whole units, rounded down, so "noch 0 km" never
  appears for a badge not yet earned.
