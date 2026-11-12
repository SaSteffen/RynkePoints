# Contract: the sandbox gate (slice 2)

Pull requests into `main` only. Research R14–R20; the decision table is the spec's (Context,
"How the gate decides").

## The decision (`scripts/sandbox-gate.mjs`, `decideGate`)

A pure function, tested with Vitest for every row below (SC-004).

**Input**

| Field | Meaning |
|---|---|
| `release` | head is `develop` of this repository and base is `main` |
| `head` | the head commit, 40 hex |
| `moved` | the head was committed after the pull request opened (R15) |
| `required` | the sandboxes with any `release #<pr>` deployment, for any commit |
| `results` | per sandbox, the newest `release #<pr>` deployment's state for `head`: `none`, `queued`, `in_progress`, `success`, `failure`, `error`, `inactive`, `stale` (over 90 minutes unfinished) |
| `accepted` | the login of a valid acceptance for `head` (R17), or none |

**Output**: `{ state: "pass" | "running" | "blocked", reason, offer }`, where `offer` lists the
deploy actions and whether **Accept** is offered.

| # | Situation | State | Reason (start) | Offer |
|---|---|---|---|---|
| 1 | not `release` | pass | "Not a release: no sandbox needed." | nothing |
| 2 | `accepted` | pass | "Accepted by @x." | deploy per sandbox |
| 3 | `required` empty, not `moved` | pass | "No sandbox chosen." | deploy per sandbox |
| 4 | a required sandbox `queued` or `in_progress` | running | "Waiting for <team>'s deployment." | **Accept** |
| 5 | every required sandbox `success` | pass | "Deployed to <teams>." | deploy per sandbox |
| 6 | a required sandbox `failure`, `error`, `inactive` or `stale` | blocked | "<Team>'s deployment failed." | deploy again for that one, **Accept** |
| 7 | `moved`, a required sandbox `none` | blocked | "`develop` moved since <team> was deployed." | deploy again for those, **Accept** |
| 8 | `moved`, `required` empty | blocked | "`develop` moved since this pull request opened." | deploy per sandbox, **Accept** |

Rows are tried in order; 2 wins over everything but 1. A required sandbox with `none` without
`moved` can't happen through the workflows (R16) but counts as 7. Several rows at once (one
sandbox failed, one running): the reason names each, the state is `running` if any is
running, else `blocked`.

## The check run

`sandbox-gate` on `head`, created anew on each evaluation with `github.token` (R14): `pass` →
`completed`/`success`, `running` → `in_progress`, `blocked` → `completed`/`action_required`.
Title: the reason's first sentence. Summary: the reason, each sandbox's result with its run link,
and "Decide in the control comment" with its link.

## The control comment

Written by `github-actions[bot]` on every evaluation of a release pull request; never for a
hotfix. Markdown, English, nothing secret (FR-020):

```markdown
<!-- sandbox-gate:control 0123456789abcdef0123456789abcdef01234567 -->
### Sandbox gate: ⏸️ needs a decision

`0123456` · `develop` moved since Hamburg was deployed.

| Sandbox | `0123456` |
|---|---|
| Hamburg | not deployed (last: `89abcde` ✅) |
| Europe | not chosen |

New since `89abcde`:
- feat: … (#312)
- fix: … (#313)

- [ ] Deploy `0123456` to Hamburg's sandbox
- [ ] Deploy `0123456` to Europe's sandbox
- [ ] Accept `0123456` without (further) sandboxes

Deploy: anyone with write access. Accept: the founding maintainer.
<details><summary>When to skip</summary>
… FR-006's guidance, as in docs/sandboxes.md …
</details>
```

Headings: `✅ passes`, `⏳ waiting for a deployment`, `⏸️ needs a decision`. Only the boxes in
`offer` appear. The new commits are at most 20, then "and <n> more".

## Clicks (`sandbox-gate.yml`, `issue_comment` `edited`)

`parseClicks(before, after)` returns the boxes ticked in `after` that weren't in `before`: a
list of `{ action: "deploy", team }` and `{ action: "accept" }`. Tested with Vitest, including a
box unticked, text around the boxes changed, and a box that isn't one of the three forms.

| Condition | Result |
|---|---|
| comment author isn't `github-actions[bot]`, or no control marker | ignored, no run beyond the job's `if` |
| marker's commit isn't the head | nothing done; evaluation rewrites the comment |
| deploy, sender without `push` | nothing done; reply "Only people with write access can deploy." |
| accept, sender without `admin` | nothing done; reply "Only the founding maintainer can accept." (or "maintainers with admin rights") |
| deploy, allowed | **Sandbox** called with `[team]`, the head, `pr`, base `main` |
| accept, allowed | acceptance comment posted (below) |

Every click run ends with an evaluation.

## The acceptance comment

```markdown
<!-- sandbox-gate:accept 0123456789abcdef0123456789abcdef01234567 -->
Accepted `0123456` without (further) sandboxes, by @user.
```

Counts only when written by `github-actions[bot]`, its commit is the head, and it was never
edited (`updated_at` equals `created_at`).

## Workflows

**`sandbox-gate.yml`** (new), `permissions: {}` at the top:
- `on`: `pull_request` (branches `main`; `opened`, `synchronize`, `reopened`), `issue_comment`
  (`edited`), `workflow_dispatch` (input `pr`).
- Job `click` (only `issue_comment` on a pull request, comment by `github-actions[bot]` with the
  control marker): checks and handles the click; outputs the team to deploy. No concurrency group.
- Job `deploy`: needs `click`, calls `sandbox.yml` with `secrets: inherit` when a deploy was
  allowed.
- Job `gate`: evaluates and writes the check run and the comment; after `click` when there was
  one; `concurrency: sandbox-gate-<pr>`, `cancel-in-progress: false`. Permissions `checks:
  write`, `pull-requests: write`, `deployments: read`, `contents: read`.
- No job is named `sandbox-gate` (R14). Job names `click`, `deploy`, `gate` are not required-check
  contexts.

**`sandbox.yml`** (changed):
- `resolve` records each chosen sandbox's deployment with status `queued` and passes the IDs on;
  the deployment job sets `in_progress` after the checks, then `success` or `failure` (R16).
- A skip as older than live sets `inactive`.
- For a release (`pr` set and base `main`): a job `gate-start` after `resolve` and a job
  `gate-end` after all sandboxes (`if: always()`) run the evaluation, in the same concurrency
  group as `sandbox-gate.yml`'s `gate`.

## The ruleset (second pull request, R20)

`.github/rulesets/main.json` gains `{ "context": "sandbox-gate", "integration_id": 15368 }`; not
`develop.json`. Only after `sandbox-gate` has reported on a pull request into `main` from
`develop`'s workflow.
