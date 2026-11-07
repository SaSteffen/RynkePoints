# Contract: Phrases and Badge Names

## The rule (FR-025, FR-052)

| Team setting | Monkey phrases | Badge names |
|---|---|---|
| `kind: "own"` | the team's own set, in its locale, whatever language the rider picked | the team's own names, in every language |
| `kind: "common"` | the common set in the rider's language | `badge.name.<id>` from the rider's catalog |

Hamburg: own phrases (`de`), own badge names (`de`), both unchanged from today.
Europe: common phrases, common badge names.

An own set is never readable through another team's site: only the team whose data
names it renders it. A check fails if one team's own set is referenced from another
team's data.

## Lookups

- `phraseSet(team, locale): PhraseSet`
- `badgeName(team, i18n, id): string`

These are the only entry points. The Team section, the badges section, the PWA badge
notification and the season album call them. No module outside `src/content/` and
`src/teams/` imports a phrase or badge-name file.

## Common phrase lists (per locale, same lengths in every locale)

| List | Count |
|---|---|
| `push` | ~26 |
| `onTrack` | ~6 |
| `seasonPush[spring|summer|autumn|winter]` | ≥ 1 each |
| `seasonOnTrack[spring|summer|autumn|winter]` | ≥ 1 each |

Total about 40. Tone: light, mostly neutral. No team, place, charity, rider name, rank or
comparison. A phrase may be adapted per language; the list position is what keeps the
languages in step (index *i* in `common.fr.ts` adapts index *i* in `common.en.ts`).

## Checks

1. Every common locale file has the same list lengths as `common.en.ts`.
2. No duplicates within a list; no phrase longer than the longest Hamburg phrase.
3. The existing quote rules (no names, ranking or comparing words) run over every set.
4. Common sets contain no team names or place names from a deny list (`Hamburg`,
   `Rynkeby`, `Paris`, team names in `TEAMS`).
5. A founding-team page rendered in every locale shows only phrases from
   `hamburg.de.ts`; a Europe page in locale X shows only phrases from `common.X.ts`.
