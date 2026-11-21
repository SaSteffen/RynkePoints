import { encryptToken } from "../crypto/encrypt";

// Grants let go of but not yet withdrawn (feature 041 research R14,
// contracts/withdrawal.md). One row per person: any revoke ends the whole
// grant, so the newest token is enough.

export interface PendingRevocation {
	athleteId: string;
	refreshTokenEnc: string;
}

/**
 * Keeps a rider's stored refresh token, before their rows are deleted.
 * False when nothing is stored.
 */
export async function keepStoredToken(
	db: D1Database,
	athleteId: string,
	now: number,
): Promise<boolean> {
	const { meta } = await db
		.prepare(
			`INSERT INTO pending_revocations (athlete_id, refresh_token_enc, since)
			SELECT athlete_id, refresh_token_enc, ?2 FROM strava_credentials
			WHERE athlete_id = ?1
			ON CONFLICT (athlete_id) DO UPDATE SET
				refresh_token_enc = excluded.refresh_token_enc, since = excluded.since`,
		)
		.bind(athleteId, now)
		.run();
	return meta.changes > 0;
}

/** Keeps a token just exchanged at a refused sign-in, encrypted. */
export async function keepToken(
	env: { DB: D1Database; TOKEN_ENCRYPTION_KEY: string },
	athleteId: string,
	refreshToken: string,
	now: number,
): Promise<void> {
	await env.DB.prepare(
		`INSERT INTO pending_revocations (athlete_id, refresh_token_enc, since)
		VALUES (?1, ?2, ?3)
		ON CONFLICT (athlete_id) DO UPDATE SET
			refresh_token_enc = excluded.refresh_token_enc, since = excluded.since`,
	)
		.bind(
			athleteId,
			await encryptToken(refreshToken, env.TOKEN_ENCRYPTION_KEY),
			now,
		)
		.run();
}

export async function getPendingRevocation(
	db: D1Database,
	athleteId: string,
): Promise<PendingRevocation | null> {
	const row = await db
		.prepare(
			"SELECT refresh_token_enc FROM pending_revocations WHERE athlete_id = ?",
		)
		.bind(athleteId)
		.first<{ refresh_token_enc: string }>();
	return row ? { athleteId, refreshTokenEnc: row.refresh_token_enc } : null;
}

export async function listPendingRevocationIds(
	db: D1Database,
): Promise<string[]> {
	const { results } = await db
		.prepare(
			"SELECT CAST(athlete_id AS TEXT) AS athlete_id FROM pending_revocations ORDER BY since",
		)
		.all<{ athlete_id: string }>();
	return results.map((r) => r.athlete_id);
}

/** Drops a settled row, unless a newer token replaced it meanwhile. */
export async function dropPendingRevocation(
	db: D1Database,
	row: PendingRevocation,
): Promise<void> {
	await db
		.prepare(
			"DELETE FROM pending_revocations WHERE athlete_id = ? AND refresh_token_enc = ?",
		)
		.bind(row.athleteId, row.refreshTokenEnc)
		.run();
}
