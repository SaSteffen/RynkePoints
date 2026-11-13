# Feature Specification: Ride Edit Re-check

**Feature Branch**: `036-ride-edit-recheck`

**Created**: 2026-11-13

**Status**: Draft

**Input**: User description: "Pick up ride edits that Strava sends no webhook for (issue #274). We
already tell riders they can edit rides; currently we tell them to rename them afterwards. That can
go: we only need to tell them to wait a little until it is updated, at most 24 hours. Find a
strategy that does not deplete our resources. One request per rider returns up to 200 rides; we do
not need to look further back." Follow-up: "Design it so that it adapts to the number of riders:
with fewer riders we can check more often. Also a fast lane, but only for rides that are likely to
get changed."

## Context

Strava tells the app about a changed activity only when its title, type or privacy changes. A crop,
or any other edit that changes distance or times, is not reported. The app then keeps the old
figures: a ride stays "zählt nicht" after the rider fixed it on Strava, which is exactly what the
ride card tells them to do. As a workaround the card asks the rider to change the ride's title
afterwards, so that Strava reports something.

This feature lets the app look for such edits on its own. It re-reads each rider's recent
activities from Strava on a schedule, compares them with what it has stored, and takes over what
changed. The rider only has to wait. Only riders with an activity in the past 30 days are
checked, so the requests go to those who can have something to fix.

Looking on a schedule costs Strava requests, which are limited per Strava app and shared by all
teams (300 reads per 15 minutes, 3,000 per day), and database writes, which are limited by the
free hosting plan (100,000 rows a day for the whole account). The feature is built around a fixed
allowance, so its cost does not grow unnoticed and nothing a person waits for is ever slowed down.

**Terms**:

- **Check**: one re-read of one rider: the rider's newest 200 activities, in one request to
  Strava, compared with the stored ones.
- **Run**: the hourly moment at which a team's site does its checks.
- **Allowance**: the number of checks a team may do per day in normal operation (FR-008).
- **Fast lane**: the riders who are probably waiting for a fix to arrive (FR-012). They are checked
  first.
- **Fixable reason**: a reason for "zählt nicht" that a crop on Strava can remove: pause, too slow,
  too fast, climbing rate, overlap with another ride.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A cropped ride starts counting on its own (Priority: P1)

A rider's ride doesn't count because the recording kept running in the café. The rider crops it on
Strava and does nothing else. Within hours, at the latest within 24, the ride on the rider's page
shows the new figures and counts, with Rynke and badges as if it had been recorded that way.

**Why this priority**: This is the problem of the issue. Without it the rider must know a trick
(rename the ride), and those who don't keep a ride that wrongly doesn't count.

**Independent Test**: In fake mode, change a stored ride's distance and times on the fake Strava
without sending an event, let the runs pass, and see the ride's figures, its verdict and the
rider's Rynke change.

**Acceptance Scenarios**:

1. **Given** a stored ride that doesn't count because of a pause, **When** the rider crops it on
   Strava so that it would count and the rider's next check happens, **Then** the ride shows the
   new distance and times, counts, and the rider's Rynke and badges are what they would be had the
   ride arrived that way.
2. **Given** a stored ride that counts, **When** the rider edits it on Strava so that its distance
   or times change and the next check happens, **Then** the stored figures follow, and the verdict
   is evaluated again, also when the ride no longer counts afterwards.
3. **Given** a rider whose activities on Strava are the same as the stored ones, **When** a check
   happens, **Then** nothing about the rider's rides, Rynke or badges changes and no ride is
   written again.
4. **Given** an activity on Strava from this season that the app never heard of (a lost event),
   **When** it is among the rider's newest 200 at a check, **Then** it is stored and evaluated like
   a newly reported one.
5. **Given** a ride that starts to count through a check, **When** the rider has notifications on,
   **Then** they are told as for any other ride that starts to count.

---

### User Story 2 - The ride card says "just wait" (Priority: P1)

A rider opens "So geht's" on a ride that doesn't count. The card explains what to crop on Strava
and that the app notices the change on its own, usually within a few hours and at the latest after
24 hours. It no longer asks to change the title.

**Why this priority**: The promise and the mechanism belong together: the text may only change once
the check exists, and the check is of little use while the card still teaches the trick.

**Independent Test**: Open the ride card of a ride with a fixable reason in every language and read
the steps.

**Acceptance Scenarios**:

1. **Given** a ride that doesn't count for a fixable reason, **When** the rider opens "So geht's",
   **Then** the steps are: crop on Strava, then wait; the wait is given as "at the latest after 24
   hours"; nothing mentions the title.
2. **Given** any of the ten languages, **When** the card is shown, **Then** the same content
   appears in that language.
3. **Given** a manual entry, **When** the rider opens the card, **Then** the advice for manual
   entries (upload the recording, delete the entry) is unchanged.

