# Implementation Plan: Team Europe's Own Rules

**Branch**: `039-europe-rules` | **Date**: 2026-11-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/039-europe-rules/spec.md`

## Summary

Team Europe gets its Strava club (2292744), a 25 km minimum ride length, and no Team Rynke and no
events at all, while Hamburg stays byte-identical. Every difference is data:

- **Minimum**: an optional rule value `minRideKm`, absent from Hamburg's rule objects, so Hamburg's
  rule version (3) and fingerprint don't move and nobody is re-evaluated (research R1). A short ride
  gets the new reason `too_short`, shown with its figures in ten languages (R5).
- **No Team Rynke**: `teamThreshold: null` in Europe's rules; qualification then rests on Training
  Rynke and the virtual share (R2). **No events**: `eventKinds: []` (R3). `team-check` keeps the two
  together.
- **Europe's rule history** continues with its own version 4 after the three it shared with Hamburg
  (R4).
- **Pages** read two predicates, `hasTeamRynke(team)` and `hasEvents(team)`, through the optional
  parts the view models already have; the router and `teamEventChange` refuse what isn't offered
  (R6). Mixed sentences get `.noEvents` variants (R7). Consent versions stay as they are (R8).
- **Badges**: event-only categories are flagged and left out of Europe's lists; the catalog
  version stays 9 (R9).
- **Outside virtual rides** (added later): the virtual share becomes a whole number of Training
  Rynke, `minOutsideTraining`: Hamburg 167 (same results, version stays 3), Europe 84; 0 drops the
  requirement everywhere (R15).
- **Hamburg safety**: snapshots of every touched Hamburg page are committed **before** the change and
  must stay byte-identical (R11).

## Technical Context

**Language/Version**: TypeScript on Cloudflare Workers; Node `.mjs` for `team-check`; Markdown +
pandoc for the handout

**Primary Dependencies**: none new

**Storage**: D1, unchanged: no migration (reasons are stored as a list without a constraint)

**Testing**: Vitest in the Workers runtime, `app` project (Hamburg) and `team:<id>` projects;
Playwright `europe-smoke`

**Target Platform**: Hamburg's and Europe's Workers, both sandboxes, fake mode

**Project Type**: server-rendered web app

**Performance Goals**: none; one comparison per ride and two predicates per page

**Constraints**: no Hamburg side effect (FR-001–FR-004): no rule or badge catalog version change, no
existing test edited, Hamburg pages byte-identical; no branch on the team in code (026)

**Scale/Scope**: about 30 source files, 10 catalogs × ~15 keys, Europe's samples and handout, 2
Wrangler blocks

## Constitution Check

| Principle | Check | Result |
|---|---|---|
| I. Privacy and consent | Nothing new read or shown; Europe shows less. Consent versions unchanged: no Europe rider has accepted any text, and dropping a use is at most a minor revision (R8). Europe's consent and privacy texts drop events (FR-013) | Pass |
| II. Strava API | No new request. Hamburg's connect may read one more clubs page for a rider with over 200 clubs (R10) | Pass |
| III. Rider-authored content | Nothing written to Strava; corrections untouched | Pass |
| IV. Serverless, minimal deps, pure rules | `too_short` and `teamThreshold: null` are pure rule values; results recompute from stored data; no dependency | Pass |
| V. Test-first | Hamburg snapshots pinned first (R11); each rule, reason, guard and surface red first; Hamburg tests unchanged | Pass |
| Language | Every new text in ten catalogs, German key source, English reference; Europe's wording fresh, not translated from Hamburg's (R7) | Pass |
| Team data (026) | Differences only in `src/teams/<id>.ts` and Wrangler blocks; predicates, never `team.id` | Pass |

Re-checked after Phase 1 design: still passes; nothing to justify.

## Project Structure

### Documentation (this feature)

```text
specs/039-europe-rules/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── team-data.md          # amends 026: minRideKm, teamThreshold null, invariant, clubs
│   ├── ride-evaluation.md    # amends 003: too_short
│   ├── team-surfaces.md      # what a team without Team Rynke and events shows
│   └── messages.md           # new keys and .noEvents variants
└── tasks.md                  # /speckit-tasks
```

### Source Code (repository root)

```text
src/rynke/rules.ts              # minRideKm?, teamThreshold: number | null, assertValidRules
src/rynke/rides.ts              # too_short in REASON_CODES and reasonsFor
src/rynke/tally.ts              # teamMissing 0 without a threshold
src/rynke/apply.ts              # teamEventChange refuses kinds outside eventKinds; corrections
src/teams/types.ts              # CoinArt.back comment: art only
src/teams/index.ts              # hasTeamRynke, hasEvents
src/teams/hamburg.ts            # otherClubIds: [2292744] (rules untouched)
src/teams/europe.ts             # EUROPE_RULES_V4, history, eventKinds: [], placeholders
src/badges/catalog.ts           # events?: true on five categories; badgesFor(team)
src/badges/hints.ts, view.ts    # list through badgesFor
src/work/team-badge-news.ts     # likewise
src/http/router.ts              # 404 for event routes, /organiser → /organiser/riders
src/http/shell.ts               # hiddenSections(env, team); tourSwitches teamRynke, events
src/http/tour.ts                # TourSwitches + only: on the Team Rynke and event steps
src/http/tour-example.ts        # example without Team Rynke and events
src/http/rider-view.ts          # too_short line; Summary.team / Gauges.team nullable
src/http/rider-sections.ts      # too_short text; rules line; events part optional
src/http/progress-view.ts, progress-section.ts   # team series and column optional
src/http/sections/overview.ts   # hero without Team figure
src/http/sections/team.ts       # Team view only with Team Rynke
src/http/sections/badges.ts     # badgesFor
src/http/organiser/access.ts    # no Riders · Events switch
src/http/organiser/overview.ts  # Team column, pace, breakdown optional
src/http/organiser/corrections.ts   # Training field only; refuse a Team amount
src/http/landing.ts, consent-form.ts, privacy.ts   # eventsText variants
src/i18n/                       # eventsText helper; 10 catalogs: new keys and variants
album/load.ts, album/render.ts  # no Team Rynke, events or event-only badges

