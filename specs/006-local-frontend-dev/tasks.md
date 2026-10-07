---
description: "Task list for Local Frontend Development with a Fake Strava"
---

# Tasks: Local Frontend Development with a Fake Strava

**Input**: Design documents from `/specs/006-local-frontend-dev/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Scope**: all three user stories, on the `005-rider-view` branch (spec):
- **US1** (Phase 3) is the MVP: `pnpm dev` on port 8789, sign in as one sample rider
  on the stand-in screen and see `/me` filled, with no Strava request.
- **US2** (Phase 4) adds the other sample riders and the reset.
- **US3** (Phase 5) adds the simulated Strava events.

**Tests**: REQUIRED for the guard (FR-009, SC-005) and the fake mode smoke test
(research R10), following constitution Principle V:
- Every test task comes before the implementation it covers. Run it, confirm it
  fails (red), then implement (green).
- The fake's internals are dev tooling and get no endpoint-by-endpoint tests.
- Existing tests and `test/support/fake-strava.ts` stay unchanged (spec assumption).
- No task covers clicking through the pages by hand.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: the user story the task belongs to (US1, US2, US3)

## Conventions used by every task

**Code**
- Paths are relative to the repo root. The fake lives in `dev/`, its tests in
  `test/`.
- TypeScript strict, tabs, Biome-formatted. **No new dependency, no migration, no
  new binding, and no change under `src/`** (plan "Summary"). If a task seems to
  need a change in `src/`, stop and ask.
- `dev/` may import from `src/`, never the other way round (research R9).
- `RYNKE_FAKE_STRAVA` is not in `wrangler.jsonc` or `worker-configuration.d.ts`.
  `dev/worker.ts` declares `type DevEnv = Env & { RYNKE_FAKE_STRAVA?: string }`.
- The fake answers in the shapes of [contracts/fake-strava.md](contracts/fake-strava.md),
  and the dev routes follow [contracts/dev-routes.md](contracts/dev-routes.md)
  exactly.
- Log lines never contain a token, code or secret: only method, path, status and
  athlete ID.

**Data**
- Everything is synthetic (constitution Principle I): athlete IDs 990001–990099,
  activity IDs from 8_000_001, invented names, no GPS, polyline, heart rate or power.
- `dev/fake.env` holds synthetic placeholders only, like `vitest.config.ts`.

**Text**
- `/_dev/` pages and the stand-in screen are plain English HTML, not catalog keys
  (research R11). Every value placed in them goes through `escapeHtml` from
  `src/http/html.ts`.

**Tests and commits**
- **Integration tests** build a `TestCtx` with `makeCtx()` from
  `test/support/ctx.ts`, so queued messages land in `ctx.queue.sent`. They send
  requests to `http://localhost:8789/…`, not `ORIGIN` (`https://rynke.test`), because
  the dev entry answers `403` to any other host.
- `vitest.config.ts`'s bindings apply: `STRAVA_CLIENT_ID` `10001`,
  `STRAVA_SUBSCRIPTION_ID` `777` and `SEASON_START_DATE` `2026-01-01`. The test
  adds the marker with `{ ...env, RYNKE_FAKE_STRAVA: "local-only" }`.
- **Commits**: commit after each task or logical group, with a Conventional
  Commits message (`test: …`, `feat: …`, `chore: …`, `docs: …`). Never push.
  Pushing and opening a PR happen only when the user asks.

---

## Phase 1: Setup

**Purpose**: a green baseline, the port, and the files fake mode needs before any
code.

