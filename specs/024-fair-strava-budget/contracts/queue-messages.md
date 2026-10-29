# Contract: Queue Messages and the Strava Work Table

Amends feature 001 `contracts/queue-messages.md`.

## Routing in the consumer

| Message | Path |
|---|---|
| `activity-event` with `aspect` `create` or `update` | stored in `strava_work`, then drained |
| `import-page`, `reread-page`, `check-membership` | stored in `strava_work`, then drained |
| `activity-event` with `aspect` `delete` | handled at once, as today |
| `delete-rider`, `evaluate-rider`, `send-notification` | handled at once, as today |
| `strava-turn` | acked; the batch drains |
| anything else | dropped, as today |

Storing checks the rider as today: unknown riders and (for these kinds)
`needs_reconnect` riders are dropped and acked. A stored message is acked at
once; its delivery count so far becomes the row's `attempts`.

## New message

```json
{ "kind": "strava-turn" }
```

No identifiers. Sent by the consumer only, with `delaySeconds` (R4).

## Drain

Up to `DRAIN_LIMIT` (50) items per invocation:

1. Pick the next item (research R2). None ready: if rows wait for a backoff,
   wake at the earliest `not_before`; stop.
2. Load the rider. Gone or `needs_reconnect`: delete their rows and queue row;
   continue.
3. Run the handler with `{ attempts, isLastAttempt }` from the row, with
   `send-notification` held back (R6). A thrown error is `transient`.
4. Apply the result (R3). `budget`: wake at `delaySeconds`; stop.
5. After every finished item: release or hold notifications (R6); count
   `events_done` for an activity event; delete the queue row when the rider's
   last row is gone.

The limit reached with work ready: wake at once.

## Scheduled

The daily cron drains once after its fan-outs.
