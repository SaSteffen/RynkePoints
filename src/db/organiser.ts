import { SHARED_RIDER_IDS } from "./consents";

// The riders an organiser sees (feature 014 research R10): connected riders who
// share their data with the team, filtered inside SQL (004 FR-021). That
// includes the organiser themselves.

export interface ListedRiderRow {
	athlete_id: number;
	first_name: string;
}

export interface ListedRider extends ListedRiderRow {
	/** The Strava profile, set only when another listed rider shares the name. */
	profileLink: string | null;
}

/**
 * The listed riders' IDs as a subquery, for reads that run in the same batch as
 * `listListedRidersStatement` (feature 016 data-model.md).
 */
export const LISTED_RIDER_IDS = `SELECT athlete_id FROM riders
	WHERE status = 'connected' AND athlete_id IN (${SHARED_RIDER_IDS})`;

/** `ListedRiderRow`s ordered by first name. */
export function listListedRidersStatement(db: D1Database) {
	return db.prepare(
		`SELECT athlete_id, first_name FROM riders
		WHERE athlete_id IN (${LISTED_RIDER_IDS})
		ORDER BY first_name COLLATE NOCASE, athlete_id`,
	);
}

/** Tells riders with the same first name apart, case-insensitively (004 FR-022). */
export function withProfileLinks(rows: ListedRiderRow[]): ListedRider[] {
	const counts = new Map<string, number>();
	for (const row of rows) {
		const name = row.first_name.toLowerCase();
		counts.set(name, (counts.get(name) ?? 0) + 1);
	}
	return rows.map((row) => ({
		...row,
		profileLink:
			(counts.get(row.first_name.toLowerCase()) ?? 0) > 1
				? `https://www.strava.com/athletes/${row.athlete_id}`
				: null,
	}));
}
