// The consent a rider accepted (data-model.md, research R21). Records are
// deleted with the rider by the schema's cascade (FR-022).

export interface Consent {
	version: number;
	acceptedAt: number;
}

/** Ticking the same version again keeps the first acceptance. */
export function recordConsentStatement(
	db: D1Database,
	athleteId: number,
	version: number,
	acceptedAt: number,
): D1PreparedStatement {
	return db
		.prepare(
			`INSERT OR IGNORE INTO consent_records (athlete_id, version, accepted_at)
			VALUES (?, ?, ?)`,
		)
		.bind(athleteId, version, acceptedAt);
}

export async function recordConsent(
	db: D1Database,
	athleteId: number,
	version: number,
	acceptedAt: number,
): Promise<void> {
	await recordConsentStatement(db, athleteId, version, acceptedAt).run();
}

/** The rider's current consent: the record with the highest version. */
export async function getCurrentConsent(
	db: D1Database,
	athleteId: number,
): Promise<Consent | null> {
	const row = await db
		.prepare(
			`SELECT version, accepted_at FROM consent_records WHERE athlete_id = ?
			ORDER BY version DESC LIMIT 1`,
		)
		.bind(athleteId)
		.first<{ version: number; accepted_at: number }>();
	return row ? { version: row.version, acceptedAt: row.accepted_at } : null;
}
