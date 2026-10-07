---
description: "Task list for running the daily job on demand"
---

# Tasks: Run the Daily Job on Demand

**Input**: Design documents from `/specs/007-manual-daily-run/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[contracts/run-daily.md](contracts/run-daily.md), [quickstart.md](quickstart.md)

**Tests**: REQUIRED (constitution Principle V, spec FR-006). Write each test task
first, run it and confirm it fails, then implement. The shell script gets no test
(research R5).

**Organization**: US2 (only the token starts a run) and US1's route half share
one handler, so Phase 3 builds the route for both. Phase 4 adds US1's script.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 (start from the command line), US2 (nobody else can start it)

## Phase 1: Setup

- [x] T001 Put the production secret with `pnpm wrangler secret put ADMIN_TOKEN`
  (manual, done by the maintainer on 2026-10-07, research R4)
- [ ] T002 Declare the secret:
  - add `"ADMIN_TOKEN"` to `secrets.required` in `wrangler.jsonc`, then run
    `pnpm types` to regenerate `worker-configuration.d.ts`;
  - add the synthetic binding `ADMIN_TOKEN: "test-admin-token"` in
    `vitest.config.ts`;
  - add `ADMIN_TOKEN=` to `.dev.vars.example` with the comment
    `# 32 random bytes, base64: \`openssl rand -base64 32\``.

---

## Phase 2: Foundational

- [ ] T003 Add `waitUntil` to `Ctx` (research R2):
  - `src/ctx.ts`: add
    `waitUntil: (promise: Promise<unknown>) => void;` with a one-line doc
    comment.
  - `src/index.ts`: `makeCtx(env, exec)` takes the entry point's
    `ExecutionContext` and sets `waitUntil: (p) => exec.waitUntil(p)`. `fetch`,
    `queue` and `scheduled` pass their third argument.
  - `test/support/ctx.ts`: `makeCtx` gets a `pending: Promise<unknown>[]` that
    `waitUntil` pushes to, exposed on `TestCtx`.
  - `test/integration/wiring.test.ts`: pass `createExecutionContext()` as the
    third argument to `worker.queue(...)` and `worker.scheduled(...)`.
- [ ] T004 [P] Move `secretEquals` from `src/http/webhook.ts` to a new
  `src/crypto/secret.ts`, exported unchanged with its comment. `webhook.ts`
  imports it, and the existing webhook tests stay green.

**Checkpoint**: `pnpm typecheck` and `pnpm test` pass, with no behaviour change.

---

## Phase 3: The route (US2, then US1) — Priority P1

**Goal**: `POST /admin/run-daily` with the right bearer token starts the daily
run in the background and answers `202`. Every other request gets the same 404
as an unknown address and starts nothing ([contract](contracts/run-daily.md)).

**Independent test**: `test/integration/run-daily.test.ts` passes.

- [ ] T005 [US2] Write `test/integration/run-daily.test.ts` (failing). In
  `beforeEach`, `resetDb()` and seed one connected rider with `seedRider`. Each
  case calls `handleFetch` (from `src/index.ts`) with a `Request` to
  `${ORIGIN}/admin/run-daily` and a test `Ctx`. For each case below, assert
  status 404, a body equal to `notFound(createI18n("de", CATALOGS),
  "/admin/run-daily")`'s text, `ctx.pending` empty and `ctx.queue.sent` empty:
  - `POST` without an `Authorization` header;
  - `POST` with `Bearer wrong-token`;
  - `POST` with `Basic test-admin-token`, the right value but the wrong scheme;
  - `POST` with `Bearer ` (empty token), while the `Ctx` env has
    `ADMIN_TOKEN: ""`;
  - `GET` with `Bearer test-admin-token`.
