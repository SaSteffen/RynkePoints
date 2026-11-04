# Feature Specification: Admin View with Usage Statistics

**Feature Branch**: `025-admin-usage-view`

**Created**: 2026-11-04

**Status**: Draft

**Input**: User description: "observability is key, we'll need a spec for the admin
view since that one needs to give us stats about our usage of our allowances with
Strava and Cloudflare. Not too deep: only some stats (percentage and absolute
numbers, per team shares of usage) and some historical data." Also issue #235 (an
overview of the club's riders, and removing a rider), issue #40 (monitoring Strava
request limits) and the backlog prompt for a Strava backlog view, which this spec
replaces.

## Clarifications

### Session 2026-11-04

- Q: Can a removed rider connect again? → A: No. A removed rider stays blocked. The
  team keeps only their Strava athlete ID for this.
- Q: How do administrators hear that a limit is near? → A: A push notification through
  the app.

## Context

The app may soon serve a second team (issue #236): one Strava app, one Cloudflare
account, and a Worker and database per team, plus a small gateway. Both teams then
draw on the same allowances, and neither sees how close they are today. Strava's
limits apply per app (constitution Principle II), and Cloudflare's free limits apply
per account.

Separate Cloudflare accounts remain an option for when the limits are reached, and
this view is how we will know.

**Terms**: An **administrator** is a person who runs the app for a team. This is a
new role, separate from organisers (feature 014). An **allowance** is a limit set by
Strava or Cloudflare, and **usage** is how much of it has been used in its current
period. A team's **share** is the part of the usage caused by that team. **Shared
usage** is usage caused by the gateway rather than by a team.

This feature must work with one team, so it can ship before the second team joins.
Each team sees its own riders only. Usage figures are the one thing shown across
teams, and they never identify a rider.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - How close are we to our limits? (Priority: P1)

An administrator opens the admin view and sees, for each allowance, the amount used,
the limit, the percentage and each team's share. Anything close to its limit stands
out, so they can tell in under a minute whether anything needs attention.

**Why this priority**: It is the reason for this feature. Moving to separate
accounts, or slowing work down, is decided from these numbers.

**Independent Test**: With synthetic usage for two teams, sign in as an
administrator and compare every displayed figure with the synthetic values. Then
sign in as a non-administrator and check the view is refused.

**Acceptance Scenarios**:

1. **Given** Strava reports 1,200 of 3,000 daily reads, **When** an administrator
   opens the view, **Then** it shows 1,200, 3,000 and 40 %, with the time the figure
   was observed.
2. **Given** two teams made 900 and 300 of those reads, **When** the view is open,
   **Then** it shows each team's count and its share, 75 % and 25 %.
3. **Given** a usage figure at or above 80 % of its limit, **When** the view is open,
   **Then** that figure is marked as a warning, in a way that doesn't rely on colour
   alone.
4. **Given** a usage figure at or above 95 % of its limit, **When** the view is open,
   **Then** that figure is marked as critical.
5. **Given** only one team exists, **When** the view is open, **Then** the figures
   appear with that team's share at 100 %, or without shares, and nothing looks
   broken.
6. **Given** Cloudflare's figures can't be fetched, **When** the view is open,
   **Then** those figures say they are unavailable and show the last known values
   with their time, never zero, and the Strava figures still appear.

---

### User Story 2 - How has usage developed? (Priority: P2)

An administrator looks at the past weeks to see whether usage is growing, whether a
peak was one bad day, and which team caused it.

**Why this priority**: One day's figure can't show a trend. The history is what tells
us when we will reach a limit, but it needs Story 1's figures first.

**Independent Test**: With a synthetic history of 60 days for two teams, open the
view and compare the daily values and team shares with the synthetic data. Then
remove a rider and check the history doesn't change.

**Acceptance Scenarios**:

1. **Given** 60 days of recorded usage, **When** an administrator views an
   allowance's history, **Then** they see one value per day, with the limit and each
   team's share.
2. **Given** a Strava daily history, **When** they view it, **Then** each day also
   shows that day's highest 15-minute usage as far as observed.
3. **Given** a day on which nothing could be recorded, **When** they view the
   history, **Then** that day appears as a gap, not as zero.
4. **Given** the feature has only just started recording, **When** they view the
   history, **Then** it shows the days available and says when recording began.

---

### User Story 3 - Who is connected? (Priority: P2)

An administrator sees the riders of their own team and each rider's state, for
example to find out why someone's rides aren't arriving. They also see how many
riders are connected across the app, against Strava's capacity of 999.

**Why this priority**: It answers the most common support question without reaching
for the database, and it needs no usage figures.

**Independent Test**: With synthetic riders in every state, sign in as an
administrator and compare the list with the data. Check that no rider of another
team appears, and that no ride or Rynke figure appears.

**Acceptance Scenarios**:

1. **Given** riders in several states, **When** an administrator opens the rider
   overview, **Then** each row shows the first name, connection status, connection
   date, last membership check and whether an import is still running.
2. **Given** riders of another team exist, **When** an administrator opens the rider
   overview, **Then** none of them appears; of that team, only its number of connected
   riders is shown.
3. **Given** work is waiting for the Strava budget, **When** the view is open,
   **Then** it shows how many items are waiting and an estimate of when they will be
   done, without naming riders. **Given** nothing is waiting, **Then** it shows
   nothing about waiting work.

---

### User Story 4 - Remove and block a rider (Priority: P3)

An administrator removes a rider who should no longer take part. The rider's data is
deleted as when a rider leaves, and they can't connect to this team again. Only their
Strava athlete ID stays, on the team's block list.

**Why this priority**: Rare, and leaving the Strava club already removes a rider
within a day. It matters for cases that can't wait, or where the club can't be
changed.

**Independent Test**: With synthetic riders, remove one and check that all their data
is deleted except the athlete ID on the block list, their Strava access revoked, the
action recorded without identifying them, and the team's other riders unchanged. Then
connect as that rider and check it is refused and nothing else is stored.

**Acceptance Scenarios**:

1. **Given** a rider in the overview, **When** an administrator chooses to remove
   them, **Then** they must first confirm, and are told this can't be undone and that
   the rider can't connect to this team again, even while in the club.
2. **Given** the administrator confirms, **When** the removal runs, **Then** the
   rider's data is deleted and their Strava access revoked, as when a rider leaves
   the club.
3. **Given** a removal has happened, **When** the removed rider next opens the app,
   **Then** they see the same page as anyone who isn't connected.
6. **Given** a blocked rider, **When** they try to connect, **Then** they are told they
   can't take part in this team, no data about them is kept beyond the block list entry,
   and any access Strava just granted is revoked at once.
7. **Given** a blocked rider, **When** they leave and rejoin the Strava club, **Then**
   they stay blocked.
4. **Given** a rider of another team, **When** an administrator tries to remove them
   by any means, **Then** it is refused and nothing changes.
5. **Given** an administrator, **When** they try to remove themselves, **Then** it is
   refused and they are pointed to the normal way of leaving.

---

### User Story 5 - Be told when a limit is near (Priority: P2)

An administrator gets a push notification from the app when an allowance reaches a
warning level, so they don't have to keep checking the view.

**Why this priority**: The view only helps if someone looks at it. It needs Story 1's
figures first.

**Independent Test**: With synthetic usage and a synthetic push service, take a daily
allowance across 80 % and then 95 %. Check that each administrator's devices get one
notification per level, that the notification holds no rider data, and that a second
check in the same period sends nothing.

**Acceptance Scenarios**:

1. **Given** a daily allowance reaches 80 %, **When** the next check runs, **Then** the
   administrators of every team get a notification naming the allowance and its
   percentage, which opens the admin view.
2. **Given** the notification for 80 % was sent, **When** the allowance reaches 95 % in
   the same period, **Then** one more is sent, marked as critical.
3. **Given** a notification was sent for a level, **When** further checks run in the
   same period, **Then** none is sent for that level.
4. **Given** a Strava 15-minute figure is at 95 %, **When** the check runs, **Then** no
   notification is sent, because the budget logic works close to these limits by design
   during imports.
5. **Given** an administrator has notifications off on all their devices, **When** they
   open the admin view, **Then** it says they won't get alerts and where to turn them on.
6. **Given** the push service can't be reached, **When** a notification fails, **Then**
   nothing else fails, and the view still marks the figure.

---

### Edge Cases

- A Strava figure is old because no call was made in the current period: the figure
  counts as zero for the new period, as the budget logic already treats it, and the
  time of the last observation is shown.
- Team counts don't add up to Strava's total, for example because a call failed
  before it was counted or the counters started mid-period: the difference is shown
  as "not attributed", not hidden or spread across the teams.
- Limits change: Strava's limits come from its latest response, so the percentages
  follow. A changed Cloudflare limit or plan is a setting, and old days keep the limit
  they were recorded with.
- Usage above 100 % is shown as it is, not capped.
- Cloudflare's figures lag behind and can be revised: they are labelled approximate
  and with their time, and a past day's record may be corrected when fetched again.
- The daily recording fails or runs twice: a failure leaves a gap and a repeat doesn't
  double-count (Principle II).
- Cloudflare's own history is shorter than ours: recorded days stay available after
  Cloudflare has dropped them.
- A team is added later: the history shows its share from its first day, with earlier
  days unchanged.
- An administrator's flag is cleared: they lose access on their next request, and
  they remain a normal rider.
- Accounts are split later: each account's allowances appear separately, and earlier
  days stay under the account they were recorded for.
- A rider is blocked by mistake: only the maintainer can lift it, by deleting the entry
  by hand, since the list holds no names to choose from.
- A blocked rider is in another team's club: the block applies per team, so they can
  join that team. If they were connected to both, the removal also ends their connection
  there, because Strava's grant covers the whole app (feature 026).
- A rider who leaves by themselves, or whose club membership ends, isn't blocked: all
  their data goes, and they can come back.
- An allowance drops below a level and rises again in the same period, as storage or
  connected riders can: it notifies once more only after falling below the level.

## Requirements *(mandatory)*

### Functional Requirements

**Access**

- **FR-001**: The system MUST have an administrator role, separate from organisers. A
  rider may hold either, both or neither.
- **FR-002**: The maintainer MUST be able to mark and unmark administrators per team,
  in the way organisers are marked (feature 004). The role is read on every request.
- **FR-003**: Everything in this feature MUST be refused to anyone who isn't an
  administrator of that team, in the way other protected pages are, without
  revealing that the pages exist.
- **FR-004**: An administrator MUST NOT be able to see or act on riders of another
  team.

**Current usage**

- **FR-005**: The view MUST show these Strava allowances: reads and all requests, each
  per 15 minutes and per day, and connected riders against the athlete capacity.
- **FR-006**: The view MUST show these Cloudflare allowances for the account: Worker
  requests per day, queue operations per day, database rows read and written per day,
  and total database storage.
- **FR-007**: Each figure MUST show the amount used, the limit, the percentage and the
  time it was observed.
- **FR-008**: Each figure MUST show each team's absolute count and share, and shared
  or not attributed usage separately, wherever the source allows. A figure that can't
  be split says so.
- **FR-009**: Figures at or above 80 % MUST be marked as a warning, and at or above
  95 % as critical. The marking MUST NOT rely on colour alone.
- **FR-010**: The system MUST count its Strava requests per team, because Strava only
  reports the app-wide total.
- **FR-011**: When a source is unavailable, the view MUST say so and show the last
  known values with their time. It MUST NOT show zero or fail as a whole.
- **FR-012**: Cloudflare's figures MUST be labelled as approximate, since Cloudflare
  says its analytics are not a billing measure.

**History**

- **FR-013**: The system MUST record one value per allowance, per team and per day,
  once a day, with the limit in effect. Strava's records MUST include the day's
  highest observed 15-minute usage.
- **FR-014**: Each allowance's history MUST be viewable by day, in absolute numbers
  and as a percentage of the limit, with each team's share.
- **FR-015**: The history MUST cover at least the last 13 months and MAY drop older
  days. Days without a record MUST appear as gaps.
- **FR-016**: Recording MUST be idempotent, and it MUST NOT use up a meaningful part
  of the allowances it measures.
- **FR-017**: Usage figures and history MUST contain no rider identifiers and MUST
  survive a rider's deletion.

**Riders**

- **FR-018**: The rider overview MUST show the administrator's own team, one row per
  rider: first name, connection status, connection date, last membership check and
  import state.
- **FR-019**: The overview MUST NOT show rides, Rynke, tokens, athlete IDs or anything
  else read from a rider's activities.
- **FR-020**: The view MUST show how many Strava items are waiting and an estimate of
  when they will be done, without naming riders, and nothing when none are waiting.

**Removing a rider**

- **FR-021**: An administrator MUST be able to remove another rider of their team after
  a confirmation that says it can't be undone and the rider can't connect to this team
  again.
- **FR-022**: Removal MUST delete all the rider's data except the block list entry and
  revoke their Strava access promptly, with no soft deletion and nothing kept for
  statistics.
- **FR-023**: Each removal MUST be recorded with its time and the administrator, but
  not the name or ID of the rider removed, and it MUST NOT be possible to link the record
  to a block list entry.
- **FR-024**: Each team MUST keep a block list holding only Strava athlete IDs: no name,
  time, reason or administrator. Riders who leave by themselves or whose membership ends
  MUST NOT be added.
- **FR-030**: A blocked rider trying to connect MUST be refused with a message saying
  they can't take part in this team. Anything Strava returned MUST be discarded and the
  access just granted revoked at once. The list is only checked when connecting, so a
  blocked rider costs no Strava request otherwise.
- **FR-031**: The view MUST show how many riders are blocked and nothing else about them.
  Only the maintainer can lift a block, by hand.
- **FR-032**: The consent text and privacy page MUST say that administrators exist, what
  they see (FR-018), and that a removed rider's Strava ID is kept so they can't return.
  This MUST be a new consent version, which existing riders accept on their next visit
  (Principle I).

**Alerts**

- **FR-033**: The system MUST send a push notification through the app's existing
  notifications to every administrator's devices when one of these reaches 80 % or 95 %:
  a daily Strava or Cloudflare allowance, total database storage, or connected riders
  against the athlete capacity. Strava's 15-minute figures MUST NOT notify.
- **FR-034**: Allowances MUST be checked at least hourly, using figures the system
  already has or fetches for the view, without any Strava request.
- **FR-035**: Each team MUST send at most one notification per allowance, level and
  period. A repeated check or redelivered message MUST NOT send another (Principle II).
- **FR-036**: A notification MUST name the allowance and percentage, MUST hold no rider
  data, and MUST open the admin view. Like other notifications, it never holds up or fails
  other work (feature 010).
- **FR-037**: Riders who aren't administrators MUST never get these notifications.

**General**

- **FR-025**: All text MUST live in the catalogs, in every shipped language (FR-028 of
  the earlier features).
- **FR-026**: The view MUST work on a phone, like the organiser pages.
- **FR-027**: Viewing the page MUST NOT make any Strava request.
- **FR-028**: Local development and tests MUST use synthetic usage and MUST NOT contact
  Strava or Cloudflare.
- **FR-029**: The credential for reading Cloudflare's figures MUST be read-only and
  limited to analytics.

### Key Entities

- **Administrator**: A rider marked as running the app for their team.
- **Allowance**: A named limit with its source (Strava or Cloudflare), its period and
  its current value. Cloudflare's belong to an account.
- **Usage figure**: The latest value of an allowance, when it was observed, and the
  split by team.
- **Daily usage record**: One day's value for one allowance, with the limit then in
  effect, the split by team and, for Strava, the highest 15-minute usage. It holds no
  rider data.
- **Removal record**: When a removal happened and who did it, without the rider.
- **Block list entry**: One Strava athlete ID blocked from a team, and nothing else.
- **Alert state**: For each allowance and period, the highest level already notified. It
  holds no rider data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An administrator can tell in under a minute whether any allowance is at
  or above 80 %, and which team contributes most.
- **SC-002**: For a day of synthetic usage, every displayed figure, percentage and
  share matches the input exactly, and shares plus "not attributed" add up to 100 %.
- **SC-003**: An administrator can answer "how did usage develop over the last 60
  days?" for any allowance from one screen, without another tool.
- **SC-004**: In tests, no request by a non-administrator and no request across teams
  returns a rider's data or changes anything.
- **SC-005**: After a removal, the block list entry is the only stored record that
  identifies the rider, and the usage history is unchanged.
- **SC-006**: Recording and viewing together use less than 1 % of any daily allowance.
- **SC-007**: If a source fails, the rest of the view still appears and the failed
  figures are never shown as zero.
- **SC-008**: In tests, a blocked rider never ends up connected, and each connection
  attempt leaves no stored data beyond the existing block list entry.
- **SC-009**: An administrator with notifications on learns within about an hour that a
  daily allowance crossed 80 % or 95 %, and gets exactly one notification per level and
  period.

## Assumptions

- **Role**: An administrator is a connected rider of the team, so there is no separate
  sign-in. Their first holders are the maintainer and the responsible person at the
  second team.
- **Across teams**: Both teams' administrators see both teams' usage figures and
  shares, since these contain no rider data. Rider lists stay per team.
- **Consent**: Showing connection state and dates to administrators is new information
  shown to someone other than the rider, so Principle I requires a new consent version
  (FR-032). The block list alone wouldn't: it reads, writes and shows nothing new. But
  `landing.leave` promises "we then delete all data about you", which isn't true for a
  removed rider, so that text changes too, in the same version.
- **Constitution**: Principle I says all data of a rider who leaves is deleted. Removal
  by an administrator isn't covered by its wording, but keeping an ID after removal needs
  an explicit exception there before implementation.
- **Legal basis**: The entry is kept for the team's interest in keeping someone out, not
  on the rider's consent, and is kept as long as the team runs the app. A blocked rider's
  request for erasure goes to the data controller named on the privacy page. To be
  confirmed by the controller before launch.
- **Defaults**: The warning levels are 80 % and 95 %. The history is kept per day for
  13 months. Both can change during planning.
- **Limits**: Cloudflare's current free limits are 100,000 Worker requests,
  10,000 queue operations, 5 million rows read and 100,000 rows written per day, plus
  5 GB of storage, with the daily limits resetting at 00:00 UTC. These are settings,
  since they can change.
- **Cloudflare's data**: Cloudflare offers these figures per Worker, database and queue
  for a limited time (31 days for databases, about three months for Workers), which is
  why the app keeps its own daily record. A read-only credential is a manual setup
  step.
- **Dependency**: The per-team features need feature 026 (issue #236) for a second team to exist, but
  this feature ships and works without it.
- **Alerts**: Administrators receive alerts on devices where they turned notifications
  on (feature 010); there is no separate switch. Both teams' administrators are told,
  since the allowances are shared.
- **Out of scope**: Email alerts, alerts when figures can't be fetched, automatic slowing
  of work, per-rider usage, rate limit changes, changing rules or settings from the view,
  CPU time and billing.
- **Strava review**: New pages get screenshots in the review script (feature 004)
  since it fails on an unlisted page; they use synthetic riders only.
