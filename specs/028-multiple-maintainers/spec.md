# Feature Specification: Multiple Maintainers

**Feature Branch**: `028-multiple-maintainers`

**Created**: 2026-11-04

**Status**: Draft

**Input**: User description: "We need to accommodate at least two maintainers with mostly equal
rights, on Cloudflare and on GitHub. The Strava API secret belongs to me personally and will
never be shared. People may deploy and so on; I just don't want to share the secret itself."

## Context

The project has one maintainer, and much of its setup assumes that: the repository sits on a
personal account, the release token is that person's, and the docs speak of "the maintainer"
throughout. At least two maintainers with mostly equal rights are expected. They may come from
Team Rynkeby Hamburg or Team Rynkeby Europe, and this design doesn't depend on which.

**Terms**: A **maintainer** can merge, release, deploy and administer the project's GitHub and
Cloudflare setup. The **Strava owner** is the founding maintainer, who personally owns the Strava
app and its secret. The **app's admin role** (feature 025) is a separate thing: it is a role inside
the app, and being a maintainer neither grants nor requires it. The **data controller** is the term
data protection law uses for whoever decides why and how personal data is processed, and who answers
to riders and authorities for it. It's named on the privacy page through `PRIVACY_CONTROLLER`: the
founding maintainer today, and each team's own responsible person once spec 026 adds a team.

### What equal rights can and can't mean

The founding maintainer's extra GitHub rights last until stage 2 (see Approval, for now). The Strava rows
have no end date.

| | Every maintainer | Founding maintainer only |
|---|---|---|
| Open pull requests, run **Release PR**, merge once approved, re-deploy | ✓ | |
| Approve pull requests | From stage 2 | Until stage 2 |
| Merge their own pull requests with no approval | | Until stage 2 |
| Accept on the sandbox gate (spec 027), rather than deploy | From stage 2 | Until stage 2 |
| Change code, including code that handles the Strava secret | ✓ | |
| Own the organization; administer the repository, rulesets and environments | From stage 2 | Until stage 2 |
| Administer the Cloudflare account | ✓ | |
| Set or rotate other production secrets | ✓ | |
| Know the Strava secret's value | | ✓ |
| Set or rotate the Strava secret | | ✓ |
| Act on the Strava app: settings, Developer Program, contact with Strava | | ✓ |
| Run the app locally against the real Strava (`pnpm dev:strava`) | | ✓ |

### The accepted limit

Nobody else is ever given the Strava secret, and Cloudflare doesn't show it after it's set. But the
running Worker holds it, so anyone who can deploy production code could technically read it by
changing the code. The same goes for riders' tokens and data. The Strava owner accepts this: it
rests on trust in the people made maintainers and on the visible history of what was merged. This
feature writes the limit down and doesn't engineer around it.

### Approval, for now

Every pull request needs the founding maintainer's approval before it merges, unless they wrote it
themselves, and they alone own the organization. This is how trust gets built, not a permanent rule. The
way to change it is written down now:

| Stage | Who must approve | Organization owners | When one maintainer is away |
|---|---|---|---|
| 1 (now) | The founding maintainer, on every pull request they didn't write | The founding maintainer | If it's the founding maintainer, merges wait; production can be rolled back or taken down |
| 2 | Another maintainer, on every pull request | Every maintainer | With only two maintainers, merges wait unless an owner changes the rule |

There's no date or automatic trigger for stage 2: the founding maintainer decides when. Moving to it is a
ruleset change, making the second maintainer an owner, and a docs update.

### Why this reaches the original merge problem

A repository on a personal account has a single owner, and collaborators can't administer it, so
equal rights mean moving the repository to an organization. GitHub's docs say merge queues are
available for public repositories owned by an organization, which would include this one on the
free plan. A queue tests each pull request against its exact merge target with no manual rebase,
which is what spec 027's User Story 7 gives up the guarantee to get. This feature decides between
them (User Story 5).

## Clarifications

### Session 2026-11-04

- Q: What does "never share the Strava secret" cover? → A: Its value. Other maintainers may
  deploy, merge and change code, and the technical limit that follows is accepted.
- Q: Does this belong in spec 027? → A: No. It affects the whole project. Spec 027's only
  dependency is that its workflows and credentials aren't tied to one person.
- Q: Which team does a maintainer come from? → A: It doesn't matter here. Separating maintainers'
  rights by team is out of scope.
