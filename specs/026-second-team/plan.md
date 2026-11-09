# Implementation Plan: A Second Team

**Branch**: `spec/second-team-dev-and-languages` (Spec Kit feature dir `specs/026-second-team`) | **Date**: 2026-11-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/026-second-team/spec.md`

## Summary

Run the app for Team Rynkeby Europe beside Team Rynkeby Hamburg from one codebase, sharing
only the Strava app. Each team is a separate Worker deployment (own D1, queue, crons,
secrets, domain), selected by `TEAM_ID`. Everything that differs between teams is team
data: a typed module per team under `src/teams/` plus the team's block in `wrangler.jsonc`.
A small gateway Worker owns what Strava allows only once per app, the webhook subscription
and the OAuth callback domain. It fans events out to every team over HTTPS and bounces
sign-in returns to the team's own domain.

The work ships in four releases (spec, Assumptions › Order), each deployable and checkable
on its own while Hamburg is mid-season:

1. **Languages and phrase rule**: eight more catalogs (da, nb, sv, fi, is, fr, nl, lt), a
   plural-aware message format, a ten-language picker, the common phrases and common badge
   names in all ten languages, and the "own vs common" rule. Hamburg keeps its German
   phrases and badge names; the only visible change is the new languages.
2. **Team data and dev commands**: `src/teams/` with Hamburg's and Europe's data (Europe
   with marked placeholders); settings, rules, art, colours and features move behind it;
   `pnpm dev:<team>` and `pnpm dev` start teams locally. No visible change for Hamburg
   (SC-002).
3. **Gateway**: the `gateway/` Worker, team-side redirect and forward settings, a shared
   local fake Strava, `pnpm dev` mirroring production, and the documented switch of the
   Strava subscription. Hamburg moves behind it.
4. **Second team live**: Europe's resources, deployment matrix, sandbox, art and real
   values; placeholders refused at deploy.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Cloudflare Workers runtime (`nodejs_compat`)

**Primary Dependencies**: Wrangler 4 (dev, deploy, environments); no i18n library
(constitution Language: typed catalogs); Biome; lefthook/commitlint

**Storage**: D1 per team with the existing schema (no migration for this feature, research
R12); a Queue per team plus one for the gateway; static assets per deployment

**Testing**: Vitest in the Workers pool (`@cloudflare/vitest-plugin`, Miniflare) with a
team-parametrised suite; Playwright e2e (Chromium, Firefox, WebKit) against fake mode

**Target Platform**: Cloudflare Workers (Free plan, one account); browsers incl. installed PWA

**Project Type**: Server-rendered web app on Workers, plus a gateway Worker and dev tooling

**Performance Goals**: Webhook ack ≤ 2 s at the gateway (Principle II); page renders cost
no more than today (O(1) catalog lookup, plural rules cached per locale)

**Constraints**: Free plan limits shared by all teams (5 cron triggers per account, 100k
requests/day); Strava's app-wide rate limits and 999-athlete cap; one Strava callback
domain and one webhook subscription; `src/` never imports `dev/`, `album/` or `gateway/`;
Hamburg's figures and texts identical (FR-020)

**Scale/Scope**: 2 teams (data model is a list); ~1,100 catalog keys × 8 new languages;
~40 common phrases in English; ~50 badge names × 10 languages; under 999 riders in total

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle / section | How the design complies | Status |
|---|---|---|
| I. Consent & privacy | No rider data crosses teams; the gateway stores nothing and logs no IDs or codes (FR-008); each team's privacy text names its controller; synthetic fixtures per team (FR-050). Translating consent text isn't a consent revision (research R6). | Pass |
| II. Webhooks ack fast, idempotent | The gateway acks after one `sendBatch` (one message per team) and does nothing else; teams keep idempotent processing and drop unknown riders without Strava calls (FR-010). | Pass |
| III. Strava API rules | One app; app-wide budget from response headers (FR-013); the description block code is untouched; the approval screen stays team-neutral (FR-014). | Pass |
| IV. Simplicity, pure rules | Team data is plain typed modules; rules stay pure functions of stored data and team rules (FR-019); a small plural selector on `Intl.PluralRules` instead of a library (research R3). | Pass |
| Testing | Team-parametrised tests over every registered team (FR-021); gateway tests; e2e smoke per team; no real Strava or Cloudflare from tests. | Pass |
| Language (v2.5.0) | Every locale on every site; team default language; `de` the key source, `en` the reference wording; own content sets may stay single-language (FR-025, FR-052). | Pass |
| Manual steps | Subscription switch, secrets, custom domains, rulesets and environments stay manual steps (quickstart); CI deploys per team. | Pass |

Post-design re-check: still passing. To watch: the gateway holds each team's webhook path
secret, which is Strava-adjacent but not the client secret (FR-008 allows it; research R9).

## Project Structure

### Documentation (this feature)

```text
specs/026-second-team/
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1–R16
├── data-model.md        # Phase 1: team data, phrase sets, gateway config, dev targets
├── quickstart.md        # Phase 1: validation per release + manual steps
├── contracts/
│   ├── team-data.md     # TeamData shape, registry, checks, placeholders
│   ├── locales.md       # catalogs, plural format, resolution, picker
│   ├── phrases.md       # own vs common phrases and badge names
│   ├── gateway.md       # gateway routes, queue messages, team-side settings
│   └── dev-commands.md  # pnpm dev / dev:<team>, ports, state dirs, shared fake
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── teams/                    # NEW (release 1 seam, release 2 full)
│   ├── types.ts              # TeamData type
│   ├── index.ts              # TEAMS registry, teamFor(env); no branching on names
│   ├── hamburg.ts            # founding team data (today's values, moved here)
│   └── europe.ts             # second team data, placeholders marked (FR-053)
├── content/                  # NEW (release 1)
│   ├── phrases/
│   │   ├── hamburg.de.ts     # was src/i18n/messages/quotes.de.ts
│   │   └── common.<locale>.ts  # 10 files, same lists in each (FR-045)
│   └── badge-names/
│       └── hamburg.de.ts     # was src/i18n/messages/badges.de.ts
├── i18n/
│   ├── catalogs.ts           # registry of 10 locales
│   ├── i18n.ts               # + plural selection
│   ├── resolve.ts            # team default + foreign fallback, Norwegian aliases
│   └── messages/<locale>.ts  # + da, nb, sv, fi, is, fr, nl, lt
├── config.ts                 # settings read through team data where moved
├── http/…                    # picker, phrase and badge-name lookups, art via team data
└── rynke/rules.ts            # RULES_HISTORY moves into team data

