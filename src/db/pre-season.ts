// Rides, runs and swims that start before the season start (`before`, an ISO
// time like Strava's `start_date`), per rider. Nothing older is stored any
// more; this finds what was stored before that rule, or under an earlier
// season start.
export async function listPreSeasonActivities(
	db: D1Database,
	before: string,
): Promise<Map<number, number[]>> {
	const { results } = await db
		.prepare(
			`SELECT athlete_id, strava_activity_id FROM activities WHERE start_date < ?1
			UNION ALL
			SELECT athlete_id, strava_activity_id FROM runs WHERE start_date < ?1
			UNION ALL
			SELECT athlete_id, strava_activity_id FROM swims WHERE start_date < ?1`,
		)
		.bind(before)
		.all<{ athlete_id: number; strava_activity_id: number }>();
	const byRider = new Map<number, number[]>();
	for (const row of results) {
		const ids = byRider.get(row.athlete_id) ?? [];
		ids.push(row.strava_activity_id);
		byRider.set(row.athlete_id, ids);
	}
	return byRider;
}
