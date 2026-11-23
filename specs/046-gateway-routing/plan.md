# Implementation Plan: Gateway Routing

**Branch**: `046-gateway-routing` | **Date**: 2026-11-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/046-gateway-routing/spec.md`

## Summary

The gateway keeps a copy of which teams hold which athletes, in one SQLite Durable Object in the
EU, and uses it to send each Strava event only to the teams that hold its athlete, plus every
team that isn't routing; anything unknown or unreadable goes to every team. Teams keep the copy
current with a queued report after each stored or deleted person and a full list in their daily
run. One gateway var, `ROUTING`, switches between `off` (shipped: today's broadcast, nothing
kept), `trial` (choose and mark, still send to all) and `on`. Teams count would-be misses, wasted
deliveries, drops and the re-check's finds; the gateway counts its choices and the full lists'
corrections. The hourly recording exchanges the counts through the gateway into each team's D1,
and the admin usage view shows a 30-day table with warning marks. The privacy notice gains one
paragraph.

## Technical Context

**Language/Version**: TypeScript (Cloudflare Workers)

**Primary Dependencies**: none new

**Storage**: Gateway: one SQLite-backed Durable Object (`RoutingCopy`, EU jurisdiction), created by
the deploy (research R1). Teams: D1 table `routing_daily`, migration `0038_routing_daily.sql`,
additions only

**Testing**: Vitest in the Workers runtime: the gateway project (Miniflare runs the object), the
app project with the fake gateway in `test/support/fake-strava.ts`

**Target Platform**: the gateway Worker and every team's Worker; works on the free plan, goes live
on the paid plan (FR-018)

**Project Type**: Workers: webhook gateway, server-rendered app with queue consumer

**Performance Goals**: acknowledgement within 2 s (lookup budget 1 s); a report within a minute

**Constraints**: no gateway cron (four of the account's five in use); no rider identifier in
gateway logs; `src/` never imports `gateway/`

**Scale/Scope**: at most 999 athletes, two teams today, up to eleven

## Constitution Check

| Principle | Check | Result |
|---|---|---|
| I. Privacy and consent | The copy holds athlete IDs and team IDs only, in the EU, deleted with the person or at the next full list; nothing read from Strava or shown anew, so no consent revision; the privacy notice says what is kept (FR-014, FR-015). Counts are counts only | Pass |
| II. Strava API | No Strava request added. Webhook still acks within 2 s and queues; processing unchanged and idempotent; the lookup has a budget and falls back to every team | Pass |
| III. Rider-authored content | Nothing written to Strava | Pass |
| IV. Serverless, minimal deps | No dependency. One Durable Object, a platform feature on the free plan, created by the deploy; no new cron, queue or database | Pass |
| V. Test-first | Choosing, the object, reports, lists, marks, counts and the view are written red first (tasks) | Pass |
| Language | One privacy paragraph and the view's labels in all ten catalogs, German the key; code and docs English | Pass |
| Team data (feature 026) | No branch on a team; the gateway's teams come from `TEAMS`; no page names another team | Pass |

Re-checked after Phase 1 design: still passes; no complexity to justify.

## Project Structure

### Documentation (this feature)

```text
specs/046-gateway-routing/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── gateway.md
│   ├── team-side.md
│   └── usage-view.md
└── tasks.md
```

### Source Code (repository root)

```text
gateway/
├── wrangler.jsonc        # ROUTING var, ROUTING_COPY binding, migration for RoutingCopy
├── index.ts              # lookup and marks in the webhook, chosen header, team routes, exports RoutingCopy
├── copy.ts               # new: the RoutingCopy Durable Object (copy, lists, counts)
└── routing.ts            # new, pure: mode, choosing, figure validation

src/
├── routing/
│   ├── figures.ts        # new: figure names shared by gateway and teams, the 30-day window
│   ├── report.ts         # new: queue a report, send it, send the full list, exchange counts
│   ├── counts.ts         # new: this team's own counts (drops, trial marks, re-check finds)
│   └── warning.ts        # new, pure: the day table's rows and a day's warning mark
├── db/routing.ts         # new: count, read, upsert, prune routing_daily
├── http/webhook.ts       # route from X-Rynke-Route
├── http/auth.ts, me.ts, held.ts, admin/remove.ts   # queue reports
├── http/admin/usage.ts   # the "Gateway routing" section, summary line, Update now exchanges
├── http/privacy.ts       # new paragraph, date
├── work/messages.ts      # report-hold, route
├── work/consumer.ts      # report-hold before the rider check; counts at the rider check
├── work/delete-rider.ts  # queue a report
├── work/recheck-rider.ts # count found
├── work/scheduled.ts     # daily: full list, prune; hourly: exchange
└── i18n/messages/*.ts    # ten catalogs

migrations/0038_routing_daily.sql
scripts/dev.mjs           # local gateway with ROUTING=on
docs/gateway-switch.md    # Routing: fallbacks, which teams route, emptying the copy, going live
.github/workflows/ci.yml  # the gateway deploys when src/routing/figures.ts changes

test/
├── gateway/copy.test.ts, routing.test.ts, team-routes.test.ts
├── unit/routing-choose.test.ts, routing-warning.test.ts, routing-config.test.ts
└── integration/routing-reports.test.ts, routing-counts.test.ts, admin-usage-routing.test.ts
```

**Structure Decision**: The existing gateway Worker and team app; the gateway imports shared
figure names from `src/routing/figures.ts`, never the other way round.

## Complexity Tracking

None.
