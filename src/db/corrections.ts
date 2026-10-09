import { SHARED_RIDER_IDS } from "./consents";

// Corrections of a rider's Training and Team Rynke (feature 014 Story 3,
// data-model.md, research R8). Writes are statements for
// `applyCorrectionChange`'s batch. A correction is never updated: a wrong one
// is deleted and added again (FR-031).

/** A correction with its change record, for the organiser pages. */
export interface CorrectionRow {
	correction_id: number;
	training: number;
	team: number;
	reason: string;
	correction_date: string;
	changed_at: number;
	/** Null when the organiser has gone or no longer shares their name (R9). */
	changed_by_name: string | null;
}

export interface CorrectionOfRidersRow {
	correction_id: number;
	athlete_id: number;
	training: number;
	team: number;
}

/** A correction as the write functions take it; already checked. */
export interface CorrectionFields {
	training: number;
	team: number;
	reason: string;
	date: string;
}

/** The rider's `CorrectionRow`s, newest first. */
export function listRiderCorrectionsStatement(
	db: D1Database,
	athleteId: number,
) {
	return db
		.prepare(
			`SELECT c.correction_id, c.training, c.team, c.reason,
				c.correction_date, c.changed_at, o.first_name AS changed_by_name
			FROM corrections c LEFT JOIN riders o ON o.athlete_id = c.changed_by
				AND o.athlete_id IN (${SHARED_RIDER_IDS})
			WHERE c.athlete_id = ?
			ORDER BY c.correction_date DESC, c.correction_id DESC`,
		)
		.bind(athleteId);
}

/** `CorrectionOfRidersRow`s, as the evaluation reads them. */
export function listCorrectionsOfRidersStatement(
	db: D1Database,
	athleteIds: number[],
) {
	return db
		.prepare(
			`SELECT correction_id, athlete_id, training, team FROM corrections
			WHERE athlete_id IN (SELECT value FROM json_each(?1))
			ORDER BY athlete_id, correction_id`,
		)
		.bind(JSON.stringify(athleteIds));
}

/** `correction_id, athlete_id` of the correction. */
export function readCorrectionStatement(db: D1Database, correctionId: number) {
	return db
		.prepare(
			"SELECT correction_id, athlete_id FROM corrections WHERE correction_id = ?",
		)
		.bind(correctionId);
}

/** `by` is the organiser adding it. */
export function insertCorrectionStatement(
	db: D1Database,
	athleteId: number,
	correction: CorrectionFields,
	by: number,
	now: number,
) {
	return db
		.prepare(
			`INSERT INTO corrections (athlete_id, training, team, reason,
				correction_date, changed_by, changed_at)
			VALUES (?, ?, ?, ?, ?, ?, ?)`,
		)
		.bind(
			athleteId,
			correction.training,
			correction.team,
			correction.reason,
			correction.date,
			by,
			now,
		);
}

export function deleteCorrectionStatement(
	db: D1Database,
	correctionId: number,
) {
	return db
		.prepare("DELETE FROM corrections WHERE correction_id = ?")
		.bind(correctionId);
}