- [X] T001 Run `pnpm install`, `pnpm lint`, `pnpm typecheck` and `pnpm test` in the repo root, and confirm all are green before any change. If something already fails, note it in the task's commit message rather than fixing it here.
- [X] T002 [P] In `wrangler.jsonc`, add `"dev": { "port": 8789 }` with a comment: it applies to `wrangler dev` only (both `pnpm dev` and `pnpm dev:strava`), and 8787 is taken on the maintainer's machine (FR-001, research R7). Run `pnpm types` and confirm `worker-configuration.d.ts` is unchanged. If it changed, commit the regenerated file with this task.
- [X] T003 [P] In `tsconfig.json`, add `"dev"` to `include` so `pnpm typecheck` covers `dev/`. Biome's `"**"` in `biome.json` already covers it, so confirm `pnpm lint` checks a file placed in `dev/` (plan "Constitution Check", development workflow).
- [X] T004 [P] Create `dev/fake.env` (data-model.md "Fake mode settings"):
  - A header comment says the values are synthetic, protect nothing, and that fake mode reads this file instead of `.dev.vars`.
  - `STRAVA_CLIENT_ID=90001`, `STRAVA_CLIENT_SECRET=fake-client-secret` and `STRAVA_WEBHOOK_VERIFY_TOKEN=fake-verify-token`.
  - `TOKEN_ENCRYPTION_KEY` and `SESSION_SIGNING_KEY`: synthetic 32-byte keys, base64. Use bytes 0x40..0x5f and 0x60..0x7f, so they differ from `vitest.config.ts`'s.
  - `RYNKE_FAKE_STRAVA=local-only`.
  - Confirm with `git check-ignore -v dev/fake.env` that `.gitignore`'s `.env*` doesn't match it, and with `git check-ignore -v .wrangler/fake-state` that the fake state directory is ignored.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**:
- the production guard (FR-009, research R9);
- the dev entry that wraps the app (R1);
- the Strava interception (R2);
- the fake's token codec, activity store and API answers (R4, contracts/fake-strava.md).

**⚠️ CRITICAL**: every story phase depends on this phase.

### Tests for the foundation (write first, confirm red) ⚠️

- [X] T005 [P] Create `test/unit/dev-guard.test.ts` (quickstart §1 "FR-009 layers 1 and 2"):
  - **Layer 1, the files**:
    - Read every `src/**/*.ts` as raw text with `import.meta.glob("../../src/**/*.ts", { query: "?raw", import: "default", eager: true })`.
    - Assert that at least 30 files were found, so a broken glob can't pass.
    - Assert that none has a static `import`/`export … from` or a dynamic `import(` whose specifier reaches `dev/` (e.g. `"../dev/…"`, `"../../dev/…"`, `"/dev/"`).
    - Read `wrangler.jsonc` the same way (`?raw`) and assert `"main": "src/index.ts"`.
    - If `import.meta.glob` doesn't work in the Workers pool, use research R9's fallback instead: a Biome `noRestrictedImports` rule for `src/**` in `biome.json` that forbids `dev/` paths. Note in the test file that layer 1 lives there.
  - **Layer 2, the dev entry**:
    - With `env` from `cloudflare:test` (no marker), the default export's `fetch`, `queue` and `scheduled` reject with `Error("fake Strava runs only in local fake mode")`.
    - With the marker, through `devFetch(request, ctx)` on a `TestCtx` whose `env` carries the marker: `https://rynke.example/` answers `403` plain text and writes nothing (`tableCounts()` unchanged).
    - With the marker, `http://localhost:8789/` doesn't answer `403`, and neither do `http://127.0.0.1:8789/` and `http://[::1]:8789/`.
  - Restore `globalThis.fetch` in the file's own `afterEach` if the dev entry replaced it. Test-file hooks run before `test/setup.ts`'s, so the deny-all check still runs afterwards.

### Implementation for the foundation

- [X] T006 [P] Create `dev/fake-strava/tokens.ts` (data-model.md "Stateless OAuth values"):
  - Encode and decode `fake-code.<athleteId>.<scopes>`, `fake-access.<athleteId>.<scopes>.<expiresAt>` and `fake-refresh.<athleteId>.<scopes>`. `<scopes>` is the comma-separated list, URL-encoded.
  - `ACCESS_LIFETIME = 6 * 3600`.
  - `bearer(request)` reads `Authorization: Bearer …`.
  - Decoding returns `null` for anything malformed.
