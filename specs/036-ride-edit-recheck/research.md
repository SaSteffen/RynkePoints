# Research: Ride Edit Re-check

## R1. Where a check runs: one queue message per check

**Decision**: The hourly cron only chooses riders and sends one `recheck-rider` message per check.
The queue consumer does the check. The message does not go through the Strava work table.

**Rationale**: The free plan allows 50 subrequests per invocation, and every D1 query counts as
one (Cloudflare Workers and D1 limits pages, read 2026-11-13). A check needs about 10 (rider, budget
row, backlog count, token, the Strava request, the usage headers' read and update, the stored
rides, the write batch, the bookkeeping), more with a token refresh. The cron invocation, which
also records usage, could do four checks at most; a team at capacity needs 42 per run. A message
per check gives every check its own invocation.

The Strava work table (feature 024) is for work that must not be lost and waits its rider's turn.
A check is the opposite: droppable, one request, never retried (FR-017). Going through the table
would also write two more rows per check (insert, delete), against FR-019.

**Cost**: 3 queue operations per check (write, read, delete). 300 checks a day are 900 of the
account's 10,000 (9%); 999 riders at once a day about 3,000 (30%). The usage view already shows
queue operations.

**Alternatives**: Checks inside the cron invocation (too few subrequests). One message carrying
several riders (saves operations, but one failure then affects the others and the batch comes back
as a burst). A further cron every 15 minutes (the account's five cron triggers are all in use).

## R2. No burst: delays inside the hour

**Decision**: The `i`-th of a run's `k` messages is sent with
`delaySeconds = floor(i × 3300 / k)`, so a run's checks are spread over 55 minutes, never closer
than 60 seconds (the largest run is 50 checks, R4).

**Rationale**: FR-013 and the constitution ("never a burst"). The consumer takes batches of up to
10 messages that arrive within 5 seconds; a minute between messages keeps each check in its own
invocation, which R1 relies on. A delay costs no further queue operation.

**Alternatives**: Sending all at once and letting the consumer pace them: ten checks in one
invocation would exceed the subrequest limit.

## R3. Reading the list

**Decision**: A new client call `listNewestActivities`: `GET /athlete/activities?page=1&per_page=200`,
without `after`, priority `background`. The handler checks that `start_date` never increases from
one entry to the next; otherwise the check fails as `unordered` (FR-026).

**Rationale**: With `after`, as the import asks, Strava returns the oldest first, which for a rider
with more than 200 activities would be the wrong 200. Without it the list is newest first according
to client libraries (stravalib); Strava's reference is silent on the order and on the 200.

**To verify before implementation** (quickstart, "Before building"): one real request by the
maintainer against their own account, confirming 200 per request and newest first. If it shows
something else, this plan is revisited before any code.

## R4. The size of a run

**Decision**: A pure function of the hour, the team's allowance `A`, the active riders `n` (R13) and
how many of them were last checked 23 or more hours ago (`overdue`):

- `base(h) = floor((h+1) × A / 24) − floor(h × A / 24)` for the UTC hour `h`: 6 or 7 for 150, and
  exactly `A` over a day.
- `size = min(n, 55, max(base(h), min(overdue, ceil(n / 20))))`.

**Rationale**: `base` spends the allowance evenly (FR-009). Riders who would pass 24 hours before
the next run are taken even beyond the allowance (FR-011), but never more than `ceil(n / 20)` per
run, which is a run's own number at once-a-day pace with a little room to catch up, so a run after
skipped runs is no larger than any other (FR-013). At 999 riders that is 50 a run. The 55 follows
from R2.

**Consequence for the spec**: a rider is taken one run early (23 hours) so that the check, which
may be delayed by up to 55 minutes, still happens within 24. A team therefore stays inside its
allowance up to about 140 riders (150 × 23 / 24), not 150. SC-004 and the assumption were
corrected.

## R5. The order, and the "last checked" stamp

**Decision**: One nullable column `riders.rechecked_at`. The run reads the eligible riders
(connected, import done, active: R13) with the stamp and a fast-lane flag in one query, orders
them in code
(FR-010: 20 hours or more first, then the fast lane up to half the run, then the rest; longest ago
first, never checked first of all) and stamps the chosen riders in the same batch that precedes
sending. The message carries the stamp it set and the value before. A check that is skipped or
fails puts the old value back, if the stamp is still the one it set.

**Rationale**: FR-019 allows one row per check. Stamping at the run is that one row, and makes a
second run in the same hour find nobody due (edge case). Putting the old value back on failure
keeps the rider's place in the order (FR-017) and costs a write only when something went wrong.

**Accepted**: If sending fails after stamping, or a message is lost, the rider waits one more
cycle. Queues delivers at least once, so this needs a failure between two statements.

**Alternatives**: Stamping on success only: a repeated run would send the same riders twice.
Two columns (queued, checked): two rows per check.

## R6. Who is in the fast lane

**Decision**: Part of the run's rider query: a rider has a row in `ride_results` with
`counts = 0`, whose activity started within the last 7 days, and whose `reasons` contain one of
`pause`, `too_slow`, `too_fast`, `climbing_rate`, `overlap`. The fixable set is a constant next to
the reason codes in `src/rynke/rides.ts`, with a test that every reason code is either fixable or
explicitly not, so a new reason must be sorted.

**Rationale**: FR-012 says "at least one fixable reason", so a ride that is too slow and also
flagged still qualifies. The stored verdicts are current (every change re-evaluates), so no
evaluation is needed at the run.

## R7. Comparing and writing

**Decision**: The handler turns the list into records with the import's own conversion and scope
rule (extracted from `storeActivityPage` so both share it), reads the rider's stored rides, runs
and swims, and keeps only records that are new or differ in a stored figure other than the refresh
time. Where the listed value is missing and the stored one isn't, the stored one is kept and is no
difference (FR-006). If nothing remains, nothing more is written. Otherwise the remaining records
go through the same evaluate-and-notify path as a reported activity.

**Rationale**: `applyAndEvaluate` writes every record it is given, so the comparison must happen
before it (FR-007). After it, only changed verdicts, balances and badges are written, as today.
Activities missing from the list are never touched (FR-006). An activity arriving by event and by
check converges, because both are upserts by activity ID followed by a full evaluation.

**Rows read**: about 200 per check: 60,000 a day at the allowance, 200,000 at 999 riders, of
5 million.

## R8. Standing back

**Decision**: Three gates, all from rows the app already keeps:

1. At the run: no message is sent, and nobody stamped, while more than half of the day's Strava
   reads are used.
2. At the check (it may run up to 55 minutes later): the same half-day rule, the existing
   `background` budget decision for the 15-minute window (which keeps the interactive reserve), and
   no check while any Strava work is waiting (import pages, reported events). Each of these ends the
   check as `skipped`.
3. Strava's own refusal: a `429` or a transient error ends it as `failed`; a refused token marks
   the rider as needing to reconnect, as everywhere (FR-018).

A skipped or failed check acks its message. Nothing is re-sent, retried or put in `failed_work`.

**Rationale**: FR-015 to FR-017. "After the import and after reported events" becomes "not while
they wait", which is cheap to ask and can't starve them. The usage row is per team but the headers
it is fed from carry the whole app's usage, so the half-day rule sees all teams.

## R9. What the usage view gets

**Decision**: A table `recheck_daily`, one row per UTC day: checks sent, skipped, failed, lists in
the wrong order, and the largest number of riders found waiting longer than 24 hours at a run that
day. The run adds its numbers in its batch; a check writes to it only when it is skipped or fails.
The view shows the last 14 days below the Strava figures and marks a day with riders over 24 hours
or a wrong order. Pruned with the usage history (13 months).

**Rationale**: FR-022, FR-026. Counting at the run costs one row per run, 24 a day, not one per
check. Checks made are sent minus skipped minus failed.

**Consequence for the spec**: FR-019 and SC-005 said "at most one row per check". With the run's
own row it is one per check plus one per run. Both were reworded.

**Not an alert**: no push for a wrong order or a long wait. The view marks it; alerts stay what
feature 025 defined.

## R10. The allowance as team data

**Decision**: `recheckAllowance` in `TeamData`, 150 for Hamburg and for Europe. A team-data test
and `scripts/team-check.mjs` refuse a sum above 300 (`RECHECK_SHARE` of the daily read limit as a
constant, 10%).

**Rationale**: FR-008, FR-024. A third team means editing the numbers; the check fails the build
until they fit.

## R11. Fake mode and the sandboxes

**Decision**: The fake Strava answers the list without `after` newest first. `/_dev/` gets two
actions: change a sample ride's figures without sending an event, and run the re-check now (the
hourly run's selection, sent without delays). Sandboxes have no cron; the same action serves them.

**Rationale**: US1's independent test, FR-024. Without delays the by-hand check doesn't take an
hour.

## R12. The ride card

**Decision**: `rynke.ride.fix.rename` is replaced by a new key `rynke.ride.fix.wait_recheck` with
the spec's German line, in all ten catalogs; the existing `rynke.ride.fix.wait` is read first and
reused if it already serves this place. `rynke.ride.fix.manual` is unchanged.

**Rationale**: FR-020, SC-008. A new key rather than new text under the old name, so a stale
translation can't survive unnoticed (`all-locales` test).

## R13. Who is checked at all

**Decision**: Part of the run's rider query: a rider is taken only when one of their stored
activities (`activities`, `runs`, `swims`) started within the last 30 days (FR-027). The handler
doesn't ask again. For "waited over 24 hours" a rider counts only when one of their activities
started between 24 hours and 30 days ago, so a rider who starts again after a pause is not shown
as having waited.

**Rationale**: The three tables each have an index by rider and start, so the condition costs a
few rows per rider. `n` in R4 becomes the active riders, which shortens everyone's interval and
moves the 140-rider limit to active riders. A rider returning from a pause has an old stamp or
none and is taken by the next run, first in the order.

**Accepted**: An edit of a ride older than 30 days by a rider with nothing newer is not picked up
until their next activity, and neither is a lost event for the first activity after a pause.

**Alternatives**: A slow pace for paused riders (once a week): more rules for cases that heal with
the next activity. Rides only: a rider who runs for a month would drop out and come back.
