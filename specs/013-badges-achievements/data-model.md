# Data Model: Badges and Achievements

Part A (art pipeline) is files in the repo; part B (the app) adds D1 tables and
pure in-memory structures; part C (the 2026-10-12 categories) adds the `swims`
table and extends the catalog, evaluation and view. See [plan.md](plan.md).

# Part A: art pipeline (files)

## Badge art entry (`art/badges/badges.json` → `badges[]`)

| Field | Type | Rules |
|-------|------|-------|
| `id` | string | Unique, `^[a-z0-9]+(-[a-z0-9]+)*$`. File name of the original and the finished SVG. |
| `group` | `"personal"` \| `"team"` | Picks the frame and the reference image. |
| `category` | string | One of the spec's categories (FR-010, FR-011), snake case. |
| `threshold` | number > 0 | The ladder step from the spec's Assumptions; strictly increasing within a category. |
| `scene` | string | Non-empty. May use `{{name}}` for snippets; every name must exist. No `{{scene}}`. |

Validation (`scripts/badge-prompts.mjs`, tested): unique ids, valid id format,
known group, thresholds increasing per category, every category in one group
only, every snippet reference resolves.

## Snippet (`badges.json` → `snippets`)

A named, shared description (`bike`, `runner`, `team`, `coins`) that scenes
pull in with `{{name}}`. Plain text, no placeholders of its own.

## Prompt template (`art/badges/prompt.txt`)

Plain text with exactly one `{{scene}}`. A badge's prompt is the template with
`{{scene}}` replaced by its scene, snippets already filled in. Each prompt is
self-contained (no reference to other prompts).

## Frame (`scripts/badge-frame.mjs`)

| Kind | Edge | Ring | Stars | Window |
|------|------|------|-------|--------|
| personal | 22 sunflower petals per layer: amber `#f0b400` back layer (gold veins), yellow `#fbe122` front layer (amber veins), ink outlines; tips at r 48.3 and 46.4 | ink `#1c1b13`, r 36.6 | 3 yellow, middle of the ring, at −26°, 0°, 26° | cream `#fffdf5`, r 28.7 at (50, 50), ink outline |
| team | same | team blue `#8cc4f0`, ink outline | same | same |

Ribbon (optional, FR-040b): a band at x 13 to 87, y 70 to 84, with notched tails
out to x 3 and 97, in the ring colour with ink outlines, over the bottom 15 % of
the window. No text; the page writes the milestone into the band.

ViewBox `0 0 100 100`. The window clips the picture. Radii measured from
`art/badges/reference/` (T009); the picture transform (research R4) follows the
window radius.

## Picture

The traced Gemini image: layers of flat paths in the coin palette over the full
2048 px canvas, 100 units wide (R4, R5). Placed into the window with the fixed
transform of R4.

## Original (`art/badges/originals/<id>.png`)

States: missing → downloaded (raw, local only) → snapped (committed, indexed PNG,
7 colours, ≤ 2048 px). A retake replaces it.

## Finished badge (`public/badges/<id>.svg`)

