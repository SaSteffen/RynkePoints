# Research: CI-Gated Pull Requests and Protected Branches

Phase 0 for [plan.md](plan.md). Each entry resolves an open point from the
Technical Context or the spec's checklist notes. GitHub capabilities were checked
against the GitHub REST and ruleset docs on 2026-10-06.

R1–R12 cover User Stories 1–4 (the PR gate). R13–R25 cover the amendment, User
Story 5 (deploy on merge to `main`, FR-023 – FR-036); their sources are listed
at the end of this file.

## R1. Branch rulesets, not classic branch protection (FR-004 – FR-009)

- **Decision**: Protect `main` and `develop` with two repository **rulesets**
  (`target: branch`, `enforcement: active`, empty `bypass_actors`), one per branch.
  Each uses the rules `deletion`, `non_fast_forward`, `pull_request` and
  `required_status_checks`.
- **Rationale**:
  - Rulesets are available for public repositories on GitHub Free. With an empty
    bypass list they bind everyone, including the repository owner. Classic
    protection on a personal repository has no "include administrators" switch
    that holds for the owner in every path.
  - Rulesets support `allowed_merge_methods` **per ruleset**, which is what makes
    FR-009b enforceable per branch (R5).
  - A ruleset is plain JSON. It can be kept in the repository and applied or
    compared with `gh api` (FR-022, R10).
- **Not used**: the `update` rule ("Restrict updates"). It blocks every push by
  non-bypass actors, including the merge of a pull request, so it would make the
  branches unchangeable. The `pull_request` rule already rejects direct pushes.
- **Alternatives considered**:
  - Classic branch protection: no per-branch merge methods, weaker owner
    enforcement, and its settings can't be imported as a file. Rejected.
  - Both: double configuration with no gain. Rejected.

## R2. Pull request rule without required approvals (FR-006, Assumptions)

- **Decision**: `pull_request` with `required_approving_review_count: 0` and all
  review flags `false`. Only the PR route and the merge methods are enforced.
- **Rationale**: There is a single maintainer, and GitHub doesn't let an author
  approve their own pull request. Raising the count later is a one-field change in
  the ruleset JSON once a second maintainer exists.

## R3. Required checks and how they are bound (FR-007, FR-010)

- **Decision**: Six required checks. Each is a GitHub Actions job with a fixed
  `name`, bound in both rulesets by context **and** by `integration_id: 15368`
  (the GitHub Actions app):

  | Context | Workflow | What it runs |
  |---|---|---|
  | `lint` | `ci.yml` | `pnpm lint --reporter=github` |
  | `typecheck` | `ci.yml` | `pnpm typecheck` |
  | `test` | `ci.yml` | `pnpm test` |
  | `commit-messages` | `ci.yml` | `pnpm commitlint --from <base sha> --to <head sha>` |
  | `pr-title` | `pr-policy.yml` | `<PR title> (#<PR number>)` piped into `pnpm commitlint` |
  | `pr-source` | `pr-policy.yml` | source-branch rule for PRs into `main` (R6) |

  The exact contract is in [contracts/required-checks.md](contracts/required-checks.md).
- **Rationale**:
  - Separate jobs make each failure name itself on the pull request (FR-016).
    `--reporter=github` additionally turns Biome findings into inline annotations.
  - Binding by `integration_id` means a commit status with the same name, posted
    by anything other than GitHub Actions, can't satisfy the gate.
  - `pnpm lint/typecheck/test` are the exact commands from CLAUDE.md and the
    constitution, so CI and local results agree.
  - The commit-message check reuses `commitlint.config.js` and its
    `@commitlint/config-conventional` preset. That preset's default ignores
    already skip GitHub's `Merge pull request #…` and `Merge branch …` messages,
    so release and back-merge pull requests pass without special cases.
  - `pr-title` lints the header exactly as it will land on `develop`. GitHub
    appends ` (#<PR number>)` to the PR title when it squashes (R5), and the
    preset caps headers at 100 characters (`header-max-length`).
    - Linting the bare title would let a 95–100 character title pass. Its squash
      commit would then break that cap.
    - That commit can't be rewritten on the protected `develop`, so it would
      fail `commit-messages` on every later release pull request.
    - Linting the real header avoids a separate title-length rule that could
      drift from `commitlint.config.js`.
- **Fail-closed behaviour**: GitHub treats a required check that never reported as
  pending, so the merge stays blocked (spec edge case "checks that never report").
- **Alternatives considered**:
  - One job running everything: one red cross with no hint which part failed.
    Rejected (FR-016).
  - Third-party actions for conventional PR titles (e.g.
    `amannn/action-semantic-pull-request`): a second rule set that can drift from
    `commitlint.config.js`, plus another supply-chain dependency. Rejected.

## R4. Triggers, fork safety and permissions (FR-012, FR-013, FR-017 – FR-020)

- **Decision**:
  - `ci.yml` runs on `pull_request` (targeting `main` or `develop`) and on `push` to
    `main` (amended 2026-10-10: no longer on `push` to `develop`, see R13).
    `commit-messages` runs only for `pull_request`.
  - `pr-policy.yml` runs on `pull_request` with types `opened`, `edited`,
    `synchronize`, `reopened`. A title edit then re-runs only the cheap policy
    jobs, not the test suite.
  - Both workflows declare `permissions: contents: read` at the top level, and no
    job widens it.
  - `pull_request_target` is never used. Fork pull requests therefore run with a
    read-only token and no secrets, which the checks don't need anyway.
  - Untrusted strings (PR title, branch names) reach shell steps only through
    `env:` variables, never through `${{ }}` inside `run:`. This prevents script
    injection from a crafted title or branch name.
  - Repository setting: default workflow permissions `read`, and Actions may not
    create or approve pull requests (R9).
