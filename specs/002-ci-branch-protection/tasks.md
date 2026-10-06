---
description: "Task list for CI-Gated Pull Requests and Protected Branches"
---

# Tasks: CI-Gated Pull Requests and Protected Branches

**Input**: Design documents from `/specs/002-ci-branch-protection/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: No Vitest tests. The feature ships no Worker code (research R12). Each
story uses red-green in two places:

- **Local dry-runs**: T007 and T015 run the commitlint commands and the
  `pr-source` rule on the developer machine. Inputs that should fail must fail;
  inputs that should pass must pass.
- **The real gate on GitHub**: Phase 8 runs quickstart scenarios V1–V16 after the
  maintainer has bootstrapped the branches and applied the rulesets.

**Organization**: Tasks are grouped by user story (spec.md US1–US4). All files ship
together in the bootstrap pull request (research R11), so the stories are
implemented in order but validated separately in Phase 8.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: the user story the task belongs to (US1–US4)

## Conventions used by every task

- Paths are relative to the repo root. Everything new lives under `.github/`.
  `src/`, `test/`, `migrations/` and `wrangler.jsonc` are not touched (plan.md).
- **No changes to `origin` or to GitHub settings from an implementation task.**
  Pushing, opening pull requests, editing repository settings and creating
  rulesets are manual maintainer steps (CLAUDE.md, quickstart.md). They're all in
  Phase 8 and run only when the maintainer runs them or explicitly asks. Read-only
  lookups (`git ls-remote`, `gh api` GET on public action repos) are fine.
- **Workflow YAML**: two-space indent (YAML forbids tabs). Biome doesn't check
  YAML, so review the indentation by hand.
- **JSON** under `.github/` is formatted by Biome (tabs). Run `pnpm format` after
  editing it. No comments in JSON.
- **Job names are an interface** (contracts/required-checks.md, data-model.md).
  Every job sets `name:` to exactly its context: `lint`, `typecheck`, `test`,
  `commit-messages`, `pr-title` or `pr-source`. A rename means updating both
  ruleset files in the same change.
- **Workflow-wide guarantees** (contracts/required-checks.md). These apply to
  every workflow task:
  - top-level `permissions: contents: read`, and no job widens it;
  - never `pull_request_target`, never `secrets.*`, no deploy and no `wrangler`
    command;
  - untrusted values (PR title, branch names, repo names, SHAs) reach `run:`
    only as shell variables set in `env:`, never as `${{ … }}` inside `run:`;
  - every third-party action is pinned to a full commit SHA with a
    `# vX.Y.Z` comment.
- **Commits**: every commit on this branch must follow Conventional Commits
  (`ci: …`, `docs: …`, `chore: …`). The bootstrap PR's own `commit-messages`
  check will lint all of them.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: make sure the bootstrap PR can start green, and pin the action
versions.

- [X] T001 Resolve the commit SHAs for the three third-party actions (research R8): `actions/checkout`, `actions/setup-node` and `pnpm/action-setup`.
  - For each one, find the latest release tag (`gh release view -R <owner>/<repo> --json tagName -q .tagName`).
  - Resolve that tag to its commit SHA. Use `git ls-remote https://github.com/<owner>/<repo> 'refs/tags/<tag>' 'refs/tags/<tag>^{}'` and take the `^{}` line if present, because annotated tags point to a tag object, not a commit.
  - Check that the release supports what this feature uses: `node-version-file` and `cache: pnpm` for setup-node, and reading the version from `packageManager` when `version` is omitted for pnpm/action-setup.
  - Note the three `uses: <owner>/<repo>@<40-char sha> # <tag>` lines for T003, T004, T006 and T014. Nothing is committed in this task.
- [X] T002 [P] Confirm the baseline the CI will see on this branch:
  - `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck` and `pnpm test` all exit 0;
  - `pnpm commitlint --from main --to HEAD --verbose` exits 0, so every commit already on `002-ci-branch-protection` passes `commitlint.config.js`.

  If anything fails, fix it before Phase 2. Otherwise the bootstrap PR starts red for reasons unrelated to this feature.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the shared setup that every `pnpm`-based job uses (contracts/required-checks.md, "Shared setup").

**⚠️ CRITICAL**: every job in Phases 3–5 except `pr-source` depends on this action.