dev/fake-strava/api.ts          # otherClubMember lists the other team's club
dev/fake-strava/samples.ts      # SampleRider.otherClubMember
dev/fake-strava/samples.europe.ts   # no events; short-ride and both-clubs riders

scripts/team-check.mjs          # invariant; other teams' clubs
wrangler.jsonc                  # europe + sandbox-europe STRAVA_CLUB_ID 2292744
docs/teams/europe/rynke-points.md, public/teams/europe/rynke-points.pdf   # 25 km, no Team Rynke

test/teams/pages-snapshot.test.ts   # NEW, first commit: Hamburg pages pinned before the change
test/teams/no-events.test.ts        # NEW: Europe pages free of Team Rynke and events
test/teams/rules.test.ts            # + minimum and Team Rynke side by side, Europe V4 fingerprint
test/teams/completeness.test.ts     # + invariant (new cases only)
test/unit/rules-min-ride.test.ts    # NEW: minRideKm and teamThreshold null validation, tally
test/unit/fixable-reasons.test.ts   # too_short sorted as not fixable (new code only)
test/unit/team-check-*.test.ts      # invariant and clubs rules
e2e/europe-smoke.e2e.ts             # + no Events entry, no Team gauge, short ride reason
```

**Structure Decision**: Rules logic stays in `src/rynke/`, team facts in `src/teams/`, page
decisions in the view models that already hold optional parts. The two predicates live next to
`TEAMS` so every caller asks the same way.

## Delivery

1. **Pin Hamburg** (first commit, on today's code): `pages-snapshot.test.ts` with its snapshot.
2. **Club** (US2): Wrangler blocks, placeholders, Hamburg's `otherClubIds`, `team-check` club rule,
   fake `otherClubMember`.
3. **Minimum** (US3): `minRideKm`, `too_short`, rider page line, rules line, Europe V4 with the
   minimum, Europe samples, handout.
4. **No Team Rynke, no events** (US4): `teamThreshold: null`, `eventKinds: []`, invariant,
   predicates, guards, view models, tours, texts, album, samples without events.
5. **Badges** (US5): category flag and `badgesFor`.
6. One pull request into `develop`; after the release the user runs **Sandbox reseed** for Europe.

Europe isn't in production, so no step waits for another team; Hamburg's snapshots guard every step.