- **Rationale**: This is GitHub's own hardening guidance for public repositories.
  The checks need nothing beyond reading the code. The `pull_request` event checks
  out GitHub's test merge of head into base, so results reflect what would be
  merged.
- **Fork pull requests from first-time contributors** need a maintainer's click
  ("Approve and run") before workflows start. That's GitHub's default and is kept.
  Until then the required checks are missing, so the PR stays blocked.

## R5. Merge methods per branch (FR-009b, clarification 2026-10-06)

- **Decision**:
  - Repository settings allow **squash** and **merge commit** and disable rebase.
    The squash commit title is set to the **PR title**, so a single-commit PR
    doesn't fall back to its commit subject. GitHub appends ` (#<PR number>)`
    to it, which `pr-title` accounts for (R3).
  - The squash commit message (body) is set to **blank**, so the squash commit
    is exactly `<PR title> (#<PR number>)`. The `(#N)` links to the PR, which
    keeps the individual commits.
    - The alternative, "commit messages", lists each commit as `* <subject>`.
      A valid 99–100 character subject then becomes a 101–102 character body
      line, which breaks the preset's `body-max-line-length` (100). That commit
      can't be rewritten on the protected `develop`, so it would fail
      `commit-messages` on every later release PR.
    - "PR description" has the same problem with long Markdown lines, and the
      description is never linted.
  - `develop` ruleset: `allowed_merge_methods: ["squash", "merge"]`.
  - `main` ruleset: `allowed_merge_methods: ["merge"]`.
- **Why `develop` also allows `merge`**: back-merges into `develop` (R7) must be
  merge commits. A ruleset can't tell a feature PR from a back-merge PR, so
  squash-only for features is a documented convention, not a hard rule. A feature
  merged with a merge commit by mistake is harmless: every one of its commits has
  already passed `commit-messages`.
- **Rationale**: `main` only ever gets merge commits, so `develop`'s commits reach
  `main` with their SHAs intact. That shared history is what keeps release pull
  requests free of conflicts on already-released changes (FR-009b).
- **Alternatives considered**: squash-only on `develop`, with back-merges done by
  squashing. That duplicates hotfix commits under new SHAs and makes the next
  release re-apply them. Rejected.

## R6. Enforcing allowed source branches into `main` (FR-009a)

- **Decision**: The required check `pr-source` passes when any of these holds:
  - the base branch isn't `main`, or
  - the head repository is this repository **and** the head branch is `develop`
    or starts with `hotfix/`.

  Otherwise it fails with a message naming the allowed sources. The job always
  runs and passes trivially for other bases, rather than being skipped, so its
  result is never ambiguous.
- **Rationale**: Neither rulesets nor classic protection can restrict source
  branches. A required check is the standard way to add the rule.
  - The same-repository condition stops a fork from passing by naming its branch
    `develop`.
  - The logic is a single shell `case` statement fed only from `env:` variables (R4).
- **Hotfix naming**: `hotfix/<short-name>`, which settles the spec's open
  assumption.

## R7. Up-to-date requirement per branch (FR-008)

- **Decision**:
  - `develop` ruleset: `strict_required_status_checks_policy: true`.
  - `main` ruleset: `strict_required_status_checks_policy: false`.
- **Why `main` can't be strict**: under a merge-commit release flow, every
  `develop` → `main` merge creates a merge commit that exists only on `main`.
  - A strict `main` would then mark the next release PR "out of date" every time.
  - "Update branch" can't fix it, because that's a push to `develop`, which is
    blocked.
  - The only way out would be an extra back-merge pull request after every
    release. Without strict mode that release-sync PR isn't needed.
- **Why it's safe**: checks on a pull request run against GitHub's test merge of
  head into the *current* base (R4), and `main` only moves through pull requests.
  - A release PR is fully tested against the `main` it will merge into, unless
    another PR merged into `main` in between.
  - With one maintainer that means a hotfix merged while a release PR is open.
    Merging the hotfix back into `develop` (R7a) pushes a new commit to the release
    PR, which re-runs its checks.
- **Back-merge path (R7a)** after a hotfix:
  - Create `sync/<short-name>` from `main` and merge `origin/develop` into it
    locally (the merge message is ignored by commitlint).
  - Open a PR into `develop` and merge it with a merge commit.
  - The branch contains both tips, so it satisfies `develop`'s strict policy.
  - A direct `main` → `develop` PR is not used: `develop` is usually ahead, and
    "Update branch" on it would be a forbidden push to `main`.
- **Spec impact**: FR-008 and User Story 4 were amended to match this decision
  (spec Clarifications, 2026-10-06).

## R8. Reproducible toolchain in CI (FR-011, FR-014, FR-015, SC-003)