Frame plus picture, self-contained, explicit colours, `<title>` with the id
(the app's `alt` text carries the localized name). Exists exactly when the
original exists.

## Placeholder (`public/badges/placeholder-{personal,team}.svg`)

Frame plus the coin's Rynke; identical to the reference images in
`art/badges/reference/`.

## Picture list (`src/badges/pictures.ts`, generated)

`BADGE_PICTURES: ReadonlySet<string>`: the ids with a finished badge, sorted.
Rewritten by every `pnpm badge-build`; committed.

# Part B: the app

## D1 (`migrations/0013_badges.sql`, adds only)

Every table cascades from `riders`, so a rider who leaves takes all of it along
(Principle I). The previous release never reads them.

### `runs` (research R10, R11)

| Column | Type | Rules |
|--------|------|-------|
| `strava_activity_id` | INTEGER PK | Strava's activity id |
| `athlete_id` | INTEGER NOT NULL | → `riders`, ON DELETE CASCADE |
| `start_date` | TEXT NOT NULL | ISO UTC, as Strava sends it |
| `start_date_local` | TEXT NOT NULL | ISO local; its first 10 characters are the run's date |
| `distance_m` | REAL NOT NULL | `>= 0` |
| `is_private` | INTEGER NOT NULL | 0 or 1; private runs go when private access is withdrawn |
| `refreshed_at` | INTEGER NOT NULL | Unix seconds of the last read |

Index `runs_by_rider (athlete_id, start_date_local)`. Only outdoor, non-manual
`Run` and `TrailRun` activities get a row; nothing else Strava sends about a
run is kept.

### `rider_badges` (research R13)

| Column | Type | Rules |
|--------|------|-------|
| `athlete_id` | INTEGER NOT NULL | → `riders`, ON DELETE CASCADE |
| `badge_id` | TEXT NOT NULL | a personal badge id of the catalog |
| `earned_on` | TEXT NOT NULL | `YYYY-MM-DD`, the rider's local date (R14) |

PK `(athlete_id, badge_id)`. Exactly the personal badges the last evaluation
found; written as a diff in the evaluation batch.

### `badge_reveals` (research R16)

| Column | Type | Rules |
|--------|------|-------|
| `athlete_id` | INTEGER NOT NULL | → `riders`, ON DELETE CASCADE |
| `badge_id` | TEXT NOT NULL | personal or team badge id |
| `earned_on` | TEXT NOT NULL | the badge's date when it was revealed |

PK `(athlete_id, badge_id)`. A badge is new for the rider when it is earned and
has no row, or a row with an earlier `earned_on`. Written by a GET of the
Overview, or in the evaluation batch for silent awards.

### `badge_rises` (research R17)

| Column | Type | Rules |
|--------|------|-------|
| `athlete_id` | INTEGER PK | → `riders`, ON DELETE CASCADE |
| `badge_ids` | TEXT NOT NULL | JSON array of the badge ids new in that evaluation, catalog order |
| `risen_at` | INTEGER NOT NULL | Unix seconds |

One row per rider, overwritten by every evaluation with new personal badges
that notifies.

### `riders.badges_version` (research R18)

INTEGER NOT NULL DEFAULT 0. The `BADGE_CATALOG_VERSION` the rider's
`rider_badges` were worked out with; 0 marks every existing rider for one
silent evaluation by the daily cron.

## Catalog (`src/badges/catalog.ts`)

- **Category**: `id` (snake case, as in `badges.json`), `group` (`personal` |
  `team`), `unit` (`km` | `m` | `rynke` | `events` | `trainings` | `riders` |
  `attendances`), `value` (which figure, R14/R15), `ladder` (thresholds,
  strictly increasing). 13 categories, ladders as in the spec's Assumptions.
- **Badge**: `id` = `<category with dashes>-<threshold>`, except run length's
  `run-length-half` (21.0975 km) and `run-length-marathon` (42.195 km); `group`
  and `category` from its category; `threshold`. 69 badges, the same ids as
  `art/badges/badges.json` (T019 test).
- `BADGE_CATALOG_VERSION`: integer, raised with any ladder change.

## Evaluation (pure, in memory)

- **PersonalInputs**: the rider's counting ride results with local date,
  distance and elevation; runs with local date and distance; attendance with
  event kind and date; corrections with date; the counting window and rules.
- **TeamSums**: per day, over listed riders: counting ride distance and
  elevation, Training Rynke inputs, run distance; per team event: date and the
  number of listed attendees.
- **CategoryProgress**: `category`, `value` (in its unit), `next` (the next
  threshold or none), `missing` (`next - value`, never shown as 0, spec
  Assumptions).
- **EarnedBadge**: `badgeId`, `earnedOn`.

## View model (`src/badges/view.ts`)

- **Card**: category, its highest earned badge (`EarnedBadge`), progress (or
  none when complete, FR-004). Sorted by `earnedOn`, newest first.
- **GalleryGroup**: category with every earned badge, newest first.
- **NotYetRow**: category without an earned badge, with its progress.
- **Section**: `personal` and `team` (cards, gallery groups, counts), `notYet`
  (both groups), `reveal` (badges new for this rider, R16), or nothing while the
  waiting state shows (FR-005).

# Part C: more categories (2026-10-12)

## D1 (`migrations/0015_swims.sql`, adds only)

### `swims` (research R26)

The same columns, rules and index as `runs`:

| Column | Type | Rules |
|--------|------|-------|
| `strava_activity_id` | INTEGER PK | Strava's activity id |
| `athlete_id` | INTEGER NOT NULL | → `riders`, ON DELETE CASCADE |
| `start_date` | TEXT NOT NULL | ISO UTC, as Strava sends it |
| `start_date_local` | TEXT NOT NULL | ISO local; its first 10 characters are the swim's date |
| `distance_m` | REAL NOT NULL | `>= 0` |
| `is_private` | INTEGER NOT NULL | 0 or 1; private swims go when private access is withdrawn |
| `refreshed_at` | INTEGER NOT NULL | Unix seconds of the last read |

Index `swims_by_rider (athlete_id, start_date_local)`. Only non-manual `Swim`
activities get a row, pool and open water alike; nothing else Strava sends
about a swim is kept. No other table changes.

## Catalog (`src/badges/catalog.ts`, version 2)

New categories after `running`, before the team ones (research R28):

| Category | Unit | Ladder | Ids |
|----------|------|--------|-----|
| `ride_length` | km | 50, 100, 150, 200, 250, 300 | `ride-length-<km>` |
| `virtual_rides` | km | 50, 100, 250, 500, 1000 | `virtual-rides-<km>` |
| `swim_length` | km | 0.5, 1, 1.9, 3.8 | `swim-length-500`, `-1000`, `-1900`, `-3800` (metres) |
| `swimming` | km | 5, 10, 25, 50, 100 | `swimming-<km>` |
| `winter_november` … `winter_february` | days | 1, 5, 10 | `winter-<month>-<days>` |

- New unit `days`. Winter categories carry their `month` (11, 12, 1, 2).
- 21 categories (15 personal, 6 team), 101 badges, the same as
  `art/badges/badges.json`.
- One-decimal categories: `run_length`, `swim_length`, `swimming`.
- `BADGE_CATALOG_VERSION = 2`; `ACTIVITY_FIGURES_VERSION = 5` (R27).

## Evaluation (pure, in memory)

- **CountingRide** gains `virtual` (003 FR-013a, from the evaluation result).
- **PersonalInputs** gains `swims` (`DatedSwim`: local date, distance), like
  `runs`.
- New series:
  - `ride_length`: the longest counting ride so far, by date (like
    `run_length`);
  - `virtual_rides`: cumulative km of counting rides with `virtual`;
  - `swim_length`: the longest swim so far; `swimming`: cumulative swim km;
  - `winter_<month>`: cumulative count of distinct dates in that month with at
    least one counting ride without `virtual`.
- **RiderState** (`rynke/apply.ts`) gains `swims` by activity id; the `upsert`
  change gains `swims?: SwimRecord[]`. Swims never set `figuresChanged`.

## View model

- `buildBadgeSection` gains `today` (`YYYY-MM-DD`, Berlin) and the counting
  window: a winter category whose season month ended before `today` gets no
  progress (no bar on its card, no not-yet bar; an outline card stays)
  (FR-004a, R25).
- **PersonalFigures** gains `longestRideM`, `virtualDistanceM`,
  `winterDays` (month → distinct days), `longestSwimM`, `swimDistanceM` (R29).

