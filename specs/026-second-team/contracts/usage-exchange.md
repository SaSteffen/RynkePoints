# Contract: Usage Exchange

FR-039 to FR-041. Each team's admin view shows every team's count of the shared Strava
allowances and connected riders. Teams have separate databases (R12), so each team
serves its own counts, and each hourly recording pulls the other teams' counts into its
own D1. The view still only reads D1 (025 FR-027): a team that doesn't answer can't slow
it down or break it.

## Settings

| Name | Kind | Value |
|---|---|---|
| `USAGE_PEERS` | var, every team | JSON list of `{ "id", "origin" }`, the other teams, the same format as the gateway's `TEAMS`. `"[]"`: none, and the view stays as for one team. An invalid list is logged and counts as `"[]"`. |
| `USAGE_EXCHANGE_TOKEN` | optional secret | The same random value in every team (`openssl rand -hex 32`). Without it, a team serves nothing and asks nobody. |

## `GET /admin/usage/export?since=YYYY-MM-DD`

- Needs `Authorization: Bearer <USAGE_EXCHANGE_TOKEN>`. A missing or wrong token, a
  method other than `GET`, or no token set gives the unknown-address page (404), like
  `/admin/run-daily`.
- `since` is clamped to the 13 months of history and to today. Without a valid one, the
  export starts yesterday.
- Answer, with `Cache-Control: no-store`:

  ```json
  { "team": "<TEAM_ID>",
    "days": [{ "day": "2026-11-04", "allowance": "strava_read_daily", "count": 900 }] }
  ```

  `allowance` is one of `strava_read_daily`, `strava_all_daily` and `riders_connected`.
  `count` is this team's own: for past days, `usage_daily.team_used`; for today, the live
  values, so a pull just before this team's recording still gets today. The export holds
  counts only, never rider identifiers (FR-039).

## Pull (hourly recording, and **Update now**)

- For each peer: `since` is the newest day stored for that team, or yesterday if
  nothing is stored yet, and at most 31 days back. A team that was down for some days
  gets those days filled in. Days before a team joined stay as they are (FR-041).
- Timeout 5 s, no redirects. The answer is accepted only when its `team` is the peer's
  ID and every entry has the shape above (at most 1,500 entries).
- Counts go into `usage_team_daily` as upserts. `usage_source_state` records
  `team:<id>` as a success or a failure. The token, URLs with it and bodies are never
  logged.
- `riders_connected` in `usage_daily`: `used` is all teams' riders together, and
  `team_used` is this team's. A peer that doesn't answer counts with its newest stored
  value. So the alerts of feature 025 fire for every team's administrators on the
  shared capacity (FR-041). Strava's daily figures are app-wide anyway, so every team
  already alerts on them.

## View (`/admin`)

- Strava's daily figures: each team's count and its share of the figure's `used`, then
  what no team counts (`used` minus every team's count).
- Connected riders: all teams' riders against 999, with each team's count and share.
- 15-minute figures: this team's count only. Other teams' 15-minute counts aren't
  exchanged, and the figure says so.
- A team that didn't answer at the last recording shows a notice with the time of its
  last answer. One that never answered shows a notice too. The rest of the view stays.
- The day table of these allowances has one column per team.
- No page names another team (FR-023): the view says "This team", and "Other team"
  (numbered in `USAGE_PEERS` order when there are several).

## Cloudflare (FR-040)

Every team's Workers, queues and database sit in one Cloudflare account, and the account's
answer names each value's resource (025 R3). Each team's data names its own resources
(`cloudflare` in [data-model.md](../data-model.md) › TeamData), so each team splits the
whole account itself, without the exchange:

- A value goes to the team whose Worker, database or queue it is. The gateway's Worker
  (`rynke-points-gateway`) counts as **shared**: it serves every team. Anything else, such
  as a sandbox, stays not attributed.
- `usage_daily.team_used` holds this team's part. `usage_team_daily` holds every other
  registered team's part and the shared one (team `shared`), zero where nothing was used.
  Yesterday's corrections update both.
- A figure is split only when this team's own resource for it is known. Workers and
  databases always are; queue operations only once the team's queue IDs are in team data
  (`wrangler queues list`). Until then `team_used` stays empty, and the view says the
  figure can't be split yet.
- The view shows this team, the other teams of `USAGE_PEERS`, the shared part and the
  rest, each with its share. It does so even without other teams, since the gateway's part
  is there anyway. The day table gets the same columns.

## Not here yet

- Alerts to maintainers outside the app (028 FR-025).
