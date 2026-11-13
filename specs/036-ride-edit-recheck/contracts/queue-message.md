# Contract: the `recheck-rider` message and its handler

Extends `specs/001-strava-connect-webhook/contracts/queue-messages.md`.

## Message

```json
{ "kind": "recheck-rider", "athleteId": 123, "stamp": 1794553080, "previous": 1794524280 }
```

| Field | Type | Meaning |
|---|---|---|
| `athleteId` | positive integer | The rider |
| `stamp` | epoch seconds | What the run wrote to `riders.rechecked_at` |
| `previous` | epoch seconds or `null` | The value before, put back when the check doesn't happen |

Identifiers and times only, like every message. Sent with `delaySeconds` (research R2).
`waitsForStrava` is `false` for it: it never enters the Strava work table.

## Handler, in order

1. The consumer's common rules apply first: no rider, or a rider who needs to reconnect, acks the
   message and nothing else happens.
2. **Stand back** (research R8): rider not `connected` with a finished import, more than half of
   the day's reads used, the `background` budget decision says no, or Strava work is waiting
   → outcome `skipped`.
3. One request: `listNewestActivities` for the rider. No other request to Strava, whatever the
   answer (FR-002).
   - budget (`429`), transient, forbidden, not found → outcome `failed`.
   - token refused → result `refresh-refused`; the consumer marks the rider (FR-018). The stamp is
     left: the rider is out of the order anyway.
4. **Order**: an entry whose `start_date` is later than the one before it → outcome `failed`,
   counted as `unordered` too (FR-026). Nothing of the list is used.
5. **Compare** (research R7) with the stored rides, runs and swims. Scope as in the import: this
   season, kept sport types, private only with the rider's grant.
6. Differences → the same evaluate-and-notify call as a reported activity. None → no write.

## Outcomes

| Outcome | `rechecked_at` | `recheck_daily` | Message |
|---|---|---|---|
| made (with or without differences) | stays `stamp` | untouched | ack |
| skipped | back to `previous`, if still `stamp` | `skipped + 1` | ack |
| failed | back to `previous`, if still `stamp` | `failed + 1` (and `unordered + 1`) | ack |
| token refused | untouched | untouched | ack, rider needs reconnect |
| exception outside Strava (D1) | untouched | untouched | consumer's ordinary retry; the handler is idempotent |

The handler never returns `budget` or `transient`: neither a re-send nor `failed_work` may follow
a check (FR-017). A redelivered message whose rider's stamp is no longer `stamp` still does the
check if the gates allow; it is one request and converges.

## Guarantees to test

- Exactly one Strava request per message that passes the gates; none otherwise.
- An unchanged list writes nothing (D1 rows written: 0).
- A changed figure, a new activity, an activity that moved between ride, run and swim: stored, and
  verdict, Rynke, badges and notification as for a reported change.
- A listed activity lacking a figure the stored one has: stored value kept, no write.
- A stored activity missing from the list: still stored.
- A list in the wrong order: nothing stored, `failed` and `unordered` counted, stamp put back.
- Each gate: no request, `skipped` counted, stamp put back.