- [X] T007 [P] Create `dev/fake-strava/store.ts` (data-model.md "Fake activity"):
  - `ensureTable(db)` runs `CREATE TABLE IF NOT EXISTS fake_strava_activities (id INTEGER PRIMARY KEY, athlete_id INTEGER NOT NULL, body TEXT NOT NULL)`.
  - `tableExists(db)` checks `sqlite_master`.
  - Writers: `clearActivities`, `insertActivity(db, athleteId, body)` (the next ID is `max(id) + 1`, or 8_000_001 when the table is empty), `updateActivity` and `deleteActivity`.
  - Readers:
    - `listActivities(db, athleteId, { after, page, perPage, includePrivate })` returns the activities that started after `after` (epoch seconds, compared with `start_date`), oldest first, paged.
    - `getActivity(db, id)` returns one activity.
  - `body` holds only the fields data-model.md lists, plus a synthetic `name`.
- [X] T008 [P] Create `dev/fake-strava/samples.ts` with the types and the conversion; US1 and US2 add the riders:
  - The types `Behaviour = "normal" | "import-stuck" | "refused"`, `RideRecipe` and `SampleRider` (data-model.md "Sample rider", "Ride recipe entry").
  - `SAMPLE_RIDERS: readonly SampleRider[]`, empty for now.
  - `sampleRider(athleteId)`.
  - `recipeToActivity(recipe, seedDay, seasonStart, id)` builds the `DetailedActivity` body:
    - `daysAgo` before the season start is moved to the season start.
    - `start_date_local` comes from the Europe/Berlin wall-clock time, and `start_date` is the matching UTC time, using `Intl.DateTimeFormat` with `timeZone: "Europe/Berlin"`.
    - `timezone` is `"(GMT+01:00) Europe/Berlin"`.
    - Distance in metres, times in seconds.
    - The flags default to `false`.
    - A missing `elapsedMin` gives `elapsed_time` equal to `moving_time`. Check which "unknown" figure the app's activity parser actually supports in `src/strava/activity.ts`, and leave the field out only if the parser handles it.
- [X] T009 Create `dev/fake-strava/api.ts` with `answerStrava(request, env, db, now): Promise<Response>`, implementing [contracts/fake-strava.md](contracts/fake-strava.md) row by row. `now` is the app's clock (`ctx.now()`, epoch seconds): token expiry is set and checked against it, never `Date.now()`, so tests with a fixed clock stay deterministic. Depends on T006–T008.
  - **`POST /oauth/token`**:
    - Checks `client_id` and `client_secret` against `env`.
    - `authorization_code`: decodes the code. An unknown or non-sample athlete gives `400`. Otherwise `200` with `access_token`, `refresh_token`, `expires_at`, `expires_in` and `athlete { id, firstname }`.
    - `refresh_token`: `400` for a malformed token or a `refused` rider. Otherwise a new access token and the same refresh token.
  - **`POST /oauth/revoke`**: checks the Basic credentials, then `200`.
  - **`GET /api/v3/athlete/clubs`**: `401` for a missing or expired bearer. A `refused` rider is answered normally, so their sign-in works. Otherwise `[{ id: Number(env.STRAVA_CLUB_ID), name: "Team Rynkeby Hamburg (fake)" }]` for members and `[]` for non-members, paged.
  - **`GET /api/v3/athlete/activities`**:
    - `401` as above, and always for a `refused` rider.
    - `429` for `import-stuck`.
    - Otherwise the store's list. Private activities only with `activity:read_all` in the token.
  - **`GET /api/v3/activities/{id}`**: `401` as above and for `refused`. `404 {"message":"Record Not Found"}` when the activity isn't the rider's, is unknown, or is private without `activity:read_all`. Otherwise `200`.
  - **Anything else**: `404 {"message":"Record Not Found"}` and `console.log("[fake-strava] UNANSWERED <METHOD> <path>")`.
  - **No response carries rate-limit headers** (FR-006).
  - **Logging**: every answered request logs `[fake-strava] <METHOD> <path> → <status> (athlete <id>)` (FR-010). The path is logged without its query, and no token appears.
