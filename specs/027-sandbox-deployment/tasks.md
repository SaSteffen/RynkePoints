---

description: "Task list for Release Sandboxes, slice 1"
---

# Tasks: Release Sandboxes, slice 1

**Input**: Design documents from `specs/027-sandbox-deployment/`: plan.md, spec.md (slice 1),
research.md (R1–R13), data-model.md, contracts/ (access-check, sandbox-config, sandbox-workflow),
quickstart.md.

**Scope**: Slice 1 only (spec, Slices): User Stories 1, 4, 5, 8 and User Story 6 scenarios 1, 2,
5 and 6. No `sandbox-gate`, control comment or **Accept** (slice 2); no scale profile (slice 3).

**Tests**: Required. Constitution Principle V (test-first) and the contracts list the tests:
every Worker and script change starts with a failing Vitest test. Workflow YAML has no unit
tests in this repo; quickstart checks 2–22 cover it on the live sandboxes after the release, with
no tasks for them.

**Organization**: By user story. US4 (nobody else gets in) comes first because nothing is
deployable before the access check (plan, Order of work).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: The user story the task belongs to (US1, US4, US5, US6, US8)

## Rules for every task

- `src/` never imports `dev/`, `album/` or `gateway/` (`test/unit/dev-guard.test.ts`); sandbox
  behaviour lives in `dev/` only, so the production bundle is unchanged (FR-004, FR-013).
- Never deploy, run `wrangler ... --remote`, `wrangler secret put` or touch real Cloudflare
  resources from a task: the one-time setup in quickstart.md belongs to the founding maintainer.
- Every Wrangler command a script or workflow runs names `--env sandbox-<team>` explicitly.
- Database IDs, `ACCESS_AUD` and `ACCESS_TEAM_DOMAIN` stay placeholders until the maintainer's
  setup fills them; `team-check` must still pass with the placeholders.
- Sandbox-facing text (bar, `/_dev/`, messages, 403 body) is developer-facing English in `dev/` or
  workflows, never in `src/i18n/messages/` (FR-003).

---

## Phase 1: Setup

**Purpose**: Configuration both sandboxes and every later task build on.

- [x] T001 Add the `sandbox-hamburg` and `sandbox-europe` blocks to `wrangler.jsonc` after the teams' blocks, exactly as contracts/sandbox-config.md: `name` `rynke-points-sandbox-<team>`, `main` `"dev/worker.ts"`, `workers_dev: false`, `preview_urls: false`, D1 binding `DB` with `database_name` `rynke-points-sandbox-<team>` and a placeholder `database_id` distinct from every other block's, queue producer and consumer `rynke-points-sandbox-<team>-work` with the team's queue settings, no `triggers`, every var of the team's block with the same value except `PUSH_SUBJECT` `https://sandbox-<team>.trhh-rynke-coins.link`, `STRAVA_RETURN_VIA` `""`, `USAGE_PEERS` `"[]"`, `TEAM_ID` `<team>`, `RYNKE_FAKE_STRAVA` `"sandbox"`, `SANDBOX_HOST` `sandbox-<team>.trhh-rynke-coins.link`, `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` placeholders, the team's `secrets.required` list, and `routes: [{ pattern: "sandbox-<team>.trhh-rynke-coins.link", custom_domain: true }]`
- [x] T002 Run `pnpm types` to regenerate `worker-configuration.d.ts`, and extend `DevEnv` in `dev/worker.ts` with optional strings `SANDBOX_HOST`, `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `SANDBOX_COMMIT` and `SANDBOX_SOURCE` (`RYNKE_FAKE_STRAVA` is already there); `src/` reads none of them

---

## Phase 2: Foundational (blocking)

**Purpose**: Fake mode knows a second mode, `sandbox`, and production config can't be confused
with a sandbox. Blocks every user story.

- [x] T003 [P] Write failing tests in `test/teams/completeness.test.ts` (which already imports `teamProblems` from `scripts/team-check.mjs`) for each sandbox rule of contracts/sandbox-config.md, one fixture config per rule, each failing with a message naming the block and key: unknown team; `main` not `dev/worker.ts`; any `triggers`; `workers_dev` or `preview_urls` not `false`; `RYNKE_FAKE_STRAVA` not `sandbox`; `TEAM_ID` not `<team>`; route other than `sandbox-<team>.trhh-rynke-coins.link`; `SANDBOX_HOST` different from the route; Worker name, database name, database ID, queue name or host shared with a team's block or another sandbox's; vars differing from the team's beyond `RYNKE_FAKE_STRAVA`, `SANDBOX_HOST`, `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `PUSH_SUBJECT`, `STRAVA_RETURN_VIA`, `USAGE_PEERS`, `TEAM_ID`, or lacking one of them; plus `--deployable sandbox-hamburg` refused, and the real `wrangler.jsonc` passes
- [x] T004 Implement those rules in `scripts/team-check.mjs` (and its types in `scripts/team-check.d.mts` if the exports change): blocks named `sandbox-*` are checked as sandboxes, not as teams, and `--deployable` refuses any name starting with `sandbox-` (research R8, FR-012) until T003 passes
- [x] T005 [P] Write failing tests in a new `test/unit/dev-sandbox-mode.test.ts` for `assertFakeMode` in `dev/worker.ts`: `local-only` behaves as today; `sandbox` passes only with non-empty `SANDBOX_HOST`, `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` and throws when any is missing or empty; any other value or unset throws (contracts/access-check.md, Modes)
- [x] T006 Extend `assertFakeMode` in `dev/worker.ts` to accept `RYNKE_FAKE_STRAVA === "sandbox"` with the three vars set, and export a `sandboxMode(env)` helper the later tasks use, until T005 passes
- [x] T007 [P] Move the "newer than live" logic out of the `deploy-gate` job in `.github/workflows/ci.yml` into a new executable `.github/scripts/newer-than-live.sh <environment>` (same behaviour, same output and exit codes), and make `deploy-gate` call it; `deploy-gate` stays a non-context job name (research R10 step 2, FR-017)

