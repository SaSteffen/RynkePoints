# Contract: Locales

## Shipped locales

`de` (key source), `en` (reference wording), `da`, `nb`, `sv`, `fi`, `is`, `fr`, `nl`, `lt`.
Registry: `CATALOGS` in `src/i18n/catalogs.ts`. Adding a locale means adding
`messages/<code>.ts`, `content/phrases/common.<code>.ts` and one registry line.

Each catalog sets `meta.languageName` (native name, e.g. `Norsk bokmål`, `Lietuvių`) and
`meta.intlLocale`, the formatting locale: `da-DK`, `nb`, `sv-SE`, `fi-FI`, `fr-FR`, `nl-NL`,
`lt-LT`. The Workers runtime has no `nb-NO` and no Icelandic formats, so Norwegian uses `nb`
and Icelandic `da-DK` (the same number and date conventions). Plural rules come from the
locale code, which the runtime has for Icelandic too.

## Message values

- A string with `{param}` placeholders, as today.
- Or a plural object (data-model › Catalog), counted by the `n` param. `t(id, { n: 3 })`
  selects with `Intl.PluralRules(<locale code>)`, then fills placeholders. A plural
  message called without a numeric `n` throws, as a missing param does today.

## Checks (unit tests)

1. Every catalog has exactly the `de` keys.
2. Every message has the same placeholder names as `de`.
3. For `tHtml` messages, the same SafeHtml placeholders.
4. A message is plural in a locale iff it is plural in `de`, with exactly that locale's
   plural categories.
5. No catalog value is empty or equal to its key.

## Resolution (`resolveLocale(request, catalogs, team)`)

1. `rp_lang` cookie naming a shipped locale.
2. The highest-q Accept-Language range whose primary subtag is shipped; `no` and `nn` count
   as `nb`; ties go to the first listed.
3. Ranges present but none shipped → `team.foreignLocale`.
4. No ranges → `team.defaultLocale`.

Hamburg: `de` / `en`. Europe: `en` / `en`.

## Picker

`POST /lang` accepts any shipped locale (unchanged route, research R5). It lists every
shipped locale on every team's site by native name, alphabetically, marking the current
one. `sw.js` accepts `lang` values from the shipped list; anything else means the team's
default, which the page passes along with the language.

## Reference note

Consent (`/`, consent form, `/me/settings` consent) and privacy (`/privacy`) pages in any
locale other than `en` show `consent.referenceNote` with a link to the same page in
English (`?lang=en` sets nothing permanent; it renders that one page in English).
