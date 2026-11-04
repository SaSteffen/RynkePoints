# Feature Specification: Release Sandboxes and Safer Merging

**Feature Branch**: `027-sandbox-deployment`

**Created**: 2026-11-04

**Status**: Draft

**Input**: User description: "I want to enable auto-merge on a pull request and have it
merge without further work. I would only drop the requirement that a pull request is up
to date if we had a sandbox deployment. Deploying to a sandbox is a choice made when
opening the release pull request, with one checkbox per sandbox, off by default. It keeps
everything in one Cloudflare account and avoids paying for as long as possible."

## Context

The maintainer wants to try a release before it reaches production, and eventually to
click **Enable auto-merge** on a pull request and be done. Auto-merge is already on for the
repository, but `develop` requires a pull request to be up to date (002 FR-008), and GitHub
doesn't update a branch for auto-merge. In the last 43 pull requests merged into `develop`,
17 were opened while an earlier one was still open, so this happens often. GitHub's merge
queue is only offered on organization-owned repositories, and this one belongs to a
personal account.

**Terms**: A **sandbox** is an access-controlled deployment for one team, using the existing
fake mode (feature 006). It runs a release candidate only when someone chooses that. The
**release pull request** goes from `develop` into `main`. The **sandbox gate** is a new
required check on `main` that shows whether the sandbox decision for the pull request's
current commit is settled. The **control comment** is the comment on the release pull request
that shows that decision and offers its actions. The **required sandboxes** are those
chosen so far on this release pull request. The **free-plan budget** is the share of the
account's daily free allowance that sandbox work may use. The **up-to-date rule** is 002
FR-008's requirement for `develop`.

### How the gate decides

The decision always belongs to one commit: the current head of the release pull request.

| Situation on the current commit | Gate | What the maintainer can do in the pull request |
|---|---|---|
| No sandbox chosen, and `develop` hasn't moved since the pull request opened | Passes | Tick a sandbox to deploy after all |
| Deployment running or waiting for checks | Blocks | Accept without waiting |
| Every required sandbox deployed this commit | Passes | Try it, then merge |
| A required sandbox's deployment failed | Blocks | Deploy again, or accept |
| `develop` moved, and sandboxes were chosen earlier | Blocks | Deploy again, or accept |
| `develop` moved, and no sandbox was chosen earlier | Blocks | Tick a sandbox to deploy, or accept |
| Accepted for this commit | Passes | Nothing further |
| Pull request into `main` that isn't from `develop` (a hotfix) | Passes at once | Nothing further |

### Staying on the free plan

Sandboxes and production share one Cloudflare account, so they share its limits. The Free
plan allows 5 cron triggers and 10 databases per account, 100,000 rows written, 5 million
rows read and 10,000 queue operations per day, and 10 ms of CPU per request. Running out
stops production's database until 00:00 UTC. This feature is built to stay within those
limits: deployments happen only on request, sandboxes use no cron triggers, large data sets
are seeded in daily stages, and sandbox work stops well before it could affect production.
Moving the account to the Paid plan later (at least $5 per month) is a separate decision and
needs only settings changed, not a new design (FR-037).

### The trade-off of removing the up-to-date rule

"Tested against the exact commit it merges into" and "up to date with the target" are the
same requirement, so this feature can't keep it while removing the up-to-date rule.

| | Up-to-date rule on (today) | Up-to-date rule off (User Story 7) |
|---|---|---|
| **Tested against the exact target before merging** | Every pull request | No pull request |
| **Manual update when behind** | Every pull request | Only when two pull requests add migrations, or on a real git conflict |
| **Two pull requests that break each other** | Prevented | Found after the merge by CI on `develop` |
| **Reaching production broken** | Stopped by the release pull request's checks | Stopped by the release pull request's checks |

