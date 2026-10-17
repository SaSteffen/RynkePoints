# Quickstart: Riders Report Team-Event Participation

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

How to check the feature works. Fixtures are synthetic (constitution Principle I);
nothing contacts Strava.

## 1. Automated checks

```bash
pnpm install
pnpm lint && pnpm typecheck
pnpm test          # unit + integration in workerd
pnpm test:e2e      # smoke tests in Chromium, Firefox, WebKit
```

Expected coverage, test-first (Principle V):

| Area | Tests |
|---|---|
| report state from date, attendance and report ([data-model.md](data-model.md) "Derived state") | `test/unit/participation.test.ts` |
| undo token round trip, expiry, wrong context | `test/unit/request-undo.test.ts` |
| migration, cascades on event and rider deletion | `test/integration/participation-store.test.ts` |
| `add-attendance` deletes reports in the same batch (research R3) | `test/integration/team-events-apply.test.ts` |
| `/events` and its two POSTs, every row of [http-routes.md](contracts/http-routes.md) | `test/integration/rider-events.test.ts` |
| quick decisions, undo, "Ich war auch dabei", counts and chips | `test/integration/organiser-requests.test.ts` |
| tri-state save with and without `decide-*` fields | `test/integration/organiser-attendance.test.ts` |
| overview tile, ordering, one line per request | `test/integration/organiser-overview.test.ts` |
| Team page order, no place card, no peloton | `test/integration/team-leaderboard.test.ts` |
| navigation: Termine for riders, Orga with count for organisers | `test/integration/sections.test.ts` |
| no rider page shows others' reports or counts (FR-010, SC-004) | `test/integration/rider-events.test.ts` |
| reports never change balances, badges or leaderboards (SC-003) | `test/integration/rider-events.test.ts` |
| catalog keys used, German and English complete | `test/unit/catalogs.test.ts`, `test/integration/no-hardcoded-copy.test.ts` |

## 2. By hand with sample data

```bash
pnpm dev           # http://localhost:8789, fake Strava, synthetic riders
```

Sample data (research R14): upcoming events with intents, open requests at three
past events, Nora with three, Katrin with two.

1. Sign in as a rider who isn't an organiser. The navigation shows **Termine**
   instead of Orga; Team shows no place card and no peloton, the Rangliste above
   the chart.
2. Termine: the Spond/Strava note on top, "Demnächst" with the "Bin dabei" line
   under it. Tap **Bin dabei**: green with a tick. Hover it: red "Doch nicht
   dabei". Click: back to yellow. Balance on Du unchanged.
3. Tap **Ich war dabei** on a past event: green, no way back.
4. Sign in as an organiser. Orga shows a red count; Termine starts with the open
   requests. **Eintragen** one: the notice names the rider with **Rückgängig**;
   undo it; the request is back. **Alle n eintragen** on another event.
5. Tap **Ich war auch dabei** on a past event: the button disappears, "n
   Personen, inklusive dir".
6. Open a past event with requests: legend, grey boxes first; cycle one through
   ticked, empty, grey; save with one ticked, one emptied, one grey; the notice
   says 1, 1, 1. With script disabled the same rows show three radios.
7. Overview: the tile "Rider mit offener Meldung" filters to riders with
   requests; Nora shows three lines; confirming one leaves two.
8. Back as the first rider: the denied event shows "Ich war dabei" again, the
   confirmed one "Du warst dabei"; no message about either.
9. At 360 px in light and dark mode, nothing scrolls sideways.