- **Decision**:
  - A local composite action `.github/actions/setup` does four things:
    1. `pnpm/action-setup`, with the version read from `packageManager` in
       `package.json`;
    2. `actions/setup-node` with `node-version-file: .nvmrc` and `cache: pnpm`;
    3. `pnpm install --frozen-lockfile`;
    4. sets `LEFTHOOK=0`, so `prepare` doesn't install git hooks on the runner.
  - Every job runs on `ubuntu-latest` with `timeout-minutes`: 5 each for `lint`,
    `typecheck`, `commit-messages` and `pr-title`, 10 for `test`, 2 for
    `pr-source`. `pr-title` runs the full setup action, including
    `pnpm install`, so it gets the same limit as the other install-based jobs
    rather than risking a timeout on a cold pnpm cache. `pr-source` needs no
    checkout or install.
  - Concurrency group: `<workflow>-<PR number or ref>`, with
    `cancel-in-progress` only for `pull_request` events. Pushes to `main` and
    `develop` are never cancelled.
  - `WRANGLER_SEND_METRICS=false` for the test job.
  - Third-party actions are pinned to full commit SHAs with a version comment.
    The SHAs are resolved when the workflows are written.
- **Rationale**:
  - `--frozen-lockfile` fails on lockfile drift (FR-011, edge case).
  - `.nvmrc` and `packageManager` are already the project's version pins.
  - Tests need no Cloudflare account (`vitest.config.ts` uses Miniflare and
    synthetic bindings), so CI needs no secrets at all (FR-017).
  - SHA pinning protects a public repository's CI from a moved tag.
- **Expected duration**: install ≈ 1 min with a warm pnpm cache. The jobs run in
  parallel, so a PR gets all results in ≈ 2–4 min, well under SC-003's 10 minutes.
- **Alternatives considered**:
  - Dependabot to keep the SHA pins fresh: out of scope (spec Assumptions); noted
    as a follow-up.
  - `biome ci`: same rules as `biome check`, but CLAUDE.md names `pnpm lint`.
    Parity with that command wins.

## R9. Repository settings outside rulesets (FR-002, R4, R5)

- **Decision**: The maintainer applies these once and records them in
  `.github/repository-settings.md`:
  - Default branch: `develop`.
  - Allow squash merging: on, with title = PR title and message = blank (R5). Allow merge commits: on. Allow rebase merging: off.
  - Automatically delete head branches: on. GitHub never deletes the default
    branch or a branch protected against deletion, so `develop` is safe.
  - Actions, workflow permissions: read repository contents only, and don't
    allow Actions to create or approve pull requests.
  - Actions, fork pull request approval: GitHub's default (first-time
    contributors need approval).
- **Rationale**: These live outside rulesets but affect the same flows. They're
  written down because they aren't stored in the code (FR-022).

## R10. Keeping protection reproducible and verifiable (FR-022)

- **Decision**:
  - The two rulesets are committed as `.github/rulesets/main.json` and
    `.github/rulesets/develop.json`, in the request-body format of
    `POST /repos/{owner}/{repo}/rulesets`.
  - `.github/rulesets/README.md` documents three things:
    - how to create them (`gh api --method POST … --input <file>`);
    - how to update them (`PUT …/rulesets/{id}`);
    - how to verify them: fetch the live ruleset, keep only the fields the file
      sets, and `diff` it against the file with `jq -S`. An empty diff means the
      protection is as documented.
- **Rationale**: Settings drift silently in a web UI. A committed file plus a
  one-command diff lets the maintainer prove that the protection matches the
  documentation.
- **Not automated in CI**: reading rulesets needs an admin-scoped token, which
  would be a repository secret. That contradicts FR-017 and R4. Verification stays
  a manual maintainer step, consistent with how deploys are treated.

## R11. Bootstrap order (FR-003, spec edge case "local history not yet published")

- **Decision**: The order matters. Each step depends on the one before:
  1. The maintainer pushes local `main` to `origin`. This is the last direct push
     to `main`.
  2. Create `develop` from `main` on `origin` (`git push origin main:develop`) and
     make it the default branch.
  3. Push `002-ci-branch-protection` and open a PR into `develop`. The workflows
     run from the PR's own merge ref, so the checks appear on this very PR.
     Squash-merge it once green.
  4. Apply the repository settings (R9) and create both rulesets (R10).
  5. Run the validation scenarios in [quickstart.md](quickstart.md).
  6. Open the first release PR, `develop` → `main`, and merge it with a merge
     commit. Until then `main` has no workflows: a `hotfix/` PR into `main` would
     show no checks and stay blocked. That's fail-closed, but it means no hotfix
     is possible before the first release.
- **Rationale**: Creating rulesets before step 3 would block the bootstrap PR on
  checks that had never run. Creating them after step 6 would leave a window where
  `main` is unprotected while `develop` already gets work.

## R12. How Principle V (test-first) applies here

- **Decision**: This feature ships no Worker code, so no Vitest tests. Its
  red-green cycle runs against the real gate, in
  [quickstart.md](quickstart.md):
  - **Red**: throwaway PRs that each break exactly one check, and pushes that
    must be refused, all fail first.
  - **Green**: the same PRs pass once fixed.
- **Rationale**:
  - The behaviour under test belongs to GitHub, not to this code base, so it can
    only be observed on GitHub.
  - Re-implementing the `pr-source` rule as a TypeScript module, just to unit-test
    a four-branch `case` statement, would add a Node entry point next to a
    Workers-only test setup. That's more moving parts than the rule itself
    (Principle IV).
- **Alternatives considered**: `actionlint` as an extra CI job. It catches
  workflow syntax errors, but a broken workflow already fails closed (missing
  required checks). It's left as an optional follow-up.

## R13. Where the deploy runs: jobs in `ci.yml`, not `workflow_run` (FR-023, FR-024, FR-025)

