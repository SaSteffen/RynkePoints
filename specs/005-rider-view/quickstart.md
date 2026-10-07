# Quickstart: Rider View of Own Rynke

How to check that the Rynke sections of `/me` work, delivery by delivery. Tests
never touch production or Strava, and their data is synthetic.

## Prerequisites

- `pnpm install` done in the worktree.
- For the manual checks in §3: a browser with a device mode (Chrome DevTools or
  Firefox Responsive Design Mode), and feature 001's local run set up
  ([its quickstart §2](../001-strava-connect-webhook/quickstart.md)).

## 1. Automated checks

```bash
pnpm exec vitest run test/unit/rider-view.test.ts test/unit/rules.test.ts \
  test/unit/catalogs.test.ts test/integration/me-rynke.test.ts \
  test/integration/me-activities.test.ts test/integration/lang-switcher.test.ts \
  test/integration/language-rendering.test.ts \
  test/integration/no-hardcoded-copy.test.ts
pnpm lint && pnpm typecheck && pnpm test
```

Expected: all green. Each delivery's tests are in place before its code (red,
then green).

| Check | Where | Expected |
|---|---|---|
| US1 scenarios 1–11 | `me-rynke.test.ts`, numbered | 12 of 250 with 238 missing, 0 of 25 with 25 missing, "Noch nicht dabei"; 262/25 "Du bist dabei", and no virtual line without virtual rides; 160 of 167 with 7 missing; 400/20 names only the 5 missing Teamrynke; the 79 km ride row shows "zählt", 7 and 1.240 m; a ride without a result shows "wird ausgewertet" and "–"; no balance gives only the notice; rider B never sees rider A's figures; signed out gives `302 /` |
| US1 scenario 5 (FR-013) | `rider-view.test.ts` | A balance under a rules version whose threshold is 300 shows "von 300"; an unknown version shows the numbers without targets and no gauges |
| Gauges (SC-009) | `rider-view.test.ts` | 249/250 → 99 and not reached; 250/250 and 262/250 → 100 and reached; 12/250 → 4; 160/167 → 95; elevation 1240 m → 24, 760 m to go; 3000 m → 0, 1000 m to go |
| Segments (FR-022) | `rider-view.test.ts` | distance 70 and elevation 30 of 250 → 28.00 % and 12.00 %; over the target, the parts fill 100 % in proportion; parts of 0 are dropped |
| US2 scenarios 1–10 | `me-rynke.test.ts` | Captions carry every figure as text, `gauge-reached` only at 100, the bar is `aria-hidden`, and the elevation gauge is present |
| US3a scenarios 1, 4, 5 | `me-rynke.test.ts` | 7 from distance; 1.240 m → 5, 760 m to the next 5; total 12 |
| US4 scenarios 1–7 | `rider-view.test.ts`, `me-rynke.test.ts` | Overlap names "06.10.2026, 08:00 Uhr, 80,0 km"; pause "3 h 0 min Pause bei 4 h 0 min"; manual and "7,5 km/h" for the 15 km / 2 h ride (rounded down), below 10 km/h; every other reason; virtual mark; unknown elapsed time with "kann sich noch ändern"; fix hint only for pause, speed, climbing rate and manual entry |
| Reason texts (SC-003) | `catalogs.test.ts` | Every `REASON_CODES` and `UNKNOWN_FIGURE_CODES` value has a key in `de` and `en`; an unknown code shows `rynke.reason.unknown` |
| US5 scenarios 1–6 | `me-rynke.test.ts`, `lang-switcher.test.ts` | 45 rides: "Fahrten 1–20 von 45", then 21–40 and 41–45; `page=99` shows 41–45; `page=abc` shows page 1; 20 rides have no pager; switching language on page 2 returns to `/me?page=2`; pager links have the `tap` class |
| US6 scenarios 1–6 | `me-rynke.test.ts` | `CURRENT_RULES.version` (2 since feature 003 Story 3) since 07.10.2026, the season start and the handout link; with the balance's version ≠ `CURRENT_RULES.version`, the "being updated" notice (SC-006); a running import shows the "will grow" notice |
| Read-only (SC-004) | `me-rynke.test.ts` | Opening `/me` and pages 1–3 changes no `tableCounts()` and no row, sends no queue message, and makes no Strava request |
| Isolation (SC-007) | `me-rynke.test.ts` | Riders A and B with distinct figures; each sees only their own |
| Languages (SC-008) | `language-rendering.test.ts`, `no-hardcoded-copy.test.ts` | The Rynke sections are fully German or fully English; the pseudo-locale run finds no literal |
| 500 rides (SC-005) | `me-rynke.test.ts` | Pages 1 and 25 render; `EXPLAIN QUERY PLAN` of the page statement uses `activities_by_rider` |
| Rules history | `rules.test.ts` | Versions unique; `CURRENT_RULES` is the highest; `rulesForVersion` finds each; `virtualShareRequired(CURRENT_RULES) = 167` |

