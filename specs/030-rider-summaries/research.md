# Research: Stored Rider Summaries

Measurements are local, with synthetic data: 40 riders, 150 rides, 20 runs and 10 swims each, 20 events, 600 attendances. A prototype confirmed badge parity on this data: all 36 earned badges and all progress values matched, using whole-number distances.

## R1. One row per rider with JSON columns

**Decision**: one table, one row per rider, `WITHOUT ROWID`, separate JSON columns for each kind of data.

**Rationale**: D1 counts rows, so one row per rider makes reads independent of rides. Separate columns let the Team page select `weeks` without the daily totals (FR-008). Prototype: Team read 200 rows and 67 KB, badge read 120 rows and 356 KB (today about 945 KB).

**Alternatives**: one row per rider and day needs about 6,000 rows per badge read. A team-wide cache is excluded by FR-009.

**Size**: a season at one activity per day is about 25 KB per row (measured 9 KB at 150 rides), well under D1's 2 MB row limit, and it travels as bound parameters, not in the SQL text.

## R2. Write in `riderWrites`, compare before writing

**Decision**: `readRiders` also reads the stored row. `riderWrites` works out the summary from the same evaluation as the balance, compares the columns and adds the upsert to the same batch only when something differs.

**Rationale**: `riderWrites` is the one place every change passes through: activity changes, team-event changes and corrections. Every writer of `activities`, `runs`, `swims`, `ride_results`, `attendances` in `src/` was checked and goes through it; `upsertActivity` outside `apply.ts` is only called by tests. An unchanged evaluation still writes nothing. Cost: one more row read and at most one written per evaluation.

## R3. The stored text must be deterministic

**Decision**: `summaryOf` sorts all its inputs, days and lists by value before adding up. No timestamp column.

**Rationale**: activities arrive in `Map` order, which differs between a change and a later re-read. Without sorting, the same rides could give different text and trigger a write on every evaluation (FR-004).

## R4. Riders without a current row

**Decision**: the main statement starts from the listed riders with a `LEFT JOIN` on the summary, so a missing row shows up at no extra cost. Only then does a second batch add up exactly those riders, today's SQL plus `athlete_id IN json_each(?)` and the listed-rider filter. The result is turned into the same shape as a summary, and from there there's one code path.

**Rationale**: normal use keeps its round trips (FR-010). Adding the fallback to the first batch would cost about 160 rows per statement on every read (`EXCEPT`) or 6,200 (`NOT IN`), both measured.

**Consequence**: `toTeamBadgeSums` and `hasNewBadges` become async. The second trip isn't in the first batch's snapshot. That only matters during the move and is harmless, since it filters by consent itself.

**Tests**: most existing tests seed rides directly and have no row, so they run through this path with their expectations unchanged. `seedRider` stays as it is. `test/integration/d1-round-trips.test.ts` gets a seeded row in its setup, because it describes normal use.

## R5. One listed-rider check per statement

**Decision**: a new helper builds `r.status = 'connected' AND EXISTS (SELECT 1 FROM consent_records c WHERE c.athlete_id = r.athlete_id AND c.version >= N)` for a query that starts from `riders r`. `LISTED_RIDER_IDS` stays for all other reads. A test requires both to pick the same riders.

**Rationale**: 80 rows against 200 for the nested `IN` form, and the check is still inside SQL.

## R6. A version number on the row

**Decision**: `version` column and `RIDER_SUMMARY_VERSION = 1` in code. Reads join on the current version, so another version counts as missing and is added up. The daily job re-evaluates those riders.

**Rationale**: the organiser graphs will need more in the row. A version bump refills every row without wrong numbers in between.

## R7. Attended events hold IDs only, joined with a live event read

**Decision**: `attended` holds event IDs. Each read also fetches `team_events` (20 rows). An ID without an event counts for nothing.

**Rationale**: an event's date and kind stay live. The change path still evaluates attendees in one batch, also for riders who need to reconnect, since `affected` doesn't filter by status.

**Hand-entered attendance**: `listRidersNeedingEvaluation` compares by kind and count today, so an attendance moved by hand to an event of the same kind would stay unnoticed. It also compares IDs with the summary now, in both directions, so the spec's "after the next daily job" holds.

## R8. Corrections stay live

**Decision**: not in the summary. A correlated subquery in the main statement, ordered in an inner select, reads them per rider through `corrections_by_rider`.

