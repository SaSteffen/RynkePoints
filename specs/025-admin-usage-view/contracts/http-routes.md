# HTTP Routes

Every route reads the viewer afresh. A visitor goes to `/`, a rider without current consent
meets the gate, and a rider without the flag gets the generic 403. A POST also needs the same
origin. None of them make a Strava request, except the revoke during a removal.

| Route | Purpose |
|---|---|
| `GET /admin` | Current usage, waiting work, and a hint if the viewer's devices have no notifications |
| `GET /admin/history?allowance=<id>` | One value per day, with limit and gaps. Unknown ID: the first allowance |
| `GET /admin/riders` | Rows (FR-018), blocked and unlisted counts |
| `GET /admin/riders/{id}/remove` | Confirmation. Refuses self (pointing to `/me/disconnect`) and unlisted IDs |
| `POST /admin/riders/{id}/remove` | Removal, then `303` to `/admin/riders?done=` or `?error=` |
| `GET /notice/blocked` | What a blocked rider sees |

Removal results: `removed`, `removed-revoke-failed`, `error=self`, `error=unknown`.

`/me/notification-text` is extended; see [alerts.md](alerts.md). All pages are added to the
Strava review script (`e2e/strava-review.review.ts`), with synthetic riders.
