# Feature Specification: Rynke Evaluation (Training Rynke and Team Rynke)

**Feature Branch**: `003-rynke-evaluation`

**Created**: 2026-10-06

**Status**: Draft

**Input**: User description: "Specify how Rynke coins work. There are 2 kinds,
'Trainings-Rynke' and 'Team-Rynke'. People need 250 Trainings-Rynke and 25
Team-Rynke to go with us on the Tour de Paris. Start a spec for the evaluation
algorithm that derives these two numbers." Rules as given by the team (sheet
"Rynke-Punkte"):

| Source                     | Team Rynke | Training Rynke |
|----------------------------|------------|----------------|
| Every 10 km ridden solo    | –          | 1              |
| Every 1000 m elevation gain| –          | 5              |
| 1 team training            | 1          | 5              |
| 1 day of training weekend  | 5          | 10             |
| Technique training         | 5          | 5              |
| **Needed for the tour**    | **25**     | **250**        |

## Clarifications

### Session 2026-10-06

- Q: Are the 10 km / 1000 m steps counted per ride or on season totals? → A: Per
  ride, rounded down. The team wants proper-length rides; leftovers are lost on
  purpose (a 79 km ride earns 7, not 7.9) and do not carry over to other rides.
- Q: How is team-event attendance decided? → A: An organiser records who was
  there. Rides are not matched to events automatically.
- Q: Do the km and elevation of a ride during a team event earn Training Rynke on
  top of the event's fixed amount? → A: Yes. Every stored ride earns distance and
  elevation Rynke; "solo" in the sheet does not exclude team rides.
- Q (raised by the project owner): How are rides kept from being merged or
  stretched over several days? → A: A ride whose paused time (elapsed time minus
  moving time) is more than half of its moving time earns no Rynke at all. This
  rules out recording the way to work and back as one ride, and recording a whole
  week as one ride.
- Q: Is "half the ride time" half of the elapsed time or half of the moving time?
  → A: Half of the moving time, the stricter reading (a hard limit): 4 h riding
  with 3 h of breaks does not count.
- Q: Is there an additional limit on a ride's total duration or on rides crossing
  midnight? → A: No. Long rides, including overnight rides, count as long as they
  pass the pause rule.
- Q (raised by the project owner): Can the rules change during the season? → A:
  Yes. Every rule change must be applied retroactively: all points of the season
  are recalculated under the new rules.

## User Scenarios & Testing *(mandatory)*

Terms: **Training Rynke** (German label "Trainingsrynke") reward riding volume;
**Team Rynke** (German label "Teamrynke") reward taking part in team events. A
**team event** is one of three kinds organised by the team: team training,
training weekend (counted per day), technique training. Together, a rider's two
totals are their **Rynke balance**.

### User Story 1 - Riders can read how Rynke work (Priority: P1, delivered first)

Before any evaluation exists, an organiser hands riders a short German document
(as PDF) that explains both kinds of Rynke, how each is earned, what the tour
needs, the deliberate per-ride rounding and the pause rule, with worked
examples. Riders know the rules before the app counts anything.

**Why this priority**: The rules must be known to riders now, independent of when
the evaluation ships, and writing them down plainly surfaces misunderstandings
before they are built in. It is the first phase of this feature.

**Independent Test**: Not covered by automated tests (FR-018). An organiser runs
the conversion, opens the PDF and checks it against this spec.

**Acceptance Scenarios**:

1. **Given** the rules handout in the repository, **When** an organiser runs the
   documented conversion command, **Then** a PDF of the handout is produced.
2. **Given** the handout and this spec, **When** a reviewer compares them, **Then**
   every rule value, threshold and example in the handout matches this spec.

---

### User Story 2 - Rides earn Training Rynke (Priority: P1)

A connected rider rides and uploads to Strava as usual. Every ride that reaches
RynkePoints adds to their Training Rynke: 1 for every full 10 km and 5 for every
full 1000 m of elevation gain of that ride. Leftovers below a full step are lost,
so a 79 km ride earns 7. A ride whose breaks add up to more than half of its
moving time (e.g. the way to work and back recorded as one ride) earns nothing.
When they edit or delete a ride on Strava, their Training Rynke follow.

**Why this priority**: Riding is where most of the 250 Training Rynke come
from, and it only needs the activity data the app already stores.

