# Specification Quality Checklist: CI-Gated Pull Requests and Protected Branches

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-10-06
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Clarification resolved on 2026-10-06: squash into `develop`, merge commits for
  `develop` → `main`, hotfixes and back-merges (FR-009b); PR title checked (FR-010).
- FR-009b mixes merge styles per target branch. The platform's per-repository merge
  settings are not per-branch, so the plan has to decide how this is enforced (e.g.
  documented convention plus a check) and say so explicitly.
- The "users" of this feature are the project's contributors, so the spec names the
  project's existing checks (`pnpm lint`, `pnpm typecheck`, `pnpm test`, the
  commit-message hook) and the hosting platform (GitHub) as given context, the same
  way 001 names Strava. Which CI service, workflow layout and protection mechanism
  (branch protection vs. rulesets) are used is left to the plan.
- FR-009a (only `develop` or hotfix branches may target `main`) is not a native
  branch-protection option; the plan has to find a mechanism for it, e.g. a required
  check that fails for other source branches.
- Enabling protection and changing the default branch are manual repository-settings
  steps (Assumptions), so the plan's tasks should end with a checklist the maintainer
  runs, not with commands run on their behalf.
- Amendment 2026-10-06 (deploy on merge to `main`, User Story 5, FR-023–FR-034):
  clarified the same day that deployments apply pending migrations first,
  forward-only, and publish no code if one fails (FR-035, FR-036).
- The constitution's Development Workflow rule and the CLAUDE.md non-negotiable were
  amended (constitution 1.2.0) so that merging into `main` is the sanctioned way to
  deploy; the plan's Constitution Check should cite 1.2.0.
- Which mechanism serialises deployments, scopes the credential to `main` and offers
  the manual re-deploy (e.g. a deployment environment with a branch rule) is left to
  the plan.
- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`
