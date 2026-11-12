# Feature Specification: Stored Rider Summaries

**Feature Branch**: `030-rider-summaries`

**Created**: 2026-11-04

**Status**: Implemented

**Input**: Stop adding up every ride of the whole team on page loads and after new rides, so a full-season team stays well inside the free database allowance. Nothing riders or organisers see changes.

## Why

Measured on synthetic data with 40 riders, each with 150 rides, 20 runs and 10 swims, and 20 team events:

| Use | Database rows read today |
| --- | --- |
| Opening the app at its start address (check for new badges) | 45,396 |
| Team page | 20,793 |
| Badges page | 46,280 |
| Organiser's rider list | 21,152 |
| Each new ride (mostly the team badge check) | 45,995 |

With 2 app opens and 1 Badges visit per rider, 10 organiser visits and 24 new rides a day (an estimate, not observed use), this comes to about 8.5 million rows a day. The free limit is 5 million. Past the limit the app stops working for the whole team until the next day.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The app keeps working through the whole season (Priority: P1)

A team of 40 uses the app every day until the qualification deadline. The app never runs out of its free daily database allowance, however many rides have been recorded by then.

**Why this priority**: Running out takes the app away from everyone on the team, and the cost is highest just before the deadline, when riders most want to see their numbers.

**Independent Test**: Load the synthetic team above and measure rows read for each use against SC-001.

**Acceptance Scenarios**:

1. **Given** a team of 40 at the end of a season, **When** a rider opens the app, **Then** the check for new badges reads about 225 rows instead of about 45,000.
2. **Given** the same team, **When** anyone opens the Team page, the Badges page or the organiser's rider list, **Then** the rows read meet SC-001.
3. **Given** the same team, **When** a new ride arrives, **Then** evaluating it and checking the team badges reads about 1,000 rows.
4. **Given** two teams with equal riders, **When** one has twice the rides, **Then** opening the app, the Team page and the organiser's rider list read about the same rows, and the Badges page and a new ride read more only for that one rider's own rides.

---

### User Story 2 - Everyone sees exactly the same numbers as before (Priority: P1)

Riders and organisers notice nothing. Every number, ranking, badge, progress value and date on every page is what adding up the rides would give.

**Why this priority**: These numbers decide who qualifies. A faster page that shows a wrong number is worse than the problem it solves.

**Independent Test**: For the same riders, compare each page's figures from stored summaries with the figures from adding up the rides.

**Acceptance Scenarios**:

1. **Given** any rider's rides, runs, swims and attendance, **When** the weekly numbers are read from the summary, **Then** they equal the numbers from adding up the rides.
2. **Given** the whole team, **When** team badges are worked out from summaries, **Then** every earned badge, earned date and progress value equals the result from adding up the rides.
3. **Given** a rider opens a page, **When** it's built from summaries, **Then** the page contains no figure of another rider that it didn't contain before.

---

### User Story 3 - Summaries follow every change (Priority: P1)

A ride is added, edited, deleted or made private; an organiser records attendance or a correction; an event moves; the rules change. The summary of each affected rider is right by the time the change is done.

**Why this priority**: A summary that falls behind would quietly show wrong numbers to everyone.

**Independent Test**: Apply each kind of change to a seeded rider, then compare the summary with one worked out from scratch.

**Acceptance Scenarios**:

1. **Given** a rider with a summary, **When** a ride, run or swim is added, edited or deleted, or private rides are withdrawn, **Then** the summary matches their stored data in the same step.
2. **Given** a team event, **When** an organiser adds or removes attendance, or edits or deletes the event, **Then** each affected rider's numbers are right.
3. **Given** a change of Rynke rules, **When** the rider is evaluated again, **Then** their summary follows the new rules.
4. **Given** an evaluation that changes nothing, **When** it runs, **Then** nothing is written.

---

### User Story 4 - Leaving and withdrawing take effect at once (Priority: P1)

A rider leaves, is removed or loses their connection. They drop out of every team figure immediately, as they do today, with nothing kept.

**Why this priority**: The constitution's privacy promise (Principle I) must not depend on a stored copy catching up.

**Independent Test**: Remove a rider and check that their summary is gone and that team figures changed on the next page load.

**Acceptance Scenarios**:

1. **Given** a rider who leaves or is removed, **When** their data is deleted, **Then** their summary is deleted with it.
2. **Given** a rider who is no longer listed, for example because they need to reconnect or have no sharing consent, **When** any team page loads, **Then** their figures are in no team number, while their summary may stay until they return or leave.

---

### User Story 5 - The release is invisible (Priority: P2)

Between the release and the moment every rider has a summary, pages show the right numbers, and they cost no more than they do today. A rider who has just joined doesn't have to wait for the daily job either.

**Why this priority**: The move happens only once, but a blank or wrong number during that time would reach the whole team.

**Independent Test**: Load pages with no, some and all riders summarised, and compare the figures each time.

**Acceptance Scenarios**:

1. **Given** a release with no summaries yet, **When** pages load, **Then** they show the same numbers as before the release.
2. **Given** some riders with a summary and some without, **When** a team page loads, **Then** both kinds count correctly, each once.
3. **Given** existing riders without a summary, **When** the daily job runs, **Then** each gets one.
4. **Given** a new rider, **When** they first appear on a team page, **Then** their numbers are right without waiting for the daily job.

