# Feature Specification: Strava Call Counts

**Feature Branch**: `047-strava-call-counts`

**Created**: 2026-11-23

**Status**: Draft

**Input**: User description: "Count how the Strava request budget is used: every call the teams' apps make to Strava, per UTC day, by endpoint and by the action in the software that made it (rider connects, season import, new or changed ride from a Strava event, daily club check, ride re-check, one-time re-read, rider leaves or is removed, Strava reports a disconnect). A token refresh counts under the action that needed it. Also count calls held back because the budget was low, per action, so maintainers see what waits. Show it in the admin usage view as a day table like the ride re-check's; each team counts its own calls and other teams appear as one "another team" total (via the existing usage exchange). Compare the counted total with Strava's own count from its reply headers, so a gap shows calls that weren't counted. Counts only, no rider IDs, kept 30 days; no privacy notice change. The gateway makes no Strava calls. Layout and marking across the view are issue #435's; this adds one more table there."

## Context and terms

All teams share one Strava application and so one request budget: Strava allows
so many calls per 15 minutes and per day, counted for the whole application
(feature 024, feature 026). The admin usage view (feature 025) shows how much of
that budget is used, from the counts Strava sends back with every answer, and
how much of it this team's own calls make up. It doesn't show what the calls
were for. When the budget runs short, maintainers can't tell whether it went on
the season import of a few new riders, on ride events, on the daily club check
or on the ride re-check (feature 036), and so can't tell what to change.

Only the teams' apps call Strava. The Strava gateway (feature 026) acks and
passes on events and makes no Strava calls of its own.

- **Call**: one request a team's app sends to Strava and gets an answer to,
  so it counts against the budget at Strava.
- **Endpoint**: what the call asks Strava for. The apps use five today:
  - listing the athlete's clubs;
  - reading one activity;
  - listing the athlete's activities;
  - getting or refreshing a token;
  - revoking a token.
- **Action**: the piece of work in the app the call was made for:
  - **Connecting**: a person signs in with Strava; the token exchange, the club
    check and, when they aren't let in, giving the access back.
  - **Season import**: reading a newly connected rider's season so far.
  - **Ride event**: reading a new or changed ride that Strava told us about.
  - **Daily club check**: checking that riders are still in the team's club.
  - **Ride re-check**: the daily look for rides no event brought (feature 036).
  - **One-time re-read**: reading every rider's season again after the app
    gained a figure.
  - **Leaving**: a rider leaves, or an admin removes them, and the app gives
    their Strava access back.
  - **Disconnect report**: Strava reports that a person disconnected, and the
    app confirms it with Strava before deleting anyone.
  - **Unassigned**: a call made outside every action above. There should be
    none; any shows a call the counting doesn't yet know.
- **Held back**: a call the app didn't make because the budget was too low at
  that moment; the work waits and tries again later, or the person on the page
  is told Strava is busy.
- **Strava's count**: the day's number of calls Strava reports in its answers,
  for the whole application.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See what this team's Strava calls were for (Priority: P1)

A maintainer opens the admin usage view because the day's Strava budget looks
high. A day table lists the last 30 days. For any day they can see how many
calls this team made for each action and endpoint, and how many were held back
for each action. They see at once that, say, most of yesterday's calls were the
season import of three new riders, not ride events.

**Why this priority**: this is the question the feature exists to answer. With
it alone, a maintainer can tell where the budget goes and what to change.

**Independent Test**: in fake mode, connect a sample rider, send a ride event
and run the daily club check, then open the usage view: today's row shows the
calls under connecting, season import, ride event and daily club check, each
with the right endpoints, and the day total equals their sum.

**Acceptance Scenarios**:

1. **Given** a rider connects and their season is imported, **When** a
   maintainer opens the usage view, **Then** today's counts show the token
   exchange and club check under connecting, and the activity lists under
   season import.
2. **Given** a ride event finds the rider's token expired, **When** the app
   refreshes the token and reads the ride, **Then** both calls count under ride
   event: one under getting or refreshing a token, one under reading one
   activity.
3. **Given** the budget is too low and the ride re-check is held back for 40
   riders, **When** a maintainer opens the usage view, **Then** today shows 40
   held back under ride re-check, and those 40 aren't counted as calls.
