# Quickstart: Fair Share of the Strava Budget

## Check it locally

1. `pnpm test` — the drain, reserve, notification and line tests run against
   local D1 and the fake Strava.
2. `pnpm dev`, sign in as any sample rider: with no backlog nothing changes on
   the pages.
3. On `/_dev/`, open a rider's "Strava events" and "Sync a backlog" with 30
   rides. Their Overview and Rides show "0 von 30 Aktivitäten geholt", counting
   up about one a minute (each ride's first fetch fails once), and the line goes
   when the last one is in. Other riders' new rides still come in at once.

## After deploying

1. CI applies `0019_strava_work.sql` before the new code (additive, the old
   version ignores it).
2. Messages already in the queue are stored into the table as they arrive; no
   manual step.
3. Watch the logs after the next big sync: `moved to failed_work` lines keep
   their meaning; there are no new log lines with tokens or activity data.

Nothing to configure: the reserve and the line's threshold are constants in
`src/strava/rate-limit.ts` and `src/db/strava-work.ts`.
