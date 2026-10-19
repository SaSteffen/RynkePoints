# Contract: HTTP routes

| Route | Change |
|---|---|
| `GET /me` | No new parameter. The Overview always opens with the whole season (FR-026, research R8). When the section is shown, the page also loads the two vendor scripts. |
| `GET /me?page=N` | Unchanged: redirects to `/me/rides?page=N` (011 R2). |
| `POST /lang` | Unchanged. `safeNext` gains nothing: the language switch is in Settings (011 FR-016) and the period resets (FR-026). |
| `GET /vendor/*` | New static assets (research R6): `chart-4.5.1.umd.min.js`, `chartjs-plugin-zoom-2.2.0.min.js` and their licences. `public/_headers` serves them with `Cache-Control: public, max-age=31536000, immutable`. |
| `GET /app.js` | Unchanged route; the file gains `progressCharts()`. |

No route reads or writes anything new apart from the two SELECTs of
[data-model.md](../data-model.md), and none calls Strava (FR-003).
