# Contract: HTTP routes

All routes are served by the single Worker (`src/index.ts`). HTML pages are
English, server-rendered, and carry Strava attribution ("Powered by Strava") per
the brand guidelines.

Cookies:

- `rp_session`: signed session, `HttpOnly; Secure; SameSite=Lax; Path=/`, 30 days
  (research R9).
- `rp_oauth_state`: signed OAuth state, 10 minutes.

## Rider-facing

### `GET /`

- Signed in → `302 /me`.
- Otherwise `200` HTML containing:
  - a plain explanation of what is read and why, who can join (club link), and how
    to leave (FR-002);
  - the official "Connect with Strava" button linking to `/connect`.

### `GET /connect`

- `302` to `https://www.strava.com/oauth/authorize` with `client_id`,
  `redirect_uri=<origin>/auth/callback`, `response_type=code`,
  `approval_prompt=force`, `scope=read,activity:read,activity:read_all`, and
  `state=<random>`.
- Sets `rp_oauth_state`.

### `GET /auth/callback`

| Input | Outcome |
|---|---|
| `state` missing or ≠ cookie | `400` page "Sign-in expired, try again". Nothing stored. |
| `error=access_denied` | `200` page "RynkePoints needs read access to your activities" plus a retry link. Nothing stored. |
| accepted `scope` lacks `activity:read` or `read` | Revoke the token if one was issued. Same page as `access_denied`. |
| token exchange `403` | `200` page "The team is full for now" (FR-008). |
| token exchange other error | `502` page "Connection failed, try again". |
| club check: not a member | Revoke the token. `200` page "Only members of TRHH Rynke Coins can take part" with the club link. Nothing stored. |
| club check inconclusive | `503` page "Strava is busy, try again in a few minutes". Token revoked, nothing stored. |
| success, new rider | Insert rider and credentials, enqueue `import-page` p.1, set `rp_session`, `302 /me`. |
| success, existing rider | Update scopes and credentials. Apply the scope-change rules (data-model.md). Set `rp_session`, `302 /me`. |

### `GET /me`

- Not signed in, or the rider no longer exists → `302 /`.
- `200` HTML showing:
  - greeting (first name) and connection status, with a reconnect link if
    `needs_reconnect`;
  - granted level ("shared activities" / "including private");
  - import status;
  - the 20 newest activities (date, sport type, distance km, elevation m) of that
    rider only (FR-025, FR-026);
  - the "Disconnect and delete my data" button, which leads to the confirmation
    page.

### `GET /me/disconnect`

Confirmation page with a POST form.

### `POST /me/disconnect`

- Requires a session and a same-origin `Origin` header, else `403`.
- Revokes the token at Strava (one retry on 503), then hard-deletes the rider
  (cascade) and clears the session cookie.
- `200` page confirming deletion. If the revoke failed, the page also tells the
  rider to remove RynkePoints under "My Apps" in their Strava settings.

### `POST /logout`

- Requires a same-origin `Origin` header.
- Clears `rp_session` and redirects `302 /`.

## Strava-facing

### `GET /strava/webhook/:secret`

Subscription validation.

- `:secret` ≠ `STRAVA_WEBHOOK_VERIFY_TOKEN` → `404`.
- `hub.mode=subscribe` and `hub.verify_token` matching → `200`
  `application/json` `{"hub.challenge":"<hub.challenge>"}`.
- Otherwise `403`.

### `POST /strava/webhook/:secret`

Event delivery. MUST answer within 2 s and never call Strava (FR-011).

- `:secret` mismatch → `404`.
- Body over 1,000 bytes or not matching the event shape → `400`.
- `subscription_id ≠ STRAVA_SUBSCRIPTION_ID` → `200`, dropped.
- Otherwise enqueue one message (see [queue-messages.md](queue-messages.md)) and
  answer `200`.
  - `object_type=activity` → `activity-event { athleteId: owner_id, activityId:
    object_id, aspect, changed: keys of updates }`.
  - `object_type=athlete` with `updates.authorized == "false"` → `delete-rider {
    athleteId: owner_id, reason: "deauthorized", revoke: false }`.
  - Any other athlete update → `200`, dropped.

Accepted event shape (all other fields ignored):

```json
{
  "object_type": "activity | athlete",
  "object_id": 1234567890,
  "aspect_type": "create | update | delete",
  "updates": { "title": "…", "type": "…", "private": "true", "authorized": "false" },
  "owner_id": 123456,
  "subscription_id": 1,
  "event_time": 1760000000
}
```

## Operational

### `GET /health`

`200` `ok` (existing).
