import { RIDER_SUMMARY_VERSION, type RiderSummary } from "../rynke/summary";

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
}

/**
 * For a query from `riders r`: the rider's row under the current version as
 * `s`, nothing otherwise, so a missing or outdated row costs no extra read and
 * shows up as `s.athlete_id IS NULL` (research R4, R6).
 */
export const CURRENT_SUMMARY_JOIN = `LEFT JOIN rider_summaries s
	ON s.athlete_id = r.athlete_id AND s.version = ${RIDER_SUMMARY_VERSION}`;

/** The rows of every rider in `athleteIds`, for one batch (research R2). */
export function readSummariesOfRidersStatement(
	db: D1Database,
	athleteIds: number[],
) {
	return db
		.prepare(
			`SELECT athlete_id, version, days, weeks, run_days, active, attended
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
				active, attended)
			VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
			ON CONFLICT (athlete_id) DO UPDATE SET
				version = ?2, days = ?3, weeks = ?4, run_days = ?5, active = ?6,
				attended = ?7`,
		)
		.bind(
			athleteId,
			RIDER_SUMMARY_VERSION,
			summary.days,
			summary.weeks,
			summary.runDays,
			summary.active,
			summary.attended,
		);
}

/** A new rider has stored nothing yet, and counts as summarised (FR-014). */
export function insertEmptySummaryStatement(db: D1Database, athleteId: number) {
	return db
		.prepare("INSERT INTO rider_summaries (athlete_id, version) VALUES (?, ?)")
		.bind(athleteId, RIDER_SUMMARY_VERSION);
}