- **Decision**: Two new jobs in `ci.yml`, after the checks of the same run:
  - `deploy-gate` with `needs: [lint, typecheck, test]` and
    `if: github.ref == 'refs/heads/main' && (github.event_name == 'push' || github.event_name == 'workflow_dispatch')`;
  - `deploy` with `needs: deploy-gate`, `environment: production`, and
    `if: needs.deploy-gate.outputs.deploy == 'true'`.

  A job-level `if:` without a status function gets an implicit `success()`, and
  "If a job fails or is skipped, all jobs that need it are skipped". So a commit
  whose `lint`, `typecheck` or `test` failed, was cancelled or timed out never
  reaches `deploy` (FR-024).
- **Why not `workflow_run`** (a separate `deploy.yml` that fires when `CI`
  completes on `main`): it can't work with this repository's branch model.
  - For `workflow_run`, GitHub sets `GITHUB_REF` to the *default branch* and
    `GITHUB_SHA` to the last commit on the default branch. The default branch is
    `develop` (FR-002), not `main`.
  - The environment's deployment-branch rule is "matched against the
    `GITHUB_REF` of the workflow run". A rule for `main` would therefore reject
    every `workflow_run` deploy, and a rule for `develop` would defeat FR-031.
  - The deployment record would name `develop`'s tip, not the deployed commit
    (FR-027), and the deploy logic would run from `develop`'s copy of the
    workflow file, i.e. unreleased code would control production.
  - The `branches` filter of `workflow_run` matches the triggering run's head
    branch. A fork pull request from a branch called `main` would match it, so
    the deploy would also need an `event == 'push'` guard.
- **Why not a separate `deploy.yml` on `push` to `main`**: it would run in
  parallel with `ci.yml` and couldn't `needs:` the checks of another workflow.
  It would have to re-run them (duplicate check runs) or poll for them.
- **Why not a reusable workflow** (`deploy.yml` with `on: workflow_call`, called
  from `ci.yml`): it gives the same guarantees, but adds indirection, prefixes
  the check names (`deploy / deploy`), and has its own secrets-inheritance rules.
  Two jobs are simpler. It stays an option if the deploy logic grows.
- **Consequences**:
  - The run is triggered by the merge itself, so `GITHUB_REF` is
    `refs/heads/main`, `GITHUB_SHA` is the merged commit, and the workflow file
    that runs is the one in that commit (FR-025).
  - Pull request runs skip both jobs (their `github.ref` is
    `refs/pull/<n>/merge`). Pushes to `develop` skip them too (FR-018, US5-4).
  - Only the three checks that FR-012 runs on pushes gate the deploy.
    `commit-messages`, `pr-title` and `pr-source` already passed on the pull
    request that created the commit.
- **Amendment (2026-10-10): don't re-run checks whose result is known** (FR-012,
  FR-024).
  - A job `already-checked` runs first on a push to `main`. It outputs
    `checked=true` only when all of these hold:
    - the commit is a merge with exactly two parents;
    - its tree equals that of its second parent, the merged branch's head;
    - the latest GitHub Actions `lint`, `typecheck` and `test` runs on that head
      concluded `success`.
  - `lint`, `typecheck` and `test` then skip (`if: !cancelled() && checked !=
    'true'`). The `!cancelled()` lets them run when `already-checked` is skipped
    (pull requests, dispatches) or failed.
  - `deploy-gate` runs with `!cancelled()` and requires either `checked == 'true'`
    or all three checks `success`. A cancelled, failed or wrongly skipped check
    therefore still blocks the deploy.
  - **Why the tree and not ancestry**: every release leaves a merge commit only on
    `main` (R7), so `develop` never contains the old `main`. The tree is the same
    whenever `main` holds nothing `develop` lacks, which is true for every release
    without an unmerged hotfix.
  - **Why it's safe**: the head's tree went through the checks. A `develop` commit
    is made by merging an up-to-date pull request (R7), whose test merge has
    exactly the head's tree. A hotfix branch cut from the current `main` is tested
    the same way. The head's check results are the ones the `main` ruleset
    accepted for the merge.
  - Pushes to `develop` no longer trigger `ci.yml`: by R7 their content already
    passed the checks, and nothing deploys from `develop`.

## R14. One deployment at a time, never older after newer (FR-026)

- **Decision**: three layers.
  1. **Workflow-level concurrency stays as it is.** `ci.yml`'s group is
     `CI-<PR number or ref>` with `cancel-in-progress` only for `pull_request`.
     Every push to `main`, manual re-deploy (R16) and re-run of a `main` run
     shares the group `CI-refs/heads/main`. At most one runs; at most one waits
     (`queue: single`, the default), and a newer arrival replaces the waiting
     one, which ends as *cancelled* and therefore never deploys (FR-024).
     A running deployment is never cancelled.
  2. **Job-level concurrency on `deploy`**: `group: deploy-production`,
     `cancel-in-progress: false`. It is redundant while (1) holds, and keeps
     FR-026 true if the workflow-level group is ever changed.
  3. **Ancestry gate in `deploy-gate`**: look up the commit of the last
     successful deployment to `production` (GitHub deployments API, with
     `deployments: read`). If it exists, differs from `GITHUB_SHA`, and
     `GITHUB_SHA` is an ancestor of it (`git merge-base --is-ancestor`), output
     `deploy=false` and log a notice ("a newer commit is already deployed").
     Otherwise output `deploy=true`. Any git or API error fails the job, so the
     gate fails closed.