- [X] T010 Create `dev/worker.ts`, the dev entry (research R1, R2, R9, contracts/dev-routes.md "Guards" and "Response rewriting"). Depends on T009.
  - `DevEnv` and `assertFakeMode(env)` throw `Error("fake Strava runs only in local fake mode")` unless `env.RYNKE_FAKE_STRAVA === "local-only"`.
  - `makeDevCtx(env)` builds a `Ctx` the way `makeCtx` in `src/index.ts` does: `env`, `env.WORK_QUEUE`, the wall clock and `CATALOGS`.
  - `installStravaInterceptor(ctx)`: if `globalThis.fetch` isn't already the dev wrapper (marked with a symbol), it wraps the current `globalThis.fetch`. The wrapper calls `answerStrava` with `ctx.env`, `ctx.env.DB` and `ctx.now()`.
    - Requests whose URL origin is `https://www.strava.com` go to `answerStrava` and are never passed through.
    - Every other request goes to the wrapped `fetch`.
    - Each handler calls it, so it is reinstalled after a test's spy replaced it.
  - Exported `devFetch(request, ctx)`, `devQueue(batch, ctx)` and `devScheduled(controller, ctx)`:
    - Each calls `assertFakeMode(ctx.env)` and installs the interceptor.
    - `devFetch` answers `403` plain text unless the host is `localhost`, `127.0.0.1` or `[::1]`, with or without a port.
    - It answers `/_dev/…` itself, with `404` until the routes exist, and passes everything else to `handleFetch`.
    - It rewrites a `Location` starting `https://www.strava.com/oauth/authorize` to `/_dev/strava/oauth/authorize` plus the same query. Nothing else in the response changes.
    - `devQueue` and `devScheduled` delegate to `handleQueue` and `handleScheduled`.
  - The default export `{ fetch, queue, scheduled } satisfies ExportedHandler<DevEnv, unknown>` builds the ctx with `makeDevCtx` and calls the `dev*` functions.
  - Makes T005 green.

**Checkpoint**: the guard tests are green and the dev entry passes requests through to the app. The fake answers Strava, but nothing seeds yet.

---

## Phase 3: User Story 1 — See the pages locally with data, no Strava involved (Priority: P1) 🎯 MVP

**Goal**: `pnpm dev` starts the app on port 8789 in fake mode. "Connect with Strava" leads to the stand-in screen instead of strava.com, and confirming it signs the developer in as a sample rider. `/me` then shows that rider's computed balance and rides, saves reload the page, and no request reaches Strava.

**Independent Test**: quickstart §1 rows FR-006 and FR-010, plus the Tina TrainingDone part of row FR-005/FR-007/FR-012. Then `pnpm dev` and `curl` against port 8789 (T017).

### Tests for User Story 1 (write first, confirm red) ⚠️

- [ ] T011 [US1] Create `test/integration/dev-fake-strava.test.ts` (quickstart §1, research R10):
  - **Helpers**:
    - A `devCtx()` returns a `TestCtx` whose `env` carries the marker.
    - `drain(ctx)` repeatedly takes the messages in `ctx.queue.sent` that have no `delaySeconds`, wraps them in a `MessageBatch` the way `test/integration/import-page.test.ts` does, and runs `devQueue`, until none are left. It stops after 50 rounds. Delayed messages (a `429` defers the import) are left unprocessed.
    - Restore `globalThis.fetch` in the file's own `afterEach`, as in T005.
  - **Seeding (FR-005, FR-012)**:
    - Record the `strava_rate_limit` row first.
    - `GET http://localhost:8789/_dev/` answers `200` and has seeded: Tina TrainingDone (990004) has a `riders` row and a consent record, and `fake_strava_activities` holds her recipe.
    - After `drain`, `/me` with her session (`sessionCookie()` from `test/support/ctx.ts`) shows the Training Rynke target reached ("erreicht ✓") and "Noch nicht dabei", because Team Rynke are still missing. Its ride rows are the newest 20 of her recipe.
  - **Connect flow (FR-008)**:
    - `POST /connect` with `consent=<CONSENT_VERSION>` and a same-origin `Origin: http://localhost:8789` header answers a redirect whose `Location` starts `/_dev/strava/oauth/authorize?` with the app's query.
    - `GET` of that URL with another `client_id` answers `400`.
    - `POST /_dev/strava/oauth/authorize` with Tina and all scopes ticked redirects to `…/auth/callback?state=…&code=fake-code.990004.…&scope=…`.
    - Following that with the state cookie lands on `/me` with a session cookie.
    - **Cancel** redirects with `error=access_denied`.
  - **No Strava (FR-006, SC-002)**:
    - The setup's deny-all `fetch` sees nothing; its `afterEach` fails the test otherwise.
    - The `strava_rate_limit` row is the same as before seeding.
  - **Unanswered (FR-010)**:
    - With a `console.log` spy, `fetch("https://www.strava.com/api/v3/segments/1")` after a `devFetch` call answers `404`.
    - The log has `[fake-strava] UNANSWERED GET /api/v3/segments/1`.
    - No logged line contains `fake-access.`, `fake-refresh.` or `fake-code.`.

