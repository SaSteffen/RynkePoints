import type { TeamEventKind } from "../rynke/team-events";
import type { CurveInputs, CurveRideSum } from "../rynke/weeks";
import type { CyclingSportType } from "../strava/activity";
import {
	type BalanceRow,
	type RideResultRow,
	readBalanceStatement,
	type StoredBalance,
	type StoredRideResult,
	toStoredBalance,
	toStoredRideResult,
} from "./rynke";
import {
	readSeenStatement,
	type SeenRow,
	type SeenRynke,
	toSeen,
} from "./rynke-seen";
import {
	listRiderAttendanceStatement,
	type RiderAttendanceRow,
} from "./team-events";

// What the rider page reads (feature 005 data-model.md "The reading", research
// R2): the balance, the ride and virtual counts, one table page and the
// rider's team events, all in one batch so they come from one snapshot. Only
// SELECTs: the page never writes, evaluates or enqueues (FR-003).

export const RIDES_PER_PAGE = 20;

/** The most rides one batch may hold: restoring a place (018 research R5). */
export const MAX_RIDE_BATCH = 1000;

/**
 * A ride's place in the list's order, `start_date DESC, strava_activity_id
 * DESC` (feature 018 data-model.md "Ride key").
 */
export interface RideKey {
	/** `activities.start_date`, ISO UTC. */
	startDate: string;
	activityId: number;
}

export interface RideRow {
	activityId: number;
	sportType: CyclingSportType;
	/** ISO UTC, the list's order (feature 018 R1). */
	startDate: string;
	/** ISO, local wall clock with a `Z`. */
	startDateLocal: string;
	distanceM: number;
	movingS: number;
	elapsedS: number | null;
	elevationGainM: number;
	/** `null` = unknown: not read yet, or empty or blank on Strava (008 FR-005). */
	name: string | null;
	/** `null` = no result yet: the ride is being evaluated (FR-041). */
	result: StoredRideResult | null;
	/** The ride an overlap counted instead, when it is still stored. */
	countedInstead: { startDateLocal: string; distanceM: number } | null;
}

export interface RiderViewRead {
	/** `null` before the rider's first evaluation. */
	balance: StoredBalance | null;
	rideCount: number;
	virtualCount: number;
	/** The page actually read, 1 … last page (1 without rides). */
	page: number;
	/** At most `RIDES_PER_PAGE`, newest first. */
	rides: RideRow[];
	/** Every team event the rider was recorded for, newest first (FR-033). */
	attendance: AttendedEvent[];
	/**
	 * What the progress curve is rebuilt from (feature 009 data-model.md "What
	 * is read"), only when asked for.
	 */
	progress?: CurveInputs;
	/**
	 * The Rynke the rider last saw on the Overview (feature 012 US2), only
	 * when asked for; null before the first visit.
	 */
	seen?: SeenRynke | null;
}

export interface AttendedEvent {
	eventId: number;
	kind: TeamEventKind;
	/** `YYYY-MM-DD` */
	date: string;
	name: string | null;
}

/** A ride with its result and the ride an overlap counted instead. */
const RIDE_COLUMNS = `SELECT a.strava_activity_id, a.sport_type, a.start_date, a.start_date_local, a.distance_m,
	a.moving_time_s, a.elapsed_time_s, a.elevation_gain_m, a.name,
	r.strava_activity_id AS result_id, r.athlete_id, r.counts, r.reasons,
	r.overlaps_activity_id, r.distance_rynke, r.elevation_dm, r.is_virtual,
	r.unknown_figures, r.rules_version, r.activity_refreshed_at,
	c.start_date_local AS counted_start_date_local,
	c.distance_m AS counted_distance_m
FROM activities a
LEFT JOIN ride_results r
	ON r.athlete_id = a.athlete_id AND r.strava_activity_id = a.strava_activity_id
LEFT JOIN activities c
	ON c.athlete_id = a.athlete_id AND c.strava_activity_id = r.overlaps_activity_id`;

/**
 * One table page, newest first. The OFFSET clamps a page past the end to the
 * last page, the same way `readRiderView` reports it.
 */
export const RIDE_PAGE_SQL = `${RIDE_COLUMNS}
WHERE a.athlete_id = ?1
ORDER BY a.start_date DESC, a.strava_activity_id DESC
LIMIT ${RIDES_PER_PAGE} OFFSET min((?2 - 1) * ${RIDES_PER_PAGE}, max(0,
	((SELECT count(*) FROM activities WHERE athlete_id = ?1) - 1)
		/ ${RIDES_PER_PAGE} * ${RIDES_PER_PAGE}))`;

