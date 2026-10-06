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
  (Superseded for elevation, see below.)
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
- Q (raised by the project owner): Is elevation gain also rounded per ride? → A:
  No. Elevation gain accumulates over the season; no metre is lost. The 1000 m
  step applies to the season total of all counting rides. Only distance keeps the
  per-ride rounding.
- Q (raised by the project owner): How is the pause rule presented to riders? → A:
  As a rule added to keep riders from gaming the system; the handout tells riders
  the team will adjust it should it lead to unfair situations.
- Q (raised by the project owner after the lazy-rider review,
  [lazy-rider.md](lazy-rider.md)): Which rides are excluded to keep riders from
  gaming the system? → A: Manual Strava activities, e-bike rides, rides that are
  implausibly slow or fast or climb implausibly fast (walks, cars, trains, lifts),
  and all but the largest of a rider's rides that overlap in time (the same ride
  recorded twice).
- Q (raised by the project owner): Do virtual rides count? → A: Yes, and their
  Rynke count normally, but at most one third of the Training Rynke needed to
  qualify may come from virtual rides; this is checked separately for
  qualification. Riders must set their real body weight in virtual-ride apps; the
  app cannot check it, so the handout appeals to riders' honesty.
- Q (raised by the project owner): Do indoor-trainer rides without a virtual-ride
  app count as virtual rides? → A: Yes. Any ride Strava marks as ridden on an
  indoor trainer counts towards the virtual-ride share, whatever its sport type.
  Feature 001 stores Strava's trainer flag for this.
- Q (raised by the project owner): Are the Rynke worked out each time they are
  shown, or stored? → A: Stored. What each ride earned (whether it counts, why
  not, its distance Rynke and the metres it adds to the elevation total) and each
  rider's season tally are stored and kept current. Elevation Rynke belong to the
  tally only, since elevation gain accumulates over the season.
- Q (raised by the project owner): Does this feature include the rider's page? →
  A: No. This feature computes and stores the numbers; showing them to riders is
  a separate feature that reads them.

## User Scenarios & Testing *(mandatory)*

Terms: **Training Rynke** (German label "Trainingsrynke") reward riding volume;
**Team Rynke** (German label "Teamrynke") reward taking part in team events. A
**team event** is one of three kinds organised by the team: team training,
training weekend (counted per day), technique training. Together, a rider's two
totals are their **Rynke balance**.

### User Story 1 - Riders can read how Rynke work (Priority: P1, delivered first)

Before any evaluation exists, an organiser hands riders a short German document
(as PDF) that explains both kinds of Rynke, how each is earned, what the tour
needs, the deliberate per-ride rounding of distance, the accumulated elevation
gain and the pause rule, with worked
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
RynkePoints adds to their Training Rynke: 1 for every full 10 km of that ride,
and its elevation gain adds to a season total that earns 5 for every full
1000 m. Distance leftovers below a full step are lost, so a 79 km ride earns 7;
elevation gain is never lost, so two rides of 500 m earn 5. A ride whose breaks
add up to more than half of its moving time (e.g. the way to work and back
recorded as one ride) earns nothing. So do manual entries, e-bike rides, rides
too slow or too fast to be bike rides, and second recordings of the same ride.
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
12. **Given** a rider with two rides of 600 m elevation gain each, **When** the
    balance is evaluated, **Then** they have 5 Training Rynke from elevation gain
    (1200 m in total; the remaining 200 m count towards the next 1000 m).
13. **Given** a rider with 1999 m elevation gain in one ride and 1 m in another,
    **When** the balance is evaluated, **Then** they have 10 Training Rynke from
    elevation gain.
14. **Given** a rider with 1500 m elevation gain from counting rides and a ride
    with 800 m that fails the pause rule, **When** the balance is evaluated,
    **Then** they have 5 Training Rynke from elevation gain (the 800 m are not
    added).
15. **Given** a rider who recorded the same ride on a bike computer (80 km,
    600 m) and on their phone (78 km, 650 m), overlapping in time, **When** the
    balance is evaluated, **Then** only the 80 km recording counts: 8 Training
    Rynke from distance and 600 m towards the elevation total.