- [X] T003 Create the composite action `.github/actions/setup/action.yml` (research R8):
  - `name: Setup`, a one-line `description`, `runs: using: composite`, no inputs;
  - step 1: `pnpm/action-setup` pinned from T001, **without** a `version` input, so the version comes from `"packageManager": "pnpm@10.34.5"` in `package.json`;
  - step 2: `actions/setup-node` pinned from T001 with `node-version-file: .nvmrc` and `cache: pnpm`. It must come after the pnpm step, because the pnpm cache needs `pnpm` on the PATH;
  - step 3: `run: pnpm install --frozen-lockfile` with `shell: bash` and step-level `env: LEFTHOOK: "0"`, so the `prepare` script doesn't install git hooks on the runner. `--frozen-lockfile` makes lockfile drift fail the job (FR-011, spec edge case).

  The action does **not** check out the code. A local action can only be used after `actions/checkout`, so every caller checks out first.

**Checkpoint**: the shared setup is ready, and the check workflows can be written.

---

## Phase 3: User Story 1 — Every change lands through a checked pull request (Priority: P1) 🎯 MVP

**Goal**: every PR into `main` or `develop` gets five separately reported checks: `lint`, `typecheck`, `test`, `commit-messages` and `pr-title`. Each runs the same command as locally (FR-010 to FR-016). The sixth check, `pr-source`, belongs to US3.

**Independent Test**: quickstart V5–V12, V15 and V16 (Phase 8, T026). A PR with a lint error, type error, failing test, bad commit message or bad title is red on exactly that check. Fixing it turns the check green.

- [X] T004 [US1] Create `.github/workflows/ci.yml` with `lint`, `typecheck` and `test` (contracts/required-checks.md, research R4/R8):
  - `name: CI`;
  - triggers: `on: pull_request: branches: [main, develop]` and `push: branches: [main, develop]` (FR-012, FR-013);
  - top-level `permissions: contents: read` (FR-019);
  - `concurrency: group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}` with `cancel-in-progress: ${{ github.event_name == 'pull_request' }}`, so outdated PR runs are cancelled but pushes to `main`/`develop` never are (FR-014);
  - three jobs, each on `runs-on: ubuntu-latest`. Each checks out with `actions/checkout` (pinned from T001), then runs `uses: ./.github/actions/setup`, then its command:
    - `lint`: `name: lint`, `timeout-minutes: 5`, `run: pnpm lint --reporter=github`. The GitHub reporter turns Biome findings into inline annotations (FR-016);
    - `typecheck`: `name: typecheck`, `timeout-minutes: 5`, `run: pnpm typecheck`;
    - `test`: `name: test`, `timeout-minutes: 10`, job-level `env: WRANGLER_SEND_METRICS: "false"`, `run: pnpm test`.

  No `secrets.*`, no deploy and no `wrangler` step (FR-017, FR-018).
- [X] T005 [US1] Add the `commit-messages` job to `.github/workflows/ci.yml` (FR-010 item 4). This edits the same file as T004, so do it after T004.
  - `name: commit-messages`, `timeout-minutes: 5`;
  - `if: github.event_name == 'pull_request'`, because there is no PR range on a push;
  - check out with `fetch-depth: 0`, so both the base and head SHAs exist locally, then `uses: ./.github/actions/setup`;
  - step `env:` with `BASE_SHA: ${{ github.event.pull_request.base.sha }}` and `HEAD_SHA: ${{ github.event.pull_request.head.sha }}`;
  - `run: pnpm commitlint --from "$BASE_SHA" --to "$HEAD_SHA" --verbose`.

  Use no merge-message special case. The `@commitlint/config-conventional` default ignores already skip `Merge pull request #…`, `Merge branch …` and `Merge remote-tracking branch …` (research R3). T007 confirms this.
