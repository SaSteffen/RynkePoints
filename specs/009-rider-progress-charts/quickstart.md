# Quickstart: Rider Progress Charts

How to check the feature. Details are in [data-model.md](data-model.md) and the
[contracts](contracts/).

## Prerequisites

```bash
pnpm install
pnpm exec playwright install chromium firefox webkit   # once, for the e2e tests
```

## 1. Automated checks (test-first, Principle V)

```bash
pnpm test -- curve progress-view progress-section overview-progress weeks
pnpm test:e2e -- progress
pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e
```

| Requirement | Where it is tested |
|---|---|
| FR-010, FR-011, FR-013, SC-002 (curve, last point = balance) | `test/unit/curve.test.ts` |
| FR-012, FR-051 (weekly totals = the Team section's line) | `test/unit/curve.test.ts`, with the reference riders |
| FR-014, FR-020, FR-024, FR-037, FR-038 | `test/unit/progress-view.test.ts` |
| FR-005, FR-007, FR-030, FR-050, FR-060, SC-004 | `test/unit/progress-section.test.ts` |
| FR-001–FR-003, FR-016, FR-040–FR-043, SC-006, SC-007, SC-009 | `test/integration/overview-progress.test.ts` |
| Vendor scripts only on the Overview, in order before `app.js` | `test/unit/html.test.ts`, `test/integration/overview-progress.test.ts` |
| Vendored files equal the pinned packages | `pnpm vendor --check` (part of `pnpm lint`) |
| FR-021–FR-025, FR-053, FR-070–FR-072, SC-008 | `e2e/progress.e2e.ts` (Chromium, Firefox, WebKit) |

The expected figures for the example rider are in the spec (US1 scenarios 1–5, US2
scenario 1).

## 2. Local walk-through (fake mode)

```bash
pnpm dev     # http://localhost:8789, fake Strava with synthetic sample riders
```

1. Sign in as a sample rider and open **Du**. Below the breakdown, the section
   shows the Training and Team charts with their threshold lines and the weekly
   table.
2. Tap **Letzte 4 Wochen**. Both charts show the last 28 days, and the page does
   not reload.
3. Drag across a chart with the mouse: both zoom to the stretch. Shift-drag moves
   it. Then use **Früher**, **Später** and **Ganze Saison zeigen**.
4. Click a chart, then use ←/→, + and −, and the wheel. The readout follows. The
   wheel scrolls the page until the chart has focus.
5. In the browser's device mode, drag sideways on a chart to move the period; a
   vertical swipe scrolls the page. (Device mode can't pinch with a mouse; the
   e2e tests cover pinch with synthetic touch pointers.)
6. Switch to dark mode in Settings and come back: the lines stay readable.
7. Start the tour and look at its Du step: the section shows the
   example rider.

Checks on real devices (pinch on a phone, a screen reader) are done on the live
site after release.