4. **Given** a person tries to connect while the budget is used up, **When**
   they're told Strava is busy, **Then** today shows one held back under
   connecting.
5. **Given** a call fails without any answer from Strava (a network error),
   **When** the counts are shown, **Then** it isn't counted as a call, because
   Strava didn't count it either.
6. **Given** a day 31 days ago, **When** the maintainer opens the usage view,
   **Then** that day is gone; the table shows at most 30 days.

---

### User Story 2 - See every team's share and whether anything is uncounted (Priority: P2)

Strava's budget is shared, so this team's calls are only part of the picture.
For each day the table also shows the other teams' calls as one "another team"
total, all teams together, and Strava's own count. A day where all teams'
counted calls fall clearly short of Strava's count is marked, so the maintainer
knows some calls aren't being counted: an action the counting misses, a team
whose counts didn't arrive, or a developer running the app against the real
Strava.

**Why this priority**: the breakdown is only trustworthy if it adds up. The
comparison tells maintainers when it doesn't; without other teams' totals it
couldn't add up at all.

**Independent Test**: with two teams in local development, make calls on both;
each team's view shows its own breakdown, the other team's day total as
"another team", and an all-teams total that matches the calls made on both.

**Acceptance Scenarios**:

1. **Given** two teams made 300 and 120 calls yesterday, **When** the first
   team's maintainer opens the usage view, **Then** yesterday shows 300 for this
   team, 120 for "another team", 420 for all teams, and Strava's count beside
   them; the other team's name isn't shown.
2. **Given** yesterday's counted total is 420 and Strava's count is 421,
   **When** the view is shown, **Then** the day has no mark.
3. **Given** yesterday's counted total is 420 and Strava's count is 600,
   **When** the view is shown, **Then** the day carries the warning mark, and
   the summary at the top of the view counts it.
4. **Given** another team didn't answer the usage exchange for a day, **When**
   the view is shown, **Then** that day says the other team's count is missing
   instead of showing a gap as if calls were uncounted, and carries no mark for
   it.
5. **Given** today isn't over, **When** the view is shown, **Then** today's row
   shows the counts so far and is never marked, since the teams' counts and
   Strava's arrive at different times during the day.
6. **Given** the app made a call outside every known action, **When** the view
   is shown, **Then** that day shows it under unassigned and carries the
   warning mark.

---

### Edge Cases

- A call answered with "too many requests" counts as a call: Strava counted it.
- A call refused because the token was withdrawn counts as a call under its
  action.
- A token refresh that happens before a call is held back still counts, under
  the action that needed it; the held-back call counts as held back.
- Work that waits and is held back several times counts once per time it's held
  back; the column shows how often work was turned away, not how many riders
  waited.
- The day is the UTC day, the same day Strava resets its daily count on.
- A team that has just joined has no counts for earlier days; those days show
  nothing for it, not zero.
- A day where counting failed for this team (for example the database couldn't
  be written) loses those calls from the breakdown; the comparison with
  Strava's count is what shows it.
- Fake mode and the sandboxes count calls to the fake Strava the same way, so
  the table can be seen and tested without the real Strava. There is no
  Strava's count to compare with where the fake Strava sends none; the
  comparison then shows nothing and carries no mark.

## Requirements *(mandatory)*

### Functional Requirements

**Counting**

- **FR-001**: Each team's app MUST count every call it makes to Strava per UTC
  day, by action and endpoint.
- **FR-002**: A call MUST be counted under the action it was made for. A token
  refresh MUST be counted under the action that needed the token.
- **FR-003**: A call made outside every known action MUST be counted under
  unassigned, never dropped.
- **FR-004**: A call that got no answer from Strava MUST NOT be counted as a
  call.
- **FR-005**: Each team's app MUST count, per UTC day and action, every call it
  held back because the budget was too low, whether the work waits or a person
  is told Strava is busy. Held-back calls MUST NOT count as calls.
- **FR-006**: Counting MUST NOT make any call to Strava, MUST NOT delay or fail
  the call it counts, and MUST NOT change when calls are made or held back.

**Sharing between teams**

