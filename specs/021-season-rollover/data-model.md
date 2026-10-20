# Data Model: Season Rollover

**Feature**: [spec.md](spec.md) · **Research**: [research.md](research.md)

## Stored data (D1)

One migration, additive (CLAUDE.md: the previous release keeps working).

```sql
-- migrations/0018_tour_de_paris.sql
INSERT INTO team_event_kinds (kind) VALUES ('tour_de_paris');
```

No other table changes. A tour day is a `team_events` row with
`kind = 'tour_de_paris'`, a date and an optional name (the stage, e.g. "Hamburg –
Bremen"); its attendances and participation reports (feature 019) are the
existing tables. Deleting a tour day deletes its attendances and reports as for
any event (feature 003 FR-006a, feature 019 FR-022).

Nothing about albums is stored: no table, no row, no file in Cloudflare.

## Event kinds (`src/rynke/team-events.ts`)

| Kind | In `TEAM_EVENT_KINDS` (earns Rynke) | In `EVENT_KINDS` | Counted from | Counted until |
|------|-----|-----|------|------|
| `team_training` | yes | yes | season start | qualification deadline |
| `training_weekend_day` | yes | yes | season start | qualification deadline |
| `technique_training` | yes | yes | season start | qualification deadline |
| `tour_de_paris` | **no** | yes | season start | season end |

- `seasonEnd(window)`: the day before the season start's anniversary
  (2026-09-01 → 2027-08-31).
- `eventInWindow(kind, date, window)`: the rule in the table; badge callers pass
  a window already capped at today (`badgeWindow`).
- `RynkeRules.teamEvents` stays keyed by `TEAM_EVENT_KINDS`: no amount exists for
  the tour (FR-002), and `rulesFingerprint` and the rules version do not change.

## Badge catalog (`src/badges/catalog.ts`, `art/badges/badges.json`)

| Field | Value |
|-------|-------|
| Category id | `tour_de_paris` |
| Group | `team` |
| Unit | `days` |
| Ladder | `[1, 2, 3, 4, 5, 6, 7, 8]` |
| Badge ids | `tour-de-paris-1` … `tour-de-paris-8` |
| Position | after `attendances`, before `team_surprise` |
| Picture | none in `BADGE_PICTURES`: the team placeholder until Phase 2 |
| Names | `badges.de.ts`: "Tour-Tag 1" … "Tour-Tag 8" (stand-in, German only) |
| Description | message `badges.tourDay.for` with `{day}` (stand-in, de and en) |

`BADGE_CATALOG_VERSION` 5 → 6 (personal `team_events` counts tour days; riders'
stored badges are worked out again silently, feature 013 FR-012, FR-031).
`art/badges/badges.json` gets the 8 entries with a placeholder `scene` until
Phase 2, kept equal to the catalog by `badge-catalog.test.ts`.

## Tour badge inputs (`src/badges/team.ts`)

```ts
interface TourDay {
  /** Only tells riders apart inside the pure function (FR-012). */
  athleteId: number;
  /** The tour day's date, YYYY-MM-DD. */
  date: string;
}

interface TeamBadgeSums {
  // … existing fields …
  /** One per listed rider's attendance at a tour day. */
  tourDays: readonly TourDay[];
}
```

`TeamEventSum` (team badges) gains `kind` so `big_training` and `attendances`
filter with `eventInWindow`.

Series for `tour_de_paris`: sort by date; per date, each rider's running count of
tour days; the series value on that date is the largest running count so far.
Badge n is earned on the first date the value reaches n; the value never exceeds
8 in the progress ("Noch n Tage" = next threshold − value).

## Album model (`album/`)

Built per rider on each request to the local album Worker, never stored.

```ts
interface AlbumData {
  season: { start: string; end: string; label: string };   // "2026/27"
  cutoff: string;                                          // YYYY-MM-DD
  locale: "de" | "en";                                     // the rider's app language
  rider: {
    athleteId: number;
    firstName: string;
    trainingRynke: number;
    teamRynke: number;
    eventsAttended: number;
  };
  team: {
    trainingRynke: number;                                 // feature 016 team total
    events: AlbumEvent[];                                  // the season's events, by date
  };
  slots: AlbumSlot[];                                      // one per catalog badge, gallery order
}

interface AlbumEvent {
  date: string;
  kind: EventKind;
  name: string | null;
  attendees: number;                                       // listed riders, no names
  attendedByRider: boolean;
}

interface AlbumSlot {
  badgeId: BadgeId;
  group: "personal" | "team";
  category: BadgeCategoryId;
  earnedOn: string | null;                                 // null: empty slot
  surprise: boolean;                                       // "?" when empty
}
```

Layout (`album/layout.ts`, pure, in mm; details in
[contracts/album-layout.md](contracts/album-layout.md)):

```ts
interface AlbumPage {
  number: number;                    // 1-based; odd = right-hand page
  kind: "cover" | "team" | "events" | "stickers" | "blank";
  safe: { x: number; y: number; width: number; height: number };
  headings: { category: BadgeCategoryId; continued: boolean; y: number }[];
  slots: { slot: AlbumSlot; x: number; y: number; pose: StickerPose | null }[];
}

interface StickerPose {
  rotateDeg: number;                 // -6 … 6
  dxMm: number;                      // -3 … 3
  dyMm: number;                      // -3 … 3
}
```

Validation rules (unit-tested):

- every catalog badge appears in exactly one slot, in gallery order (FR-035);
- every slot, heading and sticker (with pose and shadow) lies in its page's safe
  area, gutter on the inner side (FR-051);
- the page count is even (FR-053); no heading is the last element of a page;
- `pose(athleteId, badgeId)` is the same on every run (FR-026) and differs
  between neighbouring slots;
- a slot has a pose only when `earnedOn` is set and `earnedOn <= cutoff`.

## Files on the maintainer's computer

```text
season-albums/            # git-ignored (R15)
└── 2026-27/
    ├── anna-1.pdf
    ├── ben-1.pdf
    └── …
```

File names: the first name lower-cased and transliterated to ASCII, plus a
number that only tells same names apart; no surname, no Strava id.
