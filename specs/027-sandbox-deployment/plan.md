# Implementation Plan: Release Sandboxes, slice 1

**Branch**: `docs/027-sandbox-slices` | **Date**: 2026-11-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/027-sandbox-deployment/spec.md`, slice 1 (spec,
Slices): Hamburg's and Europe's sandboxes, chosen on **Release PR** or by hand, a message per
deployment, the usage check before writing, no cron, no gate.

Slices 2 (the gate) and 3 (scale and reset) are planned when slice 1 is in use; this plan is
extended then, not replaced.

## Summary

Each sandbox is one more Wrangler environment, `sandbox-<team>`, running fake mode's existing
entry `dev/worker.ts` with its own Worker, database, queue and custom domain
`sandbox-<team>.trhh-rynke-coins.link`, and no cron. It is closed to the public twice:
Cloudflare Access lets in only the e-mail addresses the maintainers list, and the Worker
refuses every request without a valid Access token for its own application, so a
misconfigured or deleted Access application closes the sandbox instead of opening it
(research R3, contracts/access-check.md).

A new reusable workflow, **Sandbox**, deploys a chosen sandbox:
1. It waits for the commit's checks.
2. It checks the configuration against production's.
3. On CI's machine, it seeds the sample riders at `main`'s version, as production holds them
   when the release lands, and tries the release's migrations on that copy.
4. It checks the account's usage today, including what the seed will write.
5. It rebuilds the sandbox's database from the seed, applies the release's migrations to it,
   then deploys. Every deployment starts fresh, so deploying again is the reset.
6. It posts a message on the release pull request.

It is started in three ways:
- a checkbox per sandbox in the description of every pull request into `develop`, which unticks
  itself after the deployment starts (research R13);
- a checkbox per sandbox on **Release PR**;
- by hand on `develop`.

The pull request workflow always runs as it is on `develop` (`pull_request_target`), only for
branches of this repository and senders with write access.

## Technical Context

**Language/Version**: TypeScript (Workers runtime), Bash in GitHub Actions, Node 24 for scripts
(`scripts/*.mjs` importing `src/` TypeScript, as `team-check` does).

**Primary Dependencies**: Wrangler 4.158 (already in the repo), Web Crypto for the JWT check. No
new dependency.

**Storage**: One more D1 database per sandbox, production's schema and migrations, rebuilt on
every deployment; no new table.

**Testing**: Vitest in the Workers runtime:
- the access check;
- the sandbox-only behaviour of fake mode (no seeding in a request, reset refused, the bar,
  `/_dev/scheduled`);
- the host-only session cookie;
- `team-check`'s sandbox rules;
- the usage verdict.

The workflows are checked by the quickstart, as `ci.yml`'s deploy is today.

**Target Platform**: Cloudflare Workers (Free plan), Cloudflare Zero Trust Access (Free plan),
GitHub Actions.

**Project Type**: Web service plus CI.

**Performance Goals**: SC-002: a chosen sandbox runs the head commit within 30 minutes of
choosing, provided the checks pass. CI's checks take most of it; the deploy itself takes minutes.

**Constraints**:
- 10 ms of CPU per request, which is why seeding runs outside the Worker (R6).
- 5 crons per account, of which sandboxes use none.
- 10 databases per account: 2 production and 2 sandbox, so 4 in use.
- The daily allowances, guarded by the 50 % check (R7).

**Scale/Scope**: Two sandboxes, a handful of maintainers as users, the sample riders only.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design: still passes.*

| Principle | Check | Status |
|---|---|---|
| I. Rider data privacy | No production data reaches a sandbox (FR-038). The data is synthetic sample riders from `dev/`, seeded on CI's machine. Two layers keep the fake sign-in from the public (R3). Sessions can't cross to production (R4). The scale profile, which reads production totals, is slice 3. | Pass |
| II. Strava API citizenship | A sandbox has no real Strava credential and every Strava request goes to the in-process fake (R5). No webhook subscription points at a sandbox, and the gateway doesn't list them. | Pass |
| III. Rider-authored content | Unchanged; the fake Strava's descriptions only. | Pass |
| IV. Serverless, minimal dependencies, free tier | Workers, D1, Queues; no cron (FR-032); JWT verified with Web Crypto, no library; work stops above 50 % of a daily allowance or when figures are unavailable (R7). The credential reaches more than the sandboxes, stated below. | Pass |
| V. Test-first | Every Worker and script change starts with a failing Vitest test (contracts list them). Workflow YAML has no unit tests in this repo; the quickstart covers it. | Pass |
| Development workflow: production only from `main` | Sandboxes aren't production: their Workers, databases and hosts are separate, and `team-check --deployable` refuses a sandbox name. Production's deploy job is unchanged, apart from its "newer than live" logic moving into a shared script (R10). | Pass |
| Manual steps stay manual | Creating resources, Access, secrets, tokens and environments are the founding maintainer's (quickstart). CI only deploys code and migrations, and seeds an empty sandbox database. | Pass |
| Language | Rider-facing text unchanged; the sandbox bar and messages are developer-facing English (FR-003). | Pass |

**What the sandbox credential can still reach (FR-011)**: Cloudflare offers no token limited to
some Workers or some databases. So the deploy token could also do these things to production:
- deploy its Workers;
- write to its databases;
- change routes in the zone.

It is released only to the sandbox workflows as they are on `develop`, and used only in the
steps that write to Cloudflare, always with `--env sandbox-<team>`, after `develop`'s copy of
`team-check` refused any production name in a sandbox block (R11). For a pull request into
`develop`, the branch's code is built in that job, so a branch could tamper with those steps.
Only branches of this repository and senders with write access qualify, so this reaches nobody
who couldn't already push to the repository (R13). The analytics token is read-only.

## Project Structure

### Documentation (this feature)

```text
specs/027-sandbox-deployment/
├── spec.md
├── plan.md              # this file (slice 1)
├── research.md          # R1–R13
├── data-model.md
├── quickstart.md        # one-time setup and checks
├── contracts/
│   ├── access-check.md
│   ├── sandbox-config.md
│   └── sandbox-workflow.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
wrangler.jsonc                      # + sandbox-hamburg, sandbox-europe blocks
worker-configuration.d.ts           # pnpm types
dev/
├── worker.ts                       # sandbox mode: assertFakeMode, host + access check first,
│                                   #   no seeding in a request, reset refused, bar, /_dev/scheduled
├── sandbox-access.ts               # new: Access JWT verification (contracts/access-check.md)
├── sandbox-usage.ts                # new: pure verdict over fetchCloudflareUsage's result
└── fake-strava/pages.ts            # "Run the daily work" button on /_dev/
scripts/
├── team-check.mjs                  # sandbox rules, --deployable refuses sandbox-*
├── sandbox-usage.mjs               # new: usage check before writing
└── sandbox-seed.sh                 # new: seed at main locally, try migrations, rebuild remote
.github/
├── scripts/newer-than-live.sh      # moved out of ci.yml's deploy-gate, used by both
├── workflows/ci.yml                # deploy-gate calls the shared script
├── workflows/release-pr.yml        # sandbox inputs, uses an open PR, guidance in the body
├── workflows/sandbox.yml           # new
├── workflows/sandbox-pr.yml        # new: checkboxes in pull requests into develop
├── pull_request_template.md        # new: the Sandboxes checkboxes
└── repository-settings.md          # sandbox environments and tokens (FR-042)
docs/sandboxes.md                   # new: what they are, the guidance, rebuilding by hand
README.md, CLAUDE.md                # sandboxes, the checkboxes, non-context job names (FR-046)
specs/006-local-frontend-dev/spec.md  # FR-009 amended (FR-013)
test/unit/                          # sandbox-access, dev-sandbox, team-check-sandbox,
                                    #   sandbox-verdict, session-cookie tests
```

**Structure Decision**: The existing single project. Sandbox behaviour lives in `dev/`, which
`src/` never imports (`test/unit/dev-guard.test.ts`), so the production bundle is unchanged
(FR-004, FR-013).

## Order of work

1. The access check, with its tests (contracts/access-check.md). Nothing is deployable before it.
2. Fake mode's sandbox mode: hosts, no seeding in a request, reset refused, bar, `/_dev/scheduled`.
3. The `wrangler.jsonc` blocks with placeholder IDs, `pnpm types`, `team-check`'s rules.
4. The usage verdict and script.
5. The seed script, tried locally against a local stand-in for the remote database.
6. `newer-than-live.sh`, then `sandbox.yml`, then `sandbox-pr.yml` and the template, then
   `release-pr.yml`.
7. Docs: `docs/sandboxes.md`, `repository-settings.md`, README, CLAUDE.md, 006 FR-009.
8. Once merged: the founding maintainer's setup (quickstart), then checks 2–14 on the live
   sandboxes. 026's T074 is done with Europe's.

## Complexity Tracking

No constitution violations to justify.
