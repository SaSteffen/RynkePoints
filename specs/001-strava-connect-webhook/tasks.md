---
description: "Task list for Strava Connection and Webhook Activity Intake"
---

# Tasks: Strava Connection and Webhook Activity Intake

**Input**: Design documents from `/specs/001-strava-connect-webhook/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: REQUIRED. Constitution Principle V (Test-First, NON-NEGOTIABLE): every
test task comes before the implementation it covers. Run `pnpm test` after writing
it and confirm it fails (red) before implementing (green). Strava is never
contacted. All Strava traffic goes through `test/support/fake-strava.ts` with
synthetic data only (Principle I: no real rider data, not even in fixtures).

**Organization**: Tasks are grouped by user story (spec.md US1–US4) so each story
can be implemented and tested on its own. The language requirements (FR-028–FR-030,
SC-010, SC-011) cut across all stories:

- Their core (catalogs, locale resolution, layout with switcher, `POST /lang`,
  `/notice/:id`) is in Phase 2 (Foundational).
- Each story's page tests assert that story's German texts.
- Phase 7 adds the cross-page language guards.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: the user story the task belongs to (US1–US4)

## Conventions used by every task

- Paths are relative to the repo root. Source lives in `src/` and tests in `test/`
  (the existing layout, not `tests/`).
- Code style: TypeScript strict, tabs, Biome-formatted. No new runtime
  dependencies (Principle IV): use `fetch`, Web Crypto, `Intl` and D1 SQL only.
  No i18n library (research R16).
- **Dependency injection for tests (research R12).**
  - HTTP handlers and queue handlers receive a context object
    `Ctx = { env: Env; queue: Pick<Queue<WorkMessage>, "send" | "sendBatch">; now: () => number; catalogs: Catalogs }`,
    built in `src/index.ts` with `catalogs: CATALOGS`.
  - Integration tests build a `Ctx` with a recording fake queue
    (`test/support/ctx.ts`) and call the exported handler functions directly.
  - Only the wiring test (T080) goes through `exports.default`.
- **Rider-facing text (constitution, Language; research R16).**
  - No rider-facing literal text in `src/http/*` or anywhere else in `src/`.
    Every string a rider can see (page text, button labels, `alt`, `<title>`,
    status, errors) comes from `i18n.t(id, params)` or `i18n.tHtml(id, params)`,
    with IDs from [contracts/messages.md](contracts/messages.md).
  - Handlers receive the per-request `I18n` object from the router and never
    import a catalog.
  - Numbers and dates on pages go through `i18n.formatNumber`/`i18n.formatDate`.
- **Tests assert German.** Page tests send no `Accept-Language` and no `rp_lang`
  cookie, and assert the **German** text from contracts/messages.md. Only tests
  explicitly about English (an `Accept-Language: en…` header or `rp_lang=en`)
  assert English text.
- **Never log tokens, codes or secrets.** Log only the endpoint, HTTP status and
  numeric IDs. Log messages are English and not catalogued.
- **Commits.** Commit after each task or logical group with a Conventional Commits
  message (`test: …`, `feat: …`, `chore: …`). Never commit `.dev.vars`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: bindings, schema and test harness that every story needs.

- [ ] T001 Create `migrations/0001_init.sql` with the five tables from data-model.md. There is no language column anywhere: the picked language lives only in the `rp_lang` cookie (FR-029a).
  - **`riders`**:
    - `athlete_id INTEGER PRIMARY KEY`
    - `first_name TEXT NOT NULL`
    - `status TEXT NOT NULL CHECK (status IN ('connected','needs_reconnect'))`
    - `scope_read_all INTEGER NOT NULL CHECK (scope_read_all IN (0,1))`
    - `scopes TEXT NOT NULL`
    - `connected_at INTEGER NOT NULL`
    - `scopes_updated_at INTEGER NOT NULL`
    - `membership_checked_at INTEGER NOT NULL`
    - `import_status TEXT NOT NULL CHECK (import_status IN ('pending','running','done'))`
  - **`strava_credentials`**:
    - `athlete_id INTEGER PRIMARY KEY REFERENCES riders(athlete_id) ON DELETE CASCADE`
    - `access_token_enc TEXT NOT NULL`
    - `refresh_token_enc TEXT NOT NULL`
    - `expires_at INTEGER NOT NULL`
  - **`activities`**:
    - `strava_activity_id INTEGER PRIMARY KEY`
    - `athlete_id INTEGER NOT NULL REFERENCES riders(athlete_id) ON DELETE CASCADE`
    - `sport_type TEXT NOT NULL`
    - `start_date TEXT NOT NULL`
    - `start_date_local TEXT NOT NULL`
    - `timezone TEXT NOT NULL`
    - `distance_m REAL NOT NULL CHECK (distance_m >= 0)`
    - `moving_time_s INTEGER NOT NULL CHECK (moving_time_s >= 0)`
    - `elevation_gain_m REAL NOT NULL CHECK (elevation_gain_m >= 0)`
    - `is_private INTEGER NOT NULL CHECK (is_private IN (0,1))`
    - `refreshed_at INTEGER NOT NULL`
    - index: `CREATE INDEX activities_by_rider ON activities(athlete_id, start_date DESC)`
  - **`failed_work`**:
    - `id INTEGER PRIMARY KEY AUTOINCREMENT`
    - `athlete_id INTEGER NOT NULL REFERENCES riders(athlete_id) ON DELETE CASCADE`
    - `message TEXT NOT NULL`
    - `last_error TEXT NOT NULL`
    - `failed_at INTEGER NOT NULL`
  - **`strava_rate_limit`**:
    - `id INTEGER PRIMARY KEY CHECK (id = 1)`
    - `observed_at INTEGER NOT NULL`
    - `read_15m`, `read_daily`, `all_15m`, `all_daily` INTEGER NOT NULL
    - `limit_read_15m`, `limit_read_daily`, `limit_all_15m`, `limit_all_daily` INTEGER NOT NULL
    - seeded with one row: `(1, 0, 0,0,0,0, 100,1000,200,2000)`
- [ ] T002 Update `wrangler.jsonc`, replacing the "D1, Queues, and cron triggers get added here" comment, then run `pnpm types` to regenerate `worker-configuration.d.ts`:
  - `d1_databases`: `[{ "binding": "DB", "database_name": "rynke-points", "database_id": "00000000-0000-0000-0000-000000000000", "migrations_dir": "migrations" }]`, with a comment that the maintainer replaces the ID after `wrangler d1 create rynke-points --jurisdiction=eu`
  - `queues.producers`: `[{ "binding": "WORK_QUEUE", "queue": "rynke-points-work" }]`
  - `queues.consumers`: `[{ "queue": "rynke-points-work", "max_batch_size": 10, "max_batch_timeout": 5, "max_retries": 10, "max_concurrency": 1 }]`
  - `triggers`: `{ "crons": ["17 3 * * *"] }`
  - `assets`: `{ "directory": "./public" }`
  - `vars`: `{ "STRAVA_CLUB_ID": "2372209", "SEASON_START_DATE": "2026-01-01", "STRAVA_SUBSCRIPTION_ID": "0" }`
- [ ] T003 [P] Add `TOKEN_ENCRYPTION_KEY=` and `SESSION_SIGNING_KEY=` to `.dev.vars.example`, each with a comment "32 random bytes, base64: `openssl rand -base64 32`". Keep the existing entries.
- [ ] T004 [P] Create `public/strava/README.md` (research R19) explaining:
  - The maintainer downloads the official "Connect with Strava" button (`1.1-Connect-with-Strava-Buttons.zip`, orange, 48 px) and the "Powered by Strava" logo (`1.2-Strava-API-Logos.zip`) from Strava's brand guidelines page and saves them as `public/strava/en/connect-with-strava.svg` and `public/strava/en/powered-by-strava.svg`.
  - German variants go to `public/strava/de/` with the same file names, and only if Strava supplies them. If it doesn't, the `brand.*.src` entries in `src/i18n/messages/de.ts` point at the `en/` files.
  - The images are never modified, re-lettered or translated.
  - Pages take the paths from the catalogs (`brand.connectWithStrava.src`, `brand.poweredByStrava.src`), and tests don't need the files.
- [ ] T005 Update `vitest.config.ts`:
  - make the config async;
  - call `readD1Migrations("./migrations")` (from `@cloudflare/vitest-pool-workers`);
  - pass `cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" }, miniflare: { bindings: { TEST_MIGRATIONS: migrations, STRAVA_CLIENT_ID: "10001", STRAVA_CLIENT_SECRET: "test-client-secret", STRAVA_WEBHOOK_VERIFY_TOKEN: "test-verify-token", TOKEN_ENCRYPTION_KEY: <fixed synthetic base64 of 32 bytes>, SESSION_SIGNING_KEY: <fixed synthetic base64 of 32 bytes>, STRAVA_SUBSCRIPTION_ID: "777" } } })`;
  - add `test.setupFiles: ["./test/setup.ts"]`.

  These synthetic bindings override anything in `.dev.vars`, so tests never see real secrets.
- [ ] T006 Create `test/setup.ts`, which calls `applyD1Migrations(env.DB, env.TEST_MIGRATIONS)` from `cloudflare:test`. Create `test/env.d.ts`, which augments `Cloudflare.Env` with `TEST_MIGRATIONS: D1Migration[]`. Verify that `pnpm test` still passes the existing `test/index.test.ts`.

**Checkpoint**: `pnpm typecheck && pnpm test` green; local D1 is migrated in tests.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: crypto, config, Strava client, DB access, queue framework, i18n
(catalogs, locale resolution, layout with switcher, `POST /lang`, `/notice/:id`)
and test support used by every story.

**⚠️ CRITICAL**: No user story work starts until this phase is complete.

### Tests for the foundation (write first, confirm red) ⚠️

- [ ] T007 [P] Unit test in `test/unit/encrypt.test.ts` for `encryptToken`/`decryptToken`:
  - round-trip works;
  - output matches `/^v1:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/`;
  - two encryptions of the same plaintext differ (random 12-byte IV);
  - a tampered ciphertext and a wrong key both throw;
  - the plaintext never appears in the output.
- [ ] T008 [P] Unit test in `test/unit/sign.test.ts` for `signValue`/`verifySignedValue` (HMAC-SHA256, base64url): a valid value verifies; a tampered payload or signature returns `null`; an expired value (`expiresAt < now`) returns `null`.
- [ ] T009 [P] Unit test in `test/unit/rate-limit.test.ts` for the pure functions in `src/strava/rate-limit.ts`:
  - `parseUsageHeader("45,310")` gives `{ short: 45, daily: 310 }`; malformed input gives `null`.
  - `windowStart(t)` aligns to :00/:15/:30/:45 UTC; `dayStart(t)` gives UTC midnight.
  - `effectiveUsage(state, now)` treats counts as 0 when `observed_at` is outside the current window or day.
  - `budgetDecision(state, now)` returns `{ ok: true }` or `{ ok: false, delaySeconds }`. It refuses when 15-min usage ≥ limit − 10 (delay until next window) or daily usage ≥ limit − 50 (delay until next UTC midnight). It applies to both read and overall limits.
  - `backoffSeconds(attempts) = min(30 * 2 ** attempts, 3600)`.
- [ ] T010 [P] Unit test in `test/unit/activity.test.ts` for `toActivityRecord(stravaActivity, athleteId, now)` and `isCycling(sportType)`:
  - the cycling set is exactly `Ride`, `MountainBikeRide`, `GravelRide`, `EBikeRide`, `EMountainBikeRide`, `VirtualRide`;
  - `Run`/`Walk`/`Velomobile` give `null`;
  - output keys are exactly `strava_activity_id, athlete_id, sport_type, start_date, start_date_local, timezone, distance_m, moving_time_s, elevation_gain_m, is_private, refreshed_at`;
  - input containing `map.summary_polyline`, `start_latlng`, `end_latlng`, `name`, `description`, `average_heartrate`, `average_watts`, `photos` leaks none of them;
  - `private: true` gives `is_private: 1`.
- [ ] T011 [P] Unit test in `test/unit/messages.test.ts` for `parseWorkMessage(unknown)`. It accepts exactly the four shapes in contracts/queue-messages.md (`activity-event`, `import-page`, `check-membership`, `delete-rider`) and rejects unknown `kind`, non-integer IDs, `page < 1`, and unknown `aspect`/`reason`.
- [ ] T012 [P] Unit test in `test/unit/catalogs.test.ts` for `src/i18n/catalogs.ts` and `src/i18n/messages/*.ts` (FR-028, FR-030, SC-010; research R16):
  - **registry**: `DEFAULT_LOCALE === "de"`; `FOREIGN_LOCALE === "en"`; `Object.keys(CATALOGS)` equals `["de", "en"]`.
  - **parity**: for every catalog in `CATALOGS`, the key set equals `Object.keys(de)`, iterating over the registry so a future locale is checked automatically.
  - **values**: no value is empty or whitespace-only.
  - **placeholders**: for every message ID, the `{name}` placeholder set is identical across all catalogs.
  - **switcher labels**: `meta.languageName` is unique across catalogs (`Deutsch`, `English`).
  - **formatting locale**: `meta.intlLocale` is accepted by `new Intl.NumberFormat(...)`.
  - **inventory**: the key set equals exactly the IDs listed in contracts/messages.md (hard-code the expected ID list in the test).
  - **sport types**: every member of `CYCLING_SPORT_TYPES` (from `src/strava/activity.ts`) has a `sport.<type>` message.
  - **spot checks of the German source text**:
    - `de["landing.backups"]` is "Gelöschte Daten bleiben bis zu 7 Tage in den Sicherungen unseres Hosting-Anbieters und verschwinden danach automatisch.";
    - `de["brand.connectWithStrava.alt"]` is "Mit Strava verbinden";
    - `de["brand.poweredByStrava.alt"]` and `en["brand.poweredByStrava.alt"]` are both "Powered by Strava".
- [ ] T013 [P] Unit test in `test/unit/resolve-locale.test.ts` for `resolveLocale(request, catalogs)` in `src/i18n/resolve.ts` (FR-029, FR-029a; research R17). It is table-driven, and every case uses `CATALOGS` unless noted.
  - **German**:
    - no `Accept-Language` → `de`;
    - empty header → `de`;
    - `da,de;q=0.5` → `de` (German is the only provided language listed);
    - `de-DE,en;q=0.5` → `de`;
    - `en;q=0.5,de;q=0.8` → `de`;
    - `en;q=0` → `de` (no language left once `q=0` is dropped);
    - `*` → `de`;
    - malformed `en;q=abc` → treated as `q=0`, so `de`.
  - **English**:
    - `en-US,en;q=0.9,de;q=0.8` → `en`;
    - `EN-gb` → `en`;
    - `da,en;q=0.3` → `en` (English listed, German not);
    - `da` → `en` (only unsupported languages named);
    - `fr-CH, fr;q=0.9` → `en`;
    - tie `en;q=0.8,de;q=0.8` → `en` (first listed wins).
  - **cookie**:
    - `rp_lang=en` with `Accept-Language: de` → `en`;
    - `rp_lang=de` with `Accept-Language: en` → `de`;
    - `rp_lang=fr` (no longer provided) with `Accept-Language: en` → `en`;
    - `rp_lang=fr` and no header → `de`;
    - `rp_lang` among other cookies (`rp_session=…; rp_lang=en`) is found.
  - **extensibility**: with a catalogs object extended by a third key `qps`, `rp_lang=qps` → `qps`, which proves resolution iterates over the registry.
- [ ] T014 [P] Unit test in `test/unit/i18n.test.ts` for `createI18n(locale, catalogs)` in `src/i18n/i18n.ts`:
  - **`t`**:
    - `t("me.greeting", { firstName: "Testrider A" })` gives "Hallo Testrider A!" for `de` and "Hi Testrider A!" for `en`;
    - a missing param throws;
    - a catalog cast to lack a key falls back to the `de` text (the source catalog).
  - **`tHtml`**:
    - `tHtml("landing.who", { clubLink: html\`<a href="x">…</a>\` })` keeps the link markup;
    - a plain-string param containing `<b>` is escaped;
    - message text itself is escaped.
  - **formatting**:
    - `formatNumber(42.195, { fractionDigits: 1 })` gives `42,2` (`de`) and `42.2` (`en`);
    - `formatNumber(1234, { fractionDigits: 0 })` gives `1.234` (`de`) and `1,234` (`en`);
    - `formatDate("2026-10-06T07:30:00Z")` gives `06.10.2026` (`de`) and `06/10/2026` (`en`), using the wall-clock date in UTC so `start_date_local` is not shifted.
  - **`locales`** lists `{ locale, languageName }` for every catalog in registry order.
- [ ] T015 [P] Unit test in `test/unit/html.test.ts` for `src/http/html.ts`:
  - **`html` tagged template**: interpolated strings are escaped (`<>&"'`); nested `html` fragments are not double-escaped; arrays of fragments are joined.
  - **`layout(i18n, { title, path, body })` with a `de` `I18n`**:
    - starts with `<!doctype html>` and contains `<html lang="de">`;
    - contains `<title>` with the given title;
    - footer has `<img src="/strava/de/powered-by-strava.svg" alt="Powered by Strava">`, with src and alt taken from `de["brand.poweredByStrava.*"]`;
    - contains the switcher: `<form method="post" action="/lang">` with `aria-label="Sprache"`, a hidden `next` equal to `path` (attribute-escaped), and `<button name="lang" value="de" lang="de" aria-current="true">Deutsch</button>` plus `<button name="lang" value="en" lang="en">English</button>`;
    - contains no `<script>`.
  - **with an `en` `I18n`**: `lang="en"`, `aria-label="Language"`, and `aria-current` on the English button.
  - **`htmlResponse(i18n, body, status)`** sets `Content-Type: text/html; charset=utf-8`, `Content-Language: <locale>` and `Vary: Accept-Language, Cookie`.
- [ ] T016 [P] Unit test in `test/unit/config.test.ts` for `src/config.ts`:
  - `seasonStartEpoch("2026-01-01")` equals 2025-12-31T23:00:00Z (00:00 Europe/Berlin, winter time);
  - `seasonStartEpoch("2026-07-01")` equals 2026-06-30T22:00:00Z (summer time);
  - `clubId`/`subscriptionId` parse to numbers; an invalid `SEASON_START_DATE` throws.
- [ ] T017 [P] Unit test in `test/unit/session.test.ts` for `src/http/session.ts`:
  - `createSessionCookie(athleteId, now)` gives `rp_session=<athleteId>.<expiresAt>.<sig>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`;
  - `readSession(request, env, now)` returns the athleteId or `null` (tampered, expired, missing);
  - the OAuth state cookie `rp_oauth_state` lasts 10 minutes (`Max-Age=600`);
  - `isSameOrigin(request)` is true only when the `Origin` header equals the request URL's origin.

### Test support

- [ ] T018 Create `test/support/fixtures.ts` with synthetic data only:
  - athlete IDs from 900001 and first names like "Testrider A";
  - a `makeStravaActivity(overrides)` builder returning a full Strava-shaped `DetailedActivity` (including `map.summary_polyline`, `start_latlng` and `name`, so mapping tests can prove they are dropped);
  - the team club `{ id: 2372209, name: "TRHH Rynke Coins" }` and an unrelated club `{ id: 1111 }`.
- [ ] T019 Create `test/support/fake-strava.ts`:
  - `installFakeStrava()` uses `vi.spyOn(globalThis, "fetch")` to route `https://www.strava.com` requests to an in-memory fake, and fails the test (throws) on any other host.
  - Endpoints faked: `POST /oauth/token` (both grant types, rotating the refresh token on refresh), `POST /oauth/revoke` (checks Basic auth `10001:test-client-secret`), `GET /api/v3/athlete/clubs`, `GET /api/v3/activities/:id` (404 when unknown, or when private and the token lacks `activity:read_all`), and `GET /api/v3/athlete/activities` (honours `after`, `page`, `per_page`, scope).
  - Programmable state: athletes with tokens and granted scopes, club memberships, activities, one-shot status overrides per endpoint (e.g. 503, 429, 403, 401), and `X-RateLimit-*`/`X-ReadRateLimit-*` response headers.
  - Records every call for assertions; `restore()` undoes the spy.
- [ ] T020 Create `test/support/ctx.ts`:
  - `makeCtx({ now, catalogs })` returns a `Ctx` with `env` from `cloudflare:test`, `catalogs` defaulting to `CATALOGS`, and a recording fake queue that stores `{ body, delaySeconds }` and exposes `sent`;
  - `seedRider(ctx, overrides)` inserts a connected rider plus encrypted credentials (expiry 6 h ahead) directly into D1;
  - `resetDb()` deletes from all tables except the `strava_rate_limit` row, which it resets to zeros;
  - `request(path, { method, form, cookies, acceptLanguage, origin })` builds a `Request` on `https://rynke.test`. POSTs get a same-origin `Origin` unless `origin` is given, and no `Accept-Language` is sent unless given, so pages resolve to German by default.
- [ ] T021 Integration smoke test in `test/integration/fake-strava.test.ts`. Prove that a `fetch("https://www.strava.com/api/v3/athlete/clubs")` issued inside worker code (call a tiny exported helper from `src/strava/client.ts` through `exports.default` or directly) is intercepted by the spy, and that a request to `https://example.org` fails the test. If interception does not work through `exports.default`, switch `src/strava/client.ts` to take an injectable `fetch` via `Ctx` (research R12) and note it here.
- [ ] T022 [P] Integration test in `test/integration/db.test.ts`:
  - deleting a `riders` row cascades to `strava_credentials`, `activities` and `failed_work`;
  - `upsertActivity` twice with the same `strava_activity_id` leaves one row with the second values;
  - inserting an activity or `failed_work` row for a non-existent rider fails with a foreign-key error;
  - `listRecentActivities(athleteId, 20)` returns newest-first and only that rider's rows;
  - `deletePrivateActivities(athleteId)` removes only `is_private = 1` rows.
- [ ] T023 Integration test in `test/integration/strava-client.test.ts` (uses T019/T020):
  - every response's `X-ReadRateLimit-Usage`/`X-RateLimit-Usage` and `*-Limit` headers are persisted to `strava_rate_limit`;
  - when the stored budget is exhausted, the client returns `{ kind: "budget", delaySeconds }` without calling fetch;
  - a 429 gives `{ kind: "budget", delaySeconds: <until next window> }`; 5xx and network errors give `{ kind: "transient" }`; a 404 gives `{ kind: "not-found" }`.
  - `getAccessToken` refreshes only when `expires_at < now + 300`, persists the rotated refresh token encrypted (the plaintext never appears in D1), and on refresh 400/401 returns `{ kind: "refresh-refused" }`.
  - a 401 on an API call triggers exactly one refresh plus retry.
  - `revokeToken` sends HTTP Basic `client_id:client_secret` and the form field `token`.
- [ ] T024 Integration test in `test/integration/consumer.test.ts` for `processBatch(batch, ctx, handlers)` (common rules from contracts/queue-messages.md), using an injected test handler and `createMessageBatch`/`getQueueResult` from `cloudflare:test`:
  - an invalid body is acked and dropped;
  - an unknown rider is acked and dropped without the handler being called;
  - a `needs_reconnect` rider is dropped for every kind except `delete-rider`;
  - handler result `budget` gives `retry({ delaySeconds })`; `transient` gives `retry({ delaySeconds: backoffSeconds(attempts) })`;
  - `transient` on `attempts >= 10` inserts a `failed_work` row (`message` = JSON body, `last_error` without tokens) and acks — except for `delete-rider`, which is never written to `failed_work`;
  - `refresh-refused` sets the rider `status = 'needs_reconnect'` and acks.
- [ ] T025 [P] Integration test in `test/integration/lang-switcher.test.ts` for `POST /lang` (FR-029a, SC-011; contracts/http-routes.md; research R18), calling `handleFetch` with `makeCtx()`:
  - **switch to English**: `POST /lang` with form `lang=en&next=/notice/expired` and a same-origin `Origin` →
    - `303` with `Location: /notice/expired`;
    - `Set-Cookie: rp_lang=en; Path=/; Max-Age=31536000; SameSite=Lax; Secure; HttpOnly` (assert each attribute).
  - **applies immediately, beats the header**: `GET /notice/expired` with `Cookie: rp_lang=en` and `Accept-Language: de-DE` →
    - `<html lang="en">`, `Content-Language: en`;
    - the text "Sign-in expired";
    - the English switcher button carries `aria-current="true"`.
  - **switch back**: `lang=de` → `rp_lang=de`. A following GET with `Accept-Language: en` renders "Anmeldung abgelaufen".
  - **unsupported `lang=fr`** → `303` to `next` and no `Set-Cookie`.
  - **`next` allow-list**:
    - `https://evil.example/`, `//evil.example`, `/\evil.example`, `/strava/webhook/test-verify-token`, `/notice/unknown` and a missing `next` all give `Location: /`;
    - `/`, `/me`, `/me/disconnect` and `/notice/team-full` are kept.
  - **`Origin` check**: a missing or foreign `Origin` gives `403`, a German page with "Anfrage abgelehnt", and no `Set-Cookie`.
  - **no sign-in needed**: works without `rp_session`.
  - **nothing persisted**: row counts of every D1 table are unchanged after the requests.
- [ ] T026 [P] Integration test in `test/integration/notice.test.ts` for `GET /notice/:id` (contracts/http-routes.md, contracts/messages.md), with no `Accept-Language`:
  - **every known id** (`expired`, `denied`, `team-full`, `failed`, `not-member`, `strava-busy`, `deleted`, `deleted-revoke-failed`) →
    - `200`, `<html lang="de">`, `Content-Language: de`;
    - its German title and body from contracts/messages.md;
    - a "Zur Startseite" link to `/`;
    - the switcher with `next` equal to `/notice/<id>`.
  - **per-id extras**:
    - `expired`, `denied`, `failed` and `strava-busy` have a "Noch einmal versuchen" link to `/connect`;
    - `not-member` links `https://www.strava.com/clubs/2372209`;
    - `deleted` contains "spätestens nach 7 Tagen";
    - `deleted-revoke-failed` also contains „Meine Apps“.
  - **English**: `Accept-Language: en` on `/notice/team-full` gives "The team is full for now".
  - **not found**: `GET /notice/unknown` and `GET /nope` → `404` German page "Seite nicht gefunden".
  - **no rider data**: no session is needed, and nothing from D1 is shown.

### Implementation for the foundation

- [ ] T027 [P] Implement `src/crypto/encrypt.ts`: AES-256-GCM via Web Crypto with the key imported from base64 `TOKEN_ENCRYPTION_KEY`, format `v1:<base64 iv>:<base64 ciphertext>` (research R10). Makes T007 green.
- [ ] T028 [P] Implement `src/crypto/sign.ts`: HMAC-SHA256 with `SESSION_SIGNING_KEY`, payload `<value>.<expiresAt>.<base64url sig>`, constant-time compare. Makes T008 green.
- [ ] T029 [P] Implement `src/strava/rate-limit.ts` (pure functions, margins 10 and 50). Makes T009 green.
- [ ] T030 [P] Implement `src/strava/activity.ts`: `CYCLING_SPORT_TYPES`, `isCycling`, and `toActivityRecord` as an explicit allow-list mapping (research R5). Makes T010 green.
- [ ] T031 [P] Implement `src/work/messages.ts`: the `WorkMessage` union types and `parseWorkMessage` per contracts/queue-messages.md. Makes T011 green.
- [ ] T032 [P] Implement the message catalogs (research R16):
  - **`src/i18n/messages/de.ts`**: `export const de = { … } satisfies Record<string, string>`, holding every ID and German text from contracts/messages.md. Set `brand.*.src` to `/strava/de/…` per contracts/messages.md.
  - **`src/i18n/messages/en.ts`**: `export const en: Catalog = { … }` with the English texts.
  - **`src/i18n/catalogs.ts`**:
    - types `MessageId = keyof typeof de`, `Catalog = Readonly<Record<MessageId, string>>`, `Catalogs = Readonly<Record<string, Catalog>>`;
    - `CATALOGS = { de, en } as const satisfies Catalogs`;
    - `Locale = keyof typeof CATALOGS`;
    - `DEFAULT_LOCALE: Locale = "de"`;
    - `FOREIGN_LOCALE: Locale = "en"` (used when `Accept-Language` names only unsupported languages).

  `tsc` must reject a key missing from `en`. Makes T012 green (with T030).
- [ ] T033 [P] Implement `src/i18n/resolve.ts`: `resolveLocale(request, catalogs): string` — `rp_lang` cookie if it is a key of `catalogs`, else the highest-`q` supported primary subtag from `Accept-Language` (ties → first listed; `q=0`, `*` and malformed weights dropped), else `FOREIGN_LOCALE` (`"en"`) if the header still names any language, else `DEFAULT_LOCALE`. Also export `LANG_COOKIE = "rp_lang"`. Makes T013 green.
- [ ] T034 Implement `src/http/html.ts`:
  - the `html` tagged template with an escaping `SafeHtml` type, plus an exported `escapeHtml`;
  - `layout(i18n, { title, path, body })` with minimal inline CSS, no script, `<html lang>`, the switcher form built from `i18n.locales` with `aria-label` = `t("layout.switcher.label")` and `next` = `path`, and the footer `<img src=t("brand.poweredByStrava.src") alt=t("brand.poweredByStrava.alt")>`;
  - `htmlResponse(i18n, body, status, headers?)` setting `Content-Type`, `Content-Language` and `Vary: Accept-Language, Cookie`.

  It contains no literal rider-facing text.
- [ ] T035 Implement `src/i18n/i18n.ts`: `createI18n(locale, catalogs)` returns `{ locale, t, tHtml, formatNumber, formatDate, locales }` (research R16):
  - **`t`**: `{name}` substitution, throws on a missing param, falls back to the `de` text for a missing key.
  - **`tHtml`**: escapes the message text via `escapeHtml` and inserts `SafeHtml` params raw, plain params escaped.
  - **`formatNumber`/`formatDate`**: use `Intl` with `meta.intlLocale`; `formatDate` uses `timeZone: "UTC"` with 2-digit day and month and a numeric year.

  Together with T034 this makes T014 and T015 green.
- [ ] T036 [P] Implement `src/config.ts`: typed accessors over `Env` (`clubId`, `subscriptionId`, `seasonStartEpoch` computed for 00:00 Europe/Berlin via `Intl.DateTimeFormat`, `verifyToken`, client ID/secret). Makes T016 green.
- [ ] T037 Implement `src/http/session.ts`: session and OAuth state cookies plus `isSameOrigin`, using `src/crypto/sign.ts`. Makes T017 green.
- [ ] T038 [P] Implement `src/db/riders.ts`:
  - functions: `getRider`, `insertRider`, `updateRiderOnReconnect`, `setRiderStatus`, `setImportStatus`, `setMembershipChecked`, `deleteRider` (a single `DELETE FROM riders`, relying on the cascade), `listConnectedRiderIds`;
  - credentials: `getCredentials` and `saveCredentials` (which encrypt and decrypt via `src/crypto/encrypt.ts`).
- [ ] T039 [P] Implement `src/db/activities.ts`: `upsertActivity` (`INSERT … ON CONFLICT(strava_activity_id) DO UPDATE`), `deleteActivity`, `deletePrivateActivities`, `listRecentActivities(athleteId, limit)`.
- [ ] T040 [P] Implement `src/db/failed-work.ts` (`insertFailedWork`, `listFailedWorkSince`, `deleteFailedWork(ids)`, `deleteFailedWorkOlderThan`) and `src/db/rate-limit.ts` (`readRateLimitState`, `recordRateLimitHeaders`). Together with T038/T039 this makes T022 green.
- [ ] T041 Implement `src/strava/client.ts` and `src/strava/tokens.ts` with exactly the endpoints in contracts/strava-api-usage.md:
  - results are typed `StravaResult<T>` = `ok` | `not-found` | `forbidden` | `unauthorized` | `budget` | `transient` | `refresh-refused`;
  - the budget is checked before each call, and rate headers are recorded after each response;
  - `getAccessToken` does refresh-before-use with a 5-minute margin and persists the rotated tokens;
  - one refresh-and-retry on 401;
  - `revokeToken` uses Basic auth.

  Makes T021 and T023 green.
- [ ] T042 Implement `src/work/consumer.ts`:
  - `processBatch(batch, ctx, handlers)` where `handlers` maps `kind` to `(msg, rider, ctx) => Promise<HandlerResult>`;
  - apply all common rules from contracts/queue-messages.md, with `MAX_ATTEMPTS = 10` matching `max_retries`.

  Makes T024 green.
- [ ] T043 Restructure `src/index.ts`:
  - build `Ctx` from `env`, with `catalogs: CATALOGS`;
  - `fetch` delegates to `src/http/router.ts` (new);
  - `queue` calls `processBatch` with a handlers map (empty for now);
  - `scheduled` is a no-op placeholder;
  - export `handleFetch`, `handleQueue` and `handleScheduled` for tests.

  The router:
  - is a path switch that keeps `GET /health` and the webhook path outside i18n;
  - for every other path, resolves the locale once with `resolveLocale(request, ctx.catalogs)`, builds `createI18n`, and passes it to rider-facing handlers;
  - answers unknown paths `404` with the `error.notFound.*` page via `layout`.

  The existing `test/index.test.ts` must stay green.
- [ ] T044 Implement `src/http/notice.ts`:
  - `NOTICE_IDS` (the eight IDs from contracts/http-routes.md) and `GET /notice/:id`, rendering `notice.<camelCaseId>.title/body` through `layout`;
  - the retry link (`notice.retry` → `/connect`) for `expired`/`denied`/`failed`/`strava-busy`, and the club link (`tHtml` with `clubLink` = `<a href="https://www.strava.com/clubs/<clubId>">` + `t("club.linkText")`) for `not-member`;
  - `notice.revokeFailed.body` appended for `deleted-revoke-failed`, and `notice.backToStart` → `/` on every notice;
  - unknown id → the `404` page.

  Wire it in `src/http/router.ts`. Makes T026 green.
- [ ] T045 Implement `src/http/lang.ts`:
  - `POST /lang` per contracts/http-routes.md: `isSameOrigin` else the `403` page with `error.forbidden.*`; parse the form; `lang` in `ctx.catalogs` → `Set-Cookie` `rp_lang` with the attributes from data-model.md, otherwise no cookie; `303` to `safeNext(next)`;
  - `safeNext` allows only `/`, `/me`, `/me/disconnect` and `/notice/<id in NOTICE_IDS>`, otherwise `/`;
  - no D1 access.

  Wire it in `src/http/router.ts`. Makes T025 green.

**Checkpoint**: `pnpm lint && pnpm typecheck && pnpm test` green. Foundation ready,
including German-by-default rendering, the switcher and notice pages.

---

## Phase 3: User Story 1 — Rider connects their Strava account (Priority: P1) 🎯 MVP

**Goal**: a club member connects, chooses whether private activities are included,
sees "connected", and their rides since the season start are imported in the
background. All pages are German by default, English on request.

**Independent Test**: complete the connect flow against the fake Strava. The rider
and credentials rows exist with encrypted tokens, `/me` shows „Mit Strava
verbunden“ and the granted level, and the import stores the season's cycling
activities. Non-members, refusals and "team full" leave no rows behind and land
on the matching `/notice/:id` page.

### Tests for User Story 1 (write first, confirm red) ⚠️

- [ ] T046 [P] [US1] Integration test in `test/integration/landing.test.ts` (FR-001, FR-002, FR-022a, FR-029, FR-029a):
  - **signed-out `GET /`, no `Accept-Language`**: `200` with `<html lang="de">` and `Content-Language: de`, plus the German texts from contracts/messages.md:
    - `landing.dataRead`, `landing.purpose` and `landing.leave`;
    - `landing.backups` ("Gelöschte Daten bleiben bis zu 7 Tage …");
    - `landing.cookies`;
    - `landing.who` with a link to `https://www.strava.com/clubs/2372209` reading "unseres Team-Clubs auf Strava".
  - **German button**: `<a href="/connect">` wraps `<img src="<de["brand.connectWithStrava.src"]>" alt="Mit Strava verbinden">`.
  - **switcher**: present with `next` = `/`, so it's available before connecting.
  - **English**:
    - `Accept-Language: en-US,en;q=0.9,de;q=0.8` → `lang="en"`, the English `landing.backups` text, and the img `src` = `en["brand.connectWithStrava.src"]` with `alt="Connect with Strava"`;
    - `Cookie: rp_lang=en` with `Accept-Language: de` → English.
  - **signed in**: with a valid session, `GET /` gives `302 /me`.
- [ ] T047 [P] [US1] Integration test in `test/integration/connect.test.ts` for `GET /connect`:
  - 302 to `https://www.strava.com/oauth/authorize` with `client_id=10001`, `redirect_uri=<origin>/auth/callback`, `response_type=code`, `approval_prompt=force`, `scope=read,activity:read,activity:read_all` and a random `state`;
  - the response sets `rp_oauth_state` carrying the same state.
- [ ] T048 [US1] Integration test in `test/integration/callback.test.ts` covering every row of the `GET /auth/callback` table in contracts/http-routes.md (outcomes are `303` redirects to `/notice/:id`, research R18):
  - **refusals**:
    - missing or mismatched `state` → `303 /notice/expired`, no rows;
    - `error=access_denied` → `303 /notice/denied`, no rows;
    - accepted scope without `activity:read`, or without `read` → token revoked on the fake, `303 /notice/denied`, no rows.
  - **token exchange**:
    - `403` → `303 /notice/team-full`, no rows;
    - `500` → `303 /notice/failed`, no rows.
  - **club check**:
    - non-member (club list without 2372209) → revoke called, `303 /notice/not-member`, no rows;
    - `503` → revoke called, `303 /notice/strava-busy`, no rows.
  - **new member with both scopes**:
    - `riders` row with `status='connected'`, `scope_read_all=1`, `import_status='pending'`;
    - credentials whose tokens differ from the plaintext;
    - `Set-Cookie: rp_session` and `302 /me`;
    - exactly one queued `{ kind: "import-page", athleteId, page: 1 }`.
  - **new member who unticked private** → `scope_read_all=0`.
  - **reconnect** → still one `riders` row, with `scopes` and `scopes_updated_at` updated.
  - **no inline pages**: no callback response has an HTML body, so a reload or language switch can never re-submit the `code`.
- [ ] T049 [US1] Integration test in `test/integration/reconnect-scope.test.ts` (FR-007):
  - a rider with `scope_read_all=1`, one private and one public activity, reconnects without `activity:read_all` → the private row is deleted, the public one kept, no import queued;
  - a rider with `scope_read_all=0` reconnects with it → `import_status='pending'` and `import-page` page 1 queued.
- [ ] T050 [P] [US1] Integration test in `test/integration/import-page.test.ts` for the `import-page` handler:
  - **pagination**: 450 synthetic activities (430 cycling, 20 `Run`) after the season start, plus 5 before it, give fake calls for pages 1–3 with `after=<seasonStartEpoch>&per_page=200`; 430 rows end up stored; pages 2 and 3 are queued by the handler; `import_status` goes `running` then `done`.
  - **idempotency**: re-processing page 2 adds no rows.
  - **scope**: a rider with `scope_read_all=0` gets no private rows.
  - **budget**: an exhausted budget gives the `budget` result and no fetch.
- [ ] T051 [P] [US1] Integration test in `test/integration/me-status.test.ts` (German unless noted):
  - **signed out**: `GET /me` gives `302 /`; a valid session for a deleted rider also gives `302 /`.
  - **connected rider (first name "Testrider A")**:
    - "Hallo Testrider A!" and "Mit Strava verbunden";
    - "Einschließlich deiner privaten Aktivitäten" (`scope_read_all=1`) or "Nur geteilte Aktivitäten – private („Nur du“) Aktivitäten werden nicht importiert." (`scope_read_all=0`);
    - the import status: "Deine Fahrten seit dem 01.01.2026 werden importiert …" for `pending`/`running`, "Import abgeschlossen" for `done`;
    - the switcher with `next` = `/me`;
    - a sign-out form posting to `/logout` labelled "Abmelden".
  - **`needs_reconnect` rider**: "Die Verbindung zu Strava muss erneuert werden." and an "Erneut verbinden" link to `/connect`.
  - **English**: `Accept-Language: en` → "Connected to Strava" and "Importing your rides since 01/01/2026 …".

### Implementation for User Story 1

- [ ] T052 [P] [US1] Implement `src/http/landing.ts` (`GET /`) per contracts/http-routes.md and FR-001/FR-002/FR-022a:
  - all text from the `landing.*` messages via `i18n.t`/`tHtml`, with no literal copy;
  - the club link built from `clubId` with `club.linkText`;
  - the "Connect with Strava" image from `brand.connectWithStrava.src`/`.alt`, inside `<a href="/connect">`;
  - rendered through `layout` with `path: "/"`.

  Makes T046 green.
- [ ] T053 [US1] Add `isClubMember(token, clubId)` to `src/strava/client.ts`. It pages `GET /api/v3/athlete/clubs?per_page=200&page=N` until the club is found or a page has fewer than 200 items, and returns `member` | `not-member` | `inconclusive` (any non-ok result).
- [ ] T054 [US1] Implement `src/http/auth.ts`:
  - **`GET /connect`**: redirect to Strava's authorize URL.
  - **`GET /auth/callback`**, in this order:
    1. state check (`303 /notice/expired`);
    2. `error` handling (`303 /notice/denied`);
    3. token exchange (403 → `303 /notice/team-full`, other errors → `303 /notice/failed`);
    4. scope check using the token response's space-delimited `scope` — needs both `read` and `activity:read`, otherwise revoke and `303 /notice/denied`;
    5. `isClubMember` (`not-member` → revoke, `303 /notice/not-member`; `inconclusive` → revoke, `303 /notice/strava-busy`; no rows either way);
    6. insert or update the rider and credentials;
    7. FR-007 scope-change rules (`deletePrivateActivities` on 1→0; `import_status='pending'` plus enqueue on 0→1 or for a new rider);
    8. set `rp_session`, `302 /me`.

  Keep only `athlete.id` and `athlete.firstname` from the token response. Makes T047–T049 green.
- [ ] T055 [US1] Implement `src/work/import-page.ts`:
  - call `GET /api/v3/athlete/activities` with `after=seasonStartEpoch`, `per_page=200`, `page`;
  - upsert `toActivityRecord` results for cycling items only and set `import_status='running'`;
  - when 200 items came back, enqueue `page+1`; otherwise set `import_status='done'`;
  - register the handler in the `src/index.ts` handlers map.

  Makes T050 green.
- [ ] T056 [US1] Implement the status part of `src/http/me.ts` (`GET /me`):
  - session check and rider lookup;
  - the status, granted level, import status (season start via `i18n.formatDate`) and reconnect link, all from the `me.*` messages;
  - the sign-out form (`layout.logout`);
  - an empty "Recent rides" section, filled in by US4.

  Render it through `layout` with `path: "/me"`. Wire `/`, `/connect`, `/auth/callback` and `/me` in `src/http/router.ts`. Makes T051 green.

**Checkpoint**: US1 is fully functional and testable on its own (quickstart §1 rows
"US1 …" and "Season import"), in German by default and in English on request.

---

## Phase 4: User Story 2 — New activities arrive automatically (Priority: P1)

**Goal**: Strava webhook events for connected riders create, update and delete
stored activities idempotently, within the rate budget, without ever losing work.

**Independent Test**: send simulated webhook events (create/update/delete,
duplicates, reordered) for a seeded rider, process the queued messages, and check
that the `activities` table matches the fake Strava's current state exactly.

### Tests for User Story 2 (write first, confirm red) ⚠️

- [ ] T057 [P] [US2] Integration test in `test/integration/webhook.test.ts` (FR-010–FR-012, SC-003):
  - **validation `GET /strava/webhook/test-verify-token`**:
    - with `hub.mode=subscribe&hub.verify_token=test-verify-token&hub.challenge=abc` → 200 `application/json` `{"hub.challenge":"abc"}`;
    - wrong `hub.verify_token` → 403;
    - wrong path secret → 404.
  - **events `POST`**:
    - wrong path secret → 404;
    - a body over 1,000 bytes → 400; invalid JSON or shape → 400;
    - `subscription_id: 1` (≠ 777) → 200 with nothing queued;
    - a valid activity create → 200 and exactly one queued `{ kind: "activity-event", athleteId: owner_id, activityId: object_id, aspect: "create", changed: [] }`;
    - an update with `updates: { title, type }` → `changed: ["title","type"]`;
    - a non-deauth athlete update → 200 with nothing queued.
  - **no outbound calls**: the fake Strava records zero calls across all webhook requests.
  - **not rider-facing**: webhook responses are not HTML and carry no `Content-Language` (they aren't catalogued).
- [ ] T058 [P] [US2] Integration test in `test/integration/activity-event.test.ts` (FR-013–FR-018, SC-004):
  - **create**: stores the mapped record and nothing else (no polyline or name columns exist; also assert the values).
  - **updates**:
    - `update` with `changed: ["type"]` after the fake switched it to `Run` → row deleted;
    - `update` with `changed: ["title"]` → zero fake calls, row unchanged;
    - `update` with `changed: ["private"]` for a rider with `scope_read_all=0` → fake returns 404 → row deleted.
  - **deletes**: `delete` → row removed with zero fake calls; `create` for an activity the fake no longer has → no row.
  - **replay (SC-004)**: the sequence `[create A, create A, update A(type), delete B, create B, create C, delete C, create C]` against the fake's final state (A = Ride, B = deleted, C = Ride) gives exactly rows A and C.
  - **dropped messages**: an unknown athlete and a `needs_reconnect` rider are acked with zero fake calls.
  - **retries**:
    - fake 503 → retried with `backoffSeconds(attempts)`;
    - fake 429 → retried with delay to the next 15-minute window and no further call;
    - 503 on attempt 10 → a `failed_work` row.
- [ ] T059 [P] [US2] Integration test in `test/integration/scheduled-failed-work.test.ts` (R7, SC-005): with `failed_work` rows aged 1 day and 8 days, `handleScheduled` re-enqueues only the 1-day row's message, deletes both rows, and makes zero fake Strava calls.

### Implementation for User Story 2

- [ ] T060 [US2] Implement `src/http/webhook.ts`:
  - `GET` validation per contracts/http-routes.md;
  - `POST` checks: path secret equals `STRAVA_WEBHOOK_VERIFY_TOKEN` (constant-time compare), `Content-Length`/body ≤ 1000 bytes, shape validation, `subscription_id === subscriptionId`;
  - map `object_type=activity` to an `activity-event` message and `ctx.queue.send(...)`, then return 200;
  - must not import or call `src/strava/*` or `src/i18n/*`;
  - wire `/strava/webhook/:secret` in `src/http/router.ts` outside the i18n branch.

  Makes T057 green (the deauth branch follows in US3).
- [ ] T061 [US2] Implement `src/work/activity-event.ts` with the decision table in contracts/queue-messages.md (`delete` → `deleteActivity`; title-only update → no-op; otherwise `GET /activities/{id}` → 404/403/non-cycling/private-without-read_all → `deleteActivity`, else `upsertActivity`). Register it in the `src/index.ts` handlers map. Makes T058 green.
- [ ] T062 [US2] Implement `src/work/scheduled.ts` with `requeueFailedWork(ctx)` (re-enqueue rows younger than 7 days, then delete re-enqueued rows and rows older than 7 days), and call it from `handleScheduled` in `src/index.ts`. Makes T059 green.

**Checkpoint**: US1 + US2 together form the MVP data pipeline (quickstart §1 rows
"US2 …", "Webhook ack", "Rate limit", "Transient errors").

---

## Phase 5: User Story 3 — Rider leaves and their data is removed (Priority: P2)

**Goal**: deauthorization, the disconnect button, or leaving the club removes
everything about the rider. A deleted rider can reconnect fresh.

**Independent Test**: seed a rider with activities and a `failed_work` row, then
trigger each of the three leave paths. No row referencing the athlete remains in
any table, and later messages for them have no effect.

### Tests for User Story 3 (write first, confirm red) ⚠️

- [ ] T063 [P] [US3] Integration test in `test/integration/delete-rider.test.ts` (FR-022–FR-024):
  - **queuing**: a webhook `POST` with `object_type: "athlete", updates: { authorized: "false" }` queues `{ kind: "delete-rider", athleteId, reason: "deauthorized", revoke: false }`.
  - **deletion**: processing it removes the rider's rows from `riders`, `strava_credentials`, `activities` and `failed_work`, with zero fake calls.
  - **with `revoke: true`**:
    - the fake records `POST /oauth/revoke` with Basic auth, then the rows are deleted;
    - fake 503 → retried;
    - 503 on attempt 10 → rows deleted anyway, and no `failed_work` row is written.
  - **no resurrection**: a later `activity-event` for the deleted athlete creates nothing.
  - **reconnect after deletion**: running the callback again yields a fresh rider with `import_status='pending'` and no old activities.
- [ ] T064 [P] [US3] Integration test in `test/integration/disconnect.test.ts` (FR-023, FR-022a), German unless noted:
  - **confirmation page**: `GET /me/disconnect` (signed in) shows "Daten löschen?", the `disconnect.explain` text, a POST form with the button "Ja, alles löschen", an "Abbrechen" link to `/me`, and the switcher with `next` = `/me/disconnect`. Signed out → `302 /`.
  - **refused**: `POST /me/disconnect` without a session, or with a missing or foreign `Origin`, gives `403` with the German "Anfrage abgelehnt" page, and nothing is deleted.
  - **success**:
    - revoke recorded and all rows gone;
    - the response clears `rp_session` (`Max-Age=0`) and is `303 /notice/deleted`;
    - following it shows "Deine Daten wurden gelöscht" and "spätestens nach 7 Tagen".
  - **revoke failing twice (503, 503)**: rows still deleted, `303 /notice/deleted-revoke-failed`, and that page contains „Meine Apps“.
  - **survives a language switch**: `POST /lang` with `lang=en` and `next=/notice/deleted` → English "Your data has been deleted", with nothing re-submitted.
  - **sign-out**: `POST /logout` with same-origin clears the cookie and redirects `302 /`.
- [ ] T065 [P] [US3] Integration test in `test/integration/membership-check.test.ts` (FR-004a, SC-006):
  - `handleScheduled` queues one `check-membership` per `status='connected'` rider (none for `needs_reconnect`);
  - **member**: `membership_checked_at` is updated;
  - **not a member**: `{ kind: "delete-rider", reason: "left-club", revoke: true }` is queued, and processing it deletes all rows;
  - **inconclusive**: fake 503 on the clubs call → retried, rider and data kept; an exhausted budget → `budget` retry, rider kept.

### Implementation for User Story 3

- [ ] T066 [US3] Implement `src/work/delete-rider.ts`:
  - if `revoke`, call `revokeToken` (on transient errors, return `transient` unless `attempts >= 10`, in which case continue);
  - then `deleteRider`;
  - register it in the handlers map, and make sure `src/work/consumer.ts` processes `delete-rider` for `needs_reconnect` riders and never writes it to `failed_work`.
- [ ] T067 [US3] Extend `src/http/webhook.ts`: `object_type=athlete` with `updates.authorized === "false"` → queue a `delete-rider` with `reason: "deauthorized"` and `revoke: false`. Together with T066 this makes T063 green.
- [ ] T068 [US3] Extend `src/http/me.ts` and wire the routes in `src/http/router.ts`:
  - `GET /me/disconnect`: confirmation page from `disconnect.*`, `path: "/me/disconnect"`.
  - `POST /me/disconnect`:
    1. require a session and `isSameOrigin`, else the `403` `error.forbidden` page;
    2. call `revokeToken` with one retry on 503;
    3. `deleteRider`;
    4. clear the cookie and `303` to `/notice/deleted`, or to `/notice/deleted-revoke-failed` if the revoke failed.
  - `POST /logout`.
  - Add the `me.disconnect.button` link on `/me`.

  Makes T064 green.
- [ ] T069 [US3] Implement `src/work/check-membership.ts`:
  - `member` → `setMembershipChecked`;
  - `not-member` → enqueue `delete-rider` (`left-club`, `revoke: true`);
  - `inconclusive` → `transient`/`budget`.

  Register it, and add `fanOutMembershipChecks(ctx)` to `src/work/scheduled.ts` (using `sendBatch` over `listConnectedRiderIds`), called from `handleScheduled` before `requeueFailedWork`. Makes T065 green.

**Checkpoint**: all three leave paths are proven (quickstart §1 rows "US3 …").

---

## Phase 6: User Story 4 — Rider checks what has been imported (Priority: P3)

**Goal**: `/me` lists the rider's 20 most recent imported activities, newest first,
and never shows another rider's data.

**Independent Test**: seed two riders with activities, sign in as one, and check
that `/me` shows exactly that rider's 20 newest activities in order.

### Tests for User Story 4 (write first, confirm red) ⚠️

- [ ] T070 [US4] Integration test in `test/integration/me-activities.test.ts` (FR-025, FR-026):
  - **list**: rider A has 25 activities and rider B has 3 → A's `/me` shows exactly A's 20 newest, newest first, and none of B's `strava_activity_id`s or values.
  - **German formatting** (no `Accept-Language`):
    - heading "Zuletzt importierte Fahrten";
    - column headers "Datum", "Sportart", "Distanz", "Höhenmeter";
    - each entry shows the local start date from `start_date_local` (e.g. `06.10.2026`);
    - the sport type from `sport.<type>` (e.g. `GravelRide` → "Gravel-Fahrt", never the raw enum);
    - distance in km with one decimal (`42,2 km` for 42195 m);
    - elevation rounded to whole metres (`312 m`; `1.234 m` for 1234 m).
  - **English formatting**: `Accept-Language: en` → `06/10/2026`, "Gravel ride", `42.2 km`, `1,234 m`.
  - **empty state**: a rider with no activities sees "Noch keine Fahrten importiert".

### Implementation for User Story 4

- [ ] T071 [US4] Fill the "Recent rides" section in `src/http/me.ts`:
  - use `listRecentActivities(athleteId, 20)`;
  - labels come from `me.recent.*`, sport names from `sport.<type>`, and units from `units.km`/`units.m` with `i18n.formatNumber`/`formatDate`;
  - escape everything through `html`.

  Makes T070 green.

**Checkpoint**: all user stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T072 [P] Integration test in `test/integration/language-rendering.test.ts` (SC-010, SC-011, FR-029a). It covers every rider-facing page:
  - **pages**: `/` signed out; `/me` for a connected rider with activities; `/me` for a `needs_reconnect` rider; `/me/disconnect`; every `/notice/:id`; the `404` page; the `403` page.
  - **German**: run each page with `Accept-Language` absent, `da`, `fr-CH, fr;q=0.9` and `de-DE,en;q=0.5`. Each must have `<html lang="de">`, `Content-Language: de` and `Vary: Accept-Language, Cookie`, and must contain none of the "English-only" catalog values (`en` values that differ from `de` and are longer than 3 characters).
  - **English**: run each page with `en-US,en;q=0.9,de;q=0.8`. It must have `lang="en"` and contain none of the "German-only" values.
  - **switcher**: every page has exactly one switcher form whose `next` is that page's own path, so one click (SC-011) switches language there.
  - **remembered**: a `rp_lang=en` cookie set by `POST /lang`, replayed on a fresh request with `Accept-Language: de`, still renders English.
- [ ] T073 [P] Hard-coded copy guard in `test/integration/no-hardcoded-copy.test.ts` (FR-028, FR-030; research R18):
  - **pseudo-locale**: build a `qps` catalog from `de`, wrapping every value as `⟦…⟧`. Keep `meta.intlLocale` (`de-DE`) and `brand.*.src` as they are; set `meta.languageName` to `⟦Pseudo⟧`.
  - **setup**: create `makeCtx({ catalogs: { ...CATALOGS, qps } })` and render every rider-facing page from T072 with `Cookie: rp_lang=qps`.
  - **text nodes**: strip tags and collect the visible text nodes. Each must sit inside `⟦…⟧`, apart from three exceptions:
    - pure number/date/punctuation runs (`/^[\d.,:\/\s–-]+$/`);
    - the switcher labels, which equal some catalog's `meta.languageName`;
    - the synthetic first name, when inside the greeting marker.
  - **attributes**: every `alt`, `title` and `aria-label` value must also sit inside `⟦…⟧`.
  - **new locale needs no code**: the switcher lists `⟦Pseudo⟧`, which proves a new locale works without code changes.

  Fix any hard-coded copy found in `src/`.
- [ ] T074 [P] Unit test in `test/unit/no-secret-logging.test.ts`: spy on `console.log`/`console.error` while running the callback, refresh, revoke and consumer failure paths (reuse the integration helpers) and assert no logged string contains the fake access token, refresh token, authorization code, client secret, or `TOKEN_ENCRYPTION_KEY`. Fix any offending log call in `src/`.
- [ ] T075 [P] Add a schema guard test in `test/integration/schema-minimisation.test.ts` (FR-014, SC-007, FR-029a). Read `PRAGMA table_info(activities)` and `PRAGMA table_info(riders)`, and assert the column sets equal exactly those in data-model.md. No `polyline`, `latlng`, `name`, `title`, `photo`, `heartrate`, `watts`, `last_name`, `email`, `locale` or `lang` columns can sneak in.
- [ ] T076 [P] Update `README.md`:
  - what the app does;
  - a privacy summary (scopes, what is stored, deletion paths, the 7-day backup window, the session and language cookies);
  - **languages**:
    - rider pages are German by default and English on request;
    - text lives in `src/i18n/messages/<locale>.ts` with IDs per `specs/001-strava-connect-webhook/contracts/messages.md`;
    - adding a locale means adding a catalog file and registering it in `src/i18n/catalogs.ts`;
  - a link to `specs/001-strava-connect-webhook/quickstart.md` for setup and the manual production steps, including the per-locale Strava brand assets;
  - the note that the D1 database must be created with `--jurisdiction=eu` before the first deploy.
- [ ] T077 [P] Update `CLAUDE.md`: under Commands, add `pnpm wrangler d1 migrations apply rynke-points --local` for local dev. Mention that the D1/Queue/cron bindings now exist in `wrangler.jsonc`, and that rider-facing text belongs in `src/i18n/messages/` (never inline).
- [ ] T078 Review `src/` against contracts/http-routes.md, contracts/queue-messages.md, contracts/strava-api-usage.md and contracts/messages.md:
  - every route, message kind, Strava call and message ID in the contracts must exist;
  - no other Strava endpoint may be called (`grep -rn "strava.com" src/`);
  - no catalog message is unused (`grep` each ID in `src/`; IDs built dynamically for `sport.*` and `notice.*` count as used).

  Record any gap as a new task.
- [ ] T079 Re-run the plan's Constitution Check table against the implementation (Principles I–V and the Language section). In particular:
  - no runtime dependencies were added to `package.json` (no i18n library);
  - tokens are only stored via `src/crypto/encrypt.ts`;
  - the webhook handler imports nothing from `src/strava/`;
  - rider-facing text exists only in `src/i18n/messages/`;
  - code, logs and test names are English;
  - no D1 column holds a language.
- [ ] T080 Wiring test in `test/integration/wiring.test.ts` through `exports.default` from `cloudflare:workers`:
  - `fetch("/health")` → 200;
  - `fetch("/strava/webhook/wrong")` → 404;
  - `fetch("/")` → 200 with `Content-Language: de`;
  - `queue(createMessageBatch(...))` with one `activity-event` for an unknown athlete is acked;
  - `scheduled(createScheduledController({ cron: "17 3 * * *" }))` completes.
- [ ] T081 Run `pnpm lint && pnpm typecheck && pnpm test` and walk through quickstart.md §1, ticking off every scenario row (including the language rows) against a passing test. Fix failures before marking done.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies. T002 before T005 (bindings must exist), T005 before T006.
- **Foundational (Phase 2)**: depends on Setup and blocks all user stories.
  - **Order within it**: tests T007–T017 [P] first; then T018–T020 (support); then T021–T026; then implementation T027–T045.
  - **Strava and queue**: T041 needs T029, T038 and T040. T042 needs T031, T040 and T041. T043 needs T042.
  - **i18n**: T034 and T035 depend on each other's types (`SafeHtml` and `I18n`), so do them in sequence after T032/T033. T043 needs T033–T035. T044 needs T043. T045 needs T044 (`NOTICE_IDS`).
- **US1 (Phase 3)**: depends on Foundational.
- **US2 (Phase 4)**: depends on Foundational. Independent of US1 (tests seed riders via `seedRider`), but shares `src/http/router.ts` and `src/index.ts`, so edits there are sequential.
- **US3 (Phase 5)**: depends on Foundational. T067 extends the webhook from T060 (US2), and T068 extends `me.ts` from T056 (US1). The deletion handler itself (T066) is independent.
- **US4 (Phase 6)**: depends on T056 (the `/me` page from US1).
- **Polish (Phase 7)**: after the desired stories. T072 and T073 need every rider-facing page (US1, US3 and US4 done).

### User Story Dependencies

- **US1 (P1)**: none beyond Foundational.
- **US2 (P1)**: none beyond Foundational; testable alone via seeded riders.
- **US3 (P2)**: deletion core is independent; the webhook branch needs US2's `webhook.ts`; the disconnect button needs US1's `/me`.
- **US4 (P3)**: needs US1's `/me` page.

### Within Each User Story

- Tests are written first and must FAIL before implementation (Principle V).
- New rider-facing text is never added ad hoc. Every message a story needs is
  already in the catalogs from T032 (the full inventory in contracts/messages.md).
  A wording change updates contracts/messages.md, both catalogs and the asserting
  test together.
- DB/client helpers come before handlers, and handlers before route/handler-map wiring.
- Commit after each green step.

### Parallel Opportunities

- Phase 1: T003 and T004 alongside T001/T002.
- Phase 2: all unit tests T007–T017; integration tests T022, T025 and T026; implementations T027–T033 and T036, T038–T040 (separate files).
- US1: T046, T047, T050 and T051 in parallel (T048/T049 share callback fixtures, so write them in sequence); T052 alongside T053.
- US2: T057, T058 and T059 in parallel.
- US3: T063, T064 and T065 in parallel.
- Polish: T072–T077 in parallel.
- After Foundational, US1 and US2 can proceed in parallel by different people, coordinating on `src/http/router.ts` and the handler map in `src/index.ts`.

---

## Parallel Example: Foundational i18n

```bash
# Write the i18n tests together (all red):
Task: "Unit test catalog parity in test/unit/catalogs.test.ts"
Task: "Unit test locale resolution in test/unit/resolve-locale.test.ts"
Task: "Unit test createI18n in test/unit/i18n.test.ts"
Task: "Unit test layout + switcher in test/unit/html.test.ts"
Task: "Integration test POST /lang in test/integration/lang-switcher.test.ts"
Task: "Integration test notice pages in test/integration/notice.test.ts"

# Then implement (separate files):
Task: "Implement catalogs in src/i18n/messages/de.ts, en.ts and src/i18n/catalogs.ts"
Task: "Implement resolveLocale in src/i18n/resolve.ts"
```

## Parallel Example: User Story 2

```bash
# Write all US2 tests together (all red):
Task: "Integration test webhook validation and event intake in test/integration/webhook.test.ts"
Task: "Integration test activity-event processing in test/integration/activity-event.test.ts"
Task: "Integration test failed_work re-enqueue in test/integration/scheduled-failed-work.test.ts"

# Then implement (webhook.ts and activity-event.ts are separate files):
Task: "Implement webhook route in src/http/webhook.ts"
Task: "Implement activity-event handler in src/work/activity-event.ts"
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Phase 1 Setup, then Phase 2 Foundational. That includes German-by-default
   rendering, the switcher and the notice pages, so every page built afterwards is
   bilingual from its first commit.
2. Phase 3 (US1): riders can connect and their season is imported. **Validate**
   with the quickstart §1 US1 rows.
3. Phase 4 (US2): live activities flow in. **Validate** with the quickstart §1 US2
   rows.
4. US1 + US2 is the minimum useful pipeline. **Do not invite any rider other than
   the maintainer before US3 is done**: deletion on deauthorization is
   non-negotiable (constitution Principle I).

### Incremental Delivery

1. Setup + Foundational → foundation ready (catalogs, locale resolution, switcher).
2. + US1 → connect works (maintainer-only test in production possible).
3. + US2 → activities arrive.
4. + US3 → safe to invite riders (deletion paths complete).
5. + US4 → riders can see their imported rides.
6. Polish → language guards, README, schema and logging guards, full quickstart
   validation. Then the maintainer runs the manual production steps in
   quickstart §3, including the per-locale Strava brand assets.

---

## Notes

- [P] tasks = different files, no dependency on unfinished tasks.
- The [Story] label maps each task to a spec user story for traceability.
- Verify that tests fail before implementing. Commit after each task or logical group.
- Deploying, `wrangler secret put`, `--remote` D1 commands and the webhook
  subscription are manual maintainer steps (quickstart §3). No task runs them.
- Downloading Strava's brand assets is also a manual maintainer step (T004 README,
  quickstart §3 step 5). Whether German variants exist is an open question
  (plan.md, Open questions). If they don't, only `brand.*.src` in `de.ts` changes.
