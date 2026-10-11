// A rider's personal badges and their catalog version (feature 013
// data-model.md, research R13, R18). Writes are statements for the evaluation
// batch of `rynke/apply.ts`, so badges never disagree with the Rynke.

import type { EarnedBadge } from "../badges/evaluate";

export interface RiderBadgeRow {
	athlete_id: number;
	badge_id: string;
	earned_on: string;
}

export interface BadgesVersionRow {
	athlete_id: number;
	badges_version: number;
}

export function listBadgesOfRidersStatement(
	db: D1Database,
	athleteIds: number[],
) {
	return db
		.prepare(
			`SELECT athlete_id, badge_id, earned_on FROM rider_badges
			WHERE athlete_id IN (SELECT value FROM json_each(?1))`,
		)
		.bind(JSON.stringify(athleteIds));
}

export function readBadgesVersionsStatement(
	db: D1Database,
	athleteIds: number[],
) {
	return db
		.prepare(
			`SELECT athlete_id, badges_version FROM riders
			WHERE athlete_id IN (SELECT value FROM json_each(?1))`,
		)
		.bind(JSON.stringify(athleteIds));
}

/** One rider's badges, oldest first; the Overview's read. */
export function listRiderBadgesStatement(db: D1Database, athleteId: number) {
	return db
		.prepare(
			`SELECT athlete_id, badge_id, earned_on FROM rider_badges
			WHERE athlete_id = ? ORDER BY earned_on, badge_id`,
		)
		.bind(athleteId);
}

/** Inserts or re-dates `badges` with one statement, as one JSON parameter. */
export function upsertRiderBadgesStatement(
	db: D1Database,
	athleteId: number,
	badges: readonly EarnedBadge[],
) {
	return db
		.prepare(
			`INSERT INTO rider_badges (athlete_id, badge_id, earned_on)
			SELECT ?2, json_extract(value, '$.badgeId'), json_extract(value, '$.earnedOn')
			FROM json_each(?1) WHERE true
			ON CONFLICT (athlete_id, badge_id) DO UPDATE SET earned_on = excluded.earned_on`,
		)
		.bind(JSON.stringify(badges), athleteId);
}

export function deleteRiderBadgesStatement(
	db: D1Database,
	athleteId: number,
	badgeIds: readonly string[],
) {
	return db
		.prepare(
			`DELETE FROM rider_badges WHERE athlete_id = ?2
			AND badge_id IN (SELECT value FROM json_each(?1))`,
		)
		.bind(JSON.stringify(badgeIds), athleteId);
}

export function setBadgesVersionStatement(
	db: D1Database,
	athleteId: number,
	version: number,
) {
	return db
		.prepare("UPDATE riders SET badges_version = ? WHERE athlete_id = ?")
		.bind(version, athleteId);
}

/** What the Overview's Abzeichen section needs beyond the rider view. */
export interface RiderBadgesRead {
	earned: EarnedBadge[];
	/** Sums over the rider's counting rides, for the progress bars. */
	distanceM: number;
	elevationDm: number;
}

export async function readRiderBadges(
	db: D1Database,
	athleteId: number,
): Promise<RiderBadgesRead> {
	const [badges, sums] = await db.batch([
		listRiderBadgesStatement(db, athleteId),
		db
			.prepare(
				`SELECT coalesce(sum(a.distance_m), 0) AS distance_m,
					coalesce(sum(r.elevation_dm), 0) AS elevation_dm
				FROM ride_results r JOIN activities a
					ON a.strava_activity_id = r.strava_activity_id
				WHERE r.athlete_id = ?1 AND r.counts = 1`,
			)
			.bind(athleteId),
	]);
	if (!badges || !sums) throw new Error("D1 batch returned too few results");
	const sum = (
		sums.results as { distance_m: number; elevation_dm: number }[]
	)[0];
	return {
		earned: (badges.results as RiderBadgeRow[]).map((row) => ({
			badgeId: row.badge_id,
			earnedOn: row.earned_on,
		})),
		distanceM: sum?.distance_m ?? 0,
		elevationDm: sum?.elevation_dm ?? 0,
	};
}
