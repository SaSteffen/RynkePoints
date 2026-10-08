# Implementation Plan: Organiser Administration (Stories 1–3)

**Branch**: `014-organiser-admin` | **Date**: 2026-10-08 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/014-organiser-admin/spec.md`

**Scope**: User Stories 1–3 (team events, attendance, corrections) only.
Stories 4–6 (rules, recalculation, Team Settings) get their own plan revision
when they are taken up.

## Summary

Organisers get server-rendered pages under `/organiser`, inside the app shell
with the Team tab current. They can manage team events, tick attendance and add
or remove corrections. The team-event writes already exist in feature 003
(`applyTeamEventChange`), so Stories 1 and 2 are mostly pages and forms. Story 3
needs feature 003's missing Story 6: a `corrections` table and corrections in
the tally.

- **Access (FR-001, FR-002)**:
  - One helper, `organiserPage()`, wraps `shellPage()` and answers 403 for a
    rider who is not an organiser (R1).
  - Every POST checks the same origin, the session, current consent and the
    organiser flag afresh (R1).
  - `/team` shows a link to `/organiser` to organisers only (R2).
- **Events (Story 1)**:
  - `/organiser` lists the events, newest first, with a form to add one.
  - `/organiser/events/{id}` has the event's edit form, its attendance and a
    delete button inside a `<details>` as the confirmation (R4).
  - The season-window check (FR-012) lives in the organiser layer, so feature
    003's core stays as it is (R5).
- **Attendance (Story 2)**:
  - The event page has one checklist form of the listed riders (R6).
  - The server applies only what the organiser changed against the state
    the page showed, so two organisers working at once don't undo each other.
  - Future events show the list without the form (FR-022).
- **Corrections (Story 3)**:
  - `/organiser/riders` lists the listed riders.
  - `/organiser/riders/{id}` lists the rider's corrections, with a form to add
    one and a confirmed remove for each.
  - `applyCorrectionChange` re-evaluates the rider in the same batch as the
    write, like team events (R7, R8).
- **Change record (FR-040)**: `changed_by` and `changed_at` columns on
  `team_events`, `attendances` and `corrections`. `changed_by` is set to NULL
  when the organiser leaves, which shows as "former organiser" (R9).

One migration, `0011_organiser_admin.sql`, adds a table and columns only. There
is no new Strava request, scope or consent version.

## Technical Context

**Language/Version**: TypeScript (`tsc --noEmit`) on Cloudflare Workers, as in
features 001–012.

**Primary Dependencies**: none new. Plain HTML forms with POST/redirect/GET and
no client JavaScript (R3).

**Storage**: D1. A new `corrections` table plus `changed_by`/`changed_at` columns
on `team_events` and `attendances` ([data-model.md](data-model.md)).

**Testing**: Vitest in workerd (`pnpm test`) with synthetic riders and
organisers. Integration tests go through `handleFetch`, and unit tests cover
validation and the tally ([quickstart.md](quickstart.md) §1).

**Target Platform**: Cloudflare Workers; phone browsers 360 px wide (FR-044).

**Project Type**: web service with server-rendered pages.

**Performance Goals**: SC-001: an event plus 15 ticks in under 2 minutes. That
is one form to create the event and one checklist submit, so 2 page loads. SC-004:
the balance changes in the same batch as the input, and `evaluate-rider`
follows within seconds.

**Constraints**:
- the role and consent are read afresh on every request (004 FR-003);
- every listing filters riders inside SQL by consent (004 FR-021);
- all text comes from the catalogs in German and English (FR-043);
- controls are at least 44 px tall (011).

**Scale/Scope**:
- a handful of organisers, about 30 riders and about 60 events a season;
- 4 GET routes and 6 POST routes, plus the link on `/team`;
- about 45 catalog keys.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. Privacy and consent | Organisers see only first name, profile link, attendance and corrections of riders whose consent shares them (004 FR-020): `firstName`, `profileLink`, `attendance` and `corrections` are already `ORGANISER_ONLY`. Nothing newly shown, so no new consent version. No balances shown (FR-042). The change record keeps the organiser's athlete ID only while they are a rider. On deletion it becomes NULL by `ON DELETE SET NULL`, and corrections and attendance go with their rider by cascade (R9). | ✅ |
| II. Strava API citizenship | No Strava call. The "View on Strava" link is a plain link to the profile. Re-evaluation reads D1 only. | ✅ |
| III. Rider-authored content | Not touched. Corrections are organiser inputs kept through every re-evaluation until removed (003 FR-010). | ✅ |
| IV. Serverless, minimal deps | No dependency, no client script, one additive migration. | ✅ |
| V. Test-first | Every FR gets a failing test first ([quickstart.md](quickstart.md) §1). | ✅ |
| Repo rules | Text only in catalogs; `src/` doesn't import `dev/`; synthetic fixtures; the migration keeps the deployed version working (only adds). | ✅ |

**Post-design re-check**: still passes. The attendance `INSERT … ON CONFLICT DO
NOTHING` keeps the first recorder, so SC-003 holds and the change record stays
honest.

## Project Structure

### Documentation (this feature)

```text
specs/014-organiser-admin/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── http-routes.md   # routes, form fields, refusal codes and messages
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
migrations/
└── 0011_organiser_admin.sql   # corrections table; changed_by/changed_at columns

src/
├── db/
│   ├── corrections.ts         # new: list, insert, delete statements; of-riders read
│   ├── team-events.ts         # + list season events with attendee count; changed_by/at
│   └── organiser.ts           # new: listed riders (consent-filtered in SQL)
├── rynke/
│   ├── apply.ts               # + corrections in RiderState/readRiders; applyCorrectionChange;
│   │                          #   `by` on team-event changes; correctionChange(ctx, …)
│   └── tally.ts               # + extrasFrom(attendance, corrections)
├── http/
│   ├── router.ts              # + /organiser routes
│   ├── organiser/             # new
│   │   ├── access.ts          # organiserPage(), requireOrganiserPost()
│   │   ├── events.ts          # list, create, edit, delete (Story 1)
│   │   ├── attendance.ts      # checklist save (Story 2)
│   │   └── corrections.ts     # riders list, rider corrections (Story 3)
│   ├── sections/team.ts       # + organiser link for organisers
│   └── style.ts               # + checklist and form styles
└── i18n/messages/{de,en}.ts   # + organiser.* keys

test/
├── unit/                      # correction validation, tally with corrections
└── integration/
    ├── organiser-access.test.ts
    ├── organiser-events.test.ts
    ├── organiser-attendance.test.ts
    └── organiser-corrections.test.ts

dev/fake-strava/seed.ts        # + a few sample events so `pnpm dev` has data
```

**Structure Decision**: same single Worker. The organiser pages get their own
`src/http/organiser/` folder next to `sections/`, because they are a separate
area with their own access rule.

## Complexity Tracking

No constitution violations.