---

### User Story 3 - Riders who are waiting are checked first (Priority: P2)

A rider has a ride from yesterday that doesn't count because it was too slow on paper (a long
stop). That is a ride people fix. The app checks this rider at every run until the ride counts or
is a week old, so the fix usually arrives within the hour or two, not after most of a day.

A rider whose only non-counting ride is one that no crop can rescue (outside the counting period, a
sport type that doesn't count, flagged by Strava, a manual entry) is not treated this way.

**Why this priority**: The 24-hour promise holds without it. It makes the common case feel
immediate at almost no cost, because few riders are in this state at once.

**Independent Test**: With two riders, one with a recent ride with a fixable reason and one
without, and an allowance that permits one check per run, see that the first rider is checked at
every run and the second one only in between.

**Acceptance Scenarios**:

1. **Given** a rider with a ride from the last 7 days that doesn't count for a fixable reason,
   **When** a run happens, **Then** that rider is checked before riders without such a ride.
2. **Given** a rider whose non-counting rides all have reasons that are not fixable, **When** runs
   happen, **Then** the rider is checked at the regular pace only.
3. **Given** a rider in the fast lane, **When** the ride starts to count, is deleted, or becomes
   older than 7 days, **Then** the rider is back at the regular pace from the next run on.
4. **Given** more riders in the fast lane than half of a run's checks, **When** the run happens,
   **Then** the fast lane takes half of the checks, longest-waiting first, and the other half goes
   to the regular order.

---

### User Story 4 - The pace follows the number of riders (Priority: P2)

A small team is checked often: with 12 riders, everyone every hour. A team of 100 is checked every
few hours. A team at the app's capacity is still checked once a day. Nobody sets this; it follows
from the team's allowance and the number of active riders (those with an activity in the past 30
days), and changes as riders join, leave, pause or start again.

**Why this priority**: The fixed allowance is what keeps the cost known. Spending it fully is what
makes the wait short while the teams are small, which is today's situation.

**Independent Test**: Run a day of runs in fake mode with different rider counts and one allowance,
and count how often each rider was checked.

**Acceptance Scenarios**:

1. **Given** fewer riders than a run's checks, **When** a run happens, **Then** every rider is
   checked once, and none twice in that run.
2. **Given** 50 riders, an allowance of 150 a day and nobody in the fast lane, **When** a day of
   runs has passed, **Then** every rider was checked three times, about 8 hours apart, and the team
   made no more than 150 checks.
3. **Given** more riders than the allowance, **When** a day of runs has passed, **Then** every
   rider was still checked once, and the team made about as many checks as it has riders.
4. **Given** a rider who connects today, **When** the next runs happen, **Then** the rider takes
   part without anyone doing anything.

---

### User Story 5 - The check never takes what others need (Priority: P1)

On the day of a big import, or when Strava's budget is running low for any reason, the check stands
back: it does nothing until there is room again, and what a rider waits for on a page, the import
and reported events go on as if the check didn't exist. Afterwards the check catches up with
whoever has waited longest. An administrator sees in the usage view what the check used and
whether anyone waited longer than 24 hours.

**Why this priority**: The request budget is one for all teams. A feature that polls must not be
able to starve sign-in, the import or the events, or it is worse than the problem it solves.

**Independent Test**: Set the recorded Strava usage above the limit of FR-016 and trigger a run:
no request is made. Lower it: the next run checks the riders who waited longest.

**Acceptance Scenarios**:

1. **Given** more than half of the day's Strava reads are used, **When** a run happens, **Then** it
   makes no check, and nothing is queued to make up for it later.
2. **Given** the 15-minute budget would not leave room for the run and the reserves, **When** a run
   happens, **Then** it makes only the checks that fit, or none.
3. **Given** runs were skipped, **When** the next run with room happens, **Then** it checks the
   riders who have waited longest, and does no more checks than an ordinary run.
4. **Given** Strava refuses a rider's check (the rider withdrew access, or a temporary error),
   **When** it happens, **Then** the rider is handled as for any other refused request, the other
   riders' checks go on, and the failed check is not retried before the rider's next turn.
5. **Given** an administrator opens the usage view, **When** checks have run, **Then** they see how
   many checks the team made per day and, if it happened, that riders waited longer than 24 hours.

---

### Edge Cases

- A rider with more than 200 activities this season (every sport type counts towards the 200): only
  the newest 200 are compared. An edit of an older ride is not picked up; renaming still works for
  that one.
- An activity among the 200 from before the season start: ignored, as everywhere.
- A stored ride that is missing from the list: left alone. Deletions are reported by Strava, and a
  ride can be missing for other reasons (older than the newest 200, the list being incomplete).
- A private ride of a rider who didn't grant access to private rides: ignored, as in the import.
- Strava's list lacks a figure that the stored ride has: the stored figure stays. A missing figure
  is not a change.
