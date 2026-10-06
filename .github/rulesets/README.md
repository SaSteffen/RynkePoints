# Branch rulesets

`main.json` and `develop.json` are the protection for the two long-lived
branches. Each one is a request body for the GitHub rulesets API. GitHub doesn't
read these files: the maintainer applies them by hand and checks with the
commands below that the live rulesets still match them.

| File | Ruleset | Merge methods | Up to date before merging |
|---|---|---|---|
| `main.json` | `protect-main` | merge commit | not required |
| `develop.json` | `protect-develop` | squash, merge commit | required |

Both block deletion and force pushes, require a pull request whose six checks
(`lint`, `typecheck`, `test`, `commit-messages`, `pr-title`, `pr-source`) passed,
and have no bypass list, so they bind the owner too. The reasons are in
[specs/002-ci-branch-protection/research.md](../../specs/002-ci-branch-protection/research.md)
(R1–R7).

Every command below needs `gh` authenticated as the repository owner, and `jq`.
Run them from the repository root.

## When to apply

Only after the pull request that adds `.github/workflows/` has been merged into
`develop`, so that all six checks exist. A ruleset applied earlier blocks every
pull request, including that one, on checks that have never run.

## Create

```bash
gh api --method POST repos/SaSteffen/RynkePoints/rulesets --input .github/rulesets/main.json
gh api --method POST repos/SaSteffen/RynkePoints/rulesets --input .github/rulesets/develop.json
```

## Look up the ID

```bash
gh api repos/SaSteffen/RynkePoints/rulesets --jq '.[] | select(.name == "protect-main") | .id'
gh api repos/SaSteffen/RynkePoints/rulesets --jq '.[] | select(.name == "protect-develop") | .id'
```

## Update

After changing a file, replace the live ruleset with it (`<id>` from above):

```bash
gh api --method PUT repos/SaSteffen/RynkePoints/rulesets/<id> --input .github/rulesets/main.json
gh api --method PUT repos/SaSteffen/RynkePoints/rulesets/<id> --input .github/rulesets/develop.json
```

## Verify

GitHub adds fields to a live ruleset (`id`, `source`, `_links`, new
`pull_request` parameters, …). The check therefore projects both sides onto the
keys the file sets, sorts `rules` by `type`, and diffs the results. Rules or
bypass actors that exist only on GitHub still show up in the diff.

```bash
verify_ruleset() {
  local filter='{name, target, enforcement, bypass_actors, conditions, rules: ([.rules[] | . as $r | [$t[0].rules[] | select(.type == $r.type) | .parameters // {} | keys[]] as $k | {type} + if $k == [] then {} else {parameters: (.parameters | with_entries(select(.key | IN($k[]))))} end] | sort_by(.type))}'
  local file=".github/rulesets/$1.json"
  local id
  id=$(gh api repos/SaSteffen/RynkePoints/rulesets --jq ".[] | select(.name == \"protect-$1\") | .id")
  gh api "repos/SaSteffen/RynkePoints/rulesets/$id" \
    | jq -S --slurpfile t "$file" "$filter" \
    | diff - <(jq -S --slurpfile t "$file" "$filter" "$file") \
    && echo "protect-$1 matches $file"
}
verify_ruleset main
verify_ruleset develop
```

An empty diff, followed by the `matches` line, means the protection is as
documented. Any diff means someone changed the ruleset on GitHub, or the file
was changed and not applied. Fix whichever side is wrong.

## Invariants

- [ ] `bypass_actors` stays `[]` in both files. Adding an entry needs a spec
      change first.
- [ ] The six `required_status_checks` contexts equal the job `name:` values in
      `.github/workflows/`.
- [ ] Renaming a job means updating both files and re-applying them in the same
      pull request. Otherwise every pull request waits for a check that never
      reports.
- [ ] `allowed_merge_methods` is a subset of the merge methods enabled in
      [../repository-settings.md](../repository-settings.md) (squash and merge
      commit). Otherwise GitHub blocks every merge.

## Why this is manual

Reading or changing rulesets needs an admin-scoped token. CI must not hold one,
because its workflows run on pull requests from anyone and have no secrets.
