# Contract: Queue messages and scheduled work (additions)

Extends feature 001's
[queue-messages contract](../../001-strava-connect-webhook/contracts/queue-messages.md).
Its common consumer rules apply unchanged.

## Changed handlers

`activity-event`, `import-page` and `reread-page` keep their decision tables and
their Strava requests. Only their final write changes: instead of writing
activities directly, they call `applyAndEvaluate` with the `upsert` or `delete`
change, so the activity, its ride results and the balance commit in one batch
(research R11). A title-only update still writes nothing.

## New message: `evaluate-rider`

```ts
{ kind: "evaluate-rider"; athleteId: number }
```

| Step | Behaviour |
|---|---|
| Rider check | Common rule 1: missing or `needs_reconnect` riders are dropped. |
| Work | `applyAndEvaluate` with `{ kind: "none" }` under `CURRENT_RULES`. No Strava request, no budget check. |
| Result | `ok`; a D1 failure is transient (common rule 3). |
| Idempotency | Running it any number of times leaves the same rows; the second run writes nothing. |

Sent by:

- the OAuth callback after it removed private activities on a narrowed scope
  (research R11);
- the daily sweep below.

## Scheduled: evaluation sweep

A step added to the daily cron, after the existing ones. It sends one
`evaluate-rider` per connected rider returned by `listRidersNeedingEvaluation`
(no balance; a row with another `rules_version`; an activity without a current
ride result), in `sendBatch` chunks of 100 (research R14).

## Queue usage

`evaluate-rider` is sent only by the sweep and on scope narrowing: about one per
rider after the first deploy and after each rules-version bump, otherwise near
zero. Activity events add no messages.
