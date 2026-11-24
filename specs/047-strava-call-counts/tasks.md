---

description: "Task list for Strava Call Counts"
---

# Tasks: Strava Call Counts

**Input**: Design documents from `/specs/047-strava-call-counts/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Required (constitution Principle V): each test task is written red before its
implementation. Run only the files a task names; CI runs the rest.

**Organization**: by user story; the migration, the values and storage come first.
Stacked on gateway routing: its migration is `0039`, so this one is `0040`.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T001 Add migration migrations/0040_strava_calls.sql, additions only: `strava_calls_daily` (`day` TEXT with the same `GLOB` check as `recheck_daily`, `action` TEXT, `endpoint` TEXT, `calls INTEGER NOT NULL DEFAULT 0`, `held_back INTEGER NOT NULL DEFAULT 0`, primary key `(day, action, endpoint)`, `WITHOUT ROWID`) and `strava_seen_daily` (`day TEXT PRIMARY KEY`, `seen INTEGER NOT NULL`); no `CHECK` on action or endpoint, no rider or activity ID
- [X] T002 [P] Add `StravaAction` (`connect`, `import`, `ride-event`, `club-check`, `recheck`, `reread`, `leave`, `disconnect`, `unassigned`), `StravaEndpoint` (the five labels `stravaFetch` already logs: `GET /athlete/clubs`, `GET /activities/{id}`, `GET /athlete/activities`, `POST /oauth/token`, `POST /oauth/revoke`) and the 30-day window constant in src/strava/calls.ts
- [X] T003 [P] Add optional `stravaAction?: StravaAction` to `Ctx` in src/ctx.ts, and pick it in `StravaCtx` (src/strava/result.ts) and `WithdrawCtx` (src/strava/withdraw.ts)

## Phase 2: Foundational

- [X] T004 Write red unit tests in test/unit/strava-calls.test.ts for `actionOf` (every message kind per research R2: `activity-event` → `ride-event`, `import-page` → `import`, `reread-page` → `reread`, `check-membership` → `club-check`, `recheck-rider` → `recheck`, `delete-rider` with reason `deauthorized` → `disconnect` and every other reason → `leave`, `evaluate-rider` and `send-notification` → none) and for the day-row derivation (this team, another team, missing, all teams, Strava's count, mark per data-model.md › Derived: finished day, Strava's count known, nothing missing and `seen − all teams > max(10, ⌊1% of seen⌋)`, or any `unassigned`; today never marked; counted above Strava's count not marked)
- [X] T005 Implement `actionOf` and the day-row derivation in src/strava/calls.ts until T004 passes
- [X] T006 [P] Implement src/db/strava-calls.ts: `countCall` (one batch: upsert `calls + 1` on `(day, action, endpoint)`, and when a daily value is given, `seen = MAX(seen, ?)`), `countHeldBack` (upsert `held_back + 1`), `readCalls(db, since)` (every count and each day's seen in one batch; the view adds them up with `ownCallDays` and `callBreakdown` in src/strava/calls.ts, and the export in T018 reuses it), and `pruneStravaCalls(db, firstKeptDay)`

**Checkpoint**: values, storage and the derivation exist; nothing counts yet.

## Phase 3: User Story 1 - See what this team's Strava calls were for (P1) 🎯 MVP

**Goal**: every call and every held-back call is counted under its action and endpoint, and the view shows this team's day table and breakdown.

**Independent Test**: test/integration/strava-calls-counting.test.ts drives the work with the Strava mocked and reads `strava_calls_daily`; test/integration/admin-usage-calls.test.ts renders the section from seeded rows.

### Counting

- [X] T007 [US1] Write red integration tests in test/integration/strava-calls-counting.test.ts: a call under each action counts under that action and endpoint (connect callback: token and club list; import page; ride event with an expired token counts the refresh and the activity read both under `ride-event`; club check; re-check; re-read; leaving on `/me` and Admin remove; `delete-rider` deauthorized → `disconnect`; `settleWithdrawals` → `leave`); a call made with no action counts as `unassigned`; a `429` counts a call; a network error counts nothing; a counting failure (DB write throws) still returns the response; `X-RateLimit-Usage` raises the day's `seen` and never lowers it; no rider or activity ID appears in either table
- [X] T008 [US1] Count in `stravaFetch` (src/strava/result.ts) whenever `fetch` returned a response, under `(today UTC, ctx.stravaAction ?? "unassigned", endpoint)`, inside the existing best-effort block with the rate-limit headers; on failure log `Strava <endpoint>: could not count the call` without IDs
- [X] T009 [US1] Set the action per message in the queue consumer (src/work/consumer.ts) and per item in the drain (src/work/drain.ts) with `actionOf`, passing the handler a copy of the context; the drain's notification-holding context keeps it
- [X] T010 [P] [US1] Set `connect` in the OAuth callback (src/http/auth.ts), `leave` on `/me` leaving (src/http/me.ts) and Admin remove (src/http/admin/remove.ts), and `leave` for the daily `settleWithdrawals` run (src/work/scheduled.ts)
- [X] T011 [US1] Write red tests in test/integration/strava-calls-counting.test.ts for held back: an `apiGet` budget refusal counts held back under the call's endpoint and no call; a `postToken` refusal under `POST /oauth/token`; a `revokeToken` refusal under `POST /oauth/revoke`; the ride re-check's stand-back (`halfDayUsed` or the background budget) under `recheck` and `GET /athlete/activities`; a connect attempt while the budget is used up counts one held back under `connect`; a refresh before a held-back call counts as a call; the caller's result is unchanged
- [X] T012 [US1] Count held back in `apiGet` (src/strava/client.ts), `tokenBudget`'s callers `postToken` and `revokeToken` (src/strava/tokens.ts) and the stand-back in src/work/recheck-rider.ts, best-effort like T008, until T011 passes

### Retention

- [X] T013 [US1] Write a red test that `pruneUsage` deletes `strava_calls_daily` and `strava_seen_daily` rows before today − 29 and keeps today − 29 (US1 scenario 6), in test/integration/strava-calls-counting.test.ts, then call `pruneStravaCalls` from `pruneUsage` in src/work/scheduled.ts

### The view

- [X] T014 [P] [US1] Add the `admin.calls.*` keys to src/i18n/messages/de.ts (heading "Strava-Aufrufe", intro line, the column head Zurückgehalten next to the existing Tag / Dieses Team, "noch nichts gezählt", the breakdown's heading, its column heads, one name per action and per endpoint) and to the other nine catalogs in src/i18n/messages/, no other team's name
- [X] T015 [US1] Write red tests in test/integration/admin-usage-calls.test.ts (seed rows directly; add helpers to test/support/usage.ts): section `id="strava-calls"` after the ride re-check's; at most 30 rows, newest first, today included; this team's calls and held back per day; each day links to `?calls=<day>#strava-calls`; the breakdown for `?calls=` (today when absent or not a shown day) has one row per action with a count, columns per endpoint with a count, held back and the row total; "none yet" without any counted day; only those who can open the usage view see it
- [X] T016 [US1] Render the section and the breakdown in src/http/admin/usage.ts until T015 passes

