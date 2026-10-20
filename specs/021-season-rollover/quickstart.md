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
2. Record Anna on the first two, Ben on the third.
3. Check:
   - Anna's and Ben's Training and Team Rynke did not change (FR-002).
   - As a rider, the Termine tab lists the tour days without a Rynke amount
     (FR-004) and offers "Ich war dabei" on a past one.
   - Anna's own badges: "Tour de Paris" shows "Tour-Tag 2" on the card, ribbon
     "Tag 2", no bar, and in the full list "Tour-Tag 1" and "Tour-Tag 2" with the
     days' dates, the personal placeholder picture and six outlines
     (FR-010–FR-013). Ben has "Tour-Tag 3" only; a rider at no tour day has none.
     Team-Abzeichen has no Tour de Paris.
   - If the tour day had the most riders of the season, "Big training" moved
     (FR-005).
4. Remove Anna from the second tour day: her "Tour-Tag 2" is gone, without
   notice.
5. Create a tour day before the first: Anna now has "Tour-Tag 2" and "Tour-Tag 3",
   Ben "Tour-Tag 4". Delete it again: back as before (FR-012).

The sample season has its own tour (4–11 July: Fiona FarAway rides all eight
days, Vera Virtual the first five, Olga Organiser the first two). Its badges show
once their day has come, so on `/_dev/` under **Clock** pretend a day in the tour,
for example 6 July. Setting the clock works out every rider again (a moment for
the queue):

- Fiona's badges show "Tour-Tag 3" on the card and Tour-Tag 1 to 3 dated 4, 5 and
  6 July; Olga's only Tour-Tag 1 and 2; a rider who didn't ride has none.
- Each rider gets one notice for their own new tour badges.
- Pretend 12 July: Fiona has all eight, Vera 1 to 5, Olga 1 and 2. Then **Back to
  the real day**.

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
