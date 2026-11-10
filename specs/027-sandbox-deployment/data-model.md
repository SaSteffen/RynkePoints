# Data Model: Release Sandboxes, slice 1

Slice 1 adds no table and no migration. A sandbox's database has production's schema, filled by
the same migrations, holding only the sample riders of feature 006.

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

| State | How it's detected | Next deployment does |
|---|---|---|
| Empty (new or rebuilt by hand) | no `d1_migrations` table | seeds from the local dump, then migrations (none pending) |
| Seeded | `d1_migrations` exists | applies pending migrations to the existing rows (FR-016) |
| Stuck | a migration failed | message says so; rebuilt by hand until slice 3 |
