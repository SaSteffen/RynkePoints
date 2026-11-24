# Quickstart: Strava Call Counts

How to check the feature works. Tests are the main proof (Principle V); the
manual checks run on the live site after a release.

## Automated

```bash
pnpm exec vitest run test/unit/strava-calls.test.ts \
  test/integration/strava-calls-counting.test.ts \
  test/integration/admin-usage-calls.test.ts \
  test/integration/usage-exchange-calls.test.ts
```

They cover:

1. A call under each action counts under that action and its endpoint; a token
   refresh inside a ride event counts under the ride event (US1 scenarios 1–2).
2. A budget refusal counts held back and no call (US1 scenarios 3–4); a network
   error counts nothing (scenario 5); a `429` counts a call.
3. A call without an action counts as unassigned and marks a finished day (US2
   scenario 6).
4. The export carries `strava_calls`, `strava_held_back` and `strava_seen`, never
   anything by action; the parser skips unknown allowances.
5. The view: day table with this team, another team, all teams, Strava's count,
   held back; the mark and the summary count for a gap above 1% and 10 calls; no
   mark at 1 call off, for today, or when a peer's day is missing (US2 scenarios
   1–5); the breakdown for `?calls=`.
6. Rows older than 30 days are pruned (US1 scenario 6).

## Local (fake mode)

```bash
pnpm dev
```

1. On Hamburg (http://localhost:8791 through the gateway), connect a sample rider,
   then open Admin › Nutzung.
2. The "Strava-Aufrufe" table shows today with calls under connecting and season
   import. The Strava column is empty: the fake Strava sends no rate headers.
3. Open the breakdown for today: rows per action, columns per endpoint.

## After release (live)

On Admin › Nutzung of each team, a day after the release: yesterday's row shows
this team, another team, all teams and Strava's count within 1% of each other, no
mark, and nothing under unassigned (SC-002).