- Q: Are approvals required? → A: Yes, for now: the founding maintainer's. A documented plan says how
  this can change once trust is built.
- Q: When does the second maintainer become an organization owner? → A: At stage 2, not before.
- Q: Which merge methods stay? → A: Merge commits only. Squash merging is forbidden outright.
- Q: What if the founding maintainer stops running the Strava app? → A: They intend to support it for a
  prolonged period. If needed, a controlled move to someone else controlling the app gets planned then.
  Nothing further is planned now.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A second maintainer can run the project on GitHub (Priority: P1)

A second maintainer can merge approved pull requests and release, needing nothing from the founding
maintainer except that approval. From stage 2 they also administer the repository.

**Why this priority**: This is the feature's purpose, and only an organization allows a second owner
at stage 2.

**Independent Test**: With the founding maintainer doing nothing but approving, the second maintainer
merges a pull request into `develop`, runs **Release PR**, and merges the release. Confirm they can't
change a ruleset at stage 1, and can at stage 2.

**Acceptance Scenarios**:

1. **Given** stage 2, **When** the second maintainer changes a ruleset or environment, **Then** it works,
   and the docs' commands for checking it pass for them too.
2. **Given** a hotfix is needed, **When** the founding maintainer approves it, **Then** the second
   maintainer can merge and deploy it. Without that approval it waits (see Edge Cases).
3. **Given** the move to the organization, **When** it's finished, **Then** every ruleset,
   environment, secret, required check and production deployment works as before, and old links
   redirect.
4. **Given** stage 2, **When** one maintainer loses their account, **Then** the other can still
   administer everything.

---

### User Story 2 - A second maintainer can run the project on Cloudflare (Priority: P1)

A second maintainer can see, deploy and administer the Cloudflare account with their own login.

**Why this priority**: Without this, a second maintainer can merge but can't investigate or repair
production.

**Independent Test**: The second maintainer signs in with their own login, finds production's logs
and usage, sets a non-Strava secret on a test Worker, and confirms the Strava secret's value isn't
shown.

**Acceptance Scenarios**:

1. **Given** the second maintainer's own login, **When** they open the account, **Then** they can
   reach Workers, databases, queues, usage, logs and Access.
2. **Given** a production deployment, **When** CI runs it, **Then** its credential belongs to the
   account or organization, and keeps working if either maintainer leaves.
3. **Given** the account, **When** a decision about billing, the domain or a future spending cap
   comes up, **Then** the docs say who decides.

---

### User Story 3 - The Strava secret stays with its owner (Priority: P1)

The Strava secret's value is known only to the Strava owner, and the project works without anyone
else needing it.

**Why this priority**: This is the one firm limit on equal rights.

**Independent Test**: Follow the contributor docs as a new maintainer, from a fresh setup through a
release and a production deployment, and never be asked for the Strava secret.

**Acceptance Scenarios**:

1. **Given** a new maintainer, **When** they develop locally, **Then** fake mode covers their work,
   and nothing asks them for the secret.
2. **Given** a production deployment by any maintainer, **When** it runs, **Then** the Strava secret
   stays set without anyone entering it.
3. **Given** a new team's Worker needs the Strava secret, **When** it's set up (feature 026), **Then**
   the docs say that step belongs to the Strava owner, and how the rest proceeds without them.
4. **Given** the docs, **When** a maintainer reads them, **Then** the accepted limit is stated plainly.

---

### User Story 4 - Rider data access is a deliberate, disclosed decision (Priority: P1)

Before anyone new gets production access, the data controller decides on it, and what riders are
told stays true.

**Why this priority**: Production access reaches real rider data. Riders consented on the basis of
what they were told, and losing their trust or Strava's would end the project (constitution
Principle I).

**Independent Test**: Read the privacy page and the recorded decision, and check that they name who
is responsible, how to reach them, and who can reach rider data.

**Acceptance Scenarios**:

1. **Given** a proposed new maintainer, **When** production access is about to be granted, **Then** a
   decision by the data controller is on record first.
2. **Given** the review, **When** it finds that riders must be told more, **Then** the privacy page
   and, if needed, the consent text and version change before access is granted.
3. **Given** a rider writes to the contact address, **When** one maintainer is away, **Then** the other
   can receive and act on it.
4. **Given** a maintainer without the app's admin role, **When** they open the app, **Then** being a
   maintainer shows them nothing more there.

