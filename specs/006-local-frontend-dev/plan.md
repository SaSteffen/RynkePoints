# Implementation Plan: Local Frontend Development with a Fake Strava

**Branch**: `005-rider-view` (no branch of its own, see spec) | **Date**: 2026-10-07 |
**Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/006-local-frontend-dev/spec.md`

## Summary

`pnpm dev` runs the app locally on port 8789 against a **fake Strava**, using only
synthetic data. Running against the real Strava becomes the separate
`pnpm dev:strava`.

- **A dev entry point, not a production switch**: `dev/worker.ts` wraps the
  exported handlers of `src/index.ts`. It intercepts every request the app sends
  to `https://www.strava.com` and answers it from the fake. The app's own code
  paths run unchanged, and nothing under `src/` knows about the fake, so it can't
  ship to production (research R1, R2, R9).
- **A stand-in permission screen**: the app's redirect to Strava's authorize URL
  is rewritten to `/_dev/strava/oauth/authorize`. There the developer picks a
  sample rider and the scopes, or cancels (R3).
- **State that survives reloads**: tokens encode the athlete, the scopes and the
  expiry. Fake activities live in a `fake_strava_activities` table that only the
  fake mode database has (R4).
- **Its own settings and database**: `--env-file dev/fake.env` (synthetic, committed)
  replaces `.dev.vars`, and `--persist-to .wrangler/fake-state` keeps the sample data
  apart from any real-Strava local run (R5).
- **Sample riders seeded through the real flow**: about ten riders in named states
  connect through `/connect` → stand-in screen → `/auth/callback`. The local queue
  then imports and evaluates their rides, so every number on `/me` comes from the
  app's own rules (R6). A `/_dev/` page offers sign-in as any sample rider, reset,
  and simulated Strava events through the real webhook route (R8).
- **Port and reload**: `dev.port` 8789 in `wrangler.jsonc`, plus `--live-reload` and
  `--test-scheduled` (R7).
- **No new dependency, no migration, no production behaviour change.**

## Technical Context

**Language/Version**: TypeScript 7 (`tsc --noEmit`), Cloudflare Workers runtime
(`compatibility_date` 2026-08-22), as features 001, 003 and 005.

**Primary Dependencies**: None new. Wrangler (already a dev dependency) provides
`wrangler dev [script]`, `--env-file`, `--persist-to`, `--live-reload`,
`--test-scheduled` and `dev.port`.

**Storage**: Local D1 under `.wrangler/fake-state` with the app's migrations, plus
the fake's own table `fake_strava_activities`, created at runtime by the dev entry
and never a migration ([data-model.md](data-model.md)).

**Testing**: Vitest in the Workers pool (`pnpm test`): the guard tests and one
end-to-end smoke test of fake mode (research R10).

**Target Platform**: The developer's machine (Linux or macOS), `wrangler dev`
(workerd via Miniflare).

**Project Type**: Developer tooling for the existing Worker web app.

**Performance Goals**: Fresh checkout to a filled `/me` in under 10 minutes
(SC-001). A save shows in the browser within 5 s (SC-003). Seeding and importing
all sample riders takes under 30 s.

**Constraints**: Zero requests to Strava in fake mode (FR-006, SC-002). No
production code path or configuration may enable the fake (FR-009). Sample data is
synthetic and has no GPS fields (FR-011, Principle I). Port 8787 is never used.

**Scale/Scope**: About 10 sample riders and about 150 sample rides. The app paths
touched are only `/connect`, `/auth/callback`, the webhook route, the queue and the
pages.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. Privacy and consent | All sample riders, IDs, names and rides are invented. The fake table has no GPS or polyline fields. Fake mode's database is separate from any local database that could hold real data (R5). `dev/fake.env` holds synthetic placeholder keys only, like `vitest.config.ts`. Real `.dev.vars` credentials aren't read in fake mode. Sample riders go through the real consent step. | ✅ |
| II. Strava API citizenship | Fake mode makes no Strava calls at all: the interceptor never passes a Strava URL through (R2). Simulated events take the real webhook path: ack, enqueue, process idempotently (R8). The fake sends no rate headers, so the budget row isn't touched by fake answers (FR-006). | ✅ |
| III. Rider-authored content | Nothing writes to Strava descriptions. The fake answers no write endpoint, and the app has none yet. | ✅ (n/a) |
| IV. Serverless, TS, minimal deps | No new dependency, no new binding, no migration, free tier unaffected. The dev entry is not deployed. | ✅ |
| V. Test-first | The guard tests (FR-009) and the fake mode smoke test are written red first (R10). The fake's internals are tooling and aren't tested endpoint by endpoint. Existing tests and their own fake are unchanged. | ✅ |
| Language | Rider pages are unchanged and stay catalog-driven. The `/_dev/` pages are developer tooling in English (R11). Code, docs and logs are in English. | ✅ |
| Development workflow | Nothing touches production. CI and `pnpm run deploy` keep deploying `src/index.ts`. `pnpm lint`, `pnpm typecheck` and `pnpm test` cover `dev/`, which is added to `tsconfig.json`'s `include`. | ✅ |

**Post-design re-check** (after Phase 1): still all ✅. The design adds no
production surface: `wrangler.jsonc` only gains `dev.port`, which `wrangler deploy`
ignores.

## Project Structure

### Documentation (this feature)

```text
specs/006-local-frontend-dev/
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1: sample riders, fake table, token formats
├── quickstart.md        # Phase 1: run and validate
├── contracts/
│   ├── dev-routes.md    # /_dev/ routes of the dev entry
│   └── fake-strava.md   # Strava endpoints the fake answers, and how
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
dev/                              # local-only, never imported by src/
├── worker.ts                     # dev entry: guards, /_dev routes, fetch interception,
│                                 # authorize-redirect rewrite, delegates to src/index.ts
├── fake.env                      # synthetic secrets + RYNKE_FAKE_STRAVA marker
└── fake-strava/
    ├── api.ts                    # answers /oauth/token, /oauth/revoke, /api/v3/...
    ├── tokens.ts                 # stateless codes and tokens
    ├── store.ts                  # fake_strava_activities in the local DB
    ├── samples.ts                # sample riders and ride recipes
    ├── seed.ts                   # reset + connect every sample rider through the real flow
    ├── events.ts                 # simulated webhook events
    └── pages.ts                  # /_dev/ index and stand-in authorize screen (English)

test/
├── unit/dev-guard.test.ts        # FR-009: src/ never imports dev/; dev entry guards
└── integration/dev-fake-strava.test.ts   # fake mode end to end (seed → import → /me)

wrangler.jsonc                    # + "dev": { "port": 8789 }
package.json                      # dev = fake mode; dev:strava = real Strava
tsconfig.json                     # include "dev"
CLAUDE.md, README.md, .dev.vars.example,
specs/{001,003,005}-…/quickstart.md      # commands and port updated
```

**Structure Decision**: The fake goes in a top-level `dev/` directory next to
`src/`. That keeps it out of the production entry's import graph by construction,
while Biome, `tsc` and Vitest still check it. `src/` is unchanged.

## Complexity Tracking

No constitution violations to justify.
