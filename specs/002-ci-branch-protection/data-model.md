# Data Model: CI-Gated Pull Requests and Protected Branches

There is no database in this feature. The "data" is repository configuration on
GitHub plus files committed to the repository. This page lists those entities,
their fields and the rules that link them. The decisions behind them are in
[research.md](research.md).

## Long-lived branch

| Name | Role | Default branch | Created from | Changed only by |
|---|---|---|---|---|
| `main` | last released state | no | existing | merge commit from a PR whose source is `develop` or `hotfix/*` |
| `develop` | integration | **yes** | `main` at bootstrap (R11) | squash merge of a working-branch PR, or merge commit of a `sync/*` PR |

Neither branch can be pushed to, force-pushed or deleted by anyone (R1).

## Working branch

| Kind | Name pattern | Cut from | PR target | Merge method |
|---|---|---|---|---|
| feature / fix | any, e.g. `003-points-rules`, `fix/…` | `develop` | `develop` | squash |
| hotfix | `hotfix/<short-name>` | `main` | `main` | merge commit |
| back-merge | `sync/<short-name>` | `main`, with `origin/develop` merged in locally | `develop` | merge commit |
| release | `develop` itself | — | `main` | merge commit |

Merged working branches are deleted automatically (R9). `develop` is exempt
because it is the default branch and is protected against deletion.

## Required check

One GitHub Actions job whose result on the PR's latest commit gates the merge.
See [contracts/required-checks.md](contracts/required-checks.md).

Fields:
- **context**: the job `name`, unique across workflows.
- **workflow**: the file under `.github/workflows/` that defines the job.
- **events**: which events run the job.
- **timeout**: in minutes.
- **source**: always the GitHub Actions app, `integration_id` 15368.

Rules:
- A context listed in a ruleset MUST match a job `name` exactly. Renaming a job is
  a breaking change: it requires updating both ruleset files and re-applying them
  in the same pull request.
- A required check that has not reported counts as not passed.

## Protection ruleset

One per long-lived branch, committed under `.github/rulesets/`. See
[contracts/rulesets.md](contracts/rulesets.md).

| Field | `main` | `develop` |
|---|---|---|
| `name` | `protect-main` | `protect-develop` |
| `conditions.ref_name.include` | `refs/heads/main` | `refs/heads/develop` |
| `bypass_actors` | `[]` | `[]` |
| `deletion`, `non_fast_forward` | on | on |
| `pull_request.allowed_merge_methods` | `["merge"]` | `["squash", "merge"]` |
| `pull_request.required_approving_review_count` | 0 | 0 |
| `required_status_checks` | all six (R3) | all six (R3) |
| `strict_required_status_checks_policy` | `false` (R7) | `true` |

## Repository settings

Not part of any ruleset. They're recorded in `.github/repository-settings.md`
(R9), along with the step that applies each one:

- default branch;
- allowed merge methods, and the squash commit title and message;
- automatic deletion of head branches;
- Actions workflow permissions;
- fork-PR approval.

## State transitions of a pull request

```text
opened ──► checks running ──► all required passed ──► mergeable ──► merged
               ▲    │                   │
               │    └► any failed / timed out ──► blocked
               │                        │
   new commit / title edit ◄────────────┘   (checks re-run; old results don't count)

develop target only: base moved on ──► out of date ──► "Update branch" ──► checks running
```
