# Quickstart: Seasonal Quote Monkeys (Next Sets)

## Automated

```bash
pnpm test test/teams/holidays.test.ts test/unit/holidays.test.ts test/unit/quote-art.test.ts
node scripts/team-check.mjs
```

Covers both teams' holiday tables and the dates of contracts/team-holidays.md, no overlaps
2026–2035, and that every listed monkey is a seasonal entry.

## Pictures

```bash
pnpm badge-art karneval easter midsummer halloween europe-day
pnpm badge-build karneval easter midsummer halloween europe-day
```

Check each against contracts/seasonal-art.md.

## By hand in fake mode

1. `pnpm dev`, open Hamburg and Europe through http://localhost:8791 as a sample rider with
   quotes on.
2. On `/_dev/`, pretend each day of contracts/team-holidays.md › Dates and open both teams' Team
   pages; the picture matches the table (FR-011).
3. Reset the clock on `/_dev/`.