16. **Given** a rider with one ride ending at 10:00 and another starting at
    10:00, **When** the balance is evaluated, **Then** both count (they do not
    overlap).
17. **Given** a 300 km recording with 4 h moving time (75 km/h, e.g. a train
    trip), **When** the balance is evaluated, **Then** it earns 0 Training Rynke.
18. **Given** a 15 km recording with 2 h moving time (7.5 km/h, e.g. a walk),
    **When** the balance is evaluated, **Then** it earns 0 Training Rynke.
19. **Given** a 20 km ride with 2 h moving time (exactly 10 km/h), **When** the
    balance is evaluated, **Then** it earns 2 Training Rynke as usual.
20. **Given** a 30 km recording with 2000 m elevation gain in 1 h moving time
    (e.g. a cable car), **When** the balance is evaluated, **Then** it earns 0
    Training Rynke and adds nothing to the elevation total.
21. **Given** a 200 km activity entered manually on Strava, **When** the balance
    is evaluated, **Then** it earns 0 Training Rynke.
22. **Given** a 100 km e-bike ride, **When** the balance is evaluated, **Then** it
    earns 0 Training Rynke.

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

### User Story 4 - Each ride's Rynke and the season tally are stored (Priority: P1)

Whenever a ride, attendance, a correction or the rules change, RynkePoints works
out what each of the rider's rides earned and the rider's season tally, and stores
both. For each ride it keeps whether the ride counts, why not if it doesn't, the
Training Rynke it earned from distance and the metres it adds to the season's
elevation total. The tally adds everything up: distance Rynke, the elevation total
and the Rynke it earns, the Rynke from each kind of team event, corrections, both
totals, what is still missing and whether the rider qualifies. Elevation Rynke
belong to the tally, not to single rides, because only the season total earns
them (FR-004a). Showing these numbers to riders is a separate feature that reads
them.

**Why this priority**: Stories 2 and 3 define what is earned; storing it per ride
and per rider makes the numbers available to a rider page and later features
without recomputing the season on every read, and records why a ride earned
nothing.

**Independent Test**: Feed synthetic rides, attendance and corrections for one
rider into the evaluation, compare every stored ride result and the stored tally
with a hand calculation, and check that the tally always matches the stored ride
results.

**Acceptance Scenarios**:

1. **Given** a rider without rides, **When** a 79 km ride with 1240 m elevation
   gain is stored, **Then** its ride result shows that it counts, 7 Training Rynke
   from distance and 1240 m towards the elevation total, and the tally shows 7
   Training Rynke from distance, a 1240 m elevation total earning 5 Training Rynke
   with 760 m missing for the next 1000 m, 12 Training Rynke and 0 Team Rynke in
   total, 238 Training Rynke and 25 Team Rynke still missing, and not qualified.
2. **Given** a rider whose only ride has 600 m elevation gain, **When** a second
   ride with 600 m is stored, **Then** each ride result shows 600 m towards the
   total and the tally shows 1200 m earning 5 Training Rynke; neither ride result
   carries those 5.
3. **Given** a 100 km ride with 4 h moving time and 3 h paused, **When** it is
   stored, **Then** its ride result shows that it does not count because of the
   pause rule, with 0 Training Rynke and 0 m, and the tally is unchanged.
4. **Given** a 15 km activity entered manually with 2 h moving time, **When** it
   is stored, **Then** its ride result lists both reasons: manual entry and too
   slow.
5. **Given** a counting 78 km phone recording, **When** an overlapping 80 km bike
   computer recording of the same ride is stored, **Then** the 80 km ride counts,
   the 78 km ride's result changes to "overlap" naming the 80 km ride, and the
   tally holds 8 instead of 7 Training Rynke from distance and only the 80 km
   ride's metres.
6. **Given** a stored ride result, **When** the ride is deleted on Strava,
   **Then** its ride result is removed and the tally no longer includes the ride.
7. **Given** a ride that started after the qualification deadline, **When** it is
   stored, **Then** its ride result shows that it is outside the counting window
   and it adds nothing to the tally.
8. **Given** a rider with 260 Training Rynke, 100 of them from virtual rides, and
   25 Team Rynke, **When** the tally is stored, **Then** each ride result shows
   whether the ride is virtual, and the tally holds 160 Training Rynke without
   virtual rides, 7 still missing for the virtual-ride share (167 needed), and not
   qualified.
