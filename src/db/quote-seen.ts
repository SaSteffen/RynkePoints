// The Team page quotes a rider has already seen (issue #96), so the page shows
// each quote that fits them once before any comes back. Only the Team page reads
// and writes it; rows hold quote ids (`quoteId`), nothing else.

/** The ids of the quotes the rider has seen in the current round. */
export async function readSeenQuotes(
	db: D1Database,
	athleteId: number,
): Promise<Set<string>> {
	const { results } = await db
		.prepare("SELECT quote_id FROM quote_seen WHERE athlete_id = ?")
		.bind(athleteId)
		.all<{ quote_id: string }>();
	return new Set(results.map((row) => row.quote_id));
}

/**
 * Marks the quote `quoteId` as seen. With `restart`, the ids of every quote of
 * the list the rider just finished, those are marked unseen first, so the next
 * round starts with only this quote seen and never repeats it right away.
 */
export async function writeSeenQuote(
	db: D1Database,
	athleteId: number,
	quoteId: string,
	restart: readonly string[] | null,
): Promise<void> {
	const insert = db
		.prepare(
			`INSERT INTO quote_seen (athlete_id, quote_id) VALUES (?1, ?2)
			ON CONFLICT (athlete_id, quote_id) DO NOTHING`,
		)
		.bind(athleteId, quoteId);
	if (restart === null) {
		await insert.run();
		return;
	}
	// The ids go in as one JSON array: a list has more quotes than D1 binds.
	await db.batch([
		db
			.prepare(
				`DELETE FROM quote_seen
				WHERE athlete_id = ?1 AND quote_id IN (SELECT value FROM json_each(?2))`,
			)
			.bind(athleteId, JSON.stringify(restart)),
		insert,
	]);
}
