# Data Model: CI-Gated Pull Requests and Protected Branches

This feature adds no database tables. The "data" is repository configuration on
GitHub, files committed to the repository and, for User Story 5, the deployment
state on GitHub and Cloudflare. This page lists those entities, their fields and
the rules that link them. The decisions behind them are in
[research.md](research.md).

## Long-lived branch

| Name | Role | Default branch | Created from | Changed only by |
|---|---|---|---|---|
| `main` | last released state | no | existing | merge commit from a PR whose source is `develop` or `hotfix/*` |
| `develop` | integration | **yes** | `main` at bootstrap (R11) | squash merge of a working-branch PR, or merge commit of a `sync/*` PR |

Neither branch can be pushed to, force-pushed or deleted by anyone (R1).

## Working branch

| Kind | Name pattern | Cut from | PR target | Merge method |
|---|---|---|---|---|
| feature / fix | any, e.g. `003-points-rules`, `fix/…` | `develop` | `develop` | squash |
| hotfix | `hotfix/<short-name>` | `main` | `main` | merge commit |
| back-merge | `sync/<short-name>` | `main`, with `origin/develop` merged in locally | `develop` | merge commit |
| release | `develop` itself | — | `main` | merge commit |

Merged working branches are deleted automatically (R9). `develop` is exempt
because it is the default branch and is protected against deletion.

## Required check

One GitHub Actions job whose result on the PR's latest commit gates the merge.
See [contracts/required-checks.md](contracts/required-checks.md).

Fields:
- **context**: the job `name`, unique across workflows.
- **workflow**: the file under `.github/workflows/` that defines the job.
- **events**: which events run the job.
- **timeout**: in minutes.
- **source**: always the GitHub Actions app, `integration_id` 15368.

Rules:
- A context listed in a ruleset MUST match a job `name` exactly. Renaming a job is
  a breaking change: it requires updating both ruleset files and re-applying them
  in the same pull request.
- A required check that has not reported counts as not passed.

## Protection ruleset

One per long-lived branch, committed under `.github/rulesets/`. See
[contracts/rulesets.md](contracts/rulesets.md).

| Field | `main` | `develop` |
|---|---|---|
| `name` | `protect-main` | `protect-develop` |
| `conditions.ref_name.include` | `refs/heads/main` | `refs/heads/develop` |
| `bypass_actors` | `[]` | `[]` |
| `deletion`, `non_fast_forward` | on | on |
| `pull_request.allowed_merge_methods` | `["merge"]` | `["squash", "merge"]` |
| `pull_request.required_approving_review_count` | 0 | 0 |
| `required_status_checks` | all six (R3) | all six (R3) |
| `strict_required_status_checks_policy` | `false` (R7) | `true` |

## Repository settings

Not part of any ruleset. They're recorded in `.github/repository-settings.md`
(R9), along with the step that applies each one:

- default branch;
- allowed merge methods, and the squash commit title and message;
- automatic deletion of head branches;
- Actions workflow permissions;
- fork-PR approval;
- the `production` environment (below) and the maintainer's failure
  notification setting (R21), added for User Story 5.

## State transitions of a pull request

```text
opened ──► checks running ──► all required passed ──► mergeable ──► merged
               ▲    │                   │
               │    └► any failed / timed out ──► blocked
               │                        │
   new commit / title edit ◄────────────┘   (checks re-run; old results don't count)

develop target only: base moved on ──► out of date ──► "Update branch" ──► checks running
```

## Production environment (User Story 5)

A GitHub deployment environment. It is the boundary that releases the deploy
credential (research R15). See [contracts/deploy.md](contracts/deploy.md).

| Field | Value |
|---|---|
| name | `production` |
| deployment branch policy | custom: branch `main`; no tags; not "protected branches" |
| admins may bypass | no |
| required reviewers, wait timer | none |
| secret | `CLOUDFLARE_API_TOKEN` (deploy credential) |
| variable | `CLOUDFLARE_ACCOUNT_ID` |
| url | `https://trhh-rynke-coins.link` |

Rules:
- It is created and configured by the maintainer *before* the secret is added.
  A workflow run would create it without any rules.
- Only a job that references it, in a run whose `GITHUB_REF` is
  `refs/heads/main`, receives the secret.

## Deploy credential

| Field | Value |
|---|---|
| kind | Cloudflare account-owned API token (`cfat_…`) |
| permissions | Account · Workers Scripts · Edit; Account · D1 · Edit |
| resources | the RynkePoints Cloudflare account only (dedicated account recommended, R17) |
| expiry | set (e.g. one year); rotated manually |
| stored in | `production` environment secret only; never in the repo, `.dev.vars` or logs |

Rules:
- Its scope can't be narrowed below "all Workers and D1 databases of the
  account" (R17).
- Rotation: create a new token, replace the environment secret, revoke the old
  token, then dispatch a re-deploy to confirm (quickstart §11).

## Production deployment

One publication of a `main` commit. It exists on two platforms, linked by the
commit SHA.

| Field | GitHub deployment | Cloudflare Worker deployment |
|---|---|---|
| identity | deployment ID, environment `production` | version ID, deployment ID |
| commit | `sha` = `GITHUB_SHA` of the run | `--message "<sha> (run <id>)"` |
| created by | the `deploy` job (automatically) | `wrangler deploy` |
| outcome | status: `queued` → `in_progress` → `success` / `failure`; older successes become `inactive` | active version, or unchanged on failure |
| log | link to the Actions run | — |

Rules:
- At most one deployment is in progress (FR-026).
- A new deployment's commit is equal to or newer than the last successful one;
  never an ancestor of it (gate, R14).
- "Which commit runs in production" is the newest GitHub deployment in state
  `success` (SC-010). The exception is a manual `wrangler rollback`, which only
  Cloudflare records (R23); the next deployment from `main` ends it.

### State transitions

```text
merge into main ─► CI run (push) ─► lint/typecheck/test ─┬─ any not success ─► no deploy (run red or cancelled)
dispatch on main ─► CI run ───────►        "             │
                                                          └─ all success ─► deploy-gate
deploy-gate ─┬─ commit older than live ─► skipped (notice), nothing recorded
             ├─ error ─► gate red, nothing deployed
             └─ ok ─► deploy (environment production; waits if another deploy runs)
deploy ─► migrations ─┬─ fail ─► deployment failure; code not published; previous version live
                      └─ ok ─► wrangler deploy ─┬─ fail ─► deployment failure; previous version live
                                                └─ ok ─► deployment success; previous success → inactive
```

## Migration (User Story 5)

A committed SQL file in `migrations/` (`NNNN_<name>.sql`, e.g. `0001_init.sql`).

| Field | Value |
|---|---|
| order | numeric prefix, ascending |
| applied state | row in the production database's `d1_migrations` table, written by wrangler |
| direction | forward only; never rolled back by the deploy or by a Worker rollback |

Rules:
- The deploy applies every unapplied migration before publishing the code. A
  failing migration is rolled back by D1 on its own; earlier ones stay applied,
  and the code isn't published (FR-035).
- A migration must keep the previously deployed version working: add, don't
  rename or drop in the same release (FR-036). This is a review rule (R20).
