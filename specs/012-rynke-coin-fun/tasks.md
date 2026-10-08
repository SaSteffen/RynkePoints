---
description: "Task list for the Rynke coin look and fun graphics"
---

# Tasks: Rynke Coin Look and Fun Graphics

**Input**: Design documents from `/specs/012-rynke-coin-fun/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md),
[data-model.md](data-model.md), [quickstart.md](quickstart.md)

**Tests**: REQUIRED (constitution Principle V): write each test first and see it
fail. Device checks happen on the live site after release, so they have no tasks
here ([quickstart.md](quickstart.md) §3).

## Phase 1: Foundational

- [X] T001 Tests first: `test/unit/design-tokens.test.ts` and
  `test/unit/manifest.test.ts` get the Team Rynkeby values.
  Then update `src/http/style.ts`, `src/http/html.ts`, `public/app.js`,
  `public/manifest.webmanifest` and
  `specs/011-mobile-app-shell/contracts/design-tokens.md`.
- [X] T002 New `src/http/coin.ts`: the sprite, `coin()` and `miniCoin()`. The
  layout includes the sprite once and the wordmark carries the coin
  (`test/integration/sections.test.ts`).
- [X] T003 Tests first: `test/unit/catalogs.test.ts` and `test/unit/i18n.test.ts`
  expect the new keys. Add them to `src/i18n/messages/{de,en}.ts`, with emoji in
  the existing copy.

## Phase 2: User Story 1 - Rynke shown as coins (P1)

- [X] T004 [US1] Tests first: `test/integration/overview.test.ts` and
  `test/unit/rider-sections.test.ts` cover the hero, the gauge coin rows and the
  chip coins.
- [X] T005 [US1] Coin hero in `src/http/sections/overview.ts`. Gauge coin rows
  and chip coins in `src/http/rider-sections.ts`. The coin becomes the Overview
  icon in `src/http/icons.ts` and `src/http/shell.ts`.

## Phase 3: User Story 2 - A moment of joy for new Rynke (P2)

- [X] T006 [US2] Tests first: new `test/integration/celebrate.test.ts`. Also
  add `rynke_seen` to `test/integration/db.test.ts`,
  `test/integration/schema-minimisation.test.ts` and `test/support/ctx.ts`, and
  switch `test/integration/me-rynke.test.ts` to `readOnlyCounts`.
- [X] T007 [US2] Add `migrations/0010_rynke_seen.sql` and
  `src/db/rynke-seen.ts`.
- [X] T008 [US2] Add `renderCelebration` in `src/http/sections/overview.ts`, and
  write the totals only on `GET` and only when they changed. Add `.celebrate`
  and `coin-drop` with the reduced-motion override in `src/http/style.ts`.

## Phase 4: User Story 3 - Coin graphics in empty and waiting places (P3)

- [X] T009 [US3] Tests first: `test/integration/landing.test.ts`,
  `test/integration/team.test.ts` and `test/unit/rider-sections.test.ts` cover
  the empty list, counting rides and the qualified verdict.
- [X] T010 [US3] Landing hero in `src/http/landing.ts`. Team coin in
  `src/http/sections/team.ts`. Rides list and verdict coins in
  `src/http/rider-sections.ts`.

## Phase 5: Polish

- [X] T011 `pnpm lint`, `pnpm typecheck` and `pnpm test` pass. Check the pages
  with `pnpm dev` in light and dark mode.
