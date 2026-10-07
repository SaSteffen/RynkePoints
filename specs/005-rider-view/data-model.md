# Data Model: Rider View of Own Rynke

This feature **stores nothing** and adds no migration (FR-003, research R17). This
file describes what it reads, the shape of that reading, and the view model
the page is rendered from.

## Stored data read

| Table | Owner | Columns used | For |
|---|---|---|---|
| `riders` | feature 001 | `first_name`, `status`, `scope_read_all`, `scope_write`, `import_status` | greeting, status, the "will grow" notice (FR-052); read by feature 001's `getRider`, as today |
| `activities` | feature 001 | `strava_activity_id`, `sport_type`, `start_date`, `start_date_local`, `distance_m`, `moving_time_s`, `elapsed_time_s`, `elevation_gain_m` | ride table, reason figures (FR-040, FR-042), the ride that counted instead |
| `ride_results` | feature 003 | `counts`, `reasons`, `overlaps_activity_id`, `distance_rynke`, `elevation_dm`, `is_virtual`, `unknown_figures`, `rules_version` | ride table (FR-040–FR-044), virtual count (FR-012) |
| `rynke_balances` | feature 003 | every column except `computed_at` | summary, gauges, breakdown, rules (FR-010–FR-035, FR-050) |
| `consent_records` | feature 001/004 | as today | consent section, unchanged |
| *(code)* `RULES_HISTORY`, `CURRENT_RULES` | feature 003, extended here | every rule value | thresholds, steps, limits, deadline, version in effect (R3) |
| *(env)* `SEASON_START_DATE` | feature 001 | | counting window (FR-050), "before the season start" |

US3b adds, from feature 003 Stories 3 and 6 once they exist (research R5): team
events and attendance (date, kind, name), corrections (date, amounts, reason), and
the balance's per-kind and correction columns (feature 003 FR-014a).

## The reading: `readRiderView(db, athleteId, page)` → `RiderViewRead`

One `db.batch` of reads (research R2), so every field below comes from the same
state.

```ts
interface RiderViewRead {
	balance: StoredBalance | null; // feature 003's mapped row; null before the first evaluation
	rideCount: number;             // stored activities of the rider
	virtualCount: number;          // ride results with is_virtual = 1
	page: number;                  // the page actually read, 1 … lastPage (1 when rideCount = 0)
	rides: RideRow[];              // ≤ 20, newest first
}

interface RideRow {
	activityId: number;
	sportType: CyclingSportType;
	startDateLocal: string;     // ISO, local wall clock with Z
	distanceM: number;
	movingS: number;
	elapsedS: number | null;
	elevationGainM: number;
	result: StoredRideResult | null; // null = being evaluated (FR-041)
	countedInstead: { startDateLocal: string; distanceM: number } | null; // overlap target
}
```

`page` is derived from the count read in the same batch:
`lastPage = max(1, ceil(rideCount / 20))`, `page = min(requested, lastPage)`. SQL
uses the same clamp for its `OFFSET`, so the rows and the reported page agree.

## The view model: `buildRiderView(read, rules, inEffect, env)` → `RiderView`

Pure (research R6). `rules` is `rulesForVersion` and `inEffect` is
`CURRENT_RULES`. Every number is stored or derived as allowed by FR-004. Nothing
is formatted yet; formatting is the renderer's job (`I18n`).