---

### User Story 5 - Decide between a merge queue and removing the up-to-date rule (Priority: P2)

With the repository in an organization, the maintainers try a merge queue on `develop`, and either
adopt it or fall back to spec 027's User Story 7.

**Why this priority**: A queue could give the original goal, approve and forget, without giving up
testing against the exact target. It depends on User Story 1.

**Independent Test**: Try the queue on a scratch repository in the organization with this
repository's merge methods and required checks, and record whether each works.

**Acceptance Scenarios**:

1. **Given** a queue on `develop`, **When** two pull requests that don't conflict are queued, **Then**
   each is tested with the other ahead of it, and both merge with no manual rebase.
2. **Given** two queued pull requests that break each other, **When** the queue tests the second,
   **Then** it's removed from the queue, and `develop` stays working.
3. **Given** the trial's result, **When** the decision is made, **Then** spec 027's User Story 7 is
   either dropped or kept, and that spec says which.

---

### User Story 6 - No single person is a hidden dependency (Priority: P2)

Automation and alerts keep working whichever maintainer is away, and the project knows what happens
if the Strava owner is unavailable.

**Why this priority**: Two maintainers are only worth it if either can be absent. Some dependencies,
like a personal token expiring, fail quietly until the day they're needed.

**Independent Test**: List every credential in the repository's and account's settings, and find
its owner. Read the continuity section as if the Strava owner were unreachable.

**Acceptance Scenarios**:

1. **Given** **Release PR**, **When** either maintainer runs it, **Then** it works, and it doesn't use
   one person's token.
2. **Given** a failed deployment or a usage alert, **When** it happens, **Then** both maintainers are
   told.
3. **Given** the Strava owner is unavailable, **When** a maintainer reads the docs, **Then** they find
   what keeps working, what doesn't, and what they may do about it.

---

### User Story 7 - A maintainer can join or leave cleanly (Priority: P3)

Adding or removing a maintainer follows a written checklist, with no production downtime.

**Why this priority**: It happens rarely, but when it does, nobody should have to work out what that
person could reach.

**Independent Test**: Walk through the leaving checklist on a test account and confirm production
keeps running and that person's access is gone everywhere.

**Acceptance Scenarios**:

1. **Given** a maintainer leaves, **When** the checklist is followed, **Then** their GitHub and
   Cloudflare access is gone, and production never stops.
2. **Given** a departure where trust isn't assured, **When** the checklist is followed, **Then** it says
   what to rotate, who can do each step, and that the Strava owner handles the Strava secret.
3. **Given** the Strava owner no longer wants to run the Strava app, **When** that comes up, **Then** the
   docs say a controlled move gets planned at that point (see Edge Cases).

---

### User Story 8 - The founding maintainer approves, for now (Priority: P1)

Nothing merges that the founding maintainer hasn't written or approved, and the docs say how that rule
can be loosened later.

**Why this priority**: The founding maintainer wants trust built before giving up this control, and it
has to be in place when a second maintainer gets access.

**Independent Test**: As the second maintainer, try to merge a pull request without approval, then
approve it as the founding maintainer and merge. As the founding maintainer, merge your own with no
approval.

**Acceptance Scenarios**:

1. **Given** a pull request the founding maintainer didn't write, into `develop` or `main`, **When**
   nobody has approved it, **Then** it can't merge. This includes hotfixes, release pull requests and
   Dependabot's.
2. **Given** approval from anyone else, **When** someone tries to merge, **Then** it still can't merge.
3. **Given** an approved pull request, **When** a new push arrives, **Then** it needs approving again.
4. **Given** the founding maintainer's own pull request, **When** its checks pass, **Then** it merges
   with no approval.
5. **Given** trust has been built, **When** the founding maintainer moves to stage 2, **Then** the docs
   say what to change, including making the second maintainer an owner.

---

### User Story 9 - Merge commits only (Priority: P2)

Squash merging is gone, so `develop` and `main` take only merge commits.

**Why this priority**: One merge method is simpler, and it removes one obstacle to a merge queue. It
doesn't depend on the organization and can ship first.

**Independent Test**: Try to squash-merge a pull request, and confirm that GitHub refuses it. Then run
**Release PR** after merging a branch with several commits.

**Acceptance Scenarios**:

1. **Given** a pull request into `develop`, **When** it's merged, **Then** merge commit is the only
   method offered.