- [X] T006 [P] [US1] Create `.github/workflows/pr-policy.yml` with the `pr-title` job (FR-010 item 5, research R4). This can run in parallel with T004/T005 because it's a different file.
  - `name: PR policy`;
  - `on: pull_request: types: [opened, edited, synchronize, reopened]` and `branches: [main, develop]`. A title edit then re-runs only this cheap workflow, not the test suite;
  - top-level `permissions: contents: read`, and the same `concurrency` block as `ci.yml`;
  - job `pr-title`: `name: pr-title`, `runs-on: ubuntu-latest`, `timeout-minutes: 5`. It checks out (pinned from T001), runs `uses: ./.github/actions/setup`, then a step with `env:` `PR_TITLE: ${{ github.event.pull_request.title }}` and `PR_NUMBER: ${{ github.event.pull_request.number }}`, and `run: printf '%s (#%s)\n' "$PR_TITLE" "$PR_NUMBER" | pnpm commitlint --verbose`.

  This lints the header GitHub will give the squash commit, so a title too long once ` (#N)` is appended fails here instead of landing on `develop` (contracts/required-checks.md "`pr-title` inputs", research R3). The title must never appear as `${{ … }}` inside `run:`, which would allow script injection (research R4). Leave room in this file for the `pr-source` job (T014).
- [X] T007 [US1] Local red-green dry-run of the commit-message and title commands. Nothing is committed. Run from the repo root:
  - red: `printf '%s\n' 'wip' | pnpm commitlint --verbose` exits non-zero (V9);
  - red, the T006 title form: `PR_TITLE='update stuff' PR_NUMBER=12 sh -c 'printf "%s (#%s)\n" "$PR_TITLE" "$PR_NUMBER"' | pnpm commitlint --verbose` exits non-zero (V10);
  - red, too long once the number is appended: the same command with `PR_TITLE="docs: $(printf 'a%.0s' $(seq 92))"` (98 characters, valid alone) and `PR_NUMBER=12` exits non-zero on `header-max-length`. Confirm the bare title alone (`printf '%s\n' "$PR_TITLE" | pnpm commitlint`) exits 0, which shows why the suffix matters;
  - green: the T006 title form with `PR_TITLE='ci: gate pull requests and protect main and develop'` and `PR_NUMBER=12` exits 0;
  - green, merge messages ignored: these three exit 0:
    - `printf '%s\n' 'Merge pull request #12 from SaSteffen/develop' | pnpm commitlint`
    - `printf '%s\n' "Merge remote-tracking branch 'origin/develop' into sync/example" | pnpm commitlint`
    - `printf '%s\n' "Merge branch 'develop' into sync/example" | pnpm commitlint`
  - green, the T005 range form: `pnpm commitlint --from "$(git merge-base main HEAD)" --to HEAD --verbose` exits 0.

  If a merge message is not ignored, stop and report it. That contradicts research R3 and needs a plan change, not a workaround in the workflow.
- [X] T008 [US1] Add a `## Contributing` section to `README.md`, before `## Project principles` (FR-021, SC-005). Write it for a new contributor who hasn't read the specs:
  - **Branch model**: `main` is the last released state, `develop` is the integration branch and the default.
  - **How to propose a change**: cut a branch from `develop` and open a PR into `develop`. The PR title must be a Conventional Commit, because it becomes the squash commit message, and the only part of it (the body is left blank, so the PR holds the details). GitHub appends ` (#<number>)`, and the whole header must stay within 100 characters, so keep titles to about 90. Features are squash-merged.
  - **What has to pass**: a list of the checks so far (`lint`, `typecheck`, `test`, `commit-messages`, `pr-title`), each with the local command it mirrors, using the commands in contracts/required-checks.md. Note that the local lefthook hooks run the same tools before each commit.
  - **Rerunning checks**: a failed check can be re-run from the PR's Checks tab without a new commit, for flaky or infrastructure failures (spec edge case).
  - **Fork PRs**: they get the same checks without secrets. First-time contributors wait for the maintainer to approve the run.

  Keep it short. T013, T016, T017 and T018 add the protection, release and hotfix parts to the same section.

**Checkpoint**: five of the six required checks exist and match the local commands.

---

## Phase 4: User Story 2 — Nobody can push directly to `main` or `develop` (Priority: P1)

**Goal**: the protection for both branches is written down in a form the maintainer can apply and verify (FR-004 to FR-009, FR-009b, FR-022). It takes effect when the maintainer applies it in Phase 8.

**Independent Test**: quickstart V1–V4 and V13 (Phase 8, T025). Direct push, force push, deletion and an admin merge of a red PR are all refused, including for the owner. The verification commands from T011 show empty diffs.

