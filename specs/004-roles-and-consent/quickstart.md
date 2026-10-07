# Quickstart: Roles and Rider Consent (User Stories 1–3)

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-10-07

## 1. Tests

```bash
pnpm install
pnpm lint && pnpm typecheck && pnpm test
```

All tests use synthetic riders and synthetic organiser IDs. None reads Strava
(constitution Principles I and V).

### User Story 1 — already covered by 001's tests (research R1)

| Scenario | Test |
|---|---|
| 1. consent shown before Strava | `test/integration/landing.test.ts` ("names every activity figure read", "names who sees what and that write access is optional", "shows the consent form …") |
| 2. read + write → connected, version and time recorded | `test/integration/callback.test.ts` ("GET /auth/callback success"), `test/integration/db.test.ts` |
| 3. private activities left out → connected | `test/integration/callback.test.ts`, `test/integration/reconnect-scope.test.ts` |
| 4. write unticked → connected, page says nothing is written, can grant later | `test/integration/callback.test.ts` ("connects a new member who unticked write access"), `test/integration/me-status.test.ts`, `test/integration/reconnect-scope.test.ts` |
| 5. declines on RynkePoints → not sent to Strava, nothing kept | `test/integration/connect.test.ts` ("POST /connect without agreement"), `test/integration/callback.test.ts` ("checks consent before the club") |
| 6. current version → not asked again | `test/integration/callback.test.ts` ("keeps an existing rider's first acceptance", "signs in an existing rider who came without a new agreement") |

New for US1:

| Test file | Proves |
|---|---|
| `test/integration/me-status.test.ts` | a rider without a record sees `me.consent.none`, the consent texts and the form posting `consent=1` to `/connect`; a rider with a record sees no form (edge case "connected before this feature") |
| `test/integration/landing.test.ts` | the landing form is unchanged after moving to `consentForm` |

### User Story 2

| Test file | Proves |
|---|---|
| `test/unit/roles.test.ts` (new) | `organiserIds`: commas, spaces, newlines; `undefined`, `""`, only separators → empty; malformed entries ignored, the rest kept; duplicates (FR-006, research R3) |
| `test/integration/viewer.test.ts` (new) | rider on the list → organiser and rider; off the list → rider only; ID on the list without a rider row → visitor, grants nothing; the same session before and after the list changes; empty and missing list; deleted rider → visitor; `needs_reconnect` rider on the list → organiser (US2 scenarios 1–5, FR-001, FR-003) |
| `test/integration/organiser-ids-hidden.test.ts` (new) | landing page and `/me` for an organiser and a rider: no listed ID in the HTML or in any console output (US2 scenario 6, FR-002, SC-007) |

### User Story 3

| Test file | Proves |
|---|---|
| `test/unit/visibility.test.ts` (new) | `VISIBILITY` equals the FR-020 table cell by cell; for a synthetic team (2 organisers, 3 riders, 1 without consent) every viewer × subject × item gives the FR-020/FR-021 answer; `self` sees everything; `visitor` nothing; nobody but `self` sees `rides` or `consentRecords`; the subject's role changes nothing (US3 scenarios 1–5, FR-007, SC-002) |
| `test/integration/shared-riders.test.ts` (new) | `listSharedRiderIds` and `isShared` with and without records; `SHARED_RIDER_IDS` inside a `COUNT` and a `SUM` over `rynke_balances` leaves the rider without consent out; deleting a rider makes them unshared (FR-015, FR-021, SC-001) |
| `test/integration/viewer.test.ts` | `requireRider` sends a visitor to `/` (US3 scenario 5) |

Catalog checks (`test/unit/catalogs.test.ts`,
`test/integration/no-hardcoded-copy.test.ts`) cover the reworded
`me.consent.none` in both languages (FR-040, SC-008).

## 2. Local walk-through (`pnpm dev`)

1. Run `pnpm dev` and open `http://localhost:8789/`. The consent and the Connect
   button look as before.
2. Untick the box and press Connect: the browser stops you.
3. Open `http://localhost:8789/_dev/` and connect "Tina TrainingDone" (990004);
   on the fake Strava's approval page, untick write access. `/me` says nothing is
   written to your ride descriptions, and "Your consent" shows version 1 and
   today's date.
4. To see a rider without a record, remove hers in the local database and reload
   `/me`:

   ```bash
   pnpm wrangler d1 execute rynke-points --local --persist-to .wrangler/fake-state \
     --command "DELETE FROM consent_records WHERE athlete_id = 990004"
   ```

   "Your consent" now shows the consent texts and the form. Agree and go through
   the fake Strava again: the section shows version 1, and write access can be
   granted this time.
5. Nothing on any page shows who is an organiser; `dev/fake.env` makes 990004 one
   for the organiser pages to come.

## 3. Release

Before merging the release that contains this feature into `main`, the maintainer
sets the secret ([contracts/configuration.md](contracts/configuration.md),
"Rollout"). The deploy fails without it.