2. **Given** a merged branch with several commits, **When** **Release PR** runs, **Then** the release
   pull request lists that change once, by its pull request's title.
3. **Given** a branch commit with a bad message, **When** its pull request runs its checks, **Then**
   `commit-messages` fails, because that commit will stay in `develop`'s history.

### Edge Cases

- **Two maintainers disagree, or one acts against the project**: until stage 2, the founding maintainer
  can remove the other from GitHub. From stage 2 either can remove the other, and on Cloudflare they can
  from the start. This rests on trust, like the accepted limit, and the history of settings and merges is
  what's left to go on.
- **The future of the Strava app**: it's associated with the founding maintainer's personal Strava account.
  They intend to support it for a prolonged period. If needed, a controlled move to someone else controlling
  the app gets planned at that point. Nothing further is planned now.
- **The founding maintainer is unreachable for a while**: the app keeps running on the secret already set, and
  the current `main` can be re-deployed. Merges wait for their approval, and so do releases and hotfixes. So do
  rotating the secret, setting up a new team's Worker, anything at Strava, and until stage 2 every GitHub
  setting. If production is broken, another
  maintainer may roll back to an earlier version or take the Worker down in Cloudflare, as a break-glass step,
  and records why.
- **The founding maintainer loses their GitHub account at stage 1**: they're the organization's only owner, so
  nobody else can administer it. Their recovery codes are the safeguard, and this risk is accepted until stage 2.
- **Deploying around the approval rule**: Cloudflare access is what makes a rollback possible, and it also lets a
  maintainer publish code directly. This rests on trust, like the accepted limit. It's a break-glass step, and
  Cloudflare's deployment history shows it.
- **The Strava secret may have leaked**: any maintainer alerts the Strava owner, who rotates it. If the
  owner can't be reached, a maintainer may disable the app's Strava access by taking the Worker down, as
  the deciding person at that moment, and records why.
- **A workflow or release running during the transfer**: the transfer happens with no release pull request
  open and no deployment running, and a re-deploy afterwards proves the path.
- **Open pull requests during the transfer**: they move with the repository.
- **The organization's name**: it's public and shows in every link, so it should suit both teams. The founding
  maintainer chooses it.
- **Required checks in a merge queue**: `commit-messages`, `pr-title` and `pr-source` run on pull requests
  only today, so the queue would wait for checks that never arrive unless they're handled.
- **Merge methods in a merge queue**: a queue uses merge commits, like every other merge once squash merging is
  forbidden, so this stops being an obstacle.
- **Spec 027's sandboxes and the shared credential**: a sandbox's credential follows the same rule, so it
  can't belong to one person either.

## Requirements *(mandatory)*

### Functional Requirements

**Who may do what**

- **FR-001**: The project MUST have at least two maintainers' worth of access available, and the docs MUST
  state who may do what, following the table in Context. Rights MUST NOT depend on a maintainer's team.
- **FR-002**: The accepted limit MUST be written into the contributor docs and the constitution's Principle
  I, which MUST otherwise keep its rules on secrets. The constitution's other references to a single
  maintainer MUST be reviewed, with the version updated per its policy.
- **FR-003**: Maintainer rights and the app's admin role MUST stay separate, and this feature MUST NOT change
  what any role sees in the app.

**GitHub**

- **FR-004**: The repository MUST move to an organization owned by the founding maintainer. Until stage 2, the
  second maintainer MUST have a role that can merge and run **Release PR** but can't change rulesets, and the
  founding maintainer stays the only owner. At stage 2 they MUST become an owner. Owners MUST use two-factor
  authentication.
- **FR-005**: The move MUST keep issues, pull requests, secrets, environments, rulesets, required checks and
  the production deployment path working, each verified afterwards. Anything GitHub doesn't carry over MUST
  be re-applied from the repository's records.
- **FR-006**: References to the old location MUST be updated, including the commands in
  `.github/repository-settings.md` and `.github/rulesets/README.md`.
- **FR-007**: Every pull request into `develop` or `main` that the founding maintainer didn't write MUST have
  their approval before it merges, including hotfixes, release pull requests and Dependabot's. Approval from
  anyone else MUST NOT count, and a new push MUST need a new approval. The founding maintainer's own pull
  requests MUST merge without any approval.
