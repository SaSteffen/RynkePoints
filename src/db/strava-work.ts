import {
	parseWorkMessage,
	serializeWorkMessage,
	type WorkMessage,
} from "../work/messages";

// Waiting Strava work, one first-in-first-out list per rider, done round robin
// (feature 024 data-model.md, research R1–R4, R6, R7). Only the queue consumer
// writes these tables, one invocation at a time (`max_concurrency: 1`), so the
// turn sequence needs no lock.

/** Waiting activity events from which the rider's pages show the line (FR-018). */
export const PROGRESS_THRESHOLD = 10;

export interface StravaWorkItem {
	id: number;
	athleteId: number;
	message: WorkMessage;
	/** The attempt this run is, counted like a queue message's `attempts`. */
	attempts: number;
}

/** The next position at the back of the round. */
const NEXT_TURN = "COALESCE((SELECT MAX(turn) FROM strava_queues), 0) + 1";

/**
 * Stores a message that needs Strava. A rider without waiting work gets a queue
 * row with the next turn and `fresh = 1` (FR-002a); a rider who has one keeps
 * their turn (FR-002b). The row remembers their Rynke, 0 before the first
 * balance as `evaluateChange` counts it, for the backlog's one notification
 * (R6). An activity event counts towards the line (R7).
 */
export async function storeWork(
	db: D1Database,
	message: WorkMessage,
	attempts: number,
	now: number,
): Promise<void> {
	const athleteId = message.athleteId;
	const statements = [
		db
			.prepare(
				`INSERT INTO strava_queues (athlete_id, fresh, turn, start_training,
					start_team, created_at)
				SELECT ?1, 1, ${NEXT_TURN}, COALESCE(b.training_rynke, 0),
					COALESCE(b.team_rynke, 0), ?2
				FROM (SELECT 1) LEFT JOIN rynke_balances b ON b.athlete_id = ?1
				WHERE true
				ON CONFLICT (athlete_id) DO NOTHING`,
			)
			.bind(athleteId, now),
		db
			.prepare(
				`INSERT INTO strava_work (athlete_id, message, kind, attempts,
					not_before, stored_at)
				VALUES (?1, ?2, ?3, ?4, 0, ?5)`,
			)
			.bind(
				athleteId,
				serializeWorkMessage(message),
				message.kind,
				Math.max(1, attempts),
				now,
			),
	];
	if (message.kind === "activity-event") {
		statements.push(
			db
				.prepare(
					`UPDATE strava_queues SET events_total = events_total + 1,
						show_progress = CASE
							WHEN events_total + 1 - events_done >= ?2 THEN 1
							ELSE show_progress END
					WHERE athlete_id = ?1`,
				)
				.bind(athleteId, PROGRESS_THRESHOLD),
		);
	}
	await db.batch(statements);
}

interface WorkRow {
	id: number;
	athlete_id: number;
	message: string;
	attempts: number;
}

/**
 * The item whose turn it is: the oldest row of the first rider by
 * `fresh DESC, turn` whose oldest row is ready (research R2). A row that no
 * longer parses is dropped and the next one looked at.
 */
export async function nextWork(
	db: D1Database,
	now: number,
): Promise<StravaWorkItem | null> {
	for (;;) {
		const row = await db
			.prepare(
				`SELECT w.id, w.athlete_id, w.message, w.attempts
				FROM strava_queues q
				JOIN strava_work w ON w.id = (
					SELECT MIN(x.id) FROM strava_work x WHERE x.athlete_id = q.athlete_id
				)
				WHERE w.not_before <= ?1
				ORDER BY q.fresh DESC, q.turn
				LIMIT 1`,
			)
			.bind(now)
			.first<WorkRow>();
		if (!row) return null;
		const message = parseWorkMessage(safeParse(row.message));
		if (message && message.athleteId === row.athlete_id) {
			return {
				id: row.id,
				athleteId: row.athlete_id,
				message,
				attempts: row.attempts,
			};
		}
		console.error(`Dropping unreadable strava_work row ${row.id}`);
		await db.prepare("DELETE FROM strava_work WHERE id = ?").bind(row.id).run();
		await closeQueueIfEmpty(db, row.athlete_id);
	}
}

