# Contract: Strava API usage (outbound)

The complete list of Strava endpoints this feature calls. The Strava client
(`src/strava/`) exposes exactly these and nothing else. Tests fake each one with
synthetic data (Principle V).

| Purpose | Request | Auth | Fields read from the response |
|---|---|---|---|
| Authorize (browser redirect) | `GET https://www.strava.com/oauth/authorize` | — | callback params `code`, `scope`, `state`, `error` |
| Token exchange | `POST https://www.strava.com/oauth/token` `grant_type=authorization_code` | client id/secret in form | `access_token`, `refresh_token`, `expires_at`, `scope`, `athlete.id`, `athlete.firstname` |
| Token refresh | `POST https://www.strava.com/oauth/token` `grant_type=refresh_token` | client id/secret in form | `access_token`, `refresh_token`, `expires_at` |
| Revoke | `POST https://www.strava.com/oauth/revoke` `token=<token>`: the stored refresh token for a connected rider (no refresh first), or the just-issued access token in the OAuth callback | HTTP Basic `client_id:client_secret` | status only |
| Club membership | `GET /api/v3/athlete/clubs?page=N&per_page=200` | Bearer | `[].id` |
| Single activity | `GET /api/v3/activities/{id}` | Bearer | `id`, `sport_type`, `start_date`, `start_date_local`, `timezone`, `distance`, `moving_time`, `elapsed_time`, `total_elevation_gain`, `manual`, `trainer`, `flagged`, `private` |
| Season import and one-time re-read (R20) | `GET /api/v3/athlete/activities?after=<epoch>&page=N&per_page=200` | Bearer | same fields as single activity, per item |

Base URL for `/api/v3/...` is `https://www.strava.com`.

## Response handling

| Status | Meaning |
|---|---|
| `2xx` | Success. Record `X-RateLimit-*` and `X-ReadRateLimit-*` usage. |
| `401` on an API call | Refresh once and retry. If still `401`, `needs_reconnect`. |
| `400`/`401` on refresh | `needs_reconnect`. |
| `403`/`404` on a single activity | Inaccessible, treated as deleted. |
| `403` on token exchange | Capacity reached (R14). |
| `429` | Rate-limited: defer to the next window (budget deferral, not a transient error). |
| `5xx`, network error | Transient: back off. |

## Manual, one-time (not called by the app)

Subscription management: `POST`/`GET`/`DELETE
https://www.strava.com/api/v3/push_subscriptions`. The maintainer runs these by
hand (see quickstart). The app never creates or deletes subscriptions.
