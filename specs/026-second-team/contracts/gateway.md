# Contract: Gateway (release 3)

Worker `rynke-points-gateway` in `gateway/`, on the subdomain `gateway.<founding domain>`
(research R9). No D1, no rider data, no Strava client secret (FR-008).

## Routes

| Method & path | Answer |
|---|---|
| `GET /strava/webhook/<verify token>?hub.mode=subscribe&hub.challenge=…&hub.verify_token=…` | `200 {"hub.challenge": …}` when the token matches, else `403` |
| `POST /strava/webhook/<verify token>` | `200` after `FORWARD_QUEUE.sendBatch` of one message per team; `400` for a body that isn't a Strava event; `403` for a wrong token. No other work before answering. |
| `GET /auth/return/<teamId>?code&state&scope` or `?error&state` | `302` to `<team origin>/auth/callback` with exactly those params copied; `404` for an unknown team ID |
| `GET /health` | `200 ok` |
| anything else | `404` |

The bounce never takes a host from the request; only `TEAMS` origins are used (FR-007).
The team's callback then checks its state cookie as today (US1 scenario 4).

## Queue consumer

For each message: `POST <team origin>/strava/webhook/<TEAM_WEBHOOK_TOKEN_<ID>>` with the
event as JSON, timeout 10 s. A 2xx acks the message; anything else calls
`message.retry({ delaySeconds })` with growing delays. `max_concurrency` stays low.

A team whose domain is on the gateway's own Cloudflare zone is called through the
service binding `TEAM_SERVICE_<ID>` to its Worker instead, with the same request: a
Worker's `fetch()` to a hostname on its own zone skips the Workers there and answers
404 (found when Hamburg went behind the gateway, 2026-11-09).

Logs: `forward team=<id> status=<code> attempt=<n>`. Never the body, IDs or codes.

## Team-side settings

| Var | Meaning |
|---|---|
| `STRAVA_RETURN_VIA` | `""`: `redirect_uri = <own origin>/auth/callback` (today). Set: `redirect_uri = <via>/auth/return/<TEAM_ID>` |

The team's `/strava/webhook/<token>` keeps working unchanged for direct Strava events
and gateway forwards.

## Compatibility (FR-037)

| Gateway | Team return setting | Subscription points at | Works |
|---|---|---|---|
| absent | empty | team | yes (today) |
| deployed | empty | team | yes |
| deployed | set | team | yes |
| deployed | set | gateway | yes (target) |

Switching back is the same steps in reverse.

## Switching the subscription (manual, Strava owner, FR-011)

1. Confirm a sign-in through `gateway.<domain>/auth/return/<team>` completes (callback
   domain match).
2. Note the time T0. Delete the subscription on the team URL, create it on the gateway URL.
3. Put the new ID in the secret `STRAVA_SUBSCRIPTION_ID_OVERRIDE` of every live team at
   once: it wins over `STRAVA_SUBSCRIPTION_ID` while set and needs no deploy, so the gap
   lasts about a minute. Later set `STRAVA_SUBSCRIPTION_ID` through a pull request and
   remove the secret.
4. Run `pnpm catch-up <T0>` for every team (`POST /admin/catch-up?since=<T0>`, admin
   token): one `reread-page` per connected rider since T0, which stores the rides of the
   gap with their Rynke. The daily run doesn't re-read rides. Runbook:
   [docs/gateway-switch.md](../../../docs/gateway-switch.md).
