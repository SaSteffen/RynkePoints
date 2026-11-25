---

description: "Task list for Dismiss Day Warnings"
---

# Tasks: Dismiss Day Warnings

**Input**: Design documents from `/specs/050-dismiss-day-warnings/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Required (constitution Principle V, test-first). Each story's tests are written first and
must fail before its implementation. Run only the files named in [quickstart.md](quickstart.md);
the whole suite is CI's job.

**Organization**: Grouped by user story, so each story can be built and checked on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: The user story the task belongs to (US1–US4)

---

## Phase 1: Setup

**Purpose**: The table every story stores into.

- [ ] T001 Create `migrations/0043_usage_dismissals.sql` with only `CREATE TABLE usage_dismissals` (research R1, R8; data-model.md): `athlete_id INTEGER NOT NULL REFERENCES riders (athlete_id) ON DELETE CASCADE`; `kind TEXT NOT NULL CHECK (kind IN ('calls', 'recheck', 'routing'))`; `day TEXT NOT NULL CHECK (day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')` (as in `migrations/0040_strava_calls.sql`); `reason TEXT NOT NULL` with no CHECK ("checked in code, no CHECK, so a reason added later needs no migration"); `PRIMARY KEY (athlete_id, kind, day, reason)`, `WITHOUT ROWID`. A header comment names feature 050 and says it only adds a table, so the release before keeps working.

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: Day items carry their reasons, and dismissals can be read and written. Every story needs both.

**⚠️ CRITICAL**: No user story work starts before this phase is done.

- [ ] T002 [P] Add failing unit tests to `test/unit/usage-attention.test.ts` in a new `describe("reasons of day items (feature 050 research R2)")`: a marked Strava calls day gives an item with `reasons: ["calls"]`; a re-check day with `over24h > 0` and `unordered > 0` gives `reasons: ["over24h", "unordered"]`, with only one of them just that one; a routing day keeps `routingWarnings`' list (`missed`, `possible`, `everyone`). Update the existing assertions that read `over24h`/`unordered` on the re-check item to read `reasons`.
- [ ] T003 In `src/usage/attention.ts`: export `type DayKind = "calls" | "recheck" | "routing"` and `type DismissReason` (`"calls" | "over24h" | "unordered" | RoutingWarning`) and a `DAY_REASONS: Record<DayKind, readonly DismissReason[]>` map (`calls` → `["calls"]`, `recheck` → `["over24h", "unordered"]`, `routing` → `["missed", "possible", "everyone"]`, research R2), the one source the route's check and the item builder share. Change the `recheck` item from `over24h: boolean; unordered: boolean` to `reasons: ("over24h" | "unordered")[]` (in that order), and give the `calls` item `reasons: ["calls"]`. Make T002 pass.
- [ ] T004 In `src/http/admin/usage.ts` `lageRow`, build the re-check row's line from `item.reasons` (`over24h` → `admin.lage.recheck.over24h`, `unordered` → `admin.lage.recheck.order`, joined by " · "), so the row's text stays exactly as before. Check with `pnpm vitest run test/integration/admin-usage-recheck.test.ts`.
- [ ] T005 [P] In `src/db/usage.ts`, add next to the other usage reads and writes, each with a one-line doc comment naming feature 050: `interface Dismissal { kind: DayKind; day: string; reason: string }`; `readDismissals(db, athleteId, since)` → the viewer's rows with `day >= since`; `addDismissals(db, athleteId, kind, day, reasons)` → one `INSERT OR IGNORE INTO usage_dismissals (athlete_id, kind, day, reason) VALUES (?, ?, ?, ?)` per reason in one `db.batch`, nothing for an empty list; `pruneDismissals(db, firstKept)` → `DELETE FROM usage_dismissals WHERE day < ?`; `deleteDismissalsStatement(db, athleteId)` → a prepared `DELETE FROM usage_dismissals WHERE athlete_id = ?` for `setRole`'s batch.

**Checkpoint**: Items carry reasons, the page reads as before, the table can be written and read.

---

## Phase 3: User Story 1 - Dismiss a day warning I've checked (Priority: P1) 🎯 MVP

**Goal**: A "Gesehen" button on each day row removes it from that administrator's list, its head and the Admin tab's number, in place; the day table keeps its mark.

**Independent Test**: With a routing warning yesterday, post the row's form as an administrator; the list, the head and the Admin tab's number drop by one, the routing table still marks the day, and a reload keeps it gone.

### Tests for User Story 1 ⚠️ (write first, see them fail)

- [ ] T006 [P] [US1] Add failing unit tests to `test/unit/usage-attention.test.ts` in `describe("dismissed day items (feature 050 data-model.md)")`, with `dismissed` added to the shared inputs helper (default `[]`): a routing day with `reasons ["possible"]` and a dismissal `{ kind: "routing", day, reason: "possible" }` is left out and `markCount(...).total` drops by one; a dismissal for another day or another kind leaves it in; a calls day and a re-check day with all their reasons dismissed are left out; with that item the only mark, `markCount` is `0` and state hints (`team`, `device`) are still in the list.
- [ ] T007 [P] [US1] Create `test/integration/admin-usage-dismiss.test.ts` with failing tests, set up as `test/integration/admin-usage-routing.test.ts` (`makeCtx` with a fixed `NOW`, `resetDb`, `seedRider(ctx, { athleteId: ADMIN, administrator: true })`, a `count(day, team, figure, n)` helper writing `routing_daily`, a `dismiss(fields, cookies?)` helper posting `application/x-www-form-urlencoded` to `/admin/dismiss` with the same-origin headers the `/admin/alerts` tests use). In `describe("dismissing a day warning (US1)")`:
  - the page's routing row for yesterday holds `<form method="post" action="/admin/dismiss" class="lage-dismiss" data-swap>` with hidden `kind=routing`, `day`, one `reason` per reason, and `<button class="button-text" aria-label="Gesehen: Gateway-Routing: {date}">Gesehen</button>` (contracts/usage-view.md);
  - posting it answers `303` with `Location: /admin`, and stores one row per reason;
  - afterwards `/admin` lists no such row, the head's count and the Admin tab's number both drop by one (read them as `test/integration/admin-usage-badge.test.ts` does), and the routing table's day still reads "Warnung" (FR-005);
  - with that row the only mark, the head reads "Alles im Rahmen" and the Admin tab shows no number;
  - a second page load still leaves it out (FR-004);
  - the same post twice leaves one row per reason (`SELECT COUNT(*)`);
  - a Strava calls day and a re-check day can be dismissed the same way;
  - English: the button reads "Got it" and its label "Got it: …".
- [ ] T008 [P] [US1] In the same file, `describe("who may dismiss (FR-008, contracts/dismiss-route.md)")`, failing tests: no session, a rider who isn't an administrator, and another `Origin` each get `403` and store nothing; an unknown `kind`, a `day` before yesterday, a `day` that isn't a date, and only unknown reasons each answer `303 /admin` and store nothing; a known kind with one known and one unknown reason stores only the known one.

### Implementation for User Story 1

- [ ] T009 [US1] In `src/usage/attention.ts`, add `dismissed: readonly Dismissal[]` (kind, day, reason) to `AttentionInputs` with a doc comment, and in `attentionItems` leave out a `calls`, `recheck` or `routing` item when every one of its `reasons` has a dismissal with the same `kind` and `day` (data-model.md "Rule"). Figure, CPU and state-hint items are never left out. `markCount` stays unchanged. Make T006 pass; give existing callers in tests `dismissed: []`.
- [ ] T010 [US1] In `src/usage/state.ts` `readUsageState`, add `readDismissals(db, athleteId, yesterday)` to the existing `Promise.all` and pass its rows as `dismissed` to `attentionItems`. The page, its head and the Admin tab's number (`src/http/shell.ts`, `src/http/admin/access.ts`) all read this one state, so nothing else changes there.
- [ ] T011 [US1] In `src/http/admin/usage.ts`, add `handleAdminDismiss(request, ctx, i18n)` next to `handleAdminAlerts`: `requireAdminPost(request, ctx, i18n, "/admin/dismiss")` (return its response when it isn't a rider); read the form (`request.formData()`); keep `kind` only if it is a key of `DAY_REASONS`; keep `day` only if it equals today or yesterday (`utcDay(ctx.now())`, `daysBefore(today, 1)`); keep the `reason` values (`getAll`) that `DAY_REASONS[kind]` lists, without duplicates; with at least one left call `addDismissals`. Answer `redirect("/admin", 303)` in every case past the guard. No log line with a reason or day beside an athlete ID (contracts/dismiss-route.md "Logs").
- [ ] T012 [US1] In `src/http/router.ts`, add `case "/admin/dismiss": return handleAdminDismiss(request, ctx, i18n);` beside `/admin/alerts`, imported from `./admin/usage`.
- [ ] T013 [US1] In `src/http/admin/usage.ts` `lageRow`, for `calls`, `recheck` and `routing` items render `<li class="lage-dismissable">` holding the unchanged `<a class="settings-row" …>` and, after it, `<form method="post" action="/admin/dismiss" class="lage-dismiss" data-swap>` with hidden `kind`, `day`, one hidden `reason` per `item.reasons`, and `<button class="button-text" aria-label="${i18n.t("admin.lage.dismissLabel", { title })}">${i18n.t("admin.lage.dismiss")}</button>`, where `title` is the row's title (`admin.lage.day`'s text). Other kinds keep `<li>` with only the link (FR-002).
- [ ] T014 [P] [US1] In `src/http/style.ts`, next to the `.lage-*` rules: `.lage-dismissable{display:flex;align-items:center;gap:var(--rp-space-2)}`, `.lage-dismissable>.settings-row{flex:1;min-width:0}`, `.lage-dismiss{flex:none;margin:0}`, so the title wraps on a phone and the button keeps its width and the 48 px tap size `.button-text` already has (contracts/usage-view.md "Layout"). Check the list's dividers still sit between rows the way the other `li`s draw them.
- [ ] T015 [P] [US1] Add `admin.lage.dismiss` and `admin.lage.dismissLabel` (with `{title}`) to all ten catalogs in `src/i18n/messages/` (`de`, `en`, `da`, `fi`, `fr`, `is`, `lt`, `nb`, `nl`, `sv`), after `admin.lage.calls`. German is the key source: "Gesehen" / "Gesehen: {title}"; English "Got it" / "Got it: {title}"; the others a short natural "seen / got it" in their language with the same `{title}` placeholder. Run `pnpm vitest run test/unit/catalogs.test.ts`.
- [ ] T016 [US1] Run `pnpm vitest run test/unit/usage-attention.test.ts test/integration/admin-usage-dismiss.test.ts test/integration/admin-usage-routing.test.ts test/integration/admin-usage-badge.test.ts`; T006–T008 pass and the existing usage tests still pass.

**Checkpoint**: The MVP. An administrator can clear a checked day warning; list, head and Admin tab agree.

---

## Phase 4: User Story 2 - Other administrators still see it (Priority: P2)

**Goal**: A dismissal hides the warning only for the administrator who made it.

**Independent Test**: Two administrators; one dismisses, the other still sees the row and counts it.

- [ ] T017 [US2] Add `describe("other administrators (US2)")` to `test/integration/admin-usage-dismiss.test.ts`: seed a second administrator (`ATHLETE_B`); after the first dismisses yesterday's routing row, the second's `/admin` still lists it and their Admin tab's number still counts it; after the second dismisses too, neither sees it. These should pass already, since `readDismissals` reads the viewer's rows only (T005, T010); if one fails, fix the read in `src/db/usage.ts`.

**Checkpoint**: Each maintainer's list is their own.

---

## Phase 5: User Story 3 - A new reason brings it back (Priority: P2)

**Goal**: A dismissal covers the reasons the administrator saw; a later reason brings the row back with all reasons, a reason that only grows doesn't.

**Independent Test**: Dismiss a routing day for a possible miss, add a would-be miss to the same day, reload.

- [ ] T018 [P] [US3] Add unit tests to `test/unit/usage-attention.test.ts`: a routing day with `["missed", "possible"]` and only `possible` dismissed is in the list with both reasons; a re-check day dismissed for `over24h` that now also has `unordered` is back with both.
- [ ] T019 [P] [US3] Add `describe("a new reason (US3)")` to `test/integration/admin-usage-dismiss.test.ts`: with yesterday's routing day at one possible miss, dismiss it; raise its possible count to two: still gone; add a would-be miss on the same day: the row is back with "Drohender Verlust · Möglicher Verlust" and counts again, and its form now carries both reasons. Seed the counts through `routing_daily` the way `routingWarnings` in `src/routing/warning.ts` reads them.
- [ ] T020 [US3] Run the two files; the rule from T009 should already give this. If a test fails, fix `attentionItems` in `src/usage/attention.ts`, not the tests.

**Checkpoint**: Nothing new can hide behind an old dismissal.

---

## Phase 6: User Story 4 - Limits can't be dismissed (Priority: P3)

**Goal**: Figure, CPU and state-hint rows offer no dismiss.

**Independent Test**: A figure at Warnung and a CPU mark on the page: no `/admin/dismiss` form outside day rows.

- [ ] T021 [US4] Add `describe("limits stay (US4, FR-002)")` to `test/integration/admin-usage-dismiss.test.ts`: with a Strava figure at Warnung (seed it as `test/integration/admin-usage.test.ts` does), a CPU mark (as `test/integration/admin-usage-cpu.test.ts` does) and no notification device, the list has those rows and the page holds no `action="/admin/dismiss"`; adding a routing day gives exactly one such form. A post with `kind=figure` or `kind=cpu` stores nothing (covered by T008's unknown kind; name it here).

**Checkpoint**: A real limit can't be hidden.

---

## Phase 7: Clean-up (FR-009, research R6)

**Purpose**: Dismissals live only as long as they're needed.

- [ ] T022 [P] Add `describe("clean-up (FR-009)")` to `test/integration/admin-usage-dismiss.test.ts`, failing first: rows for the day before yesterday and older go when `pruneUsage(ctx)` from `src/work/scheduled.ts` runs, yesterday's and today's stay; deleting the administrator (`deleteRider` from `src/db/riders.ts`) deletes their rows.
- [ ] T023 [P] Add to `test/integration/admin-roles.test.ts`, in `describe("taking a role away (US3)")`, failing first: an administrator with a stored dismissal who is given the Orga role (and, separately, no role) through the test file's `setRole` helper has no `usage_dismissals` rows left; an administrator who stays one keeps them.
- [ ] T024 In `src/work/scheduled.ts` `pruneUsage`, call `pruneDismissals(ctx.env.DB, daysBefore(today, 1))` and mention dismissals (feature 050) in its doc comment.
- [ ] T025 In `src/db/riders.ts` `setRole`, when the new role isn't `admin`, run the `UPDATE` and `deleteDismissalsStatement(db, athleteId)` in one `db.batch`; for `admin` keep the single `UPDATE`. Make T022 and T023 pass with `pnpm vitest run test/integration/admin-usage-dismiss.test.ts test/integration/admin-roles.test.ts`.

**Checkpoint**: No dismissal outlives its day, its administrator's role or the rider.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T026 [P] Search `src/` and `test/` for remaining reads of the re-check item's `over24h`/`unordered` booleans and for `attentionItems(` calls without `dismissed`; `pnpm typecheck` must pass.
- [ ] T027 [P] `pnpm lint` (Biome) on the changed files; fix with `pnpm format`.
- [ ] T028 Run the quickstart's three files plus `test/unit/catalogs.test.ts`, `test/integration/admin-usage.test.ts`, `test/integration/admin-usage-recheck.test.ts`, `test/integration/admin-usage-calls.test.ts`, `test/integration/admin-usage-badge.test.ts` and `test/teams/no-other-team.test.ts`; all pass. Don't run the whole suite.

The manual check on the live site after the release has no task ([quickstart.md](quickstart.md)).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none.
- **Foundational (Phase 2)**: after Setup; blocks every story.
- **US1 (Phase 3)**: after Phase 2. The MVP.
- **US2, US3, US4 (Phases 4–6)**: after US1 (they test its route, rule and form); independent of each other.
- **Clean-up (Phase 7)**: after Phase 2 (needs `pruneDismissals`, `deleteDismissalsStatement`); its tests post through the route, so best after US1.
- **Polish (Phase 8)**: last.

### Within Each Story

- Tests first, failing; then the code that makes them pass.
- `attention.ts` before `state.ts`; the handler before the router line; markup, style and catalogs alongside.

### Parallel Opportunities

- T002 and T005 (different files) in Phase 2.
- T006, T007, T008 in US1; then T014 and T015 beside T009–T013.
- T018 and T019 in US3; T022 and T023 in Phase 7; T026 and T027 in Polish.
- US2, US3 and US4 can run side by side once US1 is done; they all add to `admin-usage-dismiss.test.ts`, so keep their `describe` blocks apart.

---

## Parallel Example: User Story 1

```bash
# Tests first, side by side:
Task: "Unit tests for dismissed day items in test/unit/usage-attention.test.ts"
Task: "Route and page tests in test/integration/admin-usage-dismiss.test.ts"

# Then, beside the handler and the list's builder:
Task: "Row and button style in src/http/style.ts"
Task: "admin.lage.dismiss and admin.lage.dismissLabel in all ten catalogs"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 and Phase 2.
2. Phase 3 (US1).
3. **Stop and check**: the US1 tests and the existing usage tests pass.

### Incremental Delivery

1. Setup + Foundational → items carry reasons, table exists.
2. US1 → dismiss works (MVP).
3. US2, US3, US4 → their tests prove the per-admin, new-reason and limits rules.
4. Clean-up → dismissals don't linger.
5. Polish → typecheck, lint, targeted test run; then a pull request when the user asks.
