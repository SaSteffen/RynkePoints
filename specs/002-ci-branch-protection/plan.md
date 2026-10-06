# Implementation Plan: CI-Gated Pull Requests and Protected Branches

**Branch**: `002-ci-branch-protection` | **Date**: 2026-10-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-ci-branch-protection/spec.md`

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

The workflows run with read-only permissions and no secrets, so fork PRs get the
same gate. They never deploy.

Rulesets and repository settings live on GitHub, not in code. They're committed as
JSON and Markdown with apply and verify commands. Applying them is a manual
maintainer step, done in the bootstrap order of research R11.

## Technical Context

**Language/Version**: GitHub Actions workflow YAML and POSIX shell. The checks
run the existing TypeScript toolchain: Node 24 (`.nvmrc`), pnpm 10.34.5
(`packageManager`), TypeScript 7, Biome 2, Vitest 4 with
`@cloudflare/vitest-pool-workers`.

**Primary Dependencies**:
- No new npm dependency. `@commitlint/cli` and `@commitlint/config-conventional`
  are already dev dependencies.
- New CI-only dependencies, pinned by commit SHA (R8): `actions/checkout`,
  `actions/setup-node`, `pnpm/action-setup`.

**Storage**: N/A. Configuration lives in `.github/` files and in GitHub repository
settings and rulesets ([data-model.md](data-model.md)).

**Testing**: Red-green against the real gate. The validation scenarios V1–V16 in
[quickstart.md](quickstart.md) each break one rule and are expected to be
rejected, then pass once fixed. The existing `pnpm test` suite is what the `test`
check runs. No new Vitest tests (R12).

**Target Platform**: GitHub (public repo `SaSteffen/RynkePoints`, personal
account, GitHub Free), `ubuntu-latest` runners.

**Project Type**: Repository infrastructure (CI and branch policy) for the
existing Workers web service.

**Performance Goals**: All required check results on a typical PR within
10 minutes (SC-003). The expected time is 2–4 minutes with parallel jobs and a
warm pnpm cache (R8).

**Constraints**:
- Free for public repositories (SC-007).
- No secrets, no production access, no deploys from CI (FR-017, FR-018).
- `contents: read` only (FR-019).
- Untrusted PR input only via `env:` (R4).
- Every job has a timeout (FR-015).

**Scale/Scope**:
- Two protected branches, two rulesets, two workflows, one composite action,
  six required checks.
- Documentation updates: README, CLAUDE.md, `.github/rulesets/README.md`,
  `.github/repository-settings.md`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status |
|---|---|---|
| I. Privacy, no secrets in repo | CI uses no secrets at all. Tests already use synthetic bindings from `vitest.config.ts`. Ruleset and settings files contain no tokens. Fork PRs get no secrets (`pull_request`, never `pull_request_target`). | ✅ |
| I. No real rider data | CI runs the existing synthetic test suite only. Nothing is fetched from production. | ✅ |
| II. Strava API citizenship | CI never calls Strava. The existing tests fail on any real host (001 R12). | ✅ n/a |
| III. Rider content | Not touched. | ✅ n/a |
| IV. Minimal dependencies | No runtime or npm dependency added. Three official or widely used Actions, SHA-pinned. No third-party PR-title action: commitlint is reused (R3). | ✅ |
| IV. Free tier | GitHub Actions is free for public repositories. Rulesets are available on GitHub Free for public repositories (R1). | ✅ |
| V. Test-first | No Worker code in this feature. The red-green cycle runs on the real gate via quickstart scenarios V1–V16 (R12). CI additionally enforces `pnpm test` on every PR, which strengthens Principle V for all later features. | ✅ justified (R12) |
| Workflow: lint/typecheck/test must pass | Now enforced server-side as required checks, not just by convention and local hooks. | ✅ |
| Workflow: deploys and production changes are manual | CI has no deploy step and no Cloudflare credentials. Rulesets and settings are applied by the maintainer (quickstart §1–2). | ✅ |
| Language: English for code and docs | Workflows, job names, messages and docs are in English. No rider-facing text. | ✅ |

**Post-design re-check (after Phase 1)**: still passing. The two spec deviations
found during design (FR-008 for `main`, the US4 back-merge route; R7) have since
been resolved by amending the spec (Clarifications, 2026-10-06).

A possible follow-up is a constitution PATCH that names "every change through a
checked pull request" in Development Workflow. It's not required by this plan.

## Project Structure

### Documentation (this feature)

```text
specs/002-ci-branch-protection/
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1: branches, checks, rulesets, settings
├── quickstart.md        # Phase 1: bootstrap + validation scenarios V1–V16
├── contracts/
│   ├── required-checks.md   # job names ⇄ ruleset contexts, pr-source rule
│   └── rulesets.md          # ruleset JSON shape and invariants
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
.github/
├── actions/
│   └── setup/
│       └── action.yml       # composite: pnpm (packageManager) + Node (.nvmrc) + cache + frozen install
├── workflows/
│   ├── ci.yml               # lint, typecheck, test (PR + push main/develop); commit-messages (PR)
│   └── pr-policy.yml        # pr-title, pr-source (PR opened/edited/synchronize/reopened)
├── rulesets/
│   ├── main.json            # protect-main: merge only, non-strict, 6 checks, no bypass
│   ├── develop.json         # protect-develop: squash+merge, strict, 6 checks, no bypass
│   └── README.md            # create / update / verify with gh api + jq
└── repository-settings.md   # default branch, merge buttons, auto-delete, Actions permissions
README.md                    # + "Contributing" section: branch model, PR-only, release/hotfix, checks
CLAUDE.md                    # + branch/PR rules for agents: never push main/develop, PR into develop
```

**Structure Decision**: Everything lives under `.github/`, which GitHub reads by
convention. The setup steps are shared through a local composite action, so the
four `pnpm`-based jobs can't drift apart.

- Biome already formats the JSON files under `.github/` (its `files.includes` is
  `**`). It doesn't handle YAML, so workflow syntax is validated by GitHub when
  the bootstrap PR runs (quickstart §1).
- `src/`, `test/`, `migrations/` and `wrangler.jsonc` are untouched.

## Complexity Tracking

No constitution violations.
