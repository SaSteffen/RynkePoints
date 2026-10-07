# Contract: Rise Detection and Push Delivery

**Feature**: [../spec.md](../spec.md) | **Research**: R3–R7

## Which changes notify (FR-015, FR-016)

`rose` is computed in `src/rynke/apply.ts`. Each caller decides whether to act
on it.

| Caller | Change | Notifies on `rose`? |
|---|---|---|
| `work/activity-event.ts` | Strava create/update/delete of one ride | **yes** |
| `teamEventChange` (organiser pages, later) | attendance added/removed, event changed/deleted | **yes**, for each rider in `rose` |
| organiser corrections (003 Story 6, later) | correction added/changed | **yes**, same pattern |
| `work/activity-page.ts` via `import-page` | past-season import | no |
| `work/activity-page.ts` via `reread-page` | one-time re-read | no |
| `work/evaluate-rider.ts` | rule change, catch-up, race settling | no |
| `http/auth.ts` | private rides removed after a scope change | no (it can't rise anyway) |

`rose` is `true` when, comparing the stored state before the change with the
state after it, both evaluated now under `CURRENT_RULES` and the current
counting window, `trainingRynke` or `teamRynke` is higher afterwards.

Expected outcomes, each one a test case:

| Case | `rose` |
|---|---|
| New ride earning 7 Training Rynke | true |
| Ride earning 0 (too slow, walk, `flagged`, after the deadline) | false |
| Same ride delivered twice | true, then false |
| 78 km recording replaced by an overlapping 80 km one (+1) | true |
| Overlap replaced by a shorter recording | false |
| 9 km ride taking elevation past the next 1000 m | true |
| Ride deleted | false |
| Rules version bumped, `evaluate-rider` run | (not consulted) |
| Ride arrives while stored results are of the old rules version, and the ride itself earns 0 | false |
| Team training attendance added for 2 riders | `rose` lists both |
| Attendance removed again | `rose` is empty |

## Enqueuing

`notifyRiders(ctx, athleteIds)` in `src/work/send-notification.ts`:

1. Reads `subscription_id` for those riders (one statement).
2. Calls `sendAll` with one message per row.
3. Catches and logs every error (`console.error` with the error name and
   count only), so the caller's evaluation is never failed (FR-018).

## Queue message

```json
{ "kind": "send-notification", "athleteId": 123, "subscriptionId": 45 }
```

`parseWorkMessage` validates both IDs with `isId`, and
`serializeWorkMessage` writes the keys in this order.

## Handler `sendNotification`

| Step | Outcome |
|---|---|
| Row for `(subscriptionId, athleteId)` missing | `ok` (drop) |
| Endpoint host not allowed | delete row, `ok` |
| `sendPush(endpoint, ctx)` returns `sent` | `ok` |
| `gone` (404, 410) | delete row, `ok` |
| `refused` (other 4xx) | log status + host, `ok` |
| `transient` (429, 5xx, network) and `attempts < 4` | `transient` (consumer backoff) |
| `transient` and `attempts ≥ 4` | log, `ok` |

`consumer.ts`: a `send-notification` result is never written to
`failed_work`, even on `MAX_ATTEMPTS` (defence in depth; the handler already
stops at 4).

## Push request (`src/push/send.ts`)

```http
POST <endpoint>
TTL: 86400
Urgency: normal
Topic: new-rynke
Authorization: vapid t=<ES256 JWT>, k=<base64url public key>
Content-Length: 0
```

- **Body**: none, so there is no `Content-Encoding` header.
- **JWT header**: `{"typ":"JWT","alg":"ES256"}`.
- **JWT claims**: `{"aud":"<endpoint origin>","exp":<now+43200>,"sub":"<PUSH_SUBJECT>"}`.
- **Logging**: no endpoint, JWT or key is logged.

| Response | `PushOutcome` |
|---|---|
| 200, 201, 202 | `sent` |
| 404, 410 | `gone` |
| 429, 500–599, `fetch` throws | `transient` |
| any other status | `refused` |

## What the device shows (`public/sw.js`, `push` event)

```js
showNotification(text.title, {
  body: text.body,
  tag: "new-rynke",
  renotify: true,
  icon: "/icons/icon-192.png",
  badge: "/icons/badge-96.png",
  data: { url: "/me" },
});
```

`notificationclick` closes the notification. It then focuses an open
RynkePoints window and navigates it to `/me`, or opens `/me` if none is open
(FR-019).