- **FR-007**: Each team MUST share with the other teams, through the existing
  usage exchange, only its day totals: calls, held-back calls and the highest
  Strava's count it saw that day. The breakdown by action and endpoint MUST
  stay with the team that made the calls.

**The usage view**

- **FR-008**: The admin usage view MUST show a new day table, in the style of
  the ride re-check's, with one row per UTC day for the last 30 days, newest
  first.
- **FR-009**: Each row MUST show this team's calls and held-back calls, the
  other teams' calls together as "another team", all teams' calls, and
  Strava's count for the day: the highest any team saw. No other team's name
  is shown.
- **FR-010**: For each day, a maintainer MUST be able to see this team's calls
  and held-back calls by action and endpoint, with totals per action.
- **FR-011**: A finished day MUST carry the warning mark when Strava's count
  exceeds all teams' counted calls by more than 1% and more than 10 calls, or
  when any call was counted under unassigned. Marked days MUST count in the
  summary at the top of the view, like the other warnings there.
- **FR-012**: A day where another team's totals are missing MUST say so, and
  MUST NOT be marked for the gap.
- **FR-013**: Today's row MUST show the counts so far and MUST never be marked.
- **FR-014**: The new table MUST follow the view's existing access: only those who
  can open the usage view today see it.
- **FR-015**: Every text the new table adds MUST be in the catalogs in all ten
  languages, German as the key source.

**What is kept**

- **FR-016**: Only counts MUST be kept: per day, action, endpoint and team, no
  rider IDs, activity IDs or anything else about a person. Logs MUST NOT gain
  IDs either.
- **FR-017**: Counts MUST be deleted once they are more than 30 days old.
- **FR-018**: The privacy notice MUST NOT change and no consent is asked again:
  the counts hold nothing about a rider.

**Development**

- **FR-019**: Fake mode, local development with several teams and the
  sandboxes MUST count calls the same way as production, so the table can be
  checked without the real Strava.
- **FR-020**: Adding a new kind of Strava call to the app MUST make its action
  part of the change; a call that doesn't name one shows up under unassigned
  (FR-003, FR-011).

### Key Entities

- **Day's call count**: one team, one UTC day, one action, one endpoint, the
  number of calls. Kept 30 days.
- **Day's held-back count**: one team, one UTC day, one action, the number of
  calls held back. Kept 30 days.
- **Shared day total**: one team, one UTC day: its calls, its held-back calls
  and the highest Strava's count it saw. Sent to the other teams through the
  usage exchange.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For any of the last 30 days, a maintainer can say which action
  used the most of this team's Strava calls within one minute of opening the
  usage view.
- **SC-002**: In production, on every finished day with all teams' counts
  present, all teams' counted calls are within 1% (or 10 calls) of Strava's
  count, with nothing under unassigned.
- **SC-003**: Counting adds no Strava calls: on a day with the same work, Strava's
  count is the same before and after this feature.
- **SC-004**: No stored count, shared total or log line holds a rider ID or
  activity ID.
- **SC-005**: Counts older than 30 days are gone on the next daily cleanup.

## Assumptions

- The day table is one more section on the usage view as it is today. How the
  whole view lays out and marks its sections, on a phone too, and whether a
  marked day sends a push alert, belong to issue #435; this feature adds no
  push alerts.
- The warning mark reuses the view's existing "Warnung" level, as the ride
  re-check's day table does.
- "Another team" is one total for every other team together, as elsewhere in
  the view (feature 026 FR-040), and only day totals cross teams, so no team
  learns another's riders' activity by action.
- Strava's count per day is the highest daily count any team saw in Strava's
  answers that day. Calls after a team's last call of the day are seen by the
  team that made them, so the highest of all teams is the day's count.
- A developer running the app against the real Strava shares the application's
  budget but isn't counted; a gap from that is what the comparison is meant to
  show, not a fault.
- The 1% and 10-call allowance for the gap covers counts lost in rare failures
  (FR-006 never fails a call to count it), so a single lost count doesn't mark
  a day.
- The one-time re-read is listed as an action while the app can still start
  it; once it can't, it stays in the table for days that had it.
- Out of scope: counting calls per rider; changing the budget rules, reserves
  or when work is held back; push alerts; counts from before this feature.
