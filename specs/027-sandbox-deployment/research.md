# Research: Release Sandboxes, slice 1

Slice 1 only (spec, Slices): Hamburg's and Europe's sandboxes, chosen on **Release PR** or by
hand, a message per deployment, the usage check before writing, no cron, no gate. Slices 2
and 3 get their own research when they're planned.

## R1. A sandbox is a Wrangler environment running fake mode's entry

**Decision**: Two more blocks in `wrangler.jsonc`, `sandbox-hamburg` and `sandbox-europe`. Each
has `main: "dev/worker.ts"`, its own Worker (`rynke-points-sandbox-hamburg`,
`rynke-points-sandbox-europe`), database, queue and custom domain, no `triggers`, and the team's
vars with `TEAM_ID` set to its team. The fake-mode marker `RYNKE_FAKE_STRAVA` is a declared var
with the value `sandbox`, and three more vars belong to the sandbox only: `SANDBOX_HOST`,
`ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` (R3). The commit comes in at deploy time with
`--var SANDBOX_COMMIT:<sha>`.

**Rationale**: The production bundle stays `src/index.ts` and never contains fake mode (FR-013).
The sandbox runs exactly the app's handlers inside fake mode's existing wrapper (FR-004), as
`pnpm dev` and the e2e server do. A Wrangler environment is how this repository already tells
deployments apart (026 research R1), and `team-check` can compare each sandbox block with its
team's (R8).

**Alternatives considered**:
- **Cloudflare Previews or Version URLs**: ruled out in the spec (Clarifications, 2026-11-10).
- **A separate `sandbox/wrangler.jsonc`**: keeps the blocks apart, but `pnpm types` and
  `team-check` would need a second file, and the team's vars would drift unseen.
- **One sandbox switched between teams**: ruled out in the spec (Clarifications, 2026-11-04).

## R2. Hosts

**Decision**: `sandbox-hamburg.trhh-rynke-coins.link` and `sandbox-europe.trhh-rynke-coins.link`,
as Worker custom domains (`routes` with `custom_domain: true`). `workers_dev` and
`preview_urls` stay `false`, inherited from the top level and repeated in each sandbox block so
that a change at the top can't open them.

**Rationale**: Subdomains of Hamburg's zone, as 026 FR-042 asks. The same prefix for both makes
the Access application (R3) and the config check (R8) one pattern: `sandbox-<team>`. Europe's
production stays at `europe.trhh-rynke-coins.link`, so no sandbox host can be mistaken for it.

**Alternatives considered**: `sandbox.trhh-rynke-coins.link` for Hamburg alone breaks the
pattern for the next team. A `workers.dev` address can be protected by Access too, but is one
more address to keep closed.

## R3. Not publicly reachable: Cloudflare Access plus a check in the Worker

**Decision**: Two layers, and either alone keeps strangers out.

1. **Cloudflare Access** (Zero Trust, Free plan: up to 50 users). One self-hosted application
   covers both sandbox hosts, with one policy: *Allow*, by the e-mail addresses a maintainer
   lists. Sign-in by one-time PIN by e-mail, which needs no identity provider; GitHub as a
   login method can be added later. No *Bypass* or *Service Auth* policy. Session duration 24
   hours.
2. **The Worker refuses anything Access didn't let through** (FR-010, fail closed). In sandbox
   mode, before any other work, the fake-mode wrapper:
   - requires the request's host to be exactly `SANDBOX_HOST`;
   - requires the `Cf-Access-Jwt-Assertion` header and verifies it: RS256 signature against the
     keys from `https://<ACCESS_TEAM_DOMAIN>/cdn-cgi/access/certs` (Web Crypto, no library), `aud`
     containing `ACCESS_AUD`, `iss` equal to `https://<ACCESS_TEAM_DOMAIN>`, `exp` in the future
     and `nbf` not in the future, allowing 60 seconds of clock skew;
   - answers anything else with `403` and a plain text body, before the app, the fake Strava
     pages or `/_dev/` see the request.

   Missing or empty `SANDBOX_HOST`, `ACCESS_TEAM_DOMAIN` or `ACCESS_AUD` means fake mode doesn't
   start (`assertFakeMode` throws), so a sandbox whose Access settings were lost answers nothing.
   If the keys can't be fetched, the request is refused too. Keys are cached in the isolate for
   an hour and fetched again once for an unknown `kid`. The header is authoritative; the
   `CF_Authorization` cookie is ignored.

**Rationale**: Access alone is one dashboard setting away from public: a deleted application, a
changed hostname or an added *Bypass* rule would open the fake sign-in to everyone. The JWT
check makes that a refusal instead (spec US4 scenario 2). The token's signature can't be forged
without Access's private key, and `aud` ties it to this application, so a token from another
Access application doesn't pass. Queue and scheduled handlers have no request and need no check.

