// A rider's personal badges and their catalog version (feature 013
// data-model.md, research R13, R18). Writes are statements for the evaluation
// batch of `rynke/apply.ts`, so badges never disagree with the Rynke.

import type { EarnedBadge } from "../badges/evaluate";
import type { CountingWindow } from "../rynke/rules";

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

/**
 * Marks `badges` as revealed to the rider with their current date (research
 * R16): from a GET of the Overview, or in the evaluation batch for silent
 * awards.
 */
export function upsertRevealsStatement(
	db: D1Database,
	athleteId: number,
	badges: readonly EarnedBadge[],
) {
	return db
		.prepare(
			`INSERT INTO badge_reveals (athlete_id, badge_id, earned_on)
			SELECT ?2, json_extract(value, '$.badgeId'), json_extract(value, '$.earnedOn')
			FROM json_each(?1) WHERE true
			ON CONFLICT (athlete_id, badge_id) DO UPDATE SET earned_on = excluded.earned_on`,
		)
		.bind(JSON.stringify(badges), athleteId);
}

/** The rider's last badge rise (research R17); replaces the one before. */
export function upsertBadgeRiseStatement(
	db: D1Database,
	athleteId: number,
	badgeIds: readonly string[],
	now: number,
) {
	return db
		.prepare(
			`INSERT INTO badge_rises (athlete_id, badge_ids, risen_at)
			VALUES (?1, ?2, ?3)
			ON CONFLICT (athlete_id) DO UPDATE SET badge_ids = ?2, risen_at = ?3`,
		)
		.bind(athleteId, JSON.stringify(badgeIds), now);
}

export function readBadgeRiseStatement(db: D1Database, athleteId: number) {
	return db
		.prepare("SELECT badge_ids, risen_at FROM badge_rises WHERE athlete_id = ?")
		.bind(athleteId);
}

/** The badges revealed to the rider; the Overview's and the Team page's read. */
export function listRevealsStatement(db: D1Database, athleteId: number) {
	return db
		.prepare(
			"SELECT badge_id, earned_on FROM badge_reveals WHERE athlete_id = ?",
		)
		.bind(athleteId);
}

/** Badge id → the date it had when it was revealed (research R16). */
export function revealedOf(
	rows: readonly { badge_id: string; earned_on: string }[],
): Map<string, string> {
	return new Map(rows.map((row) => [row.badge_id, row.earned_on]));
}

/** What the Overview's Abzeichen section needs beyond the rider view. */
export interface RiderBadgesRead {
	earned: EarnedBadge[];
	/** Badge id → the date it had when it was revealed (research R16). */
	revealed: Map<string, string>;
	/** Sums over the rider's counting rides, for the progress bars. */
	distanceM: number;
	elevationDm: number;
	/** Over the rider's outdoor runs, for the running progress bars. */
	longestRunM: number;
	runDistanceM: number;
}

export async function readRiderBadges(
	db: D1Database,
	athleteId: number,
	window: CountingWindow,
): Promise<RiderBadgesRead> {
	const [badges, reveals, sums, runs] = await db.batch([
		listRiderBadgesStatement(db, athleteId),
		listRevealsStatement(db, athleteId),
		db
			.prepare(
				`SELECT coalesce(sum(a.distance_m), 0) AS distance_m,
					coalesce(sum(r.elevation_dm), 0) AS elevation_dm
				FROM ride_results r JOIN activities a
					ON a.strava_activity_id = r.strava_activity_id
				WHERE r.athlete_id = ?1 AND r.counts = 1`,
			)
			.bind(athleteId),
		// By local start date, as the evaluation counts them.
		db
			.prepare(
				`SELECT coalesce(max(distance_m), 0) AS longest_m,
					coalesce(sum(distance_m), 0) AS distance_m
				FROM runs WHERE athlete_id = ?1
					AND substr(start_date_local, 1, 10) BETWEEN ?2 AND ?3`,
			)
			.bind(athleteId, window.seasonStart, window.deadline),
	]);
	if (!badges || !reveals || !sums || !runs) {
		throw new Error("D1 batch returned too few results");
	}
	const sum = (
		sums.results as { distance_m: number; elevation_dm: number }[]
	)[0];
	const run = (runs.results as { longest_m: number; distance_m: number }[])[0];
	return {
		earned: (badges.results as RiderBadgeRow[]).map((row) => ({
			badgeId: row.badge_id,
			earnedOn: row.earned_on,
		})),
		revealed: revealedOf(
			reveals.results as { badge_id: string; earned_on: string }[],
		),
		distanceM: sum?.distance_m ?? 0,
		elevationDm: sum?.elevation_dm ?? 0,
		longestRunM: run?.longest_m ?? 0,
		runDistanceM: run?.distance_m ?? 0,
	};
}
