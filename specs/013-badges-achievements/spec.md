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
  (Rounding superseded, see below.)
- Q: Does the rider see the badges still to earn? → A: No, they are a surprise.
  Per category the rider sees only how far they are from the next badge, never its
  name, picture or the badges after it. Supersedes the draft's "earned and locked"
  list (old FR-002).
- Q: Where do team badges show? → A: In their own group, apart from the rider's
  own badges ("Team-Abzeichen", see below).
- Q: What is a team badge? → A: A badge the whole team works on together: amounts
  the team collects together and participation in team activities. A team badge
  is never one rider's achievement.
- Q: Which runs count? → A: Outdoor runs only. Virtual runs and treadmill runs count
  nothing.
- Q: What is "Team Rynke" as a badge category? → A: Dropped: the name clashed with
  feature 003's Team Rynke (the Rynke kind earned at team events). The team's
  amount category is "Training Rynke together" (FR-011).
- Q (raised by the project owner): Are run kilometres still rounded down per run?
  → A: No. The running category counts the overall kilometres of all runs; no
  metre is lost (runs of 7.8 km and 4.6 km make 12.4 km).
- Q (raised by the project owner): Is there a badge for qualifying for the tour?
  → A: No. Who goes on the tour is a decision people make, not a badge. The Tour
  category is dropped.
- Q (raised by the project owner): Is there a badge for the longest ride? → A: No,
  the category is dropped.
- Q (raised by the project owner): Which running badges? → A: Two categories: the
  longest single run, up to marathon distance as the highest badge, and the
  overall kilometres of all runs.
