# Contract: What the Fake Strava Answers

The fake answers every request the app sends to `https://www.strava.com`. The
endpoints are those in
[feature 001 contracts/strava-api-usage.md](../../001-strava-connect-webhook/contracts/strava-api-usage.md).
The answer shapes match what `src/strava/` parses. **No response carries rate-limit
headers**, so the app's `strava_rate_limit` row is never changed by fake answers
(FR-006).

Each request is logged as one line, without tokens:
`[fake-strava] <METHOD> <path> → <status> (athlete <id>)`. A request the fake has no
answer for is logged as `[fake-strava] UNANSWERED <METHOD> <path>` (FR-010).

| App endpoint | Fake answer |
|---|---|
| `POST /oauth/token` `grant_type=authorization_code` | Wrong `client_id` or `client_secret` → `400`. Unknown code → `400`. Otherwise `200` with `access_token`, `refresh_token`, `expires_at` (now + 6 h), `expires_in` and `athlete { id, firstname }` (data-model.md formats). |
| `POST /oauth/token` `grant_type=refresh_token` | `refused` rider or malformed token → `400`. Otherwise `200` with a new access token, the same refresh token and a new `expires_at`. |
| `POST /oauth/revoke` | Wrong Basic credentials → `401`, otherwise `200`. Remembers nothing. |
| `GET /api/v3/athlete/clubs` | Missing or expired bearer → `401`. A `refused` rider still gets an answer, so their sign-in succeeds. Otherwise `200` with `[{ id: STRAVA_CLUB_ID, name }]` for club members and `[]` for others, paged by `page`/`per_page`. |
| `GET /api/v3/athlete/activities?after&page&per_page` | `401` as above, and always for a `refused` rider. `import-stuck` rider → `429`. Otherwise `200` with the rider's fake activities that started after `after`, oldest first, paged. Private ones only with `activity:read_all` in the token. |
| `GET /api/v3/activities/{id}` | `401` as above, and always for a `refused` rider. Not the rider's, unknown, or private without `activity:read_all` → `404 {"message":"Record Not Found"}`. Otherwise `200` with the activity. |
| Anything else on `www.strava.com` | `404 {"message":"Record Not Found"}` and the `UNANSWERED` log line |

Requests to hosts other than `www.strava.com` go through the original `fetch`
unchanged. The app currently sends none.
