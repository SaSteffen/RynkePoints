# Sandboxes

A sandbox is a copy of one team's app on the internet, for trying a change before riders get
it: Hamburg's at <https://sandbox-hamburg.trhh-rynke-coins.link>, Europe's at
<https://sandbox-europe.trhh-rynke-coins.link>. It runs in fake mode (feature 006): the
fake Strava, the sample riders and the `/_dev/` pages, never the real Strava and never real
rider data. A bar on every page says it's a sandbox and names the commit and where it came from
(`PR #12`, `release #34` or `develop`).

Only the maintainers get in. Cloudflare Access asks for an allowed e-mail address and sends a
one-time PIN; the Worker itself refuses any request without Access's token. A sandbox's sign-in
never counts for the real app.

The design is feature 027 ([spec](../specs/027-sandbox-deployment/spec.md),
[quickstart](../specs/027-sandbox-deployment/quickstart.md)).

## Choosing a sandbox

- **A pull request into `develop`**: tick *Deploy to Hamburg's sandbox* or *Deploy to Europe's
  sandbox* in its description. The box unticks itself and the pull request's head deploys,
  with the sample riders as of `develop`. Tick it again to deploy again, for example after a
  new push. Only branches of this repository and people with write access can deploy; for a
  fork, nothing deploys and a comment says why. GitHub's Actions policy `PRPolicy` lets the
  checkboxes run at all, for maintainers and admins
  ([repository settings](../.github/repository-settings.md#actions-policy-prpolicy-pull_request_target-for-sandbox-pr-maintainers-only)).
- **A release**: tick the sandboxes when running **Actions → Release PR**. The release pull
  request's head deploys, with the sample riders as of `main`, so its migrations run against
  the data production would have.
- **By hand**: **Actions → Sandbox → Run workflow** on `develop`, with the sandboxes ticked. It
  deploys the open release pull request's head, else `develop`'s head.

Either way a message follows on the pull request (or in the run's summary): deployed, with the
link and the migrations applied, or not deployed, with the reason and what the sandbox still
runs.

## When it's worth it

The advice only; nothing forces a sandbox.

- **Can be skipped**: only docs, specs, tests, CI or developer tooling changed, or the change
  was already seen working.
- **Worth deploying**: migrations; anything riders see; queue, webhook, cron or rule changes;
  team settings or team data; a large change; or when unsure.
- **Which sandbox**: the team that changed, or any one for changes shared by all teams.
- **What it can't show**: anything needing the real Strava: sign-in, real webhooks, rate
  limits.

## What a deployment does

1. Waits for `lint`, `typecheck` and `test` on the commit (not `e2e`), at most 20 minutes. A
   failed check stops it.
2. On `develop`'s line, refuses a commit older than the one already live. A pull request's
   commit has no such order.
3. Checks the commit's team data with `develop`'s `team-check`: no production name in a
   sandbox block.
4. Seeds the sample riders at the base (`develop` or `main`) on CI's machine and tries the
   commit's migrations on that copy. A failing migration stops it before the sandbox is
   touched.
5. Checks today's Cloudflare usage (below).
6. Rebuilds the sandbox's database from that seed, applies the migrations and deploys the code.

Every deployment rebuilds the data: whatever was done in the sandbox is gone, and deploying
again is the way to reset it. One deployment runs at a time per sandbox; a second waits.

## The daily budget

Sandboxes share the Cloudflare account, and its free allowance, with production. A deployment
stops before writing anything when any of today's account-wide figures (rows written, rows
read, queue operations) is above 50 % of the daily allowance, or when the figures can't be
read. The sandbox databases also have their own budget of 40,000 rows written a day, which
includes what people do in the sandboxes. A deployment writes about 7,000 rows, so that allows
about five a day.

Sandboxes have no cron. The daily work runs only from `/_dev/` → **Run the daily work**.

## Which commit is live

- The sandbox's bar names it, with a link to the commit.
- **Code → Deployments** (or the environment `sandbox-hamburg` / `sandbox-europe`) lists each
  deployment with its commit and outcome:

  ```bash
  gh api 'repos/SaSteffen/RynkePoints/deployments?environment=sandbox-hamburg&per_page=5' \
    --jq '.[] | "\(.created_at) \(.sha[0:7]) \(.description)"'
  ```

## Setting them up

A one-time manual step for the founding maintainer:
[quickstart, one-time setup](../specs/027-sandbox-deployment/quickstart.md#one-time-setup-per-sandbox-team--hamburg-then-europe).
`scripts/sandbox-secrets.sh` sets the sandbox Workers' secrets and
`scripts/sandbox-environments.sh` the GitHub environments; the settings themselves are recorded
in [.github/repository-settings.md](../.github/repository-settings.md#environments-sandbox-hamburg-and-sandbox-europe-develop-only-no-admin-bypass).
