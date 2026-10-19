# Data Model: Rider Progress Charts

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-10-19

Nothing is stored and there is no migration (FR-012, research R1). This file
describes:
- what the Overview additionally reads;
- the pure values built from it;
- the data the page carries for the script.

## What is read (research R3)

`readRiderView(db, athleteId, 1, { progress: true })` adds two statements to the
batch it already runs. Results come from one snapshot together with the balance,
the counts and the attendance (FR-041).

```sql
-- Daily ride sums: counting rides per local start date and virtual flag.
SELECT substr(a.start_date_local, 1, 10) AS date, r.is_virtual,
	SUM(r.distance_rynke) AS distance_rynke, SUM(r.elevation_dm) AS elevation_dm
FROM ride_results r
JOIN activities a ON a.strava_activity_id = r.strava_activity_id
WHERE r.athlete_id = ?1 AND r.counts = 1
GROUP BY 1, 2 ORDER BY 1, 2;

-- The rider's corrections.
SELECT correction_date, training, team FROM corrections
WHERE athlete_id = ?1 ORDER BY correction_date, correction_id;
```

`RiderViewRead` gains an optional field, present only when asked for:

```ts
progress?: CurveInputs;
```

The team events come from the batch's existing `attendance` rows, as
`Attendance` (`eventId`, `kind`, `date`).

`elevation_dm` is used only to place the elevation steps (spec Key Entities). It
never reaches the markup, the chart data or a log (FR-005).

## Pure values (`src/rynke/weeks.ts`)

```ts
/** A rider's counting rides of one local day, split by the virtual flag. */
interface CurveRideSum {
	date: string;            // YYYY-MM-DD
	virtual: boolean;
	distanceRynke: number;
	elevationDm: number;     // unfloored; floored once on the total (003 FR-004a)
}

interface CurveInputs {
	rides: readonly CurveRideSum[];
	attendance: readonly Attendance[];
	corrections: readonly DatedCorrection[];
}

interface CurvePoint {
	date: string;
	training: number;
	team: number;
	/** Training Rynke without virtual rides (003 FR-013a); used from US2. */
	outside: number;
}

function riderCurve(
	inputs: CurveInputs,
	window: CountingWindow,
	last: string,              // lastDay(today, deadline)
	balance: Balance,          // the stored balance; its version's rules
	rules: RynkeRules,
): CurvePoint[];
```

**What `riderCurve` returns**:
- One point per day from `window.seasonStart` to `last`, so `dayNumber(last) −
  dayNumber(seasonStart) + 1` points.
- Each point is the result of `tallyUpTo(date, …)` with the rides, attendance and
  corrections dated up to that day. Anything dated after `last` counts on `last`
  (research R2).
- The last point's `training`, `team` and `outside` equal the balance's. If the
  rebuild gives something else, the balance wins and an error without rider data
  is logged.

**Change to `tallyUpTo`**: it gains the rides without virtual ones, so `outside`
comes from the same `tally` call. `riderWeeks` and `riderDays` pass all rides as
"without virtual", as they do today, so their results don't change.

## View model (`src/http/progress-view.ts`, pure)

```ts
type Preset = "season" | "3m" | "4w";

type ProgressView =
	| { state: "none" }   // no balance (FR-016), or the rules version is unknown (FR-040)
	| {
			state: "ready";
			rulesVersion: number;
			nothingYet: boolean;              // both totals 0 (FR-015)
			seasonStart: string;
			deadline: string;
			lastDay: string;
			axisDays: number;                 // dayNumber(deadline) − dayNumber(seasonStart)
			lastIndex: number;                // lastDay's index
			presets: { preset: Preset; from: number; to: number }[]; // day indexes; only those offered (FR-020)
			training: ChartSeries;
			team: ChartSeries;
			outside: (ChartSeries & { needed: number }) | null;   // US2, only with virtual rides (FR-039)
			weeks: WeekRow[];
	  };

interface ChartSeries {
	values: number[];      // index 0 … lastIndex
	threshold: number;
	yMax: number;          // research R5
	pace: boolean;         // US2: draw the even pace line towards `threshold`
}

interface WeekRow {
	firstDay: string;
	training: { earned: number; total: number };
	team: { earned: number; total: number };
	outside: { earned: number; total: number } | null;   // US2
}
```

**Inputs**:
- the `RiderViewRead`;
- `rulesForVersion(balance.rulesVersion)`;
- the `CountingWindow`;
- `berlinDate(ctx.now())`.

Every load starts with the whole season (FR-026); there is no period parameter
(research R8).

**Rules**:
- **Pace (US2)**: the pace of a day `i` is `evenPace(threshold, seasonStart,
  deadline, date(i))` from `src/rynke/pace.ts`, the function behind the rider
  status (016 FR-030). The view model only says whether to draw the pace line. The
  script (for the pace line and the readout) and the table compute the pace with
  the same formula, from `axisDays` and the threshold:

  ```text
  ⌊threshold × i ÷ axisDays⌋, within 0 … threshold
  ```

  A unit test checks it equals `evenPace` on every day.
- **Outdoor curve (US2)**: `outside` is set only when the read's `virtualCount`
  is above 0 (FR-039).

## Chart data (`#progress-data`, research R6)

JSON inside `<script type="application/json" id="progress-data">`, with `<`
escaped as `\u003c`. Here is the example rider on 7 October 2026 (US1):

```json
{
	"axisDays": 302,
	"lastIndex": 36,
	"seasonStart": "2026-09-01",
	"training": { "values": [0, 0, 0, 0, 0, 21, …, 112], "threshold": 250, "yMax": 250, "pace": false },
	"team": { "values": [0, 0, 0, 0, 0, 1, …, 17], "threshold": 25, "yMax": 25, "pace": false },
	"outside": null
}
```

- **`values[i]`**: the total at the end of day `seasonStart + i`.
- **US2 changes**:
  - `pace` becomes `true` in both series;
  - `outside` becomes `{ "values": […], "threshold": 167, "yMax": 250, "pace":
    true, "needed": 167 }` for riders with virtual rides.
- **Nothing else**: no names, no ride or event data and no units, only Rynke and
  dates (FR-005, SC-004, SC-007).
- **Text** lives in the markup's templates, not in the data (research R9).
- **Presets** are not in the data: they are the period buttons' `data-from` and
  `data-to` (research R8).

## The tour's example rider (FR-043)

`exampleRiderView(window, today, rules)` (020) also fills `progress` from its
synthetic rides, events and evaluation results:
- its rides summed per day and virtual flag;
- its attendance;
- no corrections.

The section is then built by the same functions as for a real rider. Nothing is
stored.

## State over time

The section has no state on the server. In the browser, the period lives in the
two Chart.js instances (their x scale's `min` and `max`), kept equal by
`applyPeriod`, and the selected day in `progressCharts()`'s closure:
- a reload or any new page load starts again with the whole season (FR-026);
- nothing goes to storage, cookies or the network (Principle I).