9. **Given** a rider who attended 2 team trainings and 1 technique training and
   has a correction of +10 Training Rynke, **When** the tally is stored, **Then** it
   shows 2 team trainings earning 2 Team Rynke and 10 Training Rynke, 1 technique
   training earning 5 Team Rynke and 5 Training Rynke, and +10 Training Rynke from
   corrections.
10. **Given** any rider, **When** their stored tally is read, also while an update
    is in progress, **Then** it matches exactly what their stored ride results,
    attendance and corrections give, and all of them were computed with the same
    rules version.
11. **Given** a rule change whose recalculation has not reached a rider yet,
    **When** their stored results are read, **Then** they can be recognised as
    computed with an older rules version.
12. **Given** any stored tally, **When** it is read, **Then** it carries the rules
    version it was computed with and the date those rules took effect.

---

### User Story 5 - Rules change and every balance is recalculated (Priority: P2)

During the season the team decides to change the rules: an organiser changes a
value (e.g. 8 instead of 5 Training Rynke per 1000 m), or a new version of the app
changes how points are computed (e.g. a new kind of team event). Every rider's
balance for the whole season, with every ride result, is recalculated from the
stored rides, attendance and corrections, as if the new rules had always applied.
Every balance records which rules it was computed with and since when they apply.

**Why this priority**: The rules come from a spreadsheet the team will keep
adjusting; a points system that cannot follow those changes for the whole season
would force manual corrections for every rider. Not needed to show the first
numbers, but needed before the first rule change.

**Independent Test**: Evaluate synthetic riders under one set of rules, change a
rule value and, separately, swap in a changed rule, and compare every balance with
a hand calculation under the new rules for the whole season.

**Acceptance Scenarios**:

1. **Given** a rider whose season rides add up to 3000 m of elevation gain,
   **When** an organiser changes the elevation reward from 5 to 8 Training Rynke
   per 1000 m, **Then** within 1 hour their elevation gain earns 24 instead of 15
   Training Rynke, including for rides uploaded before the change.
2. **Given** balances computed under the current rules, **When** a new app version
   with changed rule logic goes live, **Then** every balance is recalculated with
   the new logic and no balance or ride result computed with the old rules
   remains afterwards.
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
   Training Rynke and their stored tally includes the +10 from corrections.
2. **Given** a rider with a correction, **When** their whole balance is
   re-evaluated from scratch, **Then** the correction is applied exactly once.

---

### Edge Cases

- **Distance leftovers below a full step**: deliberately lost, per ride. A 79 km
  ride earns 7, a 9.9 km ride earns 0. Splitting one long ride into several
  uploads can therefore cost Rynke, and joining short rides into one does not
  happen automatically. This is intended: the team wants proper-length rides, not
  many short ones (see Clarifications).
- **Elevation leftovers**: never lost. A 1999 m climb earns 5 on its own, and the
  remaining 999 m count towards the next 1000 m together with the elevation gain
  of all other counting rides of the season. Splitting or merging rides makes no
  difference to elevation Rynke.
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
  and a phone, or a trainer ride from two apps) overlaps in time with itself, so
  only the largest recording counts (FR-005d). Two recordings that do not
  overlap in time are never treated as duplicates.
- **E-bike rides**: never count (FR-005e). An e-bike ride saved with a normal ride
  sport type cannot be told apart; this relies on riders' honesty.
- **Virtual rides**: count normally, but qualification needs at least two thirds
  of the Training threshold from outside virtual rides (FR-013a). Indoor-trainer
  rides count as virtual rides even without a virtual-ride app. Body weight and
  trainer settings in virtual-ride apps cannot be checked, and neither can an
  indoor ride that Strava does not mark as such; this relies on riders' honesty.
- **Manual activities**: never count (FR-005b), also when a rider's device failed;
  an organiser can add a correction instead (Story 6).
- **Honest rides caught by the plausibility limits**: e.g. a very slow, technical
  mountain-bike ride or a GPS glitch that inflates the speed. The rider can fix
  the activity on Strava (e.g. crop the glitch), after which it is re-evaluated,
  or an organiser adds a correction.
