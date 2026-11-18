# Implementation Plan: Administrators on Every Team's Site

**Branch**: `041-admin-every-team` | **Date**: 2026-11-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/041-admin-every-team/spec.md`

## Summary

A maintainer lists, per team, administrators of other teams by Strava ID. They sign in to that
team's site through Strava without being in its club, and are an organiser and an administrator
there. Their own pages fill from their own rides; no team count includes them.

- **Storage** (research R2): a `guests` table (the list, written by hand) and a `riders.guest` mark
  (set by the app at sign-in), in one add-only migration.
- **Never counted** (R3): the consent helpers every team count already goes through
  (`sharedRiderIdsSince`, `sharedRiderExists`, and `LISTED_RIDER_IDS` on top) leave guest rows out.
  Three counts outside them get the same condition by hand. One test compares every team-facing
  output with and without a guest (R9).
- **Roles** (R4): `toRider` makes a listed guest an organiser and an administrator; a guest taken off
  the list is a visitor from their next request. Alerts include guests.
- **No revoke** (R5): `revokeStoredToken` leaves a guest's grant alone, and no refusal at sign-in
  revokes any more, so trying or using another team's site never ends the home connection.
- **Daily run** (R6): no club check for guests; guests taken off the list are deleted without a revoke.
- **Admin riders list** (R7): guests in their own group, marked; removable like riders.
- **Open question for Strava** (R1): whether a second team's token breaks the first. A manual test
  with a real account ([quickstart.md](quickstart.md) §1) decides between reading the guest's rides
  (outcome A), the FR-010 fallback without reading (B, R10), or going back to the spec (C).

## Technical Context

**Language/Version**: TypeScript on Cloudflare Workers

**Primary Dependencies**: none new

**Storage**: D1, migration `0030_guests.sql`: new table `guests`, new column `riders.guest` (add only)

**Testing**: Vitest in the Workers runtime (`app` project and `team:europe`), fake Strava; one manual
check against the real Strava before the reading part (quickstart §1)

**Target Platform**: every team's Worker, both sandboxes, fake mode

**Project Type**: server-rendered web app

**Performance Goals**: no extra round trip per request (the list check rides in the viewer's
existing batch); one fewer Strava request per guest sign-in (no club check)

**Constraints**: no rider data crosses teams (FR-012, 026); no team named on another's page (026
FR-023); migration keeps the previous release working; team counts byte-identical with and without
guests (SC-002)

**Scale/Scope**: a handful of guests per team. About 15 source files (`src/db/consents.ts`,
`riders.ts`, `usage.ts`, `src/http/auth.ts`, `viewer.ts`, `me.ts`, `admin/riders.ts`,
`admin/remove.ts`, `src/strava/tokens.ts`, `src/work/scheduled.ts`, `messages.ts`, the fake samples
and seed), 10 catalogs × ~3 keys, `docs/how-it-runs.md`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|---|---|---|
| I. Privacy and consent | A guest agrees to the team's current consent. Nothing new is read from Strava; a guest's data is shown to nobody but themselves (R3). Riders' data is shown to a guest only as to the team's organisers and administrators, whom the consent names by role; no new version or revision (R12). No rider data crosses teams: the list holds IDs only. Deletion stays prompt and complete; not revoking a grant isn't keeping data (R5) | Pass |
| II. Strava API | No new kind of request. A guest's sign-in skips the club request; the guest's import and webhook events cost what a rider's cost (none in outcome B). The verification in quickstart §1 is a manual step outside the app | Pass |
| III. Rider content | Nothing written to Strava; a guest's organiser changes are ordinary manual corrections | Pass |
| IV. Serverless, minimal | No dependency; one table, one column | Pass |
| V. Test-first | Each story starts with a failing integration test (quickstart §3); the fake Strava records revoke requests | Pass |
| Language | Guest group heading and mark in all ten catalogs, German first | Pass |

Post-design re-check: unchanged. The one widening beyond the spec's wording, no revoke on any
sign-in refusal (R5), removes a request rather than adding one.

## Project Structure

### Documentation (this feature)

```text
specs/041-admin-every-team/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── guest-list.md
│   └── sign-in-and-removal.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
migrations/0030_guests.sql            # guests table, riders.guest
src/db/consents.ts                    # shared filter leaves guests out (R3)
src/db/riders.ts                      # Rider.guest, roles, on_guest_list, capacity count,
                                      #   overview guest group, listClubRiderIds, alerts (R3, R4, R7)
src/db/usage.ts                       # currentAlertStatement includes guests (R4)
src/db/guests.ts                      # isOnGuestList, listRemovedGuestIds (new)
src/http/viewer.ts                    # off the list → visitor (R4)
src/http/auth.ts                      # guest sign-in, no revoke on refusal (R5, R8)
src/http/admin/riders.ts              # guest group (R7)
src/strava/tokens.ts                  # revokeStoredToken skips guests (R5)
src/work/scheduled.ts, messages.ts    # club check without guests, guest sweep (R6)
src/i18n/messages/*.ts                # guest group texts, ten languages
dev/fake-strava/samples.*.ts, seed.ts # one sample guest per team (R13)
docs/how-it-runs.md                   # guest list commands, FR-002 rule
test/integration/guest-*.test.ts      # invariant, sign-in, removal, no revoke (R9)
```

**Structure Decision**: the existing single Worker layout; the exclusion sits in the consent filter
module that already defines who is shared with the team, so no new layer.

## Order of work

1. Migration, `Rider.guest`, the shared filter and the invariant test (US2's counting part): safe on
   its own, since nobody is a guest until the sign-in exists.
2. No revoke (US3), roles and sign-in (US1), daily run and admin list (US4).
3. After quickstart §1: outcome A needs nothing more; outcome B adds R10's fallback.

## Complexity Tracking

None: no principle is violated.
