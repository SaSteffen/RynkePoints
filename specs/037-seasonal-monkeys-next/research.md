# Research: Seasonal Quote Monkeys (Next Sets)

## R1: No code change

**Decision**: Only team data, pictures, tests and docs change.

**Rationale**: `src/http/holidays.ts` already takes `{ anchor: "easter", offset }` (tested with
Rosenmontag in `test/unit/holidays.test.ts`), fixed `"MM-DD"` days, both kinds and the year-end
wrap. `quoteArt` falls back to the regular monkeys while a monkey is missing from
`SEASONAL_MONKEYS`, and `scripts/quote-monkeys.mjs` lists every `seasonal: true` entry there.
Leap days need nothing: an Easter offset counts real days (Karneval 2028 runs 24 Feb – 1 Mar over
29 Feb).

**Alternatives considered**: An `"ash-wednesday"` or `"midsummer"` anchor: both are plain offsets
or fixed days, so a new anchor would only add code.

## R2: Ids

**Decision**: Monkey ids `karneval`, `easter`, `midsummer`, `halloween`, `europe-day`. Holiday ids
equal the monkey id, except Team Europe's Carnival: holiday `carnival`, monkey `karneval`.

**Rationale**: Holiday ids are unique only within a team and are a maintainer's label (spec
Assumptions); the picture is one file for both teams. None of the five clashes with an existing
quote monkey or `public/quotes/` file.

**Alternatives considered**: Monkey `carnival`: the German event is what the window follows
(Weiberfastnacht to Ash Wednesday), so the German name stays on the shared file.

## R3: Order in the team data

**Decision**: Both teams list their holidays in calendar order, January to December; Hamburg's
four December entries move behind the new ones.

**Rationale**: No windows overlap except Nikolaus inside Advent (R4), so order decides nothing;
calendar order is easiest to read. Advent stays listed before Nikolaus as in feature 035.

## R4: No overlaps, 2026–2035

**Decision**: A test asserts that, for every day 2026–2035, at most one of a team's windows holds
it, except Hamburg's 6 December (Nikolaus in Advent, decided in feature 035).

**Rationale**: Karneval ends by 10 March at the latest and Easter Monday by 26 April, both before
9 May; Midsummer and Halloween are fixed and far from the rest. The test keeps SC-005 true if a
later set adds a window.

Windows this implies:

| Year | Karneval | Easter |
|---|---|---|
| 2026 | 12–18 Feb | 3–6 Apr |
| 2027 | 4–10 Feb | 26–29 Mar |
| 2028 | 24 Feb – 1 Mar | 14–17 Apr |
| 2029 | 8–14 Feb | 30 Mar – 2 Apr |
| 2030 | 28 Feb – 6 Mar | 19–22 Apr |

## R5: Colours in the new scenes

**Decision**: The scenes name their colours, as Advent's does with sage #B5D6A7; the shared prompt
keeps light blue for water and sweat. Per picture:

- **Karneval**: jester's collar with points in yellow, cream and gold with small gold bells,
  confetti and streamers in yellow, gold, cream and sage. No clown nose: the palette has no red,
  and a fur-coloured nose disappears on the face.
- **Easter**: cream bunny ears with muzzle-coloured (#F0A868) insides over the helmet; a gold
  wicker basket of eggs in yellow, cream, sage and light blue.
- **Midsummer**: crown of sage leaves with yellow and cream flowers; a bunch of the same flowers.
- **Halloween**: pumpkin in fur orange #C8641E with a sage stalk, a friendly smiling carved face
  glowing yellow; no bats, skulls, spiders or teeth.
- **Europe Day**: a garland of plain triangle pennants alternating yellow, cream, sage, gold and
  fur orange, held up in both hands, a few confetti dots.

**Rationale**: FR-003. Pennants in yellow and blue alone would read as the EU flag, Sweden or
Ukraine, so Europe Day leaves light blue out and never pairs two colours on their own; no star
shapes anywhere on it, so nothing reads as the ring of stars.

**Alternatives considered**: Pennants in many bright colours: outside the palette, and a row of
coloured triangles reads as country flags.

## R6: Delivery and deadlines

**Decision**: One branch, team data and tests first, then the pictures; a release before
4 Feb 2027 covers every new picture's window, and an earlier one before 29 Nov 2026 only matters
once Europe's site is live.

**Rationale**: Unbuilt pictures fall back (035 FR-010), so all holidays can be listed at once
(spec Edge Cases). Europe's December needs no picture, only the data.
