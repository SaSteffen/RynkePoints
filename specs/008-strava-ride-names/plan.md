# Implementation Plan: Ride Names and Links to Strava in the Ride List

**Branch**: `008-strava-ride-names` | **Date**: 2026-10-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/008-strava-ride-names/spec.md`
(issue [#28](https://github.com/SaSteffen/RynkePoints/issues/28))

## Summary

Every ride in the rider's ride table gets a "View on Strava" link. Once the app
knows a ride's Strava name, the name is shown too.

- **Link (Story 1)**: needs only the stored activity ID. It goes first in 005's
  detail row as `a.tap.strava-activity`, opens in the same tab, and is bold and
  underlined (research R4, R5).
- **Name (Story 2)**: one nullable column, `activities.name` (migration 0006).
  It is filled by the existing mapping from both the list and the single-activity
  responses; blank means `NULL` (R1). A title-only webhook update now refetches
  the ride like any other update (R2). Only the rider page's own query reads the
  column (R7).
- **Older rides (Story 3)**: `ACTIVITY_FIGURES_VERSION` 2 → 3 reuses the one-time
  re-read through the activity list, at 200 rides per request. A missing name
  never triggers a per-ride refetch (R3).
- **Consent**: `landing.dataRead` and `landing.purpose` name the ride name.
  `CONSENT_VERSION` stays 1 (clarification Q1), and `/me`'s consent section now
  also shows `landing.dataRead` (R6).
- **Catalog**: a new `brand.viewOnStrava`, the English text in both catalogs
  (clarification Q2, R8).
- **Dev**: the fake Strava can rename rides. The dev entry rewrites the links to
  a stand-in page, so `pnpm dev` never sends anyone to a real stranger's activity
  (R9).

## Technical Context

**Language/Version**: TypeScript 7 (`tsc --noEmit`), Cloudflare Workers runtime,
as in features 001–007.

**Primary Dependencies**: none new. The existing `html` template, `I18n`,
`evaluateChange`, `storeActivityPage` and the `reread-page` flow. `HTMLRewriter`
(a runtime API) only in `dev/`.

**Storage**: D1. One added nullable column, `activities.name TEXT`
([data-model.md](data-model.md)). There is no index and no other schema change.

**Testing**: Vitest in workerd (`pnpm test`), with synthetic riders and mocked
Strava. The tests per requirement are listed in [quickstart.md](quickstart.md) §1.

**Target Platform**: Cloudflare Workers, server-rendered HTML with no client JS.

**Project Type**: web service. A single Worker: pages, webhook, queue and cron.

**Performance Goals**: the page budget is unchanged (005 SC-005: 2 s at 500
rides). The table query selects one more column for the same 20 rows.

**Constraints**:
- Strava read budget: the re-read uses ≤ 30 requests in total (10 riders ×
  ≤ 3 pages). A rename costs one request.
- The name is visible only to its rider.
- The migration is additive, so the old code keeps working.
- 360 px without sideways scrolling.

**Scale/Scope**: ≤ 10 riders, ≤ 500 rides each. About 9 source files, 1
migration, 2 catalog keys changed and 1 added, and about 14 test files touched.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design
(below).*

| Principle | How this plan complies | Result |
|---|---|---|
| **I. Privacy and consent** | One field is added to the allow-list, with a stated purpose (FR-002). The name isn't needed to compute points, so it is a documented exception to "store the minimum", like `riders.first_name`: the rider needs it to recognise their rides, and the page can't fetch it from Strava (FR-002). It is deleted with the ride or rider, has no copies, and is read only by the owner's page query (R7). It is never logged, and fixtures and samples use invented names. The consent text names it. The version isn't raised (spec clarification Q1, FR-007): under constitution v2.1.0, a field the app already receives with every read, shown only to that rider, is not growth. It needs no new scope or request and is shown to nobody else. Connected riders see the updated text on `/me` (R6). | Pass |
| **II. Strava API citizenship** | Old rides get names from the existing throttled, resumable list re-read, with no per-ride requests for names (R3). A rename costs one queued read, never one inline in the webhook (R2). The page makes no Strava calls (005 FR-003). | Pass |
| **III. Rider-authored content wins** | Nothing is written to Strava. The name is the rider's own text, shown unchanged and escaped (FR-010). FR-008 keeps it out of a future description block. | Pass |
| **IV. Serverless, TS, minimal deps** | No dependency. The rules don't read the name, so evaluation stays pure and the Rynke unchanged (FR-004). Storage growth is negligible on the free tier. | Pass |
| **V. Test-first** | Each FR has a failing test first ([quickstart.md](quickstart.md) §1). Strava is mocked and the riders are synthetic. | Pass |
| **Language** | `brand.viewOnStrava` is in both catalogs, and the English text in `de` is mandated by Strava's brand rule (like `brand.poweredByStrava.alt`). Consent wording is changed in de and en. Code and docs are in English. | Pass |
| **Brand guidelines** | Link text "View on Strava", word for word; bold and underlined; not larger than the surrounding text; the name is not the link (R4, R5). | Pass |
| **Development workflow** | Spec Kit order. One PR into `develop`. The migration is forward-only and applied by CI before the code. | Pass |

**Post-design re-check (after Phase 1)**: still Pass.
- [data-model.md](data-model.md): one nullable column, deleted with its row.
- [contracts/rider-page.md](contracts/rider-page.md): the name and link only in
  `/me`'s detail row.
- [contracts/activity-processing.md](contracts/activity-processing.md): one
  decision-table row; no new endpoint or scope.
- [contracts/messages.md](contracts/messages.md): consent wording in both
  languages, with the version unchanged.

## Delivery

One PR. Story 1 alone would be releasable (the link needs no data), but Stories
2 and 3 are small and share the tests, so splitting gains little. Inside the PR,
tasks follow the story order: link, name storage and rename, re-read, consent
text, dev fake, docs.

## Project Structure

### Documentation (this feature)

```text
specs/008-strava-ride-names/
├── spec.md
├── plan.md                      # this file
├── research.md                  # R1–R11
├── data-model.md                # activities.name, figures version 3
├── quickstart.md                # tests per FR, local walk-through
├── contracts/
│   ├── rider-page.md            # detail-row markup and CSS
│   ├── messages.md              # brand.viewOnStrava, consent wording
│   └── activity-processing.md   # title-only updates, re-read, fake Strava
├── checklists/requirements.md
└── tasks.md                     # /speckit-tasks, not this command
```

### Source Code (repository root)

```text
migrations/
└── 0006_activity_name.sql            # new: activities.name

