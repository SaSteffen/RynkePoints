# Data Model: Ride Names and Links to Strava in the Ride List

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-10-07

One column is added. Every other table and column is unchanged; the full
schema is in 001's [data-model.md](../001-strava-connect-webhook/data-model.md)
and 003's for the Rynke tables.

## `activities` (feature 001), one new column

| Column | Type | Null | Meaning |
|---|---|---|---|
| `name` | `TEXT` | yes | The ride's title on Strava, exactly as Strava sent it. `NULL` means unknown: not read since this feature, or empty or blank on Strava (FR-005). |

Migration `migrations/0006_activity_name.sql`:

```sql
-- The ride's name on Strava (feature 008-strava-ride-names FR-001), shown only
-- to the rider on their own ride table. See
-- specs/008-strava-ride-names/data-model.md and research R1.
--
-- Nullable without a default: NULL means unknown, never a guessed name. Rows
-- stored before this migration start as NULL. No riders change:
-- ACTIVITY_FIGURES_VERSION going to 3 marks every rider for the one-time
-- re-read by the daily cron, which fills the names in.

ALTER TABLE activities ADD COLUMN name TEXT;
```

**Validation**: written only by `toActivityRecord` through
`upsertActivityStatement`. `undefined`, `""` and whitespace-only become `NULL`.
Any other string is stored unchanged, without trimming, shortening or
normalising.

**Lifecycle**: the name is set by every create, update or re-read of the ride. A
later reading replaces it, and a blank one clears it. It goes when the row goes:

- the ride is deleted on Strava (001 FR-016),
- a private ride drops out of what the rider allowed (001 FR-007), or
- the rider leaves or deauthorizes (001 FR-022, FR-023; 004 FR-015).

No other table copies it (FR-003).

**Who reads it**: only `RIDE_PAGE_SQL` in `src/db/rider-view.ts`, for the
session's own rider (FR-008, research R7). `COLUMNS` in `src/db/activities.ts`,
which evaluation and every other reader use, does not include it.

## `riders.figures_version` (feature 001), new meaning for value 3

No schema change. `ACTIVITY_FIGURES_VERSION` goes from 2 to 3. Riders stored at
1 or 2 are re-read once by the daily cron (research R3). Version 3 means "the
name is in the field set".

| Version | Field set gained |
|---|---|
| 1 | elapsed time, manual flag, trainer flag |
| 2 | Strava's `flagged` |
| 3 | ride name (this feature) |

## Types in code

**`StravaActivity`** (`src/strava/activity.ts`): `name?: string`. Strava sends it
on summary and detailed activities alike.

**`ActivityRecord`**: `name: string | null`.

**`RideRow`** (`src/db/rider-view.ts`, 005's reading): `name: string | null`.

**`RideLine`** (`src/http/rider-view.ts`, 005's view model):
`name: string | null`, copied from the row. `activityId` is already present; the
render builds the link from it (research R4).

## What is not stored

Rides still don't keep the description, photos, GPS tracks, heart rate, power,
gear, device or any other field (001 FR-014). The schema-minimisation test lists
`activities.name` as its second documented exception, after `riders.first_name`
(research R1).
