# Quickstart: December Quote Monkeys

## Automated

```bash
pnpm test test/unit/holidays.test.ts test/unit/quote-art.test.ts test/teams/holidays.test.ts \
  test/integration/team-leaderboard.test.ts
node scripts/team-check.mjs
```

Covers ties (contracts/quote-art.md), picture sets and their spread, both teams' tables and the
dates of contracts/team-holidays.md, and the allowed overlaps 2026–2075.

## Pictures

```bash
pnpm badge-art christmas-market mulled-wine christmas-biscuits advent-wreath-1
pnpm badge-build christmas-market mulled-wine christmas-biscuits advent-wreath-1
# then advent-wreath-2 advent-wreath-3 advent-wreath-4 between-the-years
pnpm monkeys:seasonal   # overview: every picture with each team's windows
```

Check each against contracts/seasonal-art.md.

## By hand in fake mode

1. `pnpm dev`, open Hamburg and Europe through http://localhost:8791 as a sample rider with
   quotes on.
2. On `/_dev/`, pretend each day of contracts/team-holidays.md › Dates and open both teams' Team
   pages, reloading for several quotes; the picture matches the table (FR-011). On an Advent
   weekday, several quotes show different Advent pictures.
3. Reset the clock on `/_dev/`.
