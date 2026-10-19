# Contract: HTTP routes

| Route | Change |
|---|---|
| `GET /me` | Accepts `period=3m` or `period=4w`. Any other value, or none, draws the whole season. An offered preset is drawn as is. A preset not offered yet (FR-020) falls back to the whole season. There is no redirect, and the response stays `200`. |
| `GET /me?page=N` | Unchanged: redirects to `/me/rides?page=N` (011 R2). `period` never triggers it. |
| `POST /lang` | Unchanged. `safeNext` gains nothing: the language switch is in Settings (011 FR-016) and the period may reset (FR-026). |
| Static assets | Unchanged: `public/app.js` grows; no new file. |

No route reads or writes anything new apart from the two SELECTs of
[data-model.md](../data-model.md), and none calls Strava (FR-003).
