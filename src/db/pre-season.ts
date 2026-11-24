// Rides, runs and swims whose local date is before the season start date
// (`YYYY-MM-DD`). Nothing older is stored any more; these find and delete what
// was stored before that rule, or under an earlier season start.

// `start_date_local < ?1` compares the stored timestamp with the bare date:
// a timestamp on the season start's day sorts after it, every earlier one
// before. Left unwrapped, it uses each table's `*_by_local_start` index, so
// the daily run reads only the rows it finds. The riders' list joins them with
// UNION ALL and DISTINCT: a plain UNION has SQLite walk the by-rider indexes
// in rider order instead, every row.

const TABLES = ["activities", "runs", "swims"] as const;

/** The riders with such an activity stored, in id order. */
export async function listPreSeasonRiders(
	db: D1Database,
	seasonStartDate: string,
): Promise<string[]> {
	const { results } = await db
		.prepare(
			`SELECT DISTINCT CAST(id AS TEXT) AS athlete_id FROM (
				SELECT athlete_id AS id FROM activities WHERE start_date_local < ?1
				UNION ALL SELECT athlete_id FROM runs WHERE start_date_local < ?1
				UNION ALL SELECT athlete_id FROM swims WHERE start_date_local < ?1)
			ORDER BY id`,
		)
		.bind(seasonStartDate)
		.all<{ athlete_id: string }>();
	return results.map((r) => r.athlete_id);
}

export async function deletePreSeasonActivities(
	db: D1Database,
	seasonStartDate: string,
): Promise<void> {
	await db.batch(
		TABLES.map((table) =>
			db
				.prepare(`DELETE FROM ${table} WHERE start_date_local < ?`)
				.bind(seasonStartDate),
		),
	);
}