- **Why the gate is needed**: concurrency alone doesn't order runs. GitHub
  documents the queue as FIFO by the time a run *starts waiting*, and says
  "ordering is not guaranteed". More practically, "Re-run all jobs" on an old,
  failed `main` run is one click; without the gate it would deploy that old
  commit over a newer one.
- **Why ancestry and not "is the tip of `main`"**: a tip check would skip a
  passed commit A whenever a newer commit B was merged while A's run was still
  going. If B then fails its checks, neither is deployed, which breaks FR-023.
  The ancestry check deploys A in that case and only refuses to go backwards.
- **Same commit again is allowed**: re-running or re-deploying the commit that
  is already live (R16, e.g. after a rotated secret) is deliberate and harmless.
- **Why the gate is a separate job**: a job that references `production`
  creates a GitHub deployment. If the skip were a step inside `deploy`, a skipped
  old commit would be recorded as a *successful* deployment, and the record would
  stop telling which commit runs (FR-027, SC-010).
- **Not used**: `queue: max` (keep up to 100 waiting runs). FR-026 allows
  skipping a waiting deployment in favour of a newer one, and deploying every
  intermediate commit in turn adds nothing.

## R15. GitHub environment `production` gates the credential and records deployments (FR-027, FR-030, FR-031)

- **Decision**: a GitHub deployment environment `production`, configured once by
  the maintainer:
  - **Deployment branches and tags**: *Selected branches and tags*, one branch
    rule `main`, no tag rule. REST:
    `deployment_branch_policy: {protected_branches: false, custom_branch_policies: true}`,
    then `POST …/environments/production/deployment-branch-policies` with
    `{"name": "main", "type": "branch"}`.
  - **Allow administrators to bypass configured protection rules**: off. The
    environment REST endpoint has no field for it (the request body takes only
    `wait_timer`, `prevent_self_review`, `reviewers`,
    `deployment_branch_policy`), so this is a UI step.
  - No required reviewers and no wait timer (spec Assumptions: the merge is the
    deliberate act).
  - **Environment secret** `CLOUDFLARE_API_TOKEN` (R17). **Environment variable**
    `CLOUDFLARE_ACCOUNT_ID` (R18). Neither is a repository-level secret or
    variable.
  - `environment.url`: `https://trhh-rynke-coins.link`, shown on the deployment.
- **How this enforces FR-031**:
  - Environment secrets "are only available to workflow jobs that use the
    environment", and "All deployment protection rules must pass before a job
    referencing the environment is sent to a runner."
  - The branch rule is matched against the run's `GITHUB_REF`. A pull request
    run has `refs/pull/<n>/merge`, a dispatch on another branch has that branch.
    Even if a pull request edits `ci.yml` to drop the `if:` guards, its `deploy`
    job is refused before it starts and never sees the secret.
  - Fork pull requests get no secrets at all (`pull_request`, R4).
  - The rule is for branches only, so a tag called `main` doesn't match.
  - The only code that can reach the secret is code on `main`, which arrived
    through a checked pull request (US1, US2).
- **Deployment records (FR-027, SC-010)**: a job that references an environment
  creates a GitHub deployment for the run's commit (the workflow syntax offers
  `deployment: false` to opt out). Its status follows the job (in progress,
  success, failure), and older successful ones become *inactive*. The
  repository's **Deployments → production** page then lists every deployment with
  commit, time, outcome and log link. Actions creates these records itself, so
  the job needs no `deployments: write`. Confirm this on the first deploy
  (quickstart D1).
- **Availability**: environments, environment secrets and deployment branch rules
  are available for public repositories on GitHub Free.
- **Ordering**: the environment, its branch rule and the admin-bypass switch
  must exist **before** the secret is stored. "Running a workflow that references
  an environment that does not exist will create an environment" without any
  protection rules. So the environment is created by hand first, never by a
  first run.

## R16. Manual re-deploy of `main` only (FR-030)

- **Decision**: add `workflow_dispatch` (no inputs) to `ci.yml`'s triggers. The
  maintainer re-deploys with **Actions → CI → Run workflow → Branch: `main`** or
  `gh workflow run ci.yml --ref main`.
- **Rationale**:
  - A dispatch on `main` runs `lint`, `typecheck` and `test` on the current tip,
    then the same gate and deploy jobs. The re-deploy is therefore also checked
    (FR-024); a red `main` can't be re-deployed.
  - There's no input for a commit or ref, and `GITHUB_SHA` of a dispatch is the
    tip of the dispatched branch. An older commit can't be chosen.
  - A dispatch on any other branch runs the checks only. The `if:` guards skip
    the deploy, and the environment's branch rule would refuse it anyway.
    Running checks on a branch is harmless.
  - The dispatch joins the `CI-refs/heads/main` concurrency group, so it queues
    behind a running deployment (R14).
- **Who can run it**: anyone with write access can dispatch. Today that's only
  the maintainer (spec Assumptions). A second maintainer would get the same right,
  which matches "merge is the release act".
- **Alternatives considered**:
  - A separate `redeploy.yml`: it would duplicate the checks or the deploy steps.
    Rejected.
  - Re-running the last `main` run: also works (the ancestry gate allows the same
    commit), but it re-uses the old run's workflow file and isn't available once
    the run's logs have expired. Documented as a fallback only.

## R17. Cloudflare API token: narrowest realistic scope (FR-032)

