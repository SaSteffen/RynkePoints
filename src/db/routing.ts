import {
	firstRoutingDay,
	type RoutingCount,
	TEAM_FIGURES,
	type TeamFigure,
} from "../routing/figures";

// Gateway routing's counts per UTC day (feature 046 data-model.md): this team's
// own figures, counted here, and what the gateway's exchange brought. Counts
// only, kept 30 days.

/** Adds `n` to one of this team's own figures. */
export function addRoutingCountStatement(
	db: D1Database,
	day: string,
	team: string,
	figure: TeamFigure,
	n = 1,
): D1PreparedStatement {
	return db
		.prepare(
			`INSERT INTO routing_daily (day, team, figure, count) VALUES (?, ?, ?, ?)
			ON CONFLICT (day, team, figure) DO UPDATE SET count = count + excluded.count`,
		)
		.bind(day, team, figure, n);
}

/** Every count from `since` on, by day. */
export async function readRoutingCounts(
	db: D1Database,
	since: string,
): Promise<RoutingCount[]> {
	const { results } = await db
		.prepare(
			`SELECT day, team, figure, count FROM routing_daily
			WHERE day >= ? ORDER BY day, team, figure`,
		)
		.bind(since)
		.all<RoutingCount>();
	return results;
}

/** This team's own figures from `since` on, as the exchange hands them over. */
export async function ownRoutingCounts(
	db: D1Database,
	team: string,
	since: string,
): Promise<{ day: string; figure: TeamFigure; count: number }[]> {
	const { results } = await db
		.prepare(
			`SELECT day, figure, count FROM routing_daily
			WHERE team = ? AND day >= ?
				AND figure IN (SELECT value FROM json_each(?))
			ORDER BY day, figure`,
		)
		.bind(team, since, JSON.stringify(TEAM_FIGURES))
		.all<{ day: string; figure: TeamFigure; count: number }>();
	return results;
}

/** Stores what the gateway's exchange brought, replacing what was there. */
export function upsertRoutingCountStatement(
	db: D1Database,
	count: RoutingCount,
): D1PreparedStatement {
	return db
		.prepare(
			`INSERT INTO routing_daily (day, team, figure, count) VALUES (?, ?, ?, ?)
			ON CONFLICT (day, team, figure) DO UPDATE SET count = excluded.count`,
		)
		.bind(count.day, count.team, count.figure, count.count);
}

/** Deletes counts older than 30 days (FR-026). */
export async function pruneRoutingCounts(
	db: D1Database,
	today: string,
): Promise<void> {
	await db
		.prepare("DELETE FROM routing_daily WHERE day < ?")
		.bind(firstRoutingDay(today))
		.run();
}

/** Everyone this team holds, rider or guest, in any state (FR-004, FR-006). */
export async function listHeldAthleteIds(db: D1Database): Promise<string[]> {
	const { results } = await db
		.prepare(
			"SELECT CAST(athlete_id AS TEXT) AS athlete_id FROM riders ORDER BY riders.athlete_id",
		)
		.all<{ athlete_id: string }>();
	return results.map((r) => r.athlete_id);
}
