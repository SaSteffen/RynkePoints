# Research: Multiple Maintainers

Checked 2026-11-04. "Docs" means the provider's own documentation. Where the docs are silent or conflict, the item
names a trial in [quickstart.md](quickstart.md), and nothing below claims that trial's result.

## R1. Exempting the founding maintainer's own pull requests

**Decision**: A separate ruleset, `protect-approval`, with `require_code_owner_review`, `CODEOWNERS` naming the founding
maintainer, and organization admins on the bypass list in `exempt` mode. Trial T1 must pass first. If it fails, use the
required check in R2.

**Rationale**:

- GitHub's REST docs define `exempt` as: "rules will not be run for that actor and a bypass audit entry will not be created".
- Ordinary bypass doesn't fit. In [community discussion 208718](https://github.com/orgs/community/discussions/208718), auto-merge
  stayed blocked on "Review required" with `always` and `pull_request` modes, and GitHub support, as relayed there, called that
  intended. The same thread reports `exempt` working, including a two-ruleset setup like this one. That's community evidence,
  not documentation, hence T1.
- Code owner review is what makes "approval from anyone else doesn't count" true. `CODEOWNERS` is read from the base branch, so
  a pull request can't change its own reviewer.
- A separate ruleset keeps required checks binding on everyone, because an exemption only skips the rules in its own ruleset.

**Known gaps, accepted**:

- The exemption follows who merges, not who wrote the pull request. So the founding maintainer could merge someone else's pull
  request unapproved. FR-007 still asks them to approve; GitHub won't enforce that on them. They could change the rule anyway,
  being the only owner.
- `exempt` leaves no audit entry, so SC-009 is checked from merged pull requests' authors and reviews.

**Alternatives rejected**: `always` or `pull_request` bypass (auto-merge stays blocked); the founding maintainer clicking "merge
without requirements" each time (loses auto-merge, which was the original goal).

## R2. Fallback: a required check

**Decision**: Only if T1 fails. A job `owner-approval`, required on both branches, that passes when the author is the founding
maintainer or their latest review on the head commit is an approval. It runs on `pull_request_target` (so the base branch's copy
decides) and on `pull_request_review`, and passes trivially on `merge_group`.

**Rationale**: It works with auto-merge because to GitHub it's an ordinary check. It's the weaker choice: `pull_request_review` runs
the pull request's own copy of the workflow, so an author could change it, which a reviewer would see. That rests on trust, like
the accepted limit. Trial T1b confirms the check reports on the right commit.

## R3. Stale approvals and the up-to-date rule

**Decision**: Accept for now, and let the merge queue (R10) fix it.

**Rationale**: `dismiss_stale_reviews_on_push` is required by FR-007. While `develop` requires an up-to-date branch, a second
maintainer's pull request that falls behind is rebased, and that push may need a new approval. T2 measures this. It doesn't touch the
founding maintainer's own pull requests.

## R4. The second maintainer's GitHub role

**Decision**: An organization member with the Write role on this repository. Organization base permission: none.

**Rationale**: Docs' role table: Write can merge, enable auto-merge, and run and re-run workflows, and can't manage rulesets. Maintain can
push to protected branches and configure merges, so it's too much. Triage can't merge. Custom roles need Enterprise, so Write is the
narrowest role that merges.

**Environment secrets**: The docs conflict. The Actions secrets page says environment secrets in an organization repository need
`admin`. The role table says Write can "Create, update, and delete GitHub Actions secrets", and the REST page says "collaborator access". T3
settles it. If Write can overwrite them, **this is accepted and recorded rather than narrowed**, since no narrower role can merge. Secrets
are write-only, so that allows breaking a deploy, not reading a value. Reading stays limited by the environments' branch rules, which
need admin to change.

**Spec impact**: The assumption "If it can, FR-004's role needs narrowing" is corrected in the spec.

## R5. Transfer and free organization

**Decision**: Transfer through the UI after the App exists (R6). Re-apply anything missing from the repository's records, then verify everything
with existing commands.

**Rationale**:

- Docs say issues, pull requests, secrets, webhooks and deploy keys move, and links redirect until someone creates a repository at the old address.
  They don't mention rulesets or environments, so T4 tries it on a scratch repository with both.