- The same ride arrives through an event and a check at the same time: the result is the same as
  either alone; no Rynke are awarded twice.
- A rider who is importing, needs to reconnect, or is being deleted: not checked.
- A rider whose newest stored activity started more than 30 days ago: not checked. An edit of
  such an old ride is not picked up until the rider's next activity arrives, which makes them
  active again; the ride card points to the organisers for that case.
- Strava's event for the first activity after such a pause is lost: the check doesn't find it. The
  next activity that does arrive makes the rider active, and the check then stores the missed one.
- The season is over or hasn't begun: checks go on as long as riders are active; rides outside
  the counting period get the verdict they would get anyway.
- A team with no active riders: a run does nothing and asks Strava nothing.
- A run is triggered twice for the same hour: the second finds nobody due.
- The edit changes a ride's start so that it now overlaps another ride, or no longer does: both
  rides' verdicts follow, as for any change.

## Requirements *(mandatory)*

### Functional Requirements

**The check**

- **FR-001**: The system MUST re-read each active rider's (FR-027) newest 200 activities from Strava on
  its own, on a schedule, and compare them with the stored rides, runs and swims.
- **FR-002**: A check MUST cost exactly one request to Strava. It MUST NOT read further pages and
  MUST NOT fetch single activities.
- **FR-003**: Where a listed activity differs from the stored one in a figure the app keeps, the
  system MUST store the listed values and evaluate the rider again, with the same results (verdict,
  Rynke, badges, notifications) as if Strava had reported the change.
- **FR-004**: A listed activity of this season that is not stored and would be stored if reported
  MUST be stored and evaluated.
- **FR-005**: The same rules as in the import decide what may be stored: only this season, only the
  sport types the app keeps, private activities only with the rider's grant for them.
- **FR-006**: A check MUST NOT delete a stored activity and MUST NOT blank a stored figure because
  the list lacks it.
- **FR-007**: A check that finds no difference MUST NOT write any ride, verdict, Rynke or badge
  again. The only thing it records is that the rider was checked.

**The pace**

- **FR-008**: Each team MUST have an allowance: the number of checks it may make per day in normal
  operation. The allowances of all teams together MUST NOT exceed 10% of the app's daily Strava
  read limit (300 of 3,000 today), and the 300 are split evenly between the teams (150 each for
  two teams). The allowance is team data.
- **FR-009**: A run's number of checks MUST follow from the allowance, spread evenly over the day's
  runs, so that the day's total stays within the allowance. No rider is checked more than once per
  run; places nobody is due for stay unused.
- **FR-010**: Within a run, riders MUST be taken in this order: first anyone not checked for 20
  hours or more, then the fast lane (at most half of the run's checks, FR-012), then everyone else.
  Within each group, the rider checked longest ago goes first; a rider never checked counts as
  longest ago. Places the fast lane doesn't use go to the others.
- **FR-011**: Where a team has more active riders than its allowance can reach in 24 hours, the
  run MUST make as many checks as needed for every active rider to be checked once in 24 hours,
  beyond the
  allowance, up to the app's athlete capacity (999). FR-016 still applies.
- **FR-012**: A rider is in the fast lane while they have a ride that started within the last 7
  days and doesn't count for at least one fixable reason (pause, too slow, too fast, climbing rate,
  overlap). Rides that don't count only for other reasons (outside the counting period, sport type,
  flagged by Strava, manual entry) MUST NOT put a rider in the fast lane.
- **FR-013**: The checks of a run MUST be spread so that they never come as a burst against Strava,
  and a run MUST never make up for skipped runs by doing more than its own number of checks.
- **FR-014**: Riders who are importing, need to reconnect or are being deleted MUST NOT be checked.
- **FR-027**: A rider is active, and checked, only while at least one of their stored activities
  (ride, run or swim) started within the last 30 days. Other riders MUST NOT be checked and do not
  count for the pace (FR-009, FR-011). A rider becomes active again, without anyone doing
  anything, when a new activity of theirs is stored.

**Protecting the budget**

- **FR-015**: A check is background work: it MUST leave the reserves that exist for what a person
  waits for, and it comes after the import and after reported events.
- **FR-016**: A run MUST make no check while more than half of the day's Strava reads are used,
  and MUST make only as many checks as the current 15-minute budget allows beside the reserves.
- **FR-017**: A check that was skipped or failed MUST NOT be queued or retried. The rider stays
  where they are in the order and is taken at a later run.
- **FR-018**: A refused check (access withdrawn, rider gone on Strava) MUST lead to the same
  handling of the rider as any other refused request.
- **FR-019**: The feature MUST stay within the free hosting plan at 999 riders: a day of checks in
  which nothing changed writes at most one row per check, plus one per run.

**What people see**