**What a person who gets through can do**: everything the maintainers can, with synthetic data
only: sign in as any sample rider, simulate events, use the admin pages with that sandbox's own
`ADMIN_TOKEN`. That's why the Access list stays short.

**Alternatives considered**:
- **Access alone**: fails open when misconfigured (above).
- **HTTP Basic auth in the Worker**: one shared password, no per-person removal, and the
  password would have to be handed round.
- **Checking Access's e-mail in the Worker as well**: duplicates the policy and needs a second
  list to keep in step; the policy is the one place.
- **A JWT library (`jose`)**: one more dependency for one verification (Principle IV).

## R4. Sessions can't cross to production

**Decision**: Nothing to build. Session cookies are host-only (`src/http/session.ts` sets no
`Domain`), so a sandbox cookie is never sent to `trhh-rynke-coins.link` or
`europe.trhh-rynke-coins.link`. Each sandbox also has its own random `SESSION_SIGNING_KEY`, so a
copied cookie isn't valid in production either (FR-014). A unit test pins the missing `Domain`.

## R5. The sandbox's secrets

**Decision**: Set once by hand per sandbox (`wrangler secret put --env sandbox-<team>`), listed in
the setup guide:

| Secret | Value |
|---|---|
| `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_WEBHOOK_VERIFY_TOKEN`, `PUSH_VAPID_KEY` | The synthetic values from `dev/fake.env` |
| `TOKEN_ENCRYPTION_KEY` | The value from `dev/fake.env`, so the seeded tokens (R6) decrypt |
| `SESSION_SIGNING_KEY`, `ADMIN_TOKEN` | New random values (`openssl rand -base64 32`, `openssl rand -hex 32`) |

**Rationale**: No real Strava credential exists in a sandbox (FR-002), and every Strava request
goes to the fake through the existing interceptor. The values from `dev/fake.env` are public and
protect only fake tokens to the fake Strava. The session key and admin token are fresh, so
nobody can mint a session or call the admin pages from the published file alone, even past the
two layers of R3. CI never handles these secrets.

## R6. Seeding runs outside the Worker

**Decision**: A sandbox's database is seeded once, on its first deployment, and never by a
request. The workflow starts the e2e fake-mode server for the team (as
`pnpm test:e2e:server` does, against a fresh local database), requests one page so the server
seeds the sample riders, stops it, exports the local database with `wrangler d1 export --local`,
and imports the dump into the empty sandbox database with `wrangler d1 execute --remote --file`.
The dump includes `d1_migrations`, so the following `migrations apply --remote` finds nothing to
do. In sandbox mode, `seedIfNeeded` doesn't run, and `POST /_dev/reset` answers that reset comes
with **Reset sandbox** (slice 3). Until then, a stuck sandbox is rebuilt by hand: delete and
recreate its database, and deploy again.

**Rationale**: The Free plan gives a Worker 10 ms of CPU per request. Seeding connects every
sample rider through the app's own flow and imports their rides, far more than 10 ms, so a
seeding request would be cut off halfway. Seeding locally uses CI's machine instead and writes
the result in one import. Later deployments keep the data (FR-016), so each release's
migrations meet the previous release's rows (US6 scenarios 1, 2).

**To verify during implementation**: `wrangler d1 export --local` honours `--persist-to`, and
nothing in the dump names the local origin in a way the sandbox would follow. The quickstart
checks both.

**Alternatives considered**: Seeding through the queue in small messages would fit the CPU limit
but use the queue for bulk data (FR-034) and need the slice 3 machinery now.

## R7. The usage check before writing

**Decision**: `scripts/sandbox-usage.mjs` runs before any write to Cloudflare. It calls
`fetchCloudflareUsage` from `src/usage/cloudflare.ts` (as `team-check` imports `src/` already),
with a read-only analytics token, and compares today's account-wide rows written, rows read and
queue operations with `CLOUDFLARE_LIMITS`. It fails, saying which figure and how far, if any is
above 50 %, or if the figures are unavailable (FR-033). On a first deployment it adds the
seed's estimated rows written (the dump's `INSERT` statements, doubled for index writes) to
today's figure before comparing. The threshold is a constant beside the script, so the Paid plan
needs only that and `CLOUDFLARE_LIMITS` changed (FR-037).

**Rationale**: Reuses 025's query and parsing, so the check and the admin view see the same
numbers. The decision is a pure function, tested with Vitest; the script around it is thin.

## R8. Sandboxes can't name production (FR-012)

