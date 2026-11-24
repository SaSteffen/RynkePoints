# Contract: Counting Strava Calls

FR-001 to FR-006, FR-020. Every team's app; the gateway makes no Strava calls.

## Call

- `stravaFetch` counts one call under `(today UTC, ctx.stravaAction ?? "unassigned",
  endpoint)` whenever `fetch` returned a `Response`, any status.
- A network error (no response) counts nothing.
- With an `X-RateLimit-Usage` header, the same batch raises the day's `seen` to its
  daily value if higher.
- Counting runs inside the existing best-effort block with the rate-limit headers:
  a failure logs `Strava <endpoint>: could not count the call` (no IDs) and the
  response is returned as before.

## Held back

Counted under `(today UTC, action, endpoint)` when the budget refuses a call
before it is made:

| Where | Endpoint |
|---|---|
| `apiGet` budget refusal | the call's endpoint |
| `postToken` budget refusal (exchange or refresh) | `POST /oauth/token` |
| `revokeToken` budget refusal | `POST /oauth/revoke` |
| ride re-check stand-back before its list request | `GET /athlete/activities` |

Counting a held-back call never changes the result the caller gets.

## Setting the action

| Entry point | Sets |
|---|---|
| queue consumer, per message, before the handler | `actionOf(message)` |
| drain, per item, before the handler | `actionOf(item.message)` |
| OAuth callback | `connect` |
| leaving on `/me`, removing on Admin › Rider | `leave` |
| daily withdrawal retry (`settleWithdrawals`) | `leave` |

`actionOf` maps message kinds as in [research.md](../research.md) R2 and returns
nothing for kinds that make no Strava calls. A handler gets a copy of the context
with the action set; the notification-holding context the drain builds keeps it.
