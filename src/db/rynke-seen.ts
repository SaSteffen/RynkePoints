// The Rynke a rider last saw on the Overview (feature 012 US2), so the page
// celebrates new ones once. Only the Overview reads and writes it; it reads it
// in `readRiderView`'s batch (issue #184).

export interface SeenRynke {
	training: number;
	team: number;
}

export function readSeenStatement(db: D1Database, athleteId: number) {
	return db
		.prepare(
			"SELECT training_rynke, team_rynke FROM rynke_seen WHERE athlete_id = ?",
		)
		.bind(athleteId);
}

export interface SeenRow {
	training_rynke: number;
	team_rynke: number;
}

export function toSeen(row: SeenRow | undefined | null): SeenRynke | null {
	return row ? { training: row.training_rynke, team: row.team_rynke } : null;
}

export async function readSeen(
	db: D1Database,
	athleteId: number,
): Promise<SeenRynke | null> {
	return toSeen(await readSeenStatement(db, athleteId).first<SeenRow>());
}

/** Replaces what the rider saw before. */
export async function writeSeen(
	db: D1Database,
	athleteId: number,
	seen: SeenRynke,
): Promise<void> {
	await db
		.prepare(
			`INSERT INTO rynke_seen (athlete_id, training_rynke, team_rynke)
			VALUES (?1, ?2, ?3)
			ON CONFLICT (athlete_id) DO UPDATE SET training_rynke = ?2, team_rynke = ?3`,
		)
		.bind(athleteId, seen.training, seen.team)
		.run();
}
