# Data Model: Dismiss Day Warnings

## Dismissal (table `usage_dismissals`, migration `0043_usage_dismissals.sql`)

| Column | Type | Rule |
|---|---|---|
| `athlete_id` | INTEGER | The administrator; references `riders (athlete_id)` `ON DELETE CASCADE` |
| `kind` | TEXT | `calls`, `recheck` or `routing` (CHECK) |
| `day` | TEXT | UTC day `YYYY-MM-DD` (CHECK by GLOB, as `strava_calls_daily`) |
| `reason` | TEXT | One reason the row showed (research R2); checked in code, no CHECK, so a reason added later needs no migration |

Primary key `(athlete_id, kind, day, reason)`, `WITHOUT ROWID`.

- **Written** by `POST /admin/dismiss` only, `INSERT OR IGNORE` (research R4).
- **Read** by the usage state for the viewer: their rows of today and yesterday.
- **Deleted** by the daily run for days before yesterday; for one rider when their role stops
  being Administrator; with the rider (research R6).
- Holds no Strava data, no count and nothing about other riders (FR-009).

## Attention item (changed, `src/usage/attention.ts`)

The three day items gain or keep a reason list:

| Kind | Before | After |
|---|---|---|
| `calls` | `day` | `day`, `reasons: ["calls"]` |
| `recheck` | `day`, `over24h`, `unordered` | adds `reasons`: `over24h` and/or `unordered` |
| `routing` | `day`, `reasons` | unchanged |

`AttentionInputs` gains `dismissed`: the viewer's dismissals, as `kind`, `day` and `reason`.

**Rule**: a day item is left out when each of its reasons has a dismissal with the same kind and
day. Figure, CPU and state-hint items are never left out (FR-002). `markCount` is unchanged and
counts what is left, so the head and the Admin tab's number follow (FR-003).

## State transitions of a day warning, for one administrator

```text
shown ──Gesehen──▶ dismissed ──new reason──▶ shown (all reasons)
  ▲                    │
  └── (never back by   └── day leaves the list / Admin taken / rider deleted ──▶ rows gone
       growth alone)
```
