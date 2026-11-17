# Contract: Team holidays (amendment)

Amends feature 037 contracts/team-holidays.md. `Holiday.monkey` becomes `Holiday.monkeys`
(data-model.md).

Guarantees, held by `test/teams/holidays.test.ts`:

- Every entry of every `monkeys` is a `seasonal: true` entry of `art/quotes/monkeys.json`; a set
  has at least one and no duplicates; holiday ids are unique within a team; fixed days are real
  calendar days.
- Hamburg lists exactly its 15 holidays of data-model.md; Team Europe exactly its 15.
- Two teams may list the same monkey; no monkey a team lists shows a place, team name or team art
  (unchanged).
- For every day 2026–2075, at most one of a team's windows holds it, except an Advent Sunday in
  Advent, Hamburg's 6 December in Advent, 24 December on the fourth Advent Sunday and 14 February
  in Karneval (research R6). On those days the fewest days win, and a tie returns both windows.

## Dates this contract implies

German days; "A / B" means the day's quotes split between A and B. The rows before December are
037's, unchanged.

| Day(s) | Hamburg | Europe |
|---|---|---|
| 2026-11-28 | regular | regular |
| 2026-11-29 | wreath 1 | wreath 1 |
| 2026-11-30 – 12-05 | Advent set (long) | Advent set (long) |
| 2026-12-06 | Nikolaus / wreath 2 | wreath 2 |
| 2026-12-07 | Advent set (long) | Advent set (long) |
| 2026-12-13 | wreath 3 | wreath 3 |
| 2026-12-20 | wreath 4 | wreath 4 |
| 2026-12-23 | Advent set (long) | Advent set (long) |
| 2026-12-24 – 12-26 | Christmas | Christmas |
| 2026-12-27 – 12-30 | between the years | between the years |
| 2026-12-31 – 2027-01-01 | New Year | New Year |
| 2027-11-28 / 12-05 / 12-12 / 12-19 | wreath 1 / 2 / 3 / 4 (one each) | the same |
| 2027-12-06 | Nikolaus | Advent set (long) |
| 2028-12-02 | regular | regular |
| 2028-12-03 | wreath 1 | wreath 1 |
| 2028-12-06 | Nikolaus | Advent set (long) |
| 2028-12-24 | Christmas / wreath 4 | Christmas / wreath 4 |
| 2028-12-25 | Christmas | Christmas |
