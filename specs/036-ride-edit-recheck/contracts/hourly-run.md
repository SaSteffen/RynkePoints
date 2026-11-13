# Contract: the hourly run

The cron `58 * * * *` first records usage as today (feature 025), then runs the re-check. A failure
of one doesn't stop the other; the run still fails so it shows in the logs.

## Steps

1. **Hold**: more than half of the day's Strava reads used → add `runs_held + 1` and the day's
   `over_24h`, send nothing, stamp nobody.
2. **Read** the eligible riders (connected, import done, an activity in the last 30 days) with `rechecked_at` and the fast-lane
   flag (research R6): one query.
3. **Size** (research R4): `runSize(hour, allowance, riders, overdue)`, `riders` being the
   eligible ones.
4. **Order** (FR-010), each group longest ago first, never checked before everyone:
   1. riders last checked 20 or more hours ago;
   2. fast-lane riders, at most `ceil(size / 2)` of the run;
   3. everyone else.
   Nobody stamped within the last 30 minutes is taken, so a repeated run finds nobody due.
5. **Stamp and count** in one batch: `rechecked_at = now` for the chosen riders;
   `recheck_daily`: `sent + n`, `over_24h = max(over_24h, found)`.
6. **Send** one `recheck-rider` per chosen rider, `delaySeconds = floor(i × 3300 / n)` in the
   order of step 4, so those who waited longest go first.

## Pure functions (unit tested, no I/O)

| Function | Input | Output |
|---|---|---|
| `baseChecks(hour, allowance)` | UTC hour 0–23, allowance | this hour's share; sums to the allowance over a day |
| `runSize(hour, allowance, riders, overdue)` | counts | number of checks, research R4 |
| `chooseRiders(candidates, size, now)` | riders with stamp and fast-lane flag | the chosen riders in order |
| `spreadDelay(i, n)` | index, count | seconds, at least 60 apart for `n ≤ 55` |

## Worked examples

| Active riders | Allowance | Checks per run | Each rider |
|---|---|---|---|
| 5 | 150 | 5 | every hour |
| 12 | 150 | 6 or 7 | about every 2 hours |
| 50 | 150 | 6 or 7 | every 8 hours |
| 100 | 150 | 6 or 7 | every 16 hours |
| 140 | 150 | 6 or 7 | every 22 to 23 hours |
| 300 | 150 | about 13 | every 23 hours, 313 a day |
| 999 | 150 | about 43, at most 50 | every 23 hours, about 1,040 a day |

With 3 fast-lane riders among 100 active ones: riders past 20 hours go first, so the fast lane gets
the places they leave, half a run at most. Simulated over days (test/unit/recheck-pace.test.ts),
each of the three is checked in about 9 of a day's 24 runs, every 2 to 3 hours, against every 16
hours for the rest. With 60 riders or fewer, all three are checked at every run.

## By hand

`POST /_dev/recheck` (fake mode and sandboxes): checks every eligible rider at once, with no hold,
no pace, no 30-minute guard and no delays, so the check can be watched and pressed again. Not in
the production bundle (`dev/`).
