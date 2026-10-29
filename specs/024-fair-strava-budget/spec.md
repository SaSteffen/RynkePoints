# Feature Specification: Fair Share of the Strava Budget

**Feature Branch**: `024-fair-strava-budget`

**Created**: 2026-10-29

**Status**: Draft

**Updated**: 2026-10-29 (see [Clarifications](#clarifications))

**Input**: User description: "could one athlete uploading hundreds of activities
at once make us violate api limits? do we use queues everywhere to mitigate
this?" Answered before specifying: the limits are kept (every background call
checks the app-wide budget, one message at a time, deferred work is re-sent
later), but the budget is shared first come, first served. The user asked for a
spec for the fairness side: a per-athlete share of the budget, and sign-ins that
don't wait behind someone's backlog.

## Context

Strava's limits are per app, not per rider (constitution Principle II): by
default 100 reads per 15 minutes and 1,000 a day. Every activity event costs one
read (`GET /activities/{id}`, feature 001 research R5), and the app stops 10
reads short of the 15-minute limit and 50 short of the daily one (research R6).

Work that needs Strava waits in one queue and is done in arrival order. A rider
whose device or another platform pushes a few hundred activities to Strava at
once (a long-offline bike computer syncing, a history import from another app)
puts a few hundred events in front of everybody else. With today's limits, 300
events take about an hour; for that hour:

- every other rider's new ride waits behind them, and their Rynke, badges and
  notifications (features 003, 010, 013) arrive an hour late;
- an athlete who signs up meanwhile can be turned away with "Strava ist gerade
  ausgelastet" (`notice.stravaBusy`), because the club-membership check at
  sign-in finds the budget used up (feature 001 research R4);
- more than about 950 events in a day spill over into the next day, and with it
  everybody's rides.

The same holds for the app's own bulk work: a new rider's import, the daily
membership checks and re-reads (feature 001 FR-004a, R20).

This feature keeps the limits exactly as they are and changes who gets the
budget: a rider's backlog only uses what the other riders' work leaves over, and
a sign-in is never refused because of someone's backlog.

## Clarifications

### Session 2026-10-29

- Q: Is the backlog view on the organiser page (first draft's User Story 3) part
  of this feature? → A: No. It needs a separate administrator role; it is kept
  as an idea in [the backlog](../backlog/strava-backlog-view.md). User Story 3,
  its requirement and its key-entity mention are removed.
- Q: What does "fair" mean? → A: Round robin across riders, first in, first out
  within each rider. A rider whose work has just arrived gets the next turn
  rather than waiting for a full round.
- Q: Does any new work get a rider the next turn? → A: Only if that rider had
  nothing waiting before. New work for a rider who already has work waiting
  joins the end of their own queue and doesn't change their turn.
- Q: Should a rider be told their rides are being fetched, and what about the
  notifications a backlog would set off? → A: Yes, both. No new push
  notification until the rider's queue is empty, then one for the whole
  backlog; and a line "x von n Aktivitäten geholt" while it is worked through,
  also for an import that runs past its first part. Added as User Stories 3
  and 4 (new stories; the first draft's User Story 3 stays removed).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - My ride isn't stuck behind someone's backlog (Priority: P1)

Rider A's bike computer syncs 300 activities to Strava at once. Rider B finishes
a ride a minute later. B's ride is worked out within the next few minutes, as on
any other day, while A's activities keep being worked through in the background.

**Why this priority**: It is the feature. Today one rider's sync delays the whole
team.

**Independent Test**: With the fake Strava (feature 006) and the default limits,
send 300 activity events for synthetic rider A, then one for rider B. B's ride
is evaluated within 20 minutes; all 300 of A's are evaluated eventually, and the
recorded Strava usage never exceeds the stopping points.

**Acceptance Scenarios**:

1. **Given** rider A has 300 activities waiting for Strava, **When** rider B's
   single new ride arrives, **Then** B's ride is fetched before more than a
   handful of A's are, and B sees it on Rides within 20 minutes of the event.
2. **Given** riders A and C both have large backlogs and rider B a single ride,
   **When** the budget allows only some requests in a window, **Then** B's ride
   comes first, and A and C get roughly equal shares of the rest.
3. **Given** rider A has 300 activities waiting, **When** A's device syncs one
   more, **Then** it goes to the end of A's queue and A's turn doesn't come any
   sooner; other riders waiting are not pushed back.
4. **Given** only rider A has work waiting, **When** the budget allows, **Then**
   A's activities use the whole budget, as fast as today; fairness never leaves
   budget unused.
5. **Given** rider A's backlog, **When** it is worked through, **Then** each of
   A's activities is evaluated once, the result is the same as if the events had
   come one by one, and none is lost or moved to the failed work (feature 001
   R7) because it had to wait.

---

### User Story 2 - Signing up works during a backlog (Priority: P1)

A new athlete signs up while rider A's 300 activities are being worked through.
They are let in, as on a quiet day, and their import starts.

**Why this priority**: Being turned away on first contact, for a reason that has
nothing to do with the athlete, is the worst first impression the app can make,
and the team is about to grow from 10 to about 60 riders.

**Independent Test**: Fill the queue with rider A's backlog until the background
work has used its share of the window, then sign in as a new synthetic athlete
who is a club member. The sign-in succeeds.

**Acceptance Scenarios**:

1. **Given** background work has used everything it may use in this window,
   **When** an athlete signs in, **Then** the sign-in's Strava calls (token
   exchange, club check) still go through and the athlete is let in.
2. **Given** an existing rider reconnects or deletes their account during a
   backlog, **When** the token is exchanged or revoked, **Then** it goes through
   just as in scenario 1.
3. **Given** the whole budget is really used up (including what is kept for
   sign-ins), **When** an athlete signs in, **Then** they get the "Strava ist
   gerade ausgelastet" notice as today, and Strava's limit is not exceeded.

---

### User Story 3 - One notification after a backlog, not dozens (Priority: P2)

Rider A's 300 synced activities raise A's Rynke and earn two badges along the
way. A gets one notification once all 300 are worked out, not one for every
step on the way.

**Why this priority**: Without it, the fair order of User Story 1 turns a
backlog into a slow trickle of pushes over an hour, which riders switch off.

**Independent Test**: With the fake Strava, send 300 activity events for rider A
whose Rynke rises and who earns two badges during them. A's devices get no
notification while A has work waiting and exactly one when A's queue is empty,
naming the rise and both badges.

**Acceptance Scenarios**:

1. **Given** rider A has activities waiting, **When** one of them raises A's
   Rynke or earns A a badge, **Then** no notification is sent yet.
2. **Given** A's queue becomes empty, **When** A's Rynke is higher than when the
   backlog started or badges were earned meanwhile, **Then** A gets one
   notification for the whole backlog (feature 010 FR-015, feature 013 R17);
   if nothing rose and no badge is new, none.
3. **Given** A's backlog earns the team a team badge, **When** it is earned,
   **Then** the other riders it is new to are notified only once A's queue is
   empty, together with anything else A's backlog earned the team (#125).
4. **Given** rider B has no backlog, **When** B's single ride raises B's Rynke,
   **Then** B is notified as today, whatever A's backlog does.
5. **Given** a rider with a single ride waiting, **When** it is worked out,
   **Then** they are notified exactly as today; a queue of one is a backlog that
   empties at once.

---

### User Story 4 - See how far my rides are (Priority: P2)

While rider A's 300 activities are worked through, A's own pages say so, with
how many are done: "120 von 300 Aktivitäten geholt". A new rider whose import
continues after their first points appear sees how many have been fetched so
far.

**Why this priority**: Riders otherwise wonder why yesterday's rides are
missing and ask the organisers; with User Story 3 there is not even a
notification to tell them.

**Independent Test**: Send 300 activity events for rider A and open A's pages
while they are worked through: the line shows the count done and the total,
the count rises without a reload, and the line goes when the queue is empty.
For a synthetic rider with 450 activities since the season start, the line
appears once the waiting page ends and counts the fetched activities until the
import is done.

**Acceptance Scenarios**:

1. **Given** rider A has activity events waiting, **When** A opens their own
   pages, **Then** a line says how many of them are done and how many there are
   ("120 von 300 Aktivitäten geholt").
2. **Given** more of A's activities arrive meanwhile, **When** A looks again,
   **Then** the total includes them.
3. **Given** the line is shown, **When** activities are worked out, **Then** the
   count rises without A reloading the page.
4. **Given** A's queue becomes empty, **When** A looks, **Then** the line is gone.
5. **Given** a new rider's import continues after its first part (their first
   points are shown, the waiting page of feature 015 has ended), **When** they
   look at their pages, **Then** the line says how many activities have been
   fetched so far and that more follow ("Bisher 200 Aktivitäten geholt, weitere
   folgen"), without a total, since it isn't known until the import is done.
6. **Given** another rider, an organiser or the team page, **When** they look,
   **Then** they never see A's line; it is A's alone.
7. **Given** a rider with only a few activities waiting, **When** they open
   their pages, **Then** no line is shown.

---

### Edge Cases

- **Daily limit reached**: work that has to wait for the next day waits in the
  same fair order; a rider with a single ride is still served first when the day
  starts.
- **The same activity changes several times while waiting** (an update after the
  create, a delete): the outcome is Strava's current state, as today (feature
  001 FR-017); waiting must not make a deleted activity reappear.
- **A rider disconnects or is deleted while their backlog waits**: their waiting
  work is dropped, nothing of theirs is fetched afterwards, and the deletion
  itself is never delayed by the backlog (Principle I).
- **A rider needs to reconnect** (refresh refused) while their backlog waits: the
  rest of their backlog doesn't use any budget until they reconnect.
- **Strava answers 429 anyway** (another app's usage, a limit lowered without
  notice): everything backs off until the next window as today; nobody's place
  in the fair order is lost.
- **Strava raises the limits** after the Developer Program review: the shares
  grow with them, read from Strava's headers as today, without a code change.
- **Most of the backlog is from before the season start** (a history import):
  each still costs one read, because an event doesn't say when the activity
  started; the backlog is dropped activity by activity after fetching, as today.
- **Webhook bursts**: Strava's deliveries are still acknowledged at once and
  never call Strava inline (Principle II), however long the backlog.
- **A rider's queue empties while they are disconnected or deleted**: no held
  notification is sent.
- **Held notifications and the 7-day give-up** (feature 001 R7): if some of a
  rider's work ends up in the failed work, their queue counts as empty for
  notifications and the count; the line doesn't stay up for days.
- **The line and the waiting page**: the waiting page (feature 015) stays as it
  is until a rider's first points exist; the line only appears after it.
- **Notifications and evaluation** that need no Strava call (`send-notification`,
  `evaluate-rider`) are not held back by the Strava backlog.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST keep Strava's limits exactly as today: background
  work stops at the same distance from the 15-minute and daily limits (research
  R6), honours `429` and Strava's usage headers, and a backlog is a throttled
  job, never a burst (constitution Principle II).
- **FR-002**: When several riders have work waiting for Strava, riders MUST take
  turns, one Strava request each (round robin), so that no rider waits behind
  more than one request of each other waiting rider.
- **FR-002a**: A rider whose queue was empty and who now has work MUST get the
  next turn; several such riders take their turns in the order their work
  arrived. Otherwise the rider served least recently goes first.
- **FR-002b**: New work for a rider who already has work waiting MUST join the
  end of that rider's queue and MUST NOT move the rider's turn forward.
- **FR-003**: Within one rider, work MUST be done first in, first out; FR-017 of
  feature 001 (converge to Strava's current state) keeps holding.
- **FR-004**: When only one rider has work waiting, they MUST be able to use the
  whole background budget; fairness MUST NOT leave budget unused.
- **FR-005**: The app's own bulk work (a rider's import and re-reads, the daily
  membership checks) MUST take part in the same fair order as the rider it is
  for, so that a new rider's import doesn't delay other riders' new rides
  either.
- **FR-006**: A small part of each 15-minute window MUST be kept for requests
  made while a person waits on a page: sign-in (token exchange, club check),
  reconnect and token revocation on account deletion. Background work MUST NOT
  use that part.
- **FR-007**: Every Strava request, including the OAuth token exchange, refresh
  and revocation, MUST be counted against the budget as far as Strava reports
  usage for it, and MUST respect it; none may go out once the whole budget,
  including the kept part, is used.
- **FR-008**: A sign-in MUST only be refused as "Strava ist gerade ausgelastet"
  when the kept part is used up too, not because background work used its share.
- **FR-009**: Waiting for the budget MUST NOT use up a message's retry attempts
  or move it to the failed work, however long the backlog (as today).
- **FR-010**: Work for a rider who is deleted, deauthorised or needs to reconnect
  MUST NOT use any budget; a deletion MUST NOT wait behind any backlog.
- **FR-011**: Work that needs no Strava call MUST NOT wait for the Strava budget
  (notifications are held by FR-015, not by the budget).
- **FR-012**: *(Removed 2026-10-29: the backlog view needs an administrator
  role; see Clarifications.)*
- **FR-013**: Logs MAY say that a rider's work is waiting for the budget, but
  MUST NOT log tokens or activity contents (as today).
- **FR-014**: The behaviour MUST be testable with the fake Strava and in Vitest
  with mocked Strava responses only; no test contacts Strava (Principle V).

- **FR-015**: While a rider has Strava work waiting, the app MUST NOT send that
  rider any new Rynke or badge notification. When their queue becomes empty, it
  MUST send at most one notification covering the whole backlog: the rise of
  their Rynke since the backlog started and every badge earned meanwhile; none
  if there is nothing to tell.
- **FR-016**: Team badge news set off by a rider's backlog MUST be held the same
  way and sent once that rider's queue is empty, at most one notification per
  receiving rider for that backlog. Team badge news set off by other riders'
  work is not held.
- **FR-017**: A rider without a backlog (nothing waiting before their work
  arrived) MUST be notified as today, at once (feature 010 FR-015).
- **FR-018**: While a rider has at least 10 activity events waiting, their own
  pages MUST show how many of the events since the backlog began are done and
  how many there are in all ("120 von 300 Aktivitäten geholt"); once shown, the
  line stays until their queue is empty.
- **FR-019**: While a rider's import (feature 001 FR-014, R8) continues after
  their first points exist, their own pages MUST show how many activities have
  been fetched so far and that more follow, without a total.
- **FR-020**: The line MUST update without a reload, at the waiting page's
  cadence (`READY_POLL_SECONDS`, feature 015), MUST NOT cause any Strava request,
  and MUST disappear once the queue is empty.
- **FR-021**: The line MUST only be shown to the rider it is about; organisers,
  the team page and other riders never see it.
- **FR-022**: The line's texts MUST be in the catalogs, in every language
  (FR-028).

### Key Entities

- **Strava budget**: the app-wide usage and limits per 15-minute window and day,
  as Strava reports them (exists today), now split into the background share and
  the part kept for sign-ins.
- **Waiting Strava work**: per rider, the work that needs Strava and has not
  been done yet, in arrival order, with when the rider was last served (to give
  them their turn), how many events have arrived since the queue was last empty
  and how many of them are done (for the line), the rider's Rynke when the
  backlog started and the badges earned during it (for the one notification).
- **Held notifications**: per rider with a backlog, the riders (themselves or
  others, for team badges) who are owed a notification once it is done. It never holds activity contents, only identifiers, like
  queue messages today.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With the default limits and one rider's backlog of 300 activities,
  another rider's new ride is shown on Rides within 20 minutes of Strava's event
  (today: about an hour).
- **SC-002**: During any backlog, 100% of sign-ins by club members succeed while
  the kept part of the window isn't used up; in the test with a 300-activity
  backlog, every sign-in succeeds.
- **SC-003**: In every test and in production, the recorded usage never goes
  beyond the stopping points of today (90 of 100 reads per 15 minutes, 950 of
  1,000 a day, at default limits), and no request is answered `429` because of
  the app's own traffic.
- **SC-004**: A lone rider's backlog of 300 activities is done no more than 15
  minutes later than today.
- **SC-005**: Every activity of a backlog is evaluated exactly once in the end;
  none ends up in the failed work for having waited.

- **SC-006**: A rider whose backlog of 300 activities raises their Rynke and
  earns badges gets exactly one notification, after the last one is worked out.
- **SC-007**: During a backlog of 300 activities, a rider can see on their own
  pages, at any moment, how many are done, accurate to within one activity and
  one poll interval.

## Assumptions

- The default limits (100 reads per 15 minutes, 1,000 a day) stay until Strava's
  Developer Program review raises them; the shares scale with the limits Strava
  reports.
- Kept for sign-ins: about 10 reads per 15-minute window (one sign-in takes 2–4
  requests, and the team has at most a few sign-ins at once, e.g. at a team
  evening). The plan settles the exact number; it comes out of the background
  share, so the overall stopping points don't move.
- Token requests are counted from Strava's usage headers when it sends them,
  like every other request; any it doesn't report are covered by the margins
  that stay below the limits.
- Fairness is per rider, not per kind of work: one rider's own new ride and
  their import compete within that rider's turn, in arrival order.
- The line's threshold is 10 waiting activity events, so a ride or two waiting
  for a moment don't flash a line; the plan may tune it.
- "Aktivitäten" counts activity events that need Strava (new and changed
  activities), not rides: most are new activities, and riders know the word
  from Strava. A deleted activity needs no Strava call (FR-011), so it is
  handled at once and not counted.
- Staying within Cloudflare's free tier (Principle IV) is not affected: the
  number of Strava requests doesn't change, only their order.

## Out of Scope

- Raising the limits or spreading requests over several Strava apps.
- Skipping activities before fetching them (an event doesn't carry the start
  date; feature 001 R5 still applies).
- Showing the backlog to anyone (an administrator page, [backlog
  idea](../backlog/strava-backlog-view.md)).
- Any change to what is fetched or stored, to the points rules, or to the
  webhook's handling.
