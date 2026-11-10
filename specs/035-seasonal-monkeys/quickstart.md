# Quickstart: Seasonal Quote Monkeys (December)

## Automated

```bash
pnpm test test/unit/holidays.test.ts test/unit/quote-art.test.ts test/teams
```

Covers: first Advent Sunday 2026–2035, windows and wrap-around, overlap (6 Dec → Nikolaus),
picture choice per contracts/quote-art.md, the Advent share (30–70 % of 40 quotes, SC-003), team
data checks (contracts/team-holidays.md).

## By hand in fake mode

1. `pnpm dev`, open Hamburg (http://localhost:8791 → Hamburg) as a sample rider with quotes on.
2. On `/_dev/`, pretend the day and open the Team page:

| Day | Expected picture |
|---|---|
| 2026-11-28 | regular |
| 2026-11-29 | Advent on about half of the quotes |
| 2026-12-06 | Nikolaus, every quote |
| 2026-12-24 / 12-26 | Christmas, every quote |
| 2026-12-27 | regular |
| 2026-12-31 / 2027-01-01 | New Year, every quote |
| 2027-01-02 | regular |

3. Open Europe (http://europe.localhost:8790) on 2026-12-24: regular monkeys.
4. Reset the clock on `/_dev/`.

## Pictures

```bash
pnpm badge-art advent nikolaus christmas new-year
pnpm badge-build advent nikolaus christmas new-year
```

Check each against art/quotes/README.md › Checking a picture, plus: no religious symbols, no year
or digits on the New Year monkey.
