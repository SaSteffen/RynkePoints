import type { Attendance, TeamEventKind } from "../rynke/team-events";
import type {
	DatedCorrection,
	RiderInputs,
	WeeklyRideSum,
} from "../rynke/weeks";
import {
	LISTED_RIDER_IDS,
	type ListedRiderRow,
	listListedRidersStatement,
} from "./organiser";
import { type BalanceRow, type StoredBalance, toStoredBalance } from "./rynke";

// The one read behind the Team page and the organiser overview (feature 016
// data-model.md "Read per request", research R2, R11): five SELECTs in one
// batch, each limited to 014's listed riders inside SQL (004 FR-021). Nothing
// is written and nothing is evaluated.

/** A listed rider with everything both pages need. */
export interface TeamRider extends RiderInputs {
	athleteId: number;
	firstName: string;
	balance: StoredBalance | null;
}

interface WeeklyRideSumRow {
	athlete_id: number;
	week_end: string;
	distance_rynke: number;
	elevation_dm: number;
}

interface TeamAttendanceRow {
	athlete_id: number;
	event_id: number;
	kind: TeamEventKind;
	event_date: string;
}

interface TeamCorrectionRow {
	athlete_id: number;
	training: number;
	team: number;
	correction_date: string;
}

/**
 * Counting ride results summed per rider and Monday-to-Sunday week; `'weekday
 * 0'` moves a date to the Sunday ending its week (research R2).
 */
export function listWeeklyRideSumsStatement(db: D1Database) {
	return db.prepare(
		`SELECT r.athlete_id,
			date(substr(a.start_date_local, 1, 10), 'weekday 0') AS week_end,
			SUM(r.distance_rynke) AS distance_rynke,
			SUM(r.elevation_dm) AS elevation_dm
		FROM ride_results r
		JOIN activities a ON a.strava_activity_id = r.strava_activity_id
		WHERE r.counts = 1 AND r.athlete_id IN (${LISTED_RIDER_IDS})
		GROUP BY 1, 2
		ORDER BY 1, 2`,
	);
}

export function listTeamBalancesStatement(db: D1Database) {
	return db.prepare(
		`SELECT * FROM rynke_balances WHERE athlete_id IN (${LISTED_RIDER_IDS})`,
	);
}

export function listTeamAttendanceStatement(db: D1Database) {
	return db.prepare(
		`SELECT a.athlete_id, a.event_id, e.kind, e.event_date
		FROM attendances a JOIN team_events e ON e.event_id = a.event_id
		WHERE a.athlete_id IN (${LISTED_RIDER_IDS})
		ORDER BY a.athlete_id, e.event_date, a.event_id`,
	);
}

export function listTeamCorrectionsStatement(db: D1Database) {
	return db.prepare(
		`SELECT athlete_id, training, team, correction_date FROM corrections
		WHERE athlete_id IN (${LISTED_RIDER_IDS})
		ORDER BY athlete_id, correction_date, correction_id`,
	);
}

/** The listed riders by first name, each with their stored rows. */
export async function readTeam(db: D1Database): Promise<TeamRider[]> {
	const [riderRows, balanceRows, rideRows, attendanceRows, correctionRows] =
		await db.batch([
			listListedRidersStatement(db),
			listTeamBalancesStatement(db),
			listWeeklyRideSumsStatement(db),
			listTeamAttendanceStatement(db),
			listTeamCorrectionsStatement(db),
		]);
	if (
		!riderRows ||
		!balanceRows ||
		!rideRows ||
		!attendanceRows ||
		!correctionRows
	) {
		throw new Error("D1 batch returned too few results");
	}
	const rides = new Map<number, WeeklyRideSum[]>();
	const attendance = new Map<number, Attendance[]>();
	const corrections = new Map<number, DatedCorrection[]>();
	const balances = new Map<number, StoredBalance>();
	for (const row of balanceRows.results as BalanceRow[]) {
		balances.set(row.athlete_id, toStoredBalance(row));
	}
	for (const row of rideRows.results as WeeklyRideSumRow[]) {
		push(rides, row.athlete_id, {
			weekEnd: row.week_end,
			distanceRynke: row.distance_rynke,
			elevationDm: row.elevation_dm,
		});
	}
	for (const row of attendanceRows.results as TeamAttendanceRow[]) {
		push(attendance, row.athlete_id, {
			eventId: row.event_id,
			kind: row.kind,
			date: row.event_date,
		});
	}
	for (const row of correctionRows.results as TeamCorrectionRow[]) {
		push(corrections, row.athlete_id, {
			date: row.correction_date,
			training: row.training,
			team: row.team,
		});
	}
	return (riderRows.results as ListedRiderRow[]).map((row) => ({
		athleteId: row.athlete_id,
		firstName: row.first_name,
		balance: balances.get(row.athlete_id) ?? null,
		rides: rides.get(row.athlete_id) ?? [],
		attendance: attendance.get(row.athlete_id) ?? [],
		corrections: corrections.get(row.athlete_id) ?? [],
	}));
}

function push<T>(map: Map<number, T[]>, key: number, value: T): void {
	const list = map.get(key);
	if (list) list.push(value);
	else map.set(key, [value]);
}
