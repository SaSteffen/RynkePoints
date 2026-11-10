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

**Decision**: Every deployment rebuilds the sandbox's database (FR-016), and no request ever
seeds. The script `scripts/sandbox-seed.sh` does it in three phases, and only the
last touches Cloudflare:

1. **Seed at the base's version, locally.** The base is `main` for a release and `develop` for a
   pull request into it (FR-016); below, `main` stands for either. In a second checkout of
   `main` (`git worktree`), start
   the team's e2e fake-mode server against a fresh local database with `main`'s migrations (as
   `pnpm test:e2e:server` does), request one page so it seeds the sample riders with `main`'s
   code, stop it, and export the database with `wrangler d1 export --local` to `base.sql`. If
   `main` doesn't know the team yet (a new team), seed with the release's own checkout instead;
   then no migration is pending.
2. **Try the release's migrations, locally.** Import `base.sql` into another fresh local database
   and run `wrangler d1 migrations apply DB --local` from the release's checkout. A failing
   migration stops the job here, before the sandbox is touched (US6 scenario 2).
3. **Rebuild the sandbox.** After the usage check (R7): drop every table and view of the sandbox
   database (names from `sqlite_master`, leaving `sqlite_*` and `_cf_*`, with
   `PRAGMA defer_foreign_keys = on`), import `base.sql` with `wrangler d1 execute --remote
   --file`, then `wrangler d1 migrations apply DB --remote` runs the release's pending
   migrations against the seeded rows, then the code is deployed.

In sandbox mode, `seedIfNeeded` doesn't run, and `POST /_dev/reset` answers that deploying again
resets the sandbox.

**Rationale**:
- The Free plan gives a Worker 10 ms of CPU per request. Seeding connects every sample rider
  through the app's own flow and imports their rides, far more than that, so seeding runs on
  CI's machine and reaches the sandbox as one import.
- Seeding at `main`'s version is what production holds when the release lands, so the release's
  migrations meet existing rows written by the code before them (US6 scenario 1). Seeding at the
  release's own version would run the migrations against an empty database and test nothing.
- Rebuilding every time means each deployment starts from the same known state, nothing changed
  by hand survives, and deploying again is the reset (FR-019).

**What it costs**: every deployment writes the whole seed: its rows plus index writes, counted
before writing (R7). Between the drop and the end of the import the sandbox is empty or
half-built; a failure there leaves it so until the next deployment, and the message says so.

**Verified during implementation** (`scripts/sandbox-seed.sh`, Wrangler 4.158, 2026-11-10,
`develop` as the base, `rebuild` against a local stand-in only):
- `wrangler d1 export --local` has no `--persist-to`: it reads `.wrangler/state` next to the
  configuration it's given. The seed's database therefore lives in
  `.wrangler/sandbox/<team>/base/.wrangler/state`, beside a copy of the base's `wrangler.jsonc`,
  and the export names that copy with `--config`.
- Rides arrive through the queue after the first page has answered, and two of Hamburg's sample
  riders stay pending on purpose (a fake 503, a rider who must reconnect). The script waits until
  the riders' states and the ride count stop changing, about 25 seconds per team.