function safeParse(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
}

/**
 * When the first rider's oldest row is ready, if any row waits at all. Only the
 * oldest rows count: a rider's later rows wait behind it, whatever theirs say.
 */
export async function earliestWaiting(db: D1Database): Promise<number | null> {
	const row = await db
		.prepare(
			`SELECT MIN(not_before) AS t FROM strava_work
			WHERE id IN (SELECT MIN(id) FROM strava_work GROUP BY athlete_id)`,
		)
		.first<{ t: number | null }>();
	return row?.t ?? null;
}

/** Moves the rider to the back of the round: they had their turn (R2). */
function servedStatement(db: D1Database, athleteId: number) {
	return db
		.prepare(
			`UPDATE strava_queues SET fresh = 0, turn = ${NEXT_TURN}
			WHERE athlete_id = ?`,
		)
		.bind(athleteId);
}

/**
 * The item is done, whatever its outcome (ok, not found, or given up into
 * `failed_work`). Returns how many rows the rider still has waiting.
 */
export async function finishWork(
	db: D1Database,
	item: StravaWorkItem,
): Promise<number> {
	const statements = [
		db.prepare("DELETE FROM strava_work WHERE id = ?").bind(item.id),
		servedStatement(db, item.athleteId),
	];
	if (item.message.kind === "activity-event") {
		statements.push(
			db
				.prepare(
					`UPDATE strava_queues SET events_done = MIN(events_total, events_done + 1)
					WHERE athlete_id = ?`,
				)
				.bind(item.athleteId),
		);
	}
	await db.batch(statements);
	return waitingCount(db, item.athleteId);
}

/** A transient failure: try again after the backoff, at the back of the round. */
export async function retryWork(
	db: D1Database,
	item: StravaWorkItem,
	notBefore: number,
): Promise<void> {
	await db.batch([
		db
			.prepare(
				"UPDATE strava_work SET attempts = attempts + 1, not_before = ? WHERE id = ?",
			)
			.bind(notBefore, item.id),
		servedStatement(db, item.athleteId),
	]);
}

export async function waitingCount(
	db: D1Database,
	athleteId: number,
): Promise<number> {
	return (
		(await db
			.prepare("SELECT COUNT(*) AS n FROM strava_work WHERE athlete_id = ?")
			.bind(athleteId)
			.first<number>("n")) ?? 0
	);
}

/**
 * Everything a rider had waiting goes, held notifications included: they need
 * to reconnect, or are gone (FR-010).
 */
export async function dropRiderWork(
	db: D1Database,
	athleteId: number,
): Promise<void> {
	await db.batch([
		db.prepare("DELETE FROM strava_work WHERE athlete_id = ?").bind(athleteId),
		db
			.prepare("DELETE FROM strava_queues WHERE athlete_id = ?")
			.bind(athleteId),
		db.prepare("DELETE FROM strava_held WHERE owner_id = ?").bind(athleteId),
	]);
}

/** The queue row goes once nothing waits, so the next work makes them fresh. */
async function closeQueueIfEmpty(
	db: D1Database,
	athleteId: number,
): Promise<void> {
	await db
		.prepare(
			`DELETE FROM strava_queues WHERE athlete_id = ?1
			AND NOT EXISTS (SELECT 1 FROM strava_work WHERE athlete_id = ?1)`,
		)
		.bind(athleteId)
		.run();
}

// Held notifications (research R6).

export interface HeldBacklog {
	recipients: number[];
	startTraining: number | null;
	startTeam: number | null;
	badges: string[];
}

/** Riders owed a push once `ownerId`'s backlog is done; one row each. */
export async function holdRecipients(
	db: D1Database,
	ownerId: number,
	recipients: readonly number[],
): Promise<void> {
	if (recipients.length === 0) return;
	await db.batch(
		recipients.map((recipient) =>
			db
				.prepare(
					`INSERT INTO strava_held (owner_id, recipient_id) VALUES (?, ?)
					ON CONFLICT DO NOTHING`,
				)
				.bind(ownerId, recipient),
		),
	);
}