- [X] T009 [P] [US2] Create `.github/rulesets/develop.json` exactly in the shape of contracts/rulesets.md, as plain JSON without comments:
  - `"name": "protect-develop"`, `"target": "branch"`, `"enforcement": "active"`;
  - `"bypass_actors": []`. This must stay empty (FR-009); adding an entry needs a spec change first;
  - `"conditions": {"ref_name": {"include": ["refs/heads/develop"], "exclude": []}}`;
  - rules, in this order:
    - `{"type": "deletion"}`;
    - `{"type": "non_fast_forward"}`;
    - `pull_request` with `"allowed_merge_methods": ["squash", "merge"]`, `"required_approving_review_count": 0`, and `false` for `dismiss_stale_reviews_on_push`, `require_code_owner_review`, `require_last_push_approval` and `required_review_thread_resolution`;
    - `required_status_checks` with `"strict_required_status_checks_policy": true` (FR-008), `"do_not_enforce_on_create": false`, and `required_status_checks` listing the six contexts `lint`, `typecheck`, `test`, `commit-messages`, `pr-title` and `pr-source`, each with `"integration_id": 15368`, in that order.

  Run `pnpm format` afterwards so Biome formats the file.
- [X] T010 [P] [US2] Create `.github/rulesets/main.json`, identical to T009 except:
  - `"name": "protect-main"`;
  - `"include": ["refs/heads/main"]`;
  - `"allowed_merge_methods": ["merge"]`;
  - `"strict_required_status_checks_policy": false` (research R7: a strict `main` would mark every release PR after the first as out of date, and "Update branch" would be a forbidden push to `develop`).

  Run `pnpm format` afterwards.
- [X] T011 [US2] Create `.github/rulesets/README.md`, the maintainer's runbook for the two ruleset files (FR-022, research R10). It depends on T009 and T010. The commands target `SaSteffen/RynkePoints` and need `gh` authenticated as the owner, plus `jq`. Document:
  - **When to apply**: only after the bootstrap PR has been merged into `develop`, so the six checks exist (research R11 step 4). Applying earlier blocks the bootstrap PR on checks that never ran.
  - **Create**: `gh api --method POST repos/SaSteffen/RynkePoints/rulesets --input .github/rulesets/<branch>.json`, for each file.
  - **Look up the ID**: `gh api repos/SaSteffen/RynkePoints/rulesets --jq '.[] | select(.name == "protect-<branch>") | .id'`.
  - **Update**: `gh api --method PUT repos/SaSteffen/RynkePoints/rulesets/<id> --input .github/rulesets/<branch>.json`.
  - **Verify**: one copy-pasteable command per file. It fetches `repos/SaSteffen/RynkePoints/rulesets/<id>`, keeps only the keys the file sets (`name`, `target`, `enforcement`, `bypass_actors`, `conditions`, `rules`, and inside each rule only `type` and the `parameters` keys the file sets), sorts `rules` by `type`, and `diff`s the result against the file run through the same projection, with `jq -S`. GitHub adds extra fields to live rulesets (for example new `pull_request` parameters), so the projection must drop them. Otherwise the diff is never empty. State that an empty diff means the protection is as documented.
  - **Invariants** from contracts/rulesets.md, as a short checklist:
    - `bypass_actors` stays empty;
    - the six contexts equal the job names in `.github/workflows/`;
    - renaming a job means updating both files and re-applying them in the same PR;
    - `allowed_merge_methods` must be a subset of the merge methods enabled in `.github/repository-settings.md`.
  - **Why this is manual**: reading rulesets needs an admin-scoped token, which CI must not have (FR-017).
- [X] T012 [P] [US2] Create `.github/repository-settings.md`, the settings that live outside rulesets (research R9, data-model.md "Repository settings"). For each setting give its value, its UI path under **Settings**, the `gh` command that applies it, and a read-only `gh api … --jq` command that shows the current value:
  - **default branch `develop`** (FR-002): `gh repo edit SaSteffen/RynkePoints --default-branch develop`;
  - **merge buttons**: squash on, merge commits on, rebase off. `gh repo edit SaSteffen/RynkePoints --enable-squash-merge --enable-merge-commit --enable-rebase-merge=false`;
  - **squash commit title = PR title, message = blank** (research R5): `gh api --method PATCH repos/SaSteffen/RynkePoints -f squash_merge_commit_title=PR_TITLE -f squash_merge_commit_message=BLANK`. Explain in one sentence why the message is blank: a "commit messages" body prefixes each subject with `* `, which can push a valid subject over commitlint's 100-character body-line limit on `develop`;
  - **automatically delete head branches**: `gh repo edit SaSteffen/RynkePoints --delete-branch-on-merge`. Note that GitHub never deletes the default branch or a branch protected against deletion, so `develop` is safe;
  - **Actions workflow permissions**: read-only, and Actions may not create or approve PRs. `gh api --method PUT repos/SaSteffen/RynkePoints/actions/permissions/workflow -f default_workflow_permissions=read -F can_approve_pull_request_reviews=false`;
  - **fork PR approval**: keep GitHub's default, so first-time contributors need approval. Give the UI path (**Settings → Actions → General → Fork pull request workflows**). Give the read-only API call only if the endpoint is confirmed in the GitHub REST docs when the file is written; otherwise say "check in the UI".

  End with one combined verify command for the repository fields: `gh api repos/SaSteffen/RynkePoints --jq '{default_branch, allow_squash_merge, allow_merge_commit, allow_rebase_merge, squash_merge_commit_title, squash_merge_commit_message, delete_branch_on_merge}'`, and its expected output.
