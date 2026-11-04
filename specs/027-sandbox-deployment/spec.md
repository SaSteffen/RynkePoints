# Feature Specification: Sandbox Deployment and Safer Merging

**Feature Branch**: `027-sandbox-deployment`

**Created**: 2026-11-04

**Status**: Draft

**Input**: User description: "I want to enable auto-merge on a pull request and have it
merge without further work. I would only drop the requirement that a pull request is up
to date if we had a sandbox deployment. It must not hold production data, it deploys on
every merge to develop, and two pull requests that both add migrations must not clash."

## Context

The maintainer wants to click **Enable auto-merge** on a pull request and be done. Auto-merge
is already on for the repository, but `develop` requires a pull request to be up to date
(002 FR-008), and GitHub doesn't update a branch for auto-merge. A pull request that
falls behind waits until someone updates it. In the last 43 pull requests merged into
`develop`, 17 were opened while an earlier one was still open, so this happens often.

GitHub's built-in answer, a merge queue, is only offered on organization-owned
repositories, and this one belongs to a personal account.

**Terms**: The **sandbox** is an always-on, access-controlled deployment of the current
`develop`, using the existing fake mode (feature 006). The **scale profile** is a small
set of rounded totals describing how large production is. The **migration marker** is
one tracked line naming the latest migration. The **up-to-date rule** is 002 FR-008's
requirement for `develop`.

### The trade-off of the final step

"Tested against the exact commit it merges into" and "up to date with the target" are the
same requirement, so this feature can't keep it while removing the up-to-date rule.

| | Up-to-date rule on (today) | Up-to-date rule off (User Story 5) |
|---|---|---|
| **Tested against the exact target before merging** | Every pull request | No pull request |
| **Manual update when behind** | Every pull request | Only when two pull requests add migrations, or on a real git conflict |
| **Two pull requests that break each other** | Prevented | Found after the merge, by CI on `develop` or in the sandbox |
| **Reaching production broken** | Stopped by the release pull request's checks | Stopped by the release pull request's checks |

The migration marker is narrower than the up-to-date rule. It guarantees that no other
migration merged since a migration pull request was tested. It does not guarantee that
no other change did: code merged in between can still disagree with the migration, and
that is found after the merge.

So Stories 1–4 are worthwhile on their own, and removing the rule is a separate decision.
If the exact-target guarantee stays a requirement, the rule stays on, and the only
ways to automate updates are an organization-owned repository with a merge queue or a
workflow that rebases waiting pull requests. Both are out of scope here.

## Clarifications

### Session 2026-11-04

- Q: Can production data initialize the sandbox, alongside the fake data? → A: No, not
  even anonymised. The fake sign-in has no real authentication, riders' consent doesn't
  cover a sandbox, a copy would miss prompt deletion, and dates and distances of a small
  team can be matched to public Strava profiles (constitution Principle I). Synthetic
  riders are generated at production scale from rounded totals instead.
- Q: Is deploying to the sandbox a deliberate step? → A: No. It happens on every merge to
  `develop` once CI passes. The deliberate step stays the release pull request.
- Q: Does the sandbox use the real Strava? → A: No, only the fake Strava.
- Q: Where does the sandbox run? → A: In a separate Cloudflare account, so its deploy
  credential can't reach production.
- Q: Is the up-to-date rule removed now? → A: No. It stays until the sandbox has run
  reliably, and removing it is then a separate manual decision.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Try the current develop before releasing (Priority: P1)

The maintainer opens the sandbox, on a phone or a laptop, and uses the app as it stands on
`develop`, with sample riders and no real rider data, before pressing **Release PR**.

**Why this priority**: This is the sandbox's purpose, and every other story depends on it.
It also moves UI checks from the live site after a release to before it.

**Independent Test**: Merge a visible change into `develop`, wait for the deployment, sign
in to the sandbox as a sample rider, and see the change and the matching commit.

**Acceptance Scenarios**:

1. **Given** a merge into `develop` whose CI passed, **When** the deployment finishes,
   **Then** the sandbox runs that commit and shows which commit it is.
2. **Given** CI failed on `develop`, **When** the maintainer opens the sandbox, **Then** it
   still runs the last good commit, and the maintainer got the failure e-mail.
3. **Given** the sandbox, **When** the maintainer signs in, **Then** only the fake Strava
   answers and no request reaches the real Strava.
4. **Given** the sandbox, **When** the maintainer looks at any page, **Then** it's clear this
   is the sandbox and not the real app.

---

### User Story 2 - Nobody else gets in, and production stays out of reach (Priority: P1)