Sandboxes are off by default, so they catch a clash only in a release someone chose to try.
The automatic safety net with the rule off is CI on `develop` and the release pull request's
checks. Removing the rule is a separate decision. Stories 1–6 are worthwhile without it.

## Clarifications

### Session 2026-11-04

- Q: Can production data initialize a sandbox, alongside the fake data? → A: No, not even
  anonymised. The fake sign-in has no real authentication, riders' consent doesn't cover a
  sandbox, a copy would miss prompt deletion, and dates and distances of a small team can
  be matched to public Strava profiles (constitution Principle I). Synthetic riders are
  generated from rounded totals instead.
- Q: Does a sandbox use the real Strava? → A: No, only the fake Strava.
- Q: When does a sandbox deploy? → A: Only when chosen: one checkbox per sandbox on the
  **Release PR** workflow, off by default, or later from inside the release pull request.
  This replaces the earlier idea of deploying on every merge to `develop`, which needed more
  machinery and checked each team more often than anyone would look.
- Q: Is there one sandbox or several? → A: One per team, deployed by the same workflow. A
  single sandbox switched between teams would need a redeploy and a reset for each switch,
  or a per-request team selection that production doesn't have.
- Q: Where do sandboxes run? → A: In the production Cloudflare account. This replaces the
  earlier separate account. Its consequences are in User Stories 3 and 4.
- Q: Does this feature need the Paid plan? → A: No. The design goes as far as it can on the
  Free plan, and paying is decided later.
- Q: Does a sandbox failure block the release? → A: Only if that sandbox was chosen, and
  accepting is a single click. A hotfix never waits for a sandbox.
- Q: What happens when `develop` moves while the release pull request is open? → A: The
  gate blocks until the maintainer deploys again or accepts, whether or not a sandbox was
  chosen earlier. Nothing redeploys by itself.
- Q: Is the up-to-date rule removed now? → A: No. It stays until sandboxes have proven
  themselves, and removing it is then a separate manual decision.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Choose sandboxes when opening a release (Priority: P1)

The maintainer runs **Release PR**, ticks the sandboxes this release should go to, and gets
a message on the pull request for each one, with a link to try it.

**Why this priority**: This is the feature's purpose. It moves UI and migration checks from
the live site after a release to before it, without any cost for a release that doesn't
need them.

**Independent Test**: Run **Release PR** with one box ticked and see that sandbox deploy, the
message appear with the link and commit, and the sample riders work there.

**Acceptance Scenarios**:

1. **Given** the **Run workflow** form, **When** the maintainer opens it, **Then** there is one
   checkbox per sandbox, all off, each saying when it can be skipped.
2. **Given** no box ticked, **When** the workflow runs, **Then** the pull request opens as it
   does today and nothing deploys.
3. **Given** a box ticked, **When** the workflow runs, **Then** the pull request opens and that
   sandbox deploys its head commit once the commit's required checks pass.
4. **Given** a finished deployment, **When** the maintainer opens the pull request, **Then** it
   has a message for that sandbox with its link, the commit, and any migrations applied.
5. **Given** a release pull request already open, **When** the workflow runs with a box ticked,
   **Then** that sandbox deploys the current head, rather than the run stopping at "already
   open".
6. **Given** the sandbox, **When** the maintainer signs in, **Then** only the fake Strava answers,
   and each page shows the commit and that this isn't the real app.

---

### User Story 2 - A chosen sandbox gates the release, with an easy override (Priority: P1)

If a sandbox was chosen, the release can't merge until its deployment succeeded. If it fails
or the sandbox is broken, accepting takes one click in the pull request.

**Why this priority**: A choice to test should hold until the test happened, but a sandbox
problem must not trap a release.

**Independent Test**: Choose a sandbox, make its deployment fail, see the merge blocked, then
accept in the pull request and see the merge allowed and the acceptance recorded.

**Acceptance Scenarios**:

1. **Given** a sandbox chosen, **When** its deployment is running, **Then** the gate blocks the
   merge, also with auto-merge on.