- **Zero values**: rides with 0 km or 0 m elevation gain contribute nothing for that
  part; this is never an error.
- **Elevation total drops**: when a ride is deleted, its elevation gain changes, or
  it stops counting (FR-005–FR-005e), the season total drops and the elevation
  Rynke follow, which may take away Rynke earned with other rides' metres.
- **One ride changes another ride's result**: a new, changed or deleted ride can
  make an overlapping ride count or stop counting (FR-005d); both rides' results
  and the tally change together.
- **Elevation Rynke of a single ride**: not stored. A ride result holds only the
  metres the ride adds; which ride "completed" a 1000 m step is not decided,
  because it would shift whenever an earlier ride changes.
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
- **New rule needs data that is not stored**: e.g. a rule based on heart rate.
  (Average speed and climbing rate are not such data: they are computed from
  stored distance, elevation gain and moving time.)
  It cannot take effect until that data is stored for every connected rider
  (FR-025); until then the old rules stay in effect.
- **Rider leaves and comes back**: when a rider's data is deleted (feature 001,
  FR-022) their balance, attendance and corrections are deleted with it; after
  reconnecting they start from what is imported again.
- **Qualifying, then dropping below**: a rider who qualified and then loses Rynke
  (deleted ride, removed attendance, rule change) no longer qualifies.
- **Negative corrections**: a correction may reduce a total, but neither total is
  ever below 0.

## Requirements *(mandatory)*

### Functional Requirements

**Evaluation**

- **FR-001**: The system MUST derive, for each connected rider, exactly two totals:
  Training Rynke and Team Rynke, both whole numbers ≥ 0.
- **FR-002**: The totals and ride results (FR-014) MUST be a pure, deterministic
  function of the rider's stored activities, their team-event attendance,
  organiser corrections and the rule configuration: evaluating the same inputs any
  number of times, in any order of arrival, MUST give the same results, and
  re-evaluating all riders from scratch MUST give the same results as the
  incremental updates did.
- **FR-003**: The totals and ride results MUST be re-derived whenever one of their
  inputs changes (an activity is stored, updated or removed; attendance, a team
  event, a correction, the rule configuration or the rule logic changes). A
  change MUST update every result it affects, including other rides of the same
  rider (FR-005d) and the elevation total (FR-004a).

**Training Rynke from riding**

- **FR-004**: Each ride MUST earn, on its own, 1 Training Rynke per full 10 km of
  its distance, rounded down per ride. Distance leftovers below a full step MUST
  be dropped and MUST NOT be added to other rides or to a season total (79 km →
  7; three rides of 7 km → 0; two rides of 25 km → 4). This is a deliberate rule,
  not a precision shortcut: it rewards proper-length rides over many short ones.
- **FR-004a**: Elevation gain MUST accumulate: the elevation gain of all counting
  rides in the counting window (FR-011) is added up, and the season total earns 5
  Training Rynke per full 1000 m, rounded down once on the total. No metre of
  elevation gain may be dropped per ride (two rides of 600 m → 5; 1999 m + 1 m →
  10). Rides that earn nothing under FR-005–FR-005e add nothing to the total.
- **FR-005**: Only activities stored by feature 001 (cycling activities of the
  rider) count; other sports never earn Rynke.
- **FR-005a**: A ride whose paused time (elapsed time minus moving time) is more
  than half of its moving time MUST earn no Training Rynke, neither from distance
  nor from elevation gain (its elevation gain is not added to the season total).
  A ride paused for exactly half of its moving time still counts. The share of half is a rule value (FR-012). There MUST be no other limit
  on a ride's duration, and a ride spanning several calendar days MUST NOT be
  excluded for that reason alone.
- **FR-005b**: An activity entered manually on Strava (marked as manual by
  Strava) MUST earn no Training Rynke. This needs the manual flag stored by
  feature 001 (its FR-013).
- **FR-005c**: A ride whose average speed (distance ÷ moving time) is below
  10 km/h or above 45 km/h, or whose climbing rate (elevation gain ÷ moving time)
  is above 1500 m per hour, MUST earn no Training Rynke, neither from distance
  nor from elevation gain. A ride exactly at a limit still counts; a ride with
  0 moving time earns nothing. The three limits are rule values (FR-012). They
  exclude walks, cars, trains and lifts recorded as rides.
