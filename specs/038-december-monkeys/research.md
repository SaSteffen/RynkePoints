# Research: December Quote Monkeys

## R1: A holiday names a set

**Decision**: `Holiday.monkey: string` becomes `Holiday.monkeys: readonly string[]` (at least one).
Every existing entry becomes a set of one; Advent becomes `["advent", "christmas-market",
"mulled-wine", "christmas-biscuits"]`.

**Rationale**: One shape for every holiday keeps `quoteArt` and the tests to one path; a set of one
behaves exactly like today's single monkey (R3). The overview page and the team test read the field
too and change with it.

**Alternatives considered**: `monkey: string | string[]`: every reader would have to handle both
shapes. A separate `set` field next to `monkey`: two ways to say the same thing.

## R2: Ties return every window

**Decision**: `holidayOn(today, holidays): Holiday | null` becomes
`holidaysOn(today, holidays): readonly Holiday[]`: every window holding `today` that has the fewest
days, in team-data order; empty without any.

**Rationale**: FR-008 replaces 035's "first listed wins" with a combined set. The fewest-days rule
stays, so Nikolaus still beats Advent, and an Advent Sunday beats Advent. Only windows of the same
length tie: Nikolaus with the second Advent (1 + 1 day), Christmas Eve with the fourth Advent (R4).

**Alternatives considered**: Merging the tie into one synthetic holiday inside `holidaysOn`: it
would invent an id and a kind; the caller already has what it needs from the list.

## R3: Which picture a quote gets

**Decision**: In `quoteArt`, for the day's windows:

1. The set is the windows' monkeys together, without duplicates, keeping only those in
   `SEASONAL_MONKEYS` (built).
2. Empty set → the regular monkey, as outside every window (035 FR-010).
3. The day is short if any of its windows is short. Short, or long with bit 16 of the quote id set
   → `set[floor(n / 2^17) % set.length]`; otherwise the regular monkey.

**Rationale**: Bits 17–31 of the FNV-1a id are independent of bit 16 (who shows a seasonal
picture in a long window) and of `n % 11` in practice, so the set spreads evenly and a quote keeps
its picture all window long (FR-004, FR-005). A set of one always picks index 0, so every existing
holiday behaves as before. Checked on the real quotes: Hamburg's 282 Advent quotes split 82 / 63 /
78 / 59 over four pictures, Europe's 60 split 19 / 11 / 11 / 19 (fair share 15, SC-002 allows up
to 30); a 50/50 day splits Hamburg 292 / 257 and Europe 56 / 64.

A picture built during a window changes the set's size, so some quotes switch picture once on that
day. Accepted: pictures are built before their window (Delivery), and a reload shows the same as
before afterwards.

No tie mixes kinds in the data; "short if any is short" is the simplest rule that keeps a short
window's promise that every quote shows it.

**Alternatives considered**: `n % set.length`: correlates with the regular `n % 11` pick and with
bit 16 for even set sizes. A per-day rotation: breaks "the same quote shows the same picture".

## R4: Christmas Eve as its own window

**Decision**: Christmas becomes two holidays with the same monkey: `christmas-eve` 24 Dec – 24 Dec
and `christmas` 25–26 Dec, both short.

**Rationale**: FR-008a. With one 24–26 Dec window (3 days), the fourth Advent (1 day) would win
alone in 2028, 2034, 2045, 2051, 2056, 2062 and 2073. A one-day Christmas Eve ties with it and
splits 50/50; 25–26 Dec show Christmas only, as before. Pure data, no special case in code.

**Alternatives considered**: A tie rule by overlap instead of length: changes what Nikolaus versus
Advent means. Treating "same day" specially in code: a branch for one holiday.

## R5: Ids and order

**Decision**:

| What | Monkey id | Holiday id |
|---|---|---|
| Christmas market | `christmas-market` | (in `advent`) |
| Mulled wine | `mulled-wine` | (in `advent`) |
| Christmas biscuits | `christmas-biscuits` | (in `advent`) |
| Wreath, 1–4 candles | `advent-wreath-1` … `advent-wreath-4` | `advent-1` … `advent-4` |
| Between the years | `between-the-years` | `between-the-years` |
| Christmas Eve | `christmas` (existing) | `christmas-eve` |

Both teams list their holidays in calendar order of their first day: … `advent`, `advent-1`,
(`nikolaus`), `advent-2`, `advent-3`, `advent-4`, `christmas-eve`, `christmas`,
`between-the-years`, `new-year`.

**Rationale**: None clashes with an existing monkey or `public/quotes/` file. The order only
decides the order inside a tied set, which spreads either way.

## R6: Allowed overlaps, 2026–2075

**Decision**: The team test's "at most one window per day" gets these exceptions, and asserts the
tie days:

- Every Advent Sunday lies in Advent (the Sunday wins).
- Hamburg's 6 December lies in Advent (Nikolaus wins), and in 2026, 2037, 2043, 2048, 2054, 2065
  and 2071 it is also the second Advent Sunday (tie: Nikolaus and the two-candle wreath).
- 24 December is the fourth Advent Sunday in 2028, 2034, 2045, 2051, 2056, 2062 and 2073 (tie:
  Christmas and the four-candle wreath).
- Valentine's Day in Karneval (unchanged).

**Rationale**: The fourth Advent Sunday falls 18–24 December, so it never reaches Christmas Day;
27–30 December touches no other window. A test over every day keeps SC-005 true.

## R7: Pictures and palette

**Decision**: All eight in the existing palette: wreath sage, candles cream, flames yellow and
gold; mulled wine red in a cream mug; the market hat red with a cream band of reindeer; the bike as on the `bike` monkey, snow cream. Red is
named in the scenes that use it (mug, the market's bag ribbon if any), as the README asks. Each
scene says "no digits, no letters"; the wreaths name exactly how many candles burn and that the
others are unlit, and drop the Advent calendar scene's "no candles".

**Rationale**: No new colour means no change to `scripts/trace.mjs`. The candle count has to read
at 120 px (FR-001), so the scenes ask for four big candles, evenly spaced, on a wreath held in front
of the body.