2. **Given** all chosen sandboxes deployed the head commit, **When** the last one finishes,
   **Then** the gate passes.
3. **Given** a failed deployment, **When** the maintainer looks at the pull request, **Then**
   there is a message with the reason and a link to the run, plus one-click **Deploy again**
   and **Accept** actions.
4. **Given** an acceptance, **When** it is made, **Then** the gate passes for that commit, and the
   pull request records who accepted and for which commit.
5. **Given** a hotfix pull request into `main`, **When** its checks run, **Then** the gate passes
   at once.

---

### User Story 3 - `develop` moves while the release pull request is open (Priority: P1)

When new commits reach `develop`, what was tested is no longer what would be released. The
gate blocks until the maintainer decides, in the pull request.

**Why this priority**: Without this, a release could merge untested commits while looking
tested, and a release with no sandbox could pick up a risky change nobody weighed.

**Independent Test**: Merge a change into `develop` with a release pull request open, once with
a sandbox chosen earlier and once without. Each time see the gate block, and clear it by
clicking in the pull request.

**Acceptance Scenarios**:

1. **Given** sandboxes chosen earlier, **When** `develop` moves, **Then** nothing redeploys by
   itself, the gate blocks, and the control comment offers **Deploy again** for those
   sandboxes and **Accept**.
2. **Given** no sandbox chosen earlier, **When** `develop` moves, **Then** the gate blocks, and the
   control comment offers one deploy action per sandbox and **Accept**.
3. **Given** the maintainer deploys from the control comment, **When** it finishes, **Then** the
   gate depends on that deployment succeeding.
4. **Given** either case, **When** the control comment updates, **Then** it lists the commits new
   since the last deployment or decision, so the maintainer can judge them on the spot.
5. **Given** an acceptance for a commit, **When** `develop` moves again, **Then** the acceptance no
   longer counts and a new decision is needed.
6. **Given** a click on a control comment that shows an older commit, **When** it arrives, **Then**
   it changes nothing, and the comment is refreshed for the current commit.

---

### User Story 4 - Nobody else gets in, and production stays apart (Priority: P1)

A sandbox is reachable only by people the maintainer allows, holds no real rider data, and
its deployment can't happen from anywhere but a release candidate on `develop`.

**Why this priority**: The fake sign-in has no real authentication, the fake Strava's pages
imitate a Strava sign-in, and sharing a Cloudflare account puts the sandbox near real rider
data. Cloudflare alone can't fully keep them apart (see FR-011), so these controls matter.

**Independent Test**: Open a sandbox without access and get refused. Run the sandbox
deployment on another branch and see the credential withheld. Point a sandbox's configuration
at a production resource and see the check fail.

**Acceptance Scenarios**:

1. **Given** a visitor who isn't allowed in, **When** they open any sandbox address, **Then** they
   reach neither the app nor the fake Strava pages.
2. **Given** the access gate is misconfigured or removed, **When** a request arrives, **Then** the
   sandbox refuses it.
3. **Given** a run on any ref but `develop`, **When** it asks for the sandbox credential, **Then**
   GitHub withholds it.
4. **Given** a sandbox configuration naming a production database, queue, Worker or host,
   **When** the checks run, **Then** they fail.
5. **Given** the production build, **When** it is inspected, **Then** it contains no fake mode, and
   fake mode refuses every host except local ones and the configured sandbox hosts.

---

### User Story 5 - Sandboxes can't use up production's allowance (Priority: P2)

Sandbox work stays within a budget and stops before it could affect production, so the
account can stay on the Free plan.

**Why this priority**: Without this, one reset could stop production's database for the rest
of the day, and the only safe answer would be to start paying.

**Independent Test**: With the account's usage above the budget's threshold, try a deployment
and a reset, and see both refused with a clear message before writing anything.

**Acceptance Scenarios**:

