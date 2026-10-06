# Feature Specification: CI-Gated Pull Requests and Protected Branches

**Feature Branch**: `002-ci-branch-protection`

**Created**: 2026-10-06

**Status**: Draft

**Input**: User description: "Proper CI for the repository: introduce a develop and a
main branch. CI gates pull requests (merge requests). No one may push directly to
main. Every change goes through a PR."

## Clarifications

### Session 2026-10-06

- Q: Which merge style should be used? → A: Squash for working branch → `develop`;
  merge commit for `develop` → `main`, hotfix → `main` and back-merges into
  `develop`. The pull request title becomes the squash commit message and is
  therefore checked for Conventional Commits.
- Q: Must pull requests into `main` be up to date with `main`, and how does a hotfix
  get back into `develop`? → A: Only pull requests into `develop` must be up to date.
  Pull requests into `main` are checked against the result of merging them into the
  current `main`. Requiring `main` PRs to be up to date would block every release
  after the first: each release leaves a merge commit only on `main`, and updating
  `develop` to include it would be a forbidden direct push. For the same reason a
  hotfix returns to `develop` through a back-merge branch (`sync/…`) cut from
  `main` with `develop` merged in, not through a pull request from `main` itself.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every change lands through a checked pull request (Priority: P1)

A contributor (today usually the maintainer, later possibly other volunteers) works on
a feature or fix in their own branch and opens a pull request against `develop`. The
repository automatically runs the project's quality checks — lint and formatting,
type checking, the test suite, and the commit message convention — on that pull
request and reports the result on it. The pull request can only be merged once every
required check has passed against the current state of the branch. If a check fails,
the merge stays blocked until the contributor pushes a fix and the checks pass again.

**Why this priority**: This is the core of the request: nothing reaches the shared
branches without having passed the same checks the constitution requires before a
change is "done". Local git hooks can be skipped (or not installed at all by a new
contributor); a server-side gate cannot.

**Independent Test**: Open a pull request that introduces a deliberate lint error and
confirm it cannot be merged; push a fix and confirm it becomes mergeable once the
checks are green.

**Acceptance Scenarios**:

1. **Given** a pull request against `develop` whose changes pass lint, type checking,
   tests and the commit message convention, **When** the checks finish, **Then** all
   required checks are reported as passed on the pull request and it can be merged.
2. **Given** a pull request with a failing test, **When** the checks finish, **Then**
   the failing check is reported on the pull request, names which check failed, and
   the merge is blocked.
3. **Given** a pull request containing a commit whose message does not follow
   Conventional Commits, **When** the checks finish, **Then** the commit message check
   fails and the merge is blocked.
4. **Given** a pull request whose checks passed, **When** the contributor pushes
   another commit, **Then** the checks run again and the pull request is blocked until
   they pass for the new commit.
5. **Given** a pull request into `develop` whose checks passed but whose target
   branch has since moved on, **When** the contributor tries to merge, **Then** the merge is blocked until the
   branch is brought up to date with the target and the checks pass on the result.

---

### User Story 2 - Nobody can push directly to `main` or `develop` (Priority: P1)

Anyone with write access — including the repository owner and administrators — who
tries to push commits directly to `main` or `develop`, force-push over their history,
or delete either branch is refused by the repository. The only way to change either
branch is by merging a pull request whose required checks passed.

