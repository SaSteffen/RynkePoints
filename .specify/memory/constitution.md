<!--
Sync Impact Report
- Version change: 2.6.0 → 2.7.0
- Rationale: MINOR — Principle II gains its one exception to "does not poll":
  the ride edit re-check (feature 036). Strava reports an activity update only
  for a new title, type or privacy, so a crop or any other edit of distance or
  times never reaches the app, and a ride the rider fixed stayed "doesn't
  count" (issue #274). The re-check is bounded: one list request per rider per
  check, at most 10% of the daily read limit for all teams together in normal
  operation, at most one request per rider per day beyond that, and none while
  the budget is short.
- Principles modified: II. Good Strava API Citizenship
- Sections added: none
- Sections removed: none
- Templates checked for alignment: .specify/templates/* — unchanged.
- Follow-up TODOs: none.

Previous: 2.5.0 → 2.6.0
- Rationale: MINOR — the Language section's team content rule matches what was
  decided and built: the common phrases, badge names and badge hints that every
  team without its own set gets are English only and aren't translated (phrase
  translation shelved 2026-11-09, feature 034 FR-014). Before, content shared by
  all teams had to exist in every shipped locale. Team content lives in
  `src/content/`, as CLAUDE.md already says.
- Principles modified: none (Language section)
- Sections added: none
- Sections removed: none
- Templates checked for alignment: .specify/templates/* — unchanged.
- Follow-up TODOs: none.

Previous: 2.4.0 → 2.5.0
- Rationale: MINOR — the Language section no longer assumes one German team. Each
  team sets its default language in team data (the founding team, Team Rynkeby
  Hamburg, stays German). Every shipped locale is offered on every team's site.
  English is the reference wording where translations differ, since they get no
  native-speaker review. A team's own content sets (phrases, badge names) may stay
  in one language. Strava's brand assets follow the rider's language where Strava
  provides one, else English. Decided with feature 026 (FR-025–FR-028, FR-052).
- Principles modified: none (Language section)
- Sections added: none
- Sections removed: none
- Templates checked for alignment: .specify/templates/* — unchanged.
- Follow-up TODOs: none.

Previous: 2.3.0 → 2.4.0
- Rationale: MINOR — Principle I's re-consent rule splits consent changes into
  major and minor. Only a major change (new Strava scope, new kind of Strava
  request, new data read) asks riders again. Newly showing figures made from data
  already read is a minor revision: named in the consent text and privacy notice,
  accepted by new riders, no new ask for riders who accepted the same major
  version. Decided with feature 032 (ride stats, FR-021).
- Principles modified: I (re-consent rule)
- Sections added: none
- Sections removed: none
- Templates checked for alignment: .specify/templates/* — unchanged.
- Follow-up TODOs: consent versions carry a major and a minor part (feature 004
  FR-013 stores a whole number today); planned with feature 032.

Previous: 2.2.1 → 2.3.0
- Rationale: MINOR — Principle I's deletion rule gains one exception: a rider
  removed by an administrator stays on a block list by Strava athlete ID, and
  nothing else, so they can't connect again. Decided with feature 025 (research
  R9).
- Principles modified: I (one exception to the deletion rule)
- Sections added: none
- Sections removed: none
- Templates checked for alignment: .specify/templates/* — unchanged.
- Follow-up TODOs: the data controller confirms the legal basis of the block
  list before launch (025 spec Assumptions).

Previous: 2.1.0 → 2.2.0
- Rationale: MINOR — Technology Constraints gain a browser rule: the rider-facing
  app requires JavaScript, and features need no no-script fallback. Pages stay
  server-rendered HTML; text alternatives (tables, labels) serve screen readers,
  not riders without scripts. Decided with feature 009 (progress charts).
- Principles modified: none (Principle IV unchanged: a browser library still
  needs a stated justification in the plan)
- Sections added: none (one bullet in Technology Constraints)
- Sections removed: none
- Templates checked for alignment: .specify/templates/* — unchanged.
- Follow-up TODOs: specs that require a no-script fallback drop that
  requirement (009 FR-052; earlier features' specs reviewed separately).

Previous: 2.0.0 → 2.1.0 (MINOR) — Principle I's re-consent rule says what
"grows" means; a field already received and shown only to the rider needs no
new consent version (feature 008, FR-007).

Before: 1.2.1 → 2.0.0 (MAJOR) — Principle I no longer makes every capability
separately opt-in: one required consent at connect (read activities, show name
and points to organisers and the team); private activities and `activity:write`
stay optional.
-->

# RynkePoints Constitution

## Core Principles

### I. Rider Data Privacy and Strava Consent (NON-NEGOTIABLE)

Activity data fetched from Strava is real personal data about real riders (where and
when they ride, how fast, how far), and it is only ours to hold under the riders'
consent and Strava's API Agreement.

- Riders give one explicit consent when they connect, and both parts of it are
  required because the app doesn't work without either: reading their activities
  (`activity:read`) and showing their points to organisers and other team members
  (names only as far as the feature specs allow). Reading private activities
  (`activity:read_all`) and editing activity descriptions (`activity:write`) stay
  optional and MUST NOT affect taking part. A rider who withholds a required part is
  not connected; withdrawing consent means leaving (deletion below). Before sending
  a rider to Strava the app MUST say what it reads, writes and shows, MUST record
  which version of that consent the rider accepted. A **major** change MUST raise the
  major version and ask every rider again: a new Strava scope, a new kind of Strava
  request, or new data read from Strava. Showing figures made from data the app
  already reads to someone other than the rider (other riders, organisers) is a
  **minor** revision (for example 3 → 3.1): the consent text and the privacy notice
  MUST name it before it is shown, new riders accept the revised text, and riders
  who accepted an earlier revision of the same major version keep a current consent
  and are not asked again. Keeping a field the app already receives with every read,
  and showing it only to that rider, needs no new revision; the consent text MUST
  still name it.
- Strava's API Agreement only allows displaying a rider's data to *that rider*
  unless they gave explicit consent to share it, so team-visible features (e.g.
  leaderboards) MUST show only riders with a recorded consent.
- Store the minimum needed to compute points and event participation (e.g.
  distance, elevation gain, moving time, start date, sport type, event match). Raw
  GPS streams and polylines MUST NOT be persisted; if a coordinate is needed for
  event matching, derive the match and keep only the result.
- When a rider deauthorizes the app (Strava webhook `athlete` update with
  `authorized: false`) or asks to leave, all their data and tokens MUST be deleted
  promptly — not soft-deleted, not kept "for stats".
  The one exception: when an administrator removes a rider, the team keeps that rider's
  Strava athlete ID on a block list, and nothing else, so they can't connect again. The
  consent text and privacy notice MUST say so.
- Secrets (Strava client secret, rider access/refresh tokens, encryption keys,
  Cloudflare API tokens) MUST NOT be committed. Rider refresh tokens MUST be
  encrypted at rest in the database. Production secrets live in Cloudflare secrets;
  the CI deploy credential lives in a GitHub environment secret that only `main`
  can unlock; local ones in the gitignored `.dev.vars`.
- Data is stored in the EU where the platform allows choosing a location.
- Strava data MUST NOT be used for anything beyond the stated purpose of this app
  (no analytics resale, no AI/ML training), and the app MUST follow Strava's brand
  guidelines ("Connect with Strava" button, attribution).

Rationale: This repository is public and the app runs in the cloud, so a privacy
lapse is both more likely and more visible than in a local-only tool. Losing Strava
API access (or riders' trust) ends the project; consent and minimisation are what
keep both.

### II. Good Strava API Citizenship

The app reacts to Strava; it polls it only for what Strava doesn't report.

- New/updated/deleted activities and deauthorizations arrive via Strava's webhook
  subscription. The webhook handler MUST acknowledge within 2 seconds and hand the
  actual work to a queue; it MUST NOT call the Strava API inline.
- Webhook processing MUST be idempotent: Strava may deliver an event more than
  once, and replaying an event MUST NOT double-award points.
- API calls MUST respect Strava's rate limits (per app, not per rider; since
  2026-11-04 the read limits are 300 requests / 15 min and 3,000 / day), back off on `429`, and honour the
  `X-RateLimit-*` / `X-ReadRateLimit-*` headers. Backfills of historical activities
  are throttled jobs, never bursts.
- The app MUST NOT poll Strava, with one exception: the ride edit re-check
  (feature 036). Strava sends no event for an edit that changes a ride's distance
  or times, so the app re-reads each connected rider's newest activities on a
  schedule. That check MUST stay bounded: one list request per rider per check,
  no further pages and no single-activity requests; all teams together at most 10%
  of the daily read limit in normal operation, and beyond that at most one request
  per rider per day; never a burst; and no check while the budget is short, so
  that it comes after everything a person waits for, the import and webhook
  events. Any other scheduled read of rider data from Strava needs an amendment.
- The app's athlete capacity is 999 since Strava's Developer Program review
  (2026-11-04); features MUST NOT assume more athletes than that capacity.

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
  `@cloudflare/vitest-plugin`), against local D1/Queue bindings — never
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
  2026-10-06: API Agreement effective 2026-06-01. Developer Program review
  approved 2026-11-04: 600 req/15 min and 6,000/day overall, 300/15 min and
  3,000/day for reads; capacity 999 athletes (before: 200/2,000 overall, 100/1,000
  reads, 10 athletes after the self-serve upgrade).
- Browser: the rider-facing app requires JavaScript. Pages are server-rendered
  HTML for first paint and accessibility, but features MUST NOT be designed,
  built or tested for a browser with scripts turned off. Text alternatives (a
  table next to a chart, labels) are for screen readers, not a no-script
  fallback. Browser libraries follow Principle IV.
- Tooling: pnpm, Biome (lint + format), TypeScript `tsc --noEmit`, Vitest,
  lefthook git hooks, Conventional Commits enforced by commitlint.

## Development Workflow

- Features go through Spec Kit (`/speckit-specify` → `/speckit-plan` →
  `/speckit-tasks` → `/speckit-implement`); each plan's Constitution Check gates on
  the principles above.
- `pnpm lint`, `pnpm typecheck` and `pnpm test` MUST pass before a change is
  considered done.
- Production is deployed only from `main`: merging a pull request into `main` is the
  deliberate act that releases a change, and CI then deploys that commit once its
  required checks passed, applying pending D1 migrations forward-only before the
  code. The maintainer may re-deploy the current `main` on demand; deploying any
  other branch or a local working copy is a break-glass step, not a release path.
- Changing production secrets, creating or deleting production resources, changing
  the Strava webhook subscription, and changing D1 production data other than
  through committed migrations are manual, deliberate steps — never a side effect of
  another command.

## Language

The app speaks each rider's language, and each team's own by default; the code is
public and maintained in English.

- All user-facing text MUST be in the team's default language unless the rider picks
  another: web pages, consent and OAuth landing screens, error and status messages
  shown to riders, the Rynke Points block written into Strava activity descriptions,
  notifications, and the privacy notice. Each team sets its default language in team
  data; the founding team, Team Rynkeby Hamburg, stays German.
- Every shipped locale MUST be offered on every team's site. A team chooses only its
  default, which also applies when a visitor states no shipped language.
- User-facing text MUST NOT be hard-coded in templates or logic; it MUST come from
  translation strings keyed by message ID. German (`de`) is the source catalog whose
  keys every other locale MUST match. English (`en`) is the reference wording:
  translations are made by the maintainers without native-speaker review, and where
  one differs from English, the English text applies and the consent and privacy
  pages say so. Adding another locale MUST only require adding its translation
  strings, not changing code. Per Principle IV, plain typed message catalogs are
  preferred over an i18n library unless a plan justifies one.
- Team content (the motivational phrases, badge names and badge hints, kept in
  `src/content/`) follows the team, not the rider's language, and MAY stay in one
  language whatever language the rider picks. A team with its own set has it in its
  default language; every other team gets the common set, which is in English and
  isn't translated. All other user-facing text MUST exist in every shipped locale.
- Everything else MUST be in English: code, identifiers, comments, log messages,
  database schema, API/JSON field names, test names, commit messages, and project
  documentation (README, specs, plans, tasks, this constitution).
- Strava brand assets ("Connect with Strava" button, "Powered by Strava"
  attribution) are used as Strava provides them, in the rider's language where Strava
  provides one, otherwise in English.
- Tests that assert on user-facing output assert the text of the locale under test,
  German unless they say otherwise.

Rationale: Riders should not need a foreign language to understand what they consent
to or what the app wrote on their activities, and riders of one team come from many
countries; contributors and reviewers of a public repo should not need German to read
the code.

## Governance

This constitution supersedes ad hoc practice for this project. Amendments are made by
editing this file directly (or via `/speckit-constitution`) and MUST update the
version and Last Amended date per the versioning policy below. Changes that touch
data storage, Strava scopes, or anything visible to other riders MUST be
self-reviewed against Principle I before being deployed.

Versioning policy: MAJOR.MINOR.PATCH — MAJOR for removing or redefining a principle,
MINOR for adding a principle or materially expanding guidance, PATCH for wording or
clarification fixes that don't change meaning.

**Version**: 2.7.0 | **Ratified**: 2026-10-06 | **Last Amended**: 2026-11-13
