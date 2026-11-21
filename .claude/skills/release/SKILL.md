---
name: "release"
description: "Release what develop holds: raise the semver version, add the release to the changelog in a pull request into develop, and once that is merged, start the Release PR workflow. Use when the user asks to release, cut a release, bump the version or update the changelog."
argument-hint: "(optional) the version to use instead of the suggested one"
metadata:
  source: "project-authored for RynkePoints"
user-invocable: true
disable-model-invocation: false
---

Every release raises the version in `package.json` and adds its release at the top
of `CHANGELOG.md` (README "Releasing"). Release PR refuses to open while `develop`
still has `main`'s version. Merging is always the user's: never run
`gh pr merge`, and don't wait for checks. Open the pull request, give the link, and
stop.

The skill has two steps. Work out which one applies, and do only that one.

## 0. Where things stand

```bash
git fetch origin
git show origin/main:package.json | jq -r .version     # released
git show origin/develop:package.json | jq -r .version  # on develop
gh pr list --base develop --state open --json number,url,headRefName \
  --jq '.[] | select(.headRefName | startswith("chore/release-"))'
gh pr list --base main --head develop --state open --json url
```

- A `chore/release-*` pull request is open: the bump waits for its merge. Give its
  link and stop.
- `develop`'s version is higher than `main`'s: the bump is merged. Go to step 2.
- Otherwise go to step 1.

## 1. Raise the version and extend the changelog

1. **The pull requests in this release**: the ones merged into `develop` and not on
   `main`, without `sync/*` back-merges (the same list Release PR puts in its
   description):

   ```bash
   git rev-list origin/main..origin/develop > /tmp/shas.txt  # use the scratchpad
   gh pr list --base develop --state merged --limit 200 \
     --json number,title,body,mergeCommit,headRefName \
     | jq --rawfile shas /tmp/shas.txt '[.[] | select(.mergeCommit.oid as $o | ($shas | split("\n") | index($o))) | select(.headRefName | startswith("sync/") | not)]'
   ```

   None: there is nothing to release. Say so and stop.

2. **The version**: a breaking change (a title like `feat!: …` or `fix(x)!: …`, or
   `BREAKING CHANGE` in a body) raises the major number, any `feat` the minor number,
   anything else the patch number. Start from `main`'s version. If the user named a
   version, use it, as long as it is valid semver and higher than `main`'s.

3. **The entries**: English, in plain words, for administrators for now. Each one is
   a full sentence saying what changed for whoever uses the app, not how it was
   built: no file names, code names, issue or pull request numbers, or feature
   numbers. Combine small technical changes into one line ("Smaller fixes to the
   Strava import."), and leave out what nobody using the app notices (tests, CI,
   specs, docs, tooling) unless that was the whole release. Never name a team, its
   place or a rider: every team shows the same list.

4. **Ask the user** to confirm the version and the entries, showing both. Change them
   as asked.

5. **The pull request**, on a branch cut from `develop`:

   ```bash
   git switch --no-track -c chore/release-X.Y.Z origin/develop
   ```

   - In `package.json`, set `"version": "X.Y.Z"`.
   - In `CHANGELOG.md`, add the release above the newest one, in the shape its
     comment gives: a `## X.Y.Z` heading, a blank line, then one `- ` line per entry.
   - Change nothing else, in no other file: then CI runs only the changelog's and
     Settings' tests and no e2e.
   - Run `pnpm exec vitest run test/integration/changelog.test.ts test/integration/settings.test.ts`.
   - Commit as `chore(release): X.Y.Z`, push with `git push -u origin chore/release-X.Y.Z`,
     and open the pull request into `develop` with the same title. Its body is
     `.github/pull_request_template.md` with the line at the top replaced by the
     entries. Leave the sandbox boxes unticked.
   - Give the link, and say that once it is merged, running this skill again starts
     Release PR. Stop.

## 2. Start Release PR

1. A release pull request into `main` already open: Release PR would only reuse it.
   Give its link and stop.
2. Ask which sandboxes the release should go to, with none as the default. The
   description of the release pull request says when one is worth it.
3. Run it on `develop`, then follow that run (a short job, not the pull request's
   checks):

   ```bash
   gh workflow run release-pr.yml --ref develop \
     -f sandbox-hamburg=false -f sandbox-europe=false
   sleep 5; gh run list --workflow release-pr.yml --limit 1 --json databaseId --jq '.[0].databaseId'
   gh run watch <id> --exit-status
   gh pr list --base main --head develop --state open --json url --jq '.[0].url'
   ```

4. Give the release pull request's link, and pass on the run's warning if there is
   one (a smaller bump than the pull requests call for). If the run failed, show why
   and stop. Merging is the user's.

## Hotfixes

A hotfix (`hotfix/<name>` from `main`) raises the patch number on its own branch:
change `package.json` and `CHANGELOG.md` there, in a `chore(release): X.Y.Z`
commit. It goes into `main` through its own pull request, not through Release PR.
