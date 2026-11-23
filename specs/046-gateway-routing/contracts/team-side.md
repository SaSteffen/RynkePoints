# Contract: Team side

Only with a gateway (`STRAVA_RETURN_VIA` set). Without one, a team sends nothing to it and counts
its own figures only.

## Reports (FR-004, FR-005)

Queued as `{ kind: "report-hold", athleteId }` after:

| Where | What |
|---|---|
| sign-in callback | a new rider or guest stored; an existing one deleted on a refused sign-in |
| `/me/disconnect` | leaving |
| `delete-rider` handler and the consumer's last-attempt deletion | deauthorization, club, reconnect expiry, guest removed |
| `/admin/riders/<id>/remove` | removal (the block list entry is no hold) |
| `/strava/let-go/<token>` | let go for a switch |

A failed enqueue is logged and never fails the action.

The consumer takes `report-hold` before the rider check: it reads whether the team holds the
person now (a `riders` row) and posts `/teams/<id>/report`. `2xx` or `404`: acked. Anything else:
retried with the queue's backoff; on the last attempt dropped with a log line.

## Full list (FR-006)

A daily-run step after the membership checks: every `riders` row's athlete to
`/teams/<id>/list`. `2xx` or `404` is success; anything else fails the step.

## Event counts (FR-020, FR-021)

The webhook sets `route` on `activity-event` and `delete-rider`: `chosen` / `not-chosen` from
`X-Rynke-Route`, else `plain`. On a message's first delivery, at the rider check:

| Rider row | `route` | Counts |
|---|---|---|
| none | any | `dropped` |
| none | `chosen` | also `wasted` |
| present | `not-chosen` | `missed` |

Processing is the same whatever `route` says.

## Re-check finds (FR-023)

`recheck-rider` adds `found` by the number of activities it stores that weren't stored.

## Exchange (FR-024)

Hourly after the usage recording, and on **Update now**: post this team's `missed`, `wasted`,
`dropped`, `found` of the last 30 days to `/teams/<id>/counts`; upsert the answer into
`routing_daily`, except this team's own four figures. A failure is logged and keeps what is stored.

## Retention (FR-026)

The daily run deletes `routing_daily` rows older than 30 days.
