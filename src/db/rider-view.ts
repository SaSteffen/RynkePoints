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

// What the rider page reads (feature 005 data-model.md "The reading", research
// R2): the balance, the ride and virtual counts, and one table page, all in one
// batch so they come from one snapshot. Only SELECTs: the page never writes,
// evaluates or enqueues (FR-003).

export const RIDES_PER_PAGE = 20;

export interface RideRow {
	activityId: number;
	sportType: CyclingSportType;
	/** ISO, local wall clock with a `Z`. */
	startDateLocal: string;
	distanceM: number;
	movingS: number;
	elapsedS: number | null;
	elevationGainM: number;
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
}

/**
 * One table page, newest first. The OFFSET clamps a page past the end to the
 * last page, the same way `readRiderView` reports it.
 */
export const RIDE_PAGE_SQL = `SELECT a.strava_activity_id, a.sport_type, a.start_date_local, a.distance_m,
	a.moving_time_s, a.elapsed_time_s, a.elevation_gain_m,
	r.strava_activity_id AS result_id, r.athlete_id, r.counts, r.reasons,
	r.overlaps_activity_id, r.distance_rynke, r.elevation_dm, r.is_virtual,
	r.unknown_figures, r.rules_version, r.activity_refreshed_at,
	c.start_date_local AS counted_start_date_local,
	c.distance_m AS counted_distance_m
FROM activities a
LEFT JOIN ride_results r
	ON r.athlete_id = a.athlete_id AND r.strava_activity_id = a.strava_activity_id
LEFT JOIN activities c
	ON c.athlete_id = a.athlete_id AND c.strava_activity_id = r.overlaps_activity_id
WHERE a.athlete_id = ?1
ORDER BY a.start_date DESC, a.strava_activity_id DESC
LIMIT ${RIDES_PER_PAGE} OFFSET min((?2 - 1) * ${RIDES_PER_PAGE}, max(0,
	((SELECT count(*) FROM activities WHERE athlete_id = ?1) - 1)
		/ ${RIDES_PER_PAGE} * ${RIDES_PER_PAGE}))`;

type RidePageRow = Omit<RideResultRow, "strava_activity_id"> & {
	strava_activity_id: number;
	sport_type: CyclingSportType;
	start_date_local: string;
	distance_m: number;
	moving_time_s: number;
	elapsed_time_s: number | null;
	elevation_gain_m: number;
	result_id: number | null;
	counted_start_date_local: string | null;
	counted_distance_m: number | null;
};

/** The rider's page `page` (≥ 1) of the ride table, with what it needs. */
export async function readRiderView(
	db: D1Database,
	athleteId: number,
	page: number,
): Promise<RiderViewRead> {
	const [balance, counts, rides] = await db.batch([
		readBalanceStatement(db, athleteId),
		db
			.prepare(
				`SELECT (SELECT count(*) FROM activities WHERE athlete_id = ?1) AS rides,
					(SELECT count(*) FROM ride_results
						WHERE athlete_id = ?1 AND is_virtual = 1) AS virtual`,
			)
			.bind(athleteId),
		db.prepare(RIDE_PAGE_SQL).bind(athleteId, page),
	]);
	if (!balance || !counts || !rides) {
		throw new Error("D1 batch returned too few results");
	}
	const balanceRow = (balance.results as BalanceRow[])[0];
	const count = (counts.results as { rides: number; virtual: number }[])[0];
	const rideCount = count?.rides ?? 0;
	const lastPage = Math.max(1, Math.ceil(rideCount / RIDES_PER_PAGE));
	return {
		balance: balanceRow ? toStoredBalance(balanceRow) : null,
		rideCount,
		virtualCount: count?.virtual ?? 0,
		page: Math.min(page, lastPage),
		rides: (rides.results as RidePageRow[]).map(toRideRow),
	};
}

function toRideRow(row: RidePageRow): RideRow {
	return {
		activityId: row.strava_activity_id,
		sportType: row.sport_type,
		startDateLocal: row.start_date_local,
		distanceM: row.distance_m,
		movingS: row.moving_time_s,
		elapsedS: row.elapsed_time_s,
		elevationGainM: row.elevation_gain_m,
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
