# Implementation Plan: Roles and Rider Consent (User Stories 1–4)

**Branch**: `004-roles-and-consent` | **Date**: 2026-10-07, US4 added 2026-10-08 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-roles-and-consent/spec.md`

**Scope**: User Stories 1–4. User Story 5 (Strava review) is deferred until the
organiser overview and the team leaderboard exist; it needs no code.

## Summary

This plan adds the organiser role and one shared visibility rule. It finishes the
consent step that feature 001 built together with this spec.

- **US1, consent at connect**: already built by 001 (commit `9dbf67d`, 001 research
  R21): consent form, version, records, optional write access. Each scenario
  already has a test. One gap remains: a rider connected before the consent step
  is told to sign out and connect again. Instead, `/me` now shows them the consent
  texts and the same form, which goes through Strava again (R1).
- **US2, organisers**: a flag on the rider row, `riders.organiser`, which the
  maintainer sets in the database and the app never writes. `readViewer` reads the
  row on every request and decides visitor, rider or organiser. The flag needs a
  rider row, so only a connected rider can be an organiser (R2–R4, R8).
- **US3, visibility**: a pure `src/visibility.ts` holds the FR-020 table once.
  `maySee(audience, data, shared)` answers every viewer × rider × item. One SQL
  subquery, `SHARED_RIDER_IDS`, keeps riders without consent out of every row and
  figure (R5, R6). No view is built here. Organiser-admin and team-leaderboard
  use this contract.
- **US4, consent versions** (research R11–R17): the versions become a registry in
  `src/consent.ts` (number, publication date, permissions needed, catalog keys of
  what changed), passed in through `Ctx` so tests can publish a synthetic version 2.
  `/me` already shows what a rider agreed to (FR-014); a rider whose consent is
  missing or older than the current version gets a **consent gate** on `/me`
  instead of their page: what changed, the current consent, a form, and the way
  out (disconnect). Agreeing records the version directly through a new
  `POST /me/consent`, or goes through Strava when the new version needs a
  permission the rider hasn't granted. Until then, each `RiderData` item is
  shared only with riders whose accepted version reaches the item's
  `sinceVersion`, so `maySee` takes the subject's accepted version instead of a
  boolean, and `sharedRiderIdsSince(version)` generalises `SHARED_RIDER_IDS`.
- One add-only migration, one new route (`POST /me/consent`), no new dependency,
  no configuration change; one catalog key reworded and five added.

## Technical Context

**Language/Version**: TypeScript 7 (`tsc --noEmit`) on the Cloudflare Workers
runtime, as in features 001–010.

**Primary Dependencies**: none new. Existing: `html` template, `I18n`, session
helpers, `getRider`, `consent_records` helpers.

**Storage**: D1. Migration `0009_organiser_flag.sql` adds `riders.organiser`
([contracts/organiser-flag.md](contracts/organiser-flag.md)); `consent_records`
from 001 migration `0004` is used as it is, also for US4 (one row per accepted
version already).

**Testing**: Vitest in workerd (`pnpm test`). The pure `visibility.ts` gets unit
tests. Viewer, the flag, shared riders and `/me` get integration tests. `seedRider`
gains an `organiser` option (R9).

**Target Platform**: Cloudflare Workers; server-rendered HTML, no script.

**Project Type**: web service (one Worker serving pages, webhook, queue and cron).

**Performance Goals**: no measurable cost. The flag comes with the `getRider` read
each signed-in request already makes. `SHARED_RIDER_IDS` is a primary-key range
scan over ≤ 10 riders' records.

**Constraints**:
- No real organiser's athlete ID in the repository (FR-002, SC-007).
- With nobody flagged the app works as today (FR-006).
- The role is decided per request, from the rider row (FR-003).
- The migration only adds a column, so the deployed code keeps working while CI
  applies it.
- All text comes from the catalogs (FR-040).

**Scale/Scope**:
- ≤ 10 riders (Strava capacity, FR-030), a handful of organisers.
- 1 migration. 4 new source files (`visibility.ts`, `http/viewer.ts`,
  `http/consent-form.ts`, `http/consent-gate.ts`). 10 changed: `consent.ts`,
  `ctx.ts`, `index.ts`, `db/consents.ts`, `db/riders.ts`, `http/me.ts`,
  `http/landing.ts`, `http/auth.ts`, `http/router.ts`, and the catalogs.
- Fake mode: `dev/fake-strava/samples.ts`, `dev/fake-strava/seed.ts`,
  `dev/worker.ts` (the registry in its `Ctx`).
- 5 new test files, 7 extended, `test/support/ctx.ts` extended.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design
(below).*

| Principle | How this plan complies | Result |
|---|---|---|
| **I. Privacy and consent** (v2.1.0) | One required consent at connect, write access and private activities optional: unchanged from 001. A rider without a record is offered the same consent and is left out of every shared view until they agree. Team-visible data is limited to riders with a recorded consent (`SHARED_RIDER_IDS`, FR-021), as the principle requires for leaderboards. Nothing new is read from Strava. The one stored addition is the organiser flag, set by the maintainer, not Strava data, and deleted with the rider (R2). No real organiser ID is committed; fixtures and sample IDs are synthetic (R8). US4 makes "MUST ask again when what it reads, writes or shows grows" enforceable: a new version gates `/me` and future views until the rider agrees, and until then they are shown only as their accepted version allows (R11–R15). | Pass |
| **II. Strava API citizenship** | No new Strava request. The consent form for riders without a record goes through the existing OAuth flow, one authorisation per rider. Re-agreeing to a new version goes through Strava only when it needs a permission the rider hasn't granted (R14). Capacity is unchanged (FR-030). | Pass |
| **III. Rider-authored content wins** | Nothing is written to Strava. Write access stays optional and recorded (FR-012); switching it off by reconnecting without it is 001's existing path (FR-016). | Pass |
| **IV. Serverless, TS, minimal deps** | No dependency, no new binding or secret. One column on an existing table. The rule is a pure table (R5). | Pass |
| **V. Test-first** | Every FR in scope maps to a failing test first ([quickstart.md](quickstart.md) §1). US1 scenarios are already covered. New behaviour starts red. | Pass |
| **Language** | `me.consent.none` reworded; five `me.consent.renew.*` keys added for the gate, in `de` and `en`. Each future version adds its `consent.changes.v<N>` keys in both (R16). Code and docs in English. | Pass |
| **Development workflow** | Spec Kit order. Setting the flag is a manual maintainer step in D1 ([contracts/organiser-flag.md](contracts/organiser-flag.md)), not needed for this release. The migration adds a defaulted column only, so the deployed code keeps working while CI applies it (R2). | Pass |

**Post-design re-check (after Phase 1)**: still Pass.
- [data-model.md](data-model.md): one column on `riders`, deleted with the rider;
  the role is derived per request from it; consent records still cascade with the
  rider.
- [contracts/viewer-and-visibility.md](contracts/viewer-and-visibility.md): views
  must filter inside SQL with `SHARED_RIDER_IDS`. An athlete ID may appear only in
  an organiser's "View on Strava" link (FR-022).
- [contracts/organiser-flag.md](contracts/organiser-flag.md): the app never
  writes the flag (FR-004); only synthetic IDs in the repository.
- [contracts/rider-pages.md](contracts/rider-pages.md): the consent form is the
  landing page's, unchanged; the reworded text exists in both catalogs.
- [contracts/re-consent.md](contracts/re-consent.md): the gate on `/me`,
  `POST /me/consent`, `requireConsent` for future views, and the steps for
  publishing a new version; no new storage.

## Delivery

| Delivery | Stories | Requirements | Depends on | Releasable alone |
|---|---|---|---|---|
| **1 (one PR into `develop`)** | US1–US4 | FR-001–FR-007, FR-010–FR-016, FR-020–FR-023, FR-030, FR-040 | 001 (merged) | yes; nobody is an organiser until the maintainer sets a flag, and with only version 1 the gate shows only to riders without a record |
| deferred | US5 | Strava review | the organiser overview and leaderboard | — |

US4 ships with US1–US3 because it changes `maySee`'s third argument and the
`/me` consent section that US1 and US3 introduce; shipping them apart would build
both twice (research R17).

Within the PR, tasks follow the dependencies:
1. migration `0009_organiser_flag.sql`, `Rider.organiser`, `seedRider`'s
   `organiser` option, the schema test and 001's data model;
2. the fake-mode sample organiser;
3. `readViewer` and `requireRider`, with `/me` switched over;
4. `SHARING_SINCE_VERSION`, `SHARED_RIDER_IDS`, `listSharedRiderIds`, `isShared`;
5. `visibility.ts`;
6. `consentForm` and the `/me` consent section for riders without a record;
7. the US1 re-check against [quickstart.md](quickstart.md) §1;
8. the version registry in `Ctx`, and `CONSENT_VERSION` users switched to it;
9. `sinceVersion` per `RiderData`, `maySee` with the subject's version,
   `sharedRiderIdsSince`;
10. the consent gate on `/me`, `POST /me/consent`, `requireConsent`.

## Project Structure

### Documentation (this feature)

```text
specs/004-roles-and-consent/
├── spec.md
├── plan.md                         # this file
├── research.md                     # R1–R10
├── data-model.md                   # riders.organiser, Viewer, VISIBILITY, shared riders
├── quickstart.md                   # tests per scenario, local walk-through
├── contracts/
│   ├── organiser-flag.md           # riders.organiser, how to set it, rollout
│   ├── viewer-and-visibility.md    # what the planned views build on
│   ├── rider-pages.md              # consent form helper, /me section, message
│   └── re-consent.md               # US4: gate, POST /me/consent, new versions
├── checklists/requirements.md
└── tasks.md                        # /speckit-tasks, not this command
```

### Source Code (repository root)

```text
migrations/
└── 0009_organiser_flag.sql   # new: riders.organiser

