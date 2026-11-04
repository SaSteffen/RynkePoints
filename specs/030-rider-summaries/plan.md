# Implementation Plan: Stored Rider Summaries

**Branch**: `030-rider-summaries` | **Date**: 2026-11-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/030-rider-summaries/spec.md`

## Summary

Add one table, `rider_summaries`, with one row per rider. Each row holds what team reads add up today: totals per day, weekly sums, runs per day, activity times and attended event IDs. `riderWrites` keeps the row current in the same batch as the balance, and writes it only when it changed.

The Team page, the organiser's rider list, the Badges page, the start check and the team badge check read one row per listed rider instead of every ride. The listed-rider check sits inside that one SQL statement. Team-wide results are still worked out on each read. A listed rider without a current row is added up from their rides in a second round trip, which only happens when such a rider exists.

## Technical Context

**Language/Version**: TypeScript on Cloudflare Workers

**Primary Dependencies**: none new

**Storage**: D1. One new table, one forward-only migration (`0024_rider_summaries.sql`)

**Testing**: Vitest in the Workers runtime (`pnpm test`), red-green per constitution Principle V

**Target Platform**: Cloudflare Workers free tier

**Project Type**: server-rendered web service

**Performance Goals**: the row limits in spec SC-001 to SC-003, guarded by an automated test

**Constraints**: consent stays inside SQL (Principle I). No visible change, no new round trip in normal use. A migration must keep the previous version working.

**Scale/Scope**: 40 riders, a full season. One row stays around 10 KB at 150 rides, far under D1's 2 MB (research R1).

## Constitution Check

*Checked before research and again after design: passes both times, no violations.*

| Principle | How this feature holds |
|---|---|
| I. Privacy and consent | Summaries hold only derived figures, no ride name, ID, route or duration. No new data is shown, so no new consent version. The consent check stays inside every team read's SQL, including the add-up path (R4, R5). The row goes by cascade with the rider. |
| II. Strava API | No Strava request is added. |
| III. Rider-authored content | Not touched. Corrections stay live in their own table (R8). |
| IV. Serverless, minimal | No dependency. Summaries can be worked out again from stored data at any time, and a version number refills them (R6). This is what keeps the app in the free tier. |
| V. Test-first | Each task group starts with failing tests. The add-up SQL stays as production code and is the reference the summaries are compared with (R10). |

## Project Structure

### Documentation (this feature)

```text
specs/030-rider-summaries/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/summary-reads.md
└── tasks.md
```

### Source Code

```text
migrations/0024_rider_summaries.sql      new table
src/rynke/summary.ts                     new: pure, figures → summary, parse, merge
src/db/rider-summaries.ts                new: statements, add-up reads for riders without a row
src/db/consents.ts, src/db/organiser.ts  one-statement listed-rider filter
src/db/team.ts                           readTeam and the team badge read use summaries
src/db/rynke.ts                          needs-evaluation also finds missing or outdated rows
src/db/riders.ts                         insertRider adds an empty row
src/rynke/apply.ts                       readRiders reads the row, riderWrites compares and writes it
src/http/redirect.ts                     awaits the badge check
src/http/sections/badges.ts              hasNewBadges and readBadgesPage await the sums
src/work/team-badge-news.ts              unchanged, through readTeamBadgeSums
album/load.ts                            awaits the sums
test/integration/rider-summaries*.test.ts, test/unit/rider-summary.test.ts   new
test/integration/d1-rows.test.ts, test/support/d1-rows.ts                    new row guards
```

**Structure Decision**: the existing single project. The pure logic goes next to `weeks.ts` and `tally.ts`, the SQL next to `team.ts`.

## Complexity Tracking

No violations. The reads get harder to follow (JSON columns, one wide statement, a merge step), as the maintainer accepted in the spec's assumptions.
