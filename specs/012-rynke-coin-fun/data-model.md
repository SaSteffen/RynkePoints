# Data Model: Rynke Coin Look and Fun Graphics

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## `rynke_seen` (D1, migration `0010_rynke_seen.sql`)

The Training and Team Rynke that a rider saw on their last Overview. The table
has one row per rider (FR-007).

| Column | Type | Notes |
|---|---|---|
| `athlete_id` | `INTEGER PRIMARY KEY` | references `riders (athlete_id)` `ON DELETE CASCADE` |
| `training_rynke` | `INTEGER NOT NULL` | Training Rynke total as shown |
| `team_rynke` | `INTEGER NOT NULL` | Team Rynke total as shown |

- **Written** by `GET /me` when the rider's balance is ready and the stored
  totals are missing or different. The write is an upsert (`writeSeen`).
- **Read** only by the Overview (`readSeen`).
- **Deleted** with the rider. The migration only adds a table, so the version
  deployed before it keeps working.

There is no new Strava request, scope or queue message, so the consent version
stays the same.
