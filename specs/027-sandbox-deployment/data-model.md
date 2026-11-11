# Data Model: Release Sandboxes, slice 1

Slice 1 adds no table and no migration. A sandbox's database has production's schema, filled by
the same migrations, holding only the sample riders of feature 006. Nothing in it outlives a
deployment.

## Sandbox

Defined by its `wrangler.jsonc` block `sandbox-<team>` (contracts/sandbox-config.md), its
Release PR input `sandbox-<team>` and its GitHub environment `sandbox-<team>`.

| Field | Where | Rule |
|---|---|---|
| Team | block name, `TEAM_ID` | a team in `src/teams/` |
| Worker, database, queue | block | `rynke-points-sandbox-<team>`, `…-work`; shared with nothing (FR-001) |
| Host | route, `SANDBOX_HOST` | `sandbox-<team>.trhh-rynke-coins.link` |
| Access application | `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` | both set, or fake mode doesn't start |
| Secrets | Cloudflare, by hand | research R5 |
| Live commit | GitHub deployments of environment `sandbox-<team>` | newest with status `success` |

## Sandbox deployment

A GitHub deployment in environment `sandbox-<team>`, created by the job.

| State | Meaning |
|---|---|
| `in_progress` | job running past the checks wait |
| `success` | migrations applied and code deployed; this commit is live |
| `failure` | stopped at a step; the previous commit stays live |
| none created | skipped as older than live, or stopped before the wait ended |

Transitions: `in_progress → success | failure`. A newer commit's `success` makes the older one
inactive, as for production.

## Message

A pull request comment per deployment (contracts/sandbox-workflow.md). Write-once, never edited
in slice 1. The control comment that collects them comes in slice 2.

## Sandbox database lifecycle

Every deployment, in order (research R6):

| Step | Where | On failure |
|---|---|---|
| Seed the sample riders with the base's code and migrations (`main` or `develop`) | CI, local database | stop; sandbox untouched |
| Apply the release's migrations to a copy | CI, local database | stop; sandbox untouched |
| Usage check | Cloudflare analytics | stop; sandbox untouched |
| Drop all tables and views, import the seed | sandbox database | sandbox empty or half-built until the next deployment |
| Apply the release's migrations | sandbox database | code not deployed; old code on the new schema |
| Deploy the code | sandbox Worker | old code stays |

So between deployments the database holds exactly the seed plus the release's migrations, plus
whatever maintainers did in the sandbox since. Deploying again is the reset.

# Slice 2: the gate

Still no table and no migration: everything the gate decides from is on GitHub (research R15).

## Sandbox deployment, from slice 2

| State | Meaning |
|---|---|
| `queued` | recorded by `resolve`, waiting for the checks (R16) |
| `in_progress` | job running past the checks wait |
| `success` | migrations applied and code deployed; this commit is live |
| `failure` | stopped at a step; the previous commit stays live |
| `inactive` | skipped as older than live |

Transitions: `queued → in_progress → success | failure`, `queued → failure` (stopped while
waiting), `queued → inactive`. For the gate, `queued` or `in_progress` older than 90 minutes is
`stale`, which counts as failed. Description: `release #<pr>`, `PR #<pr>` or `develop`; only
`release #<pr>` counts for the gate.

## Gate decision

Not stored; worked out on each evaluation for the pull request's head (contracts/sandbox-gate.md).

| Field | Rule |
|---|---|
| Commit | the head, exactly (FR-025) |
| Required sandboxes | every sandbox with a `release #<pr>` deployment, any commit (FR-026) |
| State | `pass`, `running` or `blocked`, by the contract's table |
| Reason | one or two sentences, English |
| Offer | deploy per sandbox, and **Accept** when not passing |

## Control comment

One per release pull request, by `github-actions[bot]`, marker `sandbox-gate:control <head>`.
Rewritten on every evaluation, so boxes ticked by hand are always unticked again. Never the
source of the decision: ticking it only starts a click (R17).

## Acceptance

A comment by `github-actions[bot]`, marker `sandbox-gate:accept <commit>`, write-once. Valid
for that commit only, and only while never edited (FR-025, FR-028). A new head makes it count
for nothing (US3 scenario 5); closing and reopening keeps it for the same commit (spec Edge
Cases).