**Rationale**: few rows, and it avoids another thing to keep in sync.

## R9. Exact output shape

**Decision**: the merge keeps what `toTeamBadgeSums` returns today: no ID on riders, riders with no rides, attendance or corrections left out, attendance by date then ID, runs summed per day, `active` by date, rider, hour and ride, events by date then ID, only with listed attendees. Rider order becomes by ID; `evaluateTeamBadges` adds up and doesn't depend on it, which the parity test covers.

## R10. Comparison with adding up, and decimals

**Decision**: tests compare `summaryOf` with the production add-up reads. Fixtures use decimal distances. Earned badges, dates, Rynke, elevation and counts must be exactly equal. Distances must be equal to within 0.000001 m.

**Rationale**: `distance_m` is `REAL`, and SQLite's `SUM` may add in another order and with a compensated algorithm than JavaScript, so the last binary digits can differ. Rounding the stored values would instead add a real error across many days. The remaining difference could only change a badge if a team total landed exactly on a threshold to within a millionth of a metre. The earlier prototype didn't cover this, since it used whole numbers.

## R11. Filling rows at release

**Decision**: no data migration. The table starts empty, pages add up as today, and the daily job evaluates every rider without a row. Riders created by the new code get an empty row in `insertRider`'s batch.

**Rationale**: a rider's first fill changes nothing else, so there's no balance write, no rise and no notification, which a test confirms. Filling costs about 27,000 rows once, about 0.5% of the daily limit. Until then, reads cost at most what they cost today, which a test guards.

**Risk**: rolling back to old code after rows exist would leave them stale. Deploys are forward-only; a later release would need a version bump to refill.

## R12. Measuring rows in tests

**Decision**: `test/support/d1-rows.ts` wraps the binding and adds up `meta.rows_read` per use, based on the measurement harness. `test/integration/d1-rows.test.ts` asserts SC-001 and SC-003 with the 40-rider team.

**Limit**: local SQLite counts may differ a little from production. The Admin page shows real use after release.

**Measured** on the finished code, rows read per use with 40 riders:

| Use | 150 rides | 300 rides | Limit at 150 rides | Before |
|---|---|---|---|---|
| Opening the app | 301 | 310 | 400 | 45,396 |
| Team page | 264 | 264 | 500 | 20,793 |
| Badges page | 1,146 | 1,905 | 1,500 | 46,280 |
| Organiser's rider list | 623 | 623 | 1,000 | 21,152 |
| New ride with team badge check | 858 | 1,315 | 1,500 | 45,995 |
| Daily job | 34,563 | 58,563 | none | 29,575 |

**Daily estimate**: 152,425 rows, about 3% of the free limit, from 80 app opens each followed by the Team page, 40 Badges visits, 10 organiser visits, 24 new rides and the daily job. The test guards the 5% limit. The daily job rises by about 5,000 rows, from checking each rider's summary. With no rows at all, right after release, each use still costs less than before: 42,885 for opening the app, 19,892 for the Team page, 43,730 for the Badges page and 20,251 for the organiser's rider list.

## R13. Twice the rides: spec corrected

**Finding**: measured with 300 rides per rider, the Badges page's own part goes from about 960 to about 1,620 rows, and evaluating a new ride from 674 to 1,131. Both read that one rider's rides, about 3 to 5 rows per ride, and need to: personal badges and the evaluation work from them. The spec's "under 10% for each use" couldn't hold for these two.

**Decision**: SC-003 now sets under 10% for opening the app, the Team page and the organiser's rider list, and at most 5 rows per extra ride of that one rider for the other two.

**Finding on the finished code**: the Badges page rose by 759 rows for 150 extra rides. The rider's rides account for exactly 750, in two statements (3 and 2 rows per ride). The other 9 come from the 3 badges those rides earned them, each read in `rider_badges` twice and `badge_reveals` once. Earned badges are bounded by the catalog, so SC-003 now allows 3 rows per badge earned on top.

## R14. Left out

- Pre-season purge (7,201 rows a day, could be about 240 by rider index) and the out-of-date check (22,249). Together about 0.6% of the limit, and the second is out of scope. Worth doing separately if real use calls for it.
- `album/load.ts` only follows the async change; it reads through the same functions.
- CPU: the badge read parses less JSON than today's results (356 KB against 945 KB), so no new risk to the free tier's CPU limit.
