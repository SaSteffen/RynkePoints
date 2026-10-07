# Quickstart: Ride Names and Links to Strava in the Ride List

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## 1. Automated checks

```bash
pnpm install
pnpm lint && pnpm typecheck && pnpm test
```

These tests prove the feature. All use synthetic riders and the mocked Strava
(constitution I, V; FR-014).

| Test file | Proves |
|---|---|
| `test/unit/activity.test.ts` | the name is mapped as sent; missing, `""` and whitespace give `null`; `ACTIVITY_FIGURES_VERSION` is 3 (FR-001, FR-005) |
| `test/integration/db.test.ts` | the upsert writes and replaces the name; a blank one clears it (FR-001, FR-005) |
| `test/integration/schema-minimisation.test.ts` | `activities.name` is the documented addition; nothing else is (FR-001) |
| `test/integration/activity-event.test.ts` | a title-only update fetches the ride and stores the new name, and its result and balance stay equal (FR-004, SC-004) |
| `test/integration/reread-page.test.ts` | a rider at version 2 gets names from the list; no per-ride request for a missing name; Rynke unchanged (FR-006, SC-002, SC-003) |
| `test/integration/scheduled-reread.test.ts` | the cron re-reads riders below version 3 once |
| `test/integration/rynke-deletion.test.ts`, `delete-rider.test.ts` | no name is left after a delete or a rider leaving (FR-003, SC-006) |
| `test/unit/rider-view.test.ts` | `RideLine.name` comes from the row |
| `test/unit/rider-sections.test.ts` | the link `href` and text, no `target`; name escaped (`<`, `&`, emoji); no span without a name; link also on rides being evaluated (FR-009–FR-011) |
| `test/integration/me-rynke.test.ts` | every row on page 1 and page 3 has its link; a private ride has it too; German and English pages both say "View on Strava" (SC-001, FR-011, FR-012) |
| `test/integration/ride-name-visibility.test.ts` (new) | each rider's names appear only on their own `/me`, on 0 other pages (FR-008, SC-005) |
| `test/integration/landing.test.ts` | the consent text names the ride name; `CONSENT_VERSION` is still 1; `/me` shows `landing.dataRead` (FR-007) |
| `test/unit/catalogs.test.ts` | `brand.viewOnStrava` is in both catalogs; `de` holds the English text (FR-012) |
| `test/integration/no-hardcoded-copy.test.ts` | apart from `span.ride-name`, all visible text still comes from catalogs |
| `test/integration/dev-fake-strava.test.ts` | the fake reports a rename as `title`; links are rewritten to the stand-in page in fake mode only |

## 2. Local walk-through (`pnpm dev`)

1. Run `pnpm dev` and open `http://localhost:8789/_dev/`. Connect a sample rider
   and open their page.
2. **Story 1**: each ride's detail row shows "View on Strava", in German and in
   English. Following it opens the fake's stand-in page for that ride, not real
   Strava (research R9).
3. **Story 2**: the rows show the sample names ("Ride on … at …"). In `/_dev/`,
   "Change a ride", set a new name and send the update. Then reload the rider
   page: the new name shows, with the same Rynke.
4. Set a name of 100 characters without spaces. In the browser's device mode at
   360 px wide, the table must not scroll sideways (SC-007).
5. **Story 3**: rides of a rider stored before this release have no name until
   the re-read. To try it locally, set that rider's `figures_version` to 2 in
   fake mode's local D1 and run the daily job from `/admin/run-daily`. The names
   fill in, and the Rynke stay the same.

Checks on the live site happen after release and are not tasks.
