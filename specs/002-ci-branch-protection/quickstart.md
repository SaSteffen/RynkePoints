# Quickstart: Bootstrapping and Validating the PR Gate and the Deploy

This guide is for the maintainer. Every step that changes `origin`, the GitHub
settings or the Cloudflare account is manual and deliberate (CLAUDE.md). The only
automatic production change is the deploy that follows a merge into `main`
(§7–§11). The ordering of §1–§6 comes from [research.md](research.md) R11.

Prerequisites:
- `gh` is authenticated as the repository owner (`gh auth status`).
- `jq` is installed.
- You work from a clean checkout of `002-ci-branch-protection`.

## 1. Bootstrap

```bash
git push origin main                  # last direct push to main (pending local commits)
git push origin main:develop          # develop starts from main (FR-003)
gh repo edit --default-branch develop # FR-002
git push -u origin 002-ci-branch-protection
gh pr create --base develop --title "ci: gate pull requests and protect main and develop"
```

Expected:
- The PR shows `lint`, `typecheck`, `test`, `commit-messages`, `pr-title` and
  `pr-source`, all green.
- Squash-merge it.

## 2. Apply settings and rulesets

Apply the settings in `.github/repository-settings.md`. Then create the rulesets
with the commands in `.github/rulesets/README.md`, and run that README's
verification command for each file.

Expected: both diffs are empty, and **Settings → Rules → Rulesets** lists
`protect-main` and `protect-develop` as *Active*, with no bypass list.

## 3. Validation scenarios (red → green)

Use throwaway branches cut from `develop`. Close them unmerged afterwards, except
where the table says otherwise.

