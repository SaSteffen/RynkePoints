// Rides, runs and swims whose local date is before the season start date
// (`YYYY-MM-DD`), per rider. Nothing older is stored any
// more; this finds what was stored before that rule, or under an earlier
// season start.
export async function listPreSeasonActivities(
	db: D1Database,
	seasonStartDate: string,
): Promise<Map<number, number[]>> {
	const { results } = await db
		.prepare(
			`SELECT athlete_id, strava_activity_id FROM activities WHERE substr(start_date_local, 1, 10) < ?1
			UNION ALL
			SELECT athlete_id, strava_activity_id FROM runs WHERE substr(start_date_local, 1, 10) < ?1
			UNION ALL
			SELECT athlete_id, strava_activity_id FROM swims WHERE substr(start_date_local, 1, 10) < ?1`,
		)
		.bind(seasonStartDate)
		.all<{ athlete_id: number; strava_activity_id: number }>();
	const byRider = new Map<number, number[]>();
	for (const row of results) {
		const ids = byRider.get(row.athlete_id) ?? [];
		ids.push(row.strava_activity_id);
		byRider.set(row.athlete_id, ids);
	}
	return byRider;
}