type RidePageRow = Omit<RideResultRow, "strava_activity_id"> & {
	strava_activity_id: number;
	sport_type: CyclingSportType;
	start_date: string;
	start_date_local: string;
	distance_m: number;
	moving_time_s: number;
	elapsed_time_s: number | null;
	elevation_gain_m: number;
	name: string | null;
	result_id: number | null;
	counted_start_date_local: string | null;
	counted_distance_m: number | null;
};

/**
 * The rider's counting rides summed per local start date and kind (feature 009
 * research R3). The metres only place the elevation steps; they are never shown.
 */
const DAILY_RIDES_SQL = `SELECT substr(a.start_date_local, 1, 10) AS date, r.is_virtual,
	SUM(r.distance_rynke) AS distance_rynke, SUM(r.elevation_dm) AS elevation_dm
FROM ride_results r
JOIN activities a
	ON a.athlete_id = r.athlete_id AND a.strava_activity_id = r.strava_activity_id
WHERE r.athlete_id = ?1 AND r.counts = 1
GROUP BY 1, 2 ORDER BY 1, 2`;

/** The rider's ride and virtual ride counts, as `rides` and `virtual`. */
export function rideCountsStatement(db: D1Database, athleteId: number) {
	return db
		.prepare(
			`SELECT (SELECT count(*) FROM activities WHERE athlete_id = ?1) AS rides,
			(SELECT count(*) FROM ride_results
				WHERE athlete_id = ?1 AND is_virtual = 1) AS virtual`,
		)
		.bind(athleteId);
}

/** The rider's team events as the rider page lists them, newest first. */
export function toAttendedEvents(
	rows: readonly RiderAttendanceRow[],
): AttendedEvent[] {
	return rows.map((row) => ({
		eventId: row.event_id,
		kind: row.kind,
		date: row.event_date,
		name: row.name,
	}));
}

const CORRECTIONS_SQL = `SELECT correction_date, training, team FROM corrections
WHERE athlete_id = ?1 ORDER BY correction_date, correction_id`;

/**
 * The rider's page `page` (≥ 1) of the ride table, with what it needs; with
 * `progress`, also what the Overview's progress curve needs (feature 009);
 * with `seen`, also the Rynke the rider last saw, so the Overview reads all
 * it needs in one round trip (issue #184).
 */
export async function readRiderView(
	db: D1Database,
	athleteId: number,
	page: number,
	options: { progress?: boolean; seen?: boolean } = {},
): Promise<RiderViewRead> {
	const [balance, counts, rides, attendance, ...rest] = await db.batch([
		readBalanceStatement(db, athleteId),
		rideCountsStatement(db, athleteId),
		db.prepare(RIDE_PAGE_SQL).bind(athleteId, page),
		listRiderAttendanceStatement(db, athleteId),
		...(options.progress
			? [
					db.prepare(DAILY_RIDES_SQL).bind(athleteId),
					db.prepare(CORRECTIONS_SQL).bind(athleteId),
				]
			: []),
		...(options.seen ? [readSeenStatement(db, athleteId)] : []),
	]);
	const [dailyRides, corrections] = options.progress ? rest : [];
	const seenRows = options.seen ? rest.at(-1) : undefined;
	if (
		!balance ||
		!counts ||
		!rides ||
		!attendance ||
		(options.progress && (!dailyRides || !corrections)) ||
		(options.seen && !seenRows)
	) {
		throw new Error("D1 batch returned too few results");
	}
	const balanceRow = (balance.results as BalanceRow[])[0];
	const count = (counts.results as { rides: number; virtual: number }[])[0];
	const rideCount = count?.rides ?? 0;
	const lastPage = Math.max(1, Math.ceil(rideCount / RIDES_PER_PAGE));
	const attended = toAttendedEvents(attendance.results as RiderAttendanceRow[]);
	return {
		balance: balanceRow ? toStoredBalance(balanceRow) : null,
		rideCount,
		virtualCount: count?.virtual ?? 0,
		page: Math.min(page, lastPage),
		rides: (rides.results as RidePageRow[]).map(toRideRow),
		attendance: attended,
		...(dailyRides && corrections
			? {
					progress: {
						rides: (dailyRides.results as DailyRideRow[]).map(toCurveRide),
						attendance: attended.map(({ eventId, kind, date }) => ({
							eventId,
							kind,
							date,
						})),
						corrections: (corrections.results as CorrectionRow[]).map(
							(row) => ({
								date: row.correction_date,
								training: row.training,
								team: row.team,
							}),
						),
					},
				}
			: {}),
		...(seenRows ? { seen: toSeen((seenRows.results as SeenRow[])[0]) } : {}),
	};
}

