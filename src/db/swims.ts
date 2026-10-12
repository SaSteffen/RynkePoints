import type { SwimRecord } from "../strava/activity";

// A rider's swims (feature 013 part C, data-model.md `swims`, research R26).
// Kept apart from `activities` and `runs`, so no Rynke, ride list, Team page
// or team sum ever sees them (FR-025, SC-004). Writes are statements for the
// evaluation batch of `rynke/apply.ts`, like the runs'.

/** Never overwrites another rider's swim, as activities don't. */
export function upsertSwimStatement(db: D1Database, r: SwimRecord) {
	return db
		.prepare(
			`INSERT INTO swims (strava_activity_id, athlete_id, start_date,
				start_date_local, distance_m, is_private, refreshed_at)
			VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
			ON CONFLICT (strava_activity_id) DO UPDATE SET
				start_date = ?3, start_date_local = ?4, distance_m = ?5,
				is_private = ?6, refreshed_at = ?7
			WHERE swims.athlete_id = excluded.athlete_id`,
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

/** Deletes the swim only if it belongs to `athleteId`. */
export function deleteSwimStatement(
	db: D1Database,
	athleteId: number,
	activityId: number,
) {
	return db
		.prepare(
			"DELETE FROM swims WHERE strava_activity_id = ? AND athlete_id = ?",
		)
		.bind(activityId, athleteId);
}

/** Honours a narrowed scope: "Only You" swims go (001 FR-007). */
export function deletePrivateSwimsStatement(db: D1Database, athleteId: number) {
	return db
		.prepare("DELETE FROM swims WHERE athlete_id = ? AND is_private = 1")
		.bind(athleteId);
}

export function listSwimsOfRidersStatement(
	db: D1Database,
	athleteIds: number[],
) {
	return db
		.prepare(
			`SELECT strava_activity_id, athlete_id, start_date, start_date_local,
				distance_m, is_private, refreshed_at
			FROM swims WHERE athlete_id IN (SELECT value FROM json_each(?1))
			ORDER BY athlete_id, strava_activity_id`,
		)
		.bind(JSON.stringify(athleteIds));
}

/** `strava_activity_id, athlete_id` of those of `ids` stored as swims. */
export function swimOwnersStatement(db: D1Database, ids: number[]) {
	return db
		.prepare(
			`SELECT strava_activity_id, athlete_id FROM swims
			WHERE strava_activity_id IN (SELECT value FROM json_each(?))`,
		)
		.bind(JSON.stringify(ids));
}
