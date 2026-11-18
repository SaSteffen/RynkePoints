# Data Model: Season and Qualification Window

No D1 migration (research R3).

## Team settings (Wrangler vars, per team block)

| Var | Hamburg (+ sandbox) | Europe (+ sandbox) | Rule |
|---|---|---|---|
| `SEASON_START_DATE` | 2026-09-01 | 2026-09-01 (was 2027-01-01) | always a 1 September |
| `QUALIFICATION_START_DATE` | 2026-09-01 | 2027-01-01 | **new**; season start ≤ it ≤ deadline |
| `QUALIFICATION_DEADLINE` | 2027-06-30 | 2027-06-30 | ≤ season end (31 August) |

Checked by `team-check` (R9).

## CountingWindow (`src/rynke/rules.ts`)

```text
seasonStart  YYYY-MM-DD  season's first day (fetch, season end, badges, tour days)
windowStart  YYYY-MM-DD  NEW: first day a ride can count (Rynke, pace, graphs)
deadline     YYYY-MM-DD  last day a ride can count; badges end here too
today?       unchanged (badge window)
```

`inCountingWindow(d) = windowStart ≤ d ≤ deadline`. `seasonEnd` reads `seasonStart`.

## Ride result (`ride_results`, unchanged columns)

New reason code `before_window`, between season start and window start (exclusive).

| State | `counts` | `reasons` | `distance_rynke` | `elevation_dm` | Badges | Graphs/Rynke |
|---|---|---|---|---|---|---|
| counting | 1 | `[]` | Rynke | real | yes | yes |
| **pre-window** | 0 | `["before_window"]` | 0 | **real** | yes | no |
| not counting | 0 | any other set (may include `before_window`) | 0 | 0 | no | no |
| overlap | 0 | `["overlap"]` | 0 | 0 | no | no |

Overlap resolution runs over counting and pre-window candidates together.

## Rider view ride status (`src/http/rider-view.ts`)

`counts | does-not-count | being-evaluated | not-yet` — `not-yet` exactly for the pre-window state.
Reason line `{ code: "before_window"; date: windowStart }` beside today's `before_season` and
`after_deadline`.
