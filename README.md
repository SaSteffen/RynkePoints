# RynkePoints

Strava integration for Team Rynkeby Hamburg. Riders connect their Strava account
(opt-in), the app collects key data from their activities (distance, date, elevation
gain, …), detects participation in team events, and awards gamified **Rynke Points**.
With the rider's permission it can also write their points into the Strava activity
description.

Runs serverless on Cloudflare Workers, with D1 for storage and Queues for
processing Strava webhook events.

Features are specified and built with
[Spec Kit](https://github.com/github/spec-kit); each has its own folder under
`specs/`.

## What it does today

The first feature, [Strava connection and webhook intake](specs/001-strava-connect-webhook/spec.md):

- Members of the team's Strava club connect their account on the start page.
  Connecting is refused, and nothing is kept, for anyone who isn't a member.
- The rider's cycling activities since the season start are imported, and new,
  changed or deleted activities follow automatically through Strava's webhook.
- On their own page riders see the connection status, the import progress and
  their 20 most recent rides, and can disconnect.

Points and events build on this in later features.

## Privacy

- **Scopes**: `read` and `activity:read`. `activity:read_all` is optional: only
  if the rider grants it are their private ("Only You") activities included.
- **What is stored**: per rider the Strava athlete ID, first name (for the
  greeting), the granted scopes and the Strava tokens, encrypted. Per cycling
  activity only sport type, start time, time zone, distance, moving and elapsed
  time, elevation gain, the manual, trainer and private flags, and whether
  Strava has flagged it. No GPS tracks, maps, titles, photos, heart rate or
  power, and no other kinds of activity.
- **Deletion**: everything about a rider is deleted at once when they disconnect
  on their page or remove the app in their Strava settings, within 24 hours
  after they leave the club, and 7 days after their connection broke if they
  don't reconnect. Deleted data stays in Cloudflare's D1 backups for up to
  7 days, then disappears.
- **Cookies**: only necessary ones. `rp_session` keeps a rider signed in
  (30 days), `rp_oauth_state` protects the 10-minute Strava sign-in, and
  `rp_lang` remembers a picked language. The language is never stored in the
  database.

## Languages

Rider pages are German by default and English on request: the browser's
preferred language decides, and a switcher on every page overrides it.

All rider-facing text lives in `src/i18n/messages/<locale>.ts`, never inline in
pages or logic. Message IDs are listed in
[contracts/messages.md](specs/001-strava-connect-webhook/contracts/messages.md).
To add a language, add a catalog file with the same keys and register it in
`src/i18n/catalogs.ts`; no other code changes.

## Getting started

Requirements: Node 24 (see `.nvmrc`) and pnpm (`corepack enable`).

```bash
pnpm install                # deps + git hooks
cp .dev.vars.example .dev.vars   # fill in your Strava API app credentials
pnpm test
pnpm wrangler d1 migrations apply rynke-points --local   # local database
pnpm dev                    # local Worker on http://localhost:8787
```

You need your own [Strava API application](https://www.strava.com/settings/api) for
local development. You don't need a Cloudflare account: production is deployed by
CI (see [Deploying](#deploying)).

Running against the real Strava locally, and the manual one-time production
steps (Cloudflare resources, secrets, the webhook subscription and the Strava
brand assets for each language), are in the
[feature quickstart](specs/001-strava-connect-webhook/quickstart.md). The D1
database must be created with `--jurisdiction=eu` before the first deploy, so
rider data stays in the EU.

## Contributing

### Branch model

- `main` is the last released state.
- `develop` is the integration branch and the default branch.

### Proposing a change

Cut a branch from `develop` and open a pull request into `develop`. Features
are squash-merged, so the PR title becomes the commit message on `develop`. It's
the whole message: the body is left blank, so details belong in the PR
description. The title must therefore be a
[Conventional Commit](https://www.conventionalcommits.org/) (`feat: …`,
`fix: …`, `docs: …`). GitHub appends ` (#<number>)`, and the whole header must
stay within 100 characters, so keep titles to about 90.

### What has to pass

Every pull request into `main` or `develop` runs six checks. Each mirrors a
command you can run locally:

| Check | Local command |
|---|---|
| `lint` | `pnpm lint` |
| `typecheck` | `pnpm typecheck` |
| `test` | `pnpm test` |
| `commit-messages` | `pnpm commitlint --from origin/develop --to HEAD` |
| `pr-title` | `printf '%s (#%s)\n' "<title>" <number> \| pnpm commitlint` |
| `pr-source` | PRs into `main` must come from `develop` or `hotfix/*` |

`ci.yml` also has the jobs `deploy-gate` and `deploy`. They run only on `main`,
show as skipped on pull requests and are not required checks.

The lefthook git hooks run the same Biome, `tsc` and commitlint before each
commit, so a branch that commits cleanly usually passes. A check that failed for
a flaky or infrastructure reason can be re-run from the PR's **Checks** tab
without a new commit.

Pull requests from forks get the same checks, without secrets. A first-time
contributor's checks start once the maintainer approves the run.

### Protected branches

Nobody can push to, force-push or delete `main` or `develop`, the owner
included, and there is no bypass. The only way in is a pull request whose
required checks passed. A pull request into `develop` must also be up to date
with `develop`; use **Update branch** if it isn't. The protection lives in
[.github/rulesets/](.github/rulesets/README.md) and
[.github/repository-settings.md](.github/repository-settings.md), which are the
source of truth.

### Releasing

```bash
gh pr create --base main --head develop --title "chore: release"
```

The same six checks run, and `pr-source` only allows `develop` and `hotfix/*`
as sources for `main`. Merge with **Create a merge commit**, the only method
`main` allows. The release PR doesn't need to be up to date with `main`, because
the checks already run on the result of merging it. Afterwards, `main` has
nothing that `develop` lacks.

Merging the release PR deploys it (see [Deploying](#deploying)). Before you
merge, check that:

- every new file in `migrations/` keeps the currently deployed version working;
- changes to storage or to anything other riders see were self-reviewed against
  Principle I of the [constitution](.specify/memory/constitution.md).

### Hotfixes

1. Cut `hotfix/<short-name>` from `origin/main`, commit conventionally, and open
   a pull request into `main`. Merge it with a merge commit once it's green.
   Merging it into `main` deploys the hotfix.
2. Carry the fix back to `develop`:

   ```bash
   git fetch origin
   git switch -c sync/<short-name> origin/main
   git merge origin/develop   # keep the default message; commitlint ignores it
   git push -u origin sync/<short-name>
   gh pr create --base develop --title "chore: merge main back into develop"
   ```

   Merge it with **Create a merge commit**, not squash.

There is no direct `main` → `develop` pull request, because **Update branch** on
it would be a forbidden push to `main`. If a release PR is open, the back-merge
re-runs its checks. No hotfix is possible before the first release has brought
the workflows onto `main`.

### Working branches

| Kind | Name | Cut from | PR into | Merge method |
|---|---|---|---|---|
| feature / fix | any, e.g. `003-points-rules`, `fix/…` | `develop` | `develop` | squash |
| hotfix | `hotfix/<short-name>` | `main` | `main` | merge commit |
| back-merge | `sync/<short-name>` | `main`, with `origin/develop` merged in | `develop` | merge commit |
| release | `develop` itself | — | `main` | merge commit |

## Deploying

Merging into `main` deploys. Once `lint`, `typecheck` and `test` pass on the
merged commit, CI applies pending D1 migrations, then publishes the Worker.
Nothing else deploys; merges into `develop` don't.

- **Migrations** run first. They're forward-only and never rolled back, so a
  migration must keep the previously deployed version working: add tables and
  columns, don't rename or drop them in the same release. Remove old parts in a
  later release.
- **Which commit runs**: **Deployments → production** on GitHub. The Cloudflare
  version message carries the commit SHA too.
- **When a deploy fails**, the run on the `main` commit is red, the deployment
  shows *failure*, the maintainer gets an e-mail, and the previous version keeps
  serving.
- **Re-deploy**: `gh workflow run ci.yml --ref main` (or **Actions → CI → Run
  workflow → `main`**). It re-runs the checks and deploys the tip of `main` only.
- **Rollback**: preferably revert the change through a [hotfix](#hotfixes). As a
  break-glass, `pnpm wrangler rollback <version-id> --message "rollback: <reason>"`
  restores an earlier version at once, with limits: migrations stay applied,
  only the last 100 versions are available, GitHub doesn't see it, and the next
  merge or dispatch deploys `main` again.
- **A local `pnpm run deploy`** is break-glass only.

The one-time setup, the validation scenarios and rotating the deploy credential
are in the [CI and branch protection quickstart](specs/002-ci-branch-protection/quickstart.md),
§7–§11.

## Project principles

See [.specify/memory/constitution.md](.specify/memory/constitution.md). In short:
riders' consent and privacy first, good Strava API citizenship (webhooks, rate
limits), never overwrite what riders wrote, serverless with minimal dependencies,
and test-first development.

## License

[Unlicense](LICENSE) — public domain.
