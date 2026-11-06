import {
	type ActiveEntry,
	type DayEntry,
	parseRides,
	RIDE_SUMMARY_SINCE,
	RIDER_SUMMARY_VERSION,
	type RideEntry,
	type RiderSummary,
	type RunDayEntry,
	TEAM_SUMMARY_SINCE,
	type WeekEntry,
} from "../rynke/summary";
import { sharedRiderIdsSince } from "./consents";
import { LISTED_RIDER_IDS } from "./organiser";

// The stored rider summaries (feature 030 data-model.md). Writes are statements
// for `riderWrites`' batch. Reads go through `db/team.ts`, which keeps each
// team read's listed-rider check inside SQL (004 FR-021).

export interface RiderSummaryRow {
	athlete_id: number;
	version: number;
	days: string;
	weeks: string;
	run_days: string;
	active: string;
	attended: string;
	virtual_days: string;
	own_days: string;
	rides: string;
}

/**
 * For a query from `riders r`: the rider's row as `s` when its team columns can
 * be used, nothing otherwise, so a missing or outdated row costs no extra read
 * and shows up as `s.athlete_id IS NULL` (research R4; feature 029 research R14).
 */
export const TEAM_SUMMARY_JOIN = `LEFT JOIN rider_summaries s
	ON s.athlete_id = r.athlete_id AND s.version >= ${TEAM_SUMMARY_SINCE}`;

/**
 * `TEAM_SUMMARY_JOIN` for the ride figures (feature 032): the row as `rs` when
 * it holds `rides`, so a rider without one shows up as `rs.athlete_id IS NULL`.
 */
export const RIDE_SUMMARY_JOIN = `LEFT JOIN rider_summaries rs
	ON rs.athlete_id = r.athlete_id AND rs.version >= ${RIDE_SUMMARY_SINCE}`;

/**
 * The stored rides of the riders in `athleteIds` whose consent is at least
 * `consentSince` and whose row holds rides. A rider missing from the map has
 * no such row, or no such consent.
 */
export async function readRidesOfRiders(
	db: D1Database,
	athleteIds: readonly number[],
	consentSince: number,
): Promise<Map<number, RideEntry[]>> {
	const { results } = await db
		.prepare(
			`SELECT athlete_id, rides FROM rider_summaries
			WHERE athlete_id IN (SELECT value FROM json_each(?1))
				AND version >= ${RIDE_SUMMARY_SINCE}
				AND athlete_id IN (${sharedRiderIdsSince(consentSince)})`,
		)
		.bind(JSON.stringify(athleteIds))
		.all<{ athlete_id: number; rides: string }>();
	return new Map(results.map((row) => [row.athlete_id, parseRides(row.rides)]));
}

/** The rows of every rider in `athleteIds`, for one batch (research R2). */
export function readSummariesOfRidersStatement(
	db: D1Database,
	athleteIds: number[],
) {
	return db
		.prepare(
			`SELECT athlete_id, version, days, weeks, run_days, active, attended,
				virtual_days, own_days, rides
			FROM rider_summaries
			WHERE athlete_id IN (SELECT value FROM json_each(?1))`,
		)
		.bind(JSON.stringify(athleteIds));
}

export function upsertSummaryStatement(
	db: D1Database,
	athleteId: number,
	summary: RiderSummary,
) {
	return db
		.prepare(
			`INSERT INTO rider_summaries (athlete_id, version, days, weeks, run_days,
				active, attended, virtual_days, own_days, rides)
			VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
			ON CONFLICT (athlete_id) DO UPDATE SET
				version = ?2, days = ?3, weeks = ?4, run_days = ?5, active = ?6,
				attended = ?7, virtual_days = ?8, own_days = ?9, rides = ?10`,
		)
		.bind(
			athleteId,
			RIDER_SUMMARY_VERSION,
			summary.days,
			summary.weeks,
			summary.runDays,
			summary.active,
			summary.attended,
			summary.virtualDays,
			summary.ownDays,
			summary.rides,
		);
}

