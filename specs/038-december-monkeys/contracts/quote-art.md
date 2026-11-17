# Contract: Which picture says the quote (amendment)

Amends feature 035 contracts/quote-art.md. The markup stays the same: `img.quote-monkey-art`,
`alt=""`, 120×120, `src` from `artUrl(...)`.

For a quote with id `n` (its 8 hex digits as a number) on the Berlin day `today`:

- **windows**: `holidaysOn(today, team.holidays)`, every window holding `today` with the fewest
  days (replaces "the first listed on a tie").
- **set**: the windows' `monkeys` together, without duplicates, only those in `SEASONAL_MONKEYS`.
- **pick**: `set[floor(n / 2^17) % set.length]`.

| Situation | Picture |
|---|---|
| no windows, or the set is empty | `/quotes/<QUOTE_MONKEYS[n % length]>.svg` (unchanged) |
| a window is short | `/quotes/<pick>.svg` |
| all windows long, bit 16 of `n` set | `/quotes/<pick>.svg` |
| all windows long, bit 16 of `n` clear | `/quotes/<QUOTE_MONKEYS[n % length]>.svg` |
| no regular monkey built | the rider-state illustration (unchanged) |

A set of one picks it for every quote, so every holiday of features 035 and 037 shows as before.

## Guarantees, held by `test/unit/quote-art.test.ts`

- The same quote on two days of the same windows gets the same picture.
- Over 40 quotes in Advent with all four pictures built: every picture shows, none on more than
  twice its fair share of the Advent quotes; 30–70 % of the quotes show one (unchanged).
- A tie of two short one-picture windows: every quote shows one of the two, each on 30–70 %.
- An unbuilt picture never shows; the rest of its set still does.
