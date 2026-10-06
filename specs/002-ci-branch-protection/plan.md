# Implementation Plan: CI-Gated Pull Requests and Protected Branches

**Branch**: `002-ci-branch-protection` (amendment on `002-deploy-on-main`) | **Date**: 2026-10-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-ci-branch-protection/spec.md`,
including the amendment of 2026-10-06 (User Story 5, FR-023 – FR-036).

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

`main` (released) and `develop` (integration, default branch) become the only
long-lived branches. Each is protected by a GitHub **ruleset** with an empty bypass
list, so nobody can push to, force-push or delete either branch, the owner
included. The only way in is a pull request whose six required checks passed.

Two GitHub Actions workflows provide the checks:

- `ci.yml`: `lint`, `typecheck`, `test` (the project's own `pnpm` scripts) and
  `commit-messages` (commitlint over the PR's commits). The first three also run
  on pushes to both branches.
- `pr-policy.yml`: `pr-title` and `pr-source`.
  - `pr-title` runs commitlint on the squash commit header GitHub will create:
    the title plus ` (#<number>)` (R3).
  - `pr-source` allows only `develop` or `hotfix/*` to target `main`.

How each branch merges:

| Branch | Merge method | Up to date with base before merging |
|---|---|---|
| `develop` | squash for features; merge commit for `sync/*` back-merges | required |
| `main` | merge commit only | not required (research R7) |

The check jobs run with read-only permissions and no secrets, so fork PRs get the
same gate.

Rulesets and repository settings live on GitHub, not in code. They're committed as
JSON and Markdown with apply and verify commands. Applying them is a manual
maintainer step, done in the bootstrap order of research R11.

User Stories 1–4 are implemented and merged.

### Amendment: deploy on merge to `main` (User Story 5)

A merge into `main` publishes the app. `ci.yml` gets two more jobs that run only
for `main`, after `lint`, `typecheck` and `test` passed in the same run (R13):

- `deploy-gate` (no secrets): refuses to deploy a commit that is older than the
  one already live, e.g. on a re-run of an old run (R14).
- `deploy`, in the GitHub environment `production`: it applies pending D1
  migrations with `wrangler d1 migrations apply rynke-points --remote`, then
  publishes with `wrangler deploy` (R19, R20). A failed migration stops the job
  before the code is published.

How the requirements are met:

- **Credential (FR-031, FR-032)**: the Cloudflare token is a secret of the
  `production` environment. Its deployment-branch rule allows only `main`, so
  pull request runs, fork runs and other branches can't get it (R15). The token
  is an account-owned Cloudflare token with Workers Scripts Edit and D1 Edit
  only (R17).
- **One deploy at a time (FR-026)**: the existing workflow-level concurrency
  serialises all runs on `main` and never cancels a running one. The deploy job
  has its own concurrency group as well (R14).
- **Re-deploy (FR-030)**: `workflow_dispatch` re-runs checks and deploy on the
  tip of `main` (R16).
- **Records and failures (FR-027, FR-028)**: deployments are recorded by the
  environment. Failures show on the commit and reach the maintainer by GitHub's
  failed-run notification (R21).
- **Rollback (FR-034)**: `wrangler rollback`, or a revert through a hotfix,
  documented with its limits (R23).

The rulesets don't change. The deploy jobs aren't required checks, and no
existing job is renamed (R24).

## Technical Context

**Language/Version**: GitHub Actions workflow YAML and POSIX shell. The checks
run the existing TypeScript toolchain: Node 24 (`.nvmrc`), pnpm 10.34.5
(`packageManager`), TypeScript 7, Biome 2, Vitest 4 with
`@cloudflare/vitest-pool-workers`. The deploy uses wrangler 4.147.0 from the
lockfile.

**Primary Dependencies**:
- No new npm dependency. `@commitlint/cli`, `@commitlint/config-conventional`
  and `wrangler` are already dev dependencies.
- CI-only dependencies, pinned by commit SHA (R8): `actions/checkout`,
  `actions/setup-node`, `pnpm/action-setup`. The deploy adds no new action; in
  particular there's no `cloudflare/wrangler-action` (R19).
- External services for the deploy: Cloudflare API (Workers, D1) through
  wrangler, and the GitHub deployments API (read-only) in `deploy-gate`.

**Storage**: For the gate, N/A: configuration lives in `.github/` files and in
GitHub repository settings, rulesets and the `production` environment
([data-model.md](data-model.md)). The deploy applies the committed migrations
in `migrations/` to the production D1 database, forward-only (FR-035).

**Testing**: Red-green against the real gate and pipeline. The validation
scenarios V1–V16 (gate) and D1–D10 (deploy) in [quickstart.md](quickstart.md)
each break one rule and are expected to be rejected or skipped, then pass once
fixed. The existing `pnpm test` suite is what the `test` check runs. No new
Vitest tests (R12, R25).

**Target Platform**: GitHub (public repo `SaSteffen/RynkePoints`, personal
account, GitHub Free), `ubuntu-latest` runners. Production on Cloudflare Workers
with D1 and Queues (custom domain `trhh-rynke-coins.link`).

**Project Type**: Repository infrastructure (CI, branch policy, continuous
deployment) for the existing Workers web service.

**Performance Goals**:
- All required check results on a typical PR within 10 minutes (SC-003). The
  expected time is 2–4 minutes with parallel jobs and a warm pnpm cache (R8).
- Production runs a merged commit within 15 minutes (SC-008): checks take about
  2–4 minutes, the gate under 1, migrations plus deploy about 1–2.

**Constraints**:
- Free for public repositories (SC-007); environments and their secrets are
  free for public repos on GitHub Free (R15). Cloudflare free plan (Principle IV).
- Check jobs: no secrets, no production access (FR-017, FR-018), `contents: read`
  only (FR-019). Untrusted PR input only via `env:` (R4).
- The deploy runs only for `main` (push or dispatch). Only `deploy` reads a
  secret, and only on its two wrangler steps (R22). `deploy-gate` adds
  `deployments: read`. No job gets any write permission.
- Every job has a timeout (FR-015): `deploy-gate` 5 min, `deploy` 15 min.
- Migrations are forward-only and must keep the previous version working
  (FR-035, FR-036). That's a review rule (R20).

**Scale/Scope**:
- Two protected branches, two rulesets, two workflows, one composite action,
  six required checks.
- Two deploy jobs, one deployment environment, one deploy credential, one
  environment variable.
- Documentation updates: README ("Contributing" plus a new "Deploying" section),
  CLAUDE.md (deploy rules already updated with constitution 1.2.0; check that
  they match), `.github/rulesets/README.md` (unchanged), and
  `.github/repository-settings.md` (new sections for the `production`
  environment and the failure notification).
- 001 quickstart: steps 9 and 12 ("`pnpm run deploy`") get a pointer that
  later deploys happen by merging into `main`. The first deploy stays a manual
  part of the one-time production setup (R20).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Checked against constitution **1.2.0** (2026-10-06).

| Principle | Gate | Status |
|---|---|---|
| I. Privacy, no secrets in repo | The check jobs use no secrets. Tests use synthetic bindings from `vitest.config.ts`. Fork PRs get no secrets (`pull_request`, never `pull_request_target`). The deploy token lives only in GitHub's secret store as a `production` environment secret, which only `main` can unlock (R15). It is never committed and never printed (R22). The account ID is an environment variable, not committed (R18). | ✅ |
| I. "Production secrets live in Cloudflare secrets" | The Worker's runtime secrets stay in Cloudflare and the deploy never sets them (FR-029). The Cloudflare API token is a CI credential and can't live in Cloudflare, so it sits in GitHub's environment secrets. Principle I lists Cloudflare API tokens only under "MUST NOT be committed", which holds. | ✅ (wording gap, see below) |
| I. No real rider data | The checks run synthetic tests only. The deploy runs no queries. Migrations are schema only, and their output is file names (R22). | ✅ |
| I. EU storage | Unchanged. The deploy uses the existing EU-jurisdiction D1 database and creates no resources. | ✅ |
| II. Strava API citizenship | Neither CI nor the deploy calls Strava. The webhook subscription is never touched (FR-029). | ✅ n/a |
| III. Rider content | Not touched. | ✅ n/a |
| IV. Minimal dependencies | No runtime or npm dependency added. The deploy reuses wrangler from the lockfile and the existing SHA-pinned actions. No `wrangler-action` and no notifier action (R19, R21). | ✅ |
| IV. Free tier | GitHub Actions and environments are free for public repositories (R1, R15). Cloudflare free plan; a deploy adds no paid resources. | ✅ |
| V. Test-first | No Worker code. The red-green cycle runs on the real gate and pipeline via quickstart V1–V16 and D1–D10 (R12, R25). CI still enforces `pnpm test` on every PR and before every deploy. | ✅ justified (R12, R25) |
| Workflow: lint/typecheck/test must pass | Required checks on every PR, and `needs:` of the deploy on `main`. | ✅ |
| Workflow: production deployed only from `main`, after its checks, migrations forward-only before the code; re-deploy of `main` on demand; other branches break-glass only | The deploy is two jobs in `ci.yml`, run only for `refs/heads/main` after `lint`, `typecheck` and `test` passed (R13). The environment branch rule is the hard boundary: it allows only `main` (R15). Migrations run before `wrangler deploy` and a failure stops the job (R20). The re-deploy is a dispatch on `main` only (R16). A local deploy or `wrangler rollback` is documented as break-glass (R23). | ✅ |
| Workflow: secrets, resources, webhook subscription and D1 data other than through migrations stay manual | The workflow contains no `secret put`, no `d1 execute`, no resource creation and no Strava call (contract [deploy.md](contracts/deploy.md)). The token *could* do more than the workflow does: Workers Scripts Edit can write Worker secrets or delete the Worker, and D1 Edit applies to every database in the account. `wrangler deploy` also attaches the custom domain from `wrangler.jsonc`, which would create it if it doesn't exist yet (R17, R20). The guarantee rests on the workflow content, which changes only through checked PRs, plus the documented order: one-time setup first, credential second. | ⚠️ holds by workflow content, not by token scope |
| Governance: storage changes self-reviewed against Principle I *before being deployed* | Merging into `main` now deploys. The self-review moves to the release (or hotfix) PR into `main`, which is the last point before production. The README's deploying section and the release checklist in quickstart §8 say so. | ✅ |
| Language: English for code and docs | Workflows, job names, messages and docs are in English. No rider-facing text. | ✅ |

**FR-032 versus the platform**: Cloudflare scopes Workers and D1 permissions per
account, not per Worker or per database (R17). FR-032 ("MUST NOT be able to read
or change other projects … of the hosting account") is therefore only met if the
Cloudflare account contains nothing but RynkePoints.

- The plan recommends a dedicated account. Quickstart §7 asks the maintainer to
  confirm this before creating the token.
- If the account is shared, FR-032 is not met and the spec needs a deliberate
  exception. That's an open question for the maintainer, not something this plan
  can resolve.

**Post-design re-check (after Phase 1)**: passing, with the ⚠️ row and the
FR-032 caveat above.

- Spec deviations found during the US1–US4 design (FR-008 for `main`, the US4
  back-merge route; R7) were resolved earlier by amending the spec.
- The amendment's design adds no new principle violation.

**Possible constitution follow-ups**: neither is required by this plan.
- A PATCH that names "every change through a checked pull request" in
  Development Workflow.
- A PATCH to Principle I's secrets bullet, saying that CI deploy credentials
  live in GitHub's environment secrets, scoped to `main`.

## Project Structure

### Documentation (this feature)

```text
specs/002-ci-branch-protection/
├── plan.md              # This file
├── research.md          # Phase 0: R1–R12 (gate), R13–R25 (deploy)
├── data-model.md        # Phase 1: branches, checks, rulesets, settings, environment, deployments
├── quickstart.md        # Phase 1: bootstrap, V1–V16, deploy setup, D1–D10, re-deploy, rollback
├── contracts/
│   ├── required-checks.md   # job names ⇄ ruleset contexts, pr-source rule, deploy jobs not required
│   ├── rulesets.md          # ruleset JSON shape and invariants (unchanged by the amendment)
│   └── deploy.md            # deploy-gate + deploy: triggers, permissions, environment, steps, guarantees
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks); US1–US4 done, US5 to be added
```

### Source Code (repository root)

```text
.github/
├── actions/
│   └── setup/
│       └── action.yml       # composite: pnpm (packageManager) + Node (.nvmrc) + cache + frozen install (unchanged)
├── workflows/
│   ├── ci.yml               # lint, typecheck, test (PR + push main/develop + dispatch); commit-messages (PR);
│   │                        # NEW: workflow_dispatch trigger; deploy-gate, deploy (main only, environment production)
│   └── pr-policy.yml        # pr-title, pr-source (unchanged)
├── rulesets/
│   ├── main.json            # unchanged: 6 required checks, deploy jobs not required (R24)
│   ├── develop.json         # unchanged
│   └── README.md            # unchanged
└── repository-settings.md   # + "Environment production" (branch rule main, no admin bypass, secret, variable)
                             # + "Failure notifications" (Actions: e-mail, failed workflows only)
README.md                    # + "Deploying": merge to main deploys; migrations rule (FR-036);
                             #   re-deploy; rollback and its limits; local deploy = break-glass
CLAUDE.md                    # deploy rules already present (constitution 1.2.0); verify wording only
specs/001-strava-connect-webhook/quickstart.md   # steps 9 and 12: pointer to deploy-by-merge after setup
```

**Structure Decision**: Everything lives under `.github/`, which GitHub reads by
convention.

- The setup steps are shared through a local composite action, so the four
  `pnpm`-based check jobs and the deploy job can't drift apart.
- The deploy lives in `ci.yml` rather than a separate workflow file. Only a job
  in the same run can `needs:` the checks, and only the merge's own run has
  `GITHUB_REF = refs/heads/main` (R13).
- Biome already formats the JSON files under `.github/` (its `files.includes` is
  `**`). It doesn't handle YAML, so workflow syntax is validated by GitHub when
  the PR runs. The deploy jobs are first exercised for real after the release PR
  that carries them is merged into `main` (quickstart §8).
- `src/`, `test/`, `migrations/` and `wrangler.jsonc` are untouched. Contrary to
  the Cloudflare guide, `account_id` is not added to `wrangler.jsonc` (R18).

## Complexity Tracking

No unjustified constitution violations. Two points stay open; they come from
Cloudflare's token model, not from a design choice:

| Point | Why it stays | Simpler alternative rejected because |
|---|---|---|
| The token's power exceeds what the workflow does (Workers Scripts Edit, D1 Edit account-wide) | Cloudflare offers no per-Worker or per-database scope (R17) | Running the deploy locally only gives up FR-023, which is the point of the amendment |
| FR-032 holds only in a Cloudflare account dedicated to RynkePoints | Same as above | A per-resource token doesn't exist; a dedicated free account is the narrowest scope available |
