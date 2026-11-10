# Research: Seasonal Quote Monkeys (December)

## R1. Where the holidays live

- **Decision**: A new `holidays` field on `TeamData` (`src/teams/types.ts`), filled in
  `src/teams/hamburg.ts` (four December holidays) and `src/teams/europe.ts` (empty).
- **Rationale**: Feature 026 puts everything that differs between teams in team data, never a
  branch in code (spec FR-011). The field is required, so a new team states its holidays
  explicitly, even when there are none.
- **Alternatives**: A `holidays` block in `art/quotes/monkeys.json` (rejected: that list is shared
  by all teams; it holds pictures, not which team shows them); `wrangler.jsonc` vars (rejected:
  structured data belongs in the team file, research R1 of feature 026).

## R2. How a window names its days

- **Decision**: A window is `{ from, to }`, each a day reference: a fixed `"MM-DD"`, or
  `{ anchor: "first-advent" | "easter", offset }` (days after the anchor, may be negative). A
  window whose `to` comes before its `from` in the year wraps over the year end
  (New Year: `"12-31"` → `"01-01"`).
- **Rationale**: Covers December now and the later sets (Karneval and Pfingsten from Easter,
  Halloween fixed) without new code (FR-013). Easter is already computed for the Osterhase badge
  (`src/badges/easter.ts`), so it is reused, not copied.
- **First Advent Sunday**: the Sunday 21 days before the last Sunday on or before 24 December;
  always between 27 November and 3 December (FR-005). A pure function next to `easterSunday`.
- **Alternatives**: Listing explicit dates per year (rejected: needs a yearly change, SC-005);
  an anchor "christmas" with a weekday rule (rejected: more general than needed; first Advent is
  the one moving December date).

## R3. Which window applies

- **Decision**: For `today` (Berlin date, `berlinDate(ctx.now())`, already computed on the Team
  page), the holiday whose window contains it; with several, the one with the fewest days; with a
  tie, the first in the team's list.
- **Rationale**: Nikolaus beats Advent (FR-006). Using the page's `today` makes the window change
  at German midnight and follows fake mode's clock (feature 021) for free.

## R4. Choosing the picture

- **Decision**: `quoteArt` gets the holiday of the day (or none) and the built seasonal monkeys.
  - No holiday, or its picture not built: today's rule, `regular[n % regular.length]` with `n`
    the quote id as a number (FR-009, FR-010).
  - Short window: the holiday's monkey (FR-007).
  - Long window: the holiday's monkey when bit 16 of `n` is set, else today's rule (FR-008).
- **Rationale**: The quote id is a 32-bit FNV-1a hash, so bit 16 splits quotes about half and
  half, nearly independently of `n % 11`; no date goes into the choice, so a quote keeps its
  picture for all of Advent.
- **Alternatives**: Adding the seasonal monkey to the regular pool (rejected: 1 in 12, too rare);
  choosing by date (rejected: the picture would change daily for the same quote).

## R5. Keeping seasonal pictures out of the regular rotation

- **Decision**: Seasonal monkeys are entries in `art/quotes/monkeys.json` with `"seasonal": true`.
  `pnpm badge-build` writes two lists into `src/http/quote-monkeys.ts`: `QUOTE_MONKEYS` (regular,
  as today) and `SEASONAL_MONKEYS` (seasonal with a finished picture). The prompt validator
  (`scripts/quote-prompts.mjs`) accepts the flag.
- **Rationale**: One pipeline, one prompt, one palette (FR-001); the generated list is what tells
  the page a picture exists (FR-010).
- **Check**: a unit test holds every team holiday's monkey against the seasonal entries of
  `monkeys.json`, so a typo fails CI instead of silently showing regular monkeys.

## R6. Pictures

- **Decision**: Ids `advent`, `nikolaus`, `christmas`, `new-year`; scenes written into
  `monkeys.json` with `{{kit}}` and the props of spec FR-001, plus "no religious symbols" for
  Advent and Nikolaus (FR-002) and "no year or digits" for New Year. Made with `pnpm badge-art`,
  traced with `pnpm badge-build`, checked by eye with the README's checklist.
- **Rationale**: Same look as the eleven regular monkeys and the badges.

## R7. Checking before the window

- **Decision**: Fake mode's clock (`/_dev/`, feature 021) already pretends any day; the page reads
  `today` from it, so FR-014 needs no new tooling.

## R8. Release timing

- **Decision**: The PR goes into `develop`; the release PR into `main` must be merged by about
  27 November 2026 (SC-001). The code and the pictures can be merged separately: the code alone
  changes nothing (FR-010), so it can go first.
