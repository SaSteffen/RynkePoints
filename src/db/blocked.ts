// The team's block list and the removal of a rider (feature 025 research R6, R7).
// An entry is the Strava athlete ID alone (FR-024, constitution Principle I), and
// the removal record never names whom it removed (FR-023).

export async function isBlocked(
	db: D1Database,
	athleteId: number,
): Promise<boolean> {
	const row = await db
		.prepare("SELECT 1 AS found FROM blocked_athletes WHERE athlete_id = ?")
		.bind(athleteId)
		.first();
	return row !== null;
}

/** Only how many: the view shows nothing else about them (FR-031). */
export function blockedCountStatement(db: D1Database): D1PreparedStatement {
	return db.prepare("SELECT COUNT(*) AS n FROM blocked_athletes");
}

/**
 * Blocks the rider, records the removal and deletes them in one atomic batch, so
 * a rider can't be deleted but unblocked. The schema's cascade takes the rest,
 * and queued work for a rider without a row is dropped (R6).
 */
export async function removeRider(
	db: D1Database,
	athleteId: number,
	administratorId: number,
	now: number,
): Promise<void> {
	await db.batch([
		db
			.prepare("INSERT OR IGNORE INTO blocked_athletes (athlete_id) VALUES (?)")
			.bind(athleteId),
		db
			.prepare(
				"INSERT INTO removal_log (removed_at, administrator_id) VALUES (?, ?)",
			)
			.bind(now, administratorId),
		db.prepare("DELETE FROM riders WHERE athlete_id = ?").bind(athleteId),
	]);
}
