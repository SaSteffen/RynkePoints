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

## Project principles

See [.specify/memory/constitution.md](.specify/memory/constitution.md). In short:
riders' consent and privacy first, good Strava API citizenship (webhooks, rate
limits), never overwrite what riders wrote, serverless with minimal dependencies,
and test-first development.

## License

[Unlicense](LICENSE) — public domain.