- **FR-020**: The ride card's "So geht's" MUST no longer ask the rider to change the title. After
  the crop step it says that the app notices the change on its own, usually within a few hours, at
  the latest after 24 hours, and that an organiser can help if nothing happens. The texts are in
  the catalogs in all ten languages, German first. Proposed German line: "Danach musst du nichts
  weiter tun. Die App schaut regelmäßig bei Strava nach und übernimmt die Änderung von selbst,
  meist nach ein paar Stunden, spätestens nach 24 Stunden. Tut sich dann nichts, wende dich an die
  Orga."
- **FR-021**: Nothing else on the rider's pages changes: no "checked at" time, no button to ask for
  a check.
- **FR-022**: The administrators' usage view MUST show, per day, how many checks the team made, and
  MUST show when active riders waited longer than 24 hours for a check.

**Rules of the project**

- **FR-023**: The constitution's principle "Good Strava API Citizenship" said the app reacts to
  Strava and does not poll it. It names this check as the one exception since version 2.7.0
  (2026-11-13): one list request per rider per check, within a fixed allowance, standing back when
  the budget is short. The check MUST stay within what the principle says.
- **FR-026**: A check MUST only trust a list that is in the expected order, newest first (see
  Assumptions). A list in another order MUST be treated as a failed check (FR-017) and MUST show
  in the usage view, so that a change on Strava's side is noticed and no ride is wrongly taken as
  unchanged.
- **FR-024**: The check MUST work the same for every team, from team data only, and MUST NOT run in
  the sandboxes on a schedule (they have none); there it can be triggered by hand like the other
  scheduled work.
- **FR-025**: The check reads nothing the rider hasn't already consented to (the same activity list
  as the import) and shows no new figure, so the consent text and its version stay as they are.

### Key Entities

- **Rider** (existing): gains the time of the last check. Never checked counts as longest ago.
- **Allowance** (new, team data): a team's checks per day in normal operation.
- **Check count** (new, per team and day): how many checks were made, and whether riders waited
  longer than 24 hours, for the usage view. Kept as long as the other usage figures.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An edit on Strava that the rider did nothing further about shows on the rider's page
  within 24 hours in at least 99% of cases, among the newest 200 activities of a rider who has an
  activity in the past 30 days.
- **SC-002**: For a rider in the fast lane, such an edit shows within 2 hours in at least 90% of
  cases.
- **SC-003**: With 100 riders across all teams, the checks use at most 300 Strava reads a day (10%
  of the limit) and at most 15 in any 15 minutes.
- **SC-004**: A team with up to 140 active riders never uses more than its allowance; above that, never
  more than one read per rider per 23 hours.
- **SC-005**: On a day on which no rider edited anything, the checks write no more than one
  database row per check, plus one per run.
- **SC-006**: Sign-in, reconnecting, the import and reported events are never delayed or refused
  because of checks: with the checks on, no request of these kinds is turned away for lack of
  budget that would have gone through without them.
- **SC-007**: Organisers get no more requests of the kind "I fixed my ride and it still doesn't
  count" for rides fixed more than 24 hours ago.
- **SC-008**: No ride card in any language mentions changing the title.

## Assumptions

- Strava's activity list, asked without a start date, returns the newest activities first, up to
  200 per request. Strava's API reference (read 2026-11-13) says nothing about the order and names
  no maximum per request; "newest first" is what client libraries describe (stravalib) and 200 is
  what the import already uses. Because it is not documented, planning confirms it with one real
  request made by the maintainer, and the check verifies the order of every list (FR-026).
- The activity list carries every figure the verdict needs (distance, moving and elapsed time,
  elevation, manual, indoor, flagged, private, type, start). Where it lacks one, the stored value
  stays (FR-006).
- The 300 are split evenly between the teams (the owner's decision): 150 each for Hamburg and
  Europe. A team with up to about 140 active riders is checked within its allowance (a rider is taken one
  run early, after 23 hours, so that the check still happens within 24); a further team means a
  smaller share for each.
- 20 hours (FR-010) leaves four runs of slack for the 24-hour promise when runs are skipped.
- "More than half of the day's reads" (FR-016) is a starting value. The day's reads have so far
  stayed far below it outside import days.
- 30 days (FR-027, the owner's decision) covers the edits that happen in practice: a ride is
  fixed soon after it was ridden. Riders who paused are left out, so the others are checked more
  often and a winter break costs almost no requests. Every kind of activity counts, so a rider who
  only runs for a few weeks stays in the check.
- The rules handouts do not mention changing the title, so they stay as they are.
- A rider with more than 200 activities in a season is rare and accepted (the owner's decision);
  renaming keeps working as a way to make the app read one ride again.
- Riders don't need a way to ask for a check; the fast lane covers the impatient case.
- The existing hourly schedule is used; no further schedule is needed.
