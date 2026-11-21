# Implementation Plan: Strava 64-bit IDs

**Branch**: `042-strava-64bit-ids` | **Date**: 2026-11-21 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/042-strava-64bit-ids/spec.md`

## Summary

Activity and athlete IDs become decimal strings throughout the app, the gateway, the season album
and the fake Strava. They are read from Strava exactly, from the digits of the number (`id`, and a
webhook's `object_id` and `owner_id`; `id_str` is ignored, research R1), bound to D1 as text into the
unchanged `INTEGER` columns and read back with `CAST(… AS TEXT)`. One module owns validation,
numeric comparison and exact JSON reading and writing (research R2–R4). Work and sessions written
by the previous version are accepted (R6). Some sample riders and fixtures get large IDs (R7).

## Technical Context

**Language/Version**: TypeScript (Cloudflare Workers), `compatibility_date` 2026-08-22

**Primary Dependencies**: none new; `JSON.parse` source text access and `JSON.rawJSON` from the
platform (research R2, R3)

**Storage**: D1, no migration: columns stay `INTEGER` (research R5)

**Testing**: Vitest in the Workers runtime, a D1 guard in the test setup that fails any result row
with a number in an ID column (R5), Playwright against fake mode with large-ID sample riders

**Target Platform**: every team's Worker, the Strava gateway Worker, the season album Worker

**Project Type**: server-rendered web app with queue consumer

**Performance Goals**: unchanged

**Constraints**: the previous version keeps working during deployment: queue messages, parked work,
sessions and the `held` exchange stay compatible (R3, R6)

**Scale/Scope**: about 110 source files and 150 test files name these IDs; the change is
mechanical outside `src/strava/id.ts`, the Strava readers, the webhook, the gateway and the fake

## Constitution Check

| Principle | Check | Result |
|---|---|---|
| I. Privacy and consent | Reads nothing new: the same `id`, without rounding (R9). Fixtures and samples stay synthetic | Pass |
| II. Strava API | No new request, no polling change; webhook handlers still ack and enqueue only | Pass |
| III. Rider-authored content | Nothing written to Strava | Pass |
| IV. Serverless, minimal deps | Platform JSON features only, no dependency, no new resource | Pass |
| V. Test-first | ID module, webhook and gateway parsing, Strava readers, message parser and session are tested red first with large IDs; the D1 guard turns every existing query test into a cast check | Pass |
| Language | No rider-facing text changes | Pass |
| Team data (feature 026) | Nothing team-specific; samples of every team get large IDs | Pass |
| Migrations additive | No migration (R5) | Pass |

Re-checked after Phase 1 design: still passes; no complexity to justify.

## Project Structure

### Documentation (this feature)

```text
specs/042-strava-64bit-ids/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── ids.md
└── tasks.md
```

### Source Code (repository root)

```text
src/strava/id.ts          # new: isStravaId, toStravaId, compareIds, parseStravaJson, idJson
src/strava/               # client, activity, tokens, withdraw: exact reading (R1, R2)
src/http/webhook.ts       # exact object_id / owner_id
src/http/held.ts          # athleteId as string, number kept on the wire (R3)
src/http/session.ts       # athlete ID as string
src/work/messages.ts      # string IDs, legacy numbers accepted (R6)
src/db/**                 # binds as text, CAST(… AS TEXT) in selects, json_each via idJson
src/**                    # athleteId / activityId: number → string, compareIds for ordering
gateway/index.ts          # exact event check, held exchange (R3)
album/                    # casts in its reads, string IDs
dev/fake-strava/          # string IDs, Strava's wire format, large-ID samples (R7)
test/setup.ts             # D1 guard (R5)
test/**                   # fixtures as strings; large-ID cases
```

**Structure Decision**: existing layout; one new module beside the other Strava plumbing.

## Complexity Tracking

None.