### Implementation for User Story 1

- [ ] T012 [P] [US1] In `dev/fake-strava/samples.ts`, add **Tina TrainingDone** (990004, `normal`, club member, all four scopes):
  - The recipe gives ≥ 250 Training Rynke with no virtual ride, e.g. 24 rides of 100–110 km with 600–900 m gain at 25–30 km/h. The app's rules decide what counts, never the recipe.
  - Stay inside the last 30 days, with at most two rides a day at 07:00 and 17:00, so rides never overlap and never move to the season start while the season has run 30 days or more.
- [ ] T013 [P] [US1] Create `dev/fake-strava/pages.ts` (contracts/dev-routes.md, research R11). Plain HTML, with `escapeHtml` from `src/http/html.ts`.
  - **`authorizePage(query, riders, env)`**:
    - Hidden fields carry `redirect_uri` and `state`.
    - A sample rider `<select>` is preselected by `athlete`.
    - One checkbox per scope in `scope`, all ticked.
    - **Authorize** and **Cancel** buttons post to `/_dev/strava/oauth/authorize`.
  - **`indexPage(rows, flash)`**:
    - Lists each sample rider: name, athlete ID, named state, and whether stored (`connected`, `needs_reconnect`, or not stored).
    - Each rider has a **Connect as** form (`POST /_dev/connect`).
    - Also on the page: the **Reset sample data** form (`POST /_dev/reset`), links to `/me` and `/__scheduled`, and the flash text.
- [ ] T014 [US1] Create `dev/fake-strava/seed.ts`:
  - **`connectThroughApp(ctx, origin, rider)`** runs the real flow through `handleFetch`:
    - `POST <origin>/connect` with `consent=CONSENT_VERSION` and an `Origin` header, then keep the state cookie.
    - Read `state` from the returned `Location`.
    - `GET <origin>/auth/callback?state=…&code=<fake-code>&scope=<rider.scopes>` with the state cookie.
    - Expect a redirect to `/me`, and throw a clear error naming the rider otherwise.
  - **`seed(ctx, origin, seedDay)`**, where `seedDay` is the Europe/Berlin day (`YYYY-MM-DD`) of `ctx.now()`:
    - `ensureTable`, `DELETE FROM riders` (everything rider-owned cascades) and `clearActivities`.
    - Reset `strava_rate_limit` to the migration's row: `UPDATE … SET` the usage columns to 0 and the limits to 100/1000/200/2000. Check the column names against `migrations/0001_init.sql`.
    - Insert every rider's recipe through `recipeToActivity`.
    - Connect every sample rider with `clubMember: true` through `connectThroughApp`. Non-members aren't stored; their state is reached through **Connect as** (research R6).
- [ ] T015 [US1] In `dev/worker.ts`, add the US1 routes (contracts/dev-routes.md "Routes" and "Automatic seeding"):
  - **Automatic seeding**: when `fake_strava_activities` doesn't exist, the first request awaits `seed(ctx, origin, seedDay)` with the Europe/Berlin day of `ctx.now()`. Concurrent requests share one promise, and a failed seed is retried on the next request.
  - **`GET /_dev/`** renders `indexPage` with the stored state of each sample rider.
  - **`POST /_dev/connect`** (`athleteId`) runs `POST /connect` internally with consent. It passes the state cookie to the browser and answers `303` to the rewritten authorize URL plus `&athlete=<id>`.
  - **`GET /_dev/strava/oauth/authorize`** answers `400` for a `client_id` other than `env.STRAVA_CLIENT_ID`, and `authorizePage` otherwise.
  - **`POST /_dev/strava/oauth/authorize`**:
    - **Authorize** answers `302` to `redirect_uri?state=…&code=fake-code.<id>.<ticked scopes>&scope=<ticked scopes>`.
    - **Cancel** answers `302` to `redirect_uri?state=…&error=access_denied`.
  - Makes T011 green.
