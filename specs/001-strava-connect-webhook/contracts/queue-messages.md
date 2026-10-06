# Contract: Queue messages and scheduled work

One queue, `rynke-points-work` (binding `WORK_QUEUE`), consumed by the same Worker:

- `max_batch_size: 10`, `max_batch_timeout: 5`
- `max_retries: 10`
- `max_concurrency: 1` (research R6)

Message bodies are JSON, discriminated by `kind`, and contain identifiers only.

## Common consumer rules

1. **Rider check.** Load the rider by `athleteId`. If missing, ack and drop. If
   `needs_reconnect`, ack and drop everything except `delete-rider`.
2. **Before each Strava call**, check the rate budget. If it is exhausted, use
   `retry({ delaySeconds: until next window })`, which does not count as a failure
   (R6).
3. **Transient error** (network, 5xx, 429): `retry({ delaySeconds: min(30·2^attempts,
   3600) })`. On the last attempt, insert a `failed_work` row instead and ack (R7).
4. **Refresh refused** (400/401 on token refresh): set the rider to
   `needs_reconnect`, then ack.
5. **Retry safety.** Every handler is idempotent and converges to Strava's current
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
| `update` with `changed ⊆ {"title"}` | No-op. |
| `create`, or `update` touching `type`/`private` | `GET /activities/{id}`. |
| ↳ 404/403 | Delete the row. |
| ↳ not cycling | Delete the row. |
| ↳ `private` and rider lacks `read_all` | Delete the row. |
| ↳ otherwise | Upsert the allow-listed fields. |

### `import-page`

```ts
{ kind: "import-page"; athleteId: number; page: number }
```

1. `GET /athlete/activities?after=<season start>&per_page=200&page=<page>`.
2. Upsert the cycling activities and set `import_status=running`.
3. If 200 items came back, enqueue `page+1`. Otherwise set `import_status=done`.

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
  reason: "deauthorized" | "left-club"; revoke: boolean }
```

1. If `revoke`, call `POST /oauth/revoke`. On 503, retry. If retries are exhausted,
   continue anyway.
2. `DELETE FROM riders WHERE athlete_id=?`, which cascades to credentials,
   activities and `failed_work`.
3. Never written to `failed_work`: deletion must complete.

## Scheduled (`scheduled` handler)

Cron: `17 3 * * *` (daily, 03:17 UTC).

1. Enqueue `check-membership` for every rider with `status=connected` (FR-004a).
2. Re-enqueue `failed_work` rows younger than 7 days, then delete all
   `failed_work` rows that were re-enqueued or are older than 7 days.
