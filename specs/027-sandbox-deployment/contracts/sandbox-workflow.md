# Sandbox workflow

Research R7, R10, R11.

## Release PR (`.github/workflows/release-pr.yml`)

`workflow_dispatch` inputs, both `type: boolean`, `default: false`:

| Input | Description |
|---|---|
| `sandbox-hamburg` | Deploy to Hamburg's sandbox. Skip for docs, specs, tests, CI or tooling only. |
| `sandbox-europe` | Deploy to Europe's sandbox. Skip for docs, specs, tests, CI or tooling only. |

Behaviour:
- A release pull request is open: use it (no longer stops there).
- None open and `develop` is ahead of `main`: open it as today, with the guidance below the
  list of changes.
- `develop` isn't ahead: stop as today, deploy nothing (FR-008).
- Then, if any box is ticked, call `sandbox.yml` with the pull request's number, its head commit
  and the ticked teams.

The guidance (FR-006), as a section **Sandboxes** in the body and in `docs/sandboxes.md`:

> **Can be skipped**: only docs, specs, tests, CI or developer tooling changed, or the change
> was already seen working.
> **Worth deploying**: migrations; anything riders see; queue, webhook, cron or rule changes;
> team settings or team data; a large release; or when unsure.
> **Which sandbox**: the team that changed, or any one for changes shared by all teams.
> **What it can't show**: anything needing the real Strava: sign-in, real webhooks, rate limits.
> To deploy later, run **Sandbox** (Actions) on `develop`.

## Sandbox (`.github/workflows/sandbox.yml`)

Triggers:
- `workflow_call`, with the inputs `teams` (JSON list), `pr` (number) and `sha`;
- `workflow_dispatch`, with one boolean per sandbox. Its `pr` is the open release pull request,
  if any; its `sha` is that pull request's head, else `develop`'s head.

A run on any ref but `develop` stops before any job that has an environment (and GitHub withholds
the environment's secrets anyway).

Job `sandbox (<team>)`, one per team, `fail-fast: false`, environment `sandbox-<team>`
(URL `https://sandbox-<team>.trhh-rynke-coins.link`), concurrency `sandbox-<team>`, not cancelled,
`timeout-minutes: 60`. Permissions: `contents: read`, `checks: read`, `actions: write` (to start
CI), `pull-requests: write`, `deployments: write`.

| Step | Stops the job when |
|---|---|
| Checkout `sha` | — |
| Newer than live (`.github/scripts/newer-than-live.sh sandbox-<team>`) | an older commit than the live one: skip, message "newer commit already live" |
| Wait for `lint`, `typecheck`, `test`, `e2e` on `sha` (starting CI on `develop` if none exist) | any not `success`, or 40 minutes passed |
| `node scripts/team-check.mjs` | a rule fails |
| `node scripts/sandbox-usage.mjs [--seed-rows <n>]` | above 50 %, or figures unavailable |
| First deployment only: seed locally, export, import | any command fails |
| `wrangler d1 migrations apply DB --remote --env sandbox-<team>` | a migration fails: code not deployed |
| `wrangler deploy --env sandbox-<team> --var SANDBOX_COMMIT:<sha>` | deploy fails |
| Message (always, `if: always()`) | — |

Whether it is the first deployment: the sandbox database has no `d1_migrations` table
(`wrangler d1 execute --remote --command`). That read happens after the usage check.

## The message (FR-020)

One comment per sandbox per deployment, posted with `github.token`. Nothing secret: no token, no
account ID, no Access values.

Success:

```markdown
### Sandbox: Hamburg ✅
Deployed `abc1234` to https://sandbox-hamburg.trhh-rynke-coins.link
Migrations applied: `0042_add_x.sql`, `0043_add_y.sql` (or: none)
First deployment: seeded with the sample riders. (only then)
[Run](<run url>)
```

Failure:

```markdown
### Sandbox: Hamburg ❌
`abc1234` was not deployed: <step>, <reason in one line>.
The sandbox still runs `def5678`. (or: has no version yet)
[Run](<run url>)
```

When the head moved while the job ran: one more line, "`abc1234` is no longer the head of this
pull request." Without a pull request, the same text goes into the job summary.

## Usage check (`scripts/sandbox-usage.mjs`)

Env: `CLOUDFLARE_ANALYTICS_TOKEN`, `CLOUDFLARE_ANALYTICS_ACCOUNT_ID`. Calls
`fetchCloudflareUsage`, then a pure `sandboxUsageVerdict(result, seedRows)`:

| Input | Verdict |
|---|---|
| `unavailable` | stop: "Cloudflare's figures are unavailable (<reason>)" |
| today's `cf_d1_rows_written` + `seedRows`, `cf_d1_rows_read` or `cf_queue_operations` above 50 % of `CLOUDFLARE_LIMITS` | stop: "<figure> at <n> of <limit> today, above 50 %" |
| otherwise | go, printing each figure |

`seedRows` is the dump's `INSERT` count doubled. The threshold is `SANDBOX_USAGE_THRESHOLD = 0.5`
beside the verdict. Tested with Vitest for each row.

## Not in slice 1

No `sandbox-gate`, no control comment, no **Accept**, no **Deploy again** action, no
**Reset sandbox** workflow. Job names `sandbox (…)` and the workflow's are not required-check
contexts and must never be added to `.github/rulesets/*.json`.