- [ ] T016 [US1] In `package.json`, change the scripts (contracts/dev-routes.md "Commands"):
  - `"dev"`: `wrangler d1 migrations apply rynke-points --local --persist-to .wrangler/fake-state && wrangler dev dev/worker.ts --env-file dev/fake.env --persist-to .wrangler/fake-state --live-reload --test-scheduled`.
  - `"dev:strava"`: `wrangler dev --test-scheduled`.
  - Confirm the migration step doesn't wait for a confirmation. If it does, use its non-interactive form and note why in the commit message.
- [ ] T017 [US1] Check fake mode runs:
  - Start `pnpm dev` in the background.
  - Confirm that Wrangler reports `Ready on http://localhost:8789`, that it loaded `dev/fake.env`, and that it didn't read `.dev.vars`.
  - `curl -s http://localhost:8789/_dev/` lists Tina TrainingDone as connected after a few seconds.
  - The terminal shows `[fake-strava] …` lines.
  - Stop the server.
  - If port 8789 is taken, it fails and names the port (spec edge case).
  - Nothing is committed for this task.

**Checkpoint**: US1 works on its own, and it is the MVP.

---

## Phase 4: User Story 2 — Switch between riders in different states (Priority: P2)

**Goal**: about ten sample riders, one per state of spec US2, chosen on the stand-in screen with any scopes, plus a reset back to the sample data.

**Independent Test**: quickstart §1 row FR-005/FR-007/FR-012 in full, plus §2 steps 4, 5 and 8.

### Tests for User Story 2 (write first, confirm red) ⚠️

- [ ] T018 [US2] Extend `test/integration/dev-fake-strava.test.ts` (data-model.md list, research R6 table). After seeding and `drain`:
  - **Stored riders**: every sample rider except Noah NotMember has a `riders` row.
  - **Ida Importing**: the import is still `pending`, and a delayed `import-page` message is left in `ctx.queue.sent`.
  - **Remy Reconnect**: the rider is `needs_reconnect`.
  - **Nora NoRides**: `/me` shows the empty rides state.
  - **Fiona FarAway**: the balance is far below both targets.
  - **Vera Virtual**: `/me` shows the training target reached, and the share without virtual rides still missing (`rynke.missing.withoutVirtual` text).
  - **Rex Rejected**: has `ride_results` that don't count, at least one each for the reasons `too_slow`, `too_fast`, `pause`, `climbing_rate`, `manual`, `flagged`, `excluded_sport_type` and `overlap`. His `Run` is not in `activities`, because the app imports only cycling (`src/strava/activity.ts`).
  - **Paula Paging**: has 45 activities, and `/me` offers a next page.
  - **Olli OptionalDenied**: stored without `activity:read_all`, and none of his private fake activities is in `activities`.
  - **Noah NotMember**: `POST /_dev/connect` and then **Authorize** end on the not-member notice, and no `riders` row is stored.
  - **Withheld required scope**: `POST /_dev/strava/oauth/authorize` with `activity:read` unticked gives the same callback outcome as `test/integration/callback.test.ts`'s missing-scope case.
  - **Reset (FR-013)**: delete one of Tina's activities and one rider, then `POST /_dev/reset`. The answer is `303 /_dev/` with `clearSessionCookie()`'s `Set-Cookie`. After `drain`, the row counts per table equal those after the first seed.

### Implementation for User Story 2

