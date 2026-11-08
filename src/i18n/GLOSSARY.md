# Translation glossary

For the catalogs in `messages/` (feature 026 research R16). English (`en.ts`) is the
reference wording: every other catalog is translated from it, and where a translation
differs, the English text counts (constitution, Language). German (`de.ts`) is the key
source. No native speaker has reviewed the translations; corrections are welcome as pull
requests.

## Terms that stay as they are

| Term | Why |
|---|---|
| RynkePoints | The app's name |
| Rynke (one and many) | The points, named after the team's mascot; never translated, never inflected with a plural ending |
| Training Rynke, Team Rynke | The two kinds of Rynke. Keep "Rynke" and translate only "Training"/"Team" where the language has its own word, e.g. `Trænings-Rynke`, `Rynke d'entraînement`. Keep one form per language throughout |
| Breakaway | Cycling jargon, as in German |
| Rider | In German kept as jargon; other languages use their own word for a cyclist on the team |
| Orga | The organisers' tab, short like the other tabs |
| Tour de Paris | The tour's name |
| Strava, "Connect with Strava", "Powered by Strava", "View on Strava" | Strava's own wording. The alt text of the "Connect with Strava" button follows the language; "Powered by Strava" and "View on Strava" stay English in every catalog (feature 008 FR-009, tests) |
| Theme names Rynke Day, Rynke Night, Paris, Disco | Names; translate the others (Baltic, Lilac, Forest …) |

## Address and tone

- Informal address in every language, as in German: `du` (da, nb, sv, is), `sinä` (fi),
  `tu` (fr), `jij`/`je` (nl), `tu` (lt).
- Short, plain sentences; the same tone as the English text. No exclamation marks beyond
  the English ones.
- Keep emoji, `{placeholders}`, the non-breaking spaces (` `) between a number and its
  unit, and the typographic quotes the language uses.

## Counts and plurals

- Messages with a plural object (`one`, `few`, `many`, `other` …) list exactly the plural
  categories of the language (`Intl.PluralRules`): Danish, Norwegian, Swedish, Finnish,
  Dutch, German and English `one`/`other`; Icelandic `one`/`other`; French
  `one`/`many`/`other`; Lithuanian `one`/`few`/`many`/`other`.
- In every form, write `{n}`: in French and Lithuanian `one` also covers other numbers
  than 1.
- For count messages that are plain strings, prefer wording that doesn't inflect with the
  number, e.g. a label and the number (`Rides: {n}`), where the language would otherwise
  need a form per number.

## Per language

| Locale | Native name | Notes |
|---|---|---|
| da | Dansk | `Trænings-Rynke`, `Team-Rynke` |
| nb | Norsk bokmål | `Trenings-Rynke`, `Team-Rynke`; `no` and `nn` browsers get this catalog |
| sv | Svenska | `Tränings-Rynke`, `Team-Rynke` |
| fi | Suomi | `Harjoitus-Rynke`, `Tiimi-Rynke`; Rynke takes case endings with a colon: `Rynke:t`, `Rynke:ä` |
| is | Íslenska | `Æfinga-Rynke`, `Liðs-Rynke`; numbers and dates formatted as `da-DK`, since the Workers runtime has no Icelandic formats (plural rules are Icelandic) |
| fr | Français | `Rynke d'entraînement`, `Rynke d'équipe`; space before `:` `?` `!` as French typography wants (non-breaking) |
| nl | Nederlands | `Trainings-Rynke`, `Team-Rynke` |
| lt | Lietuvių | `Treniruočių Rynke`, `Komandos Rynke` |
