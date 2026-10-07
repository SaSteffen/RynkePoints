# Quickstart: Roles and Rider Consent (User Stories 1–3)

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-10-07

## 1. Tests

```bash
pnpm install
pnpm lint && pnpm typecheck && pnpm test
```

All tests use synthetic riders. None reads Strava (constitution Principles I and
V).

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
| `test/integration/viewer.test.ts` (new) | flagged rider → organiser and rider; unflagged → rider only; the same session before and after the flag is cleared; no rider flagged → nobody is an organiser, `/me` works; deleted rider → visitor; `needs_reconnect` rider with the flag → organiser (US2 scenarios 1, 2, 4, 5; FR-001, FR-003, FR-006, SC-006) |
| `test/integration/db.test.ts` | `getRider` reads `organiser`; `insertRider` stores 0; `updateRiderOnReconnect` keeps 1; delete and connect again → 0 (US2 scenario 3, FR-003, FR-004) |
| `test/integration/schema-minimisation.test.ts` | `riders` has the `organiser` column (data-model.md) |
| `test/integration/dev-fake-strava.test.ts` | the seed marks the sample organiser, and only them (research R10) |

US2 scenario 6 and SC-007 have no test of their own: every athlete ID in the
repository is synthetic, as for every rider (research R8), and review checks it.

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
5. The seed marked Tina as organiser. Nothing on any page shows the role yet; to
   see the flag:

   ```bash
   pnpm wrangler d1 execute rynke-points --local --persist-to .wrangler/fake-state \
     --command "SELECT athlete_id, first_name FROM riders WHERE organiser = 1"
   ```

   It is still 990004 after step 4's reconnect. Disconnecting Tina on `/me` and
   connecting her again from `/_dev/` clears it; reseeding sets it again.

## 3. Release

Nothing to do before merging: CI applies the migration, and nobody is an organiser
until the maintainer marks them ([contracts/organiser-flag.md](contracts/organiser-flag.md),
"Rollout").