- **What the deploy calls**, checked against the Cloudflare API reference's
  "Accepted Permissions" for each endpoint and against wrangler 4.147.0:
  - upload and deploy the script and its static assets, set cron triggers,
    attach the queue consumer, attach the custom domain: each accepts
    **Workers Scripts Write**;
  - check that the queue exists: accepts Workers Scripts Read/Write or Queues
    Read/Write, so already covered;
  - `wrangler d1 migrations apply --remote` runs SQL through the D1 query
    endpoint: **D1 Read** or **D1 Write**. Applying migrations writes, so
    **D1 Write** ("D1 Edit" in the dashboard).
- **Decision**: an **account-owned API token** (Manage Account → API Tokens,
  prefix `cfat_`), so it doesn't depend on a personal user account. Settings:
  - permissions: *Account → Workers Scripts → Edit*, *Account → D1 → Edit*.
    Nothing else: no zone permission, no Account Settings, no User Details or
    Memberships (wrangler needs those only to discover the account ID, which
    R18 supplies);
  - account resources: only the RynkePoints account;
  - TTL: an expiry date, e.g. one year. Rotation is a documented manual step
    (quickstart §11);
  - Client IP filtering: not used. GitHub-hosted runners have no stable,
    narrow IP range.
- **Open point, checked on the first deploy**: the custom-domain endpoint lists
  only Workers Scripts Write, so no zone permission should be needed. If the
  first CI deploy fails with an authorization error on the custom domain, add
  *Zone → Workers Routes → Edit* restricted to the zone `trhh-rynke-coins.link`,
  and record that here.
- **What the scope can't do**: Cloudflare's Workers Scripts and D1 permissions
  apply to the whole account. A token can't be limited to one Worker script or
  one D1 database; resources are scoped by account or zone only. Within the
  account, the token could also change Worker secrets, delete the Worker or a
  database, or touch other Workers and databases.
  - FR-032 ("MUST NOT be able to read or change other projects") therefore holds
    only if the Cloudflare account holds nothing but this app. **Decision:** a
    dedicated Cloudflare account for RynkePoints (free plan, shared team
    e-mail; 001 quickstart step 1 already suggests a team account), confirmed
    by the maintainer. See the plan's Constitution Check.
  - That the deploy never changes secrets, resources or the webhook (FR-029)
    is guaranteed by the workflow's content, which only changes through checked
    pull requests, not by the token's permissions. The maintainer accepted this
    as a constitution exception (plan, Complexity Tracking).
- **Alternatives considered**: the dashboard template "Edit Cloudflare Workers",
  which Cloudflare's GitHub Actions guide uses. It adds Workers KV, R2, Tail,
  Workers Routes, Account Settings, User Details and Memberships, none of which
  this deploy needs. Rejected as broader than necessary.

## R18. Supplying the Cloudflare account ID

- **Decision**: `CLOUDFLARE_ACCOUNT_ID` is an **environment variable** of
  `production` (`vars.CLOUDFLARE_ACCOUNT_ID`), passed as `env:` to the wrangler
  steps.
- **Rationale**:
  - Wrangler states that "In a non-interactive environment, it is mandatory to
    specify an account ID". Without it, wrangler tries to discover the account
    via user and membership endpoints, which would need the extra token
    permissions R17 avoids.
  - The account ID is an identifier, not a credential. A variable can be read
    and checked in the settings, which a secret can't.
  - Keeping it out of `wrangler.jsonc` keeps the public repository free of
    account identifiers. Local deploys keep working through `wrangler login`.
- **Alternatives considered**:
  - `account_id` in `wrangler.jsonc`: it works, but publishes the ID and pins
    every contributor's local `wrangler` to that account. Rejected.
  - An environment secret, as Cloudflare's guide does: it would be masked in
    logs, but it can't be checked once set. Acceptable, not needed.

## R19. Plain `pnpm exec wrangler`, no `cloudflare/wrangler-action` (Principle IV, FR-025)

- **Decision**: the `deploy` job uses the existing composite action
  `.github/actions/setup` (pnpm, Node, `--frozen-lockfile`), then runs
  `pnpm exec wrangler d1 migrations apply rynke-points --remote` and
  `pnpm exec wrangler deploy`. No new action and no new SHA pin. The existing
  `actions/checkout` pin is reused, with `persist-credentials: false`.
- **Rationale**:
  - `wrangler` is already a pinned dev dependency (4.147.0 in the lockfile). CI
    deploys with exactly the version the tests and `pnpm run deploy` use
    (FR-011, FR-025).
  - Cloudflare's guide presents the action as one option ("Cloudflare provides an
    official action"). The only requirement is that the workflow runs
    `wrangler deploy`.
  - The action would add another third-party supply-chain dependency with access
    to the deploy token, and installs wrangler itself unless told otherwise.
    Principle IV asks for fewer moving parts.
- **Flags**:
  - `wrangler deploy --message "<sha> (run <run id>)"`. The Cloudflare
    version and deployment then name the commit, which helps when picking a
    rollback target (R23).
  - No `--strict`. Strict mode refuses to deploy if remote settings were changed
    in the dashboard. The spec's edge case "Configuration in the repository" says
    committed configuration wins, so overriding dashboard drift is intended.
  - `WRANGLER_SEND_METRICS=false`, as in the `test` job.

## R20. Migrations first, then code (FR-035, FR-036)

- **Decision**: in `deploy`, the step order is: checkout, setup,
  `wrangler d1 migrations apply rynke-points --remote`, then `wrangler deploy`.
  Each step stops the job on a non-zero exit, so a failed migration means the
  code is never published (FR-035).
