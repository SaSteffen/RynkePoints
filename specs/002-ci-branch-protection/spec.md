# Feature Specification: CI-Gated Pull Requests and Protected Branches

**Feature Branch**: `002-ci-branch-protection`

**Created**: 2026-10-06

**Status**: Draft (amendment: deploy on merge to `main`)

**Input**: User description: "Proper CI for the repository: introduce a develop and a
main branch. CI gates pull requests (merge requests). No one may push directly to
main. Every change goes through a PR."

**Amendment** (2026-10-06, branch `002-deploy-on-main`): "I want to publish when
merging to main." User Stories 1–4 are implemented; the amendment adds User Story 5
and FR-023 to FR-036, and revises FR-018, FR-021 and the Assumptions that kept
deploying out of scope.

**Amendment** (2026-10-10): "A merged PR to main runs lint, test and typecheck again.
Those are useless, we just did them on the same commit." Revises FR-012, FR-023,
FR-024, User Story 5 and SC-009: pushes no longer re-run checks whose result is
already known.

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
- Q: Should a deployment from `main` apply pending production database migrations
  itself, or leave them to the maintainer? → A: Apply them automatically, before
  publishing the code, forward-only (never rolled back). If a migration fails, the
  deployment stops without publishing the code.

### Session 2026-10-10