/** What the rider's summary needs and nothing more (issue #185). */
export interface RiderStanding {
	/** `null` before the rider's first evaluation. */
	balance: StoredBalance | null;
	virtualCount: number;
}

/**
 * The statements of a `RiderStanding`, for a caller's batch: the balance and
 * the ride counts, without the ride page and its joins.
 */
export function riderStandingStatements(
	db: D1Database,
	athleteId: number,
): D1PreparedStatement[] {
	return [
		readBalanceStatement(db, athleteId),
		rideCountsStatement(db, athleteId),
	];
}

/** The results of `riderStandingStatements`, in their order. */
export function toRiderStanding(
	results: readonly (D1Result | undefined)[],
): RiderStanding {
	const [balance, counts] = results;
	if (!balance || !counts) {
		throw new Error("D1 batch returned too few results");
	}
	const balanceRow = (balance.results as BalanceRow[])[0];
	const count = (counts.results as { virtual: number }[])[0];
	return {
		balance: balanceRow ? toStoredBalance(balanceRow) : null,
		virtualCount: count?.virtual ?? 0,
	};
}

interface DailyRideRow {
	date: string;
	is_virtual: number;
	distance_rynke: number;
	elevation_dm: number;
}

interface CorrectionRow {
	correction_date: string;
	training: number;
	team: number;
}

function toCurveRide(row: DailyRideRow): CurveRideSum {
	return {
		date: row.date,
		virtual: row.is_virtual === 1,
		distanceRynke: row.distance_rynke,
		elevationDm: row.elevation_dm,
	};
}

function toRideRow(row: RidePageRow): RideRow {
	return {
		activityId: row.strava_activity_id,
		sportType: row.sport_type,
		startDate: row.start_date,
		startDateLocal: row.start_date_local,
		distanceM: row.distance_m,
		movingS: row.moving_time_s,
		elapsedS: row.elapsed_time_s,
		elevationGainM: row.elevation_gain_m,
		name: row.name,
		result:
			row.result_id === null
				? null
				: toStoredRideResult({ ...row, strava_activity_id: row.result_id }),
		countedInstead:
			row.counted_start_date_local === null || row.counted_distance_m === null
				? null
				: {
						startDateLocal: row.counted_start_date_local,
						distanceM: row.counted_distance_m,
					},
	};
}

/**
 * The rides after `after` in the list's order (feature 018 research R1): the
 * rows that sort after the key, whether or not the key's own ride still
 * exists. `?4` is one more than asked for, to know whether more follow.
 */
export const RIDE_BATCH_SQL = `${RIDE_COLUMNS}
WHERE a.athlete_id = ?1
	AND (a.start_date < ?2 OR (a.start_date = ?2 AND a.strava_activity_id < ?3))
ORDER BY a.start_date DESC, a.strava_activity_id DESC
LIMIT ?4`;

export interface RideBatch {
	/** At most the limit asked for, newest first. */
	rides: RideRow[];
	/** The last ride's key when older rides follow it, else `null`. */
	more: RideKey | null;
}

/** Up to `limit` (1 … `MAX_RIDE_BATCH`) of the rider's rides after `after`. */
export async function readRideBatch(
	db: D1Database,
	athleteId: number,
	after: RideKey,
	limit: number,
): Promise<RideBatch> {
	const { results } = await db
		.prepare(RIDE_BATCH_SQL)
		.bind(athleteId, after.startDate, after.activityId, limit + 1)
		.all<RidePageRow>();
	const rides = results.slice(0, limit).map(toRideRow);
	const last = rides.at(-1);
	return {
		rides,
		more:
			results.length > limit && last
				? { startDate: last.startDate, activityId: last.activityId }
				: null,
	};
}

/**
 * Whether the rider has a balance yet, for the waiting state's poll (015
 * research R5), or `null` when the rider is gone. One read.
 */
export async function hasBalance(
	db: D1Database,
	athleteId: number,
): Promise<boolean | null> {
	const row = await db
		.prepare(
			`SELECT EXISTS (SELECT 1 FROM rynke_balances WHERE athlete_id = ?1) AS ready
			FROM riders WHERE athlete_id = ?1`,
		)
		.bind(athleteId)
		.first<{ ready: number }>();
	return row === null ? null : row.ready === 1;
}
