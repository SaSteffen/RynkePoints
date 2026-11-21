import type { ActivityRecord, ActivityRow } from "../strava/activity";
import { idsJson } from "../strava/id";

// Stored cycling activities (data-model.md). Every write is an upsert keyed by
// the Strava activity ID, so replays converge (FR-017). An upsert never moves
// an activity to another rider. Writes are statements, so feature 003's
// `applyAndEvaluate` can batch them with the rider's Rynke rows (research R11).

// Without `name`: only the rider's own ride table reads it (008 research R7).
// IDs leave D1 as text: a number would round above 2^53 (feature 042 R5).
const COLUMNS = `CAST(strava_activity_id AS TEXT) AS strava_activity_id,
	CAST(athlete_id AS TEXT) AS athlete_id, sport_type, start_date, start_date_local,
	timezone, distance_m, moving_time_s, elapsed_time_s, elevation_gain_m,
	is_manual, is_trainer, is_flagged, is_private, refreshed_at`;

export function upsertActivityStatement(db: D1Database, a: ActivityRecord) {
	return db
		.prepare(
			`INSERT INTO activities (strava_activity_id, athlete_id, sport_type, start_date,
				start_date_local, timezone, distance_m, moving_time_s, elevation_gain_m,
				is_private, refreshed_at, elapsed_time_s, is_manual, is_trainer, is_flagged,
				name)
			VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
			ON CONFLICT (strava_activity_id) DO UPDATE SET
				sport_type = ?3, start_date = ?4, start_date_local = ?5, timezone = ?6,
				distance_m = ?7, moving_time_s = ?8, elevation_gain_m = ?9,
				is_private = ?10, refreshed_at = ?11, elapsed_time_s = ?12,
				is_manual = ?13, is_trainer = ?14, is_flagged = ?15, name = ?16
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
			a.is_flagged,
			a.name,
		);
}

export async function upsertActivity(
	db: D1Database,
	a: ActivityRecord,
): Promise<void> {
	await upsertActivityStatement(db, a).run();
}

/** Upserts a whole import page in one round trip. */
export async function upsertActivities(
	db: D1Database,
	activities: ActivityRecord[],
): Promise<void> {
	if (activities.length === 0) return;
	await db.batch(activities.map((a) => upsertActivityStatement(db, a)));
}

/** Deletes the activity only if it belongs to `athleteId`. */
export function deleteActivityStatement(
	db: D1Database,
	athleteId: string,
	activityId: string,
) {
	return db
		.prepare(
			"DELETE FROM activities WHERE strava_activity_id = ? AND athlete_id = ?",
		)
		.bind(activityId, athleteId);
}

/** Honours a narrowed scope: "Only You" activities go (FR-007). */
export function deletePrivateActivitiesStatement(
	db: D1Database,
	athleteId: string,
) {
	return db
		.prepare("DELETE FROM activities WHERE athlete_id = ? AND is_private = 1")
		.bind(athleteId);
}

/**
 * Every activity of the riders in `athleteIds`, not only the season's, for
 * one batch (feature 003).
 */
export function listActivitiesOfRidersStatement(
	db: D1Database,
	athleteIds: string[],
) {
	return db
		.prepare(
			`SELECT ${COLUMNS} FROM activities
			WHERE athlete_id IN (SELECT value FROM json_each(?1))
			ORDER BY activities.athlete_id, activities.strava_activity_id`,
		)
		.bind(idsJson(athleteIds));
}

/** `strava_activity_id, athlete_id` of those of `ids` that are stored. */
export function activityOwnersStatement(db: D1Database, ids: string[]) {
	return db
		.prepare(
			`SELECT CAST(strava_activity_id AS TEXT) AS strava_activity_id,
				CAST(athlete_id AS TEXT) AS athlete_id FROM activities
			WHERE strava_activity_id IN (SELECT value FROM json_each(?))`,
		)
		.bind(idsJson(ids));
}

export async function listRecentActivities(
	db: D1Database,
	athleteId: string,
	limit: number,
): Promise<ActivityRow[]> {
	const { results } = await db
		.prepare(
			`SELECT ${COLUMNS} FROM activities WHERE athlete_id = ?
			ORDER BY start_date DESC, activities.strava_activity_id DESC LIMIT ?`,
		)
		.bind(athleteId, limit)
		.all<ActivityRow>();
	return results;
}

/**
 * The rider's rows with any figure still unknown, for the re-read (R20). The
 * name is not a figure, so a missing one never costs a request (008 research
 * R3).
 */
export async function listActivityIdsMissingFigures(
	db: D1Database,
	athleteId: string,
): Promise<string[]> {
	const { results } = await db
		.prepare(
			`SELECT CAST(strava_activity_id AS TEXT) AS strava_activity_id FROM activities
			WHERE athlete_id = ? AND (elapsed_time_s IS NULL OR is_manual IS NULL
				OR is_trainer IS NULL OR is_flagged IS NULL)
			ORDER BY activities.strava_activity_id`,
		)
		.bind(athleteId)
		.all<{ strava_activity_id: string }>();
	return results.map((r) => r.strava_activity_id);
}

/**
 * A rider's stored rides, runs and swims not refreshed since `since`: those a
 * finished import didn't list (review L-03).
 */
export async function listActivityIdsRefreshedBefore(
	db: D1Database,
	athleteId: string,
	since: number,
): Promise<string[]> {
	const { results } = await db
		.prepare(
			`SELECT CAST(id AS TEXT) AS strava_activity_id FROM (
				SELECT strava_activity_id AS id FROM activities
					WHERE athlete_id = ?1 AND refreshed_at < ?2
				UNION SELECT strava_activity_id FROM runs
					WHERE athlete_id = ?1 AND refreshed_at < ?2
				UNION SELECT strava_activity_id FROM swims
					WHERE athlete_id = ?1 AND refreshed_at < ?2)
			ORDER BY id`,
		)
		.bind(athleteId, since)
		.all<{ strava_activity_id: string }>();
	return results.map((r) => r.strava_activity_id);
}