- **FR-005d**: Of a rider's rides that otherwise count, two overlap in time when
  one starts before the other ends (end = start + elapsed time). The rides MUST be
  taken from largest to smallest (longer distance first, then more elevation
  gain, then lower Strava activity ID), and a ride MUST count only if it overlaps
  none of the rides already counting. The result MUST NOT depend on the order in
  which rides arrive (FR-002). A ride that earns nothing for another reason never
  prevents another ride from counting.
- **FR-005e**: E-bike rides MUST earn no Training Rynke: the excluded cycling
  sport types (FR-012) MUST contain Strava's e-bike types (e-bike ride, e-mountain
  bike ride) by default.

**Team events**

- **FR-006**: Each team event MUST have a kind (team training, training-weekend
  day, technique training), a date and an optional name. A training weekend is
  recorded as one team event per day.
- **FR-006a**: Organisers MUST be able to create, change (kind, date, name) and
  delete team events, and to add and remove attendances. Deleting a team event
  MUST delete its attendances. Each of these is an input change under FR-003.
  Attendance can only be recorded for connected riders, including for events
  that took place before the rider connected. Who counts as an organiser and how
  they make these changes is the organiser-administration feature's concern
  (see Assumptions); this feature only defines the inputs and their effect.
- **FR-007**: Attendance at a team event MUST be recorded by an organiser; the
  system MUST NOT derive attendance from rides. Each recorded attendance MUST earn
  the fixed amount for the event's kind: team training 1 Team Rynke + 5 Training
  Rynke; training-weekend day 5 Team Rynke + 10 Training Rynke; technique training
  5 Team Rynke + 5 Training Rynke. A rider MUST be credited at most once per team
  event, and attendance MUST NOT require a ride on Strava.
- **FR-008**: Rides MUST earn distance and elevation Training Rynke (FR-004,
  FR-004a)
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
  per event kind, the largest paused share of a counting ride, the lowest and
  highest average speed and highest climbing rate of a counting ride, the largest
  share of the Training threshold that may come from virtual rides), the
  thresholds (250 Training Rynke, 25 Team Rynke), the qualification deadline and
  the excluded cycling sport types MUST be organiser configuration, changeable
  without code changes.

**Qualification**

- **FR-013**: A rider qualifies for the tour exactly when their Training Rynke are
  at least the Training threshold **and** their Team Rynke are at least the Team
  threshold **and** they meet FR-013a. Neither kind can make up for a shortfall in
  the other.
- **FR-013a**: Training Rynke from virtual rides MUST count normally in the
  rider's Training Rynke. A virtual ride is any ride with Strava's virtual-ride
  sport type or with Strava's trainer flag set (an indoor-trainer ride, whatever
  its sport type). For qualification, the
  Training Rynke the rider would have without their virtual rides (evaluated
  with all rules, virtual rides left out after FR-005d) MUST additionally be at
  least two thirds of the Training threshold, rounded up (167 of 250). At most a
  third of the threshold can therefore come from virtual rides. The share is a
  rule value (FR-012).

**Stored results**

- **FR-014**: The system MUST store a ride result for each of a rider's stored
  activities: whether it counts; if not, every reason that applies (pause, manual
  entry, too slow, too fast, climbing rate, excluded sport type, outside the
  counting window, overlap); for an overlap, the counting ride it overlaps; the
  Training Rynke it earns from distance (FR-004); the metres it adds to the
  elevation total (FR-004a); whether it is a virtual ride (FR-013a); and the
  rules version it was computed with. Overlap is only recorded for rides that
  pass every other rule (FR-005d). A ride result MUST NOT carry elevation Rynke:
  those are earned by the season total only.
- **FR-014a**: The system MUST store a balance (season tally) for each connected
  rider: Training Rynke from distance; the elevation total in metres, the Training
  Rynke it earns and the metres still missing for the next step; for each
  team-event kind, the number of events attended and the Team and Training Rynke
  they earn; the sum of corrections for each kind of Rynke; the Training Rynke and
  Team Rynke totals; the amount still missing for each threshold; the Training
  Rynke without virtual rides and the amount still missing for FR-013a; whether
  the rider qualifies (FR-013); and the rules version with the date it took
  effect.
