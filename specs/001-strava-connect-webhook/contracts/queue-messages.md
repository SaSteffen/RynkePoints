# Contract: Queue messages and scheduled work

One queue, `rynke-points-work` (binding `WORK_QUEUE`), consumed by the same Worker:

Amended by feature 024: messages that need Strava wait their rider's turn in a
D1 table, with the retry rules below moved onto the table's rows
([024 contracts/queue-messages.md](../../024-fair-strava-budget/contracts/queue-messages.md)).

- `max_batch_size: 10`, `max_batch_timeout: 5`
- `max_retries: 10`
- `max_concurrency: 1` (research R6)

Message bodies are JSON, discriminated by `kind`, and contain identifiers only.
`serializeWorkMessage` writes them with keys in the order shown below, so the
same message always has the same JSON (used to match `failed_work` rows).

Feature 003 adds the `evaluate-rider` message, the evaluation sweep as the last
scheduled step, and Rynke storage in the activity handlers: see
[its queue-messages.md](../../003-rynke-evaluation/contracts/queue-messages.md).

## Common consumer rules

1. **Rider check.** Load the rider by `athleteId`. If missing, ack and drop. If
   `needs_reconnect`, ack and drop everything except `delete-rider` and
   `activity-event` with aspect `delete`: deletions need no Strava, so a ride
   deleted meanwhile stops counting at once.
2. **Budget deferral.** Before each Strava call, check the rate budget. If it is
   exhausted, or Strava answers `429`, re-send the same body with
   `delaySeconds = min(until the next window or UTC midnight, 43200)` and ack the
   original (R6). The re-sent message starts again at attempt 1, so deferrals never
   use up `max_retries`. 43200 s (12 h) is the Queues maximum; a message that
   arrives while the budget is still exhausted is simply deferred again. Send
   before acking, so a failed send leaves the original to be retried.
3. **Transient error** (network, 5xx): `retry({ delaySeconds: min(30·2^attempts,
   3600) })`. On the last attempt, upsert a `failed_work` row instead, log it, and
   ack (R7).
4. **Refresh refused** (400/401 on token refresh): set the rider to
   `needs_reconnect` with `reconnect_requested_at=now`, then ack. Does not apply
   to `delete-rider`, which never refreshes (see below).
5. **Success.** After a handler returns `ok`, delete any `failed_work` row whose
   `message` equals this message's canonical JSON, so a re-enqueued failure that
   now succeeds stops being retried (R7).
6. **Retry safety.** Every handler is idempotent and converges to Strava's current
   state, so any message may be processed twice.

## Messages

### `activity-event`

```ts
{ kind: "activity-event"; athleteId: number; activityId: number;
  aspect: "create" | "update" | "delete"; changed: string[] }
```

| Case | Action |
|---|---|
| `delete` | Delete the row, if present. |
| `update` with `changed` exactly `["title"]` | No-op until feature 008, which stores the name: now like any other update ([008 activity-processing](../../008-strava-ride-names/contracts/activity-processing.md)). |
| `create`, or any other `update` (including an empty `changed` or unknown keys) | `GET /activities/{id}`. |
| ↳ 404/403 | Delete the row. |
| ↳ not cycling | Delete the row. |
| ↳ `private` and rider lacks `read_all` | Delete the row. |
| ↳ otherwise | Upsert the allow-listed fields. |

### `import-page`

```ts
{ kind: "import-page"; athleteId: number; page: number; after: number;
  startedAt?: number }
```

The first page's `after` is a day before the season start (00:00 Europe/Berlin
on `SEASON_START_DATE`, epoch seconds) at the time the import was started, so
changing `SEASON_START_DATE` only affects imports started afterwards (spec Edge
Cases). A ride belongs to the season by its local date (`start_date_local`), as
it counts, and one ridden just after local midnight east of Berlin starts before
Berlin's midnight; the import keeps only activities whose local date is on or
after `SEASON_START_DATE` (review L-16). With `after`, Strava lists oldest first, so each
next page is `page: 1` after the newest start listed so far, one second earlier:
by page number, an activity deleted between two pages would shift one onto the
page already read (review L-21), and one starting in the same second as the
newest is listed again rather than missed. The next `after` is always past the
current one, so the import ends. `page` is above 1 only on messages sent before
this rule; such a page goes on by start too. `startedAt` is when the import was
started, carried from page to page; messages sent before it existed lack it.

