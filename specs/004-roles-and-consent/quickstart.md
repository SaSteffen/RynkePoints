# Quickstart: Roles and Rider Consent (User Stories 1–4)

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-10-07, US4 2026-10-08

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
| `test/integration/me-status.test.ts` | a rider without a record sees `me.consent.none`, the consent texts and the form posting `consent=1` to `/connect`, and none of the rest of `/me` (with US4's gate); a rider with a record sees no form (edge case "connected before this feature") |
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
| `test/unit/visibility.test.ts` (new) | `VISIBILITY` equals the FR-020 table cell by cell; for a synthetic team (2 organisers, 3 riders, 1 without consent) every viewer × subject × item gives the FR-020/FR-021 answer, with `subjectVersion` `null` for the rider without consent; `self` sees everything; `visitor` nothing; nobody but `self` sees `rides` or `consentRecords`; the subject's role changes nothing (US3 scenarios 1–5, FR-007, SC-002) |
| `test/integration/shared-riders.test.ts` (new) | `listSharedRiderIds` and `consentVersionOf` with and without records; `SHARED_RIDER_IDS` inside a `COUNT` and a `SUM` over `rynke_balances` leaves the rider without consent out; deleting a rider makes them unshared (FR-015, FR-021, SC-001) |
| `test/integration/viewer.test.ts` | `requireRider` sends a visitor to `/` (US3 scenario 5) |

### User Story 4

The gate tests run with `makeCtx({ consentVersions })` and a synthetic version 2
whose `changes` reuse existing keys (research R11); production has version 1 only.

| Scenario | Test |
|---|---|
| 1. `/me` shows what was agreed, version and date, permissions, who sees what, disconnect | `test/integration/me-status.test.ts` (one test for all of them, research R12) |
| 2. older version → what changed, agree before going on | `test/integration/consent-gate.test.ts` (new): a rider on version 1 under a registry with version 2 sees `me.consent.renew.older`, the version 2 change texts, the current consent and the form posting to `/me/consent`, and not their Rynke or rides; `POST /me/consent` records version 2 and `/me` is the usual page afterwards |
| 3. others see them only as far as their version allows | `test/unit/visibility.test.ts`: an item with `SINCE_VERSION` 2 is hidden for a subject on version 1 and shown on version 2; `test/integration/shared-riders.test.ts`: `sharedRiderIdsSince(2)` leaves the version 1 rider out of a `SUM` |
| 4. new permission needed → through Strava | `test/integration/consent-gate.test.ts`: version 2 requires a scope the rider lacks → the gate shows `me.consent.renew.strava` and the form posting to `/connect`; `POST /me/consent` answers `303 /me` and records nothing; `test/integration/callback.test.ts`: the callback records version 2 for that rider |
| 5. doesn't agree → leaves, data deleted | `test/integration/consent-gate.test.ts`: the gate links to `/me/disconnect`, which still works for a rider on an older version (deletion itself is 001's `disconnect.test.ts`) |

Also:

| Test file | Proves |
|---|---|
| `test/unit/consent-versions.test.ts` (new) | `consentState` for none, older (changes of every skipped version, in order), equal and newer; `viaStrava` with and without the required scopes; `CONSENT_VERSIONS` is ordered and consecutive, starts at 1, and every `changes` key exists in every catalog |
| `test/integration/consent-gate.test.ts` | `POST /me/consent` from another origin → 403, signed out → `302 /`, without the tick or with an old version → `303 /me` and no record, repeated → first acceptance kept |
| `test/integration/viewer.test.ts` | `readViewer` carries `consentVersion`; `requireConsent` → `302 /me` for missing and older, `null` for current |
| `test/integration/connect.test.ts` | `POST /connect` accepts the registry's current version and refuses the previous one |

Catalog checks (`test/unit/catalogs.test.ts`,
`test/integration/no-hardcoded-copy.test.ts`) cover the reworded
`me.consent.none` and the `me.consent.renew.*` keys in both languages (FR-040,
SC-008).

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

   `/me` now shows only the consent gate: the consent texts, the form and the
   way to disconnect. Agree and go through the fake Strava again: `/me` is back,
   "Your consent" shows version 1, and write access can be granted this time.
   (The gate for an *older* version needs a version 2, which only the tests
   publish.)
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