- [X] T013 [US2] Extend `## Contributing` in `README.md` (after T008, same file) with a "Protected branches" part:
  - nobody can push, force-push or delete `main` or `develop`, the owner included, and there is no bypass;
  - the only way in is a PR whose required checks passed;
  - PRs into `develop` must be up to date with `develop` ("Update branch");
  - link `.github/rulesets/README.md` and `.github/repository-settings.md` as the source of truth.

**Checkpoint**: both rulesets and all repository settings are reproducible from files in the repo.

---

## Phase 5: User Story 3 — Releasing `develop` to `main` (Priority: P2)

**Goal**: only `develop` (or `hotfix/*`) from this repository may target `main`, enforced by the sixth required check `pr-source` (FR-009a). Releases are merged with a merge commit (FR-009b), and the release flow is documented.

**Independent Test**: quickstart V14 and §4 (Phase 8, T027). A feature-branch PR into `main` is red on `pr-source`. A `develop` → `main` PR is green, offers only "Create a merge commit", and afterwards `git log origin/main..origin/develop` is empty.

- [X] T014 [US3] Add the `pr-source` job to `.github/workflows/pr-policy.yml` (after T006, same file; contracts/required-checks.md "`pr-source` rule", research R6):
  - `name: pr-source`, `runs-on: ubuntu-latest`, `timeout-minutes: 2`;
  - **no** checkout and no setup action;
  - one step with `env:` `BASE_REF: ${{ github.base_ref }}`, `HEAD_REF: ${{ github.head_ref }}`, `HEAD_REPO: ${{ github.event.pull_request.head.repo.full_name }}` and `THIS_REPO: ${{ github.repository }}`;
  - `run:` uses `shell: bash` and a single `case` statement over those variables, implementing exactly this table:
    - `BASE_REF` is not `main` → pass;
    - `HEAD_REPO` = `THIS_REPO` and `HEAD_REF` = `develop` → pass;
    - `HEAD_REPO` = `THIS_REPO` and `HEAD_REF` matches `hotfix/*` → pass;
    - anything else, including any fork → fail. Print `::error::Pull requests into main must come from develop or a hotfix/* branch of this repository.` and `exit 1`.

    On pass, echo a one-line reason (e.g. `Base is develop: no source restriction.`). The job always runs and never uses a job-level `if:`, so its result is never "skipped" (research R6).
- [X] T015 [US3] Local red-green dry-run of the T014 `run:` script. Nothing is committed. Copy the script body into a scratch file outside the repo, then run it with `bash` and these env values. The expected exit code is in brackets.
  - `BASE_REF=develop HEAD_REF=feature/x HEAD_REPO=someone/RynkePoints THIS_REPO=SaSteffen/RynkePoints` [0]
  - `BASE_REF=main HEAD_REF=develop HEAD_REPO=SaSteffen/RynkePoints THIS_REPO=SaSteffen/RynkePoints` [0]
  - `BASE_REF=main HEAD_REF=hotfix/typo HEAD_REPO=SaSteffen/RynkePoints THIS_REPO=SaSteffen/RynkePoints` [0]
  - `BASE_REF=main HEAD_REF=feature/x HEAD_REPO=SaSteffen/RynkePoints THIS_REPO=SaSteffen/RynkePoints` [1] (V14)
  - `BASE_REF=main HEAD_REF=sync/example HEAD_REPO=SaSteffen/RynkePoints THIS_REPO=SaSteffen/RynkePoints` [1]
  - `BASE_REF=main HEAD_REF=develop HEAD_REPO=someone/RynkePoints THIS_REPO=SaSteffen/RynkePoints` [1] (fork named `develop`)
  - `BASE_REF=main HEAD_REF='hotfix/$(touch pwned)' HEAD_REPO=SaSteffen/RynkePoints THIS_REPO=SaSteffen/RynkePoints` [0], and no file `pwned` is created (no injection).
