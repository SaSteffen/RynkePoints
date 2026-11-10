# Data Model: Seasonal Quote Monkeys (December)

No database change. All data is static: team data and the picture list.

## Holiday (team data)

| Field | Type | Rule |
|---|---|---|
| `id` | string | lower-case words joined by dashes; unique in the team |
| `monkey` | string | id of a `seasonal: true` entry in `art/quotes/monkeys.json` |
| `from` | DayRef | first day of the window |
| `to` | DayRef | last day, inclusive; before `from` in the year → wraps over the year end |
| `kind` | `"short"` \| `"long"` | short: every quote; long: about half |

`TeamData.holidays: readonly Holiday[]` — required; may be empty.

## DayRef

- `"MM-DD"`: a fixed day, a real calendar day (29 Feb not allowed).
- `{ anchor: "first-advent" | "easter", offset: number }`: the anchor's date in the year plus
  `offset` days.

## Hamburg's December holidays

| id | monkey | from | to | kind |
|---|---|---|---|---|
| `advent` | `advent` | `{ anchor: "first-advent", offset: 0 }` | `"12-23"` | long |
| `nikolaus` | `nikolaus` | `"12-06"` | `"12-06"` | short |
| `christmas` | `christmas` | `"12-24"` | `"12-26"` | short |
| `new-year` | `new-year` | `"12-31"` | `"01-01"` | short |

Team Europe: `holidays: []`.

## Seasonal monkey (picture list)

An entry of `art/quotes/monkeys.json` like the regular ones (`id`, `name`, `scene`, optional
`holes`, `erase`) plus `"seasonal": true`. Built into `public/quotes/<id>.svg`; listed in
`SEASONAL_MONKEYS` once built, never in `QUOTE_MONKEYS`.

## Derived: the day's holiday

`holidayOn(today, holidays)` → the holiday whose window holds `today` with the fewest days, the
first listed on a tie, or null. Pure; `today` is the Berlin `YYYY-MM-DD`.