- [ ] T019 [P] [US2] In `dev/fake-strava/samples.ts`, add the other nine riders (data-model.md, research R6 table). Every recipe follows T012's date rule, except Rex Rejected's overlapping pair, which shares one slot on purpose.
  - **Ida Importing** (990001): `import-stuck`, a few normal rides.
  - **Nora NoRides** (990002): an empty recipe.
  - **Fiona FarAway** (990003): three 25–35 km rides.
  - **Vera Virtual** (990005): over 250 Training Rynke in total but under 167 without `VirtualRide`, e.g. 14 outdoor 100 km rides plus 13 `VirtualRide` 100 km rides. Elevation Rynke count without virtual rides too (floored once on the total), so keep the outdoor climbing at 100 m per ride or less.
  - **Rex Rejected** (990006): one ride per rule it breaks against `CURRENT_RULES`: below 10 km/h, above 45 km/h, paused more than half, climbing faster than 1500 m per hour, `manual`, `flagged`, `EBikeRide`, and two overlapping rides. Each figure is clearly on the wrong side of its limit, and each ride breaks only its own rule. Add one `Run` too, which the app doesn't import.
  - **Paula Paging** (990007): 45 short counting rides.
  - **Olli OptionalDenied** (990008): scopes `read,activity:read`, some public rides and three `private` ones.
  - **Remy Reconnect** (990009): `refused`, a few rides.
  - **Noah NotMember** (990010): `clubMember: false`, a few rides.
- [ ] T020 [US2] In `dev/worker.ts`, add `POST /_dev/reset`: run `seed` and answer `303 /_dev/` with `Set-Cookie: clearSessionCookie()`. Show each rider's named state on `GET /_dev/` (from `samples.ts`) next to the stored status. Makes T018 green.

**Checkpoint**: every state of spec US2 can be reached in under a minute (SC-004).

---

## Phase 5: User Story 3 — Let new rides arrive locally (Priority: P3)

**Goal**: from `/_dev/`, the developer triggers new, changed and deleted rides and a revoked access for a sample rider. The app handles them through its real webhook route and queue.

**Independent Test**: quickstart §2 steps 6 and 7.

### Tests for User Story 3 (write first, confirm red) ⚠️

- [ ] T021 [US3] Extend `test/integration/dev-fake-strava.test.ts` (contracts/dev-routes.md "Simulated events"). After seeding and `drain`:
  - **create**: `POST /_dev/events` with `action=create` for Fiona FarAway (120 km, 600 m, 240/250 min) answers `303 /_dev/?…`. After `drain`, the new activity is in `activities` and Fiona's Training Rynke went up.
  - **repeat (US3 scenario 3, Principle II)**: `action=repeat` and `drain` leave `tableCounts()` and Fiona's balance unchanged.
  - **update**:
    - `action=update` changing that ride's distance to 60 km lowers Fiona's Training Rynke again.
    - `action=update` setting `private` on one of Olli OptionalDenied's public rides removes it from `activities`, because he has no `activity:read_all` (`src/work/activity-event.ts`, FR-007). If US2 isn't done yet, use a rider with the same scopes added in T022.
  - **delete**: `action=delete` removes the activity from `activities` and `fake_strava_activities`.
  - **deauthorize**: `action=deauthorize` removes all of Fiona's rows (`tableCounts()` for her athlete ID is 0).
  - **Webhook route**: every webhook body passes the app's real checks, `subscription_id` `777` from the test bindings.

### Implementation for User Story 3

- [ ] T022 [P] [US3] Create `dev/fake-strava/events.ts` with `simulateEvent(ctx, origin, form)` (contracts/dev-routes.md table):
  - **`create`**: inserts a `recipeToActivity` body.
  - **`update`**: changes the given fields and names them in `updates`. `private` becomes `"true"` or `"false"`, `title` comes from `name`, and `type` from `sport_type`, as Strava does.
  - **`delete`**: deletes the activity.
  - **`deauthorize`**: changes nothing in the store.
  - **Every body** carries `object_type`, `aspect_type`, `object_id`, `owner_id`, `event_time` (`ctx.now()`), `subscription_id` (`Number(env.STRAVA_SUBSCRIPTION_ID)`) and `updates`.
  - **Posting**: the body goes as JSON to `<origin>/strava/webhook/<STRAVA_WEBHOOK_VERIFY_TOKEN>` through `handleFetch`. The function returns the answer's status as the flash text.
  - **`repeat`** resends the last body sent, kept in module memory. With none, "nothing to repeat" is the flash text.
- [ ] T023 [US3] Wire up the events:
  - In `dev/worker.ts`, add `POST /_dev/events`, answering `303 /_dev/?flash=…`.
  - In `dev/fake-strava/pages.ts`, add per stored rider:
    - a **new ride** form, with date (default today), time, sport type, distance, elevation, moving and elapsed minutes, private and manual;
    - **change** and **delete** forms with a `<select>` of that rider's fake activities;
    - **revoke access** and **send again** buttons.
  - Makes T021 green.

