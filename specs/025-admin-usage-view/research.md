# Research: Admin View with Usage Statistics

## R1. Counting this team's Strava requests

**Decision**: Add own counts and peaks to the single `strava_rate_limit` row and write them
in the `UPDATE` that `recordRateLimitHeaders` already runs for each response. `stravaFetch`
passes whether the request is a read (`GET`). A count is only added when the response has
usage headers, because only then is it known that Strava counted it.

**Rationale**: No extra row is written, even at 6,000 requests a day. A separate row per
call would use up to 6 % of the daily write allowance, breaking SC-006.

**Alternatives**: A per-request log, which is too expensive. Counting in the queue consumer
would miss sign-ins and revocations.

A lost update between two simultaneous calls costs one count, which then shows as not
attributed. "Not attributed" is `max(0, total - own)`.

## R2. Recording

**Decision**: A new cron, `58 * * * *`, upserts today's values into `usage_daily`. It runs
beside the existing daily cron, and `handleScheduled` dispatches on `controller.cron`. The
last run of a day is at 23:58 UTC, so a day's record can miss its last two minutes.

**Rationale**: The current day's Strava and Cloudflare figures both reset at 00:00 UTC, so
the record must be written before that. It is an upsert by day and allowance, so a repeat
can't double-count (FR-016) and a missed day stays a gap (FR-015).

**To verify for feature 026**: We recall the Free plan allowing 5 cron triggers per
account. Two teams with two each fit, but this should be checked before adding a third.

**Alternatives**: One hourly cron that also runs the daily work would save a trigger, but
it changes when daily work runs for no present need.

## R3. Cloudflare's figures

**Decision**: One GraphQL request per run to `https://api.cloudflare.com/client/v4/graphql`
with an Analytics Read token. It covers yesterday and today, so Cloudflare's later
corrections reach yesterday's record. Details are in
[contracts/cloudflare-analytics.md](contracts/cloudflare-analytics.md). The page reads only
D1. On failure, stored rows stay, the failure time is kept, and the view shows the last
known value with its time (FR-011).

**Rationale**: A page that called Cloudflare would be slow, and could fail with it.
Results are grouped by Worker, database and queue and then summed, so feature 026 can split
by team with no new query.

**To verify**: Dataset and field names come from Cloudflare's docs, which don't say whether
`workersInvocationsAdaptive` needs a `scriptName` filter or which dataset holds each D1
field. They must be confirmed by introspection during implementation, by the maintainer or
with their explicit go-ahead, since this touches production resources.

## R4. Cost

| Per day | Amount | Share |
|---|---|---|
| Worker runs | 24 | 0.02 % of 100,000 |
| Rows written (13 rows × 24: 8 for today, 5 Cloudflare rows for yesterday) | 312 | 0.3 % of 100,000 |
| Rows read (counting riders at capacity × 24, small lookups) | about 24,000 | 0.5 % of 5 million |
| Queue operations, alerts only | a few on alert days | well under 1 % |

The count of riders is the largest item only at full capacity. Viewing adds little.
`usage_daily` is `WITHOUT ROWID`, because D1 also counts writes to a separate key index, which
would double the rows written.

## R5. Alerts

**Decision**: After recording, compare each alerting allowance with 80 % and 95 %. `INSERT
OR IGNORE` into `usage_alerts`; only an inserted row sends, through the existing
`notifyRiders` with the administrators' IDs. The device fetches its text from
`/me/notification-text`, which returns an alert for an administrator if one was fired in the
last 15 minutes. See [contracts/alerts.md](contracts/alerts.md).

**Rationale**: It reuses feature 010 unchanged, including payload-free pushes and devices
that were cleaned up. Inserting first gives at most one notification per period, even when
a run repeats. A lost push isn't retried: the view still marks the figure.

**Accepted**: A rider's "new Rynke" notification arriving within the same 15 minutes shows
the alert instead. The Rynke aren't lost, and only administrators are affected.

