# Contract: the organiser list secret

**Feature**: [spec.md](../spec.md) | **Research**: R2, R3, R10

## `ORGANISER_ATHLETE_IDS`

| | |
|---|---|
| Kind | Worker secret, listed in `secrets.required` in `wrangler.jsonc` |
| Value | Strava athlete IDs, separated by commas and/or whitespace, e.g. `12345, 67890` |
| Empty | allowed in code: no organisers (FR-006) |
| Malformed entries | ignored; the rest still count |
| Read | on every request (FR-003); never cached, logged or rendered (FR-002) |

## Where the value comes from

| Where | Value | Set by |
|---|---|---|
| Production | the organisers' real athlete IDs | the maintainer: `pnpm wrangler secret put ORGANISER_ATHLETE_IDS` (manual step, constitution Development Workflow) |
| `pnpm dev:strava` | the maintainer's choice, e.g. their own ID | `.dev.vars` (gitignored); `.dev.vars.example` names the variable |
| `pnpm dev` | `990004,990099` (synthetic sample IDs) | `dev/fake.env`; the `pnpm dev` script unsets the variable from the shell like the other declared secrets |
| Tests | `""` | `vitest.config.ts` bindings; a test overrides it with `makeCtx({ env: { … } })` |

The repository never holds a real organiser ID (constitution Principle I, SC-007).

## Rollout

1. Before the release with this feature is merged into `main`, the maintainer runs
   `pnpm wrangler secret put ORGANISER_ATHLETE_IDS` and enters the list. A deploy
   without the secret fails, because it is declared as required.
   - If the team has no organiser yet, any value that holds no athlete ID works
     (e.g. `none`): it means no organisers.
2. Changing the list later: the same command. It applies to the next request of
   every affected person, without a code change or deploy (SC-006).
