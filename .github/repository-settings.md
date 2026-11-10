# Repository settings

Settings that the branch rulesets ([rulesets/README.md](rulesets/README.md))
don't cover, but that the pull request flow depends on. It also covers the
`production` deployment environment, which the deploy on merge into `main`
depends on. GitHub stores them outside the repository, so this file is their
record. The maintainer applies them by hand, once at bootstrap and again whenever
this file changes.

Every command needs `gh` authenticated as the repository owner. UI paths start at
the repository's **Settings** tab.

## Default branch: `develop`

New pull requests target `develop` unless the author picks another base.

- UI: **General → Default branch**
- Apply: `gh repo edit SaSteffen/RynkePoints --default-branch develop`
- Show: `gh api repos/SaSteffen/RynkePoints --jq .default_branch`

## Merge buttons: merge commits only

Every pull request is merged with a merge commit. Squash and rebase merging
stay off. When changing this, apply the rulesets first: a ruleset's methods must
stay a subset of what's enabled here.

- UI: **General → Pull Requests**: *Allow merge commits* checked, *Allow squash
  merging* and *Allow rebase merging* unchecked
- Apply: `gh repo edit SaSteffen/RynkePoints --enable-squash-merge=false --enable-merge-commit --enable-rebase-merge=false`
- Show: `gh api repos/SaSteffen/RynkePoints --jq '{allow_squash_merge, allow_merge_commit, allow_rebase_merge}'`

## Merge commit: GitHub's default subject, PR title as the body

The subject stays `Merge pull request #<number> from <branch>`, which commitlint
ignores by default. The body is the pull request's title.

- UI: **General → Pull Requests → Allow merge commits → Default commit message**:
  *Pull request title*
- Apply: `gh api --method PATCH repos/SaSteffen/RynkePoints -f merge_commit_title=MERGE_MESSAGE -f merge_commit_message=PR_TITLE`
- Show: `gh api repos/SaSteffen/RynkePoints --jq '{merge_commit_title, merge_commit_message}'`

## Automatically delete head branches: on

Merged working branches are deleted. GitHub never deletes the default branch
or a branch protected against deletion, so `develop` is safe.

- UI: **General → Pull Requests → Automatically delete head branches**
- Apply: `gh repo edit SaSteffen/RynkePoints --delete-branch-on-merge`
- Show: `gh api repos/SaSteffen/RynkePoints --jq .delete_branch_on_merge`

## Auto-merge: available, never automatic

This setting only makes the **Enable auto-merge** button available. Opening a pull
request doesn't merge it: someone has to click the button on that pull request, and
no workflow does. After the click, it merges once its required checks pass.
`develop` still requires an up-to-date branch, and auto-merge doesn't update one. A
pull request that falls behind waits until **Update branch → Update with rebase** is
used, and then finishes by itself.

- UI: **General → Pull Requests → Allow auto-merge**
- Apply: `gh repo edit SaSteffen/RynkePoints --enable-auto-merge`
- Show: `gh api repos/SaSteffen/RynkePoints --jq .allow_auto_merge`

## Actions workflow permissions: read-only, no pull request approval

The workflows declare `contents: read` themselves. This setting is the fallback
for any job that doesn't.

- UI: **Actions → General → Workflow permissions**: *Read repository contents
  and packages permissions*, and *Allow GitHub Actions to create and approve pull
  requests* unchecked
- Apply: `gh api --method PUT repos/SaSteffen/RynkePoints/actions/permissions/workflow -f default_workflow_permissions=read -F can_approve_pull_request_reviews=false`
- Show: `gh api repos/SaSteffen/RynkePoints/actions/permissions/workflow`
  (expected: `{"default_workflow_permissions":"read","can_approve_pull_request_reviews":false}`)

## Fork pull request approval: first-time contributors

GitHub's default. Workflows on a fork pull request from someone who has never
had a change merged here wait for the maintainer to click **Approve and run**.

