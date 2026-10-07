# Data Model: Rider Progress Charts

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## Stored data

There is **no migration** and no new column. The feature reads only what features
001 and 003 store (research R1):

| Table | Columns read | Why |
|---|---|---|
| `ride_results` | `distance_rynke`, `elevation_dm`, `is_virtual` where `counts = 1` | Training Rynke from rides, elevation steps, the curve without virtual rides |
| `activities` | `start_date_local` (its date only) | the day a ride belongs to |
| `attendances` ⟕ `team_events` | `kind`, `event_date` (already read by 005) | Team and Training Rynke from events |
| `rynke_balances` | the stored balance (already read by 005) | the last point and the rules version |

Code values that are read but not stored: `rulesForVersion(balance.rulesVersion)`
and `SEASON_START_DATE`.

Not read: distance in metres, elevation in metres per ride, times, sport type,
names, private flag. The new statement selects no column that FR-005 forbids
showing, so the forbidden figures cannot reach the chart data.

### New statement, in `readRiderView`'s batch (FR-041)

```sql
SELECT substr(a.start_date_local, 1, 10) AS day,
	r.distance_rynke, r.elevation_dm, r.is_virtual
FROM ride_results r
JOIN activities a
	ON a.athlete_id = r.athlete_id AND a.strava_activity_id = r.strava_activity_id
WHERE r.athlete_id = ?1 AND r.counts = 1
```

It joins the four statements 005 already sends in one `db.batch`, so balance,
results and attendance come from one snapshot. `RiderViewRead` gains
`countingRides: CountingRide[]`.

## In-memory types

### `CountingRide` (`db/rider-view.ts`)

| Field | Type | From |
|---|---|---|
| `date` | `YYYY-MM-DD` | `day` |
| `distanceRynke` | integer ≥ 0 | `distance_rynke` |
| `elevationDm` | integer ≥ 0 | `elevation_dm` |
| `isVirtual` | boolean | `is_virtual` |

### `ridingTotals(results, rules)` (`rynke/rides.ts`, exported)

`evaluateRides`' existing summing, now exported and used by both. Its input is
`Pick<RideResult, "distanceRynke" | "elevationDm" | "isVirtual">[]`, and all
inputs count. It returns `RidingTotals` (with `withoutVirtual`) unchanged.

### `DayTotals` and `seasonCurve` (`rynke/curve.ts`, new, pure)

```ts
interface DayTotals {
	date: string;               // YYYY-MM-DD
	training: number;           // tally(...).trainingRynke
	team: number;               // tally(...).teamRynke
	trainingWithoutVirtual: number;
}

seasonCurve(
	rides: readonly CountingRide[],
	attendance: readonly Attendance[],
	rules: RynkeRules,
	window: CountingWindow,
	lastDay: string,
): DayTotals[]   // one per day, window.seasonStart … lastDay
```

Rules:
- Day `d` = `tally(ridingTotals(rides dated ≤ d), extrasFromAttendance(
  evaluateAttendance(attendance dated ≤ d, rules, window)), rules)`. Items dated
  after `lastDay` count as dated `lastDay` (research R2).
- There is no clock and no I/O. `lastDay ≥ seasonStart` is asserted.
- Invariant: the last entry's three values equal the balance `tally` computes from
  all inputs, which is the stored balance (SC-002). `buildProgressView` checks
  this (research R3).
- From feature 003 Story 6, corrections join the extras the same way, dated by
  their date. This feature doesn't add them.

### `Period` (`http/progress-view.ts`)

| Field | Type | Rule |
|---|---|---|
| `from`, `to` | `YYYY-MM-DD` | `axisStart ≤ from`, `to ≤ axisEnd`, `to − from ≥ 6` days |
| `preset` | `"season" \| "3m" \| "4w" \| null` | `null` for a free zoom |

`parsePeriod(url, axis, lastDay)`:
- `period=3m` and `period=4w` → research R8 bounds;
- `from` and `to` → clamped;
- anything else → `season`.

### `ProgressView` (`http/progress-view.ts`, pure, built with `buildProgressView`)

```ts
type ProgressView =
	| { state: "none" }   // no balance (FR-016), unknown rules version or mismatch (R3)
	| {
			state: "ready";
			rulesVersion: number;
			axis: { start: string; end: string };  // FR-013; end ≥ start + 6
			lastDay: string;                       // research R2
			period: Period;
			presets: ("season" | "3m" | "4w")[];   // only those shorter than the axis
			days: DayTotals[];                     // seasonStart … lastDay
			thresholds: { training: number; team: number };
			yMax: { training: number; team: number };    // research R5
			nothingYet: boolean;                         // FR-015
			weeks: WeekRow[];                            // FR-051
			// User Story 2:
			pace: { deadline: string; totalDays: number } | null;  // FR-038
			withoutVirtual: { needed: number } | null;             // FR-039
	  };

interface WeekRow {
	start: string;            // Monday, or the season start
	end: string;              // Sunday, or lastDay
	training: number;         // earned in the week
	trainingTotal: number;
	team: number;
	teamTotal: number;
	withoutVirtualTotal: number | null;   // User Story 2, when FR-039 applies
}
```

| Derived value | How |
|---|---|
| `axis.end` | the deadline if one is set, else `lastDay`; at least `start + 6` days |
| `lastDay` | `max(seasonStart, min(today, deadline ?? today))`, where today is `berlinDate(now)` |
| Pace on day `i` | day `i` counted from 1, with `totalDays` days from the season start to the deadline inclusive: `floor(threshold × i ÷ totalDays)`. US2 scenario 1: `floor(250 × 34 ÷ 273) = 31`. |
| `withoutVirtual` | not `null` when `readRiderView`'s `virtualCount > 0` (005 FR-012); `needed = virtualShareRequired(rules)` |
| `nothingYet` | the stored balance is 0 for both Training and Team Rynke |

### Chart data (JSON in the page)

The shape is in [contracts/rider-page.md](contracts/rider-page.md#chart-data). It
holds the series as integer arrays indexed by day from the season start, the axis,
the period, the lines, `intlLocale` and the translated texts. It contains nothing
else.

## Lifecycle and deletion

Nothing is stored, so nothing new needs deleting. When a rider leaves, deleting
their results, activities and attendance (features 001, 003) removes everything
a curve is built from.