src/
├── visibility.ts             # new: RiderData, Audience, VISIBILITY, audienceOf, maySee (pure)
├── consent.ts                # + ConsentVersion registry, consentState (pure)
├── ctx.ts, index.ts          # Ctx.consentVersions, CONSENT_VERSIONS in production
├── db/consents.ts            # + sharedRiderIdsSince, SHARED_RIDER_IDS, listSharedRiderIds, consentVersionOf
├── db/riders.ts              # Rider.organiser
├── http/viewer.ts            # new: Viewer (with the accepted version), readViewer, requireRider, requireConsent
├── http/consent-form.ts      # new: consentForm (the landing page's form)
├── http/consent-gate.ts      # new: the gate page, POST /me/consent
├── http/landing.ts           # uses consentForm
├── http/auth.ts              # the current version from ctx.consentVersions
├── http/me.ts                # uses readViewer; gate when consent is missing or older
├── http/router.ts            # + POST /me/consent
└── i18n/messages/{de,en}.ts  # me.consent.none reworded; me.consent.renew.*

dev/
├── worker.ts                 # Ctx.consentVersions, the current version in /_dev/connect
└── fake-strava/
    ├── samples.ts            # SampleRider.organiser; Tina (990004) is one
    └── seed.ts               # marks the sample organisers after connecting