**Switch**: Each administrator can turn Cloudflare's alerts off (FR-039), stored as
`riders.cloudflare_alerts`. It only narrows the recipients, so recording and the view don't
change. A per-rider column is enough: one more row per team, or a table of settings, would
add a read or a join for a value that is only needed for administrators.

**Levels**: Daily allowances use the UTC day as period. Storage and connected riders use a
fixed period, and their rows are deleted when the value falls below the level, so a later
rise notifies again. Strava's 15-minute figures never alert, because budget logic runs up
to them by design.

## R6. Removal

**Decision**: As `handleDisconnect` does: revoke with the stored token, retrying once if
transient, then delete regardless. The delete is one D1 batch: `INSERT OR IGNORE` the block
entry, insert the removal record, delete the rider. If the revoke failed, the administrator
is told, and the rider's token is gone anyway.

**Rationale**: The batch is atomic, so a rider can't be deleted but unblocked. The existing
cascade removes all their rows, and queued work for them is already dropped.

The form posts the rider's ID in its URL, as organiser pages do. FR-019 is about what is
displayed, and it isn't displayed.

## R7. Block list

**Decision**: `blocked_athletes` holds only the ID and is `WITHOUT ROWID`. The check is the
first step after the code exchange in `handleCallback`: revoke the new token and redirect to
`/notice/blocked`, before reading clubs or storing anything. No other path needs a check,
because a rider without a row gets nothing else: events for them are dropped.

**Rationale**: Strava only reveals who is connecting at the code exchange, so that one
request can't be avoided (FR-030). `WITHOUT ROWID` stores by ID, so no insertion order can
link an entry to the removal log (FR-023), and it needs no timestamp.

## R8. Consent

**Decision**: `CONSENT_VERSIONS` gets version 2, with `changes` naming the new text. The
overview filters with `sharedRiderIdsSince(2)` (FR-038), and existing sharing keeps
`SHARING_SINCE_VERSION`, so leaderboards don't change.

**Rationale**: Connection state and dates are newly shown to someone other than the rider,
which Principle I counts as growth. The block list alone isn't growth, but `landing.leave`
promises deletion of all data, and that text is versioned.

**Accepted**: The riders who most need support may be the ones who don't visit, and so have
no row until they agree. The overview counts them. The maintainer can still look them up.

Text to change, in German and English: `landing.leave`, a new `consent.admins`, the privacy
page, and a sentence in `consent.short.shown`.

## R9. Constitution amendment

**Decision**: Before code, add to Principle I's deletion rule (version 2.3.0, MINOR):

> The one exception: when an administrator removes a rider, the team keeps that rider's
> Strava athlete ID on a block list, and nothing else, so they can't connect again. The
> consent text and privacy notice MUST say so.

## R10. Access and pages

**Decision**: `riders.administrator` is set by hand like `riders.organiser`, and read with the
rider on each request. `adminPage` and `requireAdminPost` follow `organiserPage` and
`requireOrganiserPost`. Admin is a tab shown only to administrators.

**History**: reuse `src/http/charts.ts` and its table alternative. No design draft exists yet
for these pages, so they follow the organiser pages. A linked draft takes precedence.

## R11. Waiting work and estimate

**Decision**: Count `strava_work` rows and estimate with a pure function: one read per item
at the rate left after reserves, limited by what's left today. The view says "about".

## R12. Local development

**Decision**: Fake mode seeds synthetic `usage_daily` rows and an administrator among the
sample riders. Without a token the recording marks Cloudflare as unavailable, without
contacting it. Tests stub `fetch`.

## R13. What feature 026 inherits

Each record has a team label from a new `TEAM_ID` setting and the team's own count, and
Cloudflare's results can be split by resource. A second team's usage before 026 shows as not
attributed. Records don't say which Cloudflare account they belong to; a split of accounts
adds that with its own migration.