- **FR-030**: The docs MUST hold the plan for moving to stage 2, following the table in Context: what changes, and
  that the founding maintainer alone decides when. Until they do, FR-007 stands. At stage 2, every pull request MUST
  need approval from a maintainer other than its author.
- **FR-008**: `RELEASE_PR_TOKEN` MUST be replaced by a credential not tied to one person, which still starts
  the required checks on the pull request it opens and is still available only to runs on `develop`.
- **FR-009**: No workflow or credential MUST depend on one maintainer's personal account. This includes spec
  027's sandbox workflows and credential.

**Cloudflare**

- **FR-010**: Each maintainer MUST have their own Cloudflare login as a member of the one shared account, with
  enough rights for everything in the table in Context. No login MUST be shared.
- **FR-011**: CI's Cloudflare credentials MUST be owned by the account, not by a person, if Cloudflare offers
  this on the plan in use. If it doesn't, the docs MUST say whose they are and what to do when that person
  leaves.
- **FR-012**: The docs MUST say who owns billing, the domain and the decision on a Paid plan or a spending
  cap. The move MUST NOT start any payment.

**The Strava secret**

- **FR-013**: The value of the Strava secret MUST NOT be given to anyone else, through any channel, and MUST NOT
  be in the repository, CI configuration or any shared document.
- **FR-014**: No routine task MUST need the secret's value: developing, testing, merging, releasing, deploying
  and administering all work without it.
- **FR-015**: `pnpm dev:strava` MUST stay limited to the Strava owner, and the docs MUST point every other
  maintainer to fake mode.
- **FR-016**: The docs MUST list what only the Strava owner can do, including setting up the secret for a new
  team's Worker (spec 026).

**Rider data and privacy**

- **FR-017**: Before production access is granted to a new maintainer, the data controller MUST record a decision
  covering who gets access and on what basis, including whether Strava's API Agreement allows it.
- **FR-018**: That review MUST check whether a maintainer's access counts as "newly shown to someone other than
  the rider" under Principle I's consent rule. If it does, a new consent version MUST be in place first.
- **FR-019**: The privacy page MUST name who is responsible and how to reach them, accurately for the new setup,
  with `PRIVACY_CONTROLLER` and `CONTACT_EMAIL` changed if needed.
- **FR-020**: The contact address MUST reach every maintainer who handles rider requests, so that deletion and
  other requests are met promptly when one is away.
- **FR-021**: Manual commands that reach production data stay deliberate manual steps. `pnpm season:album` without
  `--local` stays with the data controller, because the privacy page says albums are made on that person's
  computer, unless that text is changed first. Rider data MUST NOT be copied out for anything else (constitution
  Principle I, spec 027 FR-038).

**Merge queue**

- **FR-022**: Once the repository is in the organization, the maintainers MUST try a merge queue on `develop` and
  record the result, covering the required checks listed in Edge Cases and its fit with FR-007.
- **FR-023**: If the queue works, it replaces spec 027's User Story 7 and migration marker, and `develop` keeps its
  guarantee of testing against the exact target. If it doesn't, spec 027's User Story 7 stands as written. Either
  way, spec 027 MUST be updated to say so.
- **FR-024**: Spec 002 FR-008, FR-009b, FR-012 and R7, the rulesets and their README MUST be updated to match the
  outcome.

**Merge method**

- **FR-031**: Squash merging MUST be forbidden, in the repository's settings and in `develop`'s ruleset. A merge
  commit MUST be the only method on `develop` and `main`, and rebase merging stays off. This MUST NOT wait for the
  move to the organization or for the merge queue.
- **FR-032**: **Release PR**'s description MUST list one line per merged pull request, by its title, and not every
  commit on its branch. It MUST keep leaving out releases and `sync/*` back-merges.
- **FR-033**: Pull request titles MUST stay Conventional Commits, and every branch commit MUST keep passing
  `commit-messages`. The `pr-title` check, the squash settings in `.github/repository-settings.md`, the rulesets'
  README, `README.md`, `CLAUDE.md` and spec 002 MUST be updated to match.

**Continuity**

- **FR-025**: Failures of deployments and usage alerts MUST reach every maintainer.
- **FR-026**: The docs MUST have a continuity section covering the founding maintainer being unavailable: what keeps
  working, what waits, and what other maintainers may do, per Edge Cases. It MUST record their intention to support
  the Strava app for a prolonged period, and that a controlled move gets planned if needed.
