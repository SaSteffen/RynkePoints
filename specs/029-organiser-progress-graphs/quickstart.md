# Quickstart: Validating Organiser Progress Graphs

## Setup

```bash
pnpm install
pnpm dev        # http://localhost:8789, fake Strava and synthetic riders
```

Sign in from `/_dev/` as the sample organiser and open `/organiser/riders`. Details:
[contracts/pages.md](contracts/pages.md), [contracts/client.md](contracts/client.md).

## Automated

```bash
pnpm test && pnpm lint && pnpm typecheck
pnpm exec playwright test e2e/organiser-graphs.e2e.ts
```

| Must be covered by | Check | Requirement |
| --- | --- | --- |
| Unit | Two rides on one day make one point; outdoor and virtual split; elevation from both | FR-003, FR-006 |
| Unit | Team totals include all agreed riders, whichever are selected; zero riders doesn't divide | FR-011 |
| Unit | Season sums equal the sum of counting rides; a day past `lastDay` is clamped | SC-005 |
| Unit | `dailyFigures` organisers only, since 3; versions don't depend on settings | FR-024, FR-028 |
| Unit | Setting throws on other values | Story 7 |
| Integration | Rider on version 2: in the table, absent from the data and team totals | FR-024, FR-025, SC-004 |
| Integration | Agreeing to version 3 adds the rider; leaving removes them | Story 2, FR-026 |
| Integration | Setting off, or percent mode: no section, no data, no statements | FR-027, FR-029 |
| Integration | Non-organiser gets 403; no ride name or start time in the response | FR-003, FR-030 |
| Integration | D1 round trips unchanged | research R2 |
| E2E | Preset, date boxes and drag stay in sync; tile keeps range and team lines | FR-013, Story 4 |
| E2E | Narrow: switch, tabs, search across groups, rows open at 5 or fewer | Story 5 |

## By hand, on the local fake team

1. Wide screen: table scrolls inside its box with the header in view; Progress is below it.
2. "Everyone": about 40 riders, thin grey lines, ranked legend. Highlight one rider.
3. Dropdown: find a name, tick it, close by clicking outside. Held-back riders are listed at the bottom.
4. Sign in as a held-back rider: the consent gate names the new line. Agree, then as organiser they have a line.
5. Phone width: Graphs opens by default. Swipe up over a graph to scroll, drag sideways to choose a range.
6. Riders view: search a rider outside the group. Open reports appear above the switch.
7. Set `ORGANISER_PROGRESS_GRAPH` to "off" in `wrangler.jsonc`, restart: no section, no switch, Riders directly.
8. Check a dark theme: lines and legend stay readable.
