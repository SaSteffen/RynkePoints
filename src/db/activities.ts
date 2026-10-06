import type { ActivityRecord } from "../strava/activity";

// Stored cycling activities (data-model.md). Every write is an upsert keyed by
// the Strava activity ID, so replays converge (FR-017). An upsert never moves
// an activity to another rider.

function upsertStatement(db: D1Database, a: ActivityRecord) {
	return db
		.prepare(
			`INSERT INTO activities (strava_activity_id, athlete_id, sport_type, start_date,
				start_date_local, timezone, distance_m, moving_time_s, elevation_gain_m,
				is_private, refreshed_at, elapsed_time_s, is_manual, is_trainer)
			VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
			ON CONFLICT (strava_activity_id) DO UPDATE SET
				sport_type = ?3, start_date = ?4, start_date_local = ?5, timezone = ?6,
				distance_m = ?7, moving_time_s = ?8, elevation_gain_m = ?9,
				is_private = ?10, refreshed_at = ?11, elapsed_time_s = ?12,
				is_manual = ?13, is_trainer = ?14
			WHERE activities.athlete_id = excluded.athlete_id`,
		)
		.bind(
			a.strava_activity_id,
			a.athlete_id,
			a.sport_type,
			a.start_date,
			a.start_date_local,
			a.timezone,
			a.distance_m,
			a.moving_time_s,
			a.elevation_gain_m,
			a.is_private,
			a.refreshed_at,
			a.elapsed_time_s,
			a.is_manual,
			a.is_trainer,
		);
}

export async function upsertActivity(
	db: D1Database,
	a: ActivityRecord,
): Promise<void> {
	await upsertStatement(db, a).run();
}

/** Upserts a whole import page in one round trip. */
export async function upsertActivities(
	db: D1Database,
	activities: ActivityRecord[],
): Promise<void> {
	if (activities.length === 0) return;
	await db.batch(activities.map((a) => upsertStatement(db, a)));
}

/** Deletes the activity only if it belongs to `athleteId`. */
export async function deleteActivity(
	db: D1Database,
	athleteId: number,
	activityId: number,
): Promise<void> {
	await db
		.prepare(
			"DELETE FROM activities WHERE strava_activity_id = ? AND athlete_id = ?",
		)
		.bind(activityId, athleteId)
		.run();
}

/** Honours a narrowed scope: "Only You" activities go (FR-007). */
export async function deletePrivateActivities(
	db: D1Database,
	athleteId: number,
): Promise<void> {
	await db
		.prepare("DELETE FROM activities WHERE athlete_id = ? AND is_private = 1")
		.bind(athleteId)
		.run();
}

export async function listRecentActivities(
	db: D1Database,
	athleteId: number,
	limit: number,
): Promise<ActivityRecord[]> {
	const { results } = await db
		.prepare(
			`SELECT strava_activity_id, athlete_id, sport_type, start_date, start_date_local,
				timezone, distance_m, moving_time_s, elapsed_time_s, elevation_gain_m,
				is_manual, is_trainer, is_private, refreshed_at
			FROM activities WHERE athlete_id = ?
			ORDER BY start_date DESC, strava_activity_id DESC LIMIT ?`,
		)
		.bind(athleteId, limit)
		.all<ActivityRecord>();
	return results;
}

/** The rider's rows with any figure still unknown, for the re-read (R20). */
export async function listActivityIdsMissingFigures(
	db: D1Database,
	athleteId: number,
): Promise<number[]> {
	const { results } = await db
		.prepare(
			`SELECT strava_activity_id FROM activities
			WHERE athlete_id = ? AND (elapsed_time_s IS NULL OR is_manual IS NULL
				OR is_trainer IS NULL)
			ORDER BY strava_activity_id`,
		)
		.bind(athleteId)
		.all<{ strava_activity_id: number }>();
	return results.map((r) => r.strava_activity_id);
}