- [X] T016 [US3] Extend `## Contributing` in `README.md` (after T013, same file) with a "Releasing" part:
  - open a PR from `develop` into `main`, e.g. `gh pr create --base main --head develop --title "chore: release"`;
  - the same six checks run, and `pr-source` allows only `develop` and `hotfix/*` as sources for `main`;
  - merge with **Create a merge commit**, the only method `main` allows;
  - `main` doesn't need to be up to date with `develop`, because the checks run on the merge result (FR-008, research R7);
  - after the merge, `main` has nothing `develop` lacks.

  Also add `pr-source` to the list of checks from T008.

**Checkpoint**: all six required checks exist, and the release path is enforced and documented.

---

## Phase 6: User Story 4 — Urgent fix to `main` (Priority: P3)

**Goal**: a documented and gated hotfix path (`hotfix/*` → `main`), plus a back-merge path (`sync/*` → `develop`), so nobody is tempted to bypass the rules (FR-009). `pr-source` already accepts `hotfix/*` (T014).

**Independent Test**: quickstart §5 (Phase 8, T028). Both PRs are gated by the six checks. Afterwards `git log origin/develop..origin/main --no-merges` is empty.

- [X] T017 [US4] Extend `## Contributing` in `README.md` (after T016, same file) with a "Hotfixes" part, following quickstart.md §5 and research R7a:
  1. Cut `hotfix/<short-name>` from `origin/main`, commit conventionally, and open a PR into `main`. Merge it with a merge commit once green.
  2. Carry the fix back to `develop`: cut `sync/<short-name>` from `origin/main`, run `git merge origin/develop` (keep the default merge message, which commitlint ignores), push it, and open a PR into `develop`. Merge it with **Create a merge commit**, not squash.
  3. Explain why there's no direct `main` → `develop` PR: "Update branch" on it would be a forbidden push to `main`.
  4. If a release PR is open, the back-merge re-runs its checks (US4-3).
  5. Note that no hotfix is possible before the first release has brought the workflows onto `main` (research R11 step 6).
- [X] T018 [US4] Add the working-branch naming table from data-model.md to the same README section (after T017, same file). It's short: kind, name pattern, cut from, PR target, merge method. The kinds are feature/fix, `hotfix/*`, `sync/*` and release.

**Checkpoint**: all four stories are implemented in files. Nothing has touched `origin` yet.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: agent guidance, consistency checks across the files, and a final local run.

- [X] T019 [P] Update `CLAUDE.md`:
  - Add a `## Branches and pull requests` section:
    - work on a branch cut from `develop` (or `hotfix/*` from `main`);
    - never push to `main` or `develop`, because the rulesets refuse it anyway;
    - every change reaches them through a PR whose title is a Conventional Commit;
    - pushing and `gh pr create` are outward-facing, so only do them when the user asks;
    - CI runs the same `pnpm lint`/`typecheck`/`test` and commitlint;
    - renaming a CI job means updating both `.github/rulesets/*.json` files in the same change.
  - In `## Non-negotiables`, add applying rulesets and repository settings (`.github/rulesets/README.md`, `.github/repository-settings.md`) to the list of manual steps the user runs or explicitly asks for.
- [X] T020 [P] Check that the contexts and job names match (contracts/required-checks.md, contracts/rulesets.md "Invariants"):
  - `jq -r '.rules[] | select(.type == "required_status_checks") | .parameters.required_status_checks[] | "\(.context) \(.integration_id)"' .github/rulesets/main.json` and the same for `develop.json` give identical output: the six contexts, each with `15368`;
  - the set of job `name:` values under `jobs:` in `.github/workflows/ci.yml` and `.github/workflows/pr-policy.yml` equals those six contexts, with no extra job;
  - `jq '.bypass_actors' .github/rulesets/*.json` prints `[]` twice.

  Fix any mismatch at its source.
