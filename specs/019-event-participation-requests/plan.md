# Implementation Plan: Riders Report Team-Event Participation

**Branch**: `019-event-participation-requests` (the spec's PR runs on
`018-event-participation-requests`) | **Date**: 2026-10-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/019-event-participation-requests/spec.md`

**Mock-up**: Claude Design "RynkePoints Teamtermine melden",
https://claude.ai/artifact/68rCYVhqbt4QyHFqAXQvMC

## Summary

Riders who aren't organisers get a **Termine** tab listing the season's team
events, with "Bin dabei" before an event and "Ich war dabei" after it. Each tap
stores one row in a new `participation_reports` table; whether it is an intent or
a request follows from the event's date, so nothing has to flip it (R1, R2).
Organisers see open requests counted on the Orga tab, grouped on the Termine
page and per rider in the overview, and settle them with one-tap forms that
record attendance through 014's existing path, plus a signed undo (R4). The
event page's checkboxes become tri-state: radios that `public/app.js` turns into
one cycling box, so a browser without script never denies by accident (R5).
Organisers add themselves with "Ich war auch dabei" (R9). With Team Rynke the
Team page loses its place card and peloton and the Rangliste moves up; Training
keeps them (R12).

- **Reports (R1–R3)**: one table, no status; recording attendance anywhere
  deletes the report in the same batch, so a report never sits next to an
  attendance.
- **Rider tab (R6, R8)**: server-rendered forms; the red "Doch nicht dabei" is
  CSS on hover and focus.
- **Organiser signals (R7)**: one shared SQL condition for "open request"; one
  extra `COUNT` in the shell's batch for organisers.
- **Consent (R11)**: no new version; the visibility table and the consent and
  privacy texts name reports.

One migration (`0017`, adds a table), no new dependency, no Strava request.

## Technical Context

**Language/Version**: TypeScript (`tsc --noEmit`) on Cloudflare Workers, as in
features 001–018.

**Primary Dependencies**: none new. Server-rendered HTML and CSS; one more
progressive enhancement in `public/app.js` (R5).

**Storage**: D1. New table `participation_reports` (migration `0017`, only
adds); reads join `team_events`, `attendances` and 014's listed riders
([data-model.md](data-model.md)).

**Testing**: Vitest in workerd (`pnpm test`) with synthetic riders and events;
Playwright smoke tests for the button swap and the tri-state box
([quickstart.md](quickstart.md) §1).

**Target Platform**: Cloudflare Workers; phone browsers 360 px wide, desktop for
the overview table.

**Project Type**: web service with server-rendered pages.

**Performance Goals**: one extra `COUNT` per organiser page view; the Termine
tab, Termine page and overview each add one statement to their existing batch.

**Constraints**:

- a report never changes Rynke, badges or leaderboards (FR-008);
- riders never see others' reports or counts of them (FR-010);
- nothing tells a rider about a decision beyond 013's usual Rynke notification
  (FR-009, R10);
- every text from the catalogs in German and English (FR-050);
- forms work without script; controls at least 44 px; no sideways scrolling at
  360 px (FR-051).

**Scale/Scope**:

- about 30 riders and 40 events a season, so at most about 1,200 reports;
- 1 new GET (`/events`), 6 new POSTs, 4 pages extended
  ([contracts/http-routes.md](contracts/http-routes.md));
- about 70 catalog keys added or changed, 13 removed
  ([contracts/messages.md](contracts/messages.md)).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. Privacy and consent | Reports are rider-authored, not Strava data, and each is created by the rider's own tap to tell the organisers. They are shown only to organisers (`participationReports: ORGANISER_ONLY`), who already see attendance; riders see only their own. The consent and privacy texts name them; no new consent version, reasoned in R11 like 008, 010 and 013. Denials leave nothing behind (R1); reports go with the rider (foreign key). | ✅ |
| II. Strava API citizenship | No Strava call. | ✅ |
| III. Rider-authored content | Activity descriptions untouched. Organiser decisions are stored inputs (attendance) that re-evaluation never overwrites, as in 014. | ✅ |
| IV. Serverless, minimal deps | No dependency; one additive migration; Rynke stay a pure function of stored inputs, since reports are not inputs. | ✅ |
| V. Test-first | Every route, page and pure module gets a failing test first ([quickstart.md](quickstart.md) §1). | ✅ |
| Repo rules | Text in catalogs; `src/` doesn't import `dev/`; synthetic fixtures; migration keeps the deployed version working. | ✅ |

**Post-design re-check**: still passes. The open-request condition filters by
`LISTED_RIDER_IDS` in SQL, so a rider without current consent never shows up in
a count or list (004 FR-021). The undo token can only restore what a decision
just removed (R4), so organisers can't create reports for riders (FR-021).

## Project Structure

### Documentation (this feature)

```text
specs/019-event-participation-requests/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── http-routes.md   # /events and its POSTs, organiser routes and fields
│   ├── pages.md         # what each page shows, in order
│   └── messages.md      # catalog keys in German and English
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
migrations/
└── 0017_participation_reports.sql      # new table (data-model.md)

src/
├── db/
│   ├── participation.ts                # new: report reads and writes, open-request condition (R7)
│   └── team-events.ts                  # + deleteReportsStatement used by add-attendance
├── rynke/
│   ├── participation.ts                # new: hasTakenPlace, report state (pure, R2)
│   ├── apply.ts                        # add-attendance also deletes reports (R3)
├── visibility.ts                       # + participationReports (R11)
├── http/
│   ├── shell.ts                        # + Termine section (riderOnly), Orga count (R7, R8)
│   ├── sections/events.ts              # new: the Termine tab and its two POSTs
│   ├── sections/team.ts                # Team Rynke: − place card, − peloton, Rangliste before chart
│   ├── organiser/requests.ts           # new: confirm/deny, undo, open-request block (R4)
│   ├── organiser/events.ts             # + open requests, chips, counts, "Ich war auch dabei"
│   ├── organiser/attendance.ts         # tri-state rows, decide-* fields (R5)
│   ├── organiser/overview.ts           # + requests tile, ordering, per-request lines
│   ├── organiser/access.ts             # + done/error codes
│   ├── router.ts                       # + /events, POST routes
│   ├── privacy.ts                      # names reports (FR-052)
│   └── style.ts                        # + event cards, button swap, tri-state box, chips
├── crypto/sign.ts                      # reused for the undo token
└── i18n/messages/{de,en}.ts            # contracts/messages.md

public/app.js                           # + tri-state enhancement (R5)

dev/                                    # sample reports (R14)

test/
├── unit/
│   ├── participation.test.ts
│   └── request-undo.test.ts
├── integration/
│   ├── participation-store.test.ts
│   ├── rider-events.test.ts
│   ├── organiser-requests.test.ts
│   ├── organiser-attendance.test.ts    # + tri-state
│   ├── organiser-overview.test.ts      # + requests
│   ├── team-events-apply.test.ts       # + reports deleted
│   ├── team-leaderboard.test.ts        # Team Rynke: new order, no place, no peloton
│   └── sections.test.ts                # Termine vs Orga

e2e/smoke.e2e.ts                        # Bin dabei / Doch nicht dabei, tri-state box
```

**Structure Decision**: same single Worker. Pure report logic sits next to 003's
team-event rules in `src/rynke/`; the rider tab is a new section beside Team; the
organiser decisions get their own module because two pages (Termine and the
overview) post to them.

## Complexity Tracking

No constitution violations.