---

### Edge Cases

- A rider with no rides at all has a summary with nothing in it, and counts as summarised.
- A deleted event is still named in a rider's attended events until they're re-evaluated: it MUST count for nothing.
- An event's date or kind changes: pages use the event's current values.
- Attendance entered by hand in the database shows after the next daily job, as Rynke balances already do.
- A correction changes a rider's Rynke: the numbers stay right, whether corrections are stored in the summary or not.
- Two people change the same rider at the same moment: the summary matches the rider's stored data afterwards, as the balance does today.
- A ride dated after today (a rider's time zone ahead of Berlin) behaves as today.
- The season start moves and older rides are removed: summaries follow.
- A very active rider's summary stays well within what one stored row can hold for a whole season.

## Requirements *(mandatory)*

### Functional Requirements

**Summary**

- **FR-001**: The app MUST keep one stored summary per rider, holding what team reads need: totals per day (distance, Rynke, elevation), weekly sums, runs per day, activity times used by the team surprises (date, hour, whether it was a counting ride) and attended events.
- **FR-002**: A summary MUST be derived only from data the app already stores, and MUST be possible to work out again from that data at any time.
- **FR-003**: A rider's summary MUST be updated in the same step as any change to what it's derived from, wherever that change goes through evaluation.
- **FR-004**: An evaluation that changes nothing MUST write nothing.
- **FR-005**: A summary MUST be deleted with its rider.

**Reads**

- **FR-006**: The Team page, the organiser's rider list, the Badges page, the app's start check and the team badge check after a change MUST use summaries, not add up the rides of the team.
- **FR-007**: A read MUST check the list of shared riders once where it can, not once for each kind of data. The check MUST stay inside the database read (constitution Principle I: a rider without consent is in no row).
- **FR-008**: The Team page and the organiser's rider list MUST use weekly sums only, not a rider's daily totals.
- **FR-009**: Team-wide results MUST NOT be stored: no cache of team totals, team badges or pages. They MUST be worked out from the listed riders' summaries on each use, so that a rider leaving the list leaves the figures at once.
- **FR-010**: Database round trips per page MUST NOT grow in normal use, when every listed rider has a summary.

**Same results**

- **FR-011**: All pages' figures, rankings, badges, earned dates, progress values and notifications MUST be identical to those from adding up the rides.
- **FR-012**: A listed rider without a summary MUST still count correctly, without blank or wrong numbers, with their figures added up from their rides.
- **FR-013**: The daily job MUST give every rider without a summary one.
- **FR-014**: A new rider MUST NOT depend on the daily job for right numbers.

**Boundaries**

- **FR-015**: No new data MUST reach the browser, no consent version MUST change and no new request to Strava MUST be made.
- **FR-016**: No page's look or text MUST change.
- **FR-017**: Automated tests MUST compare summaries with adding up the rides, for the weekly numbers and for team badges, and MUST guard the row targets in SC-001.

### Key Entities

- **Rider summary**: one per rider. What team reads need from their rides, runs, swims and attendance, in compact form. Holds no ride name, ID, route or duration. Removed with the rider.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With 40 riders at the end of a season, each with 150 rides, 20 runs and 10 swims, and 20 team events, rows read per use are at most:

  | Use | Today | At most |
  | --- | --- | --- |
  | Opening the app | 45,396 | 400 |
  | Team page | 20,793 | 500 |
  | Badges page | 46,280 | 1,500 |
  | Organiser's rider list | 21,152 | 1,000 |
  | Each new ride, with the team badge check | 45,995 | 1,500 |

- **SC-002**: With the usage estimate under Why, the whole app reads under 5% of the free daily limit, down from about 170%.
- **SC-003**: Doubling every rider's rides raises opening the app, the Team page and the organiser's rider list by less than 10%. The Badges page and each new ride still read the one rider's own rides, as they must, so they rise by at most 5 rows per extra ride of that rider, plus 3 for each badge those rides earn them, and by nothing for other riders' rides.
- **SC-004**: In 100% of comparisons, weekly numbers and team badges from summaries equal those from adding up the rides.
- **SC-005**: In 100% of checks, a rider removed from the list is in no team figure on the next page load.
- **SC-006**: After release, no rider sees a changed number, and the existing page tests pass without a change to what they expect a page to show.

## Assumptions

- **Usage estimate**: the daily figures come from an estimate. Real use is visible on the Admin page and can replace it.
- **Season length**: 150 rides per rider stands for a full season. The cost today grows with rides, so it's lower earlier in the season.
- **Harder code**: database reads may be harder to read where that's needed for performance, as the maintainer decided.
- **Daily sums on the server**: team badges work out from all listed riders' daily sums on the server today, and go on doing so. Nothing per rider reaches the page.
- **Hand-entered attendance**: may lag until the next daily job, as Rynke balances already do.

### Out of Scope

- The organiser progress graphs, which will build on these summaries later.
- The daily job's check for out-of-date riders, about 0.4% of the limit.
- The cost of a new rider's first import and of queued Strava work, not yet measured.
- Caching of team-wide results or pages.
- Any visible change.