- Q: Which pushes still re-run the checks? → A: None to `develop`: it only accepts
  pull requests that are up to date, so its new commit holds exactly what the checks
  passed on. A push to `main` re-runs them only when the merged commit's content
  differs from the merged branch's, i.e. `main` held something the branch lacks
  (e.g. a hotfix merged before a release that doesn't contain it yet). Otherwise
  production gets exactly the branch content the checks passed on. Manual re-deploys
  (FR-030) still re-run them.

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

### User Story 5 - Merging into `main` publishes the app (Priority: P2)

When a release (`develop` → `main`) or hotfix pull request is merged, the
repository publishes the new state of `main` to production by itself: once the
required checks have passed on the merged content, the Worker is deployed and riders
use the new version without the maintainer running anything on their own machine.
Merging into `main` is therefore the one deliberate act that releases a change, and
production always runs what `main` holds.

**Why this priority**: `main` is defined as "the last released state" (FR-001), but
today releasing still needs a second, manual deploy from a laptop that can drift from
`main` (wrong branch, local changes, forgotten step). Tying the deploy to the merge
makes `main` and production the same thing. It builds on User Stories 2 and 3: only
because nothing reaches `main` unchecked is it safe to deploy whatever lands there.

**Independent Test**: Merge a release pull request with a visible change (e.g. a
changed text on the start page) into `main`; without any further action, confirm the
change is live in production within the time of SC-008, and that the deployment
history names the merged commit. Merge a pull request into `develop` and confirm
production does not change.

**Acceptance Scenarios**:

1. **Given** a release pull request was merged into `main`, **When** the required
   checks have passed on the resulting content of `main` (FR-012), **Then** that
   commit is deployed to production without further action and the deployment is
   recorded with the commit it came from.
2. **Given** a hotfix pull request was merged into `main`, **When** the checks pass,
   **Then** it is deployed the same way.
3. **Given** a commit on `main` whose checks fail, **When** the checks finish,
   **Then** nothing is deployed and production keeps running the previous version.
4. **Given** a pull request merged into `develop` (feature or back-merge), **When**
   its checks pass, **Then** nothing is deployed.
5. **Given** a deployment fails part-way (e.g. the hosting platform is unavailable),
   **When** it ends, **Then** the failure is reported on the commit of `main`, the
   maintainer is notified, and production keeps running the previous version.
6. **Given** a failed deployment or a production problem unrelated to code (e.g. a
   rotated secret), **When** the maintainer asks for it, **Then** the current state of
   `main` can be deployed again without a new commit or pull request.
7. **Given** a pull request from a fork or any branch, **When** its checks run,
   **Then** they have no access to the deploy credential and cannot deploy.

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
- **Two merges into `main` in quick succession**: deployments never run in parallel
  and a running deployment is never cut off half-way. Production ends up on the
  newest commit of `main`; an older deployment still waiting may be skipped, but an
  older commit is never deployed after a newer one.
- **Database schema changes**: a release can contain a new migration in
  `migrations/` whose code relies on it. Deploying that code against the old schema
  would break the app. The deployment therefore applies pending migrations first and
  publishes the code only if they all succeeded (FR-035). Because the previous
  version keeps running while migrations apply, and keeps running if publishing the
  code fails afterwards, a migration must leave the previous version working
  (FR-036).
- **Production not yet set up**: before the one-time production setup (database,
  queue, secrets, custom domain, Strava webhook subscription; see 001 quickstart) has
  been done, a merge into `main` fails its deployment visibly instead of creating
  production resources on its own.
- **Configuration in the repository**: the deployed configuration is the one
  committed on `main` (team settings in `wrangler.jsonc`). A setting meant to change
  in production changes through a pull request, not by editing production by hand.
- **Changes that touch only documentation or specs** reaching `main` are deployed
  like any other; deploying unchanged code is harmless and keeps the rule simple.
- **Deploy credential leaked or revoked**: deployments fail until the maintainer
  replaces it; production keeps running. The credential can only deploy this app, so
  a leak cannot touch other resources of the account.

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
- **FR-012**: The checks MUST also run on a push to `main` (i.e. after a merge)
  unless they already passed on exactly the content of the new commit: the new
  commit's content equals that of the merged branch, and the checks passed on that
  branch's last commit. A manual re-deploy (FR-030) always runs them. Pushes to `develop` MUST NOT re-run
  them, because `develop` only accepts pull requests that are up to date (FR-008),
  so its new commit holds exactly what the checks passed on. When it can't be shown
  that the checks already passed, they run.
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
  remote database commands, or change the Strava webhook subscription. Deploying is
  a separate step that only runs for `main` (FR-023 to FR-036).
- **FR-019**: The checks MUST run with the least repository permissions needed to read
  the code and report results; they MUST NOT be able to push to the repository.
- **FR-020**: Pull requests from forks MUST be checked the same way as pull requests
  from branches of the repository itself, without granting fork code any secrets or
  write permissions.

**Documentation**

- **FR-021**: The project documentation (README and CLAUDE.md) MUST describe the
  branch model, the pull-request-only rule, the release (`develop` → `main`) and
  hotfix paths, which checks gate a merge, and that merging into `main` deploys to
  production (including the manual re-deploy and rollback).
- **FR-022**: The protection settings for `main` and `develop` MUST be written down in
  the repository in a form that lets the maintainer re-apply them and verify they are
  still in effect, because they live in the hosting platform's settings rather than in
  the code.

**Deploying on merge to `main`**

- **FR-023**: Every new commit on `main` MUST be deployed to production automatically
  once the checks of FR-012 have passed on its content. No other branch, pull request
  or event MAY deploy to production, except the manual re-deploy of FR-030.
- **FR-024**: A commit on `main` whose checks failed, were cancelled or did not finish
  MUST NOT be deployed, nor a commit whose checks were skipped without having passed
  on its content before (FR-012).
- **FR-025**: The deployed version MUST be built from exactly the merged commit, with
  the dependency and tool versions of FR-011; nothing from outside the repository
  (local files, uncommitted changes, a contributor's machine) MAY enter it.
- **FR-026**: Deployments MUST run one at a time. A running deployment MUST NOT be
  cancelled by a newer commit; a waiting one MAY be skipped in favour of a newer
  commit, but an older commit MUST NEVER be deployed after a newer one.
- **FR-027**: Each deployment MUST be recorded with the commit it deployed and its
  outcome, visible on the repository, so the maintainer can tell which commit of
  `main` production runs.
- **FR-028**: A failed deployment MUST be reported on the commit of `main` with the
  relevant output, MUST notify the maintainer, and MUST leave the previously deployed
  version running.
- **FR-029**: Deploying MUST only update the app's code, static assets and the
  configuration committed in the repository, and apply pending database migrations
  (FR-035). It MUST NOT change production secrets, create or
  delete production resources (database, queue, domain), or change the Strava webhook
  subscription; those stay manual steps.
- **FR-030**: The maintainer MUST be able to deploy the current state of `main` again
  on demand, without a new commit or pull request (e.g. after a failed deployment or a
  rotated secret). Deploying any other branch or an older commit this way MUST NOT be
  possible.
- **FR-031**: The deploy credential MUST be stored in the hosting platform's secret
  store, MUST be available only to the deploy step running for `main`, and MUST NOT be
  readable by pull request checks, fork pull requests or any other branch.
- **FR-032**: The deploy credential MUST be limited to what deploying this app needs;
  it MUST NOT be able to read or change other projects or account settings of the
  hosting account.
- **FR-033**: The deploy step MUST NOT print secrets or rider data in its logs.
- **FR-034**: The way to roll back — re-deploying a previous version — MUST be
  documented, including that the next merge into `main` deploys `main` again, and
  that a rollback does not undo database migrations.
- **FR-035**: Before publishing the code, a deployment MUST apply every migration in
  `migrations/` that the production database has not applied yet, in order, and
  forward-only: migrations are never rolled back automatically. If a migration
  fails, the deployment MUST stop without publishing the code and MUST be reported
  as failed (FR-028).
- **FR-036**: Every migration MUST keep the version deployed before it working (e.g.
  add tables and columns rather than rename or drop them in the same release), so
  that riders are not affected while it is applied or when publishing the code
  fails afterwards. Removing what the old version still needs happens in a later
  release.

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
- **Production deployment**: one publication of a commit of `main` to the production
  Worker. Records the commit, the time and the outcome; at most one runs at a time.
- **Deploy credential**: the secret that allows publishing this app to the hosting
  account. Scoped to deploying this app, held in the repository's secret store and
  released only to deployments from `main`.

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
  changes, remote database commands or Strava API calls are triggered by pull
  request checks or by pushes to any branch other than `main`.
- **SC-007**: Checking all open pull requests stays within the hosting platform's free
  allowance for public repositories (constitution Principle IV: no operations budget).
- **SC-008**: After a pull request is merged into `main`, production runs the merged
  commit within 15 minutes in 100% of cases where the checks and the deployment
  succeed, without any action by the maintainer.
- **SC-009**: 100% of production deployments after this amendment is enabled come from
  a commit of `main` whose content passed the checks (FR-012); zero come from another branch, a pull
  request or a contributor's machine.
- **SC-010**: For any point in time, the maintainer can tell from the repository alone
  which commit of `main` production was running.
- **SC-011**: A failed deployment leaves the previous version serving riders in 100%
  of cases.

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
- "Publish" means deploying the Worker to production on Cloudflare (the app at its
  custom domain), not creating a release, tag or package.
- Merging a pull request into `main` is the deliberate act that releases a change, so
  automatic deployment from `main` replaces the manual `pnpm run deploy`
  (constitution 1.2.0, Development Workflow). Changing production secrets,
  production data other than through migrations, production resources and the
  Strava webhook subscription stay manual.
- The Cloudflare account hosts only RynkePoints, so a deploy credential scoped to
  that account meets FR-032 even though the platform can't narrow it to one Worker
  or database.
- One environment, production. There is no staging deployment of `develop`; a later
  feature may add one.
- The one-time production setup from the 001 quickstart (creating the database and
  queue, setting secrets, custom domain, webhook subscription) is done by the
  maintainer before the first automatic deployment, and creating the deploy
  credential and storing it in the repository's secret store is a manual step like
  applying the rulesets.
- The maintainer is the only person allowed to trigger a manual re-deploy (FR-030).
  Merging is already limited by the rulesets, so no extra human approval is required
  before an automatic deployment.
- Deploying from a local machine stays technically possible for the maintainer but is
  no longer the documented way to release; the documentation names it as a
  break-glass path only.
- Automated dependency updates, secret scanning, code coverage thresholds and release
  tagging/versioning are out of scope for this feature.
- The local git hooks (Biome, `tsc`, commitlint via lefthook) stay as they are; CI
  repeats the same checks server-side rather than replacing them.
- Hotfix and back-merge branches are recognisable by naming conventions (e.g.
  `hotfix/` and `sync/` prefixes); the exact conventions are settled in the plan.
