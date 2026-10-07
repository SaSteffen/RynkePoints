# Contract: Queue messages and scheduled work

One queue, `rynke-points-work` (binding `WORK_QUEUE`), consumed by the same Worker:

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
   `needs_reconnect`, ack and drop everything except `delete-rider`.
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
{ kind: "import-page"; athleteId: number; page: number; after: number }
```

`after` is the season start (epoch seconds) at the time the import was started.
It is carried from page to page, so changing `SEASON_START_DATE` only affects
imports started afterwards (spec Edge Cases).

1. `GET /athlete/activities?after=<after>&per_page=200&page=<page>`.
2. Upsert the cycling activities and set `import_status=running`.
3. If 200 items came back, enqueue `page+1` with the same `after`. Otherwise set
   `import_status=done`.

### `reread-page`

```ts
{ kind: "reread-page"; athleteId: number; page: number; after: number }
```

This is the one-time re-read for a rider whose stored activities lack a figure
that was added to FR-013 later (research R20). It is enqueued by the daily cron
(step 4), and `after` is the season start at that moment, carried from page to
page.

1. `GET /athlete/activities?after=<after>&per_page=200&page=<page>`.
2. Upsert the cycling activities with the same scope rule as `import-page`.
   `import_status` is not touched.
3. If 200 items came back, enqueue `page+1` with the same `after`.
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
   `reread-page { page: 1, after: <current season start> }`, then set
   `figures_version = ACTIVITY_FIGURES_VERSION` (research R20). Send before
   marking: if marking fails, the next run sends again, which is harmless.