**Independent Test**: Feed a synthetic set of cycling activities for one rider into
the evaluation and compare the resulting Training Rynke with a hand-calculated
value.

**Acceptance Scenarios**:

1. **Given** a rider with one 100 km ride with 0 m elevation gain, **When** their
   balance is evaluated, **Then** they have 10 Training Rynke and 0 Team Rynke.
2. **Given** a rider with one 79 km ride with 1999 m elevation gain, **When** their
   balance is evaluated, **Then** they have 7 Training Rynke from distance and 5
   from elevation gain, 12 in total.
3. **Given** a rider with three rides of 7 km each, **When** their balance is
   evaluated, **Then** they have 0 Training Rynke from distance (leftovers of
   different rides are never added up).
4. **Given** a rider with two rides of 25 km each, **When** their balance is
   evaluated, **Then** they have 4 Training Rynke from distance, not 5.
5. **Given** an evaluated rider, **When** one of their rides is deleted or its
   distance changes on Strava, **Then** their Training Rynke are re-derived and
   reflect only their current rides.
6. **Given** a ride that started before the season start, **When** the balance is
   evaluated, **Then** that ride contributes nothing.
7. **Given** a 40 km commute recorded as one ride with 2 h moving time and 9 h
   elapsed time (7 h paused at work), **When** the balance is evaluated, **Then**
   that ride earns 0 Training Rynke.
8. **Given** a 150 km ride with 6 h moving time and 2 h paused, **When** the
   balance is evaluated, **Then** it earns 15 Training Rynke from distance as usual
   (2 h is less than half of 6 h).
9. **Given** a 100 km ride with 4 h moving time and 3 h paused, **When** the
   balance is evaluated, **Then** it earns 0 Training Rynke (3 h is more than half
   of 4 h).
10. **Given** a ride with 6 h moving time and exactly 3 h paused, **When** the
    balance is evaluated, **Then** it counts.
11. **Given** a 600 km overnight ride with 24 h moving time and 6 h paused,
    starting on one day and ending on the next, **When** the balance is evaluated,
    **Then** it earns 60 Training Rynke from distance as usual.

---

### User Story 3 - Team events earn Team Rynke and Training Rynke (Priority: P1)

The team runs team trainings, training weekends and technique trainings. After
each event an organiser records who was there. Every rider recorded gets the fixed
amount for that kind of event: 1 Team Rynke and 5 Training Rynke per team training,
5 Team Rynke and 10 Training Rynke per day of a training weekend, 5 Team Rynke and
5 Training Rynke per technique training. A ride recorded during the event still
earns its distance and elevation Rynke on top (Story 2).

**Why this priority**: Team events are the only source of Team Rynke; without them
no rider can ever qualify.

**Independent Test**: Record a set of team events and a rider's attendance at them,
evaluate, and compare both totals with a hand-calculated value.

**Acceptance Scenarios**:

1. **Given** a rider who attended 3 team trainings and nothing else, **When** their
   balance is evaluated, **Then** they have 3 Team Rynke and 15 Training Rynke.
2. **Given** a rider who attended both days of a two-day training weekend, **When**
   their balance is evaluated, **Then** they have 10 Team Rynke and 20 Training
   Rynke from it.
3. **Given** a rider who attended one technique training, **When** their balance is
   evaluated, **Then** they have 5 Team Rynke and 5 Training Rynke from it.
4. **Given** an organiser records the same rider for the same team event twice,
   **When** their balance is evaluated, **Then** that event counts once.
5. **Given** a rider recorded at a team training who also uploaded a 60 km ride
   with 1000 m elevation gain from it, **When** their balance is evaluated,
   **Then** they have 1 Team Rynke and 5 + 6 + 5 = 16 Training Rynke.
6. **Given** a rider who uploaded a ride during a team training but whom no
   organiser recorded as attending, **When** their balance is evaluated, **Then**
   the ride earns its distance and elevation Rynke but no Team Rynke and no event
   Training Rynke.

---

### User Story 4 - Rider sees their balance and whether they qualify (Priority: P2)

A connected rider opens their RynkePoints page and sees their Training Rynke and
Team Rynke, how far each is from what the tour needs (250 / 25), whether they
already qualify, and a breakdown of where their Rynke came from (distance,
elevation, each kind of team event).

