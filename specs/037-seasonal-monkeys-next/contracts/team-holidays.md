# Contract: Team holidays (amendment)

Amends feature 035 contracts/team-holidays.md. The types don't change.

Guarantees, held by `test/teams/holidays.test.ts`:

- Every `monkey` is a `seasonal: true` entry of `art/quotes/monkeys.json`; holiday ids are unique
  within a team; fixed days are real calendar days (unchanged).
- Hamburg lists exactly its eight holidays of data-model.md; Team Europe exactly its eight
  (replaces "Europe lists none"). Europe has no `nikolaus` and its `placeholders` no `holidays`.
- Two teams may list the same monkey; every monkey a team lists shows no place, team name or
  team art (replaces "the December monkeys show no place or team name", clarifies 035 FR-012).
- For every day 2026–2035, at most one of a team's windows holds it, except Hamburg's 6 December.

## Dates this contract implies

German days, both included; `—` means the team has no such window.

| Day(s) | Hamburg | Europe |
|---|---|---|
| 2027-02-03 | regular | regular |
| 2027-02-04 – 02-10 | Karneval | Karneval |
| 2027-02-11 | regular | regular |
| 2027-03-25 | regular | regular |
| 2027-03-26 – 03-29 | Easter | Easter |
| 2027-03-30 | regular | regular |
| 2028-02-24 – 03-01 | Karneval | Karneval |
| 2028-04-14 – 04-17 | Easter | Easter |
| 2027-05-09 | regular (—) | Europe Day |
| 2027-06-19 / 06-25 | regular | regular |
| 2027-06-20 – 06-24 | Midsummer | Midsummer |
| 2027-10-28 / 11-01 | regular | regular |
| 2027-10-29 – 10-31 | Halloween | Halloween |
| 2026-11-29 – 12-23 | Advent (long) | Advent (long) |
| 2026-12-06 | Nikolaus | Advent (long) |
| 2026-12-24 – 12-26 | Christmas | Christmas |
| 2026-12-31 – 2027-01-01 | New Year | New Year |