- Q (raised by the project owner): What does the team's Rynke category count? →
  A: Training Rynke, collected by the whole team together ("Training Rynke
  together"), with more thresholds than the first draft.
- Q (raised by the project owner): Do team totals of kilometres, elevation and
  running kilometres need a new consent version? → A: No. They are sums over the
  whole team that show no single rider's figures, covered by the consent to show
  points to the team. They are part of this feature.
- Q (raised by the project owner): How are badges drawn? → A: Placeholders first,
  real pictures later. A fixed badge frame (one for personal, one for team badges)
  with Rynke from the coin as the reference; each badge's picture is generated
  with Gemini from a prompt plus that reference, then traced like the rider-state
  illustrations.
- Q (raised by the project owner): How large are badges shown? → A: A category's
  highest earned badge is shown larger than its earlier ones; pointing at any
  earned badge shows it large (FR-002a, FR-002b).
- Q (raised by the project owner): How is the milestone shown as text? → A: On a
  ribbon across the lower edge of the badge, in the ring's colour; the ribbon is
  part of the frame, its text comes from the page (translated, crisp, readable by
  screen readers), never from the image. Small gallery badges have no ribbon; the
  value is written below them.
- Q (raised by the project owner): How does the section look on a phone, with many
  badges? → A: As in the drafts `drafts/abzeichen-mobile.png` and
  `drafts/abzeichen-desktop.png`: per group the newest badge of each category as
  a card, every earned badge in a collapsible gallery below, categories without
  a badge as slim progress bars. The pictures are fun, so all of them stay one
  tap away.
- Q (raised by the project owner): What is the section called? → A: "Abzeichen"
  in German ("Meine neuesten Abzeichen", "Alle meine Abzeichen", "Team-Abzeichen",
  "Alle Team-Abzeichen", "Noch kein Abzeichen"); the progress line reads "Noch
  1.500 km", and one line under the heading explains the surprise once.
- Q (raised by the project owner): Which colour do the progress bars have? → A:
  Personal categories yellow, team categories the team blue of their frame.
- Q (raised by the project owner): Are badge names translated? → A: No. Names are
  German only, in every app language, kept in one German-only list like the Team
  page's quotes; the rest of the section's text is translated as usual.
- Q (raised by the project owner): Is there a badge for technique training? → A:
  Yes, a personal category with two badges: one for attending one of the season's
  two planned technique trainings, one for attending both.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See my badges on my page (Priority: P1)

A rider opens their own page and finds the "Abzeichen" section
([mobile](drafts/abzeichen-mobile.png), [desktop](drafts/abzeichen-desktop.png)).
"Meine neuesten Abzeichen" shows one card per category with its newest badge,
the milestone on the badge's ribbon and a progress bar towards the next badge
("Noch 1.500 km"), without naming that badge or showing its picture. Below, a
collapsible gallery holds every badge they have earned, to look at again; any
badge opens large with its name, what it was for and the date.

**Why this priority**: The section is the feature; without it no badge is visible,
and the progress towards the next surprise is what brings riders back.

**Independent Test**: Open the rider page for sample riders (`pnpm dev`) with no
badges, a few badges and every badge of a category.

**Acceptance Scenarios**:

1. **Given** a rider whose rides add up to their first 100 km, **When** they open
   their page, **Then** the distance card shows that badge with "100 km" on its
   ribbon, and opening it shows the date of the ride that reached 100 km.
2. **Given** a rider with 412 km in the distance category whose next badge is at
   500 km, **When** they open their page, **Then** the distance category shows
   progress 412 of 500 km and "Noch 88 km", and nothing about what the badge is
   or which badges follow.
3. **Given** a rider who has earned the last badge of a category, **When** they open
   their page, **Then** that category's card shows no progress bar and no hint that
   it was the last.
4. **Given** a rider with no badge yet, **When** they open their page, **Then** the
   section shows an encouraging empty state and every category under "Noch kein
   Abzeichen" with its progress.
5. **Given** a rider still in feature 015's waiting state, **When** they open their
   page, **Then** no Abzeichen section is shown until their first data arrives.
6. **Given** a rider with the 100 and 500 km distance badges, **When** they open
   their page, **Then** the distance card shows the 500 km badge; **When** they
   open "Alle meine Abzeichen", **Then** both badges are there under "Distanz",
   newest first, with "500 km" and "100 km" below them.
7. **Given** any earned badge, card or gallery, **When** the rider hovers over it,
   focuses it with the keyboard or taps it, **Then** it shows large with its
   ribbon, name, what it was for and its date; **When** they move away or tap
   again, **Then** it closes.
8. **Given** cards for a distance badge earned in May and a running badge earned in
   June, **When** the rider opens their page, **Then** the running card comes
   first.

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

A rider who also runs gets running badges in two categories: the length of their
longest single run, up to marathon distance, and the overall kilometres of all
their runs. Runs never appear among their rides and never change their Rynke.

**Why this priority**: Many riders run in the off-season; badges reward that
without bending the Rynke rules.

**Independent Test**: Give a sample rider runs of 7.8 km and 4.6 km and a ride;
check the running category counts 12.4 km and the Rynke and ride list are
unchanged.

**Acceptance Scenarios**:

1. **Given** runs of 7.8 km and 4.6 km, **When** they are evaluated, **Then** the
   running category counts 12.4 km, shown as 12 km.
1a. **Given** runs of 9.6 km and then 0.5 km, **When** the second is evaluated,
   **Then** the overall-running badge for 10 km is earned with the second run's
   date.
1b. **Given** a first run of 10.4 km, **When** it is evaluated, **Then** the
   run-length badges for 5 km and 10 km and the overall-running badge for 10 km
   are earned with its date.
1c. **Given** a rider whose longest run is 21.3 km, **When** they open their page,
   **Then** the run-length category shows the progress towards marathon distance
   (42.2 km), as long as the marathon badge is not earned.
2. **Given** a run, **When** it is evaluated, **Then** the rider's Training Rynke,
   Team Rynke, ride list and team leaderboard are exactly as without it; only the
   running categories (the rider's own and "Running together") change.
3. **Given** a rider who connected before this feature, **When** it is released,
   **Then** their runs since the season start are picked up without the rider doing
   anything.
4. **Given** a run entered manually on Strava, **When** it is evaluated, **Then** it
   counts no kilometres.
5. **Given** a virtual run or a run Strava marks as on a treadmill, **When** it is
   evaluated, **Then** it counts no kilometres.

---

### User Story 4 - Team badges (Priority: P2)

Every rider also sees the team's badges under "Team-Abzeichen", laid out like
their own: newest per category, the gallery collapsed below, in the team blue. The whole team
works on them together, through amounts it collects together (the team's Rynke
reaching 5,000) and through taking part in team activities (10 riders at one team
training, 100 attendances at team events over the season). Like personal badges,
team badges are a surprise; the team categories show only the progress towards the
next one.

**Why this priority**: Team Rynkeby is a team; shared goals make riders pull others
along. It builds on the personal badges.

**Independent Test**: Record attendance of 10 sample riders at one team training and
check every rider's page shows the team badge with the training's date.

**Acceptance Scenarios**:

1. **Given** an organiser records the 10th rider at a team training, **When** the
   attendance is evaluated, **Then** the team badge "10 riders at one training" is
   earned with that training's date and every rider sees it under
   "Team-Abzeichen".
2. **Given** the team has collected 4,210 Training Rynke together and the next team
   badge is at 5,000, **When** a rider opens their page, **Then** the "Training
   Rynke together"
   category shows "noch 790" and nothing about the badge itself.
3. **Given** riders have attended team events 92 times this season and the next
   team badge is at 100, **When** a rider opens their page, **Then** the
   attendance category shows "noch 8".
4. **Given** riders without a current consent, **When** team badges are worked out,
   **Then** those riders count towards nothing (feature 004 FR-021).
5. **Given** a team badge earned before a rider connected, **When** that rider opens
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
  5 km, 10 km and half-marathon length) earns all of them, with the same date.
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

The drafts [drafts/abzeichen-mobile.png](drafts/abzeichen-mobile.png) (360 px)
and [drafts/abzeichen-desktop.png](drafts/abzeichen-desktop.png) (1100 px) show
the layout these requirements describe; their pictures are placeholders and
their badge names examples.

- **FR-001**: The rider's own page ("Du") MUST get an "Abzeichen" section below
  the Rynke figures, mobile first. The app shell keeps its tabs; there is no
  Abzeichen tab. One line under the heading explains the surprise once ("Wie weit
  es noch bis zum nächsten Abzeichen ist – welches es wird, bleibt geheim.").
- **FR-002**: The section MUST show the rider's own badges first, then the team's,
  each group in three parts:
  - **newest**: one card per category with an earned badge ("Meine neuesten
    Abzeichen", "Team-Abzeichen"): category name, the category's highest earned
    badge with its ribbon (FR-040b), and the progress towards the next badge
    (FR-003). Cards are ordered by the date that badge was earned, newest first;
    two per row on a phone, more on wider screens (four at 1100 px).
  - **all**: a collapsible gallery of every earned badge of the group ("Alle
    meine Abzeichen (14)", "Alle Team-Abzeichen (5)", with the count), closed by
    default, grouped by category, newest first within a category, with the
    milestone written below each badge. Three per row on a phone. Every
    category of the group is in it, also one without a badge yet: after a
    category's earned badges, each badge of that category still to earn is an
    empty dotted outline of the same size, without name, picture or text
    (issue #109).
  - **not yet**: every category without an earned badge as one slim progress bar
    with its name and what is missing, under "Noch kein Abzeichen" (one list for
    both groups, after the team badges).
- **FR-002a**: Badge sizes: 128 px on a card, with its ribbon; 96 px in the
  gallery, without a ribbon.
- **FR-002b**: Pointing at an earned badge, on a card or in the gallery, MUST
  show it at 280 px with its ribbon, name, what it was for and the date earned:
  on hover with a mouse, on keyboard focus, and on tap on a touch screen
  (another tap or tapping elsewhere closes it). It MUST stay within the screen
  at 360 px width and not cover the badge pointed at on wider screens.
- **FR-002c**: Progress bars MUST be yellow for personal categories and the team
  blue of the team frame for team categories.
- **FR-003**: For each category not yet complete, the group
  MUST show the progress towards the next badge only: a bar for the current value
  against the value needed, and what is still missing in that category's unit
  ("Noch 1.500 km", "Noch 5 Fahrer"). It MUST NOT show the
  next badge's name or picture, nor any badge after it. Only the gallery's empty
  outlines (FR-002) tell how many badges a category has.
- **FR-004**: A category whose last badge is earned MUST keep its card, without a
  progress bar and without a sign that it is complete.
- **FR-005**: The section MUST NOT show while feature 015's waiting state is shown.

**Categories (first set)**

- **FR-010**: Personal categories MUST be:
  - Distance: the season total of kilometres of rides that count for Training Rynke
    (feature 003).
  - Elevation: the season total of elevation gain of counting rides.
  - Team events attended: the number of team events of any kind the rider
    attended.
  - Technique training: the number of technique trainings (feature 003 FR-006)
    the rider attended; one badge for the first, one for both planned trainings.
  - Training Rynke: the rider's Training Rynke total.
  - Run length: the longest single run of the season (FR-020). Its highest badge
    is marathon distance (42.195 km).
  - Running: the season total of kilometres of runs (FR-020).
- **FR-011**: Team categories are worked on by the whole team together and MUST be:
  - Amounts collected together:
    - Training Rynke together: all Training Rynke the consenting riders collected
      this season, the team total feature 016 already shows.
    - Distance together: the kilometres of all counting rides of consenting riders.
    - Elevation together: the elevation gain of all counting rides of consenting
      riders.
    - Running together: the kilometres of all runs of consenting riders (FR-020).
  - Participation in team activities:
    - Big training: the most riders at a single team event of the season.
    - Attendances: how often riders attended team events this season, summed over
      all events: a team training with 12 riders and a training-weekend day with
      18 riders make 30 attendances. Where Big training rewards one well-attended
      event, Attendances rewards the team turning up again and again.
- **FR-014**: Team badges MUST show under "Team-Abzeichen" only, never among a
  rider's own badges, and MUST NOT be credited to a single rider.
- **FR-012**: Each category MUST be a ladder of thresholds; the first set is in
  Assumptions. Changing the ladders is a release, after which badges are worked out
  again under FR-031's silent rules.
- **FR-013**: A badge's date earned MUST be the date of the activity, team event or
  correction that first made the value reach its threshold.

**Runs**

- **FR-020**: Outdoor runs (Strava sport types Run and TrailRun) from the season
  start MUST be kept with the minimum needed for badges: date and distance. Runs
  count their whole distance, added up over the season with no rounding per run.
  Runs entered manually count nothing and MUST NOT be kept.
- **FR-020a**: Virtual runs (VirtualRun) and runs Strava marks as indoor (treadmill)
  MUST count nothing and MUST NOT be kept. A run changed on Strava from indoor to
  outdoor, or back, MUST be added or removed on its next update.
- **FR-021**: Runs MUST NOT earn Rynke, appear in the ride list or take part in
  feature 003's ride rules (overlap, pause, speed). Other riders MUST NOT see any
  single run or a rider's running figures; runs reach them only inside the team
  sum "Running together" (FR-011).
- **FR-022**: Runs since the season start of riders who connected before this
  feature MUST be picked up once after release, within the Strava request budget
  (Principle II), like feature 008's one-time re-read.
- **FR-023**: The consent text MUST name that runs are read and kept for badges,
  and that ride and run kilometres and elevation count towards team sums. Per the
  project owner's decision (Clarifications), keeping data the app already receives
  and showing it to the team only as sums over all riders needs no new consent
  version (constitution Principle I).

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

- **FR-040**: Every badge MUST be drawn as the badge frame (personal or team) with
  its own picture in the frame's window, in the Rynke coin style (feature 012),
  working in light and dark mode; the progress bars use feature 011's design
  tokens.
- **FR-040a**: A badge without a picture of its own MUST show the frame with the
  coin's Rynke as a placeholder. Adding or replacing a picture MUST NOT change
  any badge's rules, ids or earned state.
- **FR-040b**: The frame MUST be able to carry a ribbon across its lower edge, in
  the ring's colour (black with yellow text for personal, team blue with dark
  text for team badges), with notched tails over the petals. The ribbon shape is
  part of the frame; the milestone on it ("1.000 km", "Halbmarathon") is page
  text from the catalogs, never part of the image. Pictures MUST keep the strip
  the ribbon covers free of anything important.
- **FR-041**: Badge names ("Wochenend-Krieger") MUST be German only and stay
  German in every app language: one list keyed by badge id, kept beside the
  catalogs in `src/i18n/messages/`, like feature 016's German-only quotes
  (`quotes.de.ts`). Everything else the section says (what each badge was for,
  the milestone on the ribbon, units, headings, the empty state) MUST come from
  the i18n catalogs in every language (FR-028).
- **FR-042**: The section MUST work at 360 px width and be readable with a screen
  reader: progress bars carry their values as text.

### Key Entities

- **Badge category**: a fixed definition: id, group (personal or team), unit, how
  its value is worked out, and its ladder of thresholds.
- **Badge**: one level of a category: category, threshold, German name, picture.
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
- **SC-004**: Adding any number of runs leaves every rider's Rynke, ride list, team
  leaderboard and every team badge except "Running together" unchanged.
- **SC-005**: The Abzeichen section works at 360 px width in both colour modes,
  without horizontal scrolling however many badges a rider has.

## Assumptions

- Features 003 (rides, team events, corrections), 004 (consent and visibility),
  010 (notifications), 011 (app shell), 012 (coin style and celebration) and 015
  (waiting state) exist.
- First ladders, to be confirmed with the organisers before release (thresholds
  only; names and pictures are written during planning):

  | Category                       | Unit        | Thresholds                                              |
  |--------------------------------|-------------|---------------------------------------------------------|
  | Distance                       | km          | 100, 500, 1,000, 2,500, 5,000                           |
  | Elevation                      | m           | 1,000, 5,000, 10,000, 25,000                            |
  | Team events attended           | events      | 1, 5, 10, 20                                            |
  | Technique training             | trainings   | 1, 2 (both planned)                                     |
  | Training Rynke                 | Rynke       | 1, 25, 50, 100, 150, 200, 250, 300, 400, 500            |
  | Run length                     | km          | 5, 10, half marathon (21.0975), marathon (42.195)       |
  | Running                        | km          | 10, 25, 50, 100, 250, 500                               |
  | Training Rynke together (team) | Rynke       | 500, 1,000, 2,500, 5,000, 7,500, 10,000, 15,000, 20,000 |
  | Distance together (team)       | km          | 1,000, 5,000, 10,000, 25,000, 50,000, 100,000           |
  | Elevation together (team)      | m           | 10,000, 50,000, 100,000, 250,000, 500,000               |
  | Running together (team)        | km          | 100, 500, 1,000, 2,500, 5,000                           |
  | Big training (team)            | riders      | 5, 10, 15, 20, 30                                       |
  | Attendances (team)             | attendances | 25, 50, 100, 200, 400                                   |

- Team sums show no single rider's figures. While very few riders run, "Running
  together" is close to those riders' own totals; this is accepted, since riders
  see no names or per-rider shares.
- The season has two planned technique trainings; should organisers plan more, the
  ladder changes with a release (FR-012).
- Badge pictures are made outside the app, with an image generator and the art
  pipeline in `art/badges/` (frames, prompts, generation script); the first
  release may ship with placeholders only.
- Badges belong to one season, like Rynke; a new season starts every category at
  zero.
- The team badges live on each rider's own page below the rider's own; the Team
  tab stays as feature 016 defines it.
- Run length progress and thresholds are shown with one decimal (21.1 km, 42.2 km);
  other distance-type progress is shown in whole units.
- Distance-type progress is rounded down, so "noch 0 km" never
  appears for a badge not yet earned.