1. **Given** the account has used more than the threshold of a daily allowance, **When** a
   sandbox deployment or seeding stage starts, **Then** it stops before writing and says why,
   and the gate treats that as a failed deployment.
2. **Given** Cloudflare's usage figures are unavailable, **When** seeding starts, **Then** it
   doesn't run.
3. **Given** the account's cron limit, **When** the sandboxes are configured, **Then** they use no
   cron triggers, and the maintainer can run scheduled work on demand from `/_dev/`.
4. **Given** no sandbox chosen, **When** a release happens, **Then** sandboxes use no writes,
   cron runs or queue operations.

---

### User Story 6 - Migrations rehearsed, realistic data, and a way back (Priority: P2)

A sandbox keeps its data between releases, so each release's migrations run against older
rows as a batch, as in production. Synthetic data can grow to production's size in daily
stages, and the maintainer can rebuild a stuck sandbox with one button.

**Why this priority**: Migrations only go forward and are the failure hardest to undo in
production. The small sample set also hides problems of scale.

**Independent Test**: Deploy a release with a migration onto a sandbox that holds an earlier
release's data, then run **Reset sandbox** and see it rebuilt.

**Acceptance Scenarios**:

1. **Given** a sandbox holding data from an earlier release, **When** a release with migrations
   deploys, **Then** the migrations are applied to that data before the new code goes live.
2. **Given** a failing migration, **When** it runs, **Then** the code isn't deployed, the sandbox
   keeps its previous version, and the message on the pull request says so.
3. **Given** a scale profile larger than one day's budget, **When** seeding runs, **Then** it writes
   up to the budget, leaves a usable sandbox, says how far it got, and continues from there
   on the next run.
4. **Given** a completed seed, **When** the totals are compared to the profile, **Then** they match
   within 10% and every generated rider is synthetic.
5. **Given** the sample riders of feature 006, **When** a sandbox is seeded, **Then** they are still
   there, and offered first at the fake sign-in.
6. **Given** a stuck or messy sandbox, **When** the maintainer runs **Reset sandbox**, **Then** its
   database is rebuilt, migrated from the start and seeded, running the current `develop`.

---

### User Story 7 - Approve and forget (Priority: P3)

If the maintainer decides so once sandboxes have proven themselves, the up-to-date rule is
removed from `develop`. Enabling auto-merge is then the last thing the maintainer does for a
pull request without a conflict. In the same step, migrations get their own protection and
`develop` gets its own CI.

**Why this priority**: This is the original goal, but it gives up a guarantee (see Context) and
is a separate decision. While the rule is on, it already prevents the clashes that the
marker and CI on `develop` would catch, so neither is built before this step.

**Independent Test**: With the rule off, enable auto-merge on a pull request that is behind
`develop` and see it merge. Open two pull requests that each add a migration, merge one, and see
the other blocked by a git conflict.

**Acceptance Scenarios**:

1. **Given** the rule is still on, **When** a pull request with auto-merge falls behind, **Then** it
   waits for a rebase, as it does today.
2. **Given** the rule is off, **When** a pull request with auto-merge is behind and has no conflict,
   **Then** it merges as soon as its checks pass.
3. **Given** the rule is off and two merged pull requests break each other, **When** CI runs on
   `develop`, **Then** it fails, the maintainer is told, and the next release pull request's
   checks fail.
4. **Given** two open pull requests that each add a migration, **When** the first merges, **Then**
   GitHub blocks the second with a conflict, also if auto-merge is on for it.
5. **Given** a pull request that adds a migration without updating the marker, or whose
   migration isn't numbered after all others, **When** its checks run, **Then** they fail and say
   what to fix.

### Edge Cases

- **`develop` moves during a deployment**: the deployment finishes for the commit it started
  with, and its message says that commit is no longer the head. The gate stays unsettled for
  the new commit.
