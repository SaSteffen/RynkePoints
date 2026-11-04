import {
	type DayEntry,
	OWN_SUMMARY_SINCE,
	type VirtualDayEntry,
} from "../rynke/summary";
import { SINCE_VERSION } from "../visibility";
import { sharedRiderExists, sharedRiderIdsSince } from "./consents";

// What the organiser's graphs read (feature 029 research R2): one row per rider
// who agreed to daily figures. That consent is checked inside SQL, so a rider
// without it is in no row of the result (FR-024). Only `days` and `virtual_days`
// are selected, never a rider's longest ride.

/** One agreed rider's figures, from their row or added up. */
export interface GraphRow {
	athleteId: number;
	days: DayEntry[];
	virtualDays: VirtualDayEntry[];
}

const DAILY_FIGURES = SINCE_VERSION.dailyFigures;

/** One round trip's worth, for the batch with the open requests. */
export function organiserGraphsStatement(db: D1Database) {
	return db.prepare(
		`SELECT r.athlete_id, s.days, s.virtual_days
		FROM riders r
		LEFT JOIN rider_summaries s
			ON s.athlete_id = r.athlete_id AND s.version >= ${OWN_SUMMARY_SINCE}
		WHERE r.status = 'connected' AND ${sharedRiderExists("r", DAILY_FIGURES)}`,
	);
}

/**
 * The rows of `organiserGraphsStatement`. A rider who agreed before the daily job
 * raised their row is added up in a second round trip, with the consent checked
 * again there, so they get correct lines and never a false zero (research R1).
 */
export async function toGraphRows(
	db: D1Database,
	result: D1Result,
): Promise<GraphRow[]> {
	const rows = result.results as {
		athlete_id: number;
		days: string | null;
		virtual_days: string | null;
	}[];
	const missing = rows.filter((r) => r.days === null).map((r) => r.athlete_id);
	const addedUp =
		missing.length > 0 ? await graphDaysAddedUp(db, missing) : new Map();
	return rows.flatMap((row): GraphRow[] => {
		if (row.days !== null) {
			return [
				{
					athleteId: row.athlete_id,
					days: JSON.parse(row.days) as DayEntry[],
					virtualDays: JSON.parse(
						row.virtual_days ?? "[]",
					) as VirtualDayEntry[],
				},
			];
		}
		const added: Omit<GraphRow, "athleteId"> | undefined = addedUp.get(
			row.athlete_id,
		);
		return added ? [{ athleteId: row.athlete_id, ...added }] : [];
	});
}

async function graphDaysAddedUp(
	db: D1Database,
	athleteIds: readonly number[],
): Promise<Map<number, Omit<GraphRow, "athleteId">>> {
	const ids = JSON.stringify(athleteIds);
	const agreed = `SELECT athlete_id FROM riders
		WHERE status = 'connected'
			AND athlete_id IN (SELECT value FROM json_each(?1))
			AND athlete_id IN (${sharedRiderIdsSince(DAILY_FIGURES)})`;
	const [agreedRows, dayRows] = await db.batch([
		db.prepare(agreed).bind(ids),
		db
			.prepare(
				`SELECT l.athlete_id, substr(a.start_date_local, 1, 10) AS date,
					SUM(a.distance_m) AS distance_m,
					SUM(x.distance_rynke) AS distance_rynke,
					SUM(x.elevation_dm) AS elevation_dm,
					SUM(CASE WHEN x.is_virtual = 1 THEN a.distance_m END) AS virtual_m
				FROM (${agreed}) l
				JOIN ride_results x ON x.athlete_id = l.athlete_id AND x.counts = 1
				JOIN activities a ON a.strava_activity_id = x.strava_activity_id
				GROUP BY 1, 2
				ORDER BY 1, 2`,
			)
			.bind(ids),
	]);
	if (!agreedRows || !dayRows) {
		throw new Error("D1 batch returned too few results");
	}
	const figures = new Map<number, Omit<GraphRow, "athleteId">>(
		(agreedRows.results as { athlete_id: number }[]).map((row) => [
			row.athlete_id,
			{ days: [], virtualDays: [] },
		]),
	);
	for (const row of dayRows.results as {
		athlete_id: number;
		date: string;
		distance_m: number;
		distance_rynke: number;
		elevation_dm: number;
		virtual_m: number | null;
	}[]) {
		const entry = figures.get(row.athlete_id);
		if (!entry) continue;
		entry.days.push([
			row.date,
			row.distance_m,
			row.distance_rynke,
			row.elevation_dm,
		]);
		if (row.virtual_m !== null) {
			entry.virtualDays.push([row.date, row.virtual_m]);
		}
	}
	return figures;
}
