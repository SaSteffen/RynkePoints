# Quickstart: Bootstrapping and Validating the PR Gate

This guide is for the maintainer. Every step that changes `origin` or the GitHub
settings is manual and deliberate, like deploys (CLAUDE.md). The ordering comes
from [research.md](research.md) R11.

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
| V5 | US1-1 | PR into `develop` with a trivial doc change | all six checks green; merge offers **Squash and merge** |
| V6 | US1-2 | PR with an obviously failing test | `test` red with the failing test in its log; merge blocked |
| V7 | US1 / FR-010 | PR with a Biome error | `lint` red with an inline annotation; blocked |
| V8 | US1 / FR-010 | PR with a type error | `typecheck` red; blocked |
| V9 | US1-3 | PR containing a commit made with `--no-verify` and message `wip` | `commit-messages` red; blocked |
| V10 | FR-010 (5) | rename the V5 PR title to `update stuff` | only `pr-title` re-runs, turns red, blocks; renaming back turns it green |
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

## Local checks (unchanged)

```bash
pnpm lint && pnpm typecheck && pnpm test
```

CI runs exactly these, plus commitlint over the PR's commits and title.
