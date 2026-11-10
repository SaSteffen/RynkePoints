# Contract: Which picture says the quote

Amends feature 016 contracts/pages.md (quote monkey amendment). The markup stays the same:
`img.quote-monkey-art`, `alt=""`, 120×120, `src` from `artUrl(...)`.

`src` for a quote with id `n` (its 8 hex digits as a number) on the Berlin day `today`:

| Situation | Picture |
|---|---|
| no holiday on `today`, or its monkey not in `SEASONAL_MONKEYS` | `/quotes/<QUOTE_MONKEYS[n % length]>.svg` (unchanged) |
| short holiday | `/quotes/<holiday.monkey>.svg` |
| long holiday, bit 16 of `n` set | `/quotes/<holiday.monkey>.svg` |
| long holiday, bit 16 of `n` clear | `/quotes/<QUOTE_MONKEYS[n % length]>.svg` |
| no regular monkey built | the rider-state illustration (unchanged) |

Days are inclusive and in German time; overlapping windows → fewest days wins.

## Hamburg dates this contract implies

| Year | Advent | Nikolaus | Christmas | New Year |
|---|---|---|---|---|
| 2026 | 29 Nov – 23 Dec | 6 Dec | 24–26 Dec | 31 Dec – 1 Jan 2027 |
| 2027 | 28 Nov – 23 Dec | 6 Dec | 24–26 Dec | 31 Dec – 1 Jan 2028 |
| 2028 | 3 Dec – 23 Dec | 6 Dec | 24–26 Dec | 31 Dec – 1 Jan 2029 |
