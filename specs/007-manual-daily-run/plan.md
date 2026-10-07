# Implementation Plan: Run the Daily Job on Demand

**Branch**: `007-manual-daily-run` | **Date**: 2026-10-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/007-manual-daily-run/spec.md`

## Summary

A new route, `POST /admin/run-daily`, starts the same `handleScheduled` the cron
runs, in the background, and answers `202`. It needs `Authorization: Bearer
<ADMIN_TOKEN>`. Without that token, or when the route is called any other way, it
answers with the app's normal 404 page (research R1–R3). `scripts/run-daily.sh`
calls it with `curl`, and `pnpm daily:run` runs the script (R5). `ADMIN_TOKEN` is
a new Worker secret; putting it in production is a manual step (R4).

## Technical Context

**Language/Version**: TypeScript 7, Cloudflare Workers runtime, as before.

**Primary Dependencies**: none new. Web Crypto `timingSafeEqual`, the same way the
webhook compares its secret.

**Storage**: none. No migration, and the route reads and writes nothing itself.

**Testing**: Vitest in the Workers runtime. An integration test calls
`handleFetch` with a test `Ctx`, and `wiring.test.ts` gets one case for the real
entry point. The shell script is manual tooling and has no test.

**Target Platform**: the existing Worker at `https://trhh-rynke-coins.link`. The
script runs on Linux or macOS with bash and curl.

**Project Type**: web service (single project).

**Performance Goals**: answer within 1 s, while the run keeps going in the
background (SC-001).

**Constraints**: the run has to finish within the time `waitUntil` allows after
the response (research R2).

**Scale/Scope**: one route, one secret, one script, and a small `Ctx` change.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|-----------|-------|--------|
| I. Privacy & secrets | `ADMIN_TOKEN` is a Cloudflare secret in production, and lives in the gitignored `.dev.vars` locally. Tests use a synthetic value from `vitest.config.ts`. The script reads the token from the environment and passes it to curl on stdin, so it never shows up in the argument list (R5). The route returns no data. | ✅ |
| II. Strava API citizenship | The route only starts the existing fan-out steps, which queue work and never call Strava inline. The work they queue is already idempotent and respects the rate limits, so an extra or overlapping run costs requests but double-counts nothing. | ✅ |
| III. Rider content | Not touched. | ✅ |
| IV. Serverless, minimal deps | No new dependency, no new binding apart from a secret, no new resource. | ✅ |
| V. Test-first | The token check and the run trigger are covered by failing tests first (FR-006). | ✅ |
| Language | The 404 is the existing catalog page, and `202` has a plain English body for the script, the same as the webhook answers Strava. No new rider-facing text. | ✅ |
| Workflow | Putting the production secret is a manual step (quickstart). | ✅ |

Re-checked after Phase 1: unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/007-manual-daily-run/
├── plan.md
├── research.md
├── quickstart.md
├── contracts/
│   └── run-daily.md     # the route and the script
└── tasks.md             # /speckit-tasks
```

There is no `data-model.md`: the feature has no data.

### Source Code (repository root)

```text
src/
├── ctx.ts               # + waitUntil
├── index.ts             # makeCtx(env, exec) passes exec.waitUntil
├── crypto/
│   └── secret.ts        # new: secretEquals, moved out of webhook.ts
└── http/
    ├── router.ts        # + POST /admin/run-daily
    ├── run-daily.ts     # new: token check, waitUntil(handleScheduled), 202
    └── webhook.ts       # uses crypto/secret.ts
scripts/
└── run-daily.sh         # new
test/
├── support/ctx.ts       # makeCtx records waitUntil promises
└── integration/
    ├── run-daily.test.ts  # new
    └── wiring.test.ts     # + one case
wrangler.jsonc           # + ADMIN_TOKEN in secrets.required
worker-configuration.d.ts  # regenerated (pnpm types)
vitest.config.ts         # + synthetic ADMIN_TOKEN
.dev.vars.example        # + ADMIN_TOKEN
package.json             # + "daily:run"
```

**Structure Decision**: the existing single project. The handler sits next to the
other routes in `src/http/`, and the script next to `scripts/docs-pdf.sh`.

## Complexity Tracking

None.