- The required checks' pin, `integration_id: 15368`, is the GitHub Actions app itself, not specific to an owner, so it should hold. T4 confirms.
- The organization's defaults apply after a transfer, so its Actions and member settings get set before it.
- `deploy-gate` reads deployment history. If that were lost, it would treat the next deploy as the first, which is safe.
- `RELEASE_PR_TOKEN` is scoped to the old owner, so it may stop working at the transfer. That's why the App comes first.

## R6. Replacing `RELEASE_PR_TOKEN`

**Decision**: A GitHub App owned by the organization, installed only on this repository, with *Contents: read* and *Pull requests: write*, no webhook.
`release-pr.yml` makes a short-lived token with `actions/create-github-app-token` (latest at time of writing `v3.3.0`; pin to its commit when implementing and
check its current inputs). The private key lives in the `release` environment.

**Rationale**: Only the workflow's own `GITHUB_TOKEN` is kept from starting workflows, so an App's pull request starts the required checks. It keeps working if
any person leaves, and the key isn't an expiring personal token. T5 confirms.

**Consequence**: The App is the pull request's author, so at stage 1 the founding maintainer approves it (FR-007). `Allow GitHub Actions to create and approve pull requests` stays off.

**Alternatives rejected**: A machine user account (a paid seat elsewhere or a shared login, and FR-010 bans those); `GITHUB_TOKEN` (starts no checks).

## R7. Cloudflare membership

**Decision**: Invite the second maintainer as a Super Administrator if T6 shows the Free plan allows it, otherwise as Administrator, and record which in
`docs/maintainers.md`. The invitation waits for the data controller's decision, so T6 uses the founding maintainer's own test address.

**Rationale**:

- Docs' roles page: Administrator "Cannot manage members nor billing profile". Super Administrator can do those and manage account-owned tokens.
- Sources conflict on the plan limit. A 2022 Cloudflare post says all roles reach every plan, including Super Administrator, but doesn't address having two. Other pages I could
  reach state no limit, and a search summary saying Free allows only one couldn't be traced to a page. Hence a trial.
- **If only Administrator is available**, the founding maintainer alone manages Cloudflare members, billing and account tokens, at every stage, and the second maintainer can't remove
  them. Deploying, secrets other than Strava's, logs, databases, Access and rollback all still work. Losing the founding maintainer's Cloudflare login then means going through Cloudflare's support.

**Spec impact**: The edge case saying either can remove the other on Cloudflare "from the start" now depends on T6, and the spec says so.

## R8. CI's Cloudflare credential

**Decision**: Keep the existing approach. Spec 002's quickstart already creates `rynkepoints-github-deploy` under **Account API Tokens**, so it's account-owned. The founding maintainer confirms the live
one is, and the credential record lists it.

**Rationale**: Docs: account tokens are "generally available for all accounts" and keep working after their creator leaves. They support Workers and D1; the unsupported list doesn't touch this deployment. Creating one takes Super Administrator or API token
provisioning rights, so if R7 ends at Administrator, rotating it is the founding maintainer's step.

## R9. Reaching every maintainer

**Decision**:

- **Failures on `main`**: A `notify-failure` job opens an issue mentioning everyone in the `MAINTAINER_HANDLES` repository variable.
- **Usage alerts**: The Worker also sends an email through Cloudflare's `send_email` binding to the addresses in an optional secret, `MAINTAINER_ALERT_EMAILS`.
- **Contact address**: Email Routing sends the address to the Worker's `email` handler, which forwards to every address in an optional secret, `CONTACT_FORWARD_EMAILS`.

**Rationale**:

- Docs: workflow notifications go to whoever triggered the run. So a failed deployment after one maintainer's merge wouldn't reach the other. An issue mention reaches both, and costs nothing.
- Today's usage alert is a push to app admins, and FR-025 says it mustn't need that role.
- A routing rule has a single destination, and rules with the same pattern don't fan out, per the docs. An email Worker can call `forward()` several times, to verified addresses. MX records show the domain already uses Cloudflare Email Routing.
- Addresses are secrets because the repository is public.
- With neither secret set, behaviour stays as today, so fake mode, tests and sandboxes send nothing.

