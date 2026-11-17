# Data Model: December Quote Monkeys

## Holiday (`src/http/holidays.ts`)

As in feature 035, with one change:

| Field | Type | Rule |
|---|---|---|
| `id` | string | lower-case words joined by dashes; unique in the team |
| `monkeys` | `readonly string[]` | **replaces `monkey`**; at least one; each a `seasonal: true` entry of `art/quotes/monkeys.json`; no duplicates |
| `from`, `to` | `DayRef` | unchanged |
| `kind` | `"short" \| "long"` | unchanged |

`holidaysOn(today, holidays)` returns every window holding `today` with the fewest days, in list
order (research R2). The day's picture set is their `monkeys` together, built ones only (R3).

## December, both teams (`src/teams/hamburg.ts`, `src/teams/europe.ts`)

Every entry before Advent only renames `monkey: "x"` to `monkeys: ["x"]`. December becomes:

| id | monkeys | from | to | kind |
|---|---|---|---|---|
| `advent` | `advent`, `christmas-market`, `mulled-wine`, `christmas-biscuits` | `{ anchor: "first-advent", offset: 0 }` | `"12-23"` | long |
| `advent-1` | `advent-wreath-1` | `{ anchor: "first-advent", offset: 0 }` | `{ anchor: "first-advent", offset: 0 }` | short |
| `nikolaus` (Hamburg only) | `nikolaus` | `"12-06"` | `"12-06"` | short |
| `advent-2` | `advent-wreath-2` | `{ anchor: "first-advent", offset: 7 }` | `{ anchor: "first-advent", offset: 7 }` | short |
| `advent-3` | `advent-wreath-3` | `{ anchor: "first-advent", offset: 14 }` | `{ anchor: "first-advent", offset: 14 }` | short |
| `advent-4` | `advent-wreath-4` | `{ anchor: "first-advent", offset: 21 }` | `{ anchor: "first-advent", offset: 21 }` | short |
| `christmas-eve` | `christmas` | `"12-24"` | `"12-24"` | short |
| `christmas` | `christmas` | `"12-25"` | `"12-26"` | short |
| `between-the-years` | `between-the-years` | `"12-27"` | `"12-30"` | short |
| `new-year` | `new-year` | `"12-31"` | `"01-01"` | short |

Hamburg then lists 15 holidays, Team Europe 15 (no Nikolaus, but Europe Day).

## Seasonal monkeys (`art/quotes/monkeys.json`)

Eight new entries with `"seasonal": true`, scenes in contracts/seasonal-art.md:

| id | name |
|---|---|
| `christmas-market` | Weihnachtsmarkt |
| `mulled-wine` | Glühwein |
| `christmas-biscuits` | Plätzchen backen |
| `advent-wreath-1` | 1. Advent |
| `advent-wreath-2` | 2. Advent |
| `advent-wreath-3` | 3. Advent |
| `advent-wreath-4` | 4. Advent |
| `between-the-years` | Zwischen den Jahren |

The names are labels for maintainers (overview page), never shown to riders.
