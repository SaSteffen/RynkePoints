# Quickstart: Release Sandboxes, slice 1

How to set the sandboxes up once, and how to check that slice 1 works. The setup steps are
manual and belong to the founding maintainer (FR-042, CLAUDE.md "Non-negotiables").

## One-time setup (per sandbox, `<team>` = `hamburg`, then `europe`)

1. Cloudflare resources:

   ```bash
   pnpm exec wrangler d1 create rynke-points-sandbox-<team> --jurisdiction=eu
   pnpm exec wrangler queues create rynke-points-sandbox-<team>-work
   ```

   Put the database ID into the `sandbox-<team>` block (contracts/sandbox-config.md).
2. Cloudflare Zero Trust (Free plan): one self-hosted Access application named
   "RynkePoints sandboxes", hosts `sandbox-hamburg.trhh-rynke-coins.link` and
   `sandbox-europe.trhh-rynke-coins.link`, one *Allow* policy listing the maintainers' e-mail
   addresses, login method one-time PIN, session 24 h. No *Bypass* or *Service Auth* policy. Copy
   its AUD tag and the team domain into both blocks' `ACCESS_AUD` and `ACCESS_TEAM_DOMAIN`.
3. Secrets (research R5):

   ```bash
   for s in STRAVA_CLIENT_ID STRAVA_CLIENT_SECRET STRAVA_WEBHOOK_VERIFY_TOKEN TOKEN_ENCRYPTION_KEY PUSH_VAPID_KEY; do
     pnpm exec wrangler secret put "$s" --env sandbox-<team>   # value from dev/fake.env
   done
   openssl rand -base64 32 | pnpm exec wrangler secret put SESSION_SIGNING_KEY --env sandbox-<team>
   openssl rand -hex 32    | pnpm exec wrangler secret put ADMIN_TOKEN --env sandbox-<team>
   ```

   The Worker doesn't exist before its first deploy; if `secret put` refuses, deploy once, let
   it fail at start-up, and set them then.
4. Cloudflare API tokens (research R11): the deploy token and the analytics token.
5. GitHub: environment `sandbox-<team>`, deployment branches `develop` only, no admin bypass,
   with `CLOUDFLARE_SANDBOX_API_TOKEN`, `CLOUDFLARE_ANALYTICS_TOKEN` and the variable
   `CLOUDFLARE_ACCOUNT_ID`. Recorded in `.github/repository-settings.md`.

## Checks

| # | Do | Expect | Covers |
|---|---|---|---|
| 1 | `pnpm test`, `pnpm lint`, `pnpm typecheck` | pass, including access-check, team-check and usage-verdict tests | FR-010, FR-012, FR-013, FR-033 |
| 2 | Actions → **Release PR**, no box ticked | pull request opens as today, with the **Sandboxes** section; nothing deploys | US1 scenarios 1, 2 |
| 3 | **Release PR** again with Hamburg ticked | uses the open pull request; `sandbox (hamburg)` waits for the checks, rebuilds the database, deploys; the message has the link and the commit | US1 scenarios 3–5, FR-008 |
| 4 | Open `https://sandbox-hamburg.trhh-rynke-coins.link` in a private window | Access's sign-in page; after the PIN, the app with the sandbox bar and commit; the fake sign-in lists only the sample riders | US1 scenario 6, US4 scenario 1, FR-003 |
| 5 | `curl -i` the sandbox host, and the same with a made-up `Cf-Access-Jwt-Assertion` | Access's redirect; with Access's application temporarily set to *Bypass* (then back), the Worker's `403 Sandbox: access required` | US4 scenarios 1, 2, SC-005 |
| 6 | On the sandbox: sign in as a sample rider, simulate a new ride on `/_dev/`, wait | the ride appears with its Rynke (the sandbox's queue consumed it) | FR-001, FR-002 |
| 7 | `/_dev/` → **Run the daily work** | runs; no usage record is written (admin view shows no new hourly row) | FR-032, FR-036 |
| 8 | Cloudflare dashboard → the sandbox Worker | no cron triggers, no `workers.dev` route, no preview URLs | FR-032, R2 |
| 9 | Change data in the sandbox, then deploy a release with a migration | the database is rebuilt: the change is gone, the sample riders are seeded at `main`'s version, the migration runs against them, then the code deploys | US6 scenarios 1, 6, FR-016 |
| 10 | Run **Sandbox** from a feature branch | the job doesn't run; the environment's secrets are withheld | US4 scenario 3 |
| 11 | Point the sandbox block's database ID at production's in a branch, run `node scripts/team-check.mjs` | fails naming the key | US4 scenario 4 |
| 12 | Run **Sandbox** with a temporarily lowered threshold (local change in a test branch, not merged) or an analytics token removed | stops before writing, saying why; the message says not deployed | US5 scenarios 1, 2 |
| 13 | Same as 3 for Europe | Europe's sandbox, English, Europe's coin; no Hamburg name or art | 026 FR-042, FR-023 |
| 14 | After a deployment, look at the seeded sandbox's riders and links | nothing points at `localhost:8797` | research R6 |
| 15 | Open a pull request into `develop` | its description has the **Sandboxes** checkboxes | US8 scenario 1 |
| 16 | Tick Hamburg's box | the box unticks, the head deploys after its checks, seeded at `develop`'s version; message on the pull request; the bar names the pull request | US8 scenario 2, FR-050 |
| 17 | Push again without ticking; then tick again | nothing deploys; then the new head deploys | US8 scenario 3 |
| 18 | In a branch, change `sandbox-pr.yml` to print something, open a pull request, tick a box | the output doesn't appear: `develop`'s copy ran | US8 scenario 5, FR-049 |
| 19 | A pull request from a fork (or a test account's fork) with a box ticked | nothing deploys; message says why | US8 scenario 4 |
| 20 | Tick a box on a pull request whose `e2e` is still running | deploys once `lint`, `typecheck` and `test` pass, without waiting for `e2e` | FR-015 |
| 21 | In the sandbox, open `/_dev/`, then a sample rider's page; then Workers → the sandbox Worker → Logs | the overview lists riders without rides; the rider's page has the event forms; no request near 10 ms of CPU | FR-051, FR-035 |
| 22 | After the first deployment, the admin view's or Cloudflare's rows written for the sandbox database | about 7,000 per deployment; note whether dropping the tables added writes, and adjust the estimate in R7 | FR-034, R7 |

Checks 2–19 run on the live sandboxes after the slice's release (no tasks for them).