**Checkpoint**: one team's calls are counted, kept 30 days and shown with their breakdown.

## Phase 4: User Story 2 - See every team's share and whether anything is uncounted (P2)

**Goal**: other teams' totals arrive through the usage exchange; the day table shows another team, all teams and Strava's count, and marks a day that doesn't add up.

**Independent Test**: test/integration/usage-exchange-calls.test.ts checks the export and the parser; test/integration/admin-usage-calls.test.ts seeds `usage_team_daily` for a peer and checks the columns and the mark.

- [X] T017 [P] [US2] Write red tests in test/integration/usage-exchange-calls.test.ts: the export carries `strava_calls`, `strava_held_back` and `strava_seen` per day from the later of `since`, the 30-day window's first day and the first counted day, zero for days without calls, today live, nothing by action or endpoint, no rider identifier; the parser accepts the three names, skips an entry with an unknown allowance instead of rejecting the export, still rejects a malformed `day` or `count`; 13 months × 3 existing + 30 days × 3 new stay under the 1,500-entry cap; the pull stores them in `usage_team_daily`
- [X] T018 [US2] Export and parse the three allowances in src/usage/peers.ts (and src/http/admin/usage-export.ts if the export is built there) until T017 passes
- [X] T019 [US2] Write a red test that `pruneUsage` deletes the three new allowances in `usage_team_daily` before today − 29 while the other allowances keep their 13 months, then extend `pruneUsage` in src/work/scheduled.ts (or `pruneUsageHistory` in src/db/usage.ts)
- [X] T020 [US2] Write red tests in test/integration/admin-usage-calls.test.ts: 300 here and 120 from a peer show 300 / 120 / 420 and Strava's count, no team name; 420 against 421 no mark; 420 against 600 the `usage-mark usage-mark-warning` "Warnung" mark and the summary at the top counts it; a peer's missing day says "fehlt", leaves all teams empty and carries no mark; days before a peer's first entry show nothing for it; today never marked; an `unassigned` call marks a finished day; Strava's count unknown (zero) shows empty and no mark
- [X] T021 [US2] Add the column names Alle Teams, Strava and "fehlt" to the ten catalogs (Anderes Team is the existing `admin.teams.other`), and to the inventory in test/unit/catalogs.test.ts. Show another team, all teams and Strava's count and the mark in src/http/admin/usage.ts, and count the marked days in the summary at the top in a line of their own (`admin.summary.calls`, ten catalogs), like gateway routing's, until T020 passes. Without other teams the Anderes Team and Alle Teams columns are left out; with more than one the head reads Andere Teams

**Checkpoint**: each team sees its share, the others' total and whether the day adds up.

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T022 [P] Check the fake Strava (dev/) answers every endpoint the counting labels, so `pnpm dev` and the sandboxes count the same way (FR-019); no change if it already does (it does: all five)
- [X] T023 [P] Update the admin usage view's docs (README or docs/ where the view's sections are described) with the new table, and the usage exchange contract of feature 026 if it lists the allowances (the README and docs/ don't describe the view's sections; feature 026's contract now names the three allowances and the skipping)
- [X] T024 Run the targeted tests from quickstart.md and the admin usage page tests whose snapshot or order the new section touches (test/integration/admin-usage*.test.ts)

## Dependencies & Execution Order

- Setup (T001–T003) → Foundational (T004–T006) → US1 → US2 → Polish.
- US1: T007 → T008 → T009/T010; T011 → T012; T013 after T006; T014 any time; T015 → T016.
- US2 needs US1's storage and section (T006, T016): T017 → T018; T019; T020 → T021.

## Parallel Examples

- Setup: T002 and T003 together after T001.
- Foundational: T006 alongside T004–T005.
- US1: T010 and T014 alongside the counting tasks.
- US2: T017 alongside T020.

## Implementation Strategy

- **MVP**: Phases 1–3. Each team sees what its own calls were for and what was held back.
- **Then**: Phase 4 adds the other teams and the check against Strava's count.
- One pull request (this branch, after gateway routing merges); the manual checks in quickstart.md happen on the live site after release, not as tasks.
