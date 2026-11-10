# Contract: Hint Lines (`src/content/hints/`)

- `de.ts` and `en.ts`, each a typed `HintLines` object: every line id of
  [hint-phrases.md](../hint-phrases.md) with its variants as functions of the formatted values,
  plus `label` ("Tipp"/"Tip"), `more` ("Zur Karte"/"To the card"), and month names come from
  `Intl.DateTimeFormat` in the set's language.
- `hintLinesFor(i18n)`: German for `i18n.locale === "de"`, English otherwise (FR-014).
- The type makes both sets have the same lines; a missing one fails `tsc`.

## Tests (`test/unit/hint-lines.test.ts`)

- Every surprise rule with a row in "Hint windows" has at least two lines per language (FR-010).
- No surprise line contains the badge's shown name (either team's names) or a figure of its rule:
  `21:30`, `06:00`, `500`, `100 km`, `31,4`/`31.4`, `8848`/`8.848`, `7 Tage`/`7 days` (SC-005).
- No line starts with "Ich"/"I " or contains "ich"/"I'm" as the monkey speaking (FR-014).
- Placeholders: every `{…}` in a line is filled; numbers use the rider's format (German and
  English example).
