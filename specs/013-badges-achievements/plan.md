# Implementation Plan: Badges and Achievements

**Branch**: `013-badges-achievements` | **Date**: 2026-10-11, parts C and D 2026-10-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/013-badges-achievements/spec.md`

The plan has four parts, planned and built one after the other at the project
owner's request:

- **Part A, art pipeline** (built, tasks T001 to T023): the badge frames, the
  Gemini prompts, generating and tracing the pictures, and the finished badge
  files (FR-040, FR-040a, FR-040b).
- **Part B, the app**: runs, evaluating and storing badges, team badges, the
  Abzeichen section on the rider page, reveals and notifications (FR-001 to
  FR-032, FR-041, FR-042). Part B uses part A's files and nothing else from it.
- **Part C, more categories** (added 2026-10-12): ride length, virtual rides,
  swims and the four winter months (FR-004a, FR-010, FR-022 to FR-025), with
  their art scenes (already in `art/badges/badges.json`). It extends part B's
  code; no new mechanism.
- **Part D, surprise badges** (added 2026-10-12): the "Überraschungen"
  category of six single badges with secret rules (FR-015 to FR-015c); art
  scenes already in `art/badges/badges.json`.

## Summary

**Part A.** A badge is a frame drawn exactly in code (an edge of sunflower
petals, a ring with three stars, a round cream window; the ring black for
personal badges and light blue for team badges) with a picture in its window,
and optionally the milestone ribbon. The design comes from the hand-made
reference images in `art/badges/reference/`. The pictures are generated with
Gemini in the browser, one fresh chat per badge, from a shared prompt, a
per-badge scene and that reference image (`pnpm badge-art`), then traced into
flat SVG and composed with the frame into self-contained SVGs in
`public/badges/` (`pnpm badge-build`). Until a badge has a picture, the app shows
the frame with the coin's Rynke (FR-040a). A generated module lists which badges
have a picture.

**Part B.** Outdoor runs are stored in a table of their own and never reach the
Rynke evaluation. A badge catalog in code holds the spec's ladders. Personal
badges are a pure function of what a rider has stored (counting rides, runs,
team-event attendance, corrections, the Training Rynke over the season) and are
evaluated in the same batch as the Rynke (feature 003's `applyAndEvaluate`), so
they are stored, diffed and notified like a Rynke rise. Team badges are worked
out per request from SQL sums over the listed riders, like the Team page, so
they follow every consent, departure and correction without a stored copy. The
Overview gets the Abzeichen section of the drafts, server-rendered: newest badge
per category as cards with the milestone ribbon, a collapsible gallery, bars for
categories without a badge, and the large view as a native popover. New badges
are revealed once per rider and named in the existing notification.

**Part C.** Ride length, virtual rides and the winter months come from the
counting rides the evaluation already hands to the badges, each now carrying
003's virtual flag; winter months count distinct local dates of non-virtual
counting rides. Swims follow runs exactly: a `swims` table, `toSwimRecord`,
intake through the same webhook and list-page paths, never seen by Rynke code
or team sums. Raising the activity figures version re-reads every rider once
for their swims; raising the catalog version re-evaluates everyone once,
silently. The view learns today's date only to drop the bar of a winter month
that is over. The 32 new pictures come from the art pipeline unchanged; until
then the placeholder shows.

**Part D.** "Überraschungen" is one more personal category whose six badges
have rules instead of a ladder, worked out in the same pure evaluation from
each activity's local date and start time; the rest day is proven by the next
activity, so no clock is needed. The page shows "?" for the category and
nothing of an unearned surprise badge; an earned one gets its ribbon text and
why-text. No migration; the catalog version re-evaluates everyone once,
silently.

## Technical Context

**Language/Version**: TypeScript on Cloudflare Workers (app); JavaScript (Node
22, ES modules) for the scripts in `scripts/` (part A).

**Primary Dependencies**: Part A: Playwright (`@playwright/test`, already a dev
dependency) driving the maintainer's Chrome; ImageMagick and potrace as external
tools. Part B: none new; D1, Queues and the existing typed i18n catalogs; the
browser's Popover API and `<details>` for the section's interactions.

**Storage**: Part A: files in the repo (`art/badges/`, `public/badges/`,
`src/badges/pictures.ts`). Part B: D1 migration `0013_badges.sql`: `runs`,
`rider_badges`, `badge_reveals`, `badge_rises` and `riders.badges_version`, all
cascading from `riders` (Principle I). Part C: `0015_swims.sql` adds `swims`,
the same shape as `runs`.

**Testing**: Vitest in the Workers runtime against local D1/Queue bindings:
unit tests for the catalog, the pure badge evaluation, team sums and the view
model; integration tests for intake, evaluation batches, the Overview section,
reveals and the notification text. Playwright e2e smoke for the section on the
fake Strava (`pnpm test:e2e`). Part A's Gemini automation and tracer are checked
by the quickstart (Complexity Tracking).

**Target Platform**: the existing Worker and PWA; mobile first at 360 px,
desktop up to the app's max width.

**Project Type**: web service with server-rendered pages (existing app).

**Performance Goals**: an evaluation batch stays one read batch and one write
batch per rider (no extra round trip); the Overview adds one read batch for team
sums; badge images load lazily, only for earned badges.

**Constraints**: no new Strava request kind, scope or burst (Principle II); runs
minimised to what badges need (Principle I); team sums only over listed riders
and never per rider (FR-032, FR-021); badge names German only (FR-041); the
surprise holds in the HTML (SC-003).

**Scale/Scope**: about 40 riders; 21 categories, 101 badges (part C: 8
categories, 32 badges); a rider has at most 72 personal badges in 15 categories
and sees up to 34 team badges.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|-----------|-------|--------|
| I. Privacy and consent | Part A: Gemini gets only the prompt and the reference art, no rider data. Part B: runs keep only start date, local date, distance, private flag and refresh time (research R11); manual and indoor runs aren't stored at all. A rider's runs are shown only to that rider; others see runs only inside the team sum "Running together", like ride kilometres and elevation, by the project owner's decision (spec Clarifications, FR-023): data the app already receives, shown only as sums with no per-rider figures, so the consent text names it but no new consent version (constitution v2.1.0 "growth", as features 008 and 010 before). Team sums use only 014's listed riders. Everything cascades from `riders`, so leaving deletes runs, badges, reveals and rises. | Pass |
| II. Strava citizenship | No new request kind: runs come with the list pages and activity events the app already fetches (a run's webhook already fetched the activity and then dropped it). Existing riders' runs come from the existing throttled one-time re-read, triggered by raising `ACTIVITY_FIGURES_VERSION` (research R12). Badge processing happens in the queue, idempotently: the same data gives the same badges and writes nothing the second time. | Pass |
| III. Rider-authored content | Nothing written to Strava; runs get no Rynke block. | Pass |
| IV. Serverless, minimal deps | No new dependency; D1 tables via a forward-only migration that adds only; pure functions for personal and team badges; Popover API and `<details>` instead of a UI library. | Pass |
| V. Test-first | Every part B task starts with a failing test; part A's pure modules too. Part A's Gemini automation and tracer are the one exception (Complexity Tracking). | Pass with a justified exception |
| Part C | Swims keep the same minimal fields as runs, only non-manual `Swim` activities, shown to no one else and in no team sum; the consent text names them without a new version, the same decision as runs (FR-023, research R30). Re-read and re-evaluation reuse the existing throttled cron mechanisms (R27); no new request kind. New ride categories read the counting rides already evaluated (R23). Test-first for every task. | Pass |
| Language | Rider-facing text from the catalogs in every language, except badge names, which are German only and live beside the catalogs like 016's quotes (FR-041, research R20). Code, tests and docs in English. | Pass |

Post-design re-check (after Phase 1, parts B and C): unchanged. The migration only adds tables
and a column; the previous version never reads them. Team badges are not stored,
so a consent change or a departure needs no extra job.

## Project Structure

### Documentation (this feature)

```text
specs/013-badges-achievements/
├── plan.md              # This file (parts A and B)
├── research.md          # A: R1–R9; B: R10–R22; C: R23–R31; D: R32–R37
├── data-model.md        # A: art entities; B: D1 tables, catalog, evaluation; C: swims, catalog v2
├── quickstart.md        # A: art pipeline; B: the app; C: §10–§13
├── contracts/
│   ├── badge-assets.md  # A: files, SVG format, commands, picture list
│   ├── abzeichen-section.md  # B: the section's markup and behaviour
│   └── badge-messages.md     # B: catalog keys, German names, notification text
├── drafts/              # Mobile and desktop drafts of the section
└── tasks.md             # Part A (T001–T023), B (T024–T073), C (T074–T099), D (T100–)
```

### Source Code (repository root)

```text
# Part A (built)
art/badges/                    # badges.json, prompt.txt, reference/, originals/
scripts/badge-{art,build,frame,prompts}.mjs, scripts/trace.mjs
public/badges/                 # <id>.svg, <id>-ribbon.svg, placeholders
src/badges/pictures.ts         # generated: badges with a picture

