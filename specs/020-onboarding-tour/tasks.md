# Tasks: Onboarding Tour That Explains the Rules

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md),
[contracts/messages.md](contracts/messages.md)

**Status**: T001–T012 done in this branch; `pnpm lint`, `pnpm typecheck`,
`pnpm test` and `pnpm test:e2e` run in CI, since this session couldn't reach
the package registry (`tsc` on `src/` ran locally). T013 is the owner's
walk-through.

**Tests**: REQUIRED (constitution Principle V). Riders are synthetic; nothing
contacts Strava.

## Phase 1: Tests first

- [x] T001 `test/integration/tour.test.ts`: the rider tour's ten steps, each
  pointing at its nav item or its element (`data-target`, the page has the
  `id`), with "Weiter" to the next step's address (FR-001–FR-004).
- [x] T002 Same file: old links and a step of another page show the page's
  first step (FR-004, edge cases).
- [x] T003 Same file: the Termine step for riders who aren't organisers; the
  rider tour without it for organisers, count and links included (US2, 019
  T040).
- [x] T004 Same file: the hints name the rule values of `CURRENT_RULES`
  (FR-008).
- [x] T005 Same file: the example rider on the Du and Fahrten steps instead of
  the rider's own Rynke and rides, with the note, the gauge ids and the short
  ride's `id`, without Strava links; the rider's own data without `?tour`
  (FR-005, US3).
- [x] T006 Same file: the example writes nothing (activities, results, balance,
  seen Rynke) and shows no celebration; no example outside its steps (FR-007).

## Phase 2: Implementation

- [x] T007 `src/http/tour.ts`: `target`, `example`, `riderOnly` on steps;
  `tourSteps`; `stepHref(tour, viewer, index)` with `&step=` and the fragment;
  `tourHint` reads the step; `TourHint.section` null for element steps,
  `TourHint.example`; rule parameters for every hint (R1, R2, R6).
- [x] T008 `src/http/tour-example.ts`: `exampleRiderView` (R3, R4).
- [x] T009 `src/http/shell.ts`: the hint before the section,
  `ShellViewer.example`; `src/http/sections/settings.ts`: `stepHref` with the
  viewer.
- [x] T010 `src/http/sections/overview.ts`, `rides.ts`,
  `src/http/rider-sections.ts`: the example read, the note, no seen/celebration,
  gauge ids, example ride cards (R5).
- [x] T011 `src/http/style.ts`: the targets' outline and scroll margin;
  `src/i18n/messages/de.ts`, `en.ts`: the new texts (R6).

## Phase 3: End to end

- [x] T012 `e2e/smoke.e2e.ts`: "Vera Virtual" walks the ten steps, each element
  in view and highlighted, the example only on Du and Fahrten, her own rides
  again after the tour.
- [ ] T013 Owner's walk-through on a phone in `pnpm dev`: wording, the
  highlight, and whether the card covers its element.
- [x] T014 `test/integration/me-rynke.test.ts`, `tour.test.ts`: a counting ride
  with 0 Training Rynke shows "zählt" without the coin, its own and the
  example's (FR-011).
- [x] T015 `src/http/rider-sections.ts`, `src/i18n/messages/de.ts`, `en.ts`:
  `rynke.ride.countsWithoutRynke` for such a ride (FR-011).
