import {
	type CallCount,
	STRAVA_ACTIONS,
	STRAVA_ENDPOINTS,
	type StravaAction,
	type StravaEndpoint,
} from "../strava/calls";
import { isOneOf } from "../work/messages";

// This team's Strava calls per UTC day (feature 047 data-model.md): calls and
// held-back calls by action and endpoint in `strava_calls_daily`, the highest
// daily total Strava reported in `strava_seen_daily`. Counts only, kept 30 days.

/**
 * Counts one answered call, and raises the day's Strava count to `seen` if
 * that is higher. One batch.
 */
export async function countCall(
	db: D1Database,
	day: string,
	action: StravaAction,
	endpoint: StravaEndpoint,
	seen: number | null,
): Promise<void> {
	const call = db
		.prepare(
			`INSERT INTO strava_calls_daily (day, action, endpoint, calls)
			VALUES (?, ?, ?, 1)
			ON CONFLICT (day, action, endpoint) DO UPDATE SET calls = calls + 1`,
		)
		.bind(day, action, endpoint);
	if (seen === null) {
		await call.run();
		return;
	}
	await db.batch([
		call,
		db
			.prepare(
				`INSERT INTO strava_seen_daily (day, seen) VALUES (?, ?)
				ON CONFLICT (day) DO UPDATE SET seen = MAX(seen, excluded.seen)`,
			)
			.bind(day, seen),
	]);
}

/** Counts one call the budget refused before it was made. */
export async function countHeldBack(
	db: D1Database,
	day: string,
	action: StravaAction,
	endpoint: StravaEndpoint,
): Promise<void> {
	await db
		.prepare(
			`INSERT INTO strava_calls_daily (day, action, endpoint, held_back)
			VALUES (?, ?, ?, 1)
			ON CONFLICT (day, action, endpoint) DO UPDATE SET held_back = held_back + 1`,
		)
		.bind(day, action, endpoint)
		.run();
}

/**
 * Every count from `since` on, and each day's Strava count, in one batch. An
 * action or endpoint this release doesn't know, from a later one, is left out.
 */
export async function readCalls(
	db: D1Database,
	since: string,
): Promise<{ counts: CallCount[]; seen: Map<string, number> }> {
	const [counts, seen] = await db.batch([
		db
			.prepare(
				`SELECT day, action, endpoint, calls, held_back FROM strava_calls_daily
				WHERE day >= ? ORDER BY day`,
			)
			.bind(since),
		db
			.prepare("SELECT day, seen FROM strava_seen_daily WHERE day >= ?")
			.bind(since),
	]);
	const rows = (counts?.results ?? []) as {
		day: string;
		action: string;
		endpoint: string;
		calls: number;
		held_back: number;
	}[];
	return {
		counts: rows.flatMap((r) =>
			isOneOf(STRAVA_ACTIONS, r.action) && isOneOf(STRAVA_ENDPOINTS, r.endpoint)
				? [
						{
							day: r.day,
							action: r.action,
							endpoint: r.endpoint,
							calls: r.calls,
							heldBack: r.held_back,
						},
					]
				: [],
		),
		seen: new Map(
			((seen?.results ?? []) as { day: string; seen: number }[]).map((r) => [
				r.day,
				r.seen,
			]),
		),
	};
}

/** Deletes the days before `firstKept` (FR-017). */
export async function pruneStravaCalls(
	db: D1Database,
	firstKept: string,
): Promise<void> {
	await db.batch([
		db.prepare("DELETE FROM strava_calls_daily WHERE day < ?").bind(firstKept),
		db.prepare("DELETE FROM strava_seen_daily WHERE day < ?").bind(firstKept),
	]);
}