# Part B
migrations/0013_badges.sql     # runs, rider_badges, badge_reveals, badge_rises, riders.badges_version
src/strava/activity.ts         # + RunRecord, toRunRecord (outdoor, not manual)
src/db/runs.ts                 # run statements
src/db/badges.ts               # rider_badges, badge_reveals, badge_rises statements
src/badges/catalog.ts          # categories, ladders, groups, units, BADGE_CATALOG_VERSION
src/badges/evaluate.ts         # pure: personal badges and progress from a rider's state
src/badges/team.ts             # pure: team badges and progress from team sums
src/badges/view.ts             # pure: cards, gallery, not-yet bars, reveal list
src/badges/ribbon.ts           # the ribbon box (same as scripts/badge-frame.mjs RIBBON)
src/rynke/apply.ts             # + runs in changes and reads, badge diff, badge rise
src/db/team.ts                 # + daily team sums read for team badges
src/work/activity-event.ts     # runs upserted/removed; notify on new badges too
src/work/activity-page.ts      # runs from list pages
src/work/scheduled.ts          # re-evaluate riders on an older badges_version, silently
src/http/sections/badges.ts    # the Abzeichen section
src/http/sections/overview.ts  # + the section, reveals written on GET
src/http/pwa.ts                # notification text names a new badge
src/http/style.ts              # section styles (cards, gallery, bars, ribbon text, popover)
public/app.js                  # hover opens the popover for mouse pointers
src/i18n/messages/{de,en}.ts   # section text, categories, units, consent wording
src/i18n/messages/badges.de.ts # German-only badge names
dev/fake-strava/samples.ts     # sample runs, attendances and riders with badges