**Why this priority**: The numbers only motivate if the rider can see them, but the
evaluation itself (Stories 2–3) can be verified without a page.

**Independent Test**: Sign in as a synthetic rider with known activities and
attendance and check the page shows the expected totals, remaining amounts,
qualification status and breakdown — and nobody else's data.

**Acceptance Scenarios**:

1. **Given** a rider with 260 Training Rynke and 20 Team Rynke, **When** they open
   their page, **Then** they see both totals, that 5 Team Rynke are still missing,
   and that they do not qualify yet.
2. **Given** a rider with at least 250 Training Rynke and at least 25 Team Rynke,
   **When** they open their page, **Then** they see that they qualify for the tour.
3. **Given** a rider with 400 Training Rynke and 0 Team Rynke, **When** they open
   their page, **Then** they do not qualify (surplus Training Rynke never replace
   Team Rynke, nor the other way round).
4. **Given** two connected riders, **When** one opens their page, **Then** they see
   only their own balance.

---

### User Story 5 - Rules change and every balance is recalculated (Priority: P2)

During the season the team decides to change the rules: an organiser changes a
value (e.g. 8 instead of 5 Training Rynke per 1000 m), or a new version of the app
changes how points are computed (e.g. a new kind of team event). Every rider's
balance for the whole season is recalculated from the stored rides, attendance and
corrections, as if the new rules had always applied. Riders see their new balance
and since when the current rules apply.

**Why this priority**: The rules come from a spreadsheet the team will keep
adjusting; a points system that cannot follow those changes for the whole season
would force manual corrections for every rider. Not needed to show the first
numbers, but needed before the first rule change.

**Independent Test**: Evaluate synthetic riders under one set of rules, change a
rule value and, separately, swap in a changed rule, and compare every balance with
a hand calculation under the new rules for the whole season.

**Acceptance Scenarios**:

1. **Given** a rider whose season rides include 3000 m of elevation gain in one
   ride, **When** an organiser changes the elevation reward from 5 to 8 Training
   Rynke per 1000 m, **Then** within 1 hour that ride counts 24 instead of 15
   Training Rynke, including for rides uploaded before the change.
2. **Given** balances computed under the current rules, **When** a new app version
   with changed rule logic goes live, **Then** every balance is recalculated with
   the new logic and none computed with the old rules is shown as current
   afterwards.
3. **Given** a rider with a correction, **When** their balance is recalculated
   after a rule change, **Then** the correction is applied unchanged and exactly
   once.
4. **Given** a rider who qualified, **When** a rule change lowers their totals below
   a threshold, **Then** they no longer qualify.
5. **Given** any state, **When** an organiser starts a full recalculation twice in
   a row, **Then** both runs produce identical balances.
6. **Given** a full recalculation of all riders, **When** it runs, **Then** it
   makes no request to Strava.

---

### User Story 6 - Organiser corrects a balance (Priority: P3)

An organiser needs to correct a rider's balance by hand, for example for a ride
that was recorded twice, or for team work the rules don't cover.
They add a correction of Training Rynke and/or Team Rynke with a short reason. The
correction stays in effect when the rider's balance is evaluated again.

**Why this priority**: Real life is messy, but the rules must work on their own
first. Required by constitution Principle III once corrections exist.

**Independent Test**: Add a correction for a synthetic rider, trigger a full
re-evaluation, and check the correction is still applied exactly once.

**Acceptance Scenarios**:

1. **Given** a rider with 240 Training Rynke, **When** an organiser adds a
   correction of +10 Training Rynke with a reason, **Then** the rider has 250
   Training Rynke and sees the correction and its reason in their breakdown.
2. **Given** a rider with a correction, **When** their whole balance is
   re-evaluated from scratch, **Then** the correction is applied exactly once.

---

### Edge Cases

- **Leftovers below a full step**: deliberately lost, per ride. A 79 km ride earns
  7, a 9.9 km ride earns 0, a 1999 m climb earns 5. Splitting one long ride into
  several uploads can therefore cost Rynke, and joining short rides into one does
  not happen automatically. This is intended: the team wants proper-length rides,
  not many short ones (see Clarifications).