The sandbox is reachable only by people the maintainer allows, and neither the sandbox
nor its deployment can touch production.

**Why this priority**: The fake sign-in has no real authentication, and the fake Strava's
pages imitate a Strava sign-in. Exposing them publicly, or weakening the rule that only
`main` deploys production, would cost more than the sandbox is worth.

**Independent Test**: Open the sandbox without access and get refused. Check that its
credential is refused by the production account.

**Acceptance Scenarios**:

1. **Given** a visitor who isn't allowed in, **When** they open any sandbox address, **Then**
   they reach neither the app nor the fake Strava pages.
2. **Given** the access gate is misconfigured or removed, **When** a request arrives,
   **Then** the sandbox refuses it rather than serving it.
3. **Given** the sandbox's deploy credential, **When** it is used against the production
   account, **Then** it is refused.
4. **Given** the production build, **When** it is inspected, **Then** it contains no fake mode,
   and the fake mode refuses every host except the one configured sandbox host and local
   ones.

---

### User Story 3 - Realistic scale without real data (Priority: P2)

The sandbox holds as many riders, activities and events as production, all invented, so
slow pages and crowded layouts show up before a release.

**Why this priority**: The small sample set hides problems of scale, and this is what a
copy of production would have offered, without its privacy cost.

**Independent Test**: Read the scale profile, seed the sandbox, and compare the sandbox's
totals to the profile.

**Acceptance Scenarios**:

1. **Given** a scale profile, **When** the sandbox is seeded, **Then** its totals match the
   profile within 10% and every generated rider is synthetic.
2. **Given** the sample riders of feature 006, **When** the sandbox is seeded, **Then** they
   are still there, so every state they cover can still be reached.
3. **Given** a scale profile, **When** anyone reads it, **Then** it identifies no rider and
   gives no individual's exact figure.

---

### User Story 4 - Migrations can't clash silently, and a stuck sandbox can be reset (Priority: P2)

When two open pull requests both add a migration, the second can't merge until it is
updated and tested against the first. Pending migrations run against the sandbox's
existing data on every deployment, and if one leaves the sandbox stuck, the maintainer
rebuilds it with one button.

**Why this priority**: Two migrations with different filenames merge without a git conflict
even when they change the same table. Migrations only go forward, so this is the
failure that's hardest to undo in production.

**Independent Test**: Open two pull requests that each add a migration. Merge the first
and see the second blocked by a conflict. Rebase it and see its checks re-run.

**Acceptance Scenarios**:

1. **Given** two open pull requests that each add a migration, **When** the first merges,
   **Then** GitHub blocks the second with a conflict, also if auto-merge is on for it.
2. **Given** that blocked pull request, **When** it is rebased with its migration renumbered
   and the marker updated, **Then** its checks re-run and it can merge.
3. **Given** a pull request that adds a migration without updating the marker, or whose
   migration isn't numbered after all others, **When** its checks run, **Then** they fail
   and say what to fix.
4. **Given** a sandbox holding data from earlier deployments, **When** a merge brings a new
   migration, **Then** it is applied to that data before the new code goes live.
5. **Given** a stuck or messy sandbox, **When** the maintainer runs **Reset sandbox**, **Then**
   the database is rebuilt, migrated from the start and reseeded, running the current
   `develop`.

---

### User Story 5 - Approve and forget (Priority: P3)

Once the sandbox has proven itself, and if the maintainer decides so, the up-to-date rule
is removed from `develop`. Enabling auto-merge is then the last thing the maintainer does
for a pull request without a conflict.

**Why this priority**: This is the original goal, but it depends on everything above, gives
up a guarantee (see Context), and is a separate decision.

**Independent Test**: With the rule off, enable auto-merge on a pull request that is behind
`develop` and see it merge when its checks pass.

**Acceptance Scenarios**:

1. **Given** the rule is still on, **When** a pull request with auto-merge falls behind,
   **Then** it waits for a rebase, as it does today.
2. **Given** the rule is off, **When** a pull request with auto-merge is behind and has no
   conflict, **Then** it merges as soon as its checks pass.
3. **Given** the rule is off and two merged pull requests break each other, **When** CI runs
   on `develop`, **Then** it fails, the maintainer is told, the sandbox stays on the last
   good commit, and the next release pull request's checks fail.

### Edge Cases

- **Sandbox down or deployment failing**: it never blocks a merge or a release. A hotfix must
  not wait for the sandbox. The maintainer sees the failure e-mail and decides.
