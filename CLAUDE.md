# CLAUDE.md

Project-specific guidance for Claude Code in this repo. Read
[.specify/memory/constitution.md](.specify/memory/constitution.md) first — it is the
source of truth for project principles (consent, privacy, Strava API rules, testing)
and overrides anything below if they conflict. [REQUIREMENTS.md](REQUIREMENTS.md) has
the original feature background.

## Commands

```bash
pnpm install          # install deps + git hooks (lefthook, via "prepare")
pnpm dev              # the app on http://localhost:8789 with a fake Strava and
                      # synthetic sample riders; doesn't read .dev.vars
pnpm dev:strava       # the app on port 8789 against the real Strava (.dev.vars);
                      # uses the app's Strava request budget
pnpm test             # Vitest inside the Workers runtime
pnpm lint             # Biome lint + format check
pnpm format           # Biome autofix
pnpm typecheck        # tsc --noEmit
pnpm types            # regenerate worker-configuration.d.ts after editing wrangler.jsonc
pnpm wrangler d1 migrations apply rynke-points --local   # local D1 schema for pnpm dev:strava
                                                          # (pnpm dev applies its own)
```

`wrangler.jsonc` declares the D1 (`DB`), Queue (`WORK_QUEUE`) and daily cron
bindings; tests get the same bindings locally through Miniflare.

Commits go through git hooks (`lefthook.yml`): Biome and `tsc` run on every commit,
and commit messages must follow
[Conventional Commits](https://www.conventionalcommits.org/) (`feat: ...`, `fix: ...`,
`chore: ...`, etc.), checked by commitlint.

## Branches and pull requests

- Work on a branch cut from `develop` (or `hotfix/<name>` from `main` for an urgent
  fix). Never push to `main` or `develop`; the rulesets refuse it anyway.
- Every change reaches them through a pull request whose title is a Conventional
  Commit (it becomes the squash commit, plus ` (#N)`, within 100 characters).
- Pushing and `gh pr create` are outward-facing: only do them when the user asks.
- CI runs the same `pnpm lint`, `pnpm typecheck`, `pnpm test` and commitlint
  (commits and PR title) as the local hooks.
- The six check jobs' names are the required-check contexts. Renaming one means
  updating both `.github/rulesets/*.json` files in the same change. `deploy-gate`
  and `deploy` are not contexts and must never be added to them.

## Non-negotiables

- This repo is **public**. Never commit `.dev.vars`, `.env*`, `.wrangler/`, Strava
  tokens/secrets, or real rider data — not even in test fixtures (constitution
  Principle I). Fixtures are synthetic.
- Never call the real Strava API or production Cloudflare resources from tests or as
  a side effect. Production is deployed by CI after a merge into `main` (code plus
  pending D1 migrations, forward-only); a local `pnpm run deploy`,
  `wrangler secret put`, `wrangler d1 ... --remote` and webhook-subscription changes
  are manual steps the user runs or explicitly asks for.
- A migration must keep the previously deployed version working (add, don't rename
  or drop in the same release): CI applies it before publishing the new code.
- Applying branch rulesets (`.github/rulesets/README.md`) and repository settings
  (`.github/repository-settings.md`) is a manual step too: the user runs it or
  explicitly asks for it.
- Creating the deploy credential and the `production` environment
  (`.github/repository-settings.md`) is a manual step too.
- Webhook handlers ack fast and enqueue; processing is idempotent (Principle II).
- Editing a Strava activity description only ever touches the app's own delimited
  block; rider text is never lost (Principle III).
- Rider-facing text belongs in the catalogs under `src/i18n/messages/`, in every
  language, never inline in pages or logic (FR-028).
- `src/` never imports `dev/`: the fake Strava and its sample data must not reach
  the production bundle (feature 006 FR-009, `test/unit/dev-guard.test.ts`).
- `.specify/scripts/` and `.specify/templates/` are vendored Spec Kit files, not
  project code — don't lint, refactor, or "clean up" them.