**Checkpoint**: `pnpm test` passes; `team-check` accepts the placeholder sandbox blocks.

---

## Phase 3: User Story 4 – Nobody else gets in, and production stays apart (P1)

**Goal**: A request that didn't come through Cloudflare Access gets a `403` before the app, the
fake Strava or `/_dev/` sees it, even with Access removed (FR-010, FR-013, FR-014).

**Independent Test**: The Vitest suite of contracts/access-check.md passes; the production host
gets `403` in both modes; a sandbox session cookie has no `Domain`.

### Tests (write first, see them fail)

- [x] T008 [P] [US4] Write failing tests in a new `test/unit/sandbox-access.test.ts` per contracts/access-check.md "Tests": generate an RSA key pair in the test, answer `https://<ACCESS_TEAM_DOMAIN>/cdn-cgi/access/certs` with a stubbed `fetch`, and assert: a valid token passes and the app answers; no header, a malformed token, `alg: none`, `HS256`, an unknown `kid`, a bad signature, another `aud`, another `iss`, an expired token (`exp` ≤ now − 60 s), a future `nbf` (> now + 60 s) each give `403` with `Content-Type: text/plain` and body `Sandbox: access required`, no `Set-Cookie`, and neither the app nor `/_dev/` ran; another host with a valid token gives `403`; the certs URL failing gives `403`; an `aud` given as a list containing `ACCESS_AUD` passes; the token and its claims never appear in logs, only `sandbox access refused reason=<step>`
- [x] T009 [P] [US4] Write failing tests in `test/unit/dev-sandbox-mode.test.ts`: `trhh-rynke-coins.link` and `europe.trhh-rynke-coins.link` get `403` in `sandbox` mode and are refused in `local-only` mode (FR-013); `local-only` on `localhost` still works without a token
- [x] T010 [P] [US4] Write a test in `test/unit/session.test.ts` that pins the session cookie from `createSessionCookie` in `src/http/session.ts` as host-only: no `Domain` attribute (research R4, FR-014)

### Implementation

