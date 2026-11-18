# Contract: Withdrawing a grant unless another team holds the person

**Feature**: [../spec.md](../spec.md) FR-009, FR-012 | **Research**: [../research.md](../research.md) R14

## Pending revocations (each team's D1)

| | |
|---|---|
| Table | `pending_revocations (athlete_id INTEGER PRIMARY KEY, refresh_token_enc TEXT NOT NULL, since INTEGER NOT NULL)` |
| Migration | `migrations/0031_pending_revocations.sql`, add only |
| Written | by every withdrawal; a newer token replaces an older one for the same person |
| Deleted | once settled: revoked, or another team holds the person with a working connection |
| Read | only to settle; the token is decrypted for the revoke and nothing else |

## Where a team withdraws

| When | Token |
|---|---|
| Disconnect (`/me/disconnect`), removal by an administrator, `delete-rider` with `revoke: true` | the stored one, copied before the rider's rows are deleted |
| Taken off the guest list (`delete-rider`, reason `guest-removed`) | the stored one |
| Any refusal at sign-in after the code exchange: blocked, scopes missing, consent missing, not a member (new or existing), club check inconclusive | the one just exchanged |

Nothing is withdrawn for a deauthorization event (Strava already ended the grant), nor where no
token was exchanged (Strava refused the code or the team is full).

## Settling one row

```text
ask the gateway ──▶ connected ──▶ drop the row
                ├─▶ reconnect ──▶ keep, ask again later
                ├─▶ none ───────▶ revoke ──▶ done ──▶ drop the row
                │                        └─▶ Strava busy or down ──▶ keep
                └─▶ no answer ──▶ keep
```

Settled right after the withdrawal (in `waitUntil` of the request, or inside the queue message),
and every row left in the daily run. Without a gateway (`STRAVA_RETURN_VIA` empty) the answer is
`none`.

## Team endpoint: `POST /strava/held/<STRAVA_WEBHOOK_VERIFY_TOKEN>`

For the gateway only. The token in the path is checked as for the webhook; anything else is a 404.

| Request body | `{"athleteId": <positive integer>}` |
|---|---|
| Answer | `200 {"held": "connected" \| "reconnect" \| "none"}` |
| Invalid body | `400` |

`connected`: a `riders` row with `status = 'connected'`; `reconnect`: a row with
`needs_reconnect`; `none`: no row. Rider or guest alike.

## Gateway endpoint: `POST /teams/<teamId>/held`

| Header | `Authorization: Bearer <the asking team's STRAVA_WEBHOOK_VERIFY_TOKEN>` |
|---|---|
| Request body | `{"athleteId": <positive integer>}` |
| Answer | `200 {"held": …}`: the strongest answer of every other team in `TEAMS` (`connected` over `reconnect` over `none`); `none` when there is no other team |
| Unknown team or wrong token | `403` |
| Invalid body | `400` |
| Any other team didn't answer `200` with a valid body | `503` |

The gateway reaches each team through `TEAM_SERVICE_<ID>` or its origin, as the forward does, with
that team's `TEAM_WEBHOOK_TOKEN_<ID>` in the path. It logs `held team=<id> status=<code>` per asked
team, never an athlete ID.

## Team side: reaching the gateway

`POST <STRAVA_RETURN_VIA>/teams/<TEAM_ID>/held`, the gateway's Custom Domain, with a plain
`fetch()`: Cloudflare allows it from the same zone without a service binding, and from another zone
it is an ordinary subrequest (research R14). 10 s timeout; anything but a valid `200` is no answer.