/** A new rider has stored nothing yet, and counts as summarised (FR-014). */
export function insertEmptySummaryStatement(db: D1Database, athleteId: number) {
	return db
		.prepare("INSERT INTO rider_summaries (athlete_id, version) VALUES (?, ?)")
		.bind(athleteId, RIDER_SUMMARY_VERSION);
}

// Riders without a current row are added up from their rides (research R4):
// today's SQL for those IDs, in a second round trip that only happens when such
// a rider exists. They check the listed riders themselves, since this isn't the
// first batch's snapshot (004 FR-021).

/** What a Team read needs of a rider without a row. */
export interface AddedUpWeeks {
	weeks: WeekEntry[];
	attended: number[];
}

/** What a badge read needs of a rider without a row. */
export interface AddedUpDays {
	days: DayEntry[];
	runDays: RunDayEntry[];
	active: ActiveEntry[];
	attended: number[];
}

const OF_THESE_LISTED = (column: string) =>
	`${column} IN (SELECT value FROM json_each(?1))
	AND ${column} IN (${LISTED_RIDER_IDS})`;

function attendedStatement(db: D1Database, ids: string) {
	return db
		.prepare(
			`SELECT athlete_id, event_id FROM attendances
			WHERE ${OF_THESE_LISTED("athlete_id")}
			ORDER BY 1, 2`,
		)
		.bind(ids);
}

function entriesByRider<Row extends { athlete_id: number }, Entry>(
	rows: readonly Row[],
	entry: (row: Row) => Entry,
): Map<number, Entry[]> {
	const map = new Map<number, Entry[]>();
	for (const row of rows) {
		const list = map.get(row.athlete_id);
		if (list) list.push(entry(row));
		else map.set(row.athlete_id, [entry(row)]);
	}
	return map;
}

/**
 * Every counting ride of the listed riders in `athleteIds` whose consent is at
 * least `consentSince`, as `summaryOf` stores them (feature 032 research R1):
 * for riders without a version 3 row, so they get correct figures, never a
 * false zero. The consent is checked again here, since this isn't the first
 * batch's snapshot.
 */
export async function readRidesAddedUp(
	db: D1Database,
	athleteIds: readonly number[],
	consentSince: number,
): Promise<Map<number, RideEntry[]>> {
	const { results } = await db
		.prepare(
			`SELECT r.athlete_id, substr(a.start_date_local, 1, 10) AS date,
				a.distance_m, r.elevation_dm
			FROM ride_results r
			JOIN activities a ON a.strava_activity_id = r.strava_activity_id
			WHERE r.counts = 1 AND ${OF_THESE_LISTED("r.athlete_id")}
				AND r.athlete_id IN (${sharedRiderIdsSince(consentSince)})
			ORDER BY 1, 2, 3, 4`,
		)
		.bind(JSON.stringify(athleteIds))
		.all<{
			athlete_id: number;
			date: string;
			distance_m: number;
			elevation_dm: number;
		}>();
	const rides = entriesByRider(
		results,
		(row): RideEntry => [row.date, row.distance_m, row.elevation_dm],
	);
	return new Map(athleteIds.map((id) => [id, rides.get(id) ?? []]));
}

/** Counting rides per Monday-to-Sunday week, and attended events. */
export async function readWeeksAddedUp(
	db: D1Database,
	athleteIds: readonly number[],
): Promise<Map<number, AddedUpWeeks>> {
	const ids = JSON.stringify(athleteIds);
	const [weekRows, attendedRows] = await db.batch([
		db
			.prepare(
				// 'weekday 0' moves a date to the Sunday ending its week.
				`SELECT r.athlete_id,
					date(substr(a.start_date_local, 1, 10), 'weekday 0') AS week_end,
					SUM(r.distance_rynke) AS distance_rynke,
					SUM(r.elevation_dm) AS elevation_dm
				FROM ride_results r
				JOIN activities a ON a.strava_activity_id = r.strava_activity_id
				WHERE r.counts = 1 AND ${OF_THESE_LISTED("r.athlete_id")}
				GROUP BY 1, 2
				ORDER BY 1, 2`,
			)
			.bind(ids),
		attendedStatement(db, ids),
	]);
	if (!weekRows || !attendedRows) {
		throw new Error("D1 batch returned too few results");
	}
	const weeks = entriesByRider(
		weekRows.results as {
			athlete_id: number;
			week_end: string;
			distance_rynke: number;
			elevation_dm: number;
		}[],
		(row): WeekEntry => [row.week_end, row.distance_rynke, row.elevation_dm],
	);
	const attended = entriesByRider(
		attendedRows.results as { athlete_id: number; event_id: number }[],
		(row) => row.event_id,
	);
	return new Map(
		athleteIds.map((id) => [
			id,
			{ weeks: weeks.get(id) ?? [], attended: attended.get(id) ?? [] },
		]),
	);
}