src/
├── consent.ts                        # comment: why version 1 stays
├── strava/activity.ts                # name in StravaActivity, ActivityRecord,
│                                     # toActivityRecord; version 3
├── db/activities.ts                  # upsert writes name; COLUMNS unchanged
├── db/rider-view.ts                  # RIDE_PAGE_SQL selects a.name; RideRow.name
├── work/activity-event.ts            # drop the title-only skip
├── http/rider-view.ts                # RideLine.name
├── http/rider-sections.ts            # p.ride-strava in the detail row
├── http/html.ts                      # three CSS rules
├── http/me.ts                        # consent section shows landing.dataRead
└── i18n/messages/{de,en}.ts          # brand.viewOnStrava; consent wording

dev/
├── worker.ts                         # rewrite strava-activity links (fake mode)
└── fake-strava/
    ├── events.ts                     # name change → updates.title
    └── pages.ts                      # Name field; stand-in activity page

test/
├── unit/        activity, catalogs, rider-view, rider-sections
├── integration/ activity-event, reread-page, scheduled-reread, db,
│                schema-minimisation, me-rynke, landing, no-hardcoded-copy,
│                rynke-deletion, delete-rider, dev-fake-strava,
│                ride-name-visibility (new)
└── support/     fixtures (makeStravaActivity gets a name), pages (seeded names)

README.md                             # stored data: + ride name
specs/001-strava-connect-webhook/data-model.md   # activities.name row
```

**Structure Decision**: the existing single-Worker layout. No new modules: each
change goes into the file that already owns that concern.

## Complexity Tracking

None. Keeping `CONSENT_VERSION` at 1 was a deviation from Principle I's
re-consent rule until constitution v2.1.0 said what "grows" means (spec
clarification Q1, FR-007).
