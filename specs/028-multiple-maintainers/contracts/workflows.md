# Contract: Workflows

Spec 002's guarantees stay: third-party actions pinned to commits, untrusted values only through `env:`, no check job reads a secret.

## `release-pr.yml`

**Credential**, in the `release` environment, still only on `develop`:

| Name | Kind |
|---|---|
| `RELEASE_APP_ID` | Variable |
| `RELEASE_APP_PRIVATE_KEY` | Secret |

A first step makes the token with `actions/create-github-app-token`. `RELEASE_PR_TOKEN` is deleted, and the personal token revoked, once a run has passed.

**Description**: one line per pull request.

```text
- <title> (#<number>)
```

| A pull request merged into `develop` | Listed? |
|---|---|
| Its merge commit is in `main...develop` | Yes |
| Squash-merged before the switch, and not released | Yes |
| From `sync/*` | No |
| Already released | No |

Branch commits never appear on their own. Compare is paginated. `gh pr list` uses a limit well above any likely release, and the implementation warns in the run if a commit range looks larger than the list covers.

## `pr-policy.yml`

`pr-title` lints `$PR_TITLE` alone. Name and contexts stay as they are.

## `ci.yml`: `notify-failure`

| Property | Value |
|---|---|
| Runs | When a check, `deploy-gate` or `deploy` failed in a push or dispatch run on `main` |
| Needs | `lint`, `typecheck`, `test`, `e2e`, `deploy-gate`, `deploy` |
| Permissions | `issues: write`, nothing else |
| Secrets | None |
| Action | Opens an issue with the commit, a link to the run, and a mention of each handle in `vars.MAINTAINER_HANDLES` |
| Required check | Never. It joins the list of jobs in `CLAUDE.md` that must not be contexts |

If the variable is empty, the issue still opens. A failure of this job doesn't change what got deployed. The personal e-mail setting in `repository-settings.md` stays as a supplement.

## If the merge queue is adopted

| Workflow | Change |
|---|---|
| `ci.yml` | `merge_group:` trigger. `commit-messages` already has its `if:` |
| `pr-policy.yml` | `merge_group:` trigger. `pr-title` and `pr-source` get `if: github.event_name == 'pull_request'` |
| `ci.yml` comment on `develop` | Updated |
| `develop.json` | `merge_queue` rule per research R10, `strict_required_status_checks_policy: false` |

`main` keeps no queue, so `deploy` and spec 027's `sandbox-gate` aren't affected.
