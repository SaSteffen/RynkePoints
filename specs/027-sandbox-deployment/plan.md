# Implementation Plan: Release Sandboxes, slice 1

**Branch**: `docs/027-sandbox-slices` | **Date**: 2026-11-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/027-sandbox-deployment/spec.md`, slice 1 (spec,
Slices): Hamburg's and Europe's sandboxes, chosen on **Release PR** or by hand, a message per
deployment, the usage check before writing, no cron, no gate.

Slice 2 (the gate) is planned at the end, from 2026-11-11, with slice 1 in use; slice 3 (scale)
was dropped.

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
- fake mode's overview reading no rides, and the page per sample rider (FR-051);
- the host-only session cookie;
- `team-check`'s sandbox rules;
- the usage verdict.

The workflows are checked by the quickstart, as `ci.yml`'s deploy is today.

**Target Platform**: Cloudflare Workers (Free plan), Cloudflare Zero Trust Access (Free plan),
GitHub Actions.

**Project Type**: Web service plus CI.

**Performance Goals**: SC-002: a chosen sandbox runs the head commit within 15 minutes of
choosing, provided lint, the type check and the unit tests pass. It doesn't wait for the
end-to-end tests (FR-015). Seeding on CI takes seconds and the import about a minute, so
waiting for the checks takes most of it.

**Constraints**:
- 10 ms of CPU per request, which is why seeding runs outside the Worker (R6), and why fake
  mode's overview reads no rides (R9a).
- Rows written: about 7,000 per deployment and team, within a daily sandbox budget of 40,000
  and the 50 % check (R7).
- 5 crons per account, of which sandboxes use none.
- 10 databases per account: 2 production and 2 sandbox, so 4 in use.
- The daily allowances, guarded by the 50 % check (R7).

**Scale/Scope**: Two sandboxes, a handful of maintainers as users, the sample riders only.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design: still passes.*

| Principle | Check | Status |
|---|---|---|
| I. Rider data privacy | No production data reaches a sandbox (FR-038). The data is synthetic sample riders from `dev/`, seeded on CI's machine. Two layers keep the fake sign-in from the public (R3). Sessions can't cross to production (R4). Nothing is read from production for a sandbox (slice 3 dropped). | Pass |
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
│                                   #   no seeding in a request, reset refused, bar, /_dev/scheduled,
│                                   #   GET /_dev/riders/<id>; the overview reads no rides
├── sandbox-access.ts               # new: Access JWT verification (contracts/access-check.md)
├── sandbox-usage.ts                # new: pure verdict over fetchCloudflareUsage's result
└── fake-strava/pages.ts            # "Run the daily work" button on /_dev/; overview without
                                    #   ride forms; the page per sample rider
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
2. Fake mode's sandbox mode: hosts, no seeding in a request, reset refused, bar, `/_dev/scheduled`,
   and the page per sample rider (FR-051).
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

# Slice 2: the gate

**Date**: 2026-11-11 | **Branch**: `docs/027-pr-target-policy` | **Input**: spec, Slices row 2:
`sandbox-gate`, the control comment and its actions (User Stories 2 and 3, FR-021–FR-031,
FR-047). Pull requests into `main` only (Clarifications 2026-11-11).

## Summary

A new required check on `main`, `sandbox-gate`, says whether the sandbox question is settled
for the release pull request's exact head. It is a check run the workflow writes (research R14),
worked out each time from what GitHub already records: the `release #<pr>` deployments of each
sandbox, the head's commit time against the pull request's, and acceptance comments (R15).

A control comment on the release pull request shows the state, the new commits and the actions
as boxes: deploy per sandbox, and **Accept**. Ticking one reaches `sandbox-gate.yml` as it is on
`develop`, which checks the sender and the commit and then deploys through **Sandbox** or posts
the acceptance (R17). **Accept** needs admin rights, which is the founding maintainer until spec
028's stage 2 (R18). **Sandbox** records deployments before waiting for the checks, so a chosen
sandbox holds the gate from the start (R16), and it re-evaluates the gate when it starts and
ends (R19). Hotfixes pass at once.