- **Migration applied, then the code deployment fails**: the sandbox keeps running the
  previous code on the newer database, the same state production would be in. The previous
  version keeps working because migrations must stay compatible, so this also tests that rule.
- **Migration fails on the sandbox's data**: the code isn't deployed, the maintainer is told,
  and nothing reaches production by itself. **Reset sandbox** recovers it after a fix is merged.
- **Two merges in quick succession**: deployments run one at a time, and a re-run of an older
  run never replaces a newer commit.
- **A reset during a deployment, or the other way round**: they wait for each other.
- **Hotfix back-merge carrying a migration**: `sync/*` branches deploy to the sandbox like any
  other merge. If `develop` added a migration meanwhile, the marker conflicts and is resolved
  in that pull request, with the later migration renumbered if it hasn't reached production.
- **Migration already applied to the sandbox, then renumbered**: can't happen, because only merged
  migrations reach the sandbox and merged ones are never renumbered.
- **Open migration pull requests when the marker is introduced**: they conflict once and
  need one rebase.
- **The list of sample riders on the fake sign-in at production scale**: it stays usable, for
  example by offering the named sample riders first.
- **Sandbox near a free-plan limit at production scale**: seeding stops with a clear message
  rather than leaving half a data set.
- **Time-dependent sandbox data going stale**: fake mode's clock and **Reset sandbox** already
  cover it, so the sandbox doesn't need to reseed by itself.
- **Scheduled jobs**: they run in the sandbox on its own synthetic data and reach only the fake
  Strava.

## Requirements *(mandatory)*

### Functional Requirements

**The sandbox**

- **FR-001**: There MUST be exactly one sandbox, always on, with its own Worker, database and
  queue, sharing no resource, secret or domain with production.
- **FR-002**: The sandbox MUST run fake mode, and MUST NOT be able to reach the real Strava:
  no real Strava credentials exist there, and every Strava request goes to the fake.
- **FR-003**: The sandbox MUST show which commit it is running and MUST make clear it isn't the
  real app. This lives in the fake-mode layer and changes nothing in the production bundle
  (it is developer-facing, like the `/_dev/` pages, so it needs no catalog entry).
- **FR-004**: The app code MUST be the same as production's, apart from fake mode's existing
  wrapper, so that what's tried in the sandbox is what would be released.

**Access and isolation**

- **FR-005**: The sandbox MUST be reachable only through Cloudflare Access, by people the
  maintainer allows.
- **FR-006**: The sandbox MUST fail closed: a request that didn't pass the access gate gets
  no app page and no fake Strava page, even if the gate is misconfigured.
- **FR-007**: The sandbox MUST live in a separate Cloudflare account. Its deploy credential
  MUST be unable to change production, and MUST be released by GitHub only to runs on
  `develop`. The production credential stays unlockable from `main` only (002, constitution
  Principle I).
- **FR-008**: 006 FR-009 MUST be amended: fake mode still can't activate in production and
  `src/` still never imports `dev/`, but it answers local hosts plus exactly one configured
  sandbox host. It MUST refuse every other host, and an automated test MUST cover this,
  including the production domain.

**Deployment**

- **FR-009**: Every push to `develop` MUST run the checks of 002 FR-012, unless they
  already passed on exactly that content. 002 FR-012's statement that pushes to `develop`
  don't run them MUST be amended.
- **FR-010**: When those checks pass, the sandbox MUST deploy that commit automatically,
  applying pending migrations before the code, as production does. When they fail, it
  MUST NOT deploy.
- **FR-011**: A failed check or deployment on `develop` MUST reach the maintainer by the
  existing failure e-mail.
- **FR-012**: Deployments MUST run one at a time and MUST NOT replace a newer commit with
  an older one.
- **FR-013**: Sandbox checks and deployments MUST NOT become required checks. A failing or
  unavailable sandbox MUST NOT block any merge or release.
- **FR-014**: A deployment MUST keep existing sandbox data, so migrations run against rows
  written by earlier versions.
- **FR-015**: The maintainer MUST be able to run **Reset sandbox** by hand, which rebuilds the
  database, applies all migrations from the start, reseeds it, and leaves the sandbox on
  the current `develop`.
- **FR-016**: Only merged commits of `develop` are deployed. Trying a pull request in the
  sandbox before merging is out of scope.

**Data**

- **FR-017**: Production data MUST NOT reach the sandbox: no copy, no subset, and no anonymised
  or pseudonymised version.
- **FR-018**: The sandbox MUST be seeded with the existing sample riders plus synthetic riders
  generated to match the scale profile. Generated data MUST be invented, with no real names
  or IDs and no GPS data (006 FR-011).