/** Adds the owner's badges of one item to what the backlog earned. */
export async function addHeldBadges(
	db: D1Database,
	ownerId: number,
	badgeIds: readonly string[],
): Promise<void> {
	if (badgeIds.length === 0) return;
	await db
		.prepare(
			`UPDATE strava_queues SET held_badges = (
				SELECT json_group_array(value) FROM (
					SELECT value FROM json_each(strava_queues.held_badges)
					UNION SELECT value FROM json_each(?2)
				)
			)
			WHERE athlete_id = ?1`,
		)
		.bind(ownerId, JSON.stringify(badgeIds))
		.run();
}

/** What a backlog holds; `null` when its queue row is gone. */
export async function readHeldBacklog(
	db: D1Database,
	ownerId: number,
): Promise<HeldBacklog | null> {
	const [held, queue] = await db.batch([
		db
			.prepare(
				"SELECT recipient_id FROM strava_held WHERE owner_id = ? ORDER BY recipient_id",
			)
			.bind(ownerId),
		db
			.prepare(
				`SELECT start_training, start_team, held_badges FROM strava_queues
				WHERE athlete_id = ?`,
			)
			.bind(ownerId),
	]);
	const row = (
		queue?.results as
			| {
					start_training: number | null;
					start_team: number | null;
					held_badges: string;
			  }[]
			| undefined
	)?.[0];
	if (!row) return null;
	return {
		recipients: ((held?.results ?? []) as { recipient_id: number }[]).map(
			(r) => r.recipient_id,
		),
		startTraining: row.start_training,
		startTeam: row.start_team,
		badges: JSON.parse(row.held_badges) as string[],
	};
}

/** The backlog is done: its queue row and held rows go (FR-018 line, R6). */
export async function closeBacklog(
	db: D1Database,
	ownerId: number,
): Promise<void> {
	await db.batch([
		db.prepare("DELETE FROM strava_held WHERE owner_id = ?").bind(ownerId),
		db
			.prepare(
				`DELETE FROM strava_queues WHERE athlete_id = ?1
				AND NOT EXISTS (SELECT 1 FROM strava_work WHERE athlete_id = ?1)`,
			)
			.bind(ownerId),
	]);
}

// The wake (research R4).

/**
 * Whether a `strava-turn` for `at` must be sent: none is pending at or before
 * it. Records `at` when one must.
 */
export async function claimWake(
	db: D1Database,
	at: number,
	now: number,
): Promise<boolean> {
	const result = await db
		.prepare(
			"UPDATE strava_turn SET wake_at = ?1 WHERE id = 1 AND (wake_at <= ?2 OR wake_at > ?1)",
		)
		.bind(at, now)
		.run();
	return result.meta.changes === 1;
}

// The progress line (research R7).

export type FetchProgress =
	| { kind: "import"; fetched: number }
	| { kind: "events"; done: number; total: number };

/** What the rider's line says, or `null` when it doesn't show (FR-018, FR-019). */
export async function readFetchProgress(
	db: D1Database,
	athleteId: number,
): Promise<FetchProgress | null> {
	const row = await db
		.prepare(
			`SELECT r.import_status, r.import_fetched, q.events_total, q.events_done,
				q.show_progress
			FROM riders r LEFT JOIN strava_queues q ON q.athlete_id = r.athlete_id
			WHERE r.athlete_id = ?`,
		)
		.bind(athleteId)
		.first<{
			import_status: string;
			import_fetched: number;
			events_total: number | null;
			events_done: number | null;
			show_progress: number | null;
		}>();
	if (!row) return null;
	if (row.import_status === "running" && row.import_fetched > 0) {
		return { kind: "import", fetched: row.import_fetched };
	}
	if (row.show_progress === 1 && row.events_total !== null) {
		return {
			kind: "events",
			done: row.events_done ?? 0,
			total: row.events_total,
		};
	}
	return null;
}