**Decision**: `scripts/team-check.mjs` checks every `sandbox-<team>` block: `<team>` is a team in
`src/teams/`; `main` is `dev/worker.ts`; no `triggers`; `RYNKE_FAKE_STRAVA` is `sandbox`;
`TEAM_ID` is `<team>`; `workers_dev` and `preview_urls` are `false`; its route is
`sandbox-<team>.trhh-rynke-coins.link`; and its Worker name, database name and ID, queue names and
host appear in no team's block and in no other sandbox's. `--deployable` refuses any
`sandbox-*` name, so the production deploy can't be pointed at one. A team's vars and the
sandbox's vars match apart from the sandbox's own (`RYNKE_FAKE_STRAVA`, `SANDBOX_HOST`,
`ACCESS_*`, `PUSH_SUBJECT`, `STRAVA_RETURN_VIA` = `""`, `USAGE_PEERS` = `[]`). `team-check`
already runs in CI's `test` job.

## R9. No cron, and scheduled work on demand

**Decision**: Sandbox blocks have no `triggers` (FR-032). `/_dev/` gets a **Run the daily work**
button (`POST /_dev/scheduled`), which calls `handleScheduled` with the daily cron's expression
(`17 3 * * *`). The hourly run isn't offered: in production it records usage and sends usage
alerts, which a sandbox mustn't (FR-036). The button works in local fake mode too.

## R10. The workflow

**Decision**: A new reusable workflow `.github/workflows/sandbox.yml`, `workflow_call` and
`workflow_dispatch` (FR-009). One job per chosen sandbox (`sandbox (<team>)`, matrix, fail-fast
off), each in its GitHub environment `sandbox-<team>`, whose deployment branch policy allows
`develop` only (FR-011). Concurrency `sandbox-<team>`, never cancelled, so one deployment at a
time (FR-017). Steps:

1. The commit: the release pull request's head when called from **Release PR**, else `develop`'s
   head. Checkout of that commit.
2. Not older than live: the `deploy-gate` logic from `ci.yml`, moved into
   `.github/scripts/newer-than-live.sh` and used by both (FR-017). A skip posts a message.
3. Wait for the checks: `lint`, `typecheck`, `test` and `e2e` check runs on the commit, all
   `success`, polling every 30 s for at most 40 minutes. If the commit has none (manual run
   without a release pull request), the job starts CI on `develop` with `gh workflow run` and
   waits for that. A failed or missing check stops the job (FR-015, Edge Cases).
4. `node scripts/team-check.mjs` (R8).
5. The usage check (R7).
6. First deployment only: seed and import (R6).
7. `wrangler d1 migrations apply DB --remote --env sandbox-<team>`, then
   `wrangler deploy --env sandbox-<team> --var SANDBOX_COMMIT:<sha>`. The credential is only in
   these steps' env, as in production's deploy.
8. A message on the release pull request (contracts/sandbox-workflow.md), on success and on
   failure, also when an earlier step stopped the job. Without a release pull request, the
   message goes into the run's summary only (FR-009).

**Release PR** gets one boolean input per sandbox (`sandbox-hamburg`, `sandbox-europe`), off by
default, with the skip advice as description (FR-005). It no longer stops when a release pull
request is already open: it uses that one (FR-008). It calls `sandbox.yml` only when a box is
ticked and `develop` is ahead of `main`. The new pull request's body gets the guidance of
FR-006 below its list of changes.

**Rationale**: A reusable workflow keeps the deploy in one place for both triggers. Polling
check runs avoids a new trigger, and `gh workflow run` covers FR-009 without CI needing to change.

## R11. The credential and what it can still reach

**Decision**: Each `sandbox-<team>` environment holds:
- `CLOUDFLARE_SANDBOX_API_TOKEN`: account *Workers Scripts: Edit*, account *D1: Edit*, and zone
  *Workers Routes: Edit* on `trhh-rynke-coins.link`;
- `CLOUDFLARE_ANALYTICS_TOKEN`: account *Account Analytics: Read* only;
- the variable `CLOUDFLARE_ACCOUNT_ID`.

The tokens are created by the founding maintainer, not tied to one person's account where
Cloudflare allows (028 FR-009), and recorded in `.github/repository-settings.md` (FR-042).

**What it could still reach**: Cloudflare doesn't let a token be limited to some Workers or
some databases (spec Assumptions). So the deploy token could also deploy production's Workers,
write to production's databases and change routes in the zone. Defences:
- only runs on `develop` get it (environment branch policy);
- only the workflow's two Wrangler steps see it;
- every Wrangler command names `--env sandbox-<team>`;
- R8's check fails before those steps when a sandbox block names a production resource.

That is the same trust as `develop` itself, whose content reaches production at the next
release anyway. Production's token stays in `production` and `production-europe`, `main` only.

## R12. Showing it isn't the real app

**Decision**: In sandbox mode, the wrapper adds a fixed bar to every HTML page with
`HTMLRewriter`: "Sandbox · not the real app · <first 7 characters of SANDBOX_COMMIT>", linking to
the commit on GitHub. It is English and in `dev/`, like the `/_dev/` pages, so it needs no catalog
entry (FR-003). Local fake mode is unchanged.