- The dump starts with `PRAGMA defer_foreign_keys=TRUE`, holds `d1_migrations` (so the migrations
  apply step sees only the change's own) and `sqlite_sequence`, nothing of `_cf_*`, and names
  neither `localhost` nor `127.0.0.1`.
- It imports into an empty database, and over the stand-in after the drop, twice in a row;
  a stray table and view left there are gone afterwards.
- Dropping must go children first: a parent dropped before its children makes the child's drop
  fail ("no such table: main.riders"), even with `defer_foreign_keys`. The order comes from each
  table's `REFERENCES`.
- A pending migration applies to the base's rows; a broken one stops `try-migrations` with its
  file name before anything else runs.
- A base without the team falls back to the change's own checkout.
- Measured seed, as the usage check counts it (`INSERT`s doubled): Hamburg 8,706 rows, Europe
  8,740, so one deployment of both is about 17,500 of the 40,000 daily sandbox budget (R7).

**Alternatives considered**:
- **Keeping the data between deployments**: the user chose a fresh state every time
  (Clarifications, 2026-11-10).
- **Deleting and recreating the database**: changes its ID, which lives in `wrangler.jsonc`, and
  needs a wider token.
- **Seeding through the queue in small messages**: fits the CPU limit but uses the queue for bulk
  data (FR-034) and many queue operations per deployment.

## R7. The usage check before writing

**Decision**: `scripts/sandbox-usage.mjs` runs before any write to Cloudflare. It calls
`fetchCloudflareUsage` from `src/usage/cloudflare.ts` (as `team-check` imports `src/` already),
with a read-only analytics token, and compares today's account-wide rows written, rows read and
queue operations with `CLOUDFLARE_LIMITS`. It fails, saying which figure and how far, if any is
above 50 %, or if the figures are unavailable (FR-033). It adds the
seed's estimated rows written (the dump's `INSERT` statements, doubled for index writes) to
today's figure before comparing. It also sums today's rows written to the sandbox databases
alone (the same query, by `databaseId`) and fails if that plus the seed would pass the daily
budget of 40,000 (FR-034). Counting what the databases wrote, not what deployments planned,
needs no record of its own and includes what people did in the sandboxes. The sample seed is
about 7,000 rows written per team (measured on the local fake-mode databases: about 4,400 rows,
plus index writes), so the budget allows about five deployments a day. Whether dropping the
tables counts as writes is not documented; the quickstart measures it on the first deployment. The threshold is a constant beside the script, so the Paid plan
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

## R9a. A page per sample rider (FR-051)

**Decision**: `GET /_dev/` lists the sample riders with their state, **Connect as** and a link
to `GET /_dev/riders/<athleteId>`. That page holds the forms that are now in each rider's
collapsed **Strava events** section (new ride, change a ride, delete a ride, sync a backlog) and
reads only that rider's rides for the ride choice. The forms post to `POST /_dev/events` as
before and come back to the rider's page.

**Rationale**: The overview read every sample rider's rides (one query per rider, 18 per team)
on every visit, only to fill the change and delete forms' ride choice, which most visits never
open. A rider's page reads one rider's rides, so both pages stay well within 10 ms of CPU, and
rows read drop too. It is the same locally.

**Alternatives considered**:
- **Typing the ride's ID instead of choosing it**: no reads, but the ID has to be looked up
  elsewhere first.
- **Keeping the overview and measuring its CPU in a sandbox**: a page that only fails at the
  limit is found late and fails there.

## R10. The workflow

**Decision**: A new reusable workflow `.github/workflows/sandbox.yml`, `workflow_call` (from
**Release PR** and from pull requests into `develop`, R13) and `workflow_dispatch` (FR-009). One job per chosen sandbox (`sandbox (<team>)`, matrix, fail-fast
off), each in its GitHub environment `sandbox-<team>`, whose deployment branch policy allows
`develop` only (FR-011). Concurrency `sandbox-<team>`, never cancelled, so one deployment at a
time (FR-017). Steps:

1. The commit: the pull request's head when called for a pull request (release or into
   `develop`), else `develop`'s head. Checkout of that commit, and of the base branch (`main` or
   `develop`) for seeding and for the checks' scripts.
2. Not older than live: the `deploy-gate` logic from `ci.yml`, moved into
   `.github/scripts/newer-than-live.sh` and used by both (FR-017). A skip posts a message.
3. Wait for the checks: `lint`, `typecheck` and `test` (unit and component tests) check runs
   on the commit, all `success`, polling every 30 s for at most 20 minutes. It doesn't wait
   for `e2e` or `commitlint`, and their result doesn't stop it (FR-015). If the commit has none (manual run
   without a release pull request), the job starts CI on `develop` with `gh workflow run` and
   waits for that. A failed or missing check stops the job (FR-015, Edge Cases).