- **Ticking a box while required checks are still running**: the deployment waits for them,
  within a time limit. If a check fails or the wait runs out, it doesn't deploy, and that
  counts as a failed deployment with a message saying why.
- **Several clicks at once, or a click while the comment is being updated**: each sandbox
  deploys one commit at a time, a repeat click starts nothing new, and the comment ends up
  showing the actual state.
- **A click by someone without write access**: GitHub doesn't let them edit the comment, and the
  workflow checks the sender's permission again. A look-alike comment by another author is
  ignored.
- **A required sandbox nobody wants any more**: **Accept** settles it for that commit. If `develop`
  moves again, that sandbox is offered again.
- **The workflow behind the gate is itself broken**: the fix merges to `develop`, which runs it on
  the new head. If that isn't possible, the owner temporarily removes the check from the
  ruleset, as documented, since `main`'s ruleset has no bypass list.
- **Cloudflare or the sandbox is down**: **Accept** clears the gate. Production's own deployment
  doesn't depend on any sandbox.
- **Release pull request closed and reopened**: the gate is worked out again for the head
  commit, and an earlier acceptance still counts only if it was for that commit.
- **A hotfix merged into `main` but not yet back in `develop`**: the sandbox runs `develop`, so it
  lacks the hotfix until the `sync/*` back-merge. That back-merge moves `develop`, and the gate
  handles it like any other move.
- **Migration applied, then the code deployment fails**: the sandbox keeps the previous code on
  the newer database, the state production would be in. Migrations must stay compatible, so
  this also tests that rule.
- **A migration edited after a sandbox applied it**: only possible while unreleased. The sandbox
  no longer matches, and **Reset sandbox** recovers it.
- **A reset during a deployment, or the other way round**: they wait for each other. A reset
  doesn't count as a deployment for the gate, because it isn't seeded in full on one run.
- **Time-dependent sandbox data going stale**: fake mode's clock and **Reset sandbox** cover it.
- **Sandbox use in the admin view**: Cloudflare's figures are account-wide, so they include the
  sandboxes. That is correct for limits shared by the account. The budget keeps sandbox work
  below the point where the view's 80 % alert would fire because of it.

## Requirements *(mandatory)*

### Functional Requirements

**The sandboxes**

- **FR-001**: There MUST be one sandbox per team, starting with Hamburg's, each with its own
  Worker, database, queue, address and secrets, sharing none of them with production or with
  another sandbox. Adding a team's sandbox MUST need only its resources and one entry in the
  list of sandboxes, in line with 026 FR-004.
- **FR-002**: A sandbox MUST run fake mode and MUST NOT be able to reach the real Strava: no
  real Strava credentials exist there, and every Strava request goes to the fake.
- **FR-003**: A sandbox MUST show which commit it runs and that it isn't the real app. This
  lives in the fake-mode layer and changes nothing in the production bundle (it is
  developer-facing, like the `/_dev/` pages, so it needs no catalog entry).
- **FR-004**: The app code MUST be the same as production's, apart from fake mode's existing
  wrapper, so that what's tried is what would be released.

**Choosing at release time**

- **FR-005**: The **Release PR** workflow MUST have one checkbox per sandbox, off by default,
  each with a short description saying when it can be skipped.
- **FR-006**: The guidance MUST be repeated in the first message on the release pull request and
  in the contributor docs, and MUST say at least:
  - **Can be skipped**: only docs, specs, tests, CI or developer tooling changed, or the
    change was already seen working.
  - **Worth deploying**: migrations; anything visible to riders; queue, webhook, cron or rule
    changes; team settings or team data; a large release; or when unsure.
  - **Which sandbox**: the team changed, or any one for changes shared by all teams.
  - **What it can't show**: anything needing the real Strava, such as sign-in, real webhooks
    and rate limits.
- **FR-007**: The guidance is advice only. Nothing MUST force a sandbox based on what changed.
- **FR-008**: The workflow MUST honour ticked boxes when a release pull request is already open
  (deploying its current head), and MUST NOT deploy when `develop` has nothing `main` lacks.