| US3b scenarios 2, 3, 5 (team events) | `rider-view.test.ts`, `me-rynke.test.ts` | Team training "2 × dabei → 2 Teamrynke, 10 Trainingsrynke", technique training 1 × → 5 and 5, training-weekend day 0 × → 0 and 0; the three events with date, kind and name, newest first; without attendance every kind with 0 and "noch kein Teamtermin"; an event after the deadline is listed as "zählt nicht" |
| US2 scenario 6 (team events) | `rider-view.test.ts`, `me-rynke.test.ts` | Distance 70, elevation 30 and events 50, 40, 10 of 250 → 80 %, five segments with their legend; the Team gauge divided by kind |

The corrections of US3b (scenarios 2's corrections, 3's correction, 6, and US2
scenarios 6's corrections part and 7) add their rows when feature 003 Story 6
exists (research R5).

## 2. Delivery checks

After each delivery, before its pull request:

1. `pnpm lint && pnpm typecheck && pnpm test` are green.
2. The page still shows everything earlier deliveries showed (FR-006). The
   integration tests of earlier stories run unchanged.
3. The diagrams of [plan.md](plan.md#design-diagrams) and the spec's
   [Diagrams](spec.md#diagrams) still match what was built (FR-091, FR-092). The
   last task phase does this for the whole feature.

## 3. Manual checks (maintainer)

Uses feature 001's local run with your own Strava account. Your rides stay in
the local D1.

1. `pnpm wrangler d1 migrations apply rynke-points --local`, then `pnpm dev:strava`.
   Connect on `http://localhost:8789/` and wait for the import. For page work
   without Strava, `pnpm dev` has a sample rider for every state
   ([feature 006 quickstart](../006-local-frontend-dev/quickstart.md)). Feature 003 evaluates
   each imported page, so a balance appears within seconds.
2. **Desktop**: open `/me`. Check the order of sections against spec
   [D4](spec.md#d4-page-layout-desktop), and that the figures agree with the
   rows (`pnpm wrangler d1 execute rynke-points --local --command "SELECT * FROM
   rynke_balances"`).
3. **Phone (SC-010)**: in device mode, set the width to 360 px, portrait. On
   every section and every table page:
   - no horizontal scroll bar appears;
   - text is readable at 100 % zoom;
   - gauges are stacked;
   - date, distance, "Zählt?", Trainingsrynke and metres stay in the main row,
     and sport type and reasons sit below it;
   - pager links are at least 44 × 44 px (inspect the box model).
   Compare with spec [D5](spec.md#d5-page-layout-phone-360-pixels-wide).
4. **Being updated**: run `pnpm wrangler d1 execute rynke-points --local
   --command "UPDATE rynke_balances SET rules_version = 99"`, then reload. The
   "being updated" notice appears, and the numbers are labelled version 99.
   Version 99 is not in `RULES_HISTORY`, so the targets and gauges are left out
   (FR-013). The next `evaluate-rider` or the cron restores the version in
   effect (`CURRENT_RULES.version`). To force it, reconnect, or wait for the
   daily sweep.
5. **No balance yet**: run `DELETE FROM rynke_balances` the same way, then
   reload. Only the "still being worked out" notice and the ride table remain.
6. **Speed (SC-005)**: with a full season imported, or 500 synthetic rows from
   the integration test's seed, every table page appears in well under 2 s.
   Use the browser's network tab, local dev server.
7. **Languages**: switch to English on page 2. You stay on page 2, everything is
   in English, numbers are written "1,240", and the handout link says it is in
   German.

Nothing in this guide touches production. Releasing is merging into `main`
(constitution, Development Workflow).
