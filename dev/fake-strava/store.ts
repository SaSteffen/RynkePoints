import type { StravaActivity } from "../../src/strava/activity";

// The fake Strava's activities (specs/006-local-frontend-dev data-model.md
// "Fake activity"). They live in fake mode's local D1, in a table the dev entry
// creates itself: it is never a migration, so production never has it.

/** What the fake sends for an activity: the fields the app reads, and a name. */
export interface FakeActivity extends StravaActivity {
	name: string;
}

export interface StoredActivity {
	athleteId: number;
	body: FakeActivity;
}

const FIRST_ID = 8_000_001;

export async function ensureTable(db: D1Database): Promise<void> {
	await db
		.prepare(
			`CREATE TABLE IF NOT EXISTS fake_strava_activities (
				id INTEGER PRIMARY KEY,
				athlete_id INTEGER NOT NULL,
				body TEXT NOT NULL
			)`,
		)
		.run();
}

export async function tableExists(db: D1Database): Promise<boolean> {
	const row = await db
		.prepare(
			"SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = 'fake_strava_activities'",
		)
		.first();
	return row !== null;
}

export async function clearActivities(db: D1Database): Promise<void> {
	await db.prepare("DELETE FROM fake_strava_activities").run();
}

/**
 * Inserts the activities in order, numbering on from the highest ID (8_000_001
 * in an empty table). Returns the new IDs.
 */
export async function insertActivities(
	db: D1Database,
	items: readonly { athleteId: number; body: Omit<FakeActivity, "id"> }[],
): Promise<number[]> {
	if (items.length === 0) return [];
	const next = `COALESCE((SELECT MAX(id) FROM fake_strava_activities), ${FIRST_ID - 1}) + 1`;
	const results = await db.batch<{ id: number }>(
		items.map(({ athleteId, body }) =>
			db
				.prepare(
					`INSERT INTO fake_strava_activities (id, athlete_id, body)
					VALUES (${next}, ?, json_set(?, '$.id', ${next})) RETURNING id`,
				)
				.bind(athleteId, JSON.stringify(body)),
		),
	);
	return results.map((r) => r.results[0]?.id ?? 0);
}

export async function insertActivity(
	db: D1Database,
	athleteId: number,
	body: Omit<FakeActivity, "id">,
): Promise<number> {
	const [id] = await insertActivities(db, [{ athleteId, body }]);
	return id ?? 0;
}

export async function updateActivity(
	db: D1Database,
	body: FakeActivity,
): Promise<void> {
	await db
		.prepare("UPDATE fake_strava_activities SET body = ? WHERE id = ?")
		.bind(JSON.stringify(body), body.id)
		.run();
}

export async function deleteActivity(
	db: D1Database,
	id: number,
): Promise<void> {
	await db
		.prepare("DELETE FROM fake_strava_activities WHERE id = ?")
		.bind(id)
		.run();
}

export async function getActivity(
	db: D1Database,
	id: number,
): Promise<StoredActivity | null> {
	const row = await db
		.prepare("SELECT athlete_id, body FROM fake_strava_activities WHERE id = ?")
		.bind(id)
		.first<{ athlete_id: number; body: string }>();
	return row && { athleteId: row.athlete_id, body: JSON.parse(row.body) };
}

/**
 * The rider's activities that started after `after` (epoch seconds), oldest
 * first, one page of `perPage`.
 */
export async function listActivities(
	db: D1Database,
	athleteId: number,
	options: {
		after: number;
		page: number;
		perPage: number;
		includePrivate: boolean;
	},
): Promise<FakeActivity[]> {
	const { results } = await db
		.prepare(
			`SELECT body FROM fake_strava_activities WHERE athlete_id = ?
			ORDER BY json_extract(body, '$.start_date'), id`,
		)
		.bind(athleteId)
		.all<{ body: string }>();
	const { after, page, perPage, includePrivate } = options;
	return results
		.map((r): FakeActivity => JSON.parse(r.body))
		.filter(
			(a) =>
				Date.parse(a.start_date) / 1000 > after &&
				(includePrivate || !a.private),
		)
		.slice((page - 1) * perPage, page * perPage);
}

/** Every activity of the rider, newest first, for the `/_dev/` forms. */
export async function riderActivities(
	db: D1Database,
	athleteId: number,
): Promise<FakeActivity[]> {
	const { results } = await db
		.prepare(
			`SELECT body FROM fake_strava_activities WHERE athlete_id = ?
			ORDER BY json_extract(body, '$.start_date') DESC, id DESC`,
		)
		.bind(athleteId)
		.all<{ body: string }>();
	return results.map((r): FakeActivity => JSON.parse(r.body));
}