- **FR-009**: Deployment MUST also be possible by hand on `develop`. With a release pull request
  open, it counts as choosing that sandbox. Without one, it only reports in its own run.

**Access and isolation**

- **FR-010**: A sandbox MUST be reachable only through Cloudflare Access, by people the maintainer
  allows, and MUST fail closed: a request that didn't pass the access gate gets no app page and
  no fake Strava page, even if the gate is misconfigured. Addresses may appear in the public pull
  request.
- **FR-011**: The sandbox credential MUST be released by GitHub only to runs on `develop`, and
  MUST be as narrow as Cloudflare allows: limited to the sandbox Workers if possible, with
  database access only if the plan shows it can't be avoided. The plan's Constitution Check
  MUST state what the credential could still reach. Cloudflare's docs say deploying a Worker
  needs no permission on what it binds to, so a Worker-limited credential could probably still
  bind production's database, whose ID is public. The sandbox credential MUST therefore be
  treated as sensitive. The production credential stays unlockable from `main` only.
- **FR-012**: A check MUST fail if a sandbox's configuration names any production Worker,
  database, queue or host.
- **FR-013**: 006 FR-009 MUST be amended: fake mode still can't activate in production and `src/`
  still never imports `dev/`, but it answers local hosts plus exactly the configured sandbox
  hosts. It MUST refuse every other host, and an automated test MUST cover this, including the
  production domain.
- **FR-014**: A sandbox's session MUST NOT be valid for production or be sent to it, even with both
  on the same domain.

**Deployment**

- **FR-015**: A sandbox MUST deploy only a commit of `develop` whose required checks passed,
  applying pending migrations before the code, as production does.
- **FR-016**: A deployment MUST keep existing sandbox data.
- **FR-017**: Each sandbox MUST deploy one commit at a time and MUST NOT replace a newer commit
  with an older one. One sandbox's failure MUST NOT stop another's deployment.
- **FR-018**: Nothing MUST deploy to a sandbox unless someone chose it. `develop` moving MUST
  NOT redeploy by itself.
- **FR-019**: The maintainer MUST be able to run **Reset sandbox** by hand per sandbox, which
  rebuilds its database, applies all migrations from the start, seeds it within the budget,
  and leaves it on the current `develop`.

**Messages on the release pull request**

- **FR-020**: Every deployment MUST add one message per sandbox, posted when it finishes: its link,
  the commit, migrations applied, and, on failure, the reason and a link to the run. Messages
  MUST hold nothing secret, because the repository is public.
- **FR-021**: One control comment MUST show the current commit, the gate's state and reason, the
  commits new since the last deployment or decision, the skip guidance, and the available
  actions.
- **FR-022**: Each action MUST be a single click inside the pull request, such as ticking a box in
  the control comment. There MUST be one deploy action per sandbox and one **Accept**. If the plan
  finds a tick unreliable, the fallback is a short command as a comment, not a trip to another
  page.
- **FR-023**: An action MUST take effect only if the sender has write access, the comment is the
  workflow's own control comment, and the commit it shows is still the head. Otherwise it
  changes nothing and the comment is refreshed.

**The gate**

- **FR-024**: A new required check, `sandbox-gate`, MUST be added to `main`'s ruleset, and not to
  `develop`'s. It MUST follow the table in Context, and MUST be reported for every pull request
  into `main`, so that none waits for a check that never arrives.
- **FR-025**: The gate MUST be decided for the exact head commit. A deployment or acceptance for
  another commit MUST NOT count.
- **FR-026**: The required sandboxes MUST be those chosen so far on this pull request. Choosing
  more adds to them, and only **Accept** settles a commit without them.
- **FR-027**: `develop` moving MUST leave the gate blocking until a new decision, also when no
  sandbox was chosen earlier.
