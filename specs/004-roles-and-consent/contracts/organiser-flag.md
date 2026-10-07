# Contract: the organiser flag

**Feature**: [spec.md](../spec.md) | **Research**: R2, R3, R10

## `riders.organiser`

| | |
|---|---|
| Column | `organiser INTEGER NOT NULL DEFAULT 0 CHECK (organiser IN (0, 1))` |
| Migration | `migrations/0008_organiser_flag.sql`, add only |
| Meaning | 1: the rider is an organiser (FR-001, FR-002) |
| Default | 0: new riders and every rider already stored |
| Read | with the rider row, on every request (`readViewer`, FR-003) |
| Written by the app | never (FR-004); connecting and reconnecting leave it as it is |
| Deleted | with the rider row (FR-015, FR-022) |

## Setting and clearing it

| Where | How | Set by |
|---|---|---|
| Production | `pnpm wrangler d1 execute rynke-points --remote --command "UPDATE riders SET organiser = 1 WHERE athlete_id = <id>"`, or the D1 console in the Cloudflare dashboard; `= 0` clears it | the maintainer (manual step, constitution Development Workflow) |
| `pnpm dev:strava` | the same command with `--local` instead of `--remote` | the maintainer |
| `pnpm dev` | the seed marks the sample riders with `organiser: true` (research R10); the same command with `--local --persist-to .wrangler/fake-state` changes it | `dev/fake-strava/seed.ts` |
| Tests | `seedRider(ctx, { organiser: true })` | the test |

To see who is an organiser:
`SELECT athlete_id, first_name FROM riders WHERE organiser = 1`.

The rider must have connected first: the flag lives on their row. A real organiser's
athlete ID goes only into these commands, never into the repository (constitution
Principle I, SC-007).

## Rollout

1. CI applies the migration when the release is merged into `main`, then publishes
   the code. Until the maintainer sets a flag, nobody is an organiser (FR-006),
   which is all this feature needs: no page uses the role yet.
2. Before the first organiser page ships (organiser-admin), the maintainer marks the
   organisers who have connected. Changes apply on the affected person's next
   request (SC-006).
