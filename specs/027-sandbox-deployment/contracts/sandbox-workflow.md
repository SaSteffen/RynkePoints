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
- `workflow_call`, with the inputs `teams` (JSON list), `pr` (number) and `sha`;
- `workflow_dispatch`, with one boolean per sandbox. Its `pr` is the open release pull request,
  if any; its `sha` is that pull request's head, else `develop`'s head.

The bar's source is `release #n` when `pr`'s base branch is `main`, `PR #n` otherwise, and
`develop` without a pull request.

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
| Check for data (`scripts/sandbox-seed.sh is-empty <team>`, reads only): no `riders` table or no riders | the database can't be read |
| Only when empty: seed with the commit's own code locally, export `base.sql` (research R6 phase 1) | the seed fails |
| `node scripts/sandbox-usage.mjs --seed-rows <n>`, `<n>` the seed's rows or 0 | above 50 %, figures unavailable, or the sandbox databases' rows written today plus `<n>` above 40,000 |
| Only when empty: drop the sandbox database's tables and views, import `base.sql` | any command fails: empty or half-built; the next deployment seeds again |
| `wrangler d1 migrations apply DB --remote --env sandbox-<team>`, on the sandbox's data | a migration fails: code not deployed; **Sandbox reseed** repairs the data |
| `wrangler deploy --env sandbox-<team> --var SANDBOX_COMMIT:<sha> --var SANDBOX_SOURCE:<PR #n, release #n or develop>` | deploy fails |
| Message (always, `if: always()`) | — |

A deployment keeps the sandbox's data (spec FR-016); fresh sample riders come only from
**Sandbox reseed** (below), or from a deployment that finds no riders (a new sandbox). The
success message then says "The sandbox had no riders, so it was seeded with the sample riders."


## Sandbox reseed (`.github/workflows/sandbox-reseed.yml`)

Spec FR-019. `workflow_dispatch` only, on `develop`, never called from another workflow or
linked from a pull request. Inputs: `sandbox-hamburg`, `sandbox-europe` (booleans, default
`false`) and `base` (choice `develop` or `main`, default `develop`).

Job `reseed (<team>)`, one per ticked team, `fail-fast: false`, environment `sandbox-<team>`
(`deployment: false`), concurrency `sandbox-<team>` (shared with the deployments), not
cancelled, `timeout-minutes: 60`. Permissions: `contents: read`, `deployments: read`.

| Step | Stops the job when |
|---|---|
| Find the live commit (`.github/scripts/live-commit.sh sandbox-<team>`) | nothing deployed yet |
| Checkout the live commit and `base` | — |
| `node scripts/team-check.mjs` from `develop` against the live commit's `wrangler.jsonc` | a rule fails |
| Seed at `base`'s head locally, export `base.sql` (research R6 phase 1) | the seed fails |
| Try the live commit's migrations on a local copy of `base.sql` (phase 2) | a migration fails: the sandbox isn't touched |
| `node scripts/sandbox-usage.mjs --seed-rows <n>` | above 50 %, figures unavailable, or the sandbox databases' rows written today plus `<n>` above 40,000 |
| Rebuild: drop the sandbox database's tables and views, import `base.sql` (phase 3) | any command fails: the sandbox is empty or half-built until the next reseed |
| `wrangler d1 migrations apply DB --remote --env sandbox-<team>`, from the live commit | a migration fails |
| Summary (always): rebuilt with the base and its commit, the live commit, the migrations applied; or where it stopped and whether the sandbox was touched | — |

No code is deployed and no deployment recorded: the live commit stays live.

## The message (FR-020)

One comment per sandbox per deployment, posted with `github.token`. Nothing secret: no token, no
account ID, no Access values.

Success:

```markdown
### Sandbox: Hamburg ✅
Deployed `abc1234` to https://sandbox-hamburg.trhh-rynke-coins.link
The sandbox's data stays; migrations applied:
`0042_add_x.sql`, `0043_add_y.sql` (or: The sandbox's data stays; no new migrations.)
[Run](<run url>)
```

Failure:

```markdown
### Sandbox: Hamburg ❌
`abc1234` was not deployed: <step>, <reason in one line>.
The sandbox still runs `def5678` with its data. (or, when a migration failed: Part of the
migrations may have run on the sandbox's data, and it still runs `def5678`'s code; **Sandbox
reseed** (Actions) rebuilds the data. When the code deployment failed: The migrations ran on the
sandbox's data, but it still runs `def5678`'s code; deploy again to repair it.)
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

No `sandbox-gate`, no control comment, no **Accept**, no **Deploy again** action in slice 1;
slice 2 adds them (contracts/sandbox-gate.md), including `resolve` recording deployments as
`queued`. The reset is **Sandbox reseed**, not deploying again. Job names `sandbox (…)`,
`reseed (…)` and the workflows' are not required-check contexts and must never be added to
`.github/rulesets/*.json`.