4. `node scripts/team-check.mjs` (R8).
5. Seed at `main`'s version and try the release's migrations, both locally (R6 phases 1, 2).
6. The usage check, including the seed's rows (R7).
7. Rebuild the sandbox database: drop, import the seed (R6 phase 3).
8. `wrangler d1 migrations apply DB --remote --env sandbox-<team>` (the release's pending ones),
   then `wrangler deploy --env sandbox-<team> --var SANDBOX_COMMIT:<sha>`. The credential is only
   in the steps that write to Cloudflare, as in production's deploy.
9. A message on the release pull request (contracts/sandbox-workflow.md), on success and on
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
- only the sandbox workflows as they are on `develop` get it (environment branch policy;
  `pull_request_target` for pull requests, R13), for branches of this repository and senders
  with write access;
- only the workflow's steps that write to Cloudflare see it;
- every Wrangler command names `--env sandbox-<team>`;
- R8's check fails before those steps when a sandbox block names a production resource.

That is the same trust as write access to the repository, which every sender already has
(R13). Production's token stays in `production` and `production-europe`, `main` only.

## R12. Showing it isn't the real app

**Decision**: In sandbox mode, the wrapper adds a fixed bar to every HTML page with
`HTMLRewriter`: "Sandbox · not the real app · <first 7 characters of SANDBOX_COMMIT>", linking to
the commit on GitHub. It is English and in `dev/`, like the `/_dev/` pages, so it needs no catalog
entry (FR-003). Local fake mode is unchanged.

## R13. Pull requests into `develop`

**Decision**: A new workflow `.github/workflows/sandbox-pr.yml` on `pull_request_target`, types
`opened` and `edited`, branches `develop`. Because of `pull_request_target`, GitHub runs it as it
is on `develop` and in `develop`'s context, so the `sandbox-<team>` environments' branch policy
(`develop` only) releases the credential to it, and a pull request that changes the workflow
changes nothing until merged (FR-049).

- **The checkboxes**: a new `.github/pull_request_template.md` holds a section **Sandboxes** with
  `- [ ] Deploy to Hamburg's sandbox` and `- [ ] Deploy to Europe's sandbox` and the advice of
  FR-006. On `opened`, if the description lacks the section (a pull request opened by a tool),
  the workflow appends it.
- **A tick**: on `edited`, the workflow reads the description's ticked boxes. For each, it:
  - checks that the pull request's head is a branch of this repository and that the sender has
    write access, and stops with a message otherwise;
  - unticks the box (with `github.token`, whose edits start no workflow);
  - calls `sandbox.yml` with the head commit, the pull request's number and the base `develop`.
- **The base**: `sandbox.yml` gets an input `base` (`main` for **Release PR**, `develop` here)
  and seeds at that branch's head (R6 phase 1, FR-016).
- **No ordering check** for a pull request's commit (FR-017): it isn't on `develop`'s line. The
  per-sandbox concurrency group still keeps one deployment at a time.
- **The bar** names the source: `SANDBOX_SOURCE`, passed with `--var` like `SANDBOX_COMMIT`, is
  `PR #<n>`, `release #<n>` or `develop` (FR-050, R12).

**What runs with the credential**: the pull request's code is checked out and built
(`pnpm install`, `wrangler deploy`'s bundling), in a job that later gets the credential in the
steps that write to Cloudflare. A branch could add an install script that tampers with those
steps. That's why forks are excluded and the sender must have write access: anyone who can do
this can already push to the repository and open pull requests, so it adds no new group of
people. The checks of R8 and the usage check run from `develop`'s copy of the scripts (a
second checkout), not the branch's, so a branch can't switch them off. At stage 2 of spec
028, when more people have write access, this is to be weighed again; an environment approval
by the founding maintainer would be the next step.

**Alternatives considered**:
- **`pull_request` instead of `pull_request_target`**: runs the branch's own copy of the
  workflow, so a branch could change what runs with the credential, and the environment's
  `develop`-only policy would have to be loosened to every branch.
- **A label per sandbox**: one click too, but labels are easy to leave on and say nothing about
  when to skip; a tick that unticks itself works like a button.
- **Redeploying on every push while ticked**: deploys more than anyone looks at and uses the
  daily budget; ticking again is one click (spec US8 scenario 3).