1. `GET /athlete/activities?after=<after>&per_page=200&page=<page>`.
2. Upsert the cycling activities and set `import_status=running`.
3. If 200 items came back, enqueue the next page as above, with the same
   `startedAt`. Otherwise set `import_status=done`, and, given `startedAt`,
   enqueue `activity-event { aspect: "update", changed: [] }` for each stored
   ride, run or swim with `refreshed_at < startedAt`: the list didn't hold it
   (deleted, made private without `read_all`, or no longer kept while the rider
   had to reconnect). The decision table above keeps or deletes it, as the
   re-read does (research R20).

### `reread-page`

```ts
{ kind: "reread-page"; athleteId: number; page: number; after: number }
```

This is the one-time re-read for a rider whose stored activities lack a figure
that was added to FR-013 later (research R20). It is enqueued by the daily cron
(step 4), and the first page's `after` is a day before the season start at that
moment, as for `import-page`. It
pages as `import-page` does.

1. `GET /athlete/activities?after=<after>&per_page=200&page=<page>`.
2. Upsert the cycling activities with the same scope rule as `import-page`.
   `import_status` is not touched.
3. If 200 items came back, enqueue the next page as `import-page` does.
4. Otherwise, for every row of the rider that still has a `NULL` figure
   (`elapsed_time_s`, `is_manual`, `is_trainer` or `is_flagged`), enqueue
   `activity-event { aspect: "update", changed: [] }` (batches of 100). The
   `activity-event` decision table then fills the row or deletes it. This step
   is not repeated, so a field Strava never sends stays `NULL`.

### `check-membership`

```ts
{ kind: "check-membership"; athleteId: number }
```

- Page `GET /athlete/clubs`.
- Club found → set `membership_checked_at=now`.
- Definitively absent → enqueue `delete-rider { reason: "left-club", revoke: true }`.

### `delete-rider`

```ts
{ kind: "delete-rider"; athleteId: number;
  reason: "deauthorized" | "left-club" | "reconnect-expired"; revoke: boolean }
```

1. If `revoke` and the rider has credentials, call `POST /oauth/revoke` with the
   stored **refresh token**. No token refresh happens first, so this also works
   for `needs_reconnect` riders. On a transient error (network, 5xx, 429), retry;
   if retries are exhausted, continue anyway. Any other answer (200, 400, 401, …)
   means there is nothing left to revoke: continue.
2. `DELETE FROM riders WHERE athlete_id=?`, which cascades to credentials,
   activities and `failed_work`.
3. Never written to `failed_work`, and never stopped by a refused refresh or an
   exhausted budget: deletion must complete.

### `recheck-rider`

Added by feature 036: the ride edit re-check, one request for one rider, never
retried and never in `failed_work`. See
[036 contracts/queue-message.md](../../036-ride-edit-recheck/contracts/queue-message.md).

## Scheduled (`scheduled` handler)

Cron: `17 3 * * *` (daily, 03:17 UTC).

1. Enqueue `check-membership` for every rider with `status=connected` (FR-004a).
2. Enqueue `delete-rider { reason: "reconnect-expired", revoke: true }` for every
   `needs_reconnect` rider whose `reconnect_requested_at` is more than 7 days ago
   (FR-020).
3. Delete `failed_work` rows whose `first_failed_at` is more than 7 days ago,
   logging each one as given up (FR-019). Re-enqueue the remaining rows and keep
   them: a row disappears when its message succeeds (rule 5), is given up, or its
   rider is deleted.
4. For every rider with `status=connected` and
   `figures_version < ACTIVITY_FIGURES_VERSION`, enqueue
   `reread-page { page: 1, after: <a day before the current season start> }`, then set
   `figures_version = ACTIVITY_FIGURES_VERSION` (research R20). Send before
   marking: if marking fails, the next run sends again, which is harmless.
5. Delete every stored ride, run and swim whose local date
   (`start_date_local`) is before `SEASON_START_DATE`, through the rider's
   Rynke evaluation. Nothing older is stored: `activity-event` and the import
   pages skip such an activity (and an `activity-event` removes one already
   stored). This step removes what was stored before that rule, by Berlin's
   midnight before review L-16, or under an earlier season start. Such a ride
   never counts, so balances don't change. Runs before feature 003's
   evaluation sweep.