- **Merged or stretched recordings**: a ride whose paused time is more than half
  of its moving time earns no Rynke at all, neither for distance nor for
  elevation. This covers commutes recorded as one ride with the working day in
  between, several rides recorded as one, and long rides with very long breaks.
  Duration itself is not limited: overnight and other very long rides count when
  they pass the pause rule. Splitting is therefore never
  rewarded (leftovers are lost, above) and merging is not either. Team-event Rynke
  are unaffected, since attendance does not depend on rides (FR-007).
- **Activity outside the counting window**: rides before the season start or after
  the qualification deadline (FR-011) earn nothing; a ride is placed by its start
  date in the rider's local time zone.
- **Changing an activity**: a ride whose distance, elevation or start date changes
  on Strava is re-evaluated; a ride that becomes non-cycling or is deleted stops
  counting (it is no longer stored, per feature 001).
- **Duplicate recordings**: the same ride uploaded twice (e.g. from a bike computer
  and a phone) is counted twice; the rider deletes the duplicate on Strava or an
  organiser corrects it (Story 6). Automatic duplicate detection is out of scope.
- **Virtual and e-bike rides**: count like any other stored cycling activity unless
  an organiser excludes those sport types (FR-012).
- **Zero values**: rides with 0 km or 0 m elevation gain contribute nothing for that
  part; this is never an error.
- **Team event deleted or changed**: Rynke from it disappear or follow the change
  on the next evaluation.
- **Rule or threshold change**: every rider's balance and qualification are
  recalculated for the whole season with the new rules (FR-021); nothing earned
  under the old rules is kept separately.
- **Rule change during a running recalculation**: the later rules win; the
  recalculation restarts or continues with them, and no balance ends up computed
  with the older rules.
- **Season start moved earlier**: rides before the old season start were never
  imported (feature 001). They only count after they have been imported, so
  moving the season start earlier needs a re-import first (FR-025).
- **New rule needs data that is not stored**: e.g. a rule based on average speed.
  It cannot take effect until that data is stored for every connected rider
  (FR-025); until then the old rules stay in effect.
- **Rider leaves and comes back**: when a rider's data is deleted (feature 001,
  FR-022) their balance, attendance and corrections are deleted with it; after
  reconnecting they start from what is imported again.
- **Qualifying, then dropping below**: a rider who qualified and then loses Rynke
  (deleted ride, removed attendance, rule change) no longer qualifies.
- **Negative corrections**: a correction may reduce a total, but neither total is
  ever shown below 0.

## Requirements *(mandatory)*

### Functional Requirements

**Evaluation**

- **FR-001**: The system MUST derive, for each connected rider, exactly two totals:
  Training Rynke and Team Rynke, both whole numbers ≥ 0.
- **FR-002**: The totals MUST be a pure, deterministic function of the rider's
  stored activities, their team-event attendance, organiser corrections and the
  rule configuration: evaluating the same inputs any number of times, in any order
  of arrival, MUST give the same totals, and re-evaluating all riders from scratch
  MUST give the same totals as the incremental updates did.
- **FR-003**: The totals MUST be re-derived whenever one of their inputs changes
  (an activity is stored, updated or removed; attendance, a team event, a
  correction, the rule configuration or the rule logic changes).

**Training Rynke from riding**

- **FR-004**: Each ride MUST earn, on its own, 1 Training Rynke per full 10 km of
  its distance and 5 Training Rynke per full 1000 m of its elevation gain, both
  rounded down per ride. Leftovers below a full step MUST be dropped and MUST NOT
  be added to other rides or to a season total (79 km → 7; three rides of 7 km →
  0; two rides of 25 km → 4). This is a deliberate rule, not a precision
  shortcut: it rewards proper-length rides over many short ones.
- **FR-005**: Only activities stored by feature 001 (cycling activities of the
  rider) count; other sports never earn Rynke.
- **FR-005a**: A ride whose paused time (elapsed time minus moving time) is more
  than half of its moving time MUST earn no Training Rynke, neither from distance
  nor from elevation gain. A ride paused for exactly half of its moving time still
  counts. The share of half is a rule value (FR-012). There MUST be no other limit
  on a ride's duration, and a ride spanning several calendar days MUST NOT be
  excluded for that reason alone.

**Team events**

- **FR-006**: Each team event MUST have a kind (team training, training-weekend
  day, technique training), a date and an optional name. A training weekend is
  recorded as one team event per day.