- UI: **Actions → General → Approval for running fork pull request workflows
  from contributors**: *Require approval for first-time contributors*
- Apply: `gh api --method PUT repos/SaSteffen/RynkePoints/actions/permissions/fork-pr-contributor-approval -f approval_policy=first_time_contributors`
- Show: `gh api repos/SaSteffen/RynkePoints/actions/permissions/fork-pr-contributor-approval`
  (expected: `{"approval_policy":"first_time_contributors"}`)

## Dependabot alerts and security updates: on

Security updates open a pull request for a vulnerable package as soon as an
alert appears. The daily version updates need no setting: they come from
[dependabot.yml](dependabot.yml) on the default branch.

- UI: **Advanced Security → Dependabot**: *Dependabot alerts* and *Dependabot
  security updates* enabled
- Apply: `gh api --method PUT repos/SaSteffen/RynkePoints/vulnerability-alerts` then
  `gh api --method PUT repos/SaSteffen/RynkePoints/automated-security-fixes`
- Show: `gh api repos/SaSteffen/RynkePoints/automated-security-fixes`
  (expected: `{"enabled":true,"paused":false}`)

## Environment `production`: `main` only, no admin bypass

The boundary that releases the deploy credential: only a job in a run on `main`
gets its secret. It also records every deployment with its commit and outcome.

Create it with its branch rule and the bypass switched off **before** storing the
secret, and before the first release that carries the deploy jobs. A workflow run
that references a missing environment creates it without any rules.

- UI: **Environments → New environment → `production`**. *Deployment branches and
  tags*: *Selected branches and tags*, branch rule `main`, no tag rule. *Allow
  administrators to bypass configured protection rules* unchecked. No required
  reviewers, no wait timer.
- Apply:

  ```bash
  gh api --method PUT repos/SaSteffen/RynkePoints/environments/production \
    --input - <<<'{"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}'
  gh api --method POST repos/SaSteffen/RynkePoints/environments/production/deployment-branch-policies \
    -f name=main -f type=branch
  ```

  Then uncheck the bypass box in the UI; there's no API field for it.
