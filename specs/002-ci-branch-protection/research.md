# Research: CI-Gated Pull Requests and Protected Branches

Phase 0 for [plan.md](plan.md). Each entry resolves an open point from the
Technical Context or the spec's checklist notes. GitHub capabilities were checked
against the GitHub REST and ruleset docs on 2026-10-06.

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
  | `pr-title` | `pr-policy.yml` | PR title piped into `pnpm commitlint` |
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
    `main` and `develop`. `commit-messages` runs only for `pull_request`.
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
    doesn't fall back to its commit subject.
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
    `typecheck` and `commit-messages`, 10 for `test`, 2 for the policy jobs.
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
  - Allow squash merging: on, with title = PR title and message = commit
    messages. Allow merge commits: on. Allow rebase merging: off.
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
