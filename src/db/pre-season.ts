// Rides, runs and swims whose local date is before the season start date
// (`YYYY-MM-DD`). Nothing older is stored any more; these find and delete what
// was stored before that rule, or under an earlier season start.

const TABLES = ["activities", "runs", "swims"] as const;

/** The riders with such an activity stored, in id order. */
export async function listPreSeasonRiders(
	db: D1Database,
	seasonStartDate: string,
): Promise<number[]> {
	const { results } = await db
		.prepare(
			`SELECT athlete_id FROM activities WHERE substr(start_date_local, 1, 10) < ?1
			UNION SELECT athlete_id FROM runs WHERE substr(start_date_local, 1, 10) < ?1
			UNION SELECT athlete_id FROM swims WHERE substr(start_date_local, 1, 10) < ?1
			ORDER BY athlete_id`,
		)
		.bind(seasonStartDate)
		.all<{ athlete_id: number }>();
	return results.map((r) => r.athlete_id);
}

export async function deletePreSeasonActivities(
	db: D1Database,
	seasonStartDate: string,
): Promise<void> {
	await db.batch(
		TABLES.map((table) =>
			db
				.prepare(
					`DELETE FROM ${table} WHERE substr(start_date_local, 1, 10) < ?`,
				)
				.bind(seasonStartDate),
		),
	);
}