/**
 * Counting rides and outdoor runs per day, when counting rides, runs and swims
 * started, and attended events.
 */
export async function readDaysAddedUp(
	db: D1Database,
	athleteIds: readonly number[],
): Promise<Map<number, AddedUpDays>> {
	const ids = JSON.stringify(athleteIds);
	const [dayRows, runRows, activeRows, attendedRows] = await db.batch([
		db
			.prepare(
				`SELECT r.athlete_id, substr(a.start_date_local, 1, 10) AS date,
					SUM(a.distance_m) AS distance_m,
					SUM(r.distance_rynke) AS distance_rynke,
					SUM(r.elevation_dm) AS elevation_dm
				FROM ride_results r
				JOIN activities a ON a.strava_activity_id = r.strava_activity_id
				WHERE r.counts = 1 AND ${OF_THESE_LISTED("r.athlete_id")}
				GROUP BY 1, 2
				ORDER BY 1, 2`,
			)
			.bind(ids),
		db
			.prepare(
				`SELECT athlete_id, substr(start_date_local, 1, 10) AS date,
					SUM(distance_m) AS distance_m
				FROM runs WHERE ${OF_THESE_LISTED("athlete_id")}
				GROUP BY 1, 2
				ORDER BY 1, 2`,
			)
			.bind(ids),
		// For the team surprises (feature 013 part E, research R39, R45).
		db
			.prepare(
				`SELECT DISTINCT athlete_id, substr(start_date_local, 1, 10) AS date,
					CAST(substr(start_date_local, 12, 2) AS INTEGER) AS hour, ride
				FROM (
					SELECT a.athlete_id, a.start_date_local, 1 AS ride
					FROM ride_results r
					JOIN activities a ON a.strava_activity_id = r.strava_activity_id
					WHERE r.counts = 1 AND ${OF_THESE_LISTED("r.athlete_id")}
					UNION ALL
					SELECT athlete_id, start_date_local, 0 FROM runs
					WHERE ${OF_THESE_LISTED("athlete_id")}
					UNION ALL
					SELECT athlete_id, start_date_local, 0 FROM swims
					WHERE ${OF_THESE_LISTED("athlete_id")}
				)
				ORDER BY 1, 2, 3, 4`,
			)
			.bind(ids),
		attendedStatement(db, ids),
	]);
	if (!dayRows || !runRows || !activeRows || !attendedRows) {
		throw new Error("D1 batch returned too few results");
	}
	const days = entriesByRider(
		dayRows.results as {
			athlete_id: number;
			date: string;
			distance_m: number;
			distance_rynke: number;
			elevation_dm: number;
		}[],
		(row): DayEntry => [
			row.date,
			row.distance_m,
			row.distance_rynke,
			row.elevation_dm,
		],
	);
	const runDays = entriesByRider(
		runRows.results as {
			athlete_id: number;
			date: string;
			distance_m: number;
		}[],
		(row): RunDayEntry => [row.date, row.distance_m],
	);
	const active = entriesByRider(
		activeRows.results as {
			athlete_id: number;
			date: string;
			hour: number;
			ride: 0 | 1;
		}[],
		(row): ActiveEntry => [row.date, row.hour, row.ride],
	);
	const attended = entriesByRider(
		attendedRows.results as { athlete_id: number; event_id: number }[],
		(row) => row.event_id,
	);
	return new Map(
		athleteIds.map((id) => [
			id,
			{
				days: days.get(id) ?? [],
				runDays: runDays.get(id) ?? [],
				active: active.get(id) ?? [],
				attended: attended.get(id) ?? [],
			},
		]),
	);
}
