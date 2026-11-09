# CLAUDE.md

Project-specific guidance for Claude Code in this repo. Read
[.specify/memory/constitution.md](.specify/memory/constitution.md) first — it is the
source of truth for project principles (consent, privacy, Strava API rules, testing)
and overrides anything below if they conflict. [REQUIREMENTS.md](REQUIREMENTS.md) has
the original feature background.

## Commands

```bash
pnpm install          # install deps + git hooks (lefthook, via "prepare")
pnpm dev              # every team's app with a fake Strava and synthetic sample
                      # riders, behind the local Strava gateway on
                      # http://localhost:8791; output prefixed [hamburg] /
                      # [europe] / [gateway]; doesn't read .dev.vars
pnpm dev:hamburg      # Hamburg alone on http://localhost:8789, no gateway
pnpm dev:europe       # Europe alone on http://europe.localhost:8790
pnpm dev:strava       # the app on port 8789 against the real Strava (.dev.vars);
                      # uses the app's Strava request budget
pnpm test             # Vitest inside the Workers runtime
pnpm test:e2e         # Playwright smoke tests in Chromium, Firefox and WebKit,
                      # against fake mode on port 8797 (started for you), and
                      # Europe's in Chromium on 8798 (project europe-smoke);
                      # first `pnpm exec playwright install chromium firefox webkit`
pnpm test:e2e:webkit  # WebKit in Docker where it doesn't run natively (Arch);
                      # then run the tests with
                      # E2E_WEBKIT_SERVER=ws://127.0.0.1:3797/
pnpm lint             # Biome lint + format check
pnpm format           # Biome autofix
pnpm typecheck        # tsc --noEmit
pnpm types            # regenerate worker-configuration.d.ts after editing wrangler.jsonc
pnpm wrangler d1 migrations apply DB --local --env hamburg   # local D1 schema for pnpm dev:strava
                                                          # (pnpm dev applies its own)
pnpm season:album --local  # season albums from Hamburg's fake-mode season into
                           # season-albums/ (git-ignored); stop pnpm dev first
```

`wrangler.jsonc` declares the D1 (`DB`), Queue (`WORK_QUEUE`) and daily cron
bindings; tests get the same bindings locally through Miniflare. Each team is an
`env` block, Hamburg (the founding team) first: every Wrangler command names one with
`--env hamburg` or `--env europe`, and one without fails on purpose (its top level
holds no team).
What differs between teams is team data, in `src/teams/<id>.ts` plus that block,
never a branch in code (feature 026 contracts/team-data.md);
`node scripts/team-check.mjs` checks both. The Strava gateway has its own
`gateway/wrangler.jsonc`.

Commits go through git hooks (`lefthook.yml`): Biome and `tsc` run on every commit,
and commit messages must follow
[Conventional Commits](https://www.conventionalcommits.org/) (`feat: ...`, `fix: ...`,
`chore: ...`, etc.), checked by commitlint.

## Branches and pull requests

- Work on a branch cut from `develop` (or `hotfix/<name>` from `main` for an urgent
  fix). Never push to `main` or `develop`; the rulesets refuse it anyway.
- Every change reaches them through a pull request whose title is a Conventional
  Commit, within 100 characters. Every merge is a merge commit; squashing is forbidden.
- Pushing and `gh pr create` are outward-facing: only do them when the user asks.
- Merging belongs to the user. Never run `gh pr merge`, with or without `--auto`,
  unless the user explicitly asks for that pull request to be merged.
- CI runs the same `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` and commitlint
  (commits and PR title) as the local hooks. On PRs into `develop`, `e2e` runs Firefox
  and WebKit only for `@cross-browser` tests and changed e2e files
  (`scripts/e2e-scope.mjs`); PRs into `main` and the nightly `e2e-nightly.yml` run
  everything.
- The seven check jobs' names are the required-check contexts. Renaming one means
  updating both `.github/rulesets/*.json` files in the same change.
  `already-checked`, `playwright-image`, `deploy-gate`, `deploy`, `deploy-gateway`,
  `release-pr` and the `e2e-nightly.yml` jobs (`changed`, `nightly (…)`) are not
  contexts and must never be added to them.

## Non-negotiables

- This repo is **public**. Never commit `.dev.vars`, `.env*`, `.wrangler/`, Strava
  tokens/secrets, or real rider data — not even in test fixtures (constitution
  Principle I). Fixtures are synthetic.
- Never call the real Strava API or production Cloudflare resources from tests or as
  a side effect. Production is deployed by CI after a merge into `main` (code plus
  pending D1 migrations, forward-only); a local `pnpm run deploy`,
  `wrangler secret put`, `wrangler d1 ... --remote`, webhook-subscription changes
  and `pnpm season:album` without `--local` (it reads production, read only) are
  manual steps the user runs or explicitly asks for.
- A migration must keep the previously deployed version working (add, don't rename
  or drop in the same release): CI applies it before publishing the new code.
- Applying branch rulesets (`.github/rulesets/README.md`) and repository settings
  (`.github/repository-settings.md`) is a manual step too: the user runs it or
  explicitly asks for it.
- Creating the deploy credentials and the `production`, `production-gateway` and
  `production-europe` environments, setting the `GATEWAY_DEPLOY` and `EUROPE_DEPLOY`
  switches, and the release PR token and the `release` environment
  (`.github/repository-settings.md`), are manual steps too.
- Webhook handlers ack fast and enqueue; processing is idempotent (Principle II).
- Editing a Strava activity description only ever touches the app's own delimited
  block; rider text is never lost (Principle III).
- Rider-facing text belongs in the catalogs under `src/i18n/messages/`, in all ten
  languages (German is the key source), never inline in pages or logic (FR-028).
- No page, image or text of a team shows another team's name, place or art
  (feature 026 FR-023, `test/teams/no-other-team.test.ts`), and no rider's data
  crosses teams.
- `src/` never imports `dev/`, `album/` or `gateway/`: the fake Strava, its sample
  data, the season album Worker and the Strava gateway Worker must not reach the
  production bundle (feature 006 FR-009, feature 021 FR-020, feature 026,
  `test/unit/dev-guard.test.ts`).
- `.specify/scripts/` and `.specify/templates/` are vendored Spec Kit files, not
  project code — don't lint, refactor, or "clean up" them.
