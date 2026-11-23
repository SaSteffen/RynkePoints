# Implementation Plan: Riders and Roles in One Admin Tab

**Branch**: `045-riders-and-roles` | **Date**: 2026-11-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/045-riders-and-roles/spec.md`

## Summary

The Admin page's Rider and Rollen tabs become one tab, Rider und Rollen, at the Rider tab's
address `/admin/riders`. It has Rollen's lists and look plus Gäste, a red line on rows that need
attention, and one search over everyone. Each row's "Ändern" opens one sheet with the Rider tab's
facts, the role choice and "Entfernen". The pages follow the design draft named in the spec.

- **Address** (research R1, R2): `/admin/riders` stays and takes over; `GET /admin/roles` redirects
  to it keeping the query, with Rollen's two error codes renamed so they can't clash with the
  removal codes. `POST /admin/roles` and the removal routes keep working as they are.
- **Reader** (R3): one function reads listed riders with role, date and facts, the guests, and
  the counts; it replaces the two old readers. No new data.
- **Sheet** (R4, R5): each row holds its facts in an inert template; `app.js` copies it into the
  one dialog, sets "Entfernen" from the button, and hides the role part for guests.
- **Texts** (R6, R10): the Orga's plain words as whole-sentence keys, with a Termine variant
  chosen by the team's existing `hasEvents`.
- **Look** (R7 to R9): two columns (Ohne Rolle beside the rest), the search at the top of the
  first, a red line in words.
- **Gone** (R11): the Rider tab's card list and styles, the "Rolle geben" code, the key icon, the
  third switch segment.

## Technical Context

**Language/Version**: TypeScript on Cloudflare Workers

**Primary Dependencies**: none new

**Storage**: D1, no migration: the page reads columns that exist ([data-model.md](data-model.md))

**Testing**: Vitest in the Workers runtime (integration tests per story, the catalogs test);
Playwright for the dialog

**Target Platform**: every team's Worker, both sandboxes, fake mode

**Project Type**: server-rendered web app with `public/app.js`

**Performance Goals**: no extra queries: one batch of four statements (listed riders, guests,
riders who haven't agreed, blocked) replaces what the two tabs read separately; no extra request
when the sheet opens

**Constraints**: nothing new reaches an administrator that the two tabs didn't show already; no
rider data crosses teams; text in all ten catalogs, unused keys removed; nothing written to Strava;
no rider-facing text in JavaScript

**Scale/Scope**: a few hundred riders per team, so a few hundred rows each with a small template.
About 16 files: `src/db/riders.ts` (one reader), `src/http/admin/riders.ts` (the page, rewritten),
`src/http/admin/roles.ts` (POST target and the old address's redirect; the page code leaves),
`src/http/admin/access.ts`, `src/http/router.ts`, `src/http/sections/settings.ts` (link),
`src/http/style.ts`, `src/http/icons.ts`, `public/app.js`, 10 catalogs × about 10 keys,
`docs/how-it-runs.md`, and the tests named below

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|---|---|---|
| I. Privacy and consent | Nothing new read from Strava or the database: the four facts and the role are what the Rider and Rollen tabs showed the same administrators. No rides, Rynke, tokens or IDs beyond the removal address already in the Rider tab's links. No consent revision (spec Assumptions); the rider-facing texts about the Orga and the administrators are untouched. The Orga's shorter description is for administrators only | Pass |
| II. Strava API | No Strava request (a removal revokes at Strava exactly as today) | Pass |
| III. Rider content | Nothing written to Strava | Pass |
| IV. Serverless, minimal | No dependency, no migration; one batch instead of two | Pass |
| V. Test-first | Each story starts with a failing integration test (tasks.md); the dialog gets a Playwright test | Pass |
| Language | All new and changed text in the ten catalogs, German first; removed text removed everywhere | Pass |

Post-design re-check: unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/045-riders-and-roles/
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
src/db/riders.ts                 # one reader for the tab; readRoles and readRiderOverview go
src/http/admin/riders.ts         # GET /admin/riders: the merged page, rows, sections, notices, the
                                 #   sheet (the Rollen page's builders move here)
src/http/admin/roles.ts          # POST /admin/roles (back to /admin/riders, new error codes) and
                                 #   the redirect for the old address; the page code leaves
src/http/admin/access.ts         # two segments, AdminView "usage" | "riders"
src/http/admin/remove.ts         # unchanged
src/http/router.ts               # GET /admin/roles → the redirect
src/http/sections/settings.ts    # "Mitglieder ändern" → /admin/riders
src/http/style.ts                # red line, facts, sheet's Entfernen and "Rolle" heading; the
                                 #   .admin-rider card styles go
src/http/icons.ts                # KEY goes
public/app.js                    # adminRoles(): facts into the dialog, Entfernen, role part
                                 #   toggle, search over the whole page
src/i18n/messages/*.ts           # ten languages
docs/how-it-runs.md              # "Admin › Rider und Rollen"
test/unit/catalogs.test.ts       # the key lists
test/integration/admin-riders.test.ts, admin-roles.test.ts   # rewritten to the merged page
test/integration/admin-access.test.ts, settings-orga.test.ts # the redirect, the link
test/teams/guest-invariant.test.ts                           # Gäste markup
e2e/admin-roles.e2e.ts, e2e/smoke.e2e.ts                     # the dialog, the card list's removal
```

**Structure Decision**: the existing single Worker layout. The page sits where the Rider tab's
did (its address, its file); the role change stays its own POST in `roles.ts`; the reader stays in
`src/db/riders.ts`, which owns the rider rows.

## Order of work

1. Texts and the reader (catalogs in ten languages, the one reader), the switch with two segments:
   safe alone.
2. The page with Rollen's lists, Gäste, the red line, the search, the redirect and the notices
   (US1).
3. The sheet with facts, role and "Entfernen", saving a role, the removal flow checked end to end
   (US2, US3).
4. Guests as listed and as viewers (US4, US5).
5. The Orga's plain words with and without Termine (US6).
6. Clean-up, e2e, docs, snapshot.

## Complexity Tracking

None: no principle is violated.