```ts
type RiderView =
	| { state: "not-worked-out"; importing: boolean; rides: RideTable }   // FR-015
	| {
			state: "ready";
			importing: boolean;            // FR-052
			updating: UpdateNotice | null; // FR-051
			summary: Summary;              // US1
			gauges: Gauges | null;         // US2; null when the rules of the balance are unknown
			breakdown: Breakdown;          // US3a (US3b adds kinds, events, corrections)
			rules: RulesInfo;              // US6
			rides: RideTable;              // US1, US4, US5
	  };

interface Summary {
	training: Condition;
	team: Condition;
	withoutVirtual: Condition | null; // null when the rider has no virtual ride (FR-012)
	qualified: boolean;               // stored (FR-011, FR-023)
}

interface Condition {
	value: number;          // stored total
	target: number | null;  // rule value of the balance's version; null when unknown (FR-013)
	missing: number;        // stored; 0 when reached (FR-014)
	reached: boolean;       // missing === 0
}

interface Gauges {
	training: Gauge;
	team: Gauge;
	withoutVirtual: Gauge | null;
	elevation: ElevationGauge;  // value/target in dm within the current step (FR-021)
}
interface ElevationGauge extends Gauge {
	stepRynke: number;  // the Training Rynke of a step, for the caption
}

interface Gauge {
	value: number;
	target: number;
	percent: number;         // floor(value × 100 / target), capped at 100 (FR-020)
	reached: boolean;        // value ≥ target
	parts: GaugePart[];      // empty = undivided (FR-022)
}

interface GaugePart {
	source: "distance" | "elevation" | "team_training" | "weekend_day" | "technique" | "corrections";
	value: number;
	widthPercent: number;    // value / max(total, target) × 100, two decimals (research R7)
}

interface Breakdown {
	distanceRynke: number;
	elevationM: number;          // floor(elevationDm / 10)
	elevationRynke: number;
	elevationStepM: number | null;      // null when rules unknown
	elevationStepRynke: number | null;
	toNextStepM: number;         // ceil(elevationToNextStepDm / 10)
	trainingTotal: number;
	teamTotal: number;
	// US3b: kinds: KindLine[]; events: AttendedEvent[]; corrections: CorrectionLine[];
	//       correctionSums: { training: number; team: number }; clampedToZero: boolean;
}

interface RulesInfo {
	version: number;              // balance.rulesVersion
	effectiveDate: string;        // balance.rulesEffectiveDate
	seasonStart: string;          // SEASON_START_DATE
	deadline: string | null;      // of the balance's rules; null = none or unknown
}

interface UpdateNotice {
	inEffectVersion: number;
	inEffectSince: string;        // CURRENT_RULES.effectiveDate
}

interface RideTable {
	rows: RideLine[];
	position: { from: number; to: number; total: number };
	pager: Pager | null;          // null when total ≤ 20 (FR-045)
}

interface Pager {
	page: number;
	lastPage: number;
	first: number | null;  previous: number | null;  // null = not offered
	next: number | null;   last: number | null;
}

interface RideLine {
	activityId: number;
	startDateLocal: string;
	sportType: CyclingSportType;
	distanceM: number;
	elevationGainM: number;
	status: "being-evaluated" | "counts" | "does-not-count";  // FR-041
	distanceRynke: number;        // 0 unless counts
	elevationM: number;           // elevationDm / 10, rounded like the gain column
	isVirtual: boolean;           // FR-043
	reasons: ReasonLine[];        // empty unless does-not-count
	unknownFigures: UnknownFigureCode[];
	fixHint: boolean;             // FR-044
}

type ReasonLine =
	| { code: "flagged" | "manual" }
	| { code: "pause"; pausedS: number | null; movingS: number; share: Share | null } // pausedS null only at 0 moving time
	| { code: "too_slow"; kmhTenths: number; limitKmh: number | null }  // rounded down
	| { code: "too_fast"; kmhTenths: number; limitKmh: number | null }  // rounded up
	| { code: "climbing_rate"; mPerH: number; limitMPerH: number | null } // from elevation dm, rounded up
	| { code: "excluded_sport_type"; sportType: string }
	| { code: "before_season"; date: string }              // SEASON_START_DATE
	| { code: "after_deadline"; date: string | null }      // null when the rules are unknown
	| { code: "overlap"; countedInstead: { startDateLocal: string; distanceM: number } | null }
	| { code: "unknown"; stored: string };   // a code without a text (FR-042)
```

### Validation and invariants (checked by unit tests)

- `0 ≤ percent ≤ 100`, and `percent === 100 ⇔ reached` (SC-009).
- `Σ parts.widthPercent ≤ 100`, and it equals the filled share up to
  rounding. `parts` is empty when a gauge's corrections are negative (FR-022).
- `Condition.reached ⇔ missing === 0`. `missing` is never negative (FR-014).
- `Summary.qualified` is the stored value. With every target known, it equals
  "every shown condition reached" (FR-023). A test asserts that for feature 003's
  reference riders.
- `distanceRynke + elevationRynke (+ kinds + corrections in US3b) =
  trainingTotal` unless clamped at 0 (FR-035).
- `RideLine.status === "being-evaluated" ⇔ result === null`. Reasons are listed
  in feature 003's stored order.
- Feature 003 records only `pause` for a ride with 0 moving time (its research
  R7), so `too_slow`, `too_fast` and `climbing_rate` always have a moving time
  to divide by.
- `outside_window` maps to `before_season` when the ride's local date is before
  `SEASON_START_DATE`, else to `after_deadline`.
- With an unknown rules version, every limit and target is `null`, `gauges` is
  `null`, and every stored figure is still shown (FR-013).

## State

The page has no state of its own. The states in spec [D6](spec.md#d6-page-states)
and [D7](spec.md#d7-a-ride-row) are read off the stored data:

| Page state | Condition |
|---|---|
| Not worked out yet | `balance === null` |
| Current | `balance.rulesVersion === CURRENT_RULES.version` |
| Being updated | `balance.rulesVersion !== CURRENT_RULES.version` |
| *+ importing* | `rider.importStatus !== "done"` (any of the above) |

| Ride row | Condition |
|---|---|
| Being evaluated | no `ride_results` row |
| Counts | `counts = 1` |
| Doesn't count | `counts = 0` |