**Why this priority**: The user stated it explicitly ("no one may push to main", "PRs
for everything"). Without it, the CI gate of User Story 1 is advisory only.

**Independent Test**: As the repository owner, attempt a direct push, a force push and
a branch deletion against `main` and `develop`; all three must be rejected.

**Acceptance Scenarios**:

1. **Given** a local commit on `main`, **When** the repository owner pushes it
   directly, **Then** the push is rejected with a message stating that changes must go
   through a pull request.
2. **Given** a local commit on `develop`, **When** anyone pushes it directly, **Then**
   the push is rejected the same way.
3. **Given** a rewritten history of `main` or `develop`, **When** anyone force-pushes
   it, **Then** the push is rejected.
4. **Given** `main` or `develop`, **When** anyone tries to delete the branch on the
   shared repository, **Then** the deletion is rejected.
5. **Given** a pull request with failing required checks, **When** an administrator
   tries to merge it anyway, **Then** the merge is refused — there is no bypass.

---

### User Story 3 - Releasing `develop` to `main` (Priority: P2)

When the maintainer decides that the state of `develop` is ready to be released, they
open a pull request from `develop` to `main`. The same required checks run on it, and
it can only be merged once they pass. After the merge, `main` reflects exactly what was
on `develop` at that point, so `main` always represents the last released state.

**Why this priority**: The two-branch model only pays off if there is a clear,
repeatable way to promote integrated work to `main`. It depends on Stories 1 and 2 but
can be exercised as soon as both branches exist.

**Independent Test**: With at least one merged change on `develop` that is not on
`main`, open a `develop` → `main` pull request, let the checks pass, merge it, and
confirm `main` now contains that change and nothing else differs between the two
branches.

**Acceptance Scenarios**:

1. **Given** `develop` contains merged changes not yet on `main`, **When** the
   maintainer opens a pull request from `develop` to `main`, **Then** the required
   checks run on it and the pull request is mergeable only once they pass.
2. **Given** a `develop` → `main` pull request was merged, **When** the two branches
   are compared, **Then** `main` contains no change that `develop` lacks.
3. **Given** a pull request from any branch other than `develop` (or a hotfix branch,
   see User Story 4) targets `main`, **When** it is opened, **Then** it is flagged as
   not allowed and cannot be merged.

---

### User Story 4 - Urgent fix to `main` (Priority: P3)

A bug in the released state on `main` needs fixing before `develop` is ready to be
released. The maintainer creates a hotfix branch from `main`, opens a pull request
against `main`, and merges it once the checks pass. The fix is then carried back into
`develop` through a back-merge branch: cut from `main`, with `develop` merged into it,
and proposed to `develop` in a second pull request, so `develop` does not lose the
fix.

**Why this priority**: Rare, but without a defined path the maintainer would be
tempted to bypass the rules in exactly the moment they matter most.

**Independent Test**: Create a hotfix branch from `main`, merge it via a checked pull
request, then carry it back through a back-merge branch and a pull request into
`develop`, and confirm both branches contain the fix.

**Acceptance Scenarios**:

1. **Given** a hotfix branch created from `main`, **When** a pull request against
   `main` is opened, **Then** the required checks run and the pull request is
   mergeable once they pass.
2. **Given** a hotfix was merged into `main`, **When** the maintainer opens a pull
   request into `develop` from a back-merge branch that contains both `main` and
   `develop`, **Then** it is subject to the same checks and, once merged with a merge
   commit, `develop` contains the fix.
3. **Given** a hotfix was merged into `main` while a release pull request
   (`develop` → `main`) is open, **When** the back-merge reaches `develop`, **Then**
   the release pull request's checks run again against the new state.

---

### Edge Cases

- **Pull requests from forks** (the repository is public): checks run on them, but
  without access to any repository secrets. Since the required checks need no secrets
  (tests run against local, emulated resources — constitution Principle V), fork pull
  requests get the same, complete gate.
- **Checks that never report** (e.g. the CI service is down or a job is stuck): the
  pull request stays blocked; a missing result is treated as not passed, never as
  passed. A stuck run is cut off after a time limit and reported as failed.
- **Flaky or infrastructure failures**: the contributor can re-run the checks without
  pushing a new commit.
- **Changes that touch only documentation or specs**: they still go through a pull
  request and the same required checks — there is no path that skips the gate.
- **Local history not yet on the shared repository**: at the time of writing, local
  `main` holds commits that were never pushed. Those must be published before
  protection is switched on; afterwards they could only arrive via a pull request.
- **Merge commits and squash commits created by the merge itself** must also satisfy
  the commit message convention, so the history of `main` and `develop` stays
  consistent. The squash commit takes its message from the pull request title, which
  is why the title is checked (FR-010); the platform's default merge-commit message
  for `develop` → `main` and back-merges is accepted as is.
- **Dependency lockfile drift**: a pull request whose dependencies cannot be installed
  exactly as recorded in the lockfile fails the checks rather than silently using
  different versions.
- **Secrets accidentally committed** in a pull request: out of scope for automated
  detection in this feature (see Assumptions), but the gate MUST NOT print or expose
  any secret in its logs.

## Requirements *(mandatory)*

### Functional Requirements

**Branch model**

- **FR-001**: The shared repository MUST have two long-lived branches: `main`, holding
  the last released state, and `develop`, the integration branch where finished
  changes are collected.
- **FR-002**: `develop` MUST be the repository's default branch, so new pull requests
  target it unless the author picks otherwise.
- **FR-003**: `develop` MUST start from the current state of `main` (after the pending
  local history has been published), so both branches share the same history at the
  start.

**Protection**

- **FR-004**: Direct pushes to `main` and `develop` MUST be rejected for everyone,
  including repository owners and administrators.
- **FR-005**: Force pushes to and deletion of `main` and `develop` MUST be rejected
  for everyone.
- **FR-006**: A change to `main` or `develop` MUST only be possible by merging a pull
  request.
- **FR-007**: A pull request MUST NOT be mergeable unless every required check
  (FR-010) has passed on its latest commit.
- **FR-008**: A pull request into `develop` MUST NOT be mergeable unless its branch is
  up to date with `develop`. A pull request into `main` MUST have its checks run
  against the result of merging it into the current `main`, but does not need to be
  up to date with `main` (see Clarifications).
- **FR-009**: No person or role may bypass FR-004 to FR-008; there is no
  emergency override. The hotfix path (User Story 4) is the sanctioned route for
  urgent fixes.
- **FR-009a**: Pull requests into `main` MUST only come from `develop` or from a
  hotfix branch; any other source branch MUST be refused.
- **FR-009b**: Working-branch pull requests into `develop` MUST be merged as a single
  squashed commit. Pull requests from `develop` into `main`, from a hotfix branch into
  `main`, and from a back-merge branch into `develop` MUST be merged with a merge
  commit, so
  that `main` and `develop` keep a shared history and the next `develop` → `main`
  pull request never conflicts on already-released changes.

**Required checks**

- **FR-010**: Every pull request targeting `main` or `develop` MUST automatically run
  these checks, each reported separately on the pull request:
  1. lint and formatting (same rules as `pnpm lint`),
  2. type checking (same as `pnpm typecheck`),
  3. the full test suite (same as `pnpm test`),
  4. Conventional Commits compliance of every commit in the pull request (same rules
     as the local commit-message hook),
  5. Conventional Commits compliance of the pull request title, because it becomes
     the message of the squashed commit (FR-009b).
- **FR-011**: The checks MUST run with exactly the dependency versions recorded in the
  lockfile and the tool versions the project pins (Node version, package manager), and
  MUST fail if the lockfile does not match the declared dependencies.
- **FR-012**: The checks MUST also run on every push to `main` and `develop` (i.e.
  after each merge), so the state of each long-lived branch is visibly green or red.
- **FR-013**: The checks MUST re-run automatically on every new commit pushed to an
  open pull request; results from an older commit MUST NOT count for a newer one.
- **FR-014**: When a newer commit is pushed to the same pull request while checks are
  still running, the outdated run SHOULD be cancelled to save CI time.
- **FR-015**: Each check MUST have a time limit after which it is reported as failed.
- **FR-016**: A failed check MUST show the contributor which check failed and the
  relevant output, without them having to reproduce it locally first.

**Safety**

- **FR-017**: The checks MUST NOT need, read or have access to production secrets,
  production Cloudflare resources, or the real Strava API (constitution Principle I,
  Principle V, CLAUDE.md non-negotiables).
- **FR-018**: The checks MUST NOT deploy anything, change production secrets, run
  remote database commands, or change the Strava webhook subscription — deploying
  stays a manual, deliberate step (constitution Development Workflow).
- **FR-019**: The checks MUST run with the least repository permissions needed to read
  the code and report results; they MUST NOT be able to push to the repository.
- **FR-020**: Pull requests from forks MUST be checked the same way as pull requests
  from branches of the repository itself, without granting fork code any secrets or
  write permissions.

**Documentation**

- **FR-021**: The project documentation (README and CLAUDE.md) MUST describe the
  branch model, the pull-request-only rule, the release (`develop` → `main`) and
  hotfix paths, and which checks gate a merge.
- **FR-022**: The protection settings for `main` and `develop` MUST be written down in
  the repository in a form that lets the maintainer re-apply them and verify they are
  still in effect, because they live in the hosting platform's settings rather than in
  the code.

### Key Entities

- **Long-lived branch**: `main` (released state) or `develop` (integration). Protected;
  only changed by merging pull requests.
- **Working branch**: a short-lived branch for one change — a feature/fix branch cut
  from `develop`, a hotfix branch cut from `main`, or a back-merge branch cut from
  `main` with `develop` merged in, which carries a hotfix back into `develop`.
- **Pull request**: a proposal to merge a working branch (or `develop`) into a
  long-lived branch. Carries the check results and is the only route to change a
  long-lived branch.
- **Required check**: one automated quality check (lint, typecheck, tests, commit
  messages, pull request title) whose passing result on the pull request's latest commit is a merge
  precondition.
- **Protection rule set**: the set of restrictions on a long-lived branch (no direct
  push, no force push, no deletion, required checks, up-to-date requirement, allowed
  source branches, no bypass).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of commits on `main` and `develop` after this feature is enabled
  arrived through a merged pull request whose required checks passed.
- **SC-002**: A direct push, force push or branch deletion against `main` or `develop`
  is rejected in 100% of attempts, including attempts by the repository owner.
- **SC-003**: A contributor sees the result of all required checks on a typical pull
  request within 10 minutes of pushing.
- **SC-004**: A pull request with a lint error, type error, failing test or
  non-conventional commit message is blocked from merging in 100% of cases.
- **SC-005**: A new contributor can find, from the README alone, how to propose a
  change and what has to pass before it is merged, without asking the maintainer.
- **SC-006**: Running the checks never touches production: zero deploys, secret
  changes, remote database commands or Strava API calls are triggered by CI.
- **SC-007**: Checking all open pull requests stays within the hosting platform's free
  allowance for public repositories (constitution Principle IV: no operations budget).

## Assumptions

- The repository is hosted on GitHub (`SaSteffen/RynkePoints`, public), and its
  built-in automation and branch protection are used. Public repositories get CI time
  for free, consistent with constitution Principle IV.
- The project is maintained by a single maintainer today. Required human approval of
  pull requests is therefore **not** part of the gate (the platform does not let an
  author approve their own pull request, which would block every merge); the passing
  checks are the gate. Requiring a reviewer can be added later once more maintainers
  exist.
- "No one may push to main" is read as also covering `develop` ("PRs for everything"),
  and as applying to owners and administrators without exception.
- Switching on branch protection and changing the default branch are changes to the
  shared repository's settings. They are applied by the maintainer (or explicitly at
  their request), not as a side effect of merging this feature — consistent with how
  deploys and webhook subscriptions are treated in CLAUDE.md.
- The pending local commits on `main` are pushed to the shared repository once, before
  protection is switched on; this one-time bootstrap push is the last direct push to
  `main`.
- Continuous deployment (automatically deploying `main` to Cloudflare) is out of
  scope; deploying stays manual per the constitution. A later feature may add it.
- Automated dependency updates, secret scanning, code coverage thresholds and release
  tagging/versioning are out of scope for this feature.
- The local git hooks (Biome, `tsc`, commitlint via lefthook) stay as they are; CI
  repeats the same checks server-side rather than replacing them.
- Hotfix and back-merge branches are recognisable by naming conventions (e.g.
  `hotfix/` and `sync/` prefixes); the exact conventions are settled in the plan.