- **FR-028**: **Accept** MUST record who accepted and for which commit, in the pull request.
- **FR-029**: Enabling auto-merge MUST wait for the gate like any other required check.
- **FR-030**: Production's deployment MUST NOT depend on any sandbox. The gate acts only on merging.
- **FR-031**: The check MUST be added to the ruleset only after the workflow reporting it is on
  `develop` and has reported on a pull request into `main`, as the rulesets README already
  requires for new checks. `.github/rulesets/README.md`, `CLAUDE.md` and 002 FR-012's list of
  checks MUST be updated in the same change.

**Staying on the free plan**

- **FR-032**: Sandboxes MUST use no cron triggers on the Free plan, leaving the account's 5 for
  production. `/_dev/` MUST offer the scheduled work on demand.
- **FR-033**: A deployment or seeding stage MUST first check the account's use of today's
  allowances and MUST stop before writing if rows written, rows read or queue operations are
  above a threshold, set by default to 50 %.
- **FR-034**: One day's seeding across all sandboxes MUST write at most a set budget of rows,
  set by default to 20,000, counting index writes, and MUST NOT use the queue for bulk data.
  Unseeded remainder continues on the next run.
- **FR-035**: Seeding MUST leave a usable sandbox after every stage and MUST fit the Free plan's
  limit of 10 ms of CPU per Worker request, by running in small steps or outside a request.
- **FR-036**: The 026 per-team shares MUST NOT count a sandbox as a team, and a sandbox MUST NOT
  record usage or send usage alerts.
- **FR-037**: Moving to the Paid plan MUST need only settings changed: the budget, the threshold,
  the admin view's limits (025), and cron triggers if wanted. This feature MUST NOT move the
  account, and the plan MUST say which observed conditions would justify the decision.

**Data**

- **FR-038**: Production data MUST NOT reach a sandbox: no copy, no subset, and no anonymised or
  pseudonymised version.
- **FR-039**: A sandbox MUST be seeded with the existing sample riders plus synthetic riders
  generated towards the scale profile. Generated data MUST be invented, with no real names or
  IDs and no GPS data (006 FR-011).
- **FR-040**: The scale profile MUST hold only rounded totals: the number of riders, typical and
  largest activity counts per rider, and the number of events. Figures MUST be rounded coarsely
  enough that none is an individual's exact figure, and MUST NOT name any rider.
- **FR-041**: Reading the totals from production is a manual, read-only step by the maintainer,
  never part of CI or a deployment.

**Merging**

- **FR-042**: `.github/repository-settings.md` MUST record the sandbox environment and credential,
  which are manual steps of the maintainer, along with the auto-merge setting already recorded
  there.
- **FR-043**: The up-to-date rule MUST stay on until the maintainer decides otherwise. Removing it
  MUST be a separate, manual step, done only after SC-007, in a change that also updates
  `.github/rulesets/develop.json`, its README, 002 FR-008, FR-012 and R7, and the comment in the
  CI workflow.
- **FR-044**: That same step MUST add:
  - Checks on every push to `develop`, unless they already passed on exactly that content, with
    failures reaching the maintainer by the existing failure e-mail.
  - One tracked migration marker naming the latest migration on a single line, so any two pull
    requests adding a migration conflict in git.
  - A required check that fails when the marker doesn't name the highest-numbered migration, when
    two migrations share a number, or when a new migration isn't numbered above every migration
    on its target, and says how to fix it. Conflicts are resolved by rebasing, renumbering the
    later migration and updating the marker.
- **FR-045**: Removing the rule MUST NOT change the merge methods of 002 FR-009b, the rule's absence
  on `main`, or the checks of a release pull request.
- **FR-046**: The contributor docs (`README.md`, `CLAUDE.md`) MUST describe the sandboxes, the
  checkboxes and their guidance, the gate and its override, reset, and the ruleset fallback.

### Key Entities

