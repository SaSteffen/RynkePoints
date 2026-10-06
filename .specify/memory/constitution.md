<!--
Sync Impact Report
- Version change: 1.1.0 → 1.1.1
- Rationale: PATCH — Language section wording. "Default and fallback locale"
  is split into what it means: German is the source catalog and the language
  when the visitor states no preference; which language a visitor who states only
  unsupported languages gets is left to each feature spec.
- Principles modified: none
- Sections added: none
- Sections removed: none
- Templates checked for alignment: .specify/templates/* — unchanged; the plan
  template's "Constitution Check" gate reads this file at runtime.
- Follow-up TODOs: none; specs/001-strava-connect-webhook (FR-029) already
  serves English to browsers naming only unsupported languages.
-->

# RynkePoints Constitution

## Core Principles

### I. Rider Data Privacy and Strava Consent (NON-NEGOTIABLE)

Activity data fetched from Strava is real personal data about real riders (where and
when they ride, how fast, how far), and it is only ours to hold under the riders'
consent and Strava's API Agreement.

- Every capability is opt-in and separately consented: reading activities
  (`activity:read` / `activity:read_all`), editing activity descriptions
  (`activity:write`), and showing a rider's points or stats to other team members.
  Strava's API Agreement only allows displaying a rider's data to *that rider*
  unless they gave explicit consent to share it, so team-visible features (e.g.
  leaderboards) MUST check that consent per rider and hide non-consenting riders.
- Store the minimum needed to compute points and event participation (e.g.
  distance, elevation gain, moving time, start date, sport type, event match). Raw
  GPS streams and polylines MUST NOT be persisted; if a coordinate is needed for
  event matching, derive the match and keep only the result.
- When a rider deauthorizes the app (Strava webhook `athlete` update with
  `authorized: false`) or asks to leave, all their data and tokens MUST be deleted
  promptly — not soft-deleted, not kept "for stats".
- Secrets (Strava client secret, rider access/refresh tokens, encryption keys,
  Cloudflare API tokens) MUST NOT be committed. Rider refresh tokens MUST be
  encrypted at rest in the database. Production secrets live in Cloudflare secrets;
  local ones in the gitignored `.dev.vars`.
- Data is stored in the EU where the platform allows choosing a location.
- Strava data MUST NOT be used for anything beyond the stated purpose of this app
  (no analytics resale, no AI/ML training), and the app MUST follow Strava's brand
  guidelines ("Connect with Strava" button, attribution).

Rationale: This repository is public and the app runs in the cloud, so a privacy
lapse is both more likely and more visible than in a local-only tool. Losing Strava
API access (or riders' trust) ends the project; consent and minimisation are what
keep both.

### II. Good Strava API Citizenship

The app reacts to Strava, it does not poll it.

- New/updated/deleted activities and deauthorizations arrive via Strava's webhook
  subscription. The webhook handler MUST acknowledge within 2 seconds and hand the
  actual work to a queue; it MUST NOT call the Strava API inline.
- Webhook processing MUST be idempotent: Strava may deliver an event more than
  once, and replaying an event MUST NOT double-award points.
- API calls MUST respect Strava's rate limits (read limits are as low as 100
  requests / 15 min and 1,000 / day per app), back off on `429`, and honour the
  `X-RateLimit-*` / `X-ReadRateLimit-*` headers. Backfills of historical activities
  are throttled jobs, never bursts.
- Beyond 10 connected riders the app needs Strava's Developer Program review;
  features MUST NOT assume more athletes than the app's current capacity.

Rationale: Rate limits are per app, not per rider, so one careless loop starves the
whole team. Webhooks plus a queue are also what Strava's review expects to see.

### III. Rider-Authored Content Always Wins

Anything a rider wrote themselves is theirs; the app only adds to it.

- Editing an activity description MUST only touch a clearly delimited Rynke Points
  block that the app owns (insert or replace that block), preserving every other
  character the rider wrote. If the block can't be located unambiguously, skip the
  edit rather than guess.
- Description edits require the rider's `activity:write` consent and MUST be
  switchable off per rider at any time.
- Manual corrections by an organiser (e.g. confirming or rejecting an event match,
  adjusting points) MUST survive re-processing of the same activity; automated
  recomputation never silently overwrites a manual decision.

Rationale: Overwriting a rider's ride report on Strava is the most visible way this
app could annoy people, and it is irreversible from their point of view.

### IV. Serverless, TypeScript, Minimal Dependencies

The app runs on Cloudflare Workers with D1 (SQLite) for storage, Queues for
asynchronous work and cron triggers for scheduled jobs, written in TypeScript.

- Prefer platform APIs (`fetch`, Web Crypto, D1 SQL) over libraries. A new runtime
  dependency (ORM, web framework, Strava SDK, UI framework) requires a stated
  justification in the feature's plan.
- Points rules MUST be pure, deterministic functions of stored activity data and
  configuration, so the full points table can be recomputed from scratch at any
  time.
- Stay within Cloudflare's free tier unless a documented need says otherwise; the
  project is maintained by volunteers without an operations budget.

Rationale: A small volunteer team cannot run servers. Fewer moving parts means
fewer things to patch, and recomputable points mean a rule change is a re-run,
not a data migration.

### V. Test-First Development (Red-Green) (NON-NEGOTIABLE)

New functionality MUST be developed test-first using the red-green cycle:

- Write a failing test that demonstrates the missing behavior (red) before writing
  the implementation.
- Write the minimal code needed to make that test pass (green).
- Refactor only once the test is green, without changing behavior.

Constraints on how this is done:

- Tests run with Vitest inside the Workers runtime (`pnpm test`, via
  `@cloudflare/vitest-pool-workers`), against local D1/Queue bindings — never
  against production resources.
- Strava API calls MUST be mocked in tests; tests MUST NOT contact Strava or use
  real rider data. Fixtures are synthetic records shaped like Strava responses.
- Bug fixes SHOULD start with a failing test that reproduces the bug.

Rationale: Webhook handling, idempotency and description editing (Principles II and
III) fail silently in production and are hard to observe afterwards; tests are the
only safety net a single-maintainer project has.

## Technology Constraints

- Runtime: Cloudflare Workers (TypeScript), configured in `wrangler.jsonc`.
- Storage: Cloudflare D1, schema managed through versioned SQL migrations in
  `migrations/`.
- Async work and scheduling: Cloudflare Queues and cron triggers.
- External API: Strava API v3 (OAuth 2.0, webhook events). Terms checked
  2026-10-06: API Agreement effective 2026-06-01; default limits 200 req/15 min,
  2,000/day overall, 100/15 min and 1,000/day for reads; capacity 1 athlete
  (10 after self-serve upgrade, more only after review).
- Tooling: pnpm, Biome (lint + format), TypeScript `tsc --noEmit`, Vitest,
  lefthook git hooks, Conventional Commits enforced by commitlint.

## Development Workflow

- Features go through Spec Kit (`/speckit-specify` → `/speckit-plan` →
  `/speckit-tasks` → `/speckit-implement`); each plan's Constitution Check gates on
  the principles above.
- `pnpm lint`, `pnpm typecheck` and `pnpm test` MUST pass before a change is
  considered done.
- Deploying (`pnpm deploy`) and changing production secrets, the Strava webhook
  subscription, or D1 production data are manual, deliberate steps — never a side
  effect of another command.

## Language

The riders are a German team, so the app speaks German to them; the code is public
and maintained in English.

- All user-facing text MUST be in German by default: web pages, consent and OAuth
  landing screens, error and status messages shown to riders, the Rynke Points block
  written into Strava activity descriptions, notifications, and the privacy notice.
- User-facing text MUST NOT be hard-coded in templates or logic; it MUST come from
  translation strings keyed by message ID. German (`de`) is the source catalog that
  every other locale MUST match, and the language used when the visitor states no
  language preference; the language for visitors who state only unsupported
  languages is set per feature spec. Adding another locale MUST only require adding
  its translation strings, not changing code. Per Principle IV, plain typed message
  catalogs are preferred over an i18n library unless a plan justifies one.
- Everything else MUST be in English: code, identifiers, comments, log messages,
  database schema, API/JSON field names, test names, commit messages, and project
  documentation (README, specs, plans, tasks, this constitution).
- Strava brand assets ("Connect with Strava" button, "Powered by Strava"
  attribution) are used as Strava provides them, in the German variant where one
  exists.
- Tests that assert on user-facing output assert the German text.

Rationale: Riders should not need English to understand what they consent to or
what the app wrote on their activities, and translation strings keep the door open
for other languages without a rewrite; contributors and reviewers of a public repo
should not need German to read the code.

## Governance

This constitution supersedes ad hoc practice for this project. Amendments are made by
editing this file directly (or via `/speckit-constitution`) and MUST update the
version and Last Amended date per the versioning policy below. Changes that touch
data storage, Strava scopes, or anything visible to other riders MUST be
self-reviewed against Principle I before being deployed.

Versioning policy: MAJOR.MINOR.PATCH — MAJOR for removing or redefining a principle,
MINOR for adding a principle or materially expanding guidance, PATCH for wording or
clarification fixes that don't change meaning.

**Version**: 1.1.1 | **Ratified**: 2026-10-06 | **Last Amended**: 2026-10-06
