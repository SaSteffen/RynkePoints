# Implementation Plan: Administrators Give and Take Roles

**Branch**: `043-admin-grants-roles` | **Date**: 2026-11-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/043-admin-grants-roles/spec.md`

## Summary

Own administrators give and take the Orga and Admin roles in a new admin view, Admin › Rollen. An
administrator is always an organiser. The rider finds a card about the change on their next visit;
organisers and administrators see in Settings who is in the Orga. The pages follow the design
draft named in the spec.

- **Role** (research R1): the two existing flags, written as a pair; `toRider` reads every
  administrator as an organiser. No rename, no drop.
- **New columns** (R2, R3): `role_since` for the "seit" dates; `role_seen`, `role_changed_by`,
  `role_changed_at` for the card, which keeps only where the rider started, so an undo leaves no
  card.
- **Rollen** (R4, R5, R8): `GET`/`POST /admin/roles`, one dialog for the choice filled by `app.js`,
  undo as an ordinary change back, a client-side search over the listed riders without a role.
- **Card** (R6): on the Du page, replacing the Orga-Rundgang's invitation for new organisers;
  `POST /me/role-card` closes it or starts the tour.
- **Last administrator** (R7): removal refused for the team's only own administrator.
- **Settings** (R9): the row "Wer in der Orga ist" for organisers, the link for own
  administrators.

## Technical Context

**Language/Version**: TypeScript on Cloudflare Workers

**Primary Dependencies**: none new

**Storage**: D1, migration `0036_roles.sql`: four nullable columns on `riders` (add only)

**Testing**: Vitest in the Workers runtime (integration tests per story, the pages snapshot);
Playwright smoke test for the dialog on Rollen

**Target Platform**: every team's Worker, both sandboxes, fake mode

**Project Type**: server-rendered web app with `public/app.js`

**Performance Goals**: no extra query on ordinary pages: the role card's columns come with the
rider's row, which every page already reads; Settings adds one small query for organisers only

**Constraints**: migration keeps the previous release working; no rider data crosses teams; text
in all ten catalogs; nothing written to Strava

**Scale/Scope**: a few hundred riders per team. About 12 source files: `migrations/0036_roles.sql`,
`src/db/riders.ts` (role, change, card, lists, last-admin count), `src/http/admin/access.ts`
(switch), `src/http/admin/roles.ts` (new), `src/http/admin/remove.ts`, `src/http/router.ts`,
`src/http/sections/overview.ts` (card), `src/http/role-card.ts` (new, POST), `src/http/tour.ts`
(invitation), `src/http/sections/settings.ts`, `src/http/style.ts`, `src/http/icons.ts` (key),
`public/app.js`, 10 catalogs × ~45 keys, `docs/how-it-runs.md` (roles no longer by hand)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|---|---|---|
| I. Privacy and consent | Nothing new read from Strava. Who sees riders' data is unchanged: the Orga, which the consent names; an administrator in the Orga sees what the Orga sees, as the user decided (spec Assumptions). Rollen and the Settings row show first names of role holders and listed riders, which administrators and organisers already see. The card's copied first name goes with the rider's data. Deletion unchanged | Pass |
| II. Strava API | No Strava request | Pass |
| III. Rider content | Nothing written to Strava | Pass |
| IV. Serverless, minimal | No dependency; four columns; no new table | Pass |
| V. Test-first | Each story starts with a failing integration test (quickstart §5); the dialog with a Playwright test | Pass |
| Language | All new text in the ten catalogs, German first | Pass |

Post-design re-check: unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/043-admin-grants-roles/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── http-routes.md
│   └── pages.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
migrations/0036_roles.sql             # role_since, role_seen, role_changed_by, role_changed_at
src/db/riders.ts                      # administrator ⇒ organiser in toRider, roleOf, setRole,
                                      #   readRoles (Rollen lists), roleCard / clearRoleCard,
                                      #   orgaNames (Settings), ownAdministratorCount
src/http/admin/access.ts              # third switch segment, AdminView "roles"
src/http/admin/roles.ts               # GET/POST /admin/roles (new)
src/http/admin/remove.ts              # lastAdmin refusal
src/http/router.ts                    # the new routes
src/http/sections/overview.ts         # role card on the Du page
src/http/role-card.ts                 # POST /me/role-card (new)
src/http/tour.ts                      # no organiser invitation while the card stands in for it
src/http/sections/settings.ts         # "Wer in der Orga ist"
src/http/style.ts, src/http/icons.ts  # role-sheet, role-notice, roles layout; KEY icon
public/app.js                         # open/fill the dialog, the search filter
src/i18n/messages/*.ts                # ten languages
docs/how-it-runs.md                   # roles in the app; by hand only for a first admin
test/integration/admin-roles*.test.ts, role-card.test.ts, settings-orga.test.ts
test/e2e/admin-roles.spec.ts
```

**Structure Decision**: the existing single Worker layout. Role reads and writes stay in
`src/db/riders.ts`, which owns the flags; the page sits beside the other admin views.

## Order of work

1. Migration, `toRider` rule and the tests it changes (R1, R10): safe alone.
2. Rollen read-only, the switch (US6's view, US4's own-row rule).
3. Changes, undo, refusals (US1–US3's admin side), last-admin removal (US4).
4. Role card and the tour invitation (US1–US3's rider side).
5. Settings row (US5), catalogs, docs.

## Complexity Tracking

None: no principle is violated.
