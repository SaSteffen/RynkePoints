# Data Model: Strava Call Counts

One forward-only migration in each team's D1 (the next free number after
`0037`; if the gateway routing branch takes it first, this one moves up). It only
adds tables, so the previous release keeps working.

## `strava_calls_daily`

This team's calls and held-back calls per UTC day, action and endpoint.

| Column | Type | Notes |
|---|---|---|
| `day` | TEXT | `YYYY-MM-DD`, UTC; same `GLOB` check as `recheck_daily` |
| `action` | TEXT | one of the actions below |
| `endpoint` | TEXT | one of the endpoints below |
| `calls` | INTEGER NOT NULL DEFAULT 0 | answered calls |
| `held_back` | INTEGER NOT NULL DEFAULT 0 | calls refused by the budget before they were made |

Primary key `(day, action, endpoint)`, `WITHOUT ROWID`. Written as an upsert that
adds 1 to one column. No rider or activity ID (FR-016).

## `strava_seen_daily`

The highest daily total Strava reported to this team per UTC day.

| Column | Type | Notes |
|---|---|---|
| `day` | TEXT PRIMARY KEY | `YYYY-MM-DD`, UTC |
| `seen` | INTEGER NOT NULL | `MAX` of the stored and the new value |

Written in the same batch as the call's count, only when the answer carried
`X-RateLimit-Usage` (none in fake mode).

## Values

**Actions** (`StravaAction`): `connect`, `import`, `ride-event`, `club-check`,
`recheck`, `reread`, `leave`, `disconnect`, `unassigned`. Mapping in
[research.md](research.md) R2.

**Endpoints** (`StravaEndpoint`, the labels `stravaFetch` already logs):
`GET /athlete/clubs`, `GET /activities/{id}`, `GET /athlete/activities`,
`POST /oauth/token`, `POST /oauth/revoke`.

Both are closed TypeScript unions; the database stores the strings without a
`CHECK`, so a value added later needs no migration.

## Other teams' totals: `usage_team_daily` (existing)

Three new `allowance` values per day and team, from the usage exchange
([contracts/usage-exchange.md](contracts/usage-exchange.md)): `strava_calls`,
`strava_held_back`, `strava_seen`. The table has no `CHECK` on `allowance`, so no
migration.

## Context: `Ctx.stravaAction`

Optional `StravaAction` on `Ctx`, picked by `StravaCtx` and `WithdrawCtx`. Not
stored; set where work starts (research R1).

## Retention

The daily `pruneUsage` deletes rows older than 30 days (the first kept day is
today − 29) from `strava_calls_daily`, `strava_seen_daily`, and the three new
allowances in `usage_team_daily` (FR-017). `usage_team_daily`'s other allowances
keep their 13 months.

## Derived per day (view only)

- **This team**: sum of `calls`; **held back**: sum of `held_back`.
- **Another team**: sum of the peers' `strava_calls`; missing when a peer has no
  entry for the day after its first entry.
- **All teams**: this team + another team, when nothing is missing.
- **Strava's count**: highest of this team's `seen` and the peers' `strava_seen`;
  unknown when zero.
- **Mark** (finished days only): Strava's count known, nothing missing, and
  `seen − all teams > max(10, ⌊1% of seen⌋)`; or any `unassigned` calls.
