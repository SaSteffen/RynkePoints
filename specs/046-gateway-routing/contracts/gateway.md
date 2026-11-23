# Contract: Gateway (routing)

Extends feature 026's [gateway contract](../../026-second-team/contracts/gateway.md). Its routes,
the team question (`/teams/<id>/held`) and let-go stay as they are and never read the copy
(FR-003).

## Settings

| Name | Kind | Value |
|---|---|---|
| `ROUTING` | var | `off` (shipped; also when missing or unknown), `trial`, `on` (research R2) |
| `ROUTING_COPY` | Durable Object binding | class `RoutingCopy`, used through `jurisdiction("eu")`, instance `copy` |

## Events: `POST /strava/webhook/<verify token>`

As before, plus:

- `off`: one message per team, no lookup.
- `trial` / `on`: the object is asked for the event's `owner_id` within 1 second (FR-002). The
  chosen teams follow research R4; a failure or timeout chooses every team.
  - `trial`: one message per team, each with `chosen: true|false`.
  - `on`: one message per chosen team.
  - After the answer, through `waitUntil`: `copy` or `everyone`, and `allRouting` /
    `allRoutingEveryone` when every team was routing.

Queue message: `{ team, body, chosen? }`. The forward sends `X-Rynke-Route: chosen` or
`not-chosen` when `chosen` is set, nothing otherwise.

## Team routes

All `POST`, `Authorization: Bearer <TEAM_WEBHOOK_TOKEN_<ID>>` as for `/teams/<id>/held`: a team
not in `TEAMS`, without a token, or with a wrong one gets `403`, and changes only its own part
(FR-008). Bodies are JSON; a body that doesn't fit gets `400`.

| Route | Body | Answer |
|---|---|---|
| `/teams/<id>/report` | `{ "athleteId": "<id>", "held": true\|false }` | `200 {}`; `404` while `off` |
| `/teams/<id>/list` | `{ "athleteIds": ["<id>", …] }`, at most 999, body ≤ 64 KiB | `200 {}`; while `off` the whole copy is emptied, then `404` |
| `/teams/<id>/counts` | `{ "days": [{ "day", "figure", "count" }] }`, figures `missed`, `wasted`, `dropped`, `found`, days within the last 30, at most 200 entries | `200 { "days": [{ "day", "team", "figure", "count" }] }`: every count of the last 30 days, `team` `""` for the gateway's own; every mode |

An unreadable object gives `503`; the team retries (report), fails the step (list) or keeps what it
has (counts).

Logs: `<report|list|counts> team=<id> status=<code>` for failures only. Never an athlete, a body
or a token (FR-013).
