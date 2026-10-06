# Contract: Required Checks

The job names below are the interface between the workflows and the rulesets.
Both rulesets list all six contexts with `integration_id: 15368` (GitHub Actions).
A rename on either side without the other blocks every pull request.

| Context | Workflow | Runs on | Command / rule | Timeout | Passes when |
|---|---|---|---|---|---|
| `lint` | `ci.yml` | PR, push to `main`/`develop` | `pnpm lint --reporter=github` | 5 min | Biome reports no errors |
| `typecheck` | `ci.yml` | PR, push to `main`/`develop` | `pnpm typecheck` | 5 min | `tsc --noEmit` exits 0 |
| `test` | `ci.yml` | PR, push to `main`/`develop` | `pnpm test` | 10 min | all Vitest tests pass |
| `commit-messages` | `ci.yml` | PR | `pnpm commitlint --from "$BASE_SHA" --to "$HEAD_SHA" --verbose` | 5 min | every commit in the PR passes `commitlint.config.js` (merge commits ignored by preset) |
| `pr-title` | `pr-policy.yml` | PR `opened`/`edited`/`synchronize`/`reopened` | `printf '%s (#%s)\n' "$PR_TITLE" "$PR_NUMBER" \| pnpm commitlint --verbose` | 5 min | the squash commit header GitHub will create (title + ` (#<number>)`) is a valid Conventional Commit header within the 100-character limit |
| `pr-source` | `pr-policy.yml` | same as `pr-title` | see rule below | 2 min | see rule below |

## Shared setup (every job except `pr-source`)

Every job except `pr-source` does the same setup before its command:
- check out the code (`commit-messages` with `fetch-depth: 0`, so the base..head
  range exists);
- run the local action `.github/actions/setup`: pnpm from `packageManager`, Node
  from `.nvmrc`, pnpm cache, `pnpm install --frozen-lockfile`, `LEFTHOOK=0`.

`pr-source` needs no checkout.

## `pr-title` inputs

Passed only through `env:`:

- `PR_TITLE` = `github.event.pull_request.title`
- `PR_NUMBER` = `github.event.pull_request.number`

The check lints `<PR_TITLE> (#<PR_NUMBER>)`, the header GitHub gives the squash
commit (research R3, R5). The bare title would let a 95–100 character title pass
whose squash commit then breaks commitlint's 100-character header limit on
`develop`.

## `pr-source` rule

Inputs, passed only through `env:`:

- `BASE_REF` = `github.base_ref`
- `HEAD_REF` = `github.head_ref`
- `HEAD_REPO` = `github.event.pull_request.head.repo.full_name`
- `THIS_REPO` = `github.repository`

| `BASE_REF` | Condition | Result |
|---|---|---|
| not `main` | — | pass |
| `main` | `HEAD_REPO` = `THIS_REPO` and `HEAD_REF` = `develop` | pass |
| `main` | `HEAD_REPO` = `THIS_REPO` and `HEAD_REF` starts with `hotfix/` | pass |
| `main` | anything else (including any fork) | fail: "Pull requests into main must come from develop or a hotfix/* branch of this repository." |

## Workflow-wide guarantees

- `permissions: contents: read` at the top level. The six check jobs never widen
  it. The only exception is `deploy-gate`, which adds `deployments: read`; no job
  has a write permission.
- Never `pull_request_target`. The six check jobs never read `secrets.*` and run
  no deploy or `wrangler` remote command. Only the `deploy` job reads a secret
  and talks to Cloudflare, and only for `main` ([deploy.md](deploy.md)).
- Untrusted values (title, branch names, SHAs) appear in `run:` only as shell
  variables set via `env:`.
- Concurrency: `${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}`,
  with `cancel-in-progress: ${{ github.event_name == 'pull_request' }}`.
- Third-party actions are pinned to full commit SHAs.

## Jobs that are not required checks

`ci.yml` also defines `deploy-gate` and `deploy` ([deploy.md](deploy.md)). They:

- run only after a merge into `main` or on a dispatch on `main`. On pull requests
  they are *skipped*;
- are **not** listed in either ruleset, and must never be. A deploy happens after
  the merge, so it can't gate one (research R24);
- must keep names distinct from the six contexts above. Renaming them needs no
  ruleset change. Renaming any of the six still needs both ruleset files updated
  in the same change.