- **FR-007**: Attendance at a team event MUST be recorded by an organiser; the
  system MUST NOT derive attendance from rides. Each recorded attendance MUST earn
  the fixed amount for the event's kind: team training 1 Team Rynke + 5 Training
  Rynke; training-weekend day 5 Team Rynke + 10 Training Rynke; technique training
  5 Team Rynke + 5 Training Rynke. A rider MUST be credited at most once per team
  event, and attendance MUST NOT require a ride on Strava.
- **FR-008**: Rides MUST earn distance and elevation Training Rynke (FR-004)
  whether or not they took place during a team event; the event's fixed amount is
  added on top. The word "solo" in the team's sheet does not exclude team rides.
- **FR-009**: Team Rynke MUST only come from team-event attendance and organiser
  corrections; riding alone never earns Team Rynke.

**Corrections**

- **FR-010**: Organisers MUST be able to add a correction (signed amount of
  Training Rynke and/or Team Rynke, reason, date) to a rider. Corrections MUST be
  kept and applied on every evaluation, including full re-evaluations, until an
  organiser removes them (constitution Principle III).

**Season and configuration**

- **FR-011**: Only activities and team events from the season start date (feature
  001 Team Settings) up to and including the qualification deadline MUST count. If
  no deadline is set, everything from the season start counts.
- **FR-012**: The rule values (km and metres per step, Rynke per step, fixed amounts
  per event kind, the largest paused share of a counting ride), the thresholds
  (250 Training Rynke, 25 Team Rynke), the qualification deadline and any excluded
  cycling sport types MUST be organiser configuration, changeable without code
  changes.

**Qualification**

- **FR-013**: A rider qualifies for the tour exactly when their Training Rynke are
  at least the Training threshold **and** their Team Rynke are at least the Team
  threshold. Neither kind can make up for a shortfall in the other.

**Rider view**

- **FR-014**: A signed-in rider MUST be able to see their Training Rynke and Team
  Rynke, the amount still missing for each threshold, whether they qualify, and a
  breakdown by source: distance, elevation gain, each team-event kind (with the
  events attended), and corrections (with reasons). Rides that earned nothing
  because of FR-005a MUST be listed with that reason. The page MUST also show the
  date the current rules took effect.
- **FR-015**: A rider MUST only ever see their own balance; showing balances or
  qualification to other riders or organisers is out of scope for this feature.
- **FR-016**: All rider-facing text of this feature MUST come from translation
  strings in German and English, as in feature 001 (FR-028–FR-030); the German
  labels are "Trainingsrynke" and "Teamrynke".

**Rule changes and retroactive recalculation**

- **FR-021**: Every rule change, whether a configured value (FR-012) or the rule
  logic itself in a new version of the app, MUST apply retroactively to the whole
  counting window (FR-011): every balance is recalculated as if the new rules had
  always applied. Rules that only apply from a certain date are out of scope.
- **FR-022**: Recalculation MUST use only stored data (activities from feature
  001, team events, attendance, corrections, rules) and MUST NOT contact Strava.
  These inputs MUST be kept, not just the derived totals, for as long as the rider
  is connected, so that the whole season can be recalculated at any time.
- **FR-023**: The rules in effect MUST carry a version and the date they took
  effect, and every balance MUST record the rules version it was computed with.
  After any rule change the system MUST recalculate all balances automatically;
  once that is done (SC-006), no balance computed with an older version may be
  shown as current. While it runs, a rider's page MAY show the previous balance,
  marked as being recalculated.
- **FR-024**: Organisers MUST be able to start a full recalculation of all riders
  at any time, without code changes. Repeated runs on the same inputs MUST give
  identical balances (FR-002).
- **FR-025**: A rule change that needs activity data the app does not store, or
  activities it has not imported (e.g. after moving the season start earlier),
  MUST NOT take effect before that data has been added to feature 001's stored
  data and imported for every connected rider within Strava's limits (feature 001
  FR-021). Until then the previous rules stay in effect.
- **FR-026**: Recalculation MUST NOT change or remove organiser corrections
  (FR-010) or recorded attendance (FR-007); after a rule change an organiser
  reviews corrections and adjusts them by hand if needed.

**Rules handout**

