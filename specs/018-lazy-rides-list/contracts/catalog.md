# Contract: Catalog Keys

**Feature**: [../spec.md](../spec.md) | **Research**: R6

New keys, in `de` (source) and `en`; the rider is addressed as "du".

| Key | de | en |
|---|---|---|
| `rynke.rides.total` | `{total} Fahrten in dieser Saison` | `{total} rides this season` |
| `rynke.rides.newest` | `Zu den neuesten Fahrten` | `To your newest rides` |
| `rynke.rides.loading` | `Ältere Fahrten werden geladen …` | `Loading older rides …` |
| `rynke.rides.failed` | `Ältere Fahrten konnten nicht geladen werden.` | `Couldn't load older rides.` |
| `rynke.rides.retry` | `Erneut versuchen` | `Try again` |
| `rynke.rides.added` | `Weitere Fahrten geladen` | `More rides loaded` |

`{total}` is formatted like the position line's numbers. `rynke.rides.total`
only shows with more than 20 rides, so it has no singular form.