**Checkpoint**: all three stories work, and fake mode is complete.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T024 [P] Update `CLAUDE.md` "Commands":
  - `pnpm dev`: the app on port 8789 with the fake Strava and synthetic sample data. It doesn't read `.dev.vars`.
  - `pnpm dev:strava`: against the real Strava with `.dev.vars`, using the app's request budget.
  - Change the migration line to say it is for `pnpm dev:strava`; `pnpm dev` applies its own.
  - Add one line under "Non-negotiables": `src/` never imports `dev/` (FR-009).
- [ ] T025 [P] Update `README.md` line 76 to `pnpm dev # local Worker on http://localhost:8789 with a fake Strava`, and add `pnpm dev:strava`.
- [ ] T026 [P] Update the run steps that start the app against the real Strava to `pnpm dev:strava` on `http://localhost:8789`, linking to this feature's quickstart for frontend work:
  - `specs/001-strava-connect-webhook/quickstart.md` §2;
  - `specs/003-rynke-evaluation/quickstart.md` (line 62);
  - `specs/005-rider-view/quickstart.md` (lines 64–65).
- [ ] T027 [P] In `.dev.vars.example`, change the first comment line to say the file is for `pnpm dev:strava` and tests' local overrides, not for `pnpm dev`.
- [ ] T028 Run quickstart §1 in full, then `pnpm lint`, `pnpm typecheck` and `pnpm test`, all green. Then:
  - Confirm `git diff --stat cf71b88 -- src` is empty: no file under `src/` changed (plan "Summary").
  - Confirm `git ls-files .wrangler` is empty.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: none.
- **Phase 2 (Foundational)**: after Phase 1. It blocks every story.
- **Phase 3 (US1)**: after Phase 2. This is the MVP.
- **Phase 4 (US2)**: after Phase 3. It needs seeding, the connect route and the stand-in screen.
- **Phase 5 (US3)**: after Phase 3. It is independent of US2, apart from `samples.ts`: its test uses Fiona FarAway, so if US2 isn't done yet, add Fiona with T022.
- **Phase 6 (Polish)**: after the stories being shipped.

### Within each phase

- Tests come before the implementation they cover, confirmed red.
- Phase 2: T006, T007 and T008 run in parallel, then T009, then T010.
- US1: T012 and T013 run in parallel, then T014, then T015. T016 can follow T015 at any point, and T017 goes last.
- US2: T019, then T020.
- US3: T022, then T023.

### Parallel Opportunities

- **Phase 1**: T002, T003 and T004.
- **Phase 2**: T005 alongside T006–T008.
- **US1**: T012 and T013.
- **Phase 6**: T024–T027.

## Parallel Example: Phase 2

```text
# Test first (red):
Task: "T005 Create test/unit/dev-guard.test.ts (FR-009 layers 1 and 2)"

# In parallel:
Task: "T006 Create dev/fake-strava/tokens.ts"
Task: "T007 Create dev/fake-strava/store.ts"
Task: "T008 Create dev/fake-strava/samples.ts (types and recipeToActivity)"

# Then:
Task: "T009 Create dev/fake-strava/api.ts"
Task: "T010 Create dev/worker.ts (makes T005 green)"
```

## Implementation Strategy

### MVP first (US1 only)

1. Phase 1, then Phase 2 (guard, dev entry, fake API).
2. Phase 3: `pnpm dev` on 8789, Tina TrainingDone on `/me`, the stand-in screen.
3. **Stop and validate**: quickstart §1 for US1 and T017. Frontend work can start here.

### Incremental delivery

4. US2: the other sample riders and the reset.
5. US3: the simulated events.
6. Phase 6: docs, and the final check that `src/` is untouched.

## Notes

- [P] = different files, no dependency on an unfinished task.
- The fake never passes a request for `www.strava.com` through, even when it has no answer.
- Never commit `.wrangler/`, `.dev.vars` or anything real. `dev/fake.env` is synthetic and committed on purpose.
