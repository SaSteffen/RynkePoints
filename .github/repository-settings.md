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

## Merge buttons: squash on, merge commits on, rebase off

Features are squashed into `develop`. Releases, hotfixes and `sync/*`
back-merges use merge commits. Each ruleset narrows this further per branch.

- UI: **General → Pull Requests**: *Allow merge commits* and *Allow squash
  merging* checked, *Allow rebase merging* unchecked
- Apply: `gh repo edit SaSteffen/RynkePoints --enable-squash-merge --enable-merge-commit --enable-rebase-merge=false`
- Show: `gh api repos/SaSteffen/RynkePoints --jq '{allow_squash_merge, allow_merge_commit, allow_rebase_merge}'`

## Squash commit: title = PR title, message = blank

A squash commit is then exactly `<PR title> (#<number>)`, which is what the
`pr-title` check lints. The message is blank because the "commit messages"
option prefixes each subject with `* `, which can push a valid subject past
commitlint's 100-character body-line limit on `develop`.

- UI: **General → Pull Requests → Allow squash merging → Default commit
  message**: *Pull request title*
- Apply: `gh api --method PATCH repos/SaSteffen/RynkePoints -f squash_merge_commit_title=PR_TITLE -f squash_merge_commit_message=BLANK`
- Show: `gh api repos/SaSteffen/RynkePoints --jq '{squash_merge_commit_title, squash_merge_commit_message}'`

## Automatically delete head branches: on

Merged working branches are deleted. GitHub never deletes the default branch
or a branch protected against deletion, so `develop` is safe.

- UI: **General → Pull Requests → Automatically delete head branches**
- Apply: `gh repo edit SaSteffen/RynkePoints --delete-branch-on-merge`
- Show: `gh api repos/SaSteffen/RynkePoints --jq .delete_branch_on_merge`

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

## Failure notifications: e-mail, failed workflows only

A setting of the maintainer's account, not of the repository. It's how a failed
deploy reaches the maintainer.

- UI: **Settings (your account) → Notifications → System → Actions**: e-mail, and
  *Only notify for failed workflows*
- No API; check it in the UI.

## Verify all repository fields

```bash
gh api repos/SaSteffen/RynkePoints --jq '{default_branch, allow_squash_merge, allow_merge_commit, allow_rebase_merge, squash_merge_commit_title, squash_merge_commit_message, delete_branch_on_merge}'
```

Expected:

```json
{"allow_merge_commit":true,"allow_rebase_merge":false,"allow_squash_merge":true,"default_branch":"develop","delete_branch_on_merge":true,"squash_merge_commit_message":"BLANK","squash_merge_commit_title":"PR_TITLE"}
```

The two Actions settings and the `production` environment have their own
**Show** commands above.
