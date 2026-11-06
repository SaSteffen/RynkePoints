# Data Model: Ride Stats Leaderboard

## Stored

### `rider_summaries.rides` (new column, migration 0026)

The column is JSON text, `NOT NULL DEFAULT '[]'`. It holds `RideEntry[]`, where `RideEntry` is
`[date, distanceM, elevationDm]`: one entry per counting ride.

| Field | Type | Rule |
| --- | --- | --- |
| `date` | `"YYYY-MM-DD"` | The ride's local start date (FR-003) |
| `distanceM` | number | The activity's full `distance_m`, not cut down (FR-002) |
| `elevationDm` | integer | The result's full elevation in dm; 0 when unknown |

- Entries are sorted by date, then distance, then elevation, so the same rides always give the same text and
  an unchanged evaluation writes nothing (030 research R3).
- The column is derived data, never edited by hand. It holds no ride ID, name, time or route.
- It is deleted with the rider by the existing cascade.
- `RIDER_SUMMARY_VERSION` goes 2 → 3, and `RIDE_SUMMARY_SINCE = 3`. A row below 3 counts as missing for
  ride readers only.
- `RiderSummary` gains `rides`, and `riderWrites` compares it like the other columns.

### `consent_records.revision` (new column, migration 0026)

The column is `INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0)`. It records the minor revision of `version`
the rider accepted. Records from before the migration, and any inserted by the previous code, read as 0. The
primary key stays `(athlete_id, version)`.

## In code

### `ConsentVersion` (src/consent.ts)

The type gains `revisions: readonly ConsentRevision[]`, which is empty for versions 1 and 2.

```text
ConsentRevision { revision: number ≥ 1, consecutive; published: "YYYY-MM-DD"; changes: MessageId[] }
```

- Version 3 gets `[{ revision: 1, published: <release day>, changes: ["consent.rideFigures"] }]`.
- `currentRevision(versions)` returns `{ version, revision }`, with revision 0 when the list is empty.
- `consentLabel({ version, revision })` gives `"3.1"`, or `"3"` for revision 0.
- `consentState` compares `version` only. Its `changes` for an older rider add the changes of every revision
  of every newer version.
- `Consent` (`src/db/consents.ts`) gains `revision`, and `recordConsent` takes it.
- Validation: revisions are consecutive from 1, and a revision never adds a required scope. A test enforces
  the constitution 2.4.0 rule that a new scope is a major change.

### Visibility (src/visibility.ts)

| `RiderData` | Audience | Since |
| --- | --- | --- |
| `rideFigures` | organiser, rider (anonymous rows, team line, team chart) | 3 |
| `rideFiguresByName` | organiser (riders table, Sessions graph) | 3 |

### Settings (src/config.ts)

| Setting | Values | Founding team | Fake mode |
| --- | --- | --- | --- |
| `RIDE_FIGURES` | `"on"` or `"off"` | on | on |
| `RYNKE_VIEWS` | `"on"` or `"off"` | on | on (one test config off) |

### Ride figures (src/rynke/ride-figures.ts, pure)

```text
RideFigure  = "sessions" | "km" | "elevation"
RankBy      = "rynke" | RideFigure
Period      = "season" | "month" | "week"
DateRange   { from: "YYYY-MM-DD"; to: "YYYY-MM-DD" }      // cut to the counting window
Figures     { sessions: number; distanceM: number; elevationDm: number; typicalM: number | null }
RideRider   { athleteId: number; rides: readonly RideEntry[] }
RideRow     { you; place; joint; sessions; km; elevationM }  // km and m are the shown values
RideViewer  { place; joint; count; toNext: number | null; lead; figures: Figures }
TeamRideTotals { figures: Figures; weeks: TeamWeek[] /* km */; bestWeek; thisWeek }
```

- `RideRow` carries no ID or name (016 FR-010, FR-019).
- `typicalM` is the median of the period's ride distances: the middle value, or the mean of the two middle
  values for an even count, and null with no ride (FR-009).
- The team's `Figures` cover every ranked rider's rides, with the median taken over all of their rides
  together.
- Shown values: `km = round(distanceM / 100) / 10` and `elevationM = round(elevationDm / 10)`. Places and
  `toNext` use them (FR-005).

### Organiser graph data (extends 029 data-model)

- `GraphDay` becomes `[dayIndex, outdoorM, virtualM, elevationDm, sessions]`.
- `teamSum` gains `sessions: number[]`.
- `GraphRow` gains `rides: RideEntry[]`, read from version 3 rows or added up.

## State and lifecycle

- A ride starts counting, stops counting, or is edited or deleted: the next evaluation rewrites `rides`.
  Readers see it at once.
- A rider leaves or is deleted: they are no longer listed, so they are in no read (FR-009 of 030). The
  cascade removes the row.
- A rider renews from version 2 to 3.1: from that response on, the rider-figure reads include them.
