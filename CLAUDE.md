# CLAUDE.md

Project-specific guidance for Claude Code in this repo. Read
[.specify/memory/constitution.md](.specify/memory/constitution.md) first — it is the
source of truth for project principles (consent, privacy, Strava API rules, testing)
and overrides anything below if they conflict. [REQUIREMENTS.md](REQUIREMENTS.md) has
the original feature background.

## Commands

```bash
pnpm install          # install deps + git hooks (lefthook, via "prepare")
pnpm dev              # run the Worker locally (reads .dev.vars)
pnpm test             # Vitest inside the Workers runtime
pnpm lint             # Biome lint + format check
pnpm format           # Biome autofix
pnpm typecheck        # tsc --noEmit
pnpm types            # regenerate worker-configuration.d.ts after editing wrangler.jsonc
```

Commits go through git hooks (`lefthook.yml`): Biome and `tsc` run on every commit,
and commit messages must follow
[Conventional Commits](https://www.conventionalcommits.org/) (`feat: ...`, `fix: ...`,
`chore: ...`, etc.), checked by commitlint.

## Non-negotiables

- This repo is **public**. Never commit `.dev.vars`, `.env*`, `.wrangler/`, Strava
  tokens/secrets, or real rider data — not even in test fixtures (constitution
  Principle I). Fixtures are synthetic.
- Never call the real Strava API or production Cloudflare resources from tests or as
  a side effect. `pnpm run deploy`, `wrangler secret put`, `wrangler d1 ... --remote`
  and webhook-subscription changes are manual steps the user runs or explicitly
  asks for.
- Webhook handlers ack fast and enqueue; processing is idempotent (Principle II).
- Editing a Strava activity description only ever touches the app's own delimited
  block; rider text is never lost (Principle III).
- `.specify/scripts/` and `.specify/templates/` are vendored Spec Kit files, not
  project code — don't lint, refactor, or "clean up" them.
