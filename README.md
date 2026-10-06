# RynkePoints

Strava integration for Team Rynkeby Hamburg. Riders connect their Strava account
(opt-in), the app collects key data from their activities (distance, date, elevation
gain, …), detects participation in team events, and awards gamified **Rynke Points**.
With the rider's permission it can also write their points into the Strava activity
description.

Runs serverless on Cloudflare Workers, with D1 for storage and Queues for
processing Strava webhook events.

> Status: project scaffold. Features are specified and built with
> [Spec Kit](https://github.com/github/spec-kit) — see `specs/` once the first
> feature exists.

## Getting started

Requirements: Node 24 (see `.nvmrc`) and pnpm (`corepack enable`).

```bash
pnpm install                # deps + git hooks
cp .dev.vars.example .dev.vars   # fill in your Strava API app credentials
pnpm test
pnpm dev                    # local Worker on http://localhost:8787
```

You need your own [Strava API application](https://www.strava.com/settings/api) for
local development and a Cloudflare account for deploying.

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

### Hotfixes

1. Cut `hotfix/<short-name>` from `origin/main`, commit conventionally, and open
   a pull request into `main`. Merge it with a merge commit once it's green.
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

## Project principles

See [.specify/memory/constitution.md](.specify/memory/constitution.md). In short:
riders' consent and privacy first, good Strava API citizenship (webhooks, rate
limits), never overwrite what riders wrote, serverless with minimal dependencies,
and test-first development.

## License

[Unlicense](LICENSE) — public domain.