- **FR-014b**: A rider's balance and ride results MUST be stored together, so that
  whoever reads them never sees a balance that differs from what the stored ride
  results, attendance and corrections give, nor results computed with different
  rules versions side by side. Reading them MUST NOT trigger an evaluation.
- **FR-015**: Ride results and balances are the rider's personal data. They MUST
  contain no Strava data beyond what feature 001 stores, MUST be deleted with the
  activity or the rider (feature 001, FR-022), and MUST NOT be shown to anyone but
  the rider. Showing them, including to the rider, is a separate feature.
  *Note*: showing balances to other riders (team leaderboard) and to organisers
  (organiser overview) is the purpose of the app, not an afterthought. It is
  allowed only with each rider's explicit consent (constitution Principle I;
  Strava API Agreement), which the roles-and-consent feature defines (see
  Assumptions). This feature stores balances per rider so that those features can
  filter by consent without changing anything here.
- **FR-016**: Reasons and sources MUST be stored as language-independent values,
  not as rider-facing text, so that a feature showing them can translate them
  (feature 001, FR-028). This feature has no rider-facing text of its own; the
  German labels are "Trainingsrynke" and "Teamrynke".

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
  effect, and every balance and ride result MUST record the rules version it was
  computed with. After any rule change the system MUST recalculate all balances
  and ride results automatically; once that is done (SC-006), none computed with
  an older version may remain. While it runs, the previous results MAY stay
  stored, recognisable by their older rules version.
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
  written in Markdown, that opens with a prominent section on the team purpose (we
  ride to Paris as a team and wait for each other, so every rider needs a minimum
  fitness because an unfit rider holds back the whole team; riders train for the
  team, not only for themselves) and then explains Training Rynke and Team Rynke,
  every way to earn them with the current values, the per-ride rounding of
  distance (FR-004),
  the accumulated elevation gain (FR-004a) and the pause rule (FR-005a) with
  examples, a note that the pause rule exists to keep riders from gaming the
  system and that the team will adjust it should it lead to unfair situations,
  the excluded rides (FR-005b–FR-005e), the virtual-ride share (FR-013a) with a
  strongly worded appeal to set the real body weight in virtual-ride apps,
  attendance recording (FR-007), rides during team events (FR-008), the counting
  window (FR-011), corrections (FR-010) and the qualification rule (FR-013).
- **FR-018**: The repository MUST contain a script that converts the handout to a
  PDF with one command. The handout and the script are a seldom-used manual
  organiser task and need no automated tests.
- **FR-019**: This spec is authoritative. The handout is informational only; where
  they differ, the spec applies and the handout MUST be corrected. Whenever a rule
  in this spec or a configured value changes, the handout MUST be updated.
- **FR-020**: The handout is a static document outside the app. It is German only
  and is not part of the app's translation strings.

### Key Entities

- **Rynke Rules**: organiser configuration — km per distance step and Rynke per
  step, metres per elevation step and Rynke per step, fixed Team and Training
  Rynke per team-event kind, the largest paused share, the speed and climbing-rate
  limits, the largest virtual-ride share, the two thresholds, the qualification
  deadline, and excluded cycling sport types (e-bike types by default). Carries a version and
  the date it took effect, covering both configured values and rule logic.
- **Team Event**: an event organised by the team — kind, date, optional name.
  Belongs to the team, not to a rider. Created, changed and deleted by organisers
  (FR-006a); deleting it deletes its Attendances.
- **Attendance**: links a Rider to a Team Event they took part in, as recorded by
  an organiser; at most one per Rider and Team Event. Deleted with the Rider.
- **Correction**: a signed manual adjustment of a Rider's Training and/or Team
  Rynke with reason and date, entered by an organiser. Deleted with the Rider.
- **Ride Result**: the derived result for one of a Rider's activities (feature
  001) — whether it counts, the reasons if not, the overlapping ride, distance
  Training Rynke, metres added to the elevation total, virtual flag and rules
  version (FR-014). At most one per activity; deleted with the activity or the
  Rider.
