# Quickstart: Season Rollover

How to check the feature end to end with synthetic data. Nothing here touches
production except the last section, which only reads it.

## Prerequisites

```bash
pnpm install
pnpm exec playwright install chromium
```

## 1. Tests

```bash
pnpm test        # kinds, windows, tour badges, guard, layout, album rendering
pnpm lint && pnpm typecheck
```

Expected: the tests listed in [plan.md](plan.md) pass; `dev-guard.test.ts` also
checks that nothing under `src/` imports `album/`.

## 2. Tour days in the app (US1, US2)

```bash
pnpm dev         # http://localhost:8789, sample season, fake Strava
```

1. Sign in as a sample organiser, open Orga → Termine, create three events of
   the kind "Tour de Paris" dated after the qualification deadline (one per day,
   names like "Hamburg – Bremen").
2. Record Anna on the first two, Ben on the first.
3. Check:
   - Anna's and Ben's Training and Team Rynke did not change (FR-002).
   - As a rider, the Termine tab lists the tour days without a Rynke amount
     (FR-004) and offers "Ich war dabei" on a past one.
   - Badges → Team-Abzeichen: "Tour de Paris" shows "Tour-Tag 1" and "Tour-Tag 2"
     with the dates of the first and second tour day, the team placeholder
     picture, and "Noch 1 Tag" (FR-010–FR-013). No rider is named.
   - If the tour day had the most riders of the season, "Big training" moved
     (FR-005).
4. Remove Anna from the second tour day: "Tour-Tag 2" is gone, without notice.

The sample season has its own tour (4–11 July: Fiona FarAway rides all eight
days, Vera Virtual the first five, Olga Organiser the first two). Its badges show
once their day has come, so on `/_dev/` under **Clock** pretend a day in the tour,
for example 6 July:

- Badges → Team-Abzeichen shows "Tour-Tag 3" with Tour-Tag 1 to 3 dated 4, 5
  and 6 July, and "Noch 1 Tag" to the next.
- Run the daily cron (`/__scheduled`): each listed rider gets the new tour
  badges' notice once, and running it again tells no one twice (FR-012).
- Pretend 12 July: all eight are earned. Then **Back to the real day**.

## 3. Albums from the sample season (US3–US5)

With `pnpm dev` stopped (both use `.wrangler/fake-state`):

```bash
pnpm season:album --local          # cut-off today
```

Expected (contract [season-album-command.md](contracts/season-album-command.md)):

- one PDF per listed sample rider in `season-albums/2026-27/`, and "Print
  check: n of n passed";
- `git status` shows nothing under `season-albums/`;
- open one album: A4 pages, page 1 with the rider's figures, page 2 with the
  team's events and the rider's ticks, then sticker pages with earned badges a
  little rotated and off-centre, empty slots as dotted outlines with names, "?"
  for surprise badges, nothing within 12 mm of the edge, the wider gutter on the
  inner side alternating per page, an even page count;
- compare page 1's figures with the rider's page in `pnpm dev` (SC-003);
- run the command again: the stickers sit in the same places (FR-026).

Spot-check vectors: zoom an album to 800 %; badge edges and text stay sharp.

## 4. Real albums (maintainer, end of August)

```bash
npx wrangler login              # if not logged in
pnpm season:album               # cut-off today; reads production, writes nothing
```

Hand each rider only their own PDF, then delete `season-albums/`.
