# Implementation Plan: Multiple Maintainers

**Branch**: `027-sandbox-deployment` (PR #245; specs 026, 027 and 028 merge together) | **Date**: 2026-11-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/028-multiple-maintainers/spec.md`

## Summary

Let a second maintainer run the project without the Strava secret and without one person's account being a
hidden dependency. Most of this is account setup and documentation, done by hand and recorded in the
repository. The repository moves to a free GitHub organization, the founding maintainer's approval is
enforced by a ruleset of its own, and squash merging goes away first, on its own.

The code changes are small:

- `release-pr.yml` lists merged pull requests and uses a GitHub App instead of a personal token.
- `pr-policy.yml` lints the bare pull request title.
- `ci.yml` gets a job that tells every maintainer about a failure on `main`.
- The Worker emails usage alerts to maintainers, and fans out the contact address.

[research.md](research.md) records what the docs settled and what only a trial can settle.

## Technical Context

**Language/Version**: GitHub Actions YAML and Bash; TypeScript on Cloudflare Workers for the two Worker changes

**Primary Dependencies**: `actions/create-github-app-token` (CI only, pinned to a commit); Cloudflare Email Routing and its `send_email` binding. No new runtime package.

**Storage**: No schema change. Secrets on the Worker and on GitHub environments.

**Testing**: Vitest for the Worker changes, test first. Workflows and settings are checked by the [quickstart](quickstart.md) and the rulesets' `verify_ruleset`, as in spec 002.

**Target Platform**: GitHub Free organization, Cloudflare Free plan

**Project Type**: Project operations, plus two small Worker changes

**Performance Goals**: N/A

**Constraints**: Zero production downtime, zero extra cost, no rider data granted before the data controller's recorded decision, the Strava secret's value never leaves its owner

**Scale/Scope**: Two maintainers at first; 3 workflows, 3 rulesets, 2 Worker changes, about 6 docs

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Result | Why |
|---|---|---|
| I. Rider data and consent | Pass, with a gate | Cloudflare access reaches rider data, so it comes only after the data controller's decision, and after a new consent version if the review needs one ([contract](contracts/onboarding-order.md)). Alert emails carry no rider data. The secrets rule stays, and the accepted limit gets written into this principle (FR-002). |
| II. Strava citizenship | Pass | No new Strava requests. |
| III. Rider-authored content | Pass | Not touched. |
| IV. Serverless, minimal dependencies, free tier | Pass | No new runtime package; everything stays on free plans. The App token action runs in CI only. |
| V. Test first | Pass | The Worker changes start with failing tests. Workflows follow spec 002's practice: validated by running them. |
| Language | Pass | Alert emails go to maintainers, not riders, so they're in English and outside the catalogs. |
| Workflow: "Production is deployed only from `main`" | Pass | Unchanged. "The maintainer" becomes "a maintainer" (FR-002), version 2.4.0. |

**Post-design re-check**: Pass. The amendment is a planned deliverable, not a violation, and comes before anyone else
gets access.

## Delivery order

Each phase ships on its own. The order comes from dependencies, and [contracts/onboarding-order.md](contracts/onboarding-order.md)
has the gates.

| Phase | What | Needs | Who acts |
|---|---|---|---|
| A | Merge commits only (US9) | Nothing | Pull request, then the founding maintainer applies settings |
| B | `docs/maintainers.md`, constitution 2.4.0, updated docs, failure alerts job | A | Pull request |
| C | Scratch organization: trials T1–T6 | Organization name, a test account | Founding maintainer |
| D | Organization, App, transfer, re-apply and verify | C | Founding maintainer |
| E | Approval ruleset and `CODEOWNERS`, or the fallback check (US8) | D, and a release so `main` has `CODEOWNERS` | Pull request, then founding maintainer |
| F | Second maintainer on GitHub (US1) | E | Founding maintainer |
| G | Data controller's decision, then Cloudflare member, email changes (US2, US4, US6) | Legal answers | Founding maintainer as controller |
| H | Merge queue trial and decision (US5) | E | Any maintainer proposes, founding maintainer applies |

Stage 2 is not a phase: the founding maintainer decides when, and [the contract](contracts/approval-ruleset.md#moving-to-stage-2) lists the steps.

## Project Structure

### Documentation (this feature)

```text
specs/028-multiple-maintainers/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── approval-ruleset.md
│   ├── workflows.md
│   ├── alerts-and-contact.md
│   └── onboarding-order.md
└── tasks.md             # from /speckit-tasks
```

### Source Code (repository root)

```text
.github/
├── CODEOWNERS                  # new: the founding maintainer, for stage 1
├── repository-settings.md      # who may apply; merge settings; App; alerts
├── rulesets/
│   ├── approval.json           # new: approval, with its exemption
│   ├── develop.json            # merge only
│   ├── main.json               # unchanged until the queue decision
│   └── README.md
└── workflows/
    ├── ci.yml                  # notify-failure job
    ├── pr-policy.yml           # lints the bare title
    └── release-pr.yml          # lists pull requests; App token
docs/
├── maintainers.md              # new: rights, stages, continuity, checklists, credentials
└── architecture-and-collaboration.md
src/
├── index.ts                    # email handler
├── usage/alerts.ts             # also emails maintainers
└── usage/notify-maintainers.ts # new
test/                           # Vitest, written first
wrangler.jsonc                  # send_email binding, optional secrets
README.md, CLAUDE.md
.specify/memory/constitution.md
specs/002-ci-branch-protection/ # FR-008, FR-009, FR-009b, FR-012, R7
specs/027-sandbox-deployment/   # User Story 7 result
```

**Structure Decision**: Maintainer rules get one new document, `docs/maintainers.md`, that the other docs link to, so
rights and checklists live in one place. Rulesets stay as files with a manual apply, as today.

## Complexity Tracking

No violations.
