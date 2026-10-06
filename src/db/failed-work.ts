// Queue messages that exhausted their retries (research R7, FR-019). A row stays
// until its message succeeds, it is given up after 7 days, or its rider is
// deleted.

export interface FailedWork {
	id: number;
	athleteId: number;
	/** Canonical JSON from `serializeWorkMessage`. */
	message: string;
	lastError: string;
	firstFailedAt: number;
	failedAt: number;
	failures: number;
}

interface FailedWorkRow {
	id: number;
	athlete_id: number;
	message: string;
	last_error: string;
	first_failed_at: number;
	failed_at: number;
	failures: number;
}

const toFailedWork = (r: FailedWorkRow): FailedWork => ({
	id: r.id,
	athleteId: r.athlete_id,
	message: r.message,
	lastError: r.last_error,
	firstFailedAt: r.first_failed_at,
	failedAt: r.failed_at,
	failures: r.failures,
});

export async function upsertFailedWork(
	db: D1Database,
	failure: {
		athleteId: number;
		message: string;
		lastError: string;
		now: number;
	},
): Promise<void> {
	await db
		.prepare(
			`INSERT INTO failed_work (athlete_id, message, last_error, first_failed_at,
				failed_at, failures)
			VALUES (?1, ?2, ?3, ?4, ?4, 1)
			ON CONFLICT (message) DO UPDATE SET last_error = ?3, failed_at = ?4,
				failures = failures + 1`,
		)
		.bind(failure.athleteId, failure.message, failure.lastError, failure.now)
		.run();
}

export async function deleteFailedWorkByMessage(
	db: D1Database,
	message: string,
): Promise<void> {
	await db
		.prepare("DELETE FROM failed_work WHERE message = ?")
		.bind(message)
		.run();
}

export async function listFailedWorkFirstFailedSince(
	db: D1Database,
	since: number,
): Promise<FailedWork[]> {
	const { results } = await db
		.prepare("SELECT * FROM failed_work WHERE first_failed_at >= ? ORDER BY id")
		.bind(since)
		.all<FailedWorkRow>();
	return results.map(toFailedWork);
}

/** Gives up rows older than `before`; returns them for logging. */
export async function deleteFailedWorkFirstFailedBefore(
	db: D1Database,
	before: number,
): Promise<FailedWork[]> {
	const { results } = await db
		.prepare("DELETE FROM failed_work WHERE first_failed_at < ? RETURNING *")
		.bind(before)
		.all<FailedWorkRow>();
	return results.map(toFailedWork).sort((a, b) => a.id - b.id);
}