- **FR-017**: The repository MUST contain a German rules handout for riders,
  written in Markdown, that explains Training Rynke and Team Rynke, every way to
  earn them with the current values, the per-ride rounding (FR-004) and the pause
  rule (FR-005a) with examples,
  attendance recording (FR-007), rides during team events (FR-008), the counting
  window (FR-011), corrections (FR-010) and the qualification rule (FR-013).
- **FR-018**: The repository MUST contain a script that converts the handout to a
  PDF with one command. The handout and the script are a seldom-used manual
  organiser task and need no automated tests.
- **FR-019**: This spec is authoritative. The handout is informational only; where
  they differ, the spec applies and the handout MUST be corrected. Whenever a rule
  in this spec or a configured value changes, the handout MUST be updated.
- **FR-020**: The handout is a static document outside the app. It is German only
  and is not part of the app's translation strings (FR-016 does not apply to it).

### Key Entities

- **Rynke Rules**: organiser configuration — km per distance step and Rynke per
  step, metres per elevation step and Rynke per step, fixed Team and Training
  Rynke per team-event kind, the largest paused share, the two thresholds, the
  qualification deadline, and excluded cycling sport types. Carries a version and
  the date it took effect, covering both configured values and rule logic.
- **Team Event**: an event organised by the team — kind, date, optional name.
  Belongs to the team, not to a rider.
- **Attendance**: links a Rider to a Team Event they took part in, as recorded by
  an organiser; at most one per Rider and Team Event. Deleted with the Rider.
- **Correction**: a signed manual adjustment of a Rider's Training and/or Team
  Rynke with reason and date, entered by an organiser. Deleted with the Rider.
- **Rynke Balance**: the derived result for one Rider — Training Rynke, Team Rynke,
  qualification flag, breakdown by source and the rules version it was computed
  with. Can always be recomputed from the entities above plus the Rider's
  activities (feature 001); deleted with the Rider.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a reference set of at least 20 hand-calculated synthetic riders
  covering every rule, rounding case, window boundary and correction, 100% of
  evaluated totals and qualification flags match the hand calculation.
- **SC-002**: A full re-evaluation of all riders from scratch produces exactly the
  same totals as the balances kept up to date incrementally.
- **SC-003**: Replaying any recorded sequence of activity notifications, attendance
  changes and corrections (including duplicates and reordering) produces the same
  balance as applying the final state once.
- **SC-004**: Under normal conditions, a new ride is reflected in the rider's
  balance within 5 minutes of being uploaded to Strava (as feature 001 SC-002).
- **SC-005**: A rider can tell from their page in one look whether they qualify and
  how many Training and Team Rynke they are still missing.
- **SC-006**: After any rule change (a configured value or a new app version with
  changed rule logic), every rider's balance for the whole season reflects the
  new rules within 1 hour, and no balance computed with older rules is shown as
  current after that.
- **SC-007**: A full recalculation of all riders for a whole season makes zero
  requests to Strava and gives the same result every time it is run.

## Assumptions

- Builds on feature 001: riders, their stored cycling activities (distance,
  elevation gain, moving time, elapsed time, start date and time zone, sport type)
  and the season start date already exist. Elapsed time was added to feature 001
  (its FR-013) for FR-005a; it comes with the activity data the app already
  fetches and is the minimum needed to compute points (constitution Principle I).
- The goal is the Tour de Paris of the current season; one season is evaluated at
  a time. History across seasons is out of scope.
- Organisers maintain team events, attendance, corrections and rule configuration
  the same way as Team Settings in feature 001, through the app's deployment
  configuration or data; an organiser admin page is out of scope.
- There is no upper limit on Rynke per ride, per day or per week, since the sheet
  states none.
- Rule changes are rare (a few per season) and announced to riders beforehand;
  the handout is updated with them (FR-019). A history of past balances under old
  rules is not kept.
- A later feature that writes points into Strava activity descriptions will have
  to update those descriptions after a recalculation, within Strava's limits;
  that is its concern, not this feature's.
- Organisers seeing riders' balances or a list of who qualified, team
  leaderboards, and writing the balance into Strava activity descriptions are
  separate features: each needs its own consent handling under constitution
  Principle I and Strava's API Agreement.
- Because attendance is recorded by hand, a forgotten entry means missing Team
  Rynke until an organiser adds it; riders can check their breakdown (FR-014) and
  ask. Automatic matching of rides to events can be added later as a separate
  feature.