| # | Scenario (spec) | Action | Expected |
|---|---|---|---|
| V1 | US2-1 | `git push origin HEAD:main` with a local commit | rejected: changes must be made through a pull request |
| V2 | US2-2 | same against `develop` | rejected |
| V3 | US2-3 | `git push --force origin <rewritten>:develop` | rejected (non-fast-forward rule) |
| V4 | US2-4 | `git push origin :develop` | rejected (deletion rule) |
| V5 | US1-1 | PR into `develop` with a trivial doc change | all six checks green; merge offers **Squash and merge**; after merging, `git log -1 --format=%B origin/develop` is just `<title> (#N)` |
| V6 | US1-2 | PR with an obviously failing test | `test` red with the failing test in its log; merge blocked |
| V7 | US1 / FR-010 | PR with a Biome error | `lint` red with an inline annotation; blocked |
| V8 | US1 / FR-010 | PR with a type error | `typecheck` red; blocked |
| V9 | US1-3 | PR containing a commit made with `--no-verify` and message `wip` | `commit-messages` red; blocked |
| V10 | FR-010 (5) | rename the V5 PR title to `update stuff`, then to a valid `docs: …` title of 98 characters | only `pr-title` re-runs and turns red both times (the second because title + ` (#N)` exceeds 100 characters); renaming back turns it green |
| V11 | US1-4 / FR-013 | push a fixing commit to V6 | checks re-run; earlier red results no longer shown as current; green → mergeable |
| V12 | US1-5 / FR-008 | after merging V5, look at another open PR into `develop` | "out of date"; merge blocked until **Update branch** and green checks |
| V13 | US2-5 / FR-009 | try to merge V6 while red, as owner | no bypass option; merge refused |
| V14 | US3-3 / FR-009a | PR from a feature branch into `main` | `pr-source` red with the allowed-sources message |
| V15 | FR-020 | PR from a fork (second account or a collaborator's fork) into `develop` | after "Approve and run", the same six checks run; no secrets available; `pr-source` passes (target is `develop`) |
| V16 | FR-014 | push twice quickly to one PR | the first run is cancelled, the second completes |

Merge V5 (and the fixed V6, if you like). Close the rest.

## 4. First release (US3)

```bash
gh pr create --base main --head develop --title "chore: release"
```

Expected:
- All six checks green, with `pr-source` passing because the source is
  `develop`.
- Only **Create a merge commit** is offered. Merge it.
- `git log origin/main..origin/develop` is empty afterwards (US3-2).

## 5. Hotfix and back-merge (US4)

```bash
git switch -c hotfix/example origin/main   # make a small fix, commit conventionally
git push -u origin hotfix/example
gh pr create --base main --title "fix: example hotfix"     # merge commit once green

git fetch origin
git switch -c sync/example origin/main
git merge origin/develop                   # default "Merge remote-tracking branch …" message
git push -u origin sync/example
gh pr create --base develop --title "chore: merge main back into develop"  # merge commit
```

Expected:
- Both PRs are gated by the six checks.
- Afterwards, `git log origin/develop..origin/main --no-merges` is empty: no
  non-merge commit on `main` is missing from `develop`.

## 6. Periodic check (FR-022)

Re-run the verification commands from `.github/rulesets/README.md` whenever the
rulesets, workflow job names or repository settings change. Every diff should be
empty.

## 7. Deploy setup (User Story 5, one-time)

Do this only after the bootstrap above, and after the one-time production setup
in the [001 quickstart](../001-strava-connect-webhook/quickstart.md) (steps 1–12),
including its first manual `pnpm run deploy`. That first deploy creates the
custom domain; the CI deploy should never be what creates it (research R20).

Prerequisites:
- `main` carries the real `database_id` and `STRAVA_SUBSCRIPTION_ID` in
  `wrangler.jsonc` (committed through a PR, not the placeholders).
- The Cloudflare account holds only RynkePoints. If it doesn't, stop: the
  token's scope would cover the other projects too, and FR-032 isn't met
  (plan, Constitution Check).

### 7.1 Create the deploy credential (Cloudflare dashboard)

**Manage Account → Account API Tokens → Create Token → Custom token** (research
R17):

| Field | Value |
|---|---|
| Name | `rynkepoints-github-deploy` |
| Permissions | Account · Workers Scripts · Edit; Account · D1 · Edit |
| Account resources | Include · the RynkePoints account |
| Client IP filtering | none |
| TTL | end date about one year ahead; put a reminder for rotation (§11) |

Copy the token once; it is shown only at creation. Don't paste it anywhere but
step 7.3. Also note the account ID (**Workers & Pages → Account details**).

### 7.2 Create the `production` environment, rules first

```bash
gh api --method PUT repos/SaSteffen/RynkePoints/environments/production \
  --input - <<<'{"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}'
gh api --method POST repos/SaSteffen/RynkePoints/environments/production/deployment-branch-policies \
  -f name=main -f type=branch
```

Then, in **Settings → Environments → production**, uncheck **Allow
administrators to bypass configured protection rules** (no API field for it,
research R15).

### 7.3 Store the secret and the variable

```bash
gh secret set CLOUDFLARE_API_TOKEN --env production     # paste at the prompt; never as an argument
gh variable set CLOUDFLARE_ACCOUNT_ID --env production --body "<account id>"
```

### 7.4 Verify

```bash
gh api repos/SaSteffen/RynkePoints/environments/production --jq '.deployment_branch_policy'
gh api repos/SaSteffen/RynkePoints/environments/production/deployment-branch-policies --jq '[.branch_policies[] | {name, type}]'
gh secret list --env production
gh variable list --env production
gh secret list                                           # repository level: no CLOUDFLARE_* here
```

Expected:
- `{"custom_branch_policies":true,"protected_branches":false}`.
- `[{"name":"main","type":"branch"}]`.
- The secret and the variable are listed for `production` only.
- The UI shows the bypass box unchecked.

### 7.5 Failure notifications

On GitHub, go to **Settings (your account) → Notifications → System → Actions**.
Choose e-mail and **Only notify for failed workflows** (research R21).

## 8. First automatic deploy (release with the deploy jobs)

The deploy jobs reach `main` with the release PR (`develop` → `main`) that
carries them, so that merge is the first automatic deploy.

Release checklist, for this and every release or hotfix PR into `main`:
- Every new file in `migrations/` keeps the currently deployed version working:
  it adds and doesn't rename or drop (FR-036).
- Changes to storage or anything other riders see were self-reviewed against
  Principle I (constitution, Governance). Merging deploys.

Merge it, then watch with `gh run watch` (the `CI` run on `main`).

## 9. Deploy validation scenarios (red → green)

Run them in this order; later ones need earlier deployments.

| # | Scenario (spec) | Action | Expected |
|---|---|---|---|
| D1 | US5-1, FR-027, SC-008 | the §8 merge | `lint`, `typecheck`, `test`, then `deploy-gate` and `deploy` green within 15 min of the merge. **Deployments → production** lists the merge commit as *Active*, created without any `deployments: write`. The `deploy` log shows migrations ("No migrations to apply!" or the list) **before** the upload. `https://trhh-rynke-coins.link/health` answers `ok`. `pnpm wrangler deployments list` shows the SHA in the message. |
| D2 | US5-4, SC-006 | merge a trivial PR into `develop` | the push run on `develop` shows `deploy-gate` and `deploy` as skipped; no new deployment |
| D3 | US5-7, FR-031 | throwaway same-repo PR into `develop` that deletes the `if:` lines of `deploy-gate` and `deploy`; close it unmerged | `deploy` fails before it starts with an environment protection message (branch not allowed to deploy to `production`); no secret reaches the run; no deployment |
| D4 | FR-030 | `gh workflow run ci.yml --ref <feature branch>` | checks run; `deploy-gate` and `deploy` skipped |
| D5 | US5-6, FR-030 | `gh workflow run ci.yml --ref main` | checks re-run; the gate allows the same commit; a new `production` deployment with the same SHA succeeds |
| D6 | US5-3, FR-024 | start D5 again and cancel the run while `test` is running | `deploy-gate` and `deploy` don't run; no new deployment |
| D7 | US5-2 | a small hotfix as in §5 (`hotfix/…` → `main`, then the `sync/…` back-merge) | after merging into `main`, the hotfix commit is deployed the same way as in D1 |
| D8 | FR-026 (gate) | in **Actions**, open the D1 run (an older `main` commit) and **Re-run all jobs** | checks pass; `deploy-gate` logs a notice that a newer commit is live; `deploy` skipped; the production deployment stays on the D7 commit |
| D9 | FR-026 (queue) | dispatch on `main` three times within a few seconds | one runs, one waits, the middle one ends *cancelled* while waiting; the running deploy is never cancelled; two deployments are recorded, same SHA |
| D10 | US5-5, FR-028, SC-011 | `gh variable set CLOUDFLARE_ACCOUNT_ID --env production --body 0000`, then dispatch on `main` | the `deploy` job fails on the migrations step and the run on the commit is red; the deployment shows *failure*; a failure e-mail arrives; `/health` still answers `ok` from the previous version. Restore the real ID, dispatch again: green. |

FR-035, the migration-failure path, isn't drilled on production. The next real
migration is checked in its deploy log instead: migrations listed, then
uploaded. If you want a drill, use a throwaway Cloudflare account, not
production.

## 10. Re-deploy and rollback

**Re-deploy `main`** (after a failed deploy or a rotated Worker secret):

```bash
gh workflow run ci.yml --ref main && gh run watch
```

There's no way to choose an older commit. To undo a change, use one of these:

1. **Fix forward (preferred)**: revert the change on a `hotfix/<name>` branch
   from `main` and merge it (§5). CI deploys the revert.
2. **Immediate rollback (break-glass)**: deploys a previously built version
   without CI:

   ```bash
   pnpm wrangler deployments list            # messages show "<sha> (run <id>)"
   pnpm wrangler rollback <version-id> --message "rollback: <reason>"
   ```

   You can also use the dashboard: **Workers & Pages → rynke-points →
   Deployments → ⋯ → Rollback**.

Limits of a rollback (research R23):
- Database migrations stay applied. The old code runs on the new schema, which
  is why FR-036 matters.
- Only the last 100 versions can be rolled back to, and only if their bound
  resources still exist unchanged.
- GitHub doesn't see a rollback. **Deployments → production** keeps showing the
  rolled-back commit until the next deploy.
- The next merge into `main`, or a dispatch, deploys `main` again. Merge the
  revert before that happens.

## 11. Rotating or revoking the deploy credential

1. Create a new token as in §7.1.
2. `gh secret set CLOUDFLARE_API_TOKEN --env production` with the new value.
3. Delete the old token in the Cloudflare dashboard.
4. `gh workflow run ci.yml --ref main`. It goes green with the new token.

If the token leaks, delete it in Cloudflare first. Deploys then fail (D10-style)
until step 2 is done, and production keeps running.

## Local checks (unchanged)

```bash
pnpm lint && pnpm typecheck && pnpm test
```

CI runs exactly these, plus commitlint over the PR's commits and title. A local
`pnpm run deploy` is break-glass only; releases deploy by merging into `main`.