- **Sandbox**: One team's deployment for trying a release; runs one commit at a time and holds
  only synthetic data.
- **Control comment**: The release pull request's one comment showing the gate's state for the
  current commit and offering its actions.
- **Decision**: For one sandbox and one commit, a deployment and its result; or for one commit, an
  acceptance, with who made it.
- **Free-plan budget**: The threshold and the daily seeding limit that keep sandbox work away from
  production's allowance.
- **Scale profile**: Rounded totals describing production's size, with nothing about any
  individual.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A release with no sandbox chosen and no move of `develop` needs no more steps than
  today.
- **SC-002**: Within 30 minutes of choosing a sandbox, it runs the head commit and the pull request
  has its message and link, provided the required checks pass.
- **SC-003**: Every gate decision that needs the maintainer takes one click inside the pull
  request, with no other page opened.
- **SC-004**: No release merges with its head commit undecided: in a test of every row of the
  gate's table, the merge is allowed only on the rows that pass.
- **SC-005**: A visitor without access reaches zero app or fake Strava pages, also with the access
  gate removed in a test. No production row, token or secret is ever in a sandbox or its
  deployment path, and sandboxes make zero requests to the real Strava.
- **SC-006**: Sandbox work causes zero production failures from a used-up allowance, and costs $0
  until the maintainer decides otherwise. Sandbox seeding never takes the account above the
  threshold plus one stage.
- **SC-007**: Before the up-to-date rule is removed, at least 3 releases over at least 2 weeks have
  gone through a sandbox, with every failure explained.
- **SC-008**: After the rule is removed, a pull request with no conflict that isn't adding a
  migration needs zero maintainer actions after enabling auto-merge, and two migration pull
  requests can never both merge unless the later one's checks re-ran after the earlier merged.
- **SC-009**: A hotfix waits for no sandbox, and a sandbox failure delays a release by at most one
  click.

## Assumptions

- Ticking a box in a comment reaches a workflow, and the comment workflow runs from `develop`,
  the default branch, so a fix there works at once. To be tried in planning, including clicks
  racing the comment's updates.
- Per-Worker credential roles are available on the Free plan and cover a deployment with a queue
  consumer and assets. Cloudflare's docs don't state this, and they say creating a Worker needs
  a wider role, so the maintainer creates each sandbox's resources by hand once. To be confirmed
  in planning, including whether database access can be limited to one database (none found).
- Cloudflare Access can protect a sandbox on a subdomain of the production domain on the Free
  plan, for at least the few people who need it, so no second domain is needed. To be confirmed
  in planning.
- A check can be reported for a commit from a workflow in a way the ruleset's GitHub Actions pin
  accepts. To be confirmed in planning.
- Sandbox traffic is a handful of people, so requests and reads stay small. Production's real use
  of the allowances is visible in the admin view (025) and informs the budget's defaults.
- The maintainer is the only sandbox user at first and can allow others by e-mail address.
- Rounded totals describing the size of a team aren't rider data, so reading them for this purpose
  doesn't extend the riders' consent. The check against Principle I belongs in the plan.
- Rider-facing text is unchanged, so no catalog entries are needed. Pull request messages are for
  the maintainer and in English.
- The second team's sandbox arrives with feature 026, not with this feature.

## Out of Scope

- Deploying a pull request other than the release pull request to a sandbox, and one sandbox per
  pull request.
- Deploying on every merge to `develop`, and redeploying by itself when `develop` moves.
- Recommending or forcing a sandbox based on what changed.
- Hotfixes going through a sandbox.
- Making the pull request's one-click actions work from the GitHub phone app.
- The real Strava in a sandbox, in any form.
- Moving the account to the Paid plan.
- A separate Cloudflare account for sandboxes.
- Automatic rebasing of waiting pull requests, and moving the repository to an organization for a
  merge queue.
- Automated browser tests against a deployed sandbox; the existing Playwright tests stay on CI's
  local fake mode.
