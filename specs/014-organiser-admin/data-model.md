# Data Model: Organiser Administration (Stories 1–3)

The changes are in `migrations/0011_organiser_admin.sql`. They only add a table
and columns, so the deployed version keeps working until the new code is
published.

## Changed: `team_events`

| Column | Type | Notes |
|---|---|---|
| `changed_by` | INTEGER NULL, `REFERENCES riders (athlete_id) ON DELETE SET NULL` | Organiser of the last create or update (R9). |
| `changed_at` | INTEGER NULL | Epoch seconds of that change. NULL for events entered before this feature. |

## Changed: `attendances`

| Column | Type | Notes |
|---|---|---|
| `changed_by` | INTEGER NULL, `REFERENCES riders (athlete_id) ON DELETE SET NULL` | Organiser who recorded it. A repeat tick keeps the first recorder (`ON CONFLICT DO NOTHING`). |
| `changed_at` | INTEGER NULL | Epoch seconds. |

## New: `corrections`

| Column | Type | Rule |
|---|---|---|
| `correction_id` | INTEGER PRIMARY KEY | |
| `athlete_id` | INTEGER NOT NULL, `REFERENCES riders (athlete_id) ON DELETE CASCADE` | Deleted with the rider (003 Key Entities). |
| `training` | INTEGER NOT NULL | Signed whole Training Rynke, `BETWEEN -10000 AND 10000`. |
| `team` | INTEGER NOT NULL | Signed whole Team Rynke, same bounds. |
| `reason` | TEXT NOT NULL | `length(reason) BETWEEN 1 AND 200`. |
| `correction_date` | TEXT NOT NULL | `YYYY-MM-DD` (GLOB check as `team_events`). The form defaults it to today (Berlin). |
| `changed_by` | INTEGER NULL, `REFERENCES riders (athlete_id) ON DELETE SET NULL` | Organiser who added it. |
| `changed_at` | INTEGER NOT NULL | Epoch seconds. |

Table-level rules:
- `CHECK (training <> 0 OR team <> 0)`.
- Index `corrections_by_rider (athlete_id)`.

Corrections are never updated (FR-031): a wrong one is deleted and added again.

## Evaluation (feature 003)

- `RiderState.corrections: { training: number; team: number }[]`, read by
  `readRiders` in its batch.
- `Extras.training` and `Extras.team` are the attendance sums plus the
  correction sums. `teamEvents` is unchanged. `tally` clamps the totals at 0 as
  it does today.
- `rynke_balances` is unchanged.

## View shapes (not stored)

- **Listed rider**: `{ athleteId, firstName, profileLink: boolean }`, where
  `profileLink` is true when another listed rider has the same first name
  (case-insensitive).
- **Event row**: `{ eventId, kind, date, name, attendees: number, changedBy:
  string | "former" | null, changedAt }`.
- **Change record display**: `changed_at` NULL shows nothing; `changed_by` NULL
  shows "former organiser"; otherwise the organiser's first name and the date.