- **FR-027**: There MUST be written checklists for adding and removing a maintainer, listing each system, who can do
  each step, and what to rotate if trust isn't assured. Following them MUST NOT stop production.
- **FR-028**: Every credential the project depends on MUST be listed with its owner, its expiry if any, and how to
  replace it.

**Documentation**

- **FR-029**: `README.md`, `CLAUDE.md`, `.github/repository-settings.md` and `.github/rulesets/README.md` MUST say who
  may do what, in place of "the maintainer" wherever that no longer holds. Manual steps stay manual, but any
  maintainer may do them unless the table in Context says otherwise.

### Key Entities

- **Maintainer**: A person with merge, release and deploy rights and their own logins, who administers Cloudflare, and
  GitHub from stage 2.
- **Strava owner**: The founding maintainer, who alone holds the Strava secret and acts on the Strava app. This doesn't
  end at stage 2.
- **Data controller**: The person named on the privacy page as responsible for riders' data, who decides on access
  to it. Each team has its own once spec 026 applies.
- **Credential record**: For each credential the project depends on, its owner, its expiry and how to replace it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With the founding maintainer doing nothing but approving, the second maintainer completes a full cycle: a
  merge into `develop`, a release, a production deployment and a hotfix.
- **SC-002**: A new maintainer goes from a fresh setup to a working local app and a merged change with zero requests for
  the Strava secret.
- **SC-003**: Zero project credentials stop working when either maintainer's personal account is removed, apart from
  those the credential record says belong to the Strava owner.
- **SC-004**: The move to the organization causes zero production downtime, and zero required checks, environments or
  rulesets are left missing afterwards.
- **SC-005**: No maintainer gets production access before a recorded decision by the data controller.
- **SC-006**: Every deployment failure and usage alert in the first month after adding a maintainer reaches both.
- **SC-007**: After the merge queue trial, a pull request behind its target needs zero manual rebases, or the recorded
  result says why the queue wasn't adopted.
- **SC-008**: The project's costs don't rise because of this feature.
- **SC-009**: Zero pull requests reach `develop` or `main` without the founding maintainer's authorship or approval while
  stage 1 applies, and zero are squash-merged.

## Assumptions

- A free GitHub organization covers a public repository with what this project uses today: rulesets, environments,
  required checks and auto-merge. GitHub's docs indicate this, including merge queues. To be confirmed in planning,
  along with what a transfer does to rulesets, environments and the checks' GitHub Actions pin.
- Cloudflare allows a second member on the Free plan, and account-owned tokens are available on it. The docs read so far
  don't state either. To be confirmed in planning. If only a broad role is available, that's acceptable given the
  accepted limit.
- A credential not tied to one person can open pull requests that start checks, most likely a GitHub App owned by the
  organization. To be confirmed in planning.
- Strava's API Agreement allows another person to help run the app with access to its data. The Strava owner confirms
  this as part of FR-017. If it doesn't, this feature stops at access that doesn't reach rider data.
- GitHub's required approvals alone would block the founding maintainer's own pull requests, because authors can't approve
  their own. The founding maintainer accepts an exemption for this. A ruleset bypass skips every rule in that ruleset, so the
  approval rule goes in a ruleset of its own, with a bypass for organization owners, and the rulesets holding the required
  checks keep having no bypass list. At stage 1 the only owner is the founding maintainer, so this covers them alone. If a
  bypass doesn't work with auto-merge on their pull requests, a required check that looks at the author and the approvals
  replaces it. To be tried in planning, and removed at stage 2.
- GitHub's docs say the Write role can change GitHub Actions secrets. Whether it can also change the environment secrets that
  production and `Release PR` use isn't stated. To be confirmed in planning. If it can, FR-004's role needs narrowing.
- Whether the Strava app can be moved to someone else isn't known. It doesn't need answering until a move is planned.
- Rider-facing text changes only if the review in FR-018 or FR-019 requires it, in which case it follows the usual
  catalog rules.
- The maintainers are people the Strava owner trusts personally, which is what makes the accepted limit reasonable.

## Out of Scope

- Sharing the Strava secret, in any form.
- Engineering around the accepted limit, for example by moving the secret to a separate service or account.
- A second Strava app (ruled out by spec 026).
- Separating maintainers' rights by team.
- Moving to a paid GitHub or Cloudflare plan.
- Planning a move of the Strava app to someone else.
- Changing the app's admin role or what it shows.
