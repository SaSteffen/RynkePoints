# Implementation Plan: Onboarding Tour That Explains the Rules

**Branch**: `020-onboarding-tour` | **Date**: 2026-10-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/020-onboarding-tour/spec.md`

## Summary

The tour stays server-rendered, one hint card per page in the shell
(`src/http/tour.ts`, issue #90). This feature changes what a step can be and
what the pages show during the tour:

- **Steps per viewer (US2)**: `TOURS` keeps every step; `tourSteps(tour,
  viewer)` drops the Termine step (`riderOnly`) for organisers, the way
  `SECTIONS` drops the Termine tab (019 research R8). The count and every
  "Weiter" link come from that list (R1).
- **Several steps per page (US1)**: the address names the step,
  `?tour=rider&step=N`. When `step` is missing or names another page's step,
  the page's first step shows, so old links keep working (R2).
- **Steps that point at an element (US1)**: a step may name a `target`, an `id`
  on its page (`tour-elevation`, `tour-team`, `tour-outdoor`,
  `tour-short-ride`). Its link ends in `#<target>` so the browser scrolls to it;
  the card carries `data-target` and the stylesheet outlines the element with
  `body:has(.tour[data-target=…]) #…`, no page script (R2).
- **Example rider (US1, US3)**: `shellPage` works out the hint before the
  section and tells the section whether its step shows the example
  (`ShellViewer.example`). Du and Fahrten then read
  `exampleRiderView(window, today)` from `src/http/tour-example.ts` instead of
  D1: six synthetic rides and two team events, evaluated by `evaluateRides`,
  `evaluateAttendance` and `tally` with `CURRENT_RULES` (R3). The pages show a
  note above it, write no "seen Rynke", show no celebration, and the example
  ride cards have no Strava link (R5).
- **Texts (FR-008, FR-009)**: five new step texts and the note, in `de` and
  `en`; every rule value is a parameter filled from `CURRENT_RULES` (R6).
- **Owner's review**: a ride that doesn't count in the example, which the first
  Fahrten step points at (R3); a Team step on the peloton (R7); and an organiser
  tour of seven steps on an example team on Rider and Termine, inert, with the
  real new-event form (US4, R8 – R10).

There is no migration, no new stored data, no Strava request, no new route and
no consent change.

## Technical Context

**Language/Version**: TypeScript (`tsc --noEmit`) on Cloudflare Workers.

**Primary Dependencies**: none new.

**Storage**: D1 unchanged. The example is computed per request and never
written.

**Testing**: Vitest in workerd (`pnpm test`): `test/integration/tour.test.ts`
through `handleFetch`. Playwright (`pnpm test:e2e`): the rider walk-through
with "Vera Virtual", now eleven steps with the example and the highlighted
elements, and "Olga Organiser" through the organiser tour's seven.

**Target Platform**: Cloudflare Workers; phone browsers 320–360 px wide and
desktop.

**Performance Goals**: the example is six rides through the pure evaluation; no
extra D1 read on a tour step, one fewer on Du and Fahrten.

**Constraints**: `src/` never imports `dev/` (feature 006 FR-009), so the
example lives in `src/http/`; rider-facing text only in the catalogs (FR-028).

## Constitution Check

- **I. Privacy and consent**: no new data read, stored or shown to others. The
  example is synthetic and never stored (FR-007); it is shown only to the
  signed-in rider on their own tour.
- **II. Strava API citizenship**: no Strava request; the example links nowhere.
- **III. Rider-authored content**: untouched.
- **IV. Serverless, minimal dependencies**: no dependency; the example reuses
  the pure rules functions, so it follows any rules change by itself.
- **V. Test-first**: the integration tests for steps per viewer, the step
  address, the targets, the rule values and the example (stored nothing, shown
  only on its steps) come first.

No deviations.

## Project Structure

```text
src/http/tour.ts               steps with target/example/riderOnly, tourSteps, step addresses
src/http/tour-example.ts       new: the example rider view and the example team
src/http/tour-targets.ts       new: the elements a step can point at
src/http/sections/team.ts      peloton id
src/http/organiser/overview.ts example team, inert; tiles and pace ids
src/http/organiser/events.ts   readEvents / example, inert lists, target ids
src/http/organiser/requests.ts open requests id, inert
src/http/shell.ts              hint before the section; ShellViewer.example
src/http/sections/overview.ts  example read, no seen/celebration on it
src/http/sections/rides.ts     example read and cards
src/http/sections/settings.ts  stepHref with the viewer
src/http/rider-sections.ts     gauge ids, example note, example ride cards
src/http/style.ts              target outline and scroll margin
src/i18n/messages/{de,en}.ts   new texts
test/integration/tour.test.ts  extended
test/unit/tour-example.test.ts new: the examples on any day
e2e/smoke.e2e.ts               walk-through of the rider and the organiser tour
```