- [X] T021 [P] Security review of `.github/`:
  - `grep -rnE 'pull_request_target|secrets\.|wrangler|deploy' .github/workflows .github/actions` finds nothing;
  - every `permissions:` block is `contents: read`;
  - every `uses:` for a third-party action has a 40-hex SHA and a `# vX.Y.Z` comment;
  - no `run:` block contains `${{` (all values come through `env:`; FR-017 to FR-020, research R4).

  If `actionlint` happens to be installed, run it on `.github/workflows/`. It's optional, and isn't added as a dependency (research R12).
- [X] T022 Final local run (after T019–T021):
  - `pnpm format`, `pnpm lint`, `pnpm typecheck` and `pnpm test` all green;
  - `pnpm commitlint --from "$(git merge-base main HEAD)" --to HEAD --verbose` green over all commits of this branch;
  - `git status` shows only the intended files: `.github/**`, `README.md`, `CLAUDE.md` and `specs/002-ci-branch-protection/tasks.md`.

  The branch is now ready for the maintainer's bootstrap (Phase 8).

---

## Phase 8: Rollout and Validation (Maintainer, Manual)

**Purpose**: switch the gate on and prove each story against the real GitHub gate (research R11, R12; quickstart.md). **Every task here changes `origin` or GitHub settings. The maintainer runs them, or asks for them explicitly. Never run them as a side effect of an implementation task.** Do them in this order.

- [X] T023 Bootstrap, following quickstart.md §1 (research R11 steps 1–3):
  1. `git push origin main`. This is the last direct push to `main`.
  2. `git push origin main:develop`.
  3. `gh repo edit --default-branch develop`.
  4. Push `002-ci-branch-protection` and open its PR into `develop` with the title `ci: gate pull requests and protect main and develop`.

  Expected:
  - the PR shows all six checks green (`lint`, `typecheck`, `test`, `commit-messages`, `pr-title`, `pr-source`);
  - all results arrive within 10 minutes of the push (SC-003). Note the actual duration;
  - every job finishes within its limit from contracts/required-checks.md. If one times out, change the limit in the workflow **and** in the contract, rather than letting them drift apart.

  Then squash-merge the PR.
- [X] T024 Apply the repository settings from `.github/repository-settings.md` and create both rulesets with `.github/rulesets/README.md`, following quickstart.md §2 (research R11 step 4). Run each verify command. Expected:
  - both ruleset diffs are empty;
  - the settings verify output matches;
  - **Settings → Rules → Rulesets** lists `protect-main` and `protect-develop` as *Active*, with no bypass list.
- [X] T025 [US2] Validation V1–V4 and V13 (quickstart.md §3), as the owner. Each must be rejected:
  - V1: a direct push to `main`;
  - V2: a direct push to `develop`;
  - V3: a force push to `develop`;
  - V4: deleting `develop`;
  - V13: merging a red PR. No bypass option is offered.
- [X] T026 [US1] Validation V5–V12, V15 and V16 (quickstart.md §3), each on a throwaway branch from `develop`:
  - V5: all six checks green, and **Squash and merge** is offered. After merging, `git log -1 --format=%B origin/develop` is just `<title> (#N)` with no body;
  - V6: a failing test turns `test` red;
  - V7: a Biome error turns `lint` red with an inline annotation;
  - V8: a type error turns `typecheck` red;
  - V9: a `--no-verify` commit with the message `wip` turns `commit-messages` red;
  - V10: changing the title to `update stuff`, then to a valid 98-character `docs: …` title, re-runs only `pr-title`, which turns red both times, then green again when the title is changed back;
  - V11: a fix commit re-runs the checks;
  - V12: an out-of-date PR into `develop` is blocked until **Update branch**;
  - V15: a fork PR gets the same six checks without secrets;
  - V16: two quick pushes cancel the first run.

  Merge V5 (and the fixed V6, if wanted). Close the rest unmerged.
- [X] T027 [US3] Validation V14 (quickstart.md §3): a PR from a feature branch into `main` turns `pr-source` red with the allowed-sources message. Close it. Then make the first release (quickstart.md §4, research R11 step 6):
  - open a `develop` → `main` PR;
  - all six checks go green, and only **Create a merge commit** is offered;
  - merge it;
  - `git log origin/main..origin/develop` is empty afterwards (US3-2).
