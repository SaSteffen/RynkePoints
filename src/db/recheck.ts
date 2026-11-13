import type { StoredActivities } from "../recheck/diff";
import type { Candidate } from "../recheck/pace";
import { FIXABLE_REASONS } from "../rynke/rides";
import type { ActivityRecord, RunRecord, SwimRecord } from "../strava/activity";

// The ride edit re-check's rows (feature 036 data-model.md): the rider's
// stamp `riders.rechecked_at`, and the counts per UTC day in `recheck_daily`.

const DAY = 24 * 3600;
/** Only riders with an activity this recent are checked (FR-027). */
export const ACTIVE_DAYS = 30;
/** A ride this recent that a crop could rescue puts its rider in the fast lane. */
export const FAST_LANE_DAYS = 7;

/** Epoch seconds as a stored `start_date`. */
function startDate(epoch: number): string {
	return new Date(epoch * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** One of the rider `r`'s rides, runs or swims started in `[from, to)`. */
function startedBetween(from: string, to: string | null): string {
	const tables = ["activities", "runs", "swims"].map(
		(table) =>
			`EXISTS (SELECT 1 FROM ${table} WHERE athlete_id = r.athlete_id
				AND start_date >= ${from}${to ? ` AND start_date < ${to}` : ""})`,
	);
	return `(${tables.join(" OR ")})`;
}

/**
 * The riders a run may check (data-model.md "Eligible rider"): connected, the
 * import done, and active, with an activity started within the last 30 days.
 * `?1` is the start of those 30 days.
 */
const ELIGIBLE = `r.status = 'connected' AND r.import_status = 'done'
	AND ${startedBetween("?1", null)}`;

/** An eligible rider, with what the run's order and its count need. */
export interface RecheckCandidate extends Candidate {
	connectedAt: number;
	/**
	 * Active for more than 24 hours: an activity started between 24 hours and
	 * 30 days ago, so a rider back from a pause hasn't waited (research R13).
	 */
	settled: boolean;
}

/** Every eligible rider with stamp and fast-lane flag, in one query (R5, R6). */
export async function readCandidates(
	db: D1Database,
	now: number,
): Promise<RecheckCandidate[]> {
	const { results } = await db
		.prepare(
			`SELECT r.athlete_id, r.rechecked_at, r.connected_at,
				${startedBetween("?1", "?2")} AS settled,
				EXISTS (SELECT 1 FROM ride_results rr
					JOIN activities a ON a.strava_activity_id = rr.strava_activity_id
					WHERE rr.athlete_id = r.athlete_id AND rr.counts = 0
						AND a.start_date >= ?3
						AND EXISTS (SELECT 1 FROM json_each(rr.reasons)
							WHERE value IN (SELECT value FROM json_each(?4)))) AS fast_lane
			FROM riders r WHERE ${ELIGIBLE}`,
		)
		.bind(
			startDate(now - ACTIVE_DAYS * DAY),
			startDate(now - DAY),
			startDate(now - FAST_LANE_DAYS * DAY),
			JSON.stringify(FIXABLE_REASONS),
		)
		.all<{
			athlete_id: number;
			rechecked_at: number | null;
			connected_at: number;
			settled: number;
			fast_lane: number;
		}>();
	return results.map((r) => ({
		athleteId: r.athlete_id,
		recheckedAt: r.rechecked_at,
		connectedAt: r.connected_at,
		settled: r.settled === 1,
		fastLane: r.fast_lane === 1,
	}));
}

/** The team's active riders now, as the run counts them (usage view). */
export async function countActiveRiders(
	db: D1Database,
	now: number,
): Promise<number> {
	return (
		(await db
			.prepare(`SELECT COUNT(*) AS n FROM riders r WHERE ${ELIGIBLE}`)
			.bind(startDate(now - ACTIVE_DAYS * DAY))
			.first<number>("n")) ?? 0
	);
}

/** The run's own count: one upsert that adds, and keeps the day's largest wait. */
export function countRunStatement(
	db: D1Database,
	day: string,
	run: { sent: number; over24h: number; held: boolean },
) {
	return db
		.prepare(
			`INSERT INTO recheck_daily (day, sent, over_24h, runs_held)
			VALUES (?1, ?2, ?3, ?4)
			ON CONFLICT (day) DO UPDATE SET sent = sent + ?2,
				over_24h = MAX(over_24h, ?3), runs_held = runs_held + ?4`,
		)
		.bind(day, run.sent, run.over24h, run.held ? 1 : 0);
}

/** Stamps the chosen riders with the run's time (research R5). */
export function stampStatement(
	db: D1Database,
	athleteIds: readonly number[],
	now: number,
) {
	return db
		.prepare(
			`UPDATE riders SET rechecked_at = ?1
			WHERE athlete_id IN (SELECT value FROM json_each(?2))`,
		)
		.bind(now, JSON.stringify(athleteIds));
}

/** A day of `recheck_daily`, for the usage view. */
export interface RecheckDay {
	day: string;
	sent: number;
	skipped: number;
	failed: number;
	unordered: number;
	over24h: number;
	runsHeld: number;
}

/** The 14 latest days that have a row, newest first. */
export async function readRecheckDays(db: D1Database): Promise<RecheckDay[]> {
	const { results } = await db
		.prepare(
			`SELECT day, sent, skipped, failed, unordered, over_24h, runs_held
			FROM recheck_daily ORDER BY day DESC LIMIT 14`,
		)
		.all<{
			day: string;
			sent: number;
			skipped: number;
			failed: number;
			unordered: number;
			over_24h: number;
			runs_held: number;
		}>();
	return results.map((r) => ({
		day: r.day,
		sent: r.sent,
		skipped: r.skipped,
		failed: r.failed,
		unordered: r.unordered,
		over24h: r.over_24h,
		runsHeld: r.runs_held,
	}));
}

/** Days before `firstKept` go, with the usage history (13 months). */
export async function pruneRecheckDays(
	db: D1Database,
	firstKept: string,
): Promise<void> {
	await db
		.prepare("DELETE FROM recheck_daily WHERE day < ?")
		.bind(firstKept)
		.run();
}

/** A rider's stored rides, with the name, and runs and swims, by activity id. */
export async function readStoredActivities(
	db: D1Database,
	athleteId: number,
): Promise<StoredActivities> {
	const [rides, runs, swims] = await db.batch([
		db
			.prepare(
				`SELECT strava_activity_id, athlete_id, sport_type, start_date,
					start_date_local, timezone, distance_m, moving_time_s,
					elapsed_time_s, elevation_gain_m, is_manual, is_trainer, is_flagged,
					is_private, refreshed_at, name
				FROM activities WHERE athlete_id = ?`,
			)
			.bind(athleteId),
		...["runs", "swims"].map((table) =>
			db
				.prepare(
					`SELECT strava_activity_id, athlete_id, start_date, start_date_local,
						distance_m, is_private, refreshed_at
					FROM ${table} WHERE athlete_id = ?`,
				)
				.bind(athleteId),
		),
	]);
	const byId = <T extends { strava_activity_id: number }>(
		rows: readonly unknown[] | undefined,
	) =>
		new Map((rows as T[] | undefined)?.map((r) => [r.strava_activity_id, r]));
	return {
		rides: byId<ActivityRecord>(rides?.results),
		runs: byId<RunRecord>(runs?.results),
		swims: byId<SwimRecord>(swims?.results),
	};
}

/** What a check that didn't happen adds to its day. */
export interface CheckOutcome {
	skipped?: number;
	failed?: number;
	unordered?: number;
}

/** Adds the counts to the day's row, creating it. */
export function countOutcomeStatement(
	db: D1Database,
	day: string,
	{ skipped = 0, failed = 0, unordered = 0 }: CheckOutcome,
) {
	return db
		.prepare(
			`INSERT INTO recheck_daily (day, skipped, failed, unordered)
			VALUES (?1, ?2, ?3, ?4)
			ON CONFLICT (day) DO UPDATE SET skipped = skipped + ?2,
				failed = failed + ?3, unordered = unordered + ?4`,
		)
		.bind(day, skipped, failed, unordered);
}

/**
 * A skipped or failed check: the rider's stamp goes back to `previous` while it
 * is still the one the run set, so they keep their place (FR-017), and the day
 * counts it. One batch.
 */
export async function checkNotMade(
	db: D1Database,
	check: { athleteId: number; stamp: number; previous: number | null },
	day: string,
	outcome: CheckOutcome,
): Promise<void> {
	await db.batch([
		db
			.prepare(
				`UPDATE riders SET rechecked_at = ?1
				WHERE athlete_id = ?2 AND rechecked_at = ?3`,
			)
			.bind(check.previous, check.athleteId, check.stamp),
		countOutcomeStatement(db, day, outcome),
	]);
}
