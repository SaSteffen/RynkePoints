# Quickstart: Validating Multiple Maintainers

Everything here is done by hand, by the founding maintainer unless stated. `<org>` is the organization's name.

## Before the transfer: trials

**Needs**: A scratch organization (it can later become the real one), a scratch public repository, and a second GitHub test account. Delete the scratch repository afterwards.

| Trial | Do | Pass means | If it fails |
|---|---|---|---|
| **T1** Exemption | Apply [`approval.json`](contracts/approval-ruleset.md) and a ruleset with one required check. As the owner, open a pull request and enable auto-merge | It merges with no approval, once the check passes, and the check still binds | T1b |
| **T1b** Fallback (only if T1 fails) | Replace it with the [`owner-approval` check](research.md#r2-fallback-a-required-check). Approve, then push | The check passes on approval, on the current commit, and fails after the push | Stop and rethink: the spec's assumption fails |
| **T2** Stale approval | As the test account, get approval, fall behind, **Update with rebase** | Note whether approval survives | Record it; the queue trial weighs it |
| **T3** Write role | As the test account with Write: `gh secret set X --env <env>`, change a ruleset | The ruleset change is refused. Note whether the secret change is | Record it ([research R4](research.md#r4-the-second-maintainers-github-role)) |
| **T4** Transfer | Transfer a personal scratch repository with a ruleset, environments with secrets, and a required check into the organization. Open a pull request | Note what survived; the check still reports with its `integration_id` | Add to the re-apply list |
| **T5** App | Run `release-pr.yml` with an App | It opens a pull request, and the checks start on it | Stop and rethink the credential |

**T6** Cloudflare, using the founding maintainer's own second address, not the second maintainer: invite it as Super Administrator. Does the Free plan allow it? If it doesn't, invite it as Administrator, and see whether it can create an account API token. Record the result, then remove the member.

## Phase A: merge commits only

```bash
gh api repos/<owner>/RynkePoints --jq '{allow_squash_merge, allow_merge_commit, allow_rebase_merge}'
```

Expected: squash `false`, merge commit `true`, rebase `false`.

1. Pull request page: only **Create a merge commit** is offered, on `develop` and `main`.
2. `verify_ruleset develop` and `verify_ruleset main` both match.
3. Merge a branch with several commits, plus one `sync/*`. Run **Release PR**: the branch appears once, by title; the `sync/*` doesn't.
4. A pull request with a badly worded commit fails `commit-messages`.

## Phase B: failure alerts

In the scratch repository, run the job after a step that always fails on its default branch, so production isn't touched. An issue appears, mentioning each handle, and each mentioned account gets the notification.

## Phase D: after the transfer

- [ ] `verify_ruleset main`, `verify_ruleset develop`.
- [ ] Every **Show** command in `.github/repository-settings.md` gives its expected value.
- [ ] `gh secret list --env production`, `gh secret list --env release`, and the bypass box still unchecked.
- [ ] Old links redirect. `git remote set-url origin` on each local clone.
- [ ] **Release PR** works with the App, and the pull request's checks start.
- [ ] `gh workflow run ci.yml --ref main`: it deploys, and the site stays up throughout.

Do this with no release pull request open and no deployment running.

## Phases E and F: approval (US1, US8)

As the second maintainer:

- [ ] Can't merge without approval, or with another person's approval.
- [ ] After the founding maintainer approves, can merge. A new push blocks it again.
- [ ] Can run **Release PR** and re-deploy. Can't change a ruleset.
- [ ] Merges a hotfix once it's approved.

As the founding maintainer:

- [ ] Their own pull request auto-merges with no approval, and still waits for checks.
- [ ] A Dependabot and a release pull request each wait for their approval.

## Phase G: Cloudflare, mail and privacy (US2, US3, US4, US6)

- [ ] **First**, the access decision is on record, and the privacy page and consent are updated if needed.
- [ ] Second maintainer, with their own login, reaches logs, usage, databases and queues, and sets a secret on a test Worker. The Strava secret's value isn't shown.
- [ ] Following the docs from a fresh setup through a merged change never asks for the Strava secret (SC-002).
- [ ] **T7**: A synthetic alert reaches both addresses on the live domain, with no rider data. A test message to the contact address reaches both.
- [ ] Being a maintainer shows nothing extra in the app.

## Phase H: merge queue (US5)

**T8**, on `develop`:

- [ ] Two non-conflicting pull requests both merge with no manual rebase.
- [ ] Two that break each other: the second leaves the queue, and `develop` stays working.
- [ ] `commit-messages`, `pr-title`, `pr-source` don't hold the queue up.
- [ ] The founding maintainer's own pull request enters it unapproved, and someone else's unapproved one can't.

Then record the result in `docs/maintainers.md` and spec 027.

## Later: walk the checklists

- [ ] Walk the removal checklist with a test account. Production keeps running, and its access is gone.
- [ ] Remove a test account's access and confirm no workflow or deployment depends on it (SC-003).
- [ ] Read the continuity section as if the founding maintainer were unreachable.

## Automated checks

Worker changes:

```bash
pnpm lint && pnpm typecheck && pnpm test
```