- Secret and variable, stored on the environment only, never at repository level:

  ```bash
  gh secret set CLOUDFLARE_API_TOKEN --env production     # paste at the prompt; never as an argument
  gh variable set CLOUDFLARE_ACCOUNT_ID --env production --body "<account id>"
  ```

  Creating the token: [quickstart §7.1](../specs/002-ci-branch-protection/quickstart.md#71-create-the-deploy-credential-cloudflare-dashboard).
  Rotating it: [§11](../specs/002-ci-branch-protection/quickstart.md#11-rotating-or-revoking-the-deploy-credential).
- Show:

  ```bash
  gh api repos/SaSteffen/RynkePoints/environments/production --jq '.deployment_branch_policy'
  gh api repos/SaSteffen/RynkePoints/environments/production/deployment-branch-policies --jq '[.branch_policies[] | {name, type}]'
  gh secret list --env production
  gh variable list --env production
  gh secret list                                           # repository level: no CLOUDFLARE_* here
  ```

  Expected: `{"custom_branch_policies":true,"protected_branches":false}`, then
  `[{"name":"main","type":"branch"}]`; the secret and the variable listed for
  `production` only; the bypass box unchecked in the UI.

## Environment `production-gateway`: like `production`, for the Strava gateway

The `deploy-gateway` job (feature 026 release 3) deploys `gateway/` with this
environment's credential. Set it up exactly like `production`, with the same branch
rule, no bypass, and its own `CLOUDFLARE_API_TOKEN` secret and `CLOUDFLARE_ACCOUNT_ID`
variable. Replace `production` with `production-gateway` in the commands above.

The job only runs while the repository variable `GATEWAY_DEPLOY` is `on`
(`gh variable set GATEWAY_DEPLOY --body on`). It has to be a repository variable, since
the job's condition is checked before the environment applies. Until then a merge never
creates the gateway. The steps around it are in [docs/gateway-switch.md](../docs/gateway-switch.md).

## Environment `production-europe`: like `production`, for Team Rynkeby Europe

Each team deploys from its own environment (feature 026 research R13): the `deploy`
job runs once per team, and one team's failure never stops another's. Set this one
up exactly like `production`, with the same branch rule, no bypass, and its own
`CLOUDFLARE_API_TOKEN` secret and `CLOUDFLARE_ACCOUNT_ID` variable. Replace
`production` with `production-europe` in the commands above. Create it **before**
turning the switch on: a run that references a missing environment creates it
without any rules.

Europe is only deployed while the repository variable `EUROPE_DEPLOY` is `on`
(`gh variable set EUROPE_DEPLOY --body on`). Until then a merge never creates
Europe's Worker. Even with the switch on, Europe's job stops at
`team-check --deployable europe` while its team data still holds placeholders
(FR-053). The other manual steps for a new team are in the add-a-team runbook.

## Environment `release`: `develop` only, with the release PR token

The [Release PR](workflows/release-pr.yml) button opens the pull request from
`develop` into `main`. A pull request opened with the workflow's own token starts
no workflows, so the required checks would never report. The workflow opens it
with a fine-grained token of the maintainer instead, which only a run on `develop`
gets.

- Token: **Settings (your account) → Developer settings → Fine-grained tokens →
  Generate new token**. Resource owner `SaSteffen`, *Only select repositories*:
  `RynkePoints`. Repository permissions: *Contents* read-only, *Pull requests*
  read and write. Pick an expiry and note it; the button fails once it passes.
- UI: **Environments → New environment → `release`**. *Deployment branches and
  tags*: *Selected branches and tags*, branch rule `develop`, no tag rule. No
  required reviewers, no wait timer.
- Apply:

  ```bash
  gh api --method PUT repos/SaSteffen/RynkePoints/environments/release \
    --input - <<<'{"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}'
  gh api --method POST repos/SaSteffen/RynkePoints/environments/release/deployment-branch-policies \
    -f name=develop -f type=branch
  gh secret set RELEASE_PR_TOKEN --env release             # paste at the prompt; never as an argument
  ```

- Show:

  ```bash
  gh api repos/SaSteffen/RynkePoints/environments/release/deployment-branch-policies --jq '[.branch_policies[] | {name, type}]'
  gh secret list --env release
  ```

  Expected: `[{"name":"develop","type":"branch"}]`, and `RELEASE_PR_TOKEN` listed.
- Use: **Actions → Release PR → Run workflow**, branch `develop`.

## Environments `sandbox-hamburg` and `sandbox-europe`: `develop` only, no admin bypass

The boundary that releases the sandbox credentials (feature 027, [docs/sandboxes.md](../docs/sandboxes.md)):
only a job of the [Sandbox](workflows/sandbox.yml) workflow in a run on `develop` gets them,
whether started by hand, by **Release PR** or by a pull request's checkbox
([Sandbox PR](workflows/sandbox-pr.yml) runs as it is on `develop`). Like `production`, but
with `develop` as the branch rule, and with two tokens.

- Tokens, account API tokens created in Cloudflare by the founding maintainer
  (**Manage Account → Account API Tokens**), so they aren't tied to one person:
  - `CLOUDFLARE_SANDBOX_API_TOKEN` ("rynkepoints-sandbox-deploy"): account *Workers
    Scripts: Edit*, account *D1: Edit*, zone *Workers Routes: Edit* on
    `trhh-rynke-coins.link`.
  - `CLOUDFLARE_ANALYTICS_TOKEN` ("rynkepoints-sandbox-analytics"): account *Account
    Analytics: Read* only. It must be a different token from the deploy token.
- Apply: `scripts/sandbox-environments.sh` (or `… hamburg` for one). It creates both
  environments with the `develop` branch rule, asks for the account ID and the two tokens
  (hidden input), stores them on the environments only, and checks the result. Run it again
  to rotate the tokens. Then uncheck *Allow administrators to bypass configured protection
  rules* for each in the UI; there's no API field for it.
- Show: the script's last lines, or:

  ```bash
  for env in sandbox-hamburg sandbox-europe; do
    gh api repos/SaSteffen/RynkePoints/environments/$env/deployment-branch-policies --jq '[.branch_policies[] | {name, type}]'
    gh api repos/SaSteffen/RynkePoints/environments/$env --jq '.can_admins_bypass'
    gh secret list --env $env
    gh variable list --env $env
  done
  gh secret list                                           # repository level: no CLOUDFLARE_* here
  ```

  Expected for each: `[{"name":"develop","type":"branch"}]`, `false`, the two secrets and
  `CLOUDFLARE_ACCOUNT_ID`.

**What the deploy token can still reach**: Cloudflare offers no token limited to some Workers
or some databases, so it could also deploy production's Workers, write to production's
databases and change routes in the zone. It's released only to the sandbox workflows as they
are on `develop`, used only in the steps that write to Cloudflare, always with
`--env sandbox-<team>`, after `develop`'s `team-check` refused any production name in a sandbox
block. A pull request's code is built in that job, so a branch could tamper with those steps;
only branches of this repository and senders with write access qualify, which reaches nobody
who couldn't already push here. Weigh this again when more people get write access; an
environment approval would be the next step. The analytics token is read-only.

**Outside GitHub**, also manual and in the
[quickstart](../specs/027-sandbox-deployment/quickstart.md#one-time-setup-per-sandbox-team--hamburg-then-europe):

- the D1 databases and queues `rynke-points-sandbox-<team>`, their IDs in `wrangler.jsonc`;
- the Cloudflare Access application for both sandbox hosts (team domain
  `rynkepoints.cloudflareaccess.com`): one *Allow* policy with the maintainers' e-mail
  addresses, one-time PIN, session 24 h, no *Bypass* or *Service Auth* policy. Adding a
  maintainer means adding their address there;
- the sandbox Workers' secrets: `scripts/sandbox-secrets.sh` (needs `wrangler login`). The
  Strava, encryption and notification values are fake mode's from `dev/fake.env`; the session
  key and admin token are new random values, printed once. Running it again replaces them.

## GitHub Pages: built by the mockup workflow

The `Mockup pages` workflow publishes each spec's concept page from `develop` to
<https://sasteffen.github.io/RynkePoints/>. Everything on it is public and uses
synthetic data, and its pages ask search engines not to index them. The app is never deployed this way. GitHub creates the
`github-pages` environment on the first deployment and limits it to the default
branch.

- UI: **Pages → Build and deployment → Source**: *GitHub Actions*
- Apply: `gh api --method POST repos/SaSteffen/RynkePoints/pages -f build_type=workflow`
- Show: `gh api repos/SaSteffen/RynkePoints/pages --jq '{build_type, html_url}'`

## Failure notifications: e-mail, failed workflows only

A setting of the maintainer's account, not of the repository. It's how a failed
deploy reaches the maintainer.

- UI: **Settings (your account) → Notifications → System → Actions**: e-mail, and
  *Only notify for failed workflows*
- No API; check it in the UI.

## Verify all repository fields

```bash
gh api repos/SaSteffen/RynkePoints --jq '{default_branch, allow_auto_merge, allow_squash_merge, allow_merge_commit, allow_rebase_merge, merge_commit_title, merge_commit_message, delete_branch_on_merge}'
```

Expected:

```json
{"allow_auto_merge":true,"allow_merge_commit":true,"allow_rebase_merge":false,"allow_squash_merge":false,"default_branch":"develop","delete_branch_on_merge":true,"merge_commit_message":"PR_TITLE","merge_commit_title":"MERGE_MESSAGE"}
```

The two Actions settings and the `production` environment have their own
**Show** commands above.
