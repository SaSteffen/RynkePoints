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
| `pr-title` | `pr-policy.yml` | PR `opened`/`edited`/`synchronize`/`reopened` | `printf '%s\n' "$PR_TITLE" \| pnpm commitlint --verbose` | 2 min | the title is a valid Conventional Commit subject |
| `pr-source` | `pr-policy.yml` | same as `pr-title` | see rule below | 2 min | see rule below |

## Shared setup (every job except `pr-source`)

Every job except `pr-source` does the same setup before its command:
- check out the code (`commit-messages` with `fetch-depth: 0`, so the base..head
  range exists);
- run the local action `.github/actions/setup`: pnpm from `packageManager`, Node
  from `.nvmrc`, pnpm cache, `pnpm install --frozen-lockfile`, `LEFTHOOK=0`.

`pr-source` needs no checkout.

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

- `permissions: contents: read`, and nothing wider in any job.
- Never `pull_request_target`, never `secrets.*`, no deploy or `wrangler` remote
  command.
- Untrusted values (title, branch names, SHAs) appear in `run:` only as shell
  variables set via `env:`.
- Concurrency: `${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}`,
  with `cancel-in-progress: ${{ github.event_name == 'pull_request' }}`.
- Third-party actions are pinned to full commit SHAs.