- **Rynke Balance**: the derived season tally for one Rider — Training Rynke,
  Team Rynke, breakdown by source, amounts still missing, qualification flag and
  the rules version it was computed with (FR-014a). Always consistent with the
  Rider's Ride Results (FR-014b). Both can always be recomputed from the entities
  above plus the Rider's activities (feature 001); deleted with the Rider.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a reference set of at least 20 hand-calculated synthetic riders
  covering every rule, rounding case, window boundary and correction, 100% of
  evaluated totals and qualification flags match the hand calculation.
- **SC-002**: A full re-evaluation of all riders from scratch produces exactly the
  same balances and ride results as those kept up to date incrementally.
- **SC-003**: Replaying any recorded sequence of activity notifications, attendance
  changes and corrections (including duplicates and reordering) produces the same
  balance as applying the final state once.
- **SC-004**: Under normal conditions, a new ride is reflected in the rider's
  stored ride results and balance within 5 minutes of being uploaded to Strava
  (as feature 001 SC-002).
- **SC-005**: For 100% of riders, at every moment, the stored balance matches what
  their stored ride results, attendance and corrections give under the same rules
  version.
- **SC-006**: After any rule change (a configured value or a new app version with
  changed rule logic), every rider's balance for the whole season reflects the
  new rules within 1 hour, and no balance or ride result computed with older rules
  remains after that.
- **SC-007**: A full recalculation of all riders for a whole season makes zero
  requests to Strava and gives the same result every time it is run.

## Assumptions

- Builds on feature 001: riders, their stored cycling activities (distance,
  elevation gain, moving time, elapsed time, start date and time zone, sport type,
  manual flag, trainer flag) and the season start date already exist. Elapsed
  time, the manual flag and the trainer flag were added to feature 001 (its
  FR-013) for FR-005a, FR-005b and FR-013a; they come with the activity data the app already fetches and are the minimum needed
  to compute points (constitution Principle I).
- E-bike rides stay stored by feature 001 although they earn nothing by default,
  so that an organiser can change the excluded sport types and recalculate the
  season (FR-021).
- Some cheating cannot be detected with the stored data: borrowed or fabricated
  GPS files, wrong body weight in virtual-ride apps, e-bike rides saved as normal
  rides. The rules rely on riders' honesty there ([lazy-rider.md](lazy-rider.md)).
- The goal is the Tour de Paris of the current season; one season is evaluated at
  a time. History across seasons is out of scope.
- Roles, how someone becomes an organiser, and the organiser pages for team
  events, attendance, corrections, rule configuration and starting a
  recalculation are separate features (prompts in
  [specs/backlog/](../backlog/README.md)). This feature defines only the inputs
  and their effect. Until the organiser-administration feature exists, these
  inputs are entered directly into the stored data as a manual step the
  maintainer runs, so Team Rynke stay at 0 in practice.
- There is no upper limit on Rynke per ride, per day or per week, since the sheet
  states none.
- Rule changes are rare (a few per season) and announced to riders beforehand;
  the handout is updated with them (FR-019). A history of past balances under old
  rules is not kept.
- A later feature that writes points into Strava activity descriptions will have
  to update those descriptions after a recalculation, within Strava's limits;
  that is its concern, not this feature's. It can take a ride's distance Rynke and
  metres from its ride result; elevation Rynke exist only in the balance.
- Showing a rider their balance, ride results and qualification is a separate
  rider-view feature that reads what this feature stores (FR-014–FR-014b). It owns
  the page, who may see it, and its translated text.
- Team leaderboards (the main purpose of the app), organisers seeing riders'
  balances or a list of who qualified, and writing the balance into Strava
  activity descriptions are separate features: each needs consent under
  constitution Principle I and Strava's API Agreement, which only lets a rider's
  Strava data be shown to that rider unless they explicitly consent to share it.
  Which consents and roles are needed is settled first, by the roles-and-consent
  feature, while the app has no users yet ([specs/backlog/](../backlog/README.md)).
- Because attendance is recorded by hand, a forgotten entry means missing Team
  Rynke until an organiser adds it; once the rider view shows their breakdown
  (FR-014a), riders can check it and ask. Automatic matching of rides to events can be added later as a separate
  feature.
