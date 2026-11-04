# Contract: Reads from Summaries

This feature has no outside interface: pages, routes, queue messages and rider data stay as they are. This contract fixes the internal reads.

## Listed riders in one statement

`listedRiderFilter`, for a query from `riders r`, chooses exactly the riders of `LISTED_RIDER_IDS`.

## `readTeam(db): Promise<TeamRider[]>`

Result unchanged. Sorted by first name.

Batch, first round trip:

1. From `riders r` with the listed filter, `LEFT JOIN rynke_balances`, `LEFT JOIN rider_summaries` on the current version. Selects the name, balance, `weeks`, `attended`, whether a row exists, and corrections. Never selects `days`, `run_days` or `active`.
2. `team_events`: ID, kind, date.

Second round trip, only with missing riders: weekly sums and attendance added up for those IDs, with the listed filter inside SQL.

## `teamBadgeSumsStatements(db): D1PreparedStatement[]`

Now two statements, for a caller's batch:

1. From `riders r` with the listed filter, `LEFT JOIN rider_summaries` on the current version: `connected_at`, `days`, `run_days`, `active`, `attended`, whether a row exists, corrections. By ID.
2. `team_events`: ID, kind, date.

## `toTeamBadgeSums(db, results): Promise<TeamBadgeSums>`

Was synchronous. The result is the same as today (research R9). It makes the second round trip only with missing riders: rides per day, runs per day, activity times and attendance, with the listed filter inside SQL.

## `hasNewBadges(ctx, results, connectedAt): Promise<boolean>`

Was synchronous. Answers without working out team badges when a personal one is new, as today, which also skips any second round trip.

## Writes

`riderWrites` adds at most one upsert to `rider_summaries`, in the batch of the change. `insertRider` adds one empty row.