- **FR-019**: The scale profile MUST hold only rounded totals: the number of riders, typical
  and largest activity counts per rider, and the number of events. Figures MUST be rounded
  coarsely enough that none is an individual's exact figure, and MUST NOT name any rider.
- **FR-020**: Reading the totals from production is a manual, read-only step by the maintainer,
  never part of CI or a deployment. The sandbox's deploy path MUST have no access to
  production.

**Migrations**

- **FR-021**: The repository MUST contain one migration marker naming the latest migration,
  on a single line, so that any two pull requests adding a migration conflict in git.
- **FR-022**: A required check MUST fail when the marker doesn't name the highest-numbered
  migration, when two migrations share a number, or when a pull request's new migration
  isn't numbered above every migration on its target. Its message MUST say how to fix it. No
  new required-check context is added unless the plan shows it's needed.
- **FR-023**: Marker conflicts MUST be resolved by rebasing, renumbering the later migration
  and updating the marker, as documented for contributors, so its checks re-run on the new
  base.

**Merging**

- **FR-024**: `.github/repository-settings.md` MUST record that auto-merge is on, how to apply
  and check it, and how to update a branch that is behind with a rebase.
- **FR-025**: The up-to-date rule MUST stay on until the maintainer decides otherwise. Removing
  it MUST be a separate, manual step, done only after the criterion in SC-006, in a change that
  also updates `.github/rulesets/develop.json`, its README, 002 FR-008, FR-012 and R7, and the
  comment in the CI workflow.
- **FR-026**: Removing the rule MUST NOT change the merge methods of 002 FR-009b. It MUST NOT
  change the rule's absence on `main`, nor the checks of a release pull request.
- **FR-027**: The contributor docs (`README.md`, `CLAUDE.md`) MUST describe the sandbox, its
  deployment and reset, and the migration marker, and MUST say that the sandbox's credential
  and account setup, like the production ones, are manual steps of the maintainer.

### Key Entities

- **Sandbox**: The one deployment of `develop`; runs one commit at a time and holds only
  synthetic data.
- **Scale profile**: Rounded totals describing production's size, with nothing about any
  individual.
- **Migration marker**: One tracked line naming the latest migration, which every migration
  pull request must change.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Within 30 minutes of a merge into `develop` whose checks pass, the sandbox runs
  that commit, with no manual step.
- **SC-002**: A visitor without access reaches zero app or fake Strava pages, and the same holds
  with the access gate removed in a test.
- **SC-003**: No production row, token or secret is ever in the sandbox or its deployment path,
  and the sandbox makes zero requests to the real Strava.
- **SC-004**: Seeded sandbox totals are within 10% of the scale profile.
- **SC-005**: Two migration pull requests can never both merge unless the later one had its
  checks re-run after the earlier one merged.
- **SC-006**: Before the up-to-date rule is removed, the sandbox has handled at least 10 merges
  over at least 2 weeks with every failure explained, and at least one release was tried
  there first.
- **SC-007**: After the rule is removed, a pull request with no conflict that isn't adding a
  migration needs zero maintainer actions after enabling auto-merge.
- **SC-008**: A sandbox failure delays zero merges and zero releases.

## Assumptions

- Cloudflare API tokens can't be limited to a single Worker, which is the reason for the
  separate account. To be confirmed in planning.
- A free Cloudflare account covers the Worker, database, queue, cron and Access at production
  scale. To be confirmed in planning. If it doesn't, the maintainer decides between a paid
  plan and a smaller scale profile; sharing the production account isn't a fallback.
- A second Cloudflare account doesn't conflict with feature 026, whose "one account for now"
  is about teams' deployments and which already keeps separate accounts open.
- The maintainer is the only sandbox user at first and can allow others by e-mail address.
- Rounded totals describing the size of a team aren't rider data, so reading them for this
  purpose doesn't extend the riders' consent. The check against Principle I belongs in the plan.
- Rider-facing text is unchanged, so no catalog entries are needed.
- The sandbox's `/admin` shows Cloudflare's own usage figures as unavailable unless a sandbox
  analytics token is set later.

## Out of Scope

- Trying a pull request in the sandbox before merging, and one sandbox per pull request.
- The real Strava in the sandbox, in any form.
- Automatic rebasing of waiting pull requests, and moving the repository to an organization for
  a merge queue.
- Making a release depend on the sandbox's state.
- Automated browser tests against the deployed sandbox; the existing Playwright tests stay
  on CI's local fake mode.
