# Contract: One team at a time

**Feature**: [../spec.md](../spec.md) | **Research**: [../research.md](../research.md)

## Team question, extended (R2)

Feature 041's endpoints ([withdrawal.md](../../041-admin-every-team/contracts/withdrawal.md)) keep
their paths, authentication and status codes. Only the answers grow.

| Endpoint | Answer |
|---|---|
| Team: `POST /strava/held/<STRAVA_WEBHOOK_VERIFY_TOKEN>` | `200 {"held": "connected" \| "reconnect" \| "none", "rider": <boolean>}`; `rider` is true when a `riders` row exists with `guest = 0` |
| Gateway: `POST /teams/<teamId>/held` | `200 {"held": …, "rider": <boolean>}`; `rider` is true when any other team answered true |

A missing or non-boolean `rider` counts as `false`, at the gateway and at the team.

## Let-go (R4)

### Gateway endpoint: `POST /teams/<teamId>/let-go`

| | |
|---|---|
| Header | `Authorization: Bearer <the asking team's STRAVA_WEBHOOK_VERIFY_TOKEN>` |
| Request body | `{"athleteId": <positive integer>}` |
| Answer | `200 {"letGo": true}` once every other team in `TEAMS` answered `200`; also when there is no other team |
| Unknown team or wrong token | `403` |
| Invalid body | `400` |
| Any other team didn't answer `200` | `503` |

The gateway reaches each team as for `held`: `TEAM_SERVICE_<ID>` or its origin, that team's
`TEAM_WEBHOOK_TOKEN_<ID>` in the path. It logs `let-go team=<id> status=<code>` per asked team,
never an athlete ID.

### Team endpoint: `POST /strava/let-go/<STRAVA_WEBHOOK_VERIFY_TOKEN>`

For the gateway only. The token in the path is checked as for `held`; anything else is a 404.

| | |
|---|---|
| Request body | `{"athleteId": <positive integer>}` |
| Effect | deletes the `riders` row (and everything that cascades from it) if it exists with `guest = 0`; nothing for a guest row or no row. No block, no withdrawal, no queue message, nothing logged about the person |
| Answer | `200 {"letGo": true}` in every one of those cases |
| Invalid body | `400` |

### Team side: asking

`POST <STRAVA_RETURN_VIA>/teams/<TEAM_ID>/let-go`, as for `held`: plain `fetch()`, 10 s timeout,
anything but a valid `200` is no answer. Without a gateway (`STRAVA_RETURN_VIA` empty) there is no
other team: the answer is `letGo: true` and the team question's `rider` is `false`.

## Sign-in (R1, R3, R6)

Changes to `GET /auth/callback` for a person the team doesn't hold and who isn't on its guest list,
after the club check passed:

```text
ask the team question
├─ no answer ──────────────▶ withdraw, /notice/strava-busy
├─ rider: false ───────────▶ store and sign in, as today
└─ rider: true
   ├─ state without switch ─▶ withdraw, 303 /switch-team?next=<next>
   └─ state with switch ────▶ let-go
                              ├─ 200 ──▶ store and sign in, as today
                              └─ else ─▶ withdraw, /notice/strava-busy
```

The old `one-team` notice and its redirect go.

## `GET /switch-team`

Public, no session, no rider data, like the notice pages. Names no other team.

- Heading and two paragraphs: they already ride for another team on RynkePoints; switching deletes
  their rides, Rynke and badges there, and this team counts their season's rides anew under its
  rules.
- **Switch to this team**: `<form method="post" action="/connect">` with hidden `consent` (the
  current version), `next` (from the query, through `sectionNext`) and `switch=1`.
- **Stay with my team**: a link to `/`.

## `POST /connect`

Unchanged, plus: `switch=1` in the form makes the authorize URL use `approval_prompt=auto` and puts
the switch flag into the OAuth state cookie. The consent check is the same as for the start page.

## OAuth state cookie

`<state>:<consentVersion>:<next>` becomes `<state>:<consentVersion>:<switch>:<next>`, `switch`
being `0` or `1`. The reader also accepts the old form (no `switch`, `next` starting with `/`) as
`switch = 0`, so cookies issued by the previous release in the last ten minutes keep working.

## Withdrawal (R5)

`settleWithdrawal` drops a kept row without asking anyone when this team holds the person (a
`riders` row exists, rider or guest).
