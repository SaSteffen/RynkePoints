# Data Model: Seasonal Quote Monkeys (Next Sets)

The types are feature 035's (`Holiday`, `DayRef` in `src/http/holidays.ts`); this feature adds
values only.

## Hamburg's holidays (`src/teams/hamburg.ts`)

| id | monkey | from | to | kind |
|---|---|---|---|---|
| `karneval` | `karneval` | `{ anchor: "easter", offset: -52 }` | `{ anchor: "easter", offset: -46 }` | short |
| `easter` | `easter` | `{ anchor: "easter", offset: -2 }` | `{ anchor: "easter", offset: 1 }` | short |
| `midsummer` | `midsummer` | `"06-20"` | `"06-24"` | short |
| `halloween` | `halloween` | `"10-29"` | `"10-31"` | short |
| `advent` | `advent` | `{ anchor: "first-advent", offset: 0 }` | `"12-23"` | long |
| `nikolaus` | `nikolaus` | `"12-06"` | `"12-06"` | short |
| `christmas` | `christmas` | `"12-24"` | `"12-26"` | short |
| `new-year` | `new-year` | `"12-31"` | `"01-01"` | short |

The last four are feature 035's, unchanged.

## Team Europe's holidays (`src/teams/europe.ts`)

| id | monkey | from | to | kind |
|---|---|---|---|---|
| `carnival` | `karneval` | `{ anchor: "easter", offset: -52 }` | `{ anchor: "easter", offset: -46 }` | short |
| `easter` | `easter` | `{ anchor: "easter", offset: -2 }` | `{ anchor: "easter", offset: 1 }` | short |
| `europe-day` | `europe-day` | `"05-09"` | `"05-09"` | short |
| `midsummer` | `midsummer` | `"06-20"` | `"06-24"` | short |
| `halloween` | `halloween` | `"10-29"` | `"10-31"` | short |
| `advent` | `advent` | `{ anchor: "first-advent", offset: 0 }` | `"12-23"` | long |
| `christmas` | `christmas` | `"12-24"` | `"12-26"` | short |
| `new-year` | `new-year` | `"12-31"` | `"01-01"` | short |

`"holidays"` leaves Europe's `placeholders`.

## Seasonal monkeys (`art/quotes/monkeys.json`)

Five new entries `{ id, name, scene, seasonal: true }`: `karneval`, `easter`, `midsummer`,
`halloween`, `europe-day`. Scenes per contracts/seasonal-art.md; each ends in `{{kit}}` like the
December ones.
