// The Rynke a rider last saw on the Overview (feature 012 US2), so the page
// celebrates new ones once. Only the Overview reads and writes it.

export interface SeenRynke {
	training: number;
	team: number;
}

export async function readSeen(
	db: D1Database,
	athleteId: number,
): Promise<SeenRynke | null> {
	const row = await db
		.prepare(
			"SELECT training_rynke, team_rynke FROM rynke_seen WHERE athlete_id = ?",
		)
		.bind(athleteId)
		.first<{ training_rynke: number; team_rynke: number }>();
	return row ? { training: row.training_rynke, team: row.team_rynke } : null;
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