- [ ] T006 [US1] Add a case to `test/integration/run-daily.test.ts` (failing):
  - `POST` with `Bearer test-admin-token` answers `202`, with `Content-Type:
    text/plain; charset=utf-8` and body `started`.
  - `ctx.pending` has exactly one promise. After awaiting it, `ctx.queue.sent`
    equals what `handleScheduled` sends on a fresh `makeCtx()` after
    `resetDb()` and the same seed.
- [ ] T007 [US1] Implement `handleRunDaily(request, ctx, i18n, path)` in the new
  `src/http/run-daily.ts`:
  - Parse `Authorization` with `/^Bearer (.+)$/`.
  - Return `notFound(i18n, path)` when the method isn't `POST`, the header
    doesn't match, `ctx.env.ADMIN_TOKEN` is empty or unset, or
    `secretEquals(token, ctx.env.ADMIN_TOKEN)` is false.
  - Otherwise call
    `ctx.waitUntil(handleScheduled({ cron: "manual", scheduledTime: Date.now(),
    noRetry() {} }, ctx))` and return
    `new Response("started", { status: 202, headers: { "Content-Type":
    "text/plain; charset=utf-8" } })`.
  - Add a short header comment pointing to research R2/R3.
  - Watch out for the import cycle: `handleScheduled` lives in `src/index.ts`,
    which imports the router. If that breaks, move `handleScheduled` into
    `src/work/scheduled.ts` and re-export it from `src/index.ts`.
- [ ] T008 [US1] Route `/admin/run-daily` to `handleRunDaily` for every method,
  after the `i18n` is created, in `src/http/router.ts`. T005 and T006 now pass.

**Checkpoint**: the route is done, and the job can be started with a plain curl.

---

## Phase 4: The script (US1) — Priority P1

**Goal**: `pnpm daily:run` starts the run ([contract](contracts/run-daily.md#scriptsrun-dailysh-pnpm-dailyrun)).

**Independent test**: quickstart "Locally" steps 2–4.

- [ ] T009 [P] [US1] Write `scripts/run-daily.sh` (executable, bash,
  `set -euo pipefail`, with a header comment in the style of
  `scripts/docs-pdf.sh`):
  - When `ADMIN_TOKEN` is unset or empty, print `error: ADMIN_TOKEN is not set`
    to stderr and exit 1.
  - Set `url="${RYNKE_URL:-https://trhh-rynke-coins.link}"`.
  - Run `printf 'Authorization: Bearer %s\n' "$ADMIN_TOKEN" | curl -sS
    --fail-with-body --max-time 30 -X POST -H @- "$url/admin/run-daily"
    >/dev/null`, so the token stays out of the argument list.
  - Then print `daily run started on $url`.
- [ ] T010 [P] [US1] Add `"daily:run": "scripts/run-daily.sh"` to `scripts` in
  `package.json`, next to `docs:pdf`.

---

## Phase 5: Polish

- [ ] T011 [P] Add to `test/integration/wiring.test.ts`: `exports.default.fetch`
  of `POST https://rynke.test/admin/run-daily` with `Bearer test-admin-token`
  answers `202`, and without the header answers `404`.
- [ ] T012 [P] Document the secret next to the others (FR-005): add
  `ADMIN_TOKEN` (`openssl rand -base64 32`) to step 6 of
  `specs/001-strava-connect-webhook/quickstart.md`, and point to
  `specs/007-manual-daily-run/quickstart.md` for using it.
- [ ] T013 Run `pnpm lint`, `pnpm typecheck` and `pnpm test`. All pass.

---

## Dependencies & Execution Order

- T002 → T003, T004 → T005–T008 (in order) → T011. T009, T010 and T012 can be
  done at any time.
- T001 is done. Nothing in production waits on it any more.

## Parallel Example

```text
After T002: T003 and T004 together.
Alongside Phase 3: T009, T010, T012.
```

## Implementation Strategy

There is one delivery and one PR. Phase 3 alone already makes the run startable
with curl. Phase 4 makes it a one-liner. Checking it on the live site after the
release is a manual step for the maintainer (quickstart "Production use") and
gets no task.