- **Behaviour in CI**, from the wrangler D1 command reference and the wrangler
  4.147.0 source:
  - "When running the apply command in a CI/CD environment or another
    non-interactive command line … the confirmation step will be skipped, but the
    backup will still be captured". Wrangler detects CI through `ci-info`
    (`CI=true` on GitHub runners).
  - Migrations apply in file order. Applied ones are recorded in the
    `d1_migrations` table, so a second run is a no-op that prints "No migrations
    to apply!" Re-deploys are therefore safe (FR-030).
  - "If applying a migration results in an error, this migration will be rolled
    back, and the previous successful migration will remain applied." Wrangler
    then exits non-zero. Earlier migrations of the same run stay applied, which
    is the forward-only rule of the clarification.
  - Wrangler warns that the database "may not be available to serve requests
    during the migration". That's another reason for FR-036's small, additive
    migrations.
- **FR-036 (migrations keep the previous version working)** is a review rule,
  not an automated check. It's written down in CLAUDE.md, and the README's
  deploying section (plan) repeats it for contributors. Telling an additive
  migration from a breaking one would need SQL parsing. A heuristic
  "no `DROP`/`RENAME`" check is a possible follow-up, but it would miss most
  breaking changes and flag safe ones.
- **Database name, not binding**: Cloudflare recommends targeting the database
  by name because "the binding name can change, whereas the database name
  cannot".
- **Production not set up yet** (spec edge case): `wrangler.jsonc` carries a
  placeholder `database_id` until the maintainer commits the real one (001
  quickstart step 3). Against the placeholder, the migrations step fails before
  anything is published. Wrangler 4.147.0 also refuses to deploy a Worker that
  doesn't exist yet while required secrets are missing ("This Worker does not
  exist yet, so secrets cannot be set in advance"), and the queue binding fails
  if the queue doesn't exist. So a deploy before the one-time setup fails visibly.
  - Remaining gap: if the database, queue, secrets and Worker exist but the
    custom domain doesn't, `wrangler deploy` would attach it. The token can't
    prevent that, because domain attach needs only Workers Scripts Write.
  - The documented order is therefore: finish the 001 quickstart, including its
    first manual deploy (step 9), before creating the deploy credential (plan,
    quickstart §7).

## R21. Reporting and notifying failures (FR-028)

- **Decision**: rely on GitHub's own reporting; no extra notifier.
  - A failing `deploy` job marks the `CI` run on the `main` commit red, with the
    step log (FR-016-style output).
  - The `production` deployment for that commit shows *failure*.
  - GitHub notifies "when any workflow runs that you've triggered have
    completed". The run of a merge is triggered by whoever merged, which is the
    maintainer; a dispatch is triggered by the dispatcher. The maintainer sets
    **Settings → Notifications → System → Actions** to e-mail and "Only notify
    for failed workflows" (quickstart §7).
- **Previous version keeps running (FR-028, SC-011)**: a failed migration stops
  before `wrangler deploy`. `wrangler deploy` uploads a new version and switches
  traffic in one step; if it fails, the previous version stays active.
  `wrangler deploy` is the last step, so nothing after it can turn a successful
  publish into a red job.
- **Alternatives considered**: a mail or chat action, which needs another secret
  and another dependency (Principle IV). Not needed for one maintainer. Can be
  added if more maintainers join.

## R22. Keeping secrets and rider data out of logs (FR-033)

- **Decision**:
  - `CLOUDFLARE_API_TOKEN` is set as `env:` **on the two wrangler steps only**,
    not job-wide. `pnpm install` (which runs dependency lifecycle scripts such
    as `esbuild`'s and `workerd`'s) and checkout never see it.
  - GitHub masks registered secret values in logs. Nothing echoes the
    environment; there's no `set -x`, no `env` dump, and no `wrangler whoami`.
  - The deploy runs no `wrangler d1 execute` or other query. Migration output is
    file names and status icons only. Migrations themselves contain schema, never
    rider data (constitution Principle I, synthetic fixtures).
  - `actions/checkout` with `persist-credentials: false`, so the `GITHUB_TOKEN`
    isn't left in `.git/config` for later steps.
  - `deploy-gate` uses `GITHUB_TOKEN` with `contents: read` and
    `deployments: read` only. `deploy` keeps `contents: read`.
- **What wrangler prints**: bundle size, bindings (names, and the values of the
  committed `vars`, which are public in `wrangler.jsonc` anyway), the custom
  domain and the version ID. No secret values.

## R23. Rollback (FR-034)

- **Decision**: document two ways and their limits in the README's deploying
  section and quickstart §10.
  1. **Preferred, fix forward**: revert the change on a `hotfix/<name>` branch
     cut from `main`, merge it (US4); CI deploys it.
  2. **Immediate rollback, break-glass**: `pnpm wrangler rollback [<version-id>]
     --message "<reason>"`, or **Workers & Pages → rynke-points → Deployments →
     ⋯ → Rollback** in the dashboard. Without a version ID, wrangler rolls back to
     "the version uploaded before the latest version". The `--message` of R19
     shows which commit each version came from.
- **Limits that must be documented**:
  - A rollback doesn't touch data: "Resources connected to your Worker will not
    be changed during a rollback." Migrations stay applied, so the older code
    runs on the newer schema. FR-036 is what makes that safe.
  - It's only possible to "the 100 most recently published versions", and not
    if a bound resource (D1, queue) has since been deleted or modified.
  - A rollback is a manual production change that GitHub doesn't record, so the
    `production` environment keeps showing the rolled-back commit as active.
    The next merge into `main`, or a dispatch, deploys `main` again and replaces
    the rollback. If the problem isn't fixed by then, merge the revert first.
