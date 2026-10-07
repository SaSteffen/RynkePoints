# Contract: activity processing changes

This extends 001's
[queue-messages.md](../../001-strava-connect-webhook/contracts/queue-messages.md)
and [strava-api-usage.md](../../001-strava-connect-webhook/contracts/strava-api-usage.md).
No new message kind, endpoint or scope.

## `activity-event` decision table

There is one row change. Every other row is unchanged.

| Event | Before | Now |
|---|---|---|
| `update` whose `changed` is exactly `["title"]` | ack, nothing read or written | Same as any update: `GET /activities/{id}`, then upsert (with the name) and evaluate. On `not-found` or `forbidden` the ride is removed, as for other updates. |

Rynke and ride results keep their values, because the figures are unchanged
(FR-004). Only `activities.name`, `activities.refreshed_at` and
`ride_results.activity_refreshed_at` change.

## `reread-page`

The message shape and the flow are unchanged. Triggered by
`ACTIVITY_FIGURES_VERSION = 3`:

1. `GET /athlete/activities?after=<season start>&page=N&per_page=200`. Each
   listed cycling ride within the rider's grant is upserted, including its name.
2. A full page (200) enqueues page N+1.
3. After the last page, rides with a missing **figure** are refetched one by one,
   as before. A missing **name** never triggers a refetch (research R3, SC-003).

## Strava fields read

001's allow-list gains `name` from both
`GET /athlete/activities` (summary) and `GET /activities/{id}` (detailed). There
is no other new field and no new scope (spec Assumptions).

## Fake Strava (`pnpm dev`, 006)

| Change | Where |
|---|---|
| The "Change a ride" form gains a `Name` field. | `dev/fake-strava/pages.ts` |
| A changed name is reported as `updates.title`. | `dev/fake-strava/events.ts`, `updatesFor` |
| `a.strava-activity` hrefs in HTML responses are rewritten to `/_dev/strava/activities/<id>`, a stand-in page with the fake ride's fields. | `dev/worker.ts` (research R9) |