- [x] T011 [US4] Implement the check in a new `dev/sandbox-access.ts` per contracts/access-check.md "Request check, in order": host equals `SANDBOX_HOST`; `Cf-Access-Jwt-Assertion` present; JWT header `alg: RS256` with a `kid`; JWK from the certs URL, cached in the isolate for one hour and fetched again at most once per request for an unknown `kid`; `crypto.subtle.verify` with RSASSA-PKCS1-v1_5 and SHA-256; claims `iss` = `https://<ACCESS_TEAM_DOMAIN>`, `aud` (string or list) contains `ACCESS_AUD`, `exp` > now − 60 s, `nbf` if present ≤ now + 60 s; the `CF_Authorization` cookie is ignored; no library (Web Crypto only)
- [x] T012 [US4] Call the check first thing in `devFetch` in `dev/worker.ts` when `sandboxMode(env)`, before `onDevClock`, the Strava interceptor, seeding, `/_dev/` or `handleFetch`; refuse with the `403` of the contract; queue and scheduled handlers stay unchecked (no request). T008 and T009 pass
- [x] T013 [US4] Update `test/unit/dev-guard.test.ts` if needed so it still proves `src/` never imports `dev/sandbox-access.ts` or reads the sandbox vars

**Checkpoint**: US4 scenarios 1, 2, 4 and 5 are covered by tests; scenario 3 (credential withheld)
comes with the workflow (US1).

---

## Phase 4: Fake mode in a sandbox (supports US1, US5, US6)

**Goal**: The fake-mode wrapper behaves as contracts/sandbox-config.md "Fake mode in a sandbox".
Labelled by the story each behaviour serves.

### Tests (write first, see them fail)

