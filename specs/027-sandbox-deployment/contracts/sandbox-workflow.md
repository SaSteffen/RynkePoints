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

## Pull requests into `develop` (`.github/workflows/sandbox-pr.yml`)

Research R13. `pull_request_target`, types `opened` and `edited`, branches `develop`, so it always
runs as it is on `develop`.

`.github/pull_request_template.md` gets:

```markdown
## Sandboxes

- [ ] Deploy to Hamburg's sandbox
- [ ] Deploy to Europe's sandbox

<details><summary>When to skip</summary>
(the advice of FR-006)
</details>
```

| Event | Does |
|---|---|
| `opened`, description without the section | appends it |
| `opened` with the section, or `edited`: no box ticked | nothing |
| a box ticked, head from a fork | unticks it, message "Sandboxes take branches of this repository only" |
| a box ticked, sender without write access | unticks it, message saying so |
| a box ticked, otherwise | unticks it, calls `sandbox.yml` with `teams`, `pr`, `sha` = the head, `base: develop` |

A box ticked while opening the pull request counts like one ticked later. The untick uses
`github.token`, so it starts no further run.

## Sandbox (`.github/workflows/sandbox.yml`)

Triggers:
- `workflow_call`, with the inputs `teams` (JSON list), `pr` (number), `sha` and `base`
  (`main` from **Release PR**, `develop` from a pull request into it);
- `workflow_dispatch`, with one boolean per sandbox. Its `pr` is the open release pull request,
  if any; its `sha` is that pull request's head, else `develop`'s head; its `base` is `main`.

A run on any ref but `develop` stops before any job that has an environment (and GitHub withholds
the environment's secrets anyway).

Job `sandbox (<team>)`, one per team, `fail-fast: false`, environment `sandbox-<team>`
(URL `https://sandbox-<team>.trhh-rynke-coins.link`), concurrency `sandbox-<team>`, not cancelled,
`timeout-minutes: 60`. Permissions: `contents: read`, `checks: read`, `actions: write` (to start
CI), `pull-requests: write`, `deployments: write`.

| Step | Stops the job when |
|---|---|
| Checkout `sha` | — |
| Newer than live (`.github/scripts/newer-than-live.sh sandbox-<team>`), only when `sha` is on `develop` | an older commit than the live one: skip, message "newer commit already live" |
| Wait for `lint`, `typecheck`, `test` on `sha`, not `e2e` (starting CI on `develop` if none exist) | any not `success`, or 20 minutes passed |
| `node scripts/team-check.mjs`, from a checkout of `develop` against the deployed commit's `wrangler.jsonc` | a rule fails |
| Seed at `base`'s head locally, export `base.sql` (research R6 phase 1) | the seed fails |
| Try the commit's migrations on a local copy of `base.sql` (phase 2) | a migration fails: the sandbox isn't touched |
| `node scripts/sandbox-usage.mjs --seed-rows <n>` | above 50 %, figures unavailable, or the sandbox databases' rows written today plus `<n>` above 40,000 |
| Rebuild: drop the sandbox database's tables and views, import `base.sql` (phase 3) | any command fails: the sandbox is empty or half-built until the next deployment |
| `wrangler d1 migrations apply DB --remote --env sandbox-<team>` | a migration fails: code not deployed |
| `wrangler deploy --env sandbox-<team> --var SANDBOX_COMMIT:<sha> --var SANDBOX_SOURCE:<PR #n, release #n or develop>` | deploy fails |
| Message (always, `if: always()`) | — |

Every deployment rebuilds; there's no "first deployment" case and no data kept between
deployments (spec FR-016).

## The message (FR-020)

One comment per sandbox per deployment, posted with `github.token`. Nothing secret: no token, no
account ID, no Access values.

Success:

```markdown
### Sandbox: Hamburg ✅
Deployed `abc1234` to https://sandbox-hamburg.trhh-rynke-coins.link
Rebuilt with the sample riders as of `main` (`ghi9012`) (or `develop` for a pull request into it), then migrations applied:
`0042_add_x.sql`, `0043_add_y.sql` (or: no new migrations)
[Run](<run url>)
```

Failure:

```markdown
### Sandbox: Hamburg ❌
`abc1234` was not deployed: <step>, <reason in one line>.
The sandbox still runs `def5678` with its data. (or, after the rebuild started: The sandbox's
database is empty or half-built; deploy again to repair it.)
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

No `sandbox-gate`, no control comment, no **Accept**, no **Deploy again** action. There is
no **Reset sandbox** at all: deploying again resets. Job names `sandbox (…)` and the workflow's are not required-check
contexts and must never be added to `.github/rulesets/*.json`.
