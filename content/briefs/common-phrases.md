# Brief: common phrases

The monkey's phrases on the Team page for every team that has no phrases of its own
(feature 026 FR-025, FR-029, FR-046, FR-047). Written once as an English original, rated
with `tools/content-rating/`, then adapted (not translated word for word) into every
other shipped language as `src/content/phrases/common.<locale>.ts`.

## Tone

Light, mostly neutral. Dry and specific rather than jokey: a small, true observation
about riding, weather, legs or the bike, said the way a teammate would. Informal address.
No exclamation-mark slogans, no punchline tags, no poster mottos, nothing that sounds
generated.

## Motifs

- The first pedal stroke, getting out of the door, the short ride that still counts.
- Weather, wind, rain, dark mornings, warm evenings.
- The bike: chain, gears, tyres, the saddle, the bottle.
- Legs, coffee stops, the way home, the route that grew longer.
- The team riding together, without naming the team.

## Avoid

- Any team, place or charity name (no Hamburg, Rynkeby, Paris, no city or region).
- Rider names, ranks, comparisons or anything that singles out a rider (FR-024).
- Charity or fundraising angles, guilt, pressure, health claims.
- Gender marks with `*` or `/`.
- Anything longer than Hamburg's longest phrase.

## Target

About 40 phrases:

- about 26 **push** (for a rider who doesn't qualify yet and is behind the even pace),
- about 6 **on track** (for a rider ahead of the pace or qualified),
- per season (spring, summer, autumn, winter) at least one push and one on-track phrase,
  which only fit that season.

## Source

Adapted from Hamburg's list in `src/content/phrases/hamburg.de.ts` (formerly
`src/i18n/messages/quotes.de.ts`), with the team and place references taken out, plus
some new ones. Generate about three times the target, drop near-duplicates and rule
breakers before rating (FR-030). Only approved phrases reach the code (FR-033).