- **Why not a "rollback" dispatch input**: FR-030 forbids deploying an older
  commit through CI. Cloudflare's rollback re-activates an already built version
  and needs no rebuild.

## R24. Rulesets and required checks stay unchanged

- **Decision**: `.github/rulesets/main.json` and `develop.json` don't change.
  `deploy-gate` and `deploy` are **not** required checks.
- **Verification against the existing setup**:
  - Both rulesets list exactly the six contexts `lint`, `typecheck`, `test`,
    `commit-messages`, `pr-title`, `pr-source` (integration 15368). None is
    renamed by this amendment, so CLAUDE.md's rule ("Renaming a job means
    updating both `.github/rulesets/*.json` files") isn't triggered.
  - The new jobs never run on pull requests; they show as *skipped* there.
    Required checks gate merges, and a deploy happens only after the merge, so
    requiring a deploy job would gate nothing.
  - The new job names must not collide with the six contexts. That's a new
    invariant in [contracts/required-checks.md](contracts/required-checks.md).
- **Settings that do change**: the `production` environment and the Actions
  notification setting (R15, R21). They're recorded in
  `.github/repository-settings.md` next to the existing settings (FR-022 style),
  with apply and show commands.

## R25. How Principle V (test-first) applies to the deploy

- **Decision**: as in R12, there's no Worker code, so no Vitest tests. The
  red-green cycle runs on the real pipeline through the deploy scenarios D1–D10
  in [quickstart.md](quickstart.md). For example: a merge into `develop` must not
  deploy, a cancelled check run on `main` must not deploy, a re-run of an old run
  must be skipped by the gate, a dispatch on a feature branch must not deploy, and
  a pull request that strips the `if:` guards must be refused the environment.
- **The gate's shell logic** (R14) is a dozen lines of `gh api` and
  `git merge-base`. It's exercised by D8, a re-run of an older `main` run after a
  newer one deployed. Extracting it into a TypeScript module to unit-test it would
  add a Node entry point beside the Workers-only test setup (same reasoning as
  R12).
- **Tests never touch production**: the scenarios are deliberate maintainer
  actions on the real repository. `pnpm test` stays local and synthetic, and no
  test reads the deploy secret.

## Sources (amendment, checked 2026-10-06)

- GitHub, *Events that trigger workflows*, `workflow_run` and `workflow_dispatch`
  (`GITHUB_SHA`/`GITHUB_REF`, default-branch requirement, branch filters):
  <https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows>
- GitHub, *Deployments and environments* (branch rules matched against
  `GITHUB_REF`, availability on Free/public, admin bypass, secrets):
  <https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments>
- GitHub, *Managing environments for deployment* (bypass switch, auto-creation of
  missing environments, environment secrets and variables):
  <https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments>
- GitHub, *Control the concurrency of workflows and jobs* (`queue: single|max`,
  pending replacement, "ordering is not guaranteed"):
  <https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency>
- GitHub, *Workflow syntax* (`needs` skip propagation, `environment` name/url,
  `deployment: false`, job concurrency, `deployments` permission):
  <https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax>
- GitHub REST, *Deployment environments* and *Deployment branch policies*:
  <https://docs.github.com/en/rest/deployments/environments>,
  <https://docs.github.com/en/rest/deployments/branch-policies>
- GitHub, *Notifications for workflow runs*:
  <https://docs.github.com/en/actions/concepts/workflows-and-actions/notifications-for-workflow-runs>
- Cloudflare, *GitHub Actions* (token, account ID, wrangler-action optional):
  <https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/>
- Cloudflare, *API token permissions*, *Create API token*, *Account API tokens*:
  <https://developers.cloudflare.com/fundamentals/api/reference/permissions/>,
  <https://developers.cloudflare.com/fundamentals/api/get-started/create-token/>,
  <https://developers.cloudflare.com/fundamentals/api/get-started/account-owned-tokens/>
- Cloudflare API reference, "Accepted Permissions" of: Workers domains update,
  Queues consumers create, Queues list, Workers schedules update, D1 query:
  <https://developers.cloudflare.com/api/resources/workers/subresources/domains/methods/update/>,
  <https://developers.cloudflare.com/api/resources/queues/subresources/consumers/methods/create/>,
  <https://developers.cloudflare.com/api/resources/queues/methods/list/>,
  <https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/schedules/methods/update/>,
  <https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/>
- Cloudflare, *Wrangler D1 commands* (`migrations apply` in CI, rollback of a
  failed migration, backup) and *D1 migrations*:
  <https://developers.cloudflare.com/workers/wrangler/commands/d1/>,
  <https://developers.cloudflare.com/d1/reference/migrations/>
- Cloudflare, *Wrangler Workers commands* (`deploy --message/--strict`,
  `rollback`, `deployments`) and *Rollbacks*:
  <https://developers.cloudflare.com/workers/wrangler/commands/workers/>,
  <https://developers.cloudflare.com/workers/configuration/versions-and-deployments/rollbacks/>
- Cloudflare, *Custom Domains* (DNS record and certificate created on attach):
  <https://developers.cloudflare.com/workers/configuration/routing/custom-domains/>
- wrangler 4.147.0 source (`node_modules/wrangler/wrangler-dist/cli.js`): CI
  detection via `ci-info`, `migrations apply` failure handling, mandatory account
  ID in non-interactive mode, required-secrets check before the first deploy.