- [X] T028 [US4] Validation of the hotfix and back-merge path (quickstart.md §5):
  - a `hotfix/example` PR into `main` is gated by the six checks and merged with a merge commit;
  - a `sync/example` branch (from `origin/main`, with `origin/develop` merged in) goes through a PR into `develop`, gated by the six checks and merged with a merge commit;
  - afterwards `git log origin/develop..origin/main --no-merges` is empty.
- [X] T029 Periodic check (quickstart.md §6, FR-022): re-run the verify commands from `.github/rulesets/README.md` and `.github/repository-settings.md`, and confirm every diff is empty. Repeat whenever the rulesets, job names or repository settings change.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies. T001 provides the SHAs for T003, T004, T006 and T014.
- **Foundational (Phase 2)**: T003 depends on T001 and blocks every `pnpm`-based job (T004, T005, T006).
- **US1 (Phase 3)**: depends on T003.
- **US2 (Phase 4)**: the ruleset files don't depend on US1 files, but they list all six contexts. So they're only **applied** (T024) once US1 **and** T014 (`pr-source`) are merged. Otherwise every PR blocks on a check that never reports.
- **US3 (Phase 5)**: T014 edits `pr-policy.yml` after T006.
- **US4 (Phase 6)**: documentation only. It relies on the `hotfix/*` arm of T014.
- **Polish (Phase 7)**: after all story phases.
- **Rollout (Phase 8)**: strictly in order T023 → T024 → T025/T026 → T027 → T028, as in research R11. A hotfix (T028) only works after the first release (T027) has brought the workflows onto `main`.

### Same-file chains (never parallel)

- `.github/workflows/ci.yml`: T004 → T005
- `.github/workflows/pr-policy.yml`: T006 → T014
- `README.md`: T008 → T013 → T016 → T017 → T018
- `.github/rulesets/README.md` (T011) after T009 and T010

### Within Each User Story

- Workflow or config file first, then its local dry-run (T007 after T005/T006, T015 after T014), then the README part.
- Real red-green against GitHub happens only in Phase 8.

### Parallel Opportunities

- T002 runs alongside T001.
- T006 (`pr-policy.yml`) runs alongside T004/T005 (`ci.yml`) once T003 is done.
- T009, T010 and T012 (three different files) run in parallel, and can start once T001 is done, because they don't use the setup action.
- T019, T020 and T021 run in parallel.

---

## Parallel Example: User Story 2

```bash
# All three files are independent:
Task: "Create .github/rulesets/develop.json (T009)"
Task: "Create .github/rulesets/main.json (T010)"
Task: "Create .github/repository-settings.md (T012)"
# Then, sequentially:
Task: "Create .github/rulesets/README.md with create/update/verify commands (T011)"
```

## Parallel Example: User Story 1

```bash
# After T003:
Task: "Create .github/workflows/ci.yml with lint, typecheck, test (T004), then commit-messages (T005)"
Task: "Create .github/workflows/pr-policy.yml with pr-title (T006)"
```

---

## Implementation Strategy

### MVP (US1 + US2, the two P1 stories, plus `pr-source`)

US1 alone is only advisory, and US2's rulesets require all six checks. So the
smallest useful increment is Phases 1–4 plus T014. That is:

1. T001–T003: setup and the shared action.
2. T004–T008: the checks (US1).
3. T009–T013: the rulesets and settings as files (US2).
4. T014–T015: `pr-source`. It's needed because the rulesets list it.
5. T019–T022: polish and the final local run.
6. Phase 8 T023–T026: bootstrap, apply, validate.

### Incremental Delivery

- **Option A, one bootstrap PR (recommended by research R11)**: do all of Phases 1–7 on `002-ci-branch-protection`, then Phase 8.
- **Option B, dogfooding**: bootstrap with Phases 1–5 code plus T008/T013, then add the US3/US4 README parts (T016–T018) and T019 in a follow-up PR into `develop`. That PR is itself already gated.

### Notes

- [P] tasks touch different files and have no unfinished dependencies.
- Commit after each task or logical group, with Conventional Commit messages.
  The bootstrap PR's `commit-messages` check covers all of them.
- Stop at any checkpoint to review the files. Nothing is enforced until Phase 8.
- Avoid renaming jobs after the rulesets have been applied, unless both ruleset
  files are updated and re-applied in the same change.
