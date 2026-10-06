# Contract: Deploy Jobs

The deploy consists of two jobs in `.github/workflows/ci.yml`, run after the
checks of the same run. This contract is what the workflow must guarantee. The
design decisions behind it are research R13–R23.

## Triggers

`ci.yml` keeps its triggers and gains one:

| Event | Filter | Checks run | Deploy jobs run |
|---|---|---|---|
| `pull_request` | base `main` or `develop` | all four `ci.yml` checks | no: skipped (`github.ref` is `refs/pull/<n>/merge`) |
| `push` | `develop` | `lint`, `typecheck`, `test` | no: skipped |
| `push` | `main` | `lint`, `typecheck`, `test` | yes, if the three checks passed |
| `workflow_dispatch` (new, no inputs) | any branch | `lint`, `typecheck`, `test` | only if the branch is `main` |

Never used: `workflow_run`, `pull_request_target`, `schedule`, or any dispatch
input that selects a commit or ref (R13, R16).

## Jobs

### `deploy-gate`

| Field | Value |
|---|---|
| `name` | `deploy-gate` |
| `needs` | `[lint, typecheck, test]` |
| `if` | `github.ref == 'refs/heads/main' && (github.event_name == 'push' \|\| github.event_name == 'workflow_dispatch')` (implicit `success()`) |
| `permissions` | `contents: read`, `deployments: read` |
| `environment` | none (no secrets) |
| `timeout-minutes` | 5 |
| output | `deploy`: `true` or `false` |

Steps:
1. `actions/checkout` (existing SHA pin) with `fetch-depth: 0` and
   `persist-credentials: false`.
2. Find the last successful `production` deployment with `gh api`
   (`GH_TOKEN: ${{ github.token }}`):
   - list `repos/<repo>/deployments?environment=production`, newest first;
   - the first deployment whose newest status is `success` is the live one.
3. Decide:

| Live deployment | Relation of `GITHUB_SHA` to it | `deploy` |
|---|---|---|
| none | — | `true` (first deploy) |
| same commit | equal | `true` (re-deploy, FR-030) |
| other commit | `GITHUB_SHA` is an ancestor of it (older) | `false`, with a `::notice::` naming the live commit |
| other commit | not an ancestor (newer) | `true` |
| — | any API or git error | job fails, nothing deploys |

`git merge-base --is-ancestor` exits 0 or 1; any other exit status is an error.

### `deploy`

| Field | Value |
|---|---|
| `name` | `deploy` |
| `needs` | `deploy-gate` |
| `if` | `needs.deploy-gate.outputs.deploy == 'true'` (implicit `success()`) |
| `environment` | `name: production`, `url: https://trhh-rynke-coins.link` |
| `concurrency` | `group: deploy-production`, `cancel-in-progress: false` |
| `permissions` | `contents: read` |
| `timeout-minutes` | 15 |
| env (job) | `WRANGLER_SEND_METRICS: "false"` |

Steps, in this order:

| # | Step | Secret/variable in its `env:` | Guarantee |
|---|---|---|---|
| 1 | `actions/checkout` (existing pin), `persist-credentials: false` | — | builds exactly `GITHUB_SHA` (FR-025) |
| 2 | `./.github/actions/setup` | — | pinned Node and pnpm, `--frozen-lockfile` (FR-011, FR-025); install scripts never see the token |
| 3 | `pnpm exec wrangler d1 migrations apply rynke-points --remote` | `CLOUDFLARE_API_TOKEN` (secret), `CLOUDFLARE_ACCOUNT_ID` (var) | applies pending migrations in order; non-zero exit on the first failure, which stops the job before step 4 (FR-035) |
| 4 | `pnpm exec wrangler deploy --message "<GITHUB_SHA> (run <GITHUB_RUN_ID>)"` | same | publishes code, assets and committed config; the previous version stays live if it fails (FR-028, FR-029) |

`wrangler deploy` is the last step. Nothing after it can mark a successful
publish as failed.

## Inputs read

| Name | Kind | Scope | Used by |
|---|---|---|---|
| `CLOUDFLARE_API_TOKEN` | environment **secret** | `production` only | `deploy` steps 3–4 |
| `CLOUDFLARE_ACCOUNT_ID` | environment **variable** | `production` only | `deploy` steps 3–4 |
| `github.token` | automatic | per job permissions | `deploy-gate` step 2 |

No repository-level secret or variable is read. The check jobs read none at all.

## Environment `production` (configured by the maintainer)

| Setting | Value |
|---|---|
| Deployment branches and tags | *Selected branches and tags*: branch rule `main`; no tag rules |
| Allow administrators to bypass configured protection rules | off |
| Required reviewers / wait timer | none |
| Secret | `CLOUDFLARE_API_TOKEN` |
| Variable | `CLOUDFLARE_ACCOUNT_ID` |

The environment must exist with this branch rule *before* the secret is stored
(R15).

## Guarantees

| Requirement | How |
|---|---|
| FR-023 deploy every passed `main` commit; nothing else deploys | `needs` and `if` on both jobs; environment branch rule `main` |
| FR-024 failed, cancelled or unfinished checks never deploy | `needs` skip propagation; implicit `success()` |
| FR-025 exactly the merged commit | checkout of `GITHUB_SHA` of a `push` or dispatch on `main`; frozen lockfile |
| FR-026 one at a time, never cancelled, never older after newer | workflow group `CI-refs/heads/main` without cancel; job group `deploy-production` without cancel; ancestry gate |
| FR-027 recorded with commit and outcome | GitHub deployment created by the `production` job; Cloudflare version message carries the SHA |
| FR-028 failure reported, maintainer notified, previous version stays | red run on the commit; failed deployment; GitHub failed-run notification; migrations-before-publish order |
| FR-029 only code, assets, committed config and migrations | the only Cloudflare commands are steps 3 and 4 |
| FR-030 re-deploy `main` only | `workflow_dispatch` without inputs; `if` on `refs/heads/main`; environment branch rule |
| FR-031 secret only for `main` | environment secret plus branch rule; step-level `env:`; forks get no secrets |
| FR-033 no secrets or rider data in logs | step-level secret, masking, no `set -x`, `env` dump, `whoami` or `d1 execute` |
| FR-035 migrations first, forward-only, stop on failure | step order; wrangler rolls back only the failing migration and exits non-zero |

## Forbidden in either job

- Any `secrets.*` outside `deploy` steps 3–4.
- `wrangler secret …`, `wrangler d1 execute`, `wrangler d1 create|delete`,
  `wrangler queues …`, `wrangler rollback`, `wrangler deploy --strict`, and any
  call to Strava.
- Write permissions of any kind for `GITHUB_TOKEN`.
- Untrusted event data in `run:` (there is none on `push` or dispatch, but the
  R4 rule of passing values only through `env:` still applies).
