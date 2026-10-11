import type { RunRecord } from "../strava/activity";

// A rider's outdoor runs (feature 013 data-model.md `runs`, research R10,
// R11). Kept apart from `activities`, so no Rynke, ride list or Team page
// ever sees them (SC-004). Writes are statements for the evaluation batch of
// `rynke/apply.ts`, like the activities'.

/** Never overwrites another rider's run, as activities don't. */
export function upsertRunStatement(db: D1Database, r: RunRecord) {
	return db
		.prepare(
			`INSERT INTO runs (strava_activity_id, athlete_id, start_date,
				start_date_local, distance_m, is_private, refreshed_at)
			VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
			ON CONFLICT (strava_activity_id) DO UPDATE SET
				start_date = ?3, start_date_local = ?4, distance_m = ?5,
				is_private = ?6, refreshed_at = ?7
			WHERE runs.athlete_id = excluded.athlete_id`,
		)
		.bind(
			r.strava_activity_id,
			r.athlete_id,
			r.start_date,
			r.start_date_local,
			r.distance_m,
			r.is_private,
			r.refreshed_at,
		);
}

/** Deletes the run only if it belongs to `athleteId`. */
export function deleteRunStatement(
	db: D1Database,
	athleteId: number,
	activityId: number,
) {
	return db
		.prepare("DELETE FROM runs WHERE strava_activity_id = ? AND athlete_id = ?")
		.bind(activityId, athleteId);
}

/** Honours a narrowed scope: "Only You" runs go (001 FR-007). */
export function deletePrivateRunsStatement(db: D1Database, athleteId: number) {
	return db
		.prepare("DELETE FROM runs WHERE athlete_id = ? AND is_private = 1")
		.bind(athleteId);
}

export function listRunsOfRidersStatement(
	db: D1Database,
	athleteIds: number[],
) {
	return db
		.prepare(
			`SELECT strava_activity_id, athlete_id, start_date, start_date_local,
				distance_m, is_private, refreshed_at
			FROM runs WHERE athlete_id IN (SELECT value FROM json_each(?1))
			ORDER BY athlete_id, strava_activity_id`,
		)
		.bind(JSON.stringify(athleteIds));
}

/** `strava_activity_id, athlete_id` of those of `ids` stored as runs. */
export function runOwnersStatement(db: D1Database, ids: number[]) {
	return db
		.prepare(
			`SELECT strava_activity_id, athlete_id FROM runs
			WHERE strava_activity_id IN (SELECT value FROM json_each(?))`,
		)
		.bind(JSON.stringify(ids));
}
