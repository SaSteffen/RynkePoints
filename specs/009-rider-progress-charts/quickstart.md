# Quickstart: Rider Progress Charts

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## 1. Automated checks

```bash
pnpm install
pnpm lint && pnpm typecheck && pnpm test
```

`pnpm typecheck` also checks `public/progress/` (research R6). All tests use
synthetic riders. None of them reads Strava or writes data during a page view
(constitution I and V; FR-080).

| Test file | Proves |
|---|---|
| `test/unit/rides.test.ts` | `ridingTotals` is what `evaluateRides` sums; the existing cases still pass |
| `test/unit/curve.test.ts` (new) | the example rider, day by day; the elevation step on 20 September; floor of 0; anything dated after the last day placed on it; deadline passed; the last day equals `tally` of all inputs for every reference rider (FR-011, FR-012, SC-002) |
| `test/unit/progress-view.test.ts` (new) | axis with and without a deadline, at least 7 days; last day; offered presets; 4 weeks = 10 Sep–7 Oct; `from`/`to` clamping; weeks Monday–Sunday from the season start, oldest first; `nothingYet`; `state: "none"` for no balance, an unknown version or a mismatch (FR-013–FR-016, FR-020, FR-022, FR-023, FR-037, FR-051) |
| `test/unit/chart.test.ts` (new) | `public/progress/chart.js`: path coordinates; yMax ≥ threshold, not cut off; month/day ticks; zoom, move and reset clamped; nearest day; the keyboard map; tap vs drag vs vertical swipe; the readout of a day; neither browser file makes a request or keeps storage (FR-003, FR-014, FR-022–FR-025, FR-030, FR-053) |
| `test/integration/me-progress.test.ts` (new) | `/me` for the example rider: section after the rules and before the rides; the JSON holds the expected values (21 … 112, 1 … 17); `?period=4w` draws 10 Sep–7 Oct; the table rows; German and English texts; no km, m, h, km/h, ride name, Strava link or team-event name in the section or JSON (FR-005, SC-004); two riders see only their own (SC-007); no D1 writes, no queue message, no fetch (SC-006); no section without a balance (FR-016) |
| `test/integration/lang-switcher.test.ts` | `safeNext` keeps `/me?page=2&period=4w` and `/me?from=…&to=…`, and rejects anything else (FR-026) |
| `test/unit/rider-sections.test.ts` | the rides pager keeps the period (FR-026) |
| `test/unit/i18n.test.ts` | `template(id)` returns a message with its placeholders left in (R10) |
| `test/unit/reference-riders.test.ts` | unchanged cases; its riders move to `test/support/reference-riders.ts` |
| `test/unit/rider-view.test.ts` | the read's literals gain `countingRides` |
| `test/unit/catalogs.test.ts`, `test/integration/no-hardcoded-copy.test.ts` | the `progress.*` keys exist in both catalogs, and all visible text of the section comes from them (FR-060) |
| `test/unit/html.test.ts` | the chart JSON is escaped (`<` → `<`) |

User Story 2 adds `test/unit/progress-section.test.ts` (the pace line through
`renderProgress`, since no stored rules version has a deadline yet) and cases to
the same files:
- the pace on 4 October is 31 and 3, "81 ahead" (US2 scenario 1);
- no pace line without a deadline;
- the curve without virtual rides, 100 below, with the 167 line;
- neither of them without virtual rides.

## 2. Local walk-through (`pnpm dev`)

1. Run `pnpm dev`, open `http://localhost:8789/_dev/`, connect a sample rider
   with rides and team events, and open their rider page.
2. Below the rules, "Dein Saisonverlauf" shows two line charts with their target
   lines. The last points equal the summary's numbers. Open "Zahlen als Tabelle":
   one row per week.
3. Choose "Letzte 4 Wochen". The URL gains `?period=4w` and both charts show 28
   days. Switch to English: the period stays.
4. Drag across the Training chart. Both charts zoom to the dragged stretch, and
   "Früher", "Später" and "Ganze Saison zeigen" appear. Click a day: the readout
   shows its date and the two totals, and nothing else.
5. Tab to a chart. Use the arrows, `+`, `−`, Page Up/Down and `0`.
6. In the browser's device mode at 360 px with touch emulation: the charts are
   stacked with no sideways scrolling, a vertical swipe scrolls the page, and a
   pinch zooms.
7. Turn off JavaScript and reload. The charts show the period from the URL, the
   period links work, and the table opens.

Checks with real phones, the mouse wheel and a screen reader happen on the live
site after release. They are not tasks.