- [x] T014 [P] [US6] Write failing tests in `test/unit/dev-sandbox-mode.test.ts`: in `sandbox` mode a request with a valid token never seeds (`seedIfNeeded` doesn't run; an empty database stays empty), and `POST /_dev/reset` answers `409` with "Deploy again to reset the sandbox (docs/sandboxes.md)" and deletes nothing; in `local-only` mode both behave as today (research R6, FR-019)
- [x] T015 [P] [US1] Write failing tests in `test/unit/dev-sandbox-mode.test.ts` for the bar (research R12, FR-003, FR-050): in `sandbox` mode every HTML response gets a fixed bar "Sandbox · not the real app · <first 7 characters of SANDBOX_COMMIT>" linking to the commit on GitHub, plus `SANDBOX_SOURCE` (`PR #<n>`, `release #<n>` or `develop`); non-HTML responses are unchanged; `local-only` has no bar
- [x] T016 [P] [US5] Write failing tests in `test/integration/dev-fake-strava.test.ts` for `POST /_dev/scheduled` (research R9, FR-032, FR-036): it runs `handleScheduled` with the daily expression `17 3 * * *`, redirects back to `/_dev/` with a flash, works in `local-only` and `sandbox` mode, and writes no usage record and sends no usage alert
- [x] T017 [P] [US1] Write failing tests in `test/integration/dev-fake-strava.test.ts` for FR-051 (research R9a): `GET /_dev/` lists the sample riders with state, **Connect as** and a link to `/_dev/riders/<athleteId>`, and reads no rides (no query on the activities store); `GET /_dev/riders/<athleteId>` shows that rider's forms (new ride, change a ride, delete a ride, sync a backlog) with only that rider's rides in the ride choice; an unknown athlete ID gives `404`; `POST /_dev/events` redirects back to the rider's page; adjust existing tests there that expect the event forms on `/_dev/`

### Implementation

- [x] T018 [US6] In `dev/worker.ts`, skip `seedIfNeeded` and answer `POST /_dev/reset` with the `409` when `sandboxMode(env)` (T014)
- [x] T019 [US1] In `dev/worker.ts`, add the bar with `HTMLRewriter` on HTML responses when `sandboxMode(env)`, from `SANDBOX_COMMIT` and `SANDBOX_SOURCE` (T015)
- [x] T020 [US5] Add `POST /_dev/scheduled` to `devRoute` in `dev/worker.ts` and a **Run the daily work** button to `indexPage` in `dev/fake-strava/pages.ts` (T016)
- [x] T021 [US1] Split the overview in `dev/fake-strava/pages.ts` and `dev/worker.ts`: `indexRows` no longer calls `riderActivities`; `indexPage` links each stored rider to `/_dev/riders/<athleteId>`; a new `riderPage` holds `eventForms` for one rider with `riderActivities` for that rider only; `GET /_dev/riders/<athleteId>` in `devRoute`; `POST /_dev/events` redirects to the rider's page with the flash (T017)

**Checkpoint**: `pnpm test` passes; `pnpm dev` works as before apart from the rider pages.

---

## Phase 5: User Story 5 – Sandboxes can't use up production's allowance (P2)

**Goal**: A deployment stops before writing when the account is above 50 % of a daily
allowance, when the figures are unavailable, or when the sandbox databases' rows written today
plus the seed would pass 40,000 (FR-033, FR-034).

**Independent Test**: The verdict's Vitest table passes; `node scripts/sandbox-usage.mjs` without
a token stops with "Cloudflare's figures are unavailable".

- [x] T022 [P] [US5] Write failing tests in a new `test/unit/sandbox-verdict.test.ts` for a pure `sandboxUsageVerdict(result, seedRows, sandboxDatabaseIds)` per contracts/sandbox-workflow.md "Usage check": `unavailable` stops with "Cloudflare's figures are unavailable (<reason>)"; today's `cf_d1_rows_written` + `seedRows`, `cf_d1_rows_read` or `cf_queue_operations` above `SANDBOX_USAGE_THRESHOLD = 0.5` of `CLOUDFLARE_LIMITS` stops with "<figure> at <n> of <limit> today, above 50 %"; the sandbox databases' rows written today (summed by `databaseId`) plus `seedRows` above `SANDBOX_DAILY_BUDGET = 40000` stops, saying so; exactly at a limit goes; otherwise goes, listing each figure
- [x] T023 [US5] Implement `sandboxUsageVerdict` with the constants `SANDBOX_USAGE_THRESHOLD` and `SANDBOX_DAILY_BUDGET` in a new `dev/sandbox-usage.ts`, over the result type of `fetchCloudflareUsage` in `src/usage/cloudflare.ts` (reuse its per-`databaseId` figures; change `src/usage/cloudflare.ts` only if it doesn't expose them, with its tests in `test/unit/usage-cloudflare.test.ts` first) until T022 passes
- [x] T024 [US5] Write `scripts/sandbox-usage.mjs`: reads `CLOUDFLARE_ANALYTICS_TOKEN` and `CLOUDFLARE_ANALYTICS_ACCOUNT_ID`, `--seed-rows <n>` and the sandbox database IDs from `wrangler.jsonc`'s `sandbox-*` blocks (via `parseJsonc` from `scripts/team-check.mjs`), calls `fetchCloudflareUsage` for today, prints the verdict, exits non-zero on stop; no token means unavailable, not an error trace

**Checkpoint**: US5 scenarios 1, 2 and 4 are covered; scenario 3 by T016 and T001 (no `triggers`).

---

## Phase 6: User Story 6 – Migrations rehearsed and a way back (P2, scenarios 1, 2, 5, 6)

**Goal**: Every deployment rebuilds the sandbox's database from a seed made at the base's
version on CI, after trying the change's migrations on a local copy (FR-016, FR-035).

**Independent Test**: Run the script's local phases on a machine: `base.sql` is produced from
the base's checkout, the change's migrations apply to a copy, and a deliberately broken migration
stops it before phase 3.

- [x] T025 [US6] Write `scripts/sandbox-seed.sh` with subcommands per research R6: `seed <team> <base-dir>` starts the team's e2e fake-mode server from the base's checkout (as `pnpm test:e2e:server` / `test:e2e:server:europe` do, own `--persist-to` directory and a free port), requests one page so it seeds the sample riders with the base's code, stops it, and runs `wrangler d1 export DB --local --env <team> --persist-to <dir> --output base.sql`, falling back to the change's own checkout when the base doesn't know the team; `try-migrations <team>` imports `base.sql` into another fresh local database and runs `wrangler d1 migrations apply DB --local --env <team>` from the change's checkout, failing with the migration's name; `count <file>` prints the `INSERT` count doubled (the seed rows for T024); `rebuild <team>` (CI only) lists tables and views of the remote `sandbox-<team>` database from `sqlite_master` (leaving `sqlite_*` and `_cf_*`), drops them under `PRAGMA defer_foreign_keys = on`, then runs `wrangler d1 execute DB --remote --env sandbox-<team> --file base.sql`
- [x] T026 [US6] Try `seed`, `try-migrations` and `count` locally for both teams, and `rebuild` against a local stand-in (`--local` with a separate `--persist-to`, never `--remote`); record in research R6 what was verified (export honours `--persist-to`, the dump imports into an emptied database, nothing in it points at `localhost:8797`) and the measured row counts, and fix the script where it didn't hold

**Checkpoint**: The local phases work for Hamburg and Europe; only `rebuild`'s remote run is left
for the workflow.

---

## Phase 7: User Story 1 – Choose sandboxes when opening a release (P1)

**Goal**: **Release PR** has one checkbox per sandbox; a ticked one deploys the release's head,
and a message lands on the pull request (FR-005–FR-009, FR-011, FR-015–FR-020).

**Independent Test**: Quickstart checks 2, 3, 4 and 10 after the slice is merged and set up.

- [x] T027 [US1] Write the reusable workflow `.github/workflows/sandbox.yml` per contracts/sandbox-workflow.md "Sandbox": `workflow_call` inputs `teams` (JSON list), `pr`, `sha`, `base`; `workflow_dispatch` with booleans `sandbox-hamburg`, `sandbox-europe` (resolving `pr` to the open release pull request if any, `sha` to its head else `develop`'s head, `base` `main`); a run on any ref but `develop` stops before any job with an environment; matrix job `sandbox (<team>)`, `fail-fast: false`, environment `sandbox-<team>` with URL `https://sandbox-<team>.trhh-rynke-coins.link`, concurrency `sandbox-<team>` with `cancel-in-progress: false`, `timeout-minutes: 60`, permissions `contents: read`, `checks: read`, `actions: write`, `pull-requests: write`, `deployments: write`
- [x] T028 [US1] Add the job's steps to `.github/workflows/sandbox.yml` in the contract's order: checkout of `sha` and a second checkout of `develop` for the scripts; `newer-than-live.sh sandbox-<team>` only when `sha` is on `develop`; wait for the `lint`, `typecheck` and `test` check runs on `sha` (not `e2e`, not `commitlint`), polling every 30 s for at most 20 minutes, starting CI on `develop` with `gh workflow run` when the commit has none; `node scripts/team-check.mjs` from `develop`'s checkout against the deployed commit's `wrangler.jsonc`; `sandbox-seed.sh seed` at `base`'s head and `try-migrations`; `sandbox-usage.mjs --seed-rows` from `develop`'s checkout; then, with `CLOUDFLARE_SANDBOX_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` only in these steps, `sandbox-seed.sh rebuild`, `wrangler d1 migrations apply DB --remote --env sandbox-<team>`, and `wrangler deploy --env sandbox-<team> --var SANDBOX_COMMIT:<sha> --var SANDBOX_SOURCE:<PR #n, release #n or develop>`; a GitHub deployment in environment `sandbox-<team>` (`in_progress`, then `success` or `failure`, data-model.md)
- [x] T029 [US1] Add the always-run message step to `.github/workflows/sandbox.yml` per contracts/sandbox-workflow.md "The message": success with link, commit, base and its commit, migrations applied (or none); failure with the step and a one-line reason, and whether the sandbox still runs the previous commit or is empty or half-built after the rebuild started; the extra line when the head moved; posted on the pull request with `github.token`, or into the job summary without one; nothing secret (no token, account ID or Access values)
- [x] T030 [US1] Change `.github/workflows/release-pr.yml` per contracts/sandbox-workflow.md "Release PR": boolean inputs `sandbox-hamburg` and `sandbox-europe`, default `false`, with the skip descriptions; use an already open release pull request instead of stopping; still stop when `develop` isn't ahead of `main`; add the FR-006 guidance as a **Sandboxes** section below the list of changes in a new pull request's body; then call `sandbox.yml` with `teams`, `pr`, the head `sha` and `base: main` when any box is ticked

**Checkpoint**: US1 is complete once the maintainer's setup is done; US4 scenario 3 rests on the
environments' `develop`-only branch policy (quickstart check 10).

---

## Phase 8: User Story 8 – Try a pull request before it reaches `develop` (P1)

**Goal**: Each pull request into `develop` has a checkbox per sandbox; ticking deploys its head
at `develop`'s base, only for branches of this repository and senders with write access
(FR-048–FR-050).

**Independent Test**: Quickstart checks 15–20 after the slice is merged and set up.

- [x] T031 [P] [US8] Create `.github/pull_request_template.md` with the **Sandboxes** section of contracts/sandbox-workflow.md: `- [ ] Deploy to Hamburg's sandbox`, `- [ ] Deploy to Europe's sandbox`, and the FR-006 advice in a collapsed `<details><summary>When to skip</summary>`
- [x] T032 [US8] Write `.github/workflows/sandbox-pr.yml` per contracts/sandbox-workflow.md "Pull requests into `develop`": `pull_request_target`, types `opened` and `edited`, branches `develop`; never checks out or runs the pull request's code itself; on `opened` without the section, append it; on `edited`, for each ticked box: untick it with `github.token`, then refuse with a message for a fork head ("Sandboxes take branches of this repository only") or a sender without write access, else call `sandbox.yml` with `teams`, `pr`, `sha` = the head, `base: develop`
- [x] T033 [US8] Make `sandbox.yml` seed at `develop`'s head when `base` is `develop`, skip `newer-than-live.sh` for a commit not on `develop` (FR-017), and pass `SANDBOX_SOURCE` `PR #<n>` (FR-050)

**Checkpoint**: All slice 1 stories are built.

---

## Phase 9: Polish and cross-cutting

- [x] T034 [P] Write `docs/sandboxes.md`: what a sandbox is; the two ways to choose one (pull request checkboxes, **Release PR**) and by hand; the FR-006 guidance; that every deployment rebuilds the data and deploying again is the reset; the daily budget and the 50 % check; how to look up the live commit; what a sandbox can't show (real Strava)
- [x] T035 [P] Record the sandbox environments `sandbox-hamburg` and `sandbox-europe` (`develop` only, no admin bypass), `CLOUDFLARE_SANDBOX_API_TOKEN` with its permissions and what it can still reach (plan, Constitution Check), `CLOUDFLARE_ANALYTICS_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, the Access application and the per-sandbox secrets as manual steps in `.github/repository-settings.md` (FR-042, research R5, R11)
- [x] T036 [P] Update `README.md` and `CLAUDE.md`: the sandboxes and their checkboxes (FR-046, slice 1 parts); in `CLAUDE.md`, add `sandbox (…)`, `sandbox-pr` and the **Sandbox** workflow's jobs to the list of job names that are not required-check contexts, and add creating the sandbox resources, Access application, secrets, tokens and environments to the manual steps
- [x] T037 [P] Amend FR-009 in `specs/006-local-frontend-dev/spec.md` per FR-013: fake mode answers local hosts plus exactly the configured sandbox hosts, still never production, and `src/` still never imports `dev/`
- [x] T038 Check `.github/rulesets/*.json` gained no new context, and run the targeted tests for the changed files (`test/unit/sandbox-access.test.ts`, `test/unit/dev-sandbox-mode.test.ts`, `test/unit/sandbox-verdict.test.ts`, `test/unit/session.test.ts`, `test/teams/completeness.test.ts`, `test/integration/dev-fake-strava.test.ts`, `test/unit/dev-guard.test.ts`); CI runs the full suites

---

## Dependencies and execution order

- **Setup (T001–T002)** → **Foundational (T003–T007)** → everything else.
- **US4 (T008–T013)** before any deployable piece: the access check gates the workflow (plan,
  Order of work 1).
- **Fake mode in a sandbox (T014–T021)** after T006; independent of US4's implementation apart
  from both editing `dev/worker.ts` (do T012 before T018–T021 to avoid conflicts).
- **US5 (T022–T024)** after Foundational; independent of US4 and Phase 4.
- **US6 (T025–T026)** after T001; T024's `--seed-rows` uses T025's `count`.
- **US1 (T027–T030)** needs T004, T007, T012, T018–T019, T024, T025.
- **US8 (T031–T033)** needs T027–T029.
- **Polish (T034–T038)** last; T034–T037 can start once the behaviour they describe is settled.

## Parallel examples

- After T002: T003, T005 and T007 together (different files).
- In US4: T008, T009 and T010 together; then T011.
- In Phase 4: T014–T017 together (T014, T015 share `test/unit/dev-sandbox-mode.test.ts`: write
  them in one go, or one after the other).
- US5's T022 alongside Phase 4's tests.
- In Polish: T034–T037 together.

## Implementation strategy

- **MVP**: Phases 1–7. That's the first deployable increment: a release can go to a sandbox that
  only maintainers reach, within the free plan, rebuilt each time. US8 (Phase 8) follows in the
  same pull request or right after; it is the main day-to-day use (spec Clarifications,
  2026-11-10).
- One pull request into `develop` for the slice (or two: Phases 1–6 as code without workflows,
  then 7–9), each with its tests first.
- After merge and release: the founding maintainer's one-time setup (quickstart), then
  quickstart checks 2–22 on the live sandboxes. 026's T074 is done with Europe's sandbox.