gateway/                      # NEW (release 3), its own Worker; src/ never imports it
├── wrangler.jsonc
├── index.ts                  # fetch (subscription check, webhook ack, OAuth bounce) + queue
└── teams.ts                  # parses the TEAMS setting

dev/
├── worker.ts                 # team-aware fake mode
├── fake-strava/samples.<team>.ts   # synthetic riders per team (FR-050)
└── fake-strava-worker.ts     # NEW (release 3): one fake Strava for all teams

scripts/
├── dev.mjs                   # NEW: pnpm dev / dev:<team> orchestration
└── team-check.mjs            # NEW: data completeness + placeholder refusal (FR-021, FR-053)

test/
├── teams/                    # NEW: team-parametrised suite
├── gateway/                  # NEW: gateway tests
└── …                         # existing suites, Hamburg by default

e2e/                          # + Europe smoke project on its own port
.github/workflows/ci.yml      # deploy becomes a per-team matrix (+ gateway job)
wrangler.jsonc                # Hamburg top-level, `env.europe` block
```

**Structure Decision**: Keep one Worker codebase in `src/` and select the team at runtime
from `TEAM_ID` through `src/teams/`. The gateway is a separate small Worker in `gateway/`
with its own config, outside `src/` so it never enters a team bundle (like `dev/` and
`album/`). Hamburg stays the top-level Wrangler config (same Worker name, database, queue
and domain, FR-003); Europe is `env.europe`.

## Releases

| Release | Requirements | Visible to Hamburg | Gate before the next |
|---|---|---|---|
| 1 Languages + phrase rule | FR-025–FR-028, FR-045–FR-047, FR-052; US5; part of US4 | Ten languages in the picker | All catalogs complete; Hamburg's German phrases and badge names unchanged in every language |
| 2 Team data + dev commands | FR-004, FR-016–FR-024, FR-038, FR-048–FR-051, FR-053; US3, US4, US8 | Nothing (SC-002) | Synthetic season recalculated identically; team suite green for both teams |
| 3 Gateway | FR-005–FR-011, FR-013, FR-037, FR-049 (gateway part); US1, US2 | Nothing; sign-in passes the gateway | Subscription switched, no lost rides (FR-011) |
| 4 Second team live | FR-001–FR-003, FR-012, FR-014, FR-015, FR-035, FR-036, FR-039–FR-044; US6, US7 | Shared usage figures in the admin view | Europe's real values in, no placeholders |

The content tooling (US6) is needed in release 1 for the English original of the common
phrases. It is a local, manual tool (no tests, per project practice for manual doc
tooling), so it lands first.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| A third Worker (gateway) | Strava allows one webhook subscription and one callback domain per app | One Worker for both teams: rejected by the maintainer (separate deployments and data per team) |
| Team data in two places (`src/teams/<id>.ts` and the team's `wrangler.jsonc` block) | Resources, domain, crons and secrets can only live in Wrangler config; structured data (rules, art, phrases) needs types | All in env vars: rules and art maps don't fit strings and lose type checks. All in TS: Wrangler can't read bindings from it. `team-check.mjs` validates both halves together (research R1). |
