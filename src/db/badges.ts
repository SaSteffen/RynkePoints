// A rider's personal badges and their catalog version (feature 013
// data-model.md, research R13, R18). Writes are statements for the evaluation
// batch of `rynke/apply.ts`, so badges never disagree with the Rynke.

import type { EarnedBadge } from "../badges/evaluate";
import type { CountingWindow } from "../rynke/rules";
import { LISTED_RIDER_IDS } from "./organiser";

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
	/** Over the rider's counting rides (part C, research R29). */
	longestRideM: number;
	virtualDistanceM: number;
	/** Calendar month → days with a counting ride that isn't virtual. */
	winterDays: Partial<Record<number, number>>;
	/** Over the rider's swims, for the swim progress bars. */
	longestSwimM: number;
	swimDistanceM: number;
}

export async function readRiderBadges(
	db: D1Database,
	athleteId: number,
	window: CountingWindow,
): Promise<RiderBadgesRead> {
	const [badges, reveals, sums, runs, days, swims] = await db.batch([
		listRiderBadgesStatement(db, athleteId),
		listRevealsStatement(db, athleteId),
		db
			.prepare(
				`SELECT coalesce(sum(a.distance_m), 0) AS distance_m,
					coalesce(sum(r.elevation_dm), 0) AS elevation_dm,
					coalesce(max(a.distance_m), 0) AS longest_m,
					coalesce(sum(CASE WHEN r.is_virtual = 1 THEN a.distance_m END), 0)
						AS virtual_m
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
		// Days with an outdoor counting ride, per calendar month, by the local
		// start date as the evaluation counts them (research R24).
		db
			.prepare(
				`SELECT CAST(substr(a.start_date_local, 6, 2) AS INTEGER) AS month,
					count(DISTINCT substr(a.start_date_local, 1, 10)) AS days
				FROM ride_results r JOIN activities a
					ON a.strava_activity_id = r.strava_activity_id
				WHERE r.athlete_id = ?1 AND r.counts = 1 AND r.is_virtual = 0
				GROUP BY month`,
			)
			.bind(athleteId),
		db
			.prepare(
				`SELECT coalesce(max(distance_m), 0) AS longest_m,
					coalesce(sum(distance_m), 0) AS distance_m
				FROM swims WHERE athlete_id = ?1
					AND substr(start_date_local, 1, 10) BETWEEN ?2 AND ?3`,
			)
			.bind(athleteId, window.seasonStart, window.deadline),
	]);
	if (!badges || !reveals || !sums || !runs || !days || !swims) {
		throw new Error("D1 batch returned too few results");
	}
	const sum = (
		sums.results as {
			distance_m: number;
			elevation_dm: number;
			longest_m: number;
			virtual_m: number;
		}[]
	)[0];
	const run = (runs.results as { longest_m: number; distance_m: number }[])[0];
	const swim = (
		swims.results as { longest_m: number; distance_m: number }[]
	)[0];
	const winterDays: Partial<Record<number, number>> = {};
	for (const row of days.results as { month: number; days: number }[]) {
		winterDays[row.month] = row.days;
	}
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
		longestRideM: sum?.longest_m ?? 0,
		virtualDistanceM: sum?.virtual_m ?? 0,
		winterDays,
		longestSwimM: swim?.longest_m ?? 0,
		swimDistanceM: swim?.distance_m ?? 0,
	};
}

// Team badge notices (issue #125): per season, the team badges already
// announced. Ids only, nothing about riders (FR-032).

/**
 * The announced team badge ids of a season (null: never checked), and whether
 * any season was checked before (`checked` is 1).
 */
export function readTeamBadgeNoticesStatement(
	db: D1Database,
	seasonStart: string,
) {
	return db
		.prepare(
			`SELECT
				(SELECT badge_ids FROM team_badge_notices WHERE season_start = ?)
					AS badge_ids,
				EXISTS (SELECT 1 FROM team_badge_notices) AS checked`,
		)
		.bind(seasonStart);
}

/**
 * The season's first check: stores `badgeIds` as announced, unless another
 * check stored the season first.
 */
export function seedTeamBadgeNoticesStatement(
	db: D1Database,
	seasonStart: string,
	badgeIds: readonly string[],
	now: number,
) {
	return db
		.prepare(
			`INSERT INTO team_badge_notices (season_start, badge_ids, checked_at)
			VALUES (?, ?, ?) ON CONFLICT (season_start) DO NOTHING`,
		)
		.bind(seasonStart, JSON.stringify(badgeIds), now);
}

/**
 * Replaces the announced ids only if they are still `previous` (exactly as
 * read), so of two checks racing each other one announces and the other
 * changes nothing.
 */
export function advanceTeamBadgeNoticesStatement(
	db: D1Database,
	seasonStart: string,
	previous: string,
	badgeIds: readonly string[],
	now: number,
) {
	return db
		.prepare(
			`UPDATE team_badge_notices SET badge_ids = ?, checked_at = ?
			WHERE season_start = ? AND badge_ids = ?`,
		)
		.bind(JSON.stringify(badgeIds), now, seasonStart, previous);
}

/**
 * The listed riders with the day they connected and the reveals they already
 * have of `badgeIds`, for working out to whom a team badge is new (R16).
 */
export function teamBadgeAudienceStatements(
	db: D1Database,
	badgeIds: readonly string[],
): D1PreparedStatement[] {
	return [
		db.prepare(
			`SELECT athlete_id, connected_at FROM riders
			WHERE athlete_id IN (${LISTED_RIDER_IDS}) ORDER BY athlete_id`,
		),
		db
			.prepare(
				`SELECT athlete_id, badge_id, earned_on FROM badge_reveals
				WHERE athlete_id IN (${LISTED_RIDER_IDS})
				AND badge_id IN (SELECT value FROM json_each(?1))`,
			)
			.bind(JSON.stringify(badgeIds)),
	];
}

/**
 * Writes `badgeIds`, new team badges, as the rider's badge rise; with `keep`,
 * alongside the badges of the rise the same change already wrote. It goes in
 * one batch after `advanceTeamBadgeNoticesStatement(…, announced, now)` and
 * only writes while the season's notice is what that stored, so the
 * announcement and its rises are stored together, and a check that lost the
 * race writes nothing new.
 */
export function teamBadgeRiseStatement(
	db: D1Database,
	athleteId: number,
	badgeIds: readonly string[],
	keep: boolean,
	notice: { seasonStart: string; announced: readonly string[] },
	now: number,
) {
	return db
		.prepare(
			`INSERT INTO badge_rises (athlete_id, badge_ids, risen_at)
			SELECT ?1, ?2, ?3 WHERE EXISTS (
				SELECT 1 FROM team_badge_notices
				WHERE season_start = ?5 AND badge_ids = ?6 AND checked_at = ?3
			)
			ON CONFLICT (athlete_id) DO UPDATE SET
				badge_ids = CASE WHEN ?4 THEN (
					SELECT json_group_array(value) FROM (
						SELECT value FROM json_each(badge_rises.badge_ids)
						UNION SELECT value FROM json_each(?2)
					)
				) ELSE ?2 END,
				risen_at = ?3`,
		)
		.bind(
			athleteId,
			JSON.stringify(badgeIds),
			now,
			keep ? 1 : 0,
			notice.seasonStart,
			JSON.stringify(notice.announced),
		);
}
