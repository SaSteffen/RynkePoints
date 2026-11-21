// The team's guest list (feature 041): administrators of other teams who may
// sign in here without being in the club. The maintainer writes it by hand
// (contracts/guest-list.md); the app only reads it.

export async function isOnGuestList(
	db: D1Database,
	athleteId: string,
): Promise<boolean> {
	const row = await db
		.prepare("SELECT 1 AS listed FROM guests WHERE athlete_id = ?")
		.bind(athleteId)
		.first<number>("listed");
	return row === 1;
}

/** Guests' rows whose ID the maintainer took off the list (FR-004). */
export async function listRemovedGuestIds(db: D1Database): Promise<string[]> {
	const { results } = await db
		.prepare(
			`SELECT CAST(athlete_id AS TEXT) AS athlete_id FROM riders
			WHERE guest = 1 AND athlete_id NOT IN (SELECT athlete_id FROM guests)
			ORDER BY riders.athlete_id`,
		)
		.all<{ athlete_id: string }>();
	return results.map((r) => r.athlete_id);
}