**Unknown**: The docs mark sending from Workers as beta and state no Free plan quota. T7 confirms it on the live domain. If it fails, usage alerts open a GitHub issue through a small scheduled workflow reading the usage history, and that's decided then.

## R10. Merge queue

**Decision**: Trial on the real repository after E, per FR-022. Settings if adopted: merge commits, `ALLGREEN`, 5 builds, minimum 1, no wait, 60 minute check timeout; `strict_required_status_checks_policy` off on `develop`.

**Rationale**:

- Docs: workflows need the `merge_group` trigger, or required checks never report.
- `lint`, `typecheck`, `test` and `e2e` run on it. `commit-messages`, `pr-title` and `pr-source` get `if: github.event_name == 'pull_request'`; GitHub reports a skipped job as success, which T8 confirms for queues.
- The docs read don't say free organizations have it, though the spec's earlier reading says public organization repositories do. T8 shows it directly.
- Per R1, exemption and queue have to work together: T8 includes the founding maintainer's own pull request. If that fails, they merge without the queue, or the queue is dropped; the result is recorded in spec 027.

## R11. Strava API Agreement

**Decision**: This remains the Strava owner's call under FR-017, and nothing grants production access before it. The plan's order lets GitHub access go ahead without it, since a GitHub role reaches no rider data.

**What the Agreement says** (not legal advice):

- §1.2: "may not share your API Token with any other developer, third party". This matches the decision never to share the secret.
- §1.2 also makes the developer responsible for activity "by you or your employees, contractors or agents", which suggests helpers are foreseen.
- Highlights: not sharing a user's data with "third parties", and data "can only be displayed or disclosed in your Developer Application to that user".
- §14.2.1: obligations can't be transferred without Strava's written consent, which bears on any later move of the app.

**Open**: Whether a volunteer co-maintainer counts as an agent or as a third party isn't answered by the text. The simplest way to settle it is to ask developers@strava.com. If the answer is no, the feature stops at phase F.

## R12. Merge commits and `Release PR`

**Decision**: List merged pull requests by matching two lists: `gh pr list --base develop --state merged --json number,title,mergeCommit,headRefName`, and the SHAs from the paginated `compare/main...develop`. Leave out `sync/*`.

**Rationale**: `mergeCommit` is both a squash commit and a merge commit, so unreleased squashes from before the switch still get listed, and no commit message gets parsed. Compare returns only part of a long range unless paginated, and merge history makes ranges longer. Titles still reach the body through a file.

**Alternatives rejected**: Parsing `Merge pull request #N`; one API call per commit.

## R13. The `pr-title` check

**Decision**: Lint the bare title. Keep the check's name, so rulesets don't change.

**Rationale**: It lints `<title> (#N)` because that used to be the squash commit's header. Merge commits keep GitHub's default `Merge pull request` subject, with the title as the body, and commitlint's default ignores skip them. The title's job now is the Release PR's line.

## R14. Sources

- GitHub: [REST rulesets](https://docs.github.com/en/rest/repos/rules), [ruleset exemptions changelog](https://github.blog/changelog/2025-09-10-github-ruleset-exemptions-and-repository-insights-updates/), [repository roles](https://docs.github.com/en/organizations/managing-user-access-to-your-organizations-repositories/managing-repository-roles/repository-roles-for-an-organization), [using secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets), [REST secrets](https://docs.github.com/en/rest/actions/secrets), [transferring a repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/transferring-a-repository), [merge queue](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue), [workflow notifications](https://docs.github.com/en/actions/concepts/workflows-and-actions/notifications-for-workflow-runs)
- Cloudflare: [roles](https://developers.cloudflare.com/fundamentals/manage-members/roles/), [account tokens](https://developers.cloudflare.com/fundamentals/api/get-started/account-owned-tokens/), [RBAC post](https://blog.cloudflare.com/rbac-for-everyone), [routing addresses](https://developers.cloudflare.com/email-routing/setup/email-routing-addresses/), [email handler](https://developers.cloudflare.com/email-service/api/route-emails/email-handler/), [sending from Workers](https://developers.cloudflare.com/email-routing/email-workers/send-email-workers)
- Strava: [API Agreement](https://www.strava.com/legal/api)