test/unit/        badge-catalog, badge-evaluate, badge-team, badge-view, run-record
test/integration/ runs-intake, badges-apply, badges-section, badge-reveals,
                  badge-notification, badges-scheduled, badge-art-consistency
e2e/smoke.e2e.ts  # + the Abzeichen section on the fake Strava

# Part C
migrations/0015_swims.sql      # swims, as runs
src/strava/activity.ts         # + SwimRecord, toSwimRecord; ACTIVITY_FIGURES_VERSION 5
src/db/swims.ts                # swim statements, as src/db/runs.ts
src/badges/catalog.ts          # + 8 categories, unit "days", winter months, version 2
src/badges/evaluate.ts         # + ride length, virtual, swims, winter series
src/badges/view.ts             # + today: no bar once a winter month is over; decimals
src/rynke/apply.ts             # + swims in changes, reads and deletes; CountingRide.virtual
src/db/badges.ts               # + figures for the new categories (readRiderBadges)
src/work/activity-{event,page}.ts  # swims through the same intake as runs
src/http/sections/badges.ts    # passes today; days unit; one-decimal categories
src/i18n/messages/{de,en}.ts   # categories, sentences, days unit, consent names swims
src/i18n/messages/badges.de.ts # + 32 German names
dev/fake-strava/samples.ts     # long, virtual, winter rides; swims

test/unit/        badge-catalog, badge-evaluate, badge-view, badge-names, activity
test/integration/ swims-intake, badges-apply, badges-section, schema-minimisation, db
```

**Structure Decision**: Badge logic gets its own folder `src/badges/`, pure and
next to `src/rynke/` whose results it reads; storage follows the `src/db/`
pattern; the section follows `src/http/sections/`. Personal badges ride along
the existing evaluation batch instead of a second pipeline, so the rules for
idempotency, deletion and notification already hold. Part A stays in `scripts/`
and `art/`; the app reads only `public/badges/` and `src/badges/pictures.ts`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Part A: Gemini automation and tracer not covered by CI tests (Principle V) | They need a signed-in browser on a live third-party site and external binaries (ImageMagick, potrace) | Mocking Gemini's page would test our mock, not Gemini, and break silently when Google changes the page; the quickstart's manual run is the real check. The pure parts they call are tested. |