The check goes into `main`'s ruleset in a second, small pull request, once it has reported on a
release (R20).

## Technical Context

**Language/Version**: Node 24 (`scripts/sandbox-gate.mjs`, built-ins and `fetch` only), Bash
and YAML in GitHub Actions.

**Primary Dependencies**: the GitHub REST API with `github.token`. No new dependency.

**Storage**: none; GitHub's deployments, comments and check runs (R15).

**Testing**: Vitest for the pure parts of `scripts/sandbox-gate.mjs`: `decideGate` for every row of
the contract's table, `parseClicks`, the acceptance rules, the comment's rendering. The
workflows are checked by quickstart checks 24–32 on a live release.

**Target Platform**: GitHub Actions, rulesets.

**Performance Goals**: The gate reflects a click or a finished deployment within about a minute
plus GitHub's queue; an evaluation makes about ten API calls.

**Constraints**: The ruleset pins required checks to the GitHub Actions app (R14). A required
check must report on every pull request into `main` (FR-024), hotfixes included.

**Scale/Scope**: One release pull request at a time, two sandboxes, one or two maintainers.

## Constitution Check

*Before research and again after the design: passes.*

| Principle | Check | Status |
|---|---|---|
| I. Rider data privacy | No data moves; the gate reads GitHub only. Comments hold commits, team names and logins. | Pass |
| II. Strava API citizenship | Not touched. | Pass |
| III. Rider-authored content | Not touched. | Pass |
| IV. Serverless, minimal dependencies, free tier | No new dependency or service; no Cloudflare calls beyond slice 1's deployments, which still need a click. | Pass |
| V. Test-first | The decision, the clicks and the acceptance rules are pure functions with failing tests first. | Pass |
| Development workflow | Production's deployment doesn't read the gate (FR-030); the gate holds merging only. The ruleset change is a separate pull request, applied by hand. | Pass |
| Manual steps stay manual | Applying `main.json` stays the founding maintainer's. | Pass |
| Language | Comments and check runs are maintainer-facing English. | Pass |

**What the gate trusts**: Anyone with write access could create a `release #<pr>` deployment or a
check run named `sandbox-gate` from a workflow of their own branch, or edit the control comment.
The first two need write access, which already lets them push to `develop` through a pull
request; an edited acceptance stops counting (R17); and the founding maintainer's approval
(spec 028) stays a separate requirement. Same boundary as slice 1's pull request checkboxes.

## Project Structure (slice 2)

```text
scripts/
├── sandbox-gate.mjs                # new: decideGate, parseClicks, rendering; CLI evaluate | click
└── sandbox-gate.d.mts              # new: types for the tests
.github/
├── workflows/sandbox-gate.yml      # new: pull_request into main, issue_comment, dispatch
├── workflows/sandbox.yml           # queued deployments in resolve; gate-start, gate-end
├── workflows/release-pr.yml        # body points to the control comment
├── rulesets/main.json              # second pull request: sandbox-gate
├── rulesets/README.md              # second pull request: the check-run exception
└── repository-settings.md          # unchanged (no new setting)
docs/sandboxes.md                   # the gate, the control comment, Accept, the fallback
README.md, CLAUDE.md                # the gate; click, deploy, gate, gate-start, gate-end aren't contexts
test/unit/sandbox-gate.test.ts      # new
```

## Order of work (slice 2)

1. `decideGate`, `parseClicks` and the acceptance rule, tests first (contracts/sandbox-gate.md).
2. The comment and check-run rendering, tests first; then the CLI: `evaluate --pr <n>` and
   `click` (reads the event file).
3. `sandbox.yml`: deployments recorded as `queued` in `resolve`, `inactive` on a skip,
   `gate-start` and `gate-end`.
4. `sandbox-gate.yml`.
5. Docs: `docs/sandboxes.md`, README, CLAUDE.md, `release-pr.yml`'s body.
6. Merge; the next release pull request shows the control comment and the check (quickstart
   24–31).
7. The second pull request: `main.json`, its README, CLAUDE.md, 002 FR-012. The founding maintainer
   applies it (quickstart 32).