specs/001-strava-connect-webhook/data-model.md   # riders.organiser

test/
├── support/ctx.ts            # seedRider({ organiser }), makeCtx({ consentVersions })
├── unit/                     # visibility, consent-versions (new)
└── integration/              # viewer, shared-riders, consent-gate (new); db,
                              # schema-minimisation, dev-fake-strava, me-status,
                              # landing, callback, connect extended
```

**Structure Decision**: the existing single-Worker layout.
- Request-level code (`viewer.ts`, `consent-form.ts`) sits in `src/http/`.
- The pure `visibility.ts` sits at the top of `src/`, next to `consent.ts`,
  because every later view (HTTP) and query (DB) uses it.
- The SQL helpers sit with the existing consent queries in `src/db/consents.ts`.

## Design diagram

How a planned view decides what to show (US2 + US3):

```mermaid
flowchart TD
    req["Request to a view"] --> rv["readViewer"]
    rv -->|no session / no rider row| vis["visitor → requireRider → 302 /"]
    rv -->|rider row| role["organiser = rider.organiser"]
    role --> q["Query with athlete_id IN (SHARED_RIDER_IDS)"]
    q --> each["For each rider and item:<br/>maySee(audienceOf(viewer, rider), item, shared)"]
    each -->|yes| show["Rendered"]
    each -->|no| hide["Left out"]
    flag[("riders.organiser<br/>set by the maintainer")] -.-> role
    cr[("consent_records")] -.-> q
```

How a rider meets a new consent version (US4):

```mermaid
flowchart TD
    me["GET /me or a planned view"] --> st{"consentState"}
    st -->|current| page["The page as usual"]
    st -->|missing or older| gate["Gate on /me: what changed,<br/>current consent, form, leave"]
    gate -->|needs a permission<br/>not granted| strava["POST /connect → Strava<br/>→ callback records version"]
    gate -->|permissions suffice| post["POST /me/consent<br/>records version"]
    gate -->|leave| del["/me/disconnect<br/>deletes everything"]
    strava --> page
    post --> page
    others["Others' views"] -.->|until then: items with<br/>sinceVersion ≤ accepted| st
```

## Complexity Tracking

No deviation from the constitution.
